/* V9.0.96 — Painting-to-finished-stock authority.
   Read-in Painting quantities become product+colour finished stock and are reserved to that order.
   Reserved painted stock remains visible on hand but is withheld from allocation to other orders. */
(function(){
'use strict';
if(window.VUPaintedStockInventoryAuthority)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item';
const originalPutOne=window.putOne;
const originalGetAll=window.getAll;
if(typeof originalPutOne!=='function'||typeof originalGetAll!=='function'||typeof window.getOne!=='function')return;
function isRaw(b){return norm(b?.colourName)==='raw stock'||String(b?.id||'').endsWith('::raw')}
function balanceId(productId,colourName){return typeof window.inventoryBalanceId==='function'?window.inventoryBalanceId(productId,colourName):`${productId}::${norm(colourName||'Standard')}`}
function reservationId(j){return `paintreserve:${slug(j.orderId)}:${slug(j.productCode||j.productId)}:${slug(j.colourName||'Standard')}`}
async function findFinishedBalance(j){const balances=await originalGetAll('inventoryBalances');const code=norm(j.productCode),colour=norm(j.colourName||'Standard');return balances.find(b=>!isRaw(b)&&code&&norm(b.productCode)===code&&norm(b.colourName||'Standard')===colour)||balances.find(b=>!isRaw(b)&&String(b.productId||'')===String(j.productId||'')&&norm(b.colourName||'Standard')===colour)||null}
async function applyFinishedStock(j,old,now){const desired=n(j.completedQty),already=n(old?.finishedStockAppliedQty),delta=desired-already;if(!delta&&n(old?.reservedFinishedQty)===desired)return j;let balance=await findFinishedBalance(j);if(!balance){balance={id:balanceId(j.productId||slug(j.productCode),j.colourName||'Standard'),productId:j.productId||'',productCode:j.productCode||'',productName:j.productName||'',colourName:j.colourName||'Standard',quantity:0,reservedQuantity:0}}
  const before=Number(balance.quantity||0),beforeReserved=n(balance.reservedQuantity),after=Math.max(0,before+delta),afterReserved=Math.max(0,beforeReserved+delta);
  await originalPutOne('inventoryBalances',{...balance,productId:balance.productId||j.productId||'',productCode:j.productCode||balance.productCode||'',productName:j.productName||balance.productName||'',colourName:j.colourName||balance.colourName||'Standard',quantity:after,reservedQuantity:Math.min(after,afterReserved),updatedAt:now});
  if(delta!==0)await originalPutOne('inventoryTransactions',{id:typeof window.uid==='function'?window.uid('inv'):`inv_${Date.now()}_${Math.random().toString(36).slice(2)}`,productId:balance.productId||j.productId||'',productCode:j.productCode||balance.productCode||'',productName:j.productName||balance.productName||'',colourName:j.colourName||'Standard',type:delta>0?'PAINTED_TO_RESERVED_STOCK':'PAINTED_STOCK_CORRECTION',previousQuantity:before,quantityChange:delta,newQuantity:after,reference:j.orderNumber||j.orderId||'',note:delta>0?`Painted stock reserved to ${j.orderNumber||'order'}`:`Painting correction · ${j.orderNumber||'order'}`,createdAt:now});
  await originalPutOne('productionJobs',{id:reservationId(j),kind:'paintedStockReservation',status:desired>0?'Reserved':'Released',orderId:j.orderId||'',orderNumber:j.orderNumber||'',customerName:j.customerName||'',productId:balance.productId||j.productId||'',productCode:j.productCode||'',productName:j.productName||'',colourName:j.colourName||'Standard',quantity:desired,inventoryBalanceId:balance.id,createdAt:old?.createdAt||now,updatedAt:now});
  const patched={...j,finishedStockAppliedQty:desired,reservedFinishedQty:desired,updatedAt:now};await originalPutOne('productionJobs',patched);return patched}
window.putOne=async function paintedStockAwarePutOne(store,value){if(store!=='productionJobs'||value?.kind!=='orderPaintingLine')return originalPutOne(store,value);const old=await window.getOne('productionJobs',value.id);const result=await originalPutOne(store,value);try{await applyFinishedStock(value,old,new Date().toISOString())}catch(e){console.error('Painted finished-stock update failed',e);throw e}return result};
try{putOne=window.putOne}catch{}
const baseSchedule=window.buildOrderCompletionSchedule;
if(typeof baseSchedule==='function'){
  window.buildOrderCompletionSchedule=async function reservedPaintedStockSchedule(...args){const prior=window.getAll;window.getAll=async function(store){const rows=await originalGetAll(store);if(store!=='inventoryBalances')return rows;return rows.map(b=>({...b,quantity:isRaw(b)?Number(b.quantity||0):Math.max(0,Number(b.quantity||0)-n(b.reservedQuantity))}))};try{return await baseSchedule(...args)}finally{window.getAll=prior;try{getAll=window.getAll}catch{}}};try{buildOrderCompletionSchedule=window.buildOrderCompletionSchedule}catch{}
}
window.VUPaintedStockInventoryAuthority={version:'9.0.96'};
})();