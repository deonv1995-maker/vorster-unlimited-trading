/* V9.0.73 — recovery capture for raw worksheets printed before the stable daily snapshot existed. */
(function(){
'use strict';
if(window.VURawPaperRecovery)return;
const DIVISIONS=['Casting','Packing','Resin'];
const n=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dateKey=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const rawId=productId=>typeof vuRawBalanceId==='function'?vuRawBalanceId(productId):`${productId}::raw`;

async function openRecovery(){
  const products=(await getAll('products')).filter(p=>p.isActive!==false).sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')));
  const dialog=document.getElementById('dialog');
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:92vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:12px"><div><div class="eyebrow">PAPER SHEET RECOVERY</div><h2 style="margin:4px 0">Capture raw production from paper</h2><p class="muted">Use this for a Casting, Packing or Resin sheet that was printed before today's plan changed. Enter the total actually produced for the product; it will update raw stock and today's production history.</p></div><button type="button" class="icon-btn" data-close>×</button></div><label>Work date<input id="rawRecoveryDate" type="date" value="${dateKey(new Date())}"></label><label>Division<select id="rawRecoveryDivision">${DIVISIONS.map(d=>`<option>${d}</option>`).join('')}</select></label><label>Product<select id="rawRecoveryProduct"><option value="">Select product</option>${products.map(p=>`<option value="${safe(p.id)}">${safe(p.code||'')} · ${safe(p.name||'')}</option>`).join('')}</select></label><label>Morning target on paper<input id="rawRecoveryTarget" type="number" min="0" step="1" inputmode="numeric" value="0"></label><label>Total produced today<input id="rawRecoveryProduced" type="number" min="0" step="1" inputmode="numeric" value="0"></label><label>Note<textarea id="rawRecoveryNote" placeholder="Example: Captured from morning paper worksheet"></textarea></label><button type="button" class="primary" id="rawRecoverySave">Save & update raw stock</button></div>`;
  dialog.showModal();
  const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;
  document.getElementById('rawRecoverySave').onclick=async()=>{
    const productId=document.getElementById('rawRecoveryProduct').value,product=products.find(p=>String(p.id)===String(productId));
    if(!product){alert('Select a product first.');return}
    const division=document.getElementById('rawRecoveryDivision').value,date=document.getElementById('rawRecoveryDate').value||dateKey(new Date());
    const targetQty=Math.max(0,Math.round(n(document.getElementById('rawRecoveryTarget').value))),producedQty=Math.max(0,Math.round(n(document.getElementById('rawRecoveryProduced').value)));
    const id=window.VUDivisionDailyWork?.rawWorkId?VUDivisionDailyWork.rawWorkId(date,division,product.id,product.code):`rawday:${date}:${division.toLowerCase()}:${product.id}`;
    const existing=await getOne('productionJobs',id),balanceId=rawId(product.id),balance=await getOne('inventoryBalances',balanceId),before=n(balance?.quantity),applied=n(existing?.inventoryAppliedQty),delta=producedQty-applied,after=before+delta;
    if(after<0){alert('Some of this production has already been allocated. Correct the raw stock count instead of reducing this entry further.');return}
    const now=new Date().toISOString();
    if(delta!==0){await putOne('inventoryBalances',{...(balance||{}),id:balanceId,productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',quantity:after,updatedAt:now});await putOne('inventoryTransactions',{id:uid('inv'),productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',type:'PRODUCTION_OUTPUT',previousQuantity:before,quantityChange:delta,newQuantity:after,note:`${division} paper recovery · ${date}`,reference:`${division} ${date}`,createdAt:now})}
    await putOne('productionJobs',{...(existing||{}),id,kind:'divisionRawDaily',workDate:date,division,productId:product.id,productCode:product.code,productName:product.name,targetQty:targetQty||n(existing?.targetQty),producedQty,completedQty:producedQty,inventoryAppliedQty:producedQty,rawStockAtStart:existing?.rawStockAtStart??before,status:producedQty>0?(targetQty&&producedQty>=targetQty?'Completed':'In progress'):'Not started',note:document.getElementById('rawRecoveryNote').value.trim()||existing?.note||'Captured from paper worksheet',priority:existing?.priority||999,manualPaperRecovery:true,snapshotAt:existing?.snapshotAt||now,createdAt:existing?.createdAt||now,updatedAt:now});
    try{if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs()}catch(e){console.warn(e)}
    notify?.(`${product.code} production captured · raw stock updated`);close();if(window.VUNavigationAuthority?.current?.()==='production'&&typeof window.productionPage==='function')await window.productionPage();
  };
}
function addButton(){const host=document.getElementById('divisionDailyWorkLauncher');if(!host||host.querySelector('[data-paper-recovery]'))return;const b=document.createElement('button');b.type='button';b.dataset.paperRecovery='1';b.className='secondary';b.style.cssText='width:100%;margin-top:10px;min-height:48px;font-weight:800';b.textContent='Capture old paper raw sheet';b.onclick=openRecovery;host.appendChild(b)}
const base=window.productionPage;if(typeof base==='function'){window.productionPage=async function rawPaperRecoveryPage(...args){const r=await base(...args);addButton();return r};try{productionPage=window.productionPage}catch{}}
window.VURawPaperRecovery={version:'9.0.73',open:openRecovery};
})();
