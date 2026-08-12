/* V9.0.82 — one physical raw-production line per product code/mould.
   Multiple internal/order demand rows for the same product code are unified for the factory.
   End-of-day actual output is entered once and distributed back across the underlying records. */
(function(){
'use strict';
if(window.VURawProductionUnified)return;
const api=window.VUDivisionDailyWork;
if(!api?.rawRows||!api?.openForm)return;
const RAW=new Set(['Casting','Packing','Resin']);
const n=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmt=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${dk(v)}T12:00:00`));
const codeKey=r=>{const code=String(r?.productCode||'').trim().toUpperCase().replace(/\s+/g,' ');return code?`code:${code}`:`id:${String(r?.productId||r?.id||'')}`};
const rawId=pid=>typeof vuRawBalanceId==='function'?vuRawBalanceId(pid):`${pid}::raw`;
const baseRawRows=api.rawRows.bind(api),baseOpen=api.openForm.bind(api);
function groupRows(rows){
  const groups=new Map();
  for(const row of rows||[]){
    const key=codeKey(row);if(!groups.has(key))groups.set(key,{id:`unified:${key}`,unifiedKey:key,productId:row.productId||'',productCode:row.productCode||'',productName:row.productName||'',targetQty:0,producedQty:0,inventoryAppliedQty:0,rawStockAtStart:0,rawStockNow:0,priority:Number(row.priority||9999),targetOrder:false,status:'Not started',note:'',components:[]});
    const g=groups.get(key);g.targetQty+=n(row.targetQty);g.producedQty+=n(row.producedQty||row.completedQty);g.inventoryAppliedQty+=n(row.inventoryAppliedQty);g.rawStockAtStart+=n(row.rawStockAtStart);g.rawStockNow+=n(row.rawStockNow);g.priority=Math.min(g.priority,Number(row.priority||9999));g.targetOrder=g.targetOrder||!!row.targetOrder;g.components.push({...row});
    if(!g.productCode&&row.productCode)g.productCode=row.productCode;if(!g.productName&&row.productName)g.productName=row.productName;
  }
  for(const g of groups.values()){
    const statuses=g.components.map(x=>String(x.status||''));g.status=statuses.includes('Problem')?'Problem':g.producedQty>=g.targetQty&&g.targetQty>0?'Completed':g.producedQty>0?'In progress':'Not started';g.note=[...new Set(g.components.map(x=>String(x.note||'').trim()).filter(Boolean))].join(' · ');
  }
  return [...groups.values()].sort((a,b)=>a.priority-b.priority||String(a.productCode||'').localeCompare(String(b.productCode||'')));
}
async function unifiedRows(date,division){return groupRows(await baseRawRows(date,division));}
function allocate(total,components){
  let left=Math.max(0,Math.round(n(total)));const out=[];
  for(const c of components){const qty=Math.min(left,Math.max(0,Math.round(n(c.targetQty))));out.push(qty);left-=qty;}
  if(left>0&&out.length)out[0]+=left;
  return out;
}
async function saveGroup(group,total,status,note,division,date){
  const allocations=allocate(total,group.components),now=new Date().toISOString(),checks=[];
  for(let i=0;i<group.components.length;i++){
    const c=group.components[i],job=await getOne('productionJobs',c.id);if(!job)continue;const desired=allocations[i]||0,applied=n(job.inventoryAppliedQty),delta=desired-applied,bid=rawId(job.productId),balance=await getOne('inventoryBalances',bid),before=n(balance?.quantity),after=before+delta;
    if(after<0)throw new Error(`${job.productCode||group.productCode}: some previously recorded stock has already been allocated. The grouped total cannot be reduced to ${total}. Count/correct raw stock instead.`);
    checks.push({job,desired,delta,bid,balance,before,after});
  }
  for(const x of checks){
    if(x.delta!==0){await putOne('inventoryBalances',{...(x.balance||{}),id:x.bid,productId:x.job.productId,productCode:x.job.productCode,productName:x.job.productName,colourName:'Raw Stock',quantity:x.after,updatedAt:now});await putOne('inventoryTransactions',{id:uid('inv'),productId:x.job.productId,productCode:x.job.productCode,productName:x.job.productName,colourName:'Raw Stock',type:'PRODUCTION_OUTPUT',previousQuantity:x.before,quantityChange:x.delta,newQuantity:x.after,note:`${division} unified output · ${date}`,reference:`${division} ${date}`,createdAt:now});}
    let s=status;if(s!=='Problem')s=x.desired>=n(x.job.targetQty)&&n(x.job.targetQty)>0?'Completed':x.desired>0?'In progress':'Not started';await putOne('productionJobs',{...x.job,producedQty:x.desired,completedQty:x.desired,inventoryAppliedQty:x.desired,status:s,note:note||'',updatedAt:now});
  }
}
async function openUnified(division,date){
  const d=dk(date||new Date()),rows=await unifiedRows(d,division),dialog=document.getElementById('dialog'),totalTarget=rows.reduce((s,r)=>s+n(r.targetQty),0),totalDone=rows.reduce((s,r)=>s+n(r.producedQty),0);
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:94vh;overflow:auto"><div class="dialog-head"><div><div class="eyebrow">UNIFIED RAW PRODUCTION</div><h2>${safe(division)} · ${safe(fmt(d))}</h2><p class="muted">One line per product code / mould. All order demand for the same item is combined into one factory total.</p></div><button class="close-btn" data-close>×</button></div><div class="division-work-summary"><div><small>Total target</small><strong>${totalTarget}</strong></div><div><small>Produced</small><strong>${totalDone}</strong></div><div><small>Mould items</small><strong>${rows.length}</strong></div></div>${rows.map((g,i)=>`<section class="division-work-row ${g.status==='Problem'?'division-work-problem':''}" data-unified-row data-i="${i}"><small>Priority ${i+1}${g.targetOrder?' · BUSINESS TARGET':''}${g.components.length>1?` · ${g.components.length} demands combined`:''}</small><h3>${safe(g.productCode)} · ${safe(g.productName)}</h3><div class="division-work-meta">Unified morning target <b>${n(g.targetQty)}</b> · Opening raw stock <b>${n(g.rawStockAtStart)}</b> · Current raw stock <b>${n(g.rawStockNow)}</b></div><label>Total quantity produced today<div class="division-work-controls"><button type="button" data-minus>−</button><input data-completed type="number" min="0" step="1" inputmode="numeric" value="${n(g.producedQty)}"><button type="button" data-plus>+</button></div></label><label>Status<select data-status><option ${g.status==='Not started'?'selected':''}>Not started</option><option ${g.status==='In progress'?'selected':''}>In progress</option><option ${g.status==='Completed'?'selected':''}>Completed</option><option ${g.status==='Problem'?'selected':''}>Problem</option></select></label><label>Note<textarea data-note placeholder="Optional note / problem">${safe(g.note||'')}</textarea></label></section>`).join('')||'<div class="card">No raw production issued for this division.</div>'}<div class="actions" style="position:sticky;bottom:0;background:var(--surface);padding:12px 0"><button class="primary" type="button" data-save>Save unified production</button></div></div>`;
  dialog.showModal();const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;
  dialog.querySelectorAll('[data-unified-row]').forEach(el=>{const inp=el.querySelector('[data-completed]'),status=el.querySelector('[data-status]'),set=v=>{inp.value=Math.max(0,Math.round(n(v)));if(status.value!=='Problem')status.value=n(inp.value)>0?'In progress':'Not started'};el.querySelector('[data-minus]').onclick=()=>set(n(inp.value)-1);el.querySelector('[data-plus]').onclick=()=>set(n(inp.value)+1);inp.oninput=()=>set(inp.value);});
  dialog.querySelector('[data-save]').onclick=async()=>{try{for(const el of dialog.querySelectorAll('[data-unified-row]')){const g=rows[Number(el.dataset.i)],qty=Math.max(0,Math.round(n(el.querySelector('[data-completed]').value))),status=el.querySelector('[data-status]').value,note=el.querySelector('[data-note]').value.trim();await saveGroup(g,qty,status,note,division,d);}try{if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs()}catch{}notify?.(`${division} unified production saved · raw stock recalculated`);close();}catch(e){alert(e?.message||String(e));}};
}
async function openForm(division,date){if(RAW.has(division))return openUnified(division,date);return baseOpen(division,date);}
api.rawRows=unifiedRows;api.openForm=openForm;api.version='9.0.82';window.openDivisionDailyWork=openForm;
window.VURawProductionUnified={version:'9.0.82',groupRows,rows:unifiedRows,open:openUnified};
})();