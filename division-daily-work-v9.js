/* V9.0.72 — daily factory capture with stable raw-output sheets.
   Casting, Packing and Resin are product/day stock-production records, not customer/order records.
   Their first open/print snapshots the morning target so later order imports cannot rewrite the day.
   Painting remains order/product/colour specific for completion tracking and forward allocation. */
(function(){
'use strict';
if(window.VUDivisionDailyWork?.version==='9.0.72')return;

const DIVISIONS=['Casting','Packing','Resin','Painting'];
const RAW_DIVISIONS=new Set(['Casting','Packing','Resin']);
const n=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dateKey=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const display=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${dateKey(v)}T12:00:00`));
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item';
const rawId=productId=>typeof vuRawBalanceId==='function'?vuRawBalanceId(productId):`${productId}::raw`;
const rawWorkId=(date,division,productId,code)=>`rawday:${dateKey(date)}:${slug(division)}:${slug(productId||code)}`;
const paintWorkId=(date,item)=>`paintday:${dateKey(date)}:${slug(item.orderId||item.orderNumber)}:${slug(item.productId||item.productCode)}:${slug(item.colourName||'standard')}`;

async function strictPlan(date){
  if(window.VUStrictDivisionWorksheets?.strictPlan)return VUStrictDivisionWorksheets.strictPlan(date||new Date());
  if(window.VUThreeStagePlan)return VUThreeStagePlan(date||new Date());
  throw new Error('Daily production plan is unavailable');
}

async function ensureRawSnapshot(date,division){
  const d=dateKey(date);
  if(!RAW_DIVISIONS.has(division))return[];
  const all=await getAll('productionJobs');
  const existing=all.filter(j=>j?.kind==='divisionRawDaily'&&j.workDate===d&&j.division===division);
  if(existing.length)return existing.sort((a,b)=>Number(a.priority||0)-Number(b.priority||0)||String(a.productCode||'').localeCompare(String(b.productCode||'')));

  const plan=await strictPlan(d);
  const items=plan.productionByDivision?.[division]||[];
  const grouped=new Map();
  for(const item of items){
    const key=String(item.productId||item.productCode||'');if(!key)continue;
    if(!grouped.has(key))grouped.set(key,{productId:item.productId||'',productCode:item.productCode||'',productName:item.productName||'',targetQty:0,targetOrder:!!item.targetOrder});
    const row=grouped.get(key);row.targetQty+=n(item.quantity);row.targetOrder=row.targetOrder||!!item.targetOrder;
  }
  const now=new Date().toISOString();let priority=0;const created=[];
  for(const row of grouped.values()){
    priority++;
    const balance=await getOne('inventoryBalances',rawId(row.productId));
    const job={id:rawWorkId(d,division,row.productId,row.productCode),kind:'divisionRawDaily',workDate:d,division,productId:row.productId,productCode:row.productCode,productName:row.productName,targetQty:Math.round(n(row.targetQty)),producedQty:0,inventoryAppliedQty:0,rawStockAtStart:n(balance?.quantity),status:'Not started',note:'',priority,targetOrder:row.targetOrder,snapshotAt:now,createdAt:now,updatedAt:now};
    await putOne('productionJobs',job);created.push(job);
  }
  return created;
}

async function rawRows(date,division){
  const jobs=await ensureRawSnapshot(date,division);
  const balances=await getAll('inventoryBalances');
  const byId=new Map(balances.map(b=>[String(b.id),b]));
  return jobs.map(job=>({...job,rawStockNow:n(byId.get(rawId(job.productId))?.quantity)}));
}

async function paintingRows(date){
  const d=dateKey(date),plan=await strictPlan(d),items=plan.productionByDivision?.Painting||[];
  const jobs=(await getAll('productionJobs')).filter(j=>j?.kind==='divisionPaintingDaily'&&j.workDate===d);
  const byId=new Map(jobs.map(j=>[String(j.id),j]));
  return items.map((item,index)=>{const id=paintWorkId(d,item);return{item:{...item,_workId:id,_index:index},job:byId.get(id)||null}});
}

function ensureStyles(){
  if(document.getElementById('divisionDailyWorkStyles'))return;
  const s=document.createElement('style');s.id='divisionDailyWorkStyles';s.textContent=`
  .division-work-launcher{margin:12px 0}.division-work-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.division-work-grid button{min-height:52px;font-weight:800}
  .division-work-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.division-work-summary>div{padding:10px;border:1px solid var(--border);border-radius:14px;text-align:center}.division-work-summary strong{display:block;font-size:1.15rem}
  .division-work-row{padding:14px;margin:10px 0;border:1px solid var(--border);border-radius:16px;background:var(--surface-2)}.division-work-row h3{margin:0 0 5px}.division-work-meta{color:var(--muted);font-size:.86rem;line-height:1.4}
  .division-work-controls{display:grid;grid-template-columns:52px 1fr 52px;gap:8px;align-items:center;margin:12px 0}.division-work-controls button{min-height:48px;font-size:1.35rem}.division-work-controls input{text-align:center;font-size:1.1rem;font-weight:800}
  .division-work-row select,.division-work-row textarea{width:100%;margin-top:8px}.division-work-row textarea{min-height:64px}.division-work-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.division-work-actions button{flex:1;min-width:120px}.division-work-complete{border-color:#69a58a}.division-work-problem{border-color:#bb7b69}.division-work-note{padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);margin:10px 0}
  `;document.head.appendChild(s);
}

function bindQtyRow(row,{cap=null}={}){
  const input=row.querySelector('[data-completed]'),status=row.querySelector('[data-status]');
  const clamp=v=>{let x=Math.max(0,Math.round(n(v)));if(cap!==null)x=Math.min(cap,x);return x};
  const sync=()=>{const qty=clamp(input.value);input.value=qty;if(status.value!=='Problem')status.value=cap!==null&&qty>=cap&&cap>0?'Completed':qty>0?'In progress':'Not started'};
  row.querySelector('[data-minus]').onclick=()=>{input.value=clamp(n(input.value)-1);sync()};
  row.querySelector('[data-plus]').onclick=()=>{input.value=clamp(n(input.value)+1);sync()};
  input.oninput=sync;
  row.querySelector('[data-complete]')?.addEventListener('click',()=>{if(cap!==null){input.value=cap;status.value='Completed'}else status.value='Completed'});
  row.querySelector('[data-problem]')?.addEventListener('click',()=>{status.value='Problem';row.querySelector('[data-note]')?.focus()});
}

async function openRawForm(division,date){
  const d=dateKey(date),rows=await rawRows(d,division);
  const totalTarget=rows.reduce((s,r)=>s+n(r.targetQty),0),totalDone=rows.reduce((s,r)=>s+n(r.producedQty),0);
  const dialog=document.getElementById('dialog');
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:92vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:12px"><div><div class="eyebrow">RAW PRODUCTION OUTPUT</div><h2 style="margin:4px 0">${safe(division)} · ${safe(display(d))}</h2><p class="muted">This sheet is product-based, not customer-based. Today's target was frozen when the sheet was first opened/printed. Enter what was physically produced; it becomes raw stock available to any order.</p></div><button class="icon-btn" type="button" data-close>×</button></div><div class="division-work-summary"><div><small>Morning target</small><strong>${totalTarget}</strong></div><div><small>Produced</small><strong>${totalDone}</strong></div><div><small>Products</small><strong>${rows.length}</strong></div></div>${rows.map((job,i)=>`<section class="division-work-row ${job.status==='Problem'?'division-work-problem':''}" data-raw-row data-id="${safe(job.id)}"><small>Priority ${i+1}${job.targetOrder?' · TARGET PRIORITY':''}</small><h3>${safe(job.productCode)} · ${safe(job.productName)}</h3><div class="division-work-meta">Morning target <b>${n(job.targetQty)}</b> · Raw stock now <b>${n(job.rawStockNow)}</b> · Opening raw stock <b>${n(job.rawStockAtStart)}</b></div><label>Quantity produced today<div class="division-work-controls"><button type="button" data-minus>−</button><input data-completed type="number" min="0" step="1" value="${n(job.producedQty)}"><button type="button" data-plus>+</button></div></label><label>Status<select data-status><option ${job.status==='Not started'?'selected':''}>Not started</option><option ${job.status==='In progress'?'selected':''}>In progress</option><option ${job.status==='Completed'?'selected':''}>Completed</option><option ${job.status==='Problem'?'selected':''}>Problem</option></select></label><label>Note<textarea data-note placeholder="Optional production note">${safe(job.note||'')}</textarea></label><div class="division-work-actions"><button type="button" data-problem>Problem</button></div></section>`).join('')||`<div class="card">No ${safe(division.toLowerCase())} products were on the morning plan.</div>`}<div class="actions" style="position:sticky;bottom:0;background:var(--surface);padding:12px 0"><button type="button" class="primary" data-save>Save production & update raw stock</button></div></div>`;
  dialog.showModal();const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;
  dialog.querySelectorAll('[data-raw-row]').forEach(row=>bindQtyRow(row));
  dialog.querySelector('[data-save]').onclick=async()=>{
    const now=new Date().toISOString();
    for(const row of dialog.querySelectorAll('[data-raw-row]')){
      const id=row.dataset.id,job=await getOne('productionJobs',id);if(!job)continue;
      const producedQty=Math.max(0,Math.round(n(row.querySelector('[data-completed]').value)));
      const applied=n(job.inventoryAppliedQty),delta=producedQty-applied;
      const balanceId=rawId(job.productId),balance=await getOne('inventoryBalances',balanceId),before=n(balance?.quantity),after=before+delta;
      if(after<0){alert(`${job.productCode}: raw stock has already been allocated. You cannot reduce today's production below ${applied-before}. Count/correct raw stock instead.`);return;}
      if(delta!==0){
        await putOne('inventoryBalances',{...(balance||{}),id:balanceId,productId:job.productId,productCode:job.productCode,productName:job.productName,colourName:'Raw Stock',quantity:after,updatedAt:now});
        await putOne('inventoryTransactions',{id:uid('inv'),productId:job.productId,productCode:job.productCode,productName:job.productName,colourName:'Raw Stock',type:'PRODUCTION_OUTPUT',previousQuantity:before,quantityChange:delta,newQuantity:after,note:`${division} output · ${d}`,reference:`${division} ${d}`,createdAt:now});
      }
      let status=row.querySelector('[data-status]').value;if(status!=='Problem')status=producedQty>=n(job.targetQty)&&n(job.targetQty)>0?'Completed':producedQty>0?'In progress':'Not started';
      await putOne('productionJobs',{...job,producedQty,completedQty:producedQty,inventoryAppliedQty:producedQty,status,note:row.querySelector('[data-note]').value.trim(),updatedAt:now});
    }
    try{if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs()}catch(e){console.warn('Planner recalc after production output',e)}
    notify?.(`${division} production saved · raw stock recalculated`);close();
    if(window.VUNavigationAuthority?.current?.()==='production'&&typeof window.productionPage==='function')await window.productionPage();
  };
}

async function openPaintingForm(date){
  const d=dateKey(date),data=await paintingRows(d),dialog=document.getElementById('dialog');
  const rows=data.map(({item,job},i)=>{const target=n(item.quantity),done=Math.min(n(job?.completedQty),target),pct=target?Math.round(done/target*100):0,status=job?.status||(done>=target&&target?'Completed':done?'In progress':'Not started');return `<section class="division-work-row ${status==='Completed'?'division-work-complete':''} ${status==='Problem'?'division-work-problem':''}" data-paint-row data-index="${i}" data-target="${target}"><small>Priority ${i+1}${item.targetOrder?' · TARGET PRIORITY':''}</small><h3>${safe(item.productCode)} · ${safe(item.productName)}</h3><div class="division-work-meta">${safe(item.colourName||'Standard')} · ${safe(item.orderNumber||'')} ${safe(item.customerName||'')} · Target <b>${target}</b> · Completed <b>${done} (${pct}%)</b></div><div class="division-work-controls"><button type="button" data-minus>−</button><input data-completed type="number" min="0" max="${target}" step="1" value="${done}"><button type="button" data-plus>+</button></div><label>Status<select data-status><option ${status==='Not started'?'selected':''}>Not started</option><option ${status==='In progress'?'selected':''}>In progress</option><option ${status==='Completed'?'selected':''}>Completed</option><option ${status==='Problem'?'selected':''}>Problem</option></select></label><label>Note<textarea data-note>${safe(job?.note||'')}</textarea></label><div class="division-work-actions"><button type="button" data-complete>Mark complete</button><button type="button" data-problem>Problem</button></div></section>`}).join('');
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:92vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:12px"><div><div class="eyebrow">ORDER-LINKED PAINTING</div><h2 style="margin:4px 0">Painting · ${safe(display(d))}</h2><p class="muted">Painting remains tied to the customer order, product and colour so completion percentages can drive forward allocation and delivery readiness.</p></div><button class="icon-btn" data-close>×</button></div>${rows||'<div class="card">No painting work is planned for this date.</div>'}<div class="actions" style="position:sticky;bottom:0;background:var(--surface);padding:12px 0"><button type="button" class="primary" data-save>Save Painting progress</button></div></div>`;
  dialog.showModal();const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;dialog.querySelectorAll('[data-paint-row]').forEach(row=>bindQtyRow(row,{cap:n(row.dataset.target)}));
  dialog.querySelector('[data-save]').onclick=async()=>{const now=new Date().toISOString();for(const row of dialog.querySelectorAll('[data-paint-row]')){const {item,job}=data[Number(row.dataset.index)],target=n(item.quantity),completedQty=Math.min(n(row.querySelector('[data-completed]').value),target);let status=row.querySelector('[data-status]').value;if(status!=='Problem')status=completedQty>=target&&target?'Completed':completedQty>0?'In progress':'Not started';await putOne('productionJobs',{...(job||{}),id:item._workId,kind:'divisionPaintingDaily',workDate:d,division:'Painting',productId:item.productId||'',productCode:item.productCode||'',productName:item.productName||'',colourName:item.colourName||'Standard',orderId:item.orderId||'',orderNumber:item.orderNumber||'',customerName:item.customerName||'',targetQty:target,completedQty,status,note:row.querySelector('[data-note]').value.trim(),updatedAt:now,createdAt:job?.createdAt||now})}notify?.('Painting progress saved');close();if(window.VUNavigationAuthority?.current?.()==='production'&&typeof window.productionPage==='function')await window.productionPage()};
}

async function openForm(division,date=new Date()){
  if(!DIVISIONS.includes(division))throw new Error('Unknown production division');
  if(RAW_DIVISIONS.has(division))return openRawForm(division,date);
  return openPaintingForm(date);
}

function addLauncher(){
  if(document.getElementById('divisionDailyWorkLauncher'))return;
  const host=document.createElement('section');host.id='divisionDailyWorkLauncher';host.className='card division-work-launcher';host.innerHTML=`<div class="section-head"><div><div class="step-label">Factory floor</div><h2>Daily factory capture</h2><p class="muted">Casting, Packing and Resin record product output into raw stock. Painting stays order-linked for completion tracking.</p></div></div><div class="division-work-grid">${DIVISIONS.map(d=>`<button type="button" data-division-work="${d}">${d}</button>`).join('')}</div>`;
  const mainEl=document.getElementById('main');if(!mainEl)return;mainEl.prepend(host);host.querySelectorAll('[data-division-work]').forEach(b=>b.onclick=()=>openForm(b.dataset.divisionWork,new Date()));
}

ensureStyles();
const baseProductionPage=window.productionPage;
if(typeof baseProductionPage==='function'){window.productionPage=async function dailyFactoryCapturePage(...args){const result=await baseProductionPage(...args);addLauncher();return result};try{productionPage=window.productionPage}catch{}}
window.openDivisionDailyWork=openForm;
window.VUDivisionDailyWork={version:'9.0.72',DIVISIONS,RAW_DIVISIONS,openForm,ensureRawSnapshot,rawRows,paintingRows,rawWorkId,paintWorkId};
})();
