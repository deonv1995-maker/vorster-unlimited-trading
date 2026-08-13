/* V9.1.15 — reconcile operational records to the current commercial order identity.
   Imported order updates can replace an internal order id while keeping the same order number.
   Painting/painted reservations are relinked by order number so dispatch and worksheets see them. */
(function(){
'use strict';
if(window.VUOrderIdentityReconciliation)return;
const norm=v=>String(v||'').trim().toLowerCase();
async function reconcile(){
  if(typeof getAll!=='function'||typeof putOne!=='function')return {changed:0};
  const [orders,jobs]=await Promise.all([getAll('orders'),getAll('productionJobs')]);
  const byNumber=new Map();
  for(const o of orders){const no=norm(o.orderNumber);if(no)byNumber.set(no,o)}
  let changed=0;
  for(const j of jobs){
    if(!['orderPaintingLine','paintedStockReservation'].includes(j?.kind))continue;
    const no=norm(j.orderNumber);if(!no)continue;
    const current=byNumber.get(no);if(!current)continue;
    if(String(j.orderId||'')===String(current.id||''))continue;
    await putOne('productionJobs',{...j,orderId:current.id,orderNumber:current.orderNumber||j.orderNumber,customerName:current.customerName||j.customerName||'',identityReconciledAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    changed++;
  }
  if(changed){
    try{window.VUOrderProgress?.invalidate?.()}catch{}
    try{if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs()}catch(e){console.warn('Identity reconciliation planner rebuild',e)}
  }
  return {changed};
}
const priorOpen=window.openDailyDispatchCapture;
async function openDispatch(...args){await reconcile();return priorOpen?.(...args)}
function rebind(){document.querySelectorAll('[data-open-dispatch]').forEach(b=>{b.onclick=()=>openDispatch()})}
const obs=new MutationObserver(()=>setTimeout(rebind,80));obs.observe(document.body,{childList:true,subtree:true});
setTimeout(async()=>{await reconcile();rebind()},200);
window.openDailyDispatchCapture=openDispatch;
window.VUOrderIdentityReconciliation={version:'9.1.15',reconcile,openDispatch};
})();