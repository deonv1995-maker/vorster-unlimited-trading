/* V9.0.58 — runtime authority audit. Diagnostic only; never writes business data. */
(function(){
'use strict';
const checks={
  navigation:()=>!!window.VUNavigationAuthority,
  dashboard:()=>!!window.VUDashboardAuthority,
  operations:()=>!!window.VUThreeStagePlan,
  manufacturingClassification:()=>!!window.VUManufacturingClassification&&window.VUManufacturingDivisions?.version==='9.0.58',
  divisionWorksheets:()=>!!window.VUStrictDivisionWorksheets,
  divisionStock:()=>!!window.VUStrictDivisionStock,
  sharedData:()=>!!window.VUSharedData,
  sharedRefresh:()=>!!window.VUSharedRefresh
};
function audit(){
  const status={};for(const [name,test] of Object.entries(checks)){try{status[name]=!!test();}catch{status[name]=false;}}
  const legacy={
    workforcePrintRouter:!!window.VUWorkforcePrintV9026,
    factorySheetsV9025:!!window.VUFactorySheetsV9025,
    combinedFinishingPrint:!!window.VUCombinedFinishingPaintingWorksheet,
    oldFreshnessCoordinator:!!window.VUEnsureInitialSharedData,
    oldPaintingPatch:!!window.VUPaintingManufacturingDivision,
    oldManufacturingAuthority:!!window.VUManufacturingDivisions&&window.VUManufacturingDivisions?.version!=='9.0.58',
    discardedSameDayWrapper:!!window.VUSequentialWorkflowForecast
  };
  if(Object.values(legacy).some(Boolean))console.warn('Legacy runtime authority detected',legacy);
  if(Object.values(status).some(v=>!v))console.warn('Runtime authority missing',status);
  return{build:window.VU_BUILD,status,legacy};
}
window.VURuntimeAudit={version:'9.0.58',audit};
setTimeout(audit,0);
})();