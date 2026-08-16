/* Factory OS navigation context bridge — preserves return destination for modal order views. */
(function(){'use strict';
if(window.VUNavigationContext)return;
const api={version:'1.0.0'};
function patchOrderView(){
  const intake=window.VUOfficeIntake;
  if(!intake?.openOrder||intake.__vuNavigationPatched)return;
  const original=intake.openOrder.bind(intake);
  intake.openOrder=async function(orderId){
    const origin=document.body?.dataset?.route||'';
    const result=await original(orderId);
    const close=document.getElementById('fosOrderClose');
    if(close&&origin==='delivery-calendar'){
      close.onclick=async()=>{
        closeDialog();
        try{await window.navigate?.('delivery-calendar')}catch(e){console.error('Could not return to Delivery Calendar',e)}
      };
    }
    return result;
  };
  intake.__vuNavigationPatched=true;
}
function init(){patchOrderView()}
api.init=init;api.patchOrderView=patchOrderView;
window.VUNavigationContext=api;
init();
})();
