/* Factory OS 2.10.17 — keep Delivery startup non-blocking while refreshing today's schedule in background. */
(function(){
'use strict';
if(window.VUDeliveryFreshness)return;
function isRealDeliveryDevice(){return (window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.())==='Delivery'&&!window.VUManagementPreview?.isActive?.();}
const original=window.VUFactoryDispatchWorkspace?.openDeliveries?.bind(window.VUFactoryDispatchWorkspace);
let freshnessSync=null;
function refreshInBackground(){
  if(!isRealDeliveryDevice()||!navigator.onLine||!window.VUSharedAccess?.membership?.()||freshnessSync)return;
  freshnessSync=Promise.resolve().then(()=>window.VUSharedAccess.sync({reason:'delivery-after-render'})).catch(e=>console.warn('Delivery freshness sync failed',e)).finally(()=>{freshnessSync=null;});
}
if(original){
  window.VUFactoryDispatchWorkspace.openDeliveries=async function(...args){
    const result=await original(...args);
    setTimeout(refreshInBackground,0);
    return result;
  };
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&document.body?.dataset?.route==='deliveries')refreshInBackground();});
window.VUDeliveryFreshness={version:'2.10.17',isRealDeliveryDevice,refreshInBackground};
})();
