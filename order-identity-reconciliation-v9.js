/* V9.2.0 — reconcile operational records to the current commercial order identity.
   Data-only migration helper: it no longer wraps dispatch buttons or global open functions.
   Imported order updates can replace an internal order id while keeping the same order number. */
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
    if(!['orderPaintingLine','paintedStockReservation','factoryDispatchResult'].includes(j?.kind))continue;
    const no=norm(j.orderNumber);if(!no)continue;
    const current=byNumber.get(no);if(!current)continue;
    if(String(j.orderId||'')===String(current.id||''))continue;
    const now=new Date().toISOString();
    await putOne('productionJobs',{...j,orderId:current.id,orderNumber:current.orderNumber||j.orderNumber,customerName:current.customerName||j.customerName||'',identityReconciledAt:now,updatedAt:now});
    changed++;
  }
  if(changed){
    try{window.VUOrderProgress?.invalidate?.()}catch{}
    try{if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs()}catch(e){console.warn('Identity reconciliation planner rebuild',e)}
  }
  return {changed};
}
window.VUOrderIdentityReconciliation={version:'9.2.0',reconcile};
reconcile().catch(e=>console.warn('Order identity reconciliation failed',e));
})();