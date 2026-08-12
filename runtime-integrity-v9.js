/* V9.0.80 — runtime authority audit. Diagnostic only; never writes business data. */
(function(){
'use strict';
const atLeast=(obj,version)=>!!obj&&String(obj.version||'')===version;
const checks={
  navigation:()=>atLeast(window.VUNavigationAuthority,'9.0.77'),
  dashboard:()=>atLeast(window.VUDashboardAuthority,'9.0.77'),
  operations:()=>!!window.VUThreeStagePlan,
  orderCommitment:()=>atLeast(window.VUOrderCommitment,'9.0.79'),
  orderCommitmentUI:()=>atLeast(window.VUOrderCommitmentUI,'9.0.79'),
  orderProgress:()=>atLeast(window.VUOrderProgress,'9.0.80'),
  guidedControlCenter:()=>atLeast(window.VUGuidedControlCenter,'9.0.80'),
  businessOptimizer:()=>atLeast(window.VUBusinessOutcomeOptimizer,'9.0.79'),
  optimizedSchedule:()=>atLeast(window.VUOptimizedCompletionSchedule,'9.0.78'),
  completionCommitment:()=>atLeast(window.VUCompletionCommitment,'9.0.79'),
  optimizedCalendar:()=>atLeast(window.VUOptimizedCompletionCalendar,'9.0.78'),
  businessOperations:()=>atLeast(window.VUBusinessOutcomeOperations,'9.0.78'),
  manufacturingClassification:()=>!!window.VUManufacturingClassification,
  divisionWorksheets:()=>atLeast(window.VUStrictDivisionWorksheets,'9.0.77'),
  divisionStock:()=>!!window.VUStrictDivisionStock,
  paintingCapture:()=>atLeast(window.VUPaintingOrderCapture,'9.0.77'),
  deliveryLogistics:()=>atLeast(window.VUDeliveryLogisticsPlanner,'9.0.79'),
  sharedData:()=>!!window.VUSharedData,
  sharedRefresh:()=>atLeast(window.VUSharedRefresh,'9.0.77'),
  serviceWorkerGuard:()=>typeof window.__vuOriginalServiceWorkerRegister==='function'
};
function audit(){
  const status={};for(const[name,test]of Object.entries(checks)){try{status[name]=!!test()}catch{status[name]=false}}
  const legacy={workforcePrintRouter:!!window.VUWorkforcePrintV9026,factorySheetsV9025:!!window.VUFactorySheetsV9025,combinedFinishingPrint:!!window.VUCombinedFinishingPaintingWorksheet,oldFreshnessCoordinator:!!window.VUEnsureInitialSharedData,oldPaintingPatch:!!window.VUPaintingManufacturingDivision,discardedSameDayWrapper:!!window.VUSequentialWorkflowForecast};
  if(Object.values(legacy).some(Boolean))console.warn('Legacy runtime authority detected',legacy);
  if(Object.values(status).some(v=>!v))console.warn('Runtime authority missing or stale',status);
  return{build:window.VU_BUILD,status,legacy};
}
window.VURuntimeAudit={version:'9.0.80',audit};setTimeout(audit,0);
})();