/* V9.0.84 — let the fulfilment calendar open the route planner on the selected date. */
(function(){
'use strict';
const planner=window.VUDeliveryLogisticsPlanner;if(!planner?.open)return;
const baseOpen=planner.open;
async function open(date=''){
  const result=await baseOpen();
  const input=document.getElementById('routePlanDate');
  if(input&&date){const d=window.VUOrderCommitment?.dateKey?.(date)||String(date).slice(0,10);if(d)input.value=d;}
  return result;
}
window.openDeliveryLogisticsPlanner=open;
window.VUDeliveryLogisticsPlanner={...planner,version:'9.0.84',open};
window.VUDeliveryCalendarRouteBridge={version:'9.0.84'};
})();
