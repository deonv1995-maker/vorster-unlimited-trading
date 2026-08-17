/* Factory OS 2.10.29 — reliable cross-device handoff from Delivery loading to Office Invoice Prep. */
(function(){
'use strict';
if(window.VUDispatchInvoiceSync)return;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function syncShared(reason,{resetPull=false,retries=2}={}){
  if(!navigator.onLine||!window.VUSharedAccess?.membership?.())return null;
  let last=null;
  for(let i=0;i<=retries;i++){
    try{
      last=await window.VUSharedAccess.sync({reason,resetPull});
      if(last?.state==='ready'||last?.state==='conflict')return last;
    }catch(e){last={state:'error',message:e?.message||String(e)}}
    if(i<retries)await sleep(350*(i+1));
  }
  return last;
}
function installDispatchBridge(){
  const ctl=window.VUFactoryDispatchControl;
  if(!ctl?.confirmVehicle||ctl.confirmVehicle.__invoiceSyncWrapped)return false;
  const base=ctl.confirmVehicle.bind(ctl);
  const wrapped=async function(vehicle,date){
    const record=await base(vehicle,date);
    const result=await syncShared('dispatch-confirmed',{retries:3});
    if(result?.state==='error')console.warn('Dispatch saved locally; shared sync is pending:',result.message);
    return record;
  };
  wrapped.__invoiceSyncWrapped=true;
  ctl.confirmVehicle=wrapped;
  return true;
}
function installInvoiceBridge(){
  const prep=window.VUFactoryInvoicePrep;
  if(!prep?.open||prep.open.__liveSyncWrapped)return false;
  const base=prep.open.bind(prep);
  const wrapped=async function(){
    if(navigator.onLine&&window.VUSharedAccess?.membership?.()){
      const result=await syncShared('invoice-prep-open',{resetPull:true,retries:2});
      if(result?.state==='error'){
        console.warn('Invoice Prep refresh failed:',result.message);
        if(typeof notify==='function')notify('Could not refresh shared delivery loads · showing local data');
      }
    }
    return base();
  };
  wrapped.__liveSyncWrapped=true;
  prep.open=wrapped;
  return true;
}
function install(){const a=installDispatchBridge(),b=installInvoiceBridge();return a&&b}
if(!install())setTimeout(install,0);
window.VUDispatchInvoiceSync={version:'2.10.29',syncShared,install};
})();