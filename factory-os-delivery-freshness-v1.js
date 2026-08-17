/* Factory OS 2.10.16 — ensure dedicated Delivery devices sync before rendering today's list. */
(function(){
'use strict';
if(window.VUDeliveryFreshness)return;
function isRealDeliveryDevice(){return (window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.())==='Delivery'&&!window.VUManagementPreview?.isActive?.();}
const original=window.VUFactoryDispatchWorkspace?.openDeliveries?.bind(window.VUFactoryDispatchWorkspace);
if(original){
  window.VUFactoryDispatchWorkspace.openDeliveries=async function(...args){
    if(isRealDeliveryDevice()&&navigator.onLine&&window.VUSharedAccess?.membership?.()){
      try{await window.VUSharedAccess.sync({reason:'delivery-before-render'});}catch(e){console.warn('Delivery freshness sync failed',e);}
    }
    return original(...args);
  };
}
window.VUDeliveryFreshness={version:'2.10.16',isRealDeliveryDevice};
})();
