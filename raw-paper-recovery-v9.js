/* V9.0.74 — manual multi-product production sets for Casting, Packing and Resin.
   Use when the original morning worksheet is no longer available in the live planner.
   A set is an auditable group of actual product outputs for a date/division. Saving the set
   increments colour-neutral raw stock and the product/day production history. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin'];
const n=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
const dateKey=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const rawId=productId=>typeof vuRawBalanceId==='function'?vuRawBalanceId(productId):`${productId}::raw`;
const rawWorkId=(date,division,product)=>window.VUDivisionDailyWork?.rawWorkId?VUDivisionDailyWork.rawWorkId(date,division,product.id,product.code):`rawday:${date}:${division.toLowerCase()}:${product.id}`;

function ensureStyles(){
  if(document.getElementById('vuProductionSetStyles'))return;
  const s=document.createElement('style');s.id='vuProductionSetStyles';s.textContent=`
    .prodset-picker{display:grid;grid-template-columns:1fr 92px;gap:8px;align-items:end;margin:12px 0}.prodset-picker button{min-height:46px}
    .prodset-lines{display:grid;gap:9px;margin:12px 0}.prodset-line{display:grid;grid-template-columns:1fr 90px 42px;gap:8px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}
    .prodset-line strong{display:block}.prodset-line small{display:block;color:var(--muted);margin-top:2px}.prodset-line input{text-align:center;font-weight:800}.prodset-line button{min-height:42px}
    .prodset-summary{padding:10px 12px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);margin:10px 0}.prodset-summary strong{font-size:1.1rem}
    @media(max-width:520px){.prodset-picker{grid-template-columns:1fr 82px}.prodset-line{grid-template-columns:1fr 78px 40px}}
  `;document.head.appendChild(s);
}

async function openProductionSet(){
  ensureStyles();
  const products=(await getAll('products')).filter(p=>p.isActive!==false).sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')));
  const dialog=document.getElementById('dialog');
  const options=products.map(p=>`<option value="${safe(p.id)}">${safe(p.code||'')} · ${safe(p.name||'')}</option>`).join('');
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:94vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:12px"><div><div class="eyebrow">DAILY PRODUCTION SET</div><h2 style="margin:4px 0">Capture what was produced</h2><p class="muted">Choose products from the saved catalogue and enter the quantities physically produced. This does not depend on the current order list.</p></div><button type="button" class="icon-btn" data-close>×</button></div>
    <label>Production date<input id="prodSetDate" type="date" value="${dateKey(new Date())}"></label>
    <label>Division<select id="prodSetDivision">${DIVISIONS.map(d=>`<option>${d}</option>`).join('')}</select></label>
    <div class="prodset-picker"><label style="margin:0">Add product<select id="prodSetProduct"><option value="">Select saved product</option>${options}</select></label><button type="button" id="prodSetAdd">Add</button></div>
    <div id="prodSetLines" class="prodset-lines"></div>
    <div class="prodset-summary">Products: <strong id="prodSetCount">0</strong> · Total units: <strong id="prodSetTotal">0</strong></div>
    <label>Set note<textarea id="prodSetNote" placeholder="Example: Captured from Tuesday morning worksheet"></textarea></label>
    <button type="button" class="primary" id="prodSetSave">Save production set & update raw stock</button>
    <div id="prodSetHistory" style="margin-top:14px"></div>
  </div>`;
  dialog.showModal();
  const lines=new Map();
  const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;
  const linesHost=document.getElementById('prodSetLines');
  const refreshSummary=()=>{
    let total=0;for(const row of lines.values())total+=n(row.qty);
    document.getElementById('prodSetCount').textContent=lines.size;document.getElementById('prodSetTotal').textContent=total;
  };
  const renderLines=()=>{
    linesHost.innerHTML=[...lines.values()].map(row=>`<div class="prodset-line" data-product-id="${safe(row.product.id)}"><div><strong>${safe(row.product.code||'')} · ${safe(row.product.name||'')}</strong><small>Raw production output</small></div><input type="number" min="0" step="1" inputmode="numeric" value="${n(row.qty)}" data-set-qty><button type="button" data-remove aria-label="Remove">×</button></div>`).join('')||'<div class="card"><small class="muted">No products added yet.</small></div>';
    linesHost.querySelectorAll('.prodset-line').forEach(el=>{
      const id=el.dataset.productId;el.querySelector('[data-set-qty]').oninput=e=>{const row=lines.get(id);if(row){row.qty=Math.max(0,Math.round(n(e.target.value)));refreshSummary()}};
      el.querySelector('[data-remove]').onclick=()=>{lines.delete(id);renderLines();refreshSummary()};
    });
    refreshSummary();
  };
  const loadHistory=async()=>{
    const date=document.getElementById('prodSetDate').value,division=document.getElementById('prodSetDivision').value;
    const sets=(await getAll('productionJobs')).filter(j=>j?.kind==='manualProductionSet'&&j.workDate===date&&j.division===division).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    const host=document.getElementById('prodSetHistory');if(!host)return;
    host.innerHTML=sets.length?`<div class="section-head"><div><h3>Saved ${safe(division)} sets today</h3></div></div>${sets.map(s=>`<div class="card"><strong>${n(s.totalUnits)} units · ${(s.items||[]).length} products</strong><small style="display:block;margin-top:4px">${safe((s.items||[]).map(x=>`${x.productCode} ${x.quantity}`).join(' · '))}</small>${s.note?`<small style="display:block;margin-top:4px">${safe(s.note)}</small>`:''}</div>`).join('')}`:'';
  };
  document.getElementById('prodSetAdd').onclick=()=>{
    const id=document.getElementById('prodSetProduct').value,product=products.find(p=>String(p.id)===String(id));if(!product)return;
    if(!lines.has(String(product.id)))lines.set(String(product.id),{product,qty:0});
    renderLines();
    const el=linesHost.querySelector(`[data-product-id="${CSS.escape(String(product.id))}"] [data-set-qty]`);if(el){el.focus();el.select()}
  };
  document.getElementById('prodSetDate').onchange=loadHistory;document.getElementById('prodSetDivision').onchange=loadHistory;
  document.getElementById('prodSetSave').onclick=async()=>{
    const items=[...lines.values()].map(x=>({product:x.product,quantity:Math.max(0,Math.round(n(x.qty)))})).filter(x=>x.quantity>0);
    if(!items.length){alert('Add at least one product with a produced quantity greater than zero.');return}
    const date=document.getElementById('prodSetDate').value||dateKey(new Date()),division=document.getElementById('prodSetDivision').value,note=document.getElementById('prodSetNote').value.trim();
    const now=new Date().toISOString(),setId=typeof uid==='function'?uid('prodset'):`prodset_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const setItems=[];
    for(const entry of items){
      const product=entry.product,qty=entry.quantity,balanceId=rawId(product.id),balance=await getOne('inventoryBalances',balanceId),before=n(balance?.quantity),after=before+qty;
      await putOne('inventoryBalances',{...(balance||{}),id:balanceId,productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',quantity:after,updatedAt:now});
      await putOne('inventoryTransactions',{id:typeof uid==='function'?uid('inv'):`inv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',type:'PRODUCTION_OUTPUT',previousQuantity:before,quantityChange:qty,newQuantity:after,note:note||`${division} production set · ${date}`,reference:setId,createdAt:now});
      const dayId=rawWorkId(date,division,product),day=await getOne('productionJobs',dayId),previousProduced=n(day?.producedQty),producedQty=previousProduced+qty;
      await putOne('productionJobs',{...(day||{}),id:dayId,kind:'divisionRawDaily',workDate:date,division,productId:product.id,productCode:product.code,productName:product.name,targetQty:n(day?.targetQty),producedQty,completedQty:producedQty,inventoryAppliedQty:n(day?.inventoryAppliedQty)+qty,rawStockAtStart:day?.rawStockAtStart??before,status:producedQty>0?'In progress':'Not started',note:day?.note||note||'Manual daily production set',priority:day?.priority||999,manualProductionSet:true,snapshotAt:day?.snapshotAt||now,createdAt:day?.createdAt||now,updatedAt:now});
      setItems.push({productId:product.id,productCode:product.code,productName:product.name,quantity:qty,rawBefore:before,rawAfter:after});
    }
    await putOne('productionJobs',{id:setId,kind:'manualProductionSet',workDate:date,division,totalUnits:setItems.reduce((s,x)=>s+n(x.quantity),0),items:setItems,note,createdAt:now,updatedAt:now});
    try{if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs()}catch(e){console.warn('Planner recalc after production set',e)}
    notify?.(`${division} production set saved · ${setItems.reduce((s,x)=>s+n(x.quantity),0)} units added to raw stock`);
    lines.clear();renderLines();document.getElementById('prodSetNote').value='';await loadHistory();
  };
  renderLines();await loadHistory();
}

function addButton(){
  const host=document.getElementById('divisionDailyWorkLauncher');if(!host)return;
  let b=host.querySelector('[data-paper-recovery]');if(!b){b=document.createElement('button');b.type='button';b.dataset.paperRecovery='1';b.className='secondary';b.style.cssText='width:100%;margin-top:10px;min-height:48px;font-weight:800';host.appendChild(b)}
  b.textContent="Add today's production set";b.onclick=openProductionSet;
}
ensureStyles();
const base=window.productionPage;if(typeof base==='function'){window.productionPage=async function productionSetPage(...args){const r=await base(...args);addButton();return r};try{productionPage=window.productionPage}catch{}}
window.VURawPaperRecovery={version:'9.0.74',open:openProductionSet};
window.VUManualProductionSet={version:'9.0.74',open:openProductionSet};
})();
