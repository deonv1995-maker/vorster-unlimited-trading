/* V9.0.71 — digital daily work forms for Casting, Packing, Resin and Painting.
   Uses the existing strict daily production plan and shared productionJobs store.
   This module records progress only; it deliberately does not move inventory yet. */
(function(){
'use strict';
if(window.VUDivisionDailyWork)return;

const DIVISIONS=['Casting','Packing','Resin','Painting'];
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dateKey=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const display=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${dateKey(v)}T12:00:00`));
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'standard';
function workId(date,division,item){return `divisionwork:${dateKey(date)}:${slug(division)}:${slug(item.orderId||item.orderNumber||'no-order')}:${slug(item.productId||item.productCode||'product')}:${slug(item.colourName||'standard')}`}

async function strictPlan(date){
  if(window.VUStrictDivisionWorksheets?.strictPlan)return VUStrictDivisionWorksheets.strictPlan(date||new Date());
  if(window.VUThreeStagePlan)return VUThreeStagePlan(date||new Date());
  throw new Error('Daily production plan is unavailable');
}

async function workFor(date,division){
  const d=dateKey(date),plan=await strictPlan(d);
  const items=(plan.productionByDivision?.[division]||[]).map((item,index)=>({...item,_workId:workId(d,division,item),_index:index}));
  const jobs=(await getAll('productionJobs')).filter(j=>j?.kind==='divisionDailyWork'&&j.workDate===d&&j.division===division);
  const byId=new Map(jobs.map(j=>[String(j.id),j]));
  return {date:d,plan,rows:items.map(item=>({item,job:byId.get(item._workId)||null}))};
}

function ensureStyles(){
  if(document.getElementById('divisionDailyWorkStyles'))return;
  const s=document.createElement('style');s.id='divisionDailyWorkStyles';s.textContent=`
  .division-work-launcher{margin:12px 0}.division-work-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.division-work-grid button{min-height:52px;font-weight:800}
  .division-work-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.division-work-summary>div{padding:10px;border:1px solid var(--border);border-radius:14px;text-align:center}.division-work-summary strong{display:block;font-size:1.15rem}
  .division-work-row{padding:14px;margin:10px 0;border:1px solid var(--border);border-radius:16px;background:var(--surface-2)}.division-work-row h3{margin:0 0 5px}.division-work-meta{color:var(--muted);font-size:.86rem;line-height:1.35}
  .division-work-controls{display:grid;grid-template-columns:52px 1fr 52px;gap:8px;align-items:center;margin:12px 0}.division-work-controls button{min-height:48px;font-size:1.35rem}.division-work-controls input{text-align:center;font-size:1.1rem;font-weight:800}
  .division-work-row select,.division-work-row textarea{width:100%;margin-top:8px}.division-work-row textarea{min-height:68px}.division-work-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.division-work-actions button{flex:1;min-width:120px}.division-work-complete{border-color:#69a58a}.division-work-problem{border-color:#bb7b69}
  @media(max-width:520px){.division-work-grid{grid-template-columns:1fr 1fr}.division-work-summary{grid-template-columns:1fr 1fr 1fr}}
  `;document.head.appendChild(s);
}

async function openForm(division,date=new Date()){
  if(!DIVISIONS.includes(division))throw new Error('Unknown production division');
  const data=await workFor(date,division);
  const total=data.rows.reduce((s,r)=>s+n(r.item.quantity),0);
  const completed=data.rows.reduce((s,r)=>s+Math.min(n(r.job?.completedQty),n(r.item.quantity)),0);
  const problems=data.rows.filter(r=>r.job?.status==='Problem').length;
  const dialog=document.getElementById('dialog');
  const rows=data.rows.map(({item,job},i)=>{
    const target=n(item.quantity),done=Math.min(n(job?.completedQty),target);
    const status=job?.status||(done>=target&&target?'Completed':done?'In progress':'Not started');
    return `<section class="division-work-row ${status==='Completed'?'division-work-complete':''} ${status==='Problem'?'division-work-problem':''}" data-work-row="${safe(item._workId)}" data-target="${target}" data-index="${i}">
      <small>Priority ${i+1}${item.targetOrder?' · TARGET PRIORITY':''}</small>
      <h3>${safe(item.productCode||'')} · ${safe(item.productName||'')}</h3>
      <div class="division-work-meta">${safe(item.colourName||'Standard')} · ${safe(item.orderNumber||'')} ${safe(item.customerName||'')} · Target <b>${target}</b></div>
      <div class="division-work-controls"><button type="button" data-minus>−</button><input data-completed type="number" min="0" max="${target}" step="1" value="${done}"><button type="button" data-plus>+</button></div>
      <label>Status<select data-status><option ${status==='Not started'?'selected':''}>Not started</option><option ${status==='In progress'?'selected':''}>In progress</option><option ${status==='Completed'?'selected':''}>Completed</option><option ${status==='Problem'?'selected':''}>Problem</option></select></label>
      <label>Note<textarea data-note placeholder="Optional note or problem detail">${safe(job?.note||'')}</textarea></label>
      <div class="division-work-actions"><button type="button" data-complete>Mark complete</button><button type="button" data-problem>Problem</button></div>
    </section>`;
  }).join('');
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:92vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div class="eyebrow">DAILY DIVISION FORM</div><h2 style="margin:4px 0">${safe(division)} · ${safe(display(data.date))}</h2><p class="muted">Update actual progress from the factory floor. Changes sync to management and the printable daily worksheet.</p></div><button class="icon-btn" type="button" data-close>×</button></div><div class="division-work-summary"><div><small>Target</small><strong>${total}</strong></div><div><small>Completed</small><strong id="divisionWorkDone">${completed}</strong></div><div><small>Problems</small><strong id="divisionWorkProblems">${problems}</strong></div></div>${rows||`<div class="card">No ${safe(division.toLowerCase())} work is planned for this date.</div>`}<div class="actions" style="position:sticky;bottom:0;background:var(--surface);padding:12px 0"><button type="button" data-save class="primary">Save ${safe(division)} progress</button></div></div>`;
  dialog.showModal();
  const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};
  dialog.querySelector('[data-close]').onclick=close;
  const refreshSummary=()=>{
    let done=0,problems=0;
    dialog.querySelectorAll('[data-work-row]').forEach(row=>{const target=n(row.dataset.target),qty=Math.min(n(row.querySelector('[data-completed]').value),target);done+=qty;if(row.querySelector('[data-status]').value==='Problem')problems++});
    const d=document.getElementById('divisionWorkDone'),p=document.getElementById('divisionWorkProblems');if(d)d.textContent=done;if(p)p.textContent=problems;
  };
  dialog.querySelectorAll('[data-work-row]').forEach(row=>{
    const input=row.querySelector('[data-completed]'),status=row.querySelector('[data-status]'),target=n(row.dataset.target);
    const setQty=value=>{input.value=Math.max(0,Math.min(target,Math.round(n(value))));if(status.value!=='Problem')status.value=n(input.value)>=target&&target?'Completed':n(input.value)>0?'In progress':'Not started';refreshSummary()};
    row.querySelector('[data-minus]').onclick=()=>setQty(n(input.value)-1);
    row.querySelector('[data-plus]').onclick=()=>setQty(n(input.value)+1);
    row.querySelector('[data-complete]').onclick=()=>{status.value='Completed';setQty(target)};
    row.querySelector('[data-problem]').onclick=()=>{status.value='Problem';refreshSummary();row.querySelector('[data-note]').focus()};
    input.oninput=()=>setQty(input.value);status.onchange=refreshSummary;
  });
  dialog.querySelector('[data-save]').onclick=async()=>{
    const now=new Date().toISOString();
    for(const row of dialog.querySelectorAll('[data-work-row]')){
      const index=Number(row.dataset.index),item=data.rows[index].item,target=n(item.quantity),completedQty=Math.min(n(row.querySelector('[data-completed]').value),target);
      let status=row.querySelector('[data-status]').value;if(status!=='Problem')status=completedQty>=target&&target?'Completed':completedQty>0?'In progress':'Not started';
      const existing=await getOne('productionJobs',item._workId);
      await putOne('productionJobs',{...(existing||{}),id:item._workId,kind:'divisionDailyWork',workDate:data.date,division,productId:item.productId||'',productCode:item.productCode||'',productName:item.productName||'',colourName:item.colourName||'Standard',orderId:item.orderId||'',orderNumber:item.orderNumber||'',customerName:item.customerName||'',targetQty:target,completedQty,status,note:row.querySelector('[data-note]').value.trim(),updatedAt:now,createdAt:existing?.createdAt||now});
    }
    try{window.dispatchEvent(new CustomEvent('vu:division-work-updated',{detail:{division,date:data.date}}))}catch{}
    notify?.(`${division} progress saved`);close();
    if(window.VUNavigationAuthority?.current?.()==='production'&&typeof window.productionPage==='function')await window.productionPage();
  };
}

function addLauncher(){
  if(document.getElementById('divisionDailyWorkLauncher'))return;
  const host=document.createElement('section');host.id='divisionDailyWorkLauncher';host.className='card division-work-launcher';
  host.innerHTML=`<div class="section-head"><div><div class="step-label">Factory floor</div><h2>Daily division forms</h2><p class="muted">Open the live work form for the device used in each production division.</p></div></div><div class="division-work-grid">${DIVISIONS.map(d=>`<button type="button" data-division-work="${d}">${d}</button>`).join('')}</div>`;
  const mainEl=document.getElementById('main');if(!mainEl)return;mainEl.prepend(host);
  host.querySelectorAll('[data-division-work]').forEach(b=>b.onclick=()=>openForm(b.dataset.divisionWork,new Date()));
}

ensureStyles();
const baseProductionPage=window.productionPage;
if(typeof baseProductionPage==='function'){
  window.productionPage=async function divisionDailyWorkProductionPage(...args){const result=await baseProductionPage(...args);addLauncher();return result};
  try{productionPage=window.productionPage}catch{}
}

window.openDivisionDailyWork=openForm;
window.VUDivisionDailyWork={version:'9.0.71',DIVISIONS,openForm,workFor,workId};
})();
