/* Factory OS 2.10.30 — repair/republish current confirmed dispatches into shared sync. */
(function(){
'use strict';
if(window.VUFactoryDispatchRepublish)return;
const STAMP='vu-dispatch-republish-2.10.30';
async function republishToday({force=false}={}){
  const role=window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.();
  if(!['Management','Delivery'].includes(role))return {queued:0,skipped:true};
  const today=window.VUFactoryDispatchControl?.today?.()||new Date().toISOString().slice(0,10);
  const rows=(await window.getAll('deliveries')).filter(d=>d?.kind==='FACTORY_DISPATCH'&&d?.dispatchDate===today&&['Confirmed','Dispatched','Completed'].includes(String(d.status||'')));
  if(!rows.length)return {queued:0};
  const last=Number(localStorage.getItem(STAMP)||0),nowMs=Date.now();
  if(!force&&last&&nowMs-last<60000)return {queued:0,throttled:true};
  localStorage.setItem(STAMP,String(nowMs));
  let queued=0;
  for(const d of rows){
    const now=new Date().toISOString();
    await window.putOne('deliveries',{...d,updatedAt:now,syncRepublishedAt:now});
    queued++;
  }
  if(queued&&window.VUSharedAccess?.membership?.()&&navigator.onLine){
    try{await window.VUSharedAccess.sync({reason:'dispatch-republish'});}catch(e){console.warn('Dispatch republish sync failed',e)}
  }
  return {queued};
}
function install(){
  const ws=window.VUFactoryDispatchWorkspace,inv=window.VUFactoryInvoicePrep;
  if(ws&&!ws.__republishWrapped){
    const original=ws.openDeliveries.bind(ws);
    ws.openDeliveries=async function(){await republishToday();return original();};
    ws.__republishWrapped=true;
  }
  if(inv&&!inv.__republishWrapped){
    const original=inv.open.bind(inv);
    inv.open=async function(){
      if(window.VUSharedAccess?.membership?.()&&navigator.onLine){try{await window.VUSharedAccess.sync({reason:'invoice-prep-refresh',resetPull:true});}catch(e){console.warn('Invoice Prep refresh failed',e)}}
      return original();
    };
    inv.__republishWrapped=true;
  }
}
install();setTimeout(install,0);setTimeout(()=>republishToday().catch(e=>console.warn('Dispatch republish boot repair failed',e)),1200);
window.VUFactoryDispatchRepublish={version:'2.10.30',republishToday,install};
})();