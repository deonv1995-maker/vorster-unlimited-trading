/* V9.2.0 — cleaned runtime authority audit. Diagnostic only; never writes business data. */
(function(){
'use strict';
const exact=(obj,version)=>!!obj&&String(obj.version||'')===version;
const present=obj=>!!obj;
const checks={
  navigation:()=>present(window.VUNavigationAuthority),
  dashboard:()=>present(window.VUDashboardAuthority),
  orderCommitment:()=>present(window.VUOrderCommitment),
  autoFulfilmentPlanner:()=>present(window.VUAutoFulfilmentPlanner),
  fulfilmentCalendar:()=>present(window.VUFulfilmentCalendarStandalone)&&typeof window.openFulfilmentCalendar==='function',
  orderProgress:()=>present(window.VUOrderProgress),
  businessOptimizer:()=>present(window.VUBusinessOutcomeOptimizer),
  optimizedSchedule:()=>present(window.VUOptimizedCompletionSchedule),
  divisionWorksheets:()=>present(window.VUStrictDivisionWorksheets),
  unifiedRawProduction:()=>present(window.VURawProductionUnified),
  dailyFactoryPackBase:()=>present(window.VUDailyFactoryPack),
  paintedStockInventory:()=>present(window.VUPaintedStockInventoryAuthority),
  sharedData:()=>present(window.VUSharedData),
  sharedRefresh:()=>present(window.VUSharedRefresh),
  uiStability:()=>present(window.VUUIStability),
  serviceWorkerGuard:()=>typeof window.__vuOriginalServiceWorkerRegister==='function'
};
const finalChecks={
  operationalBuild:()=>exact(window.VUOperationalBuild,'9.2.0')&&window.VUOperationalBuild.ready(),
  fullOrderPainting:()=>exact(window.VUPaintingFullOrderAuthority,'9.1.05'),
  worksheetPainting:()=>exact(window.VUWorksheetPaintReconciliationAuthority,'9.1.12'),
  orderIdentity:()=>exact(window.VUOrderIdentityReconciliation,'9.2.0'),
  dispatch:()=>exact(window.VUPartialDispatchCapture,'9.1.14'),
  dispatchStepper:()=>present(window.VUDispatchStepperAuthority),
  liveFactoryPack:()=>present(window.VULiveFactoryPackAuthority),
  productionSetDelete:()=>present(window.VUProductionSetDeleteAuthority),
  orderUpdateRecalc:()=>present(window.VUOrderUpdateRecalcAuthority)
};
const forbidden={
  dailyDispatchLegacy:()=>!!window.VUDailyDispatchCapture&&String(window.VUDailyDispatchCapture.version||'')==='9.1.02',
  paintWorksheetRecoveryLegacy:()=>!!window.VUPaintingWorksheetRecoveryAuthority,
  paintRemainingLegacy:()=>!!window.VUPaintingRemainingAuthority,
  paintGroupingLegacy:()=>!!window.VUPaintingWorksheetGroupAuthority,
  oldOptimizerVersion:()=>typeof window.VU_OPTIMIZER_VERSION!=='undefined',
  oldChecklist:()=>typeof window.VU_CHECKLIST_VERSION!=='undefined'||typeof window.vuIssueChecklistOrderToFinishing==='function',
  oldBusinessPipeline:()=>typeof window.VU_PIPELINE_VERSION!=='undefined'||typeof window.vuMoveFinishedOrderToDelivery==='function',
  oldWorkflowPredictions:()=>typeof window.VU_PREDICTION_VERSION!=='undefined',
  oldPipelineIntelligence:()=>typeof window.VU_PIPELINE_INTELLIGENCE_VERSION!=='undefined'||typeof window.buildPipelineForecast==='function',
  oldCrossStage:()=>typeof window.VU_CROSS_STAGE_VERSION!=='undefined',
  oldDailyWorkPacks:()=>typeof window.openDailyWorkPacks==='function'
};
function run(group){const out={};for(const[name,test]of Object.entries(group)){try{out[name]=!!test()}catch{out[name]=false}}return out}
function audit(){
  const base=run(checks),final=run(finalChecks),legacy=run(forbidden);
  const clean=Object.values(base).every(Boolean)&&Object.values(final).every(Boolean)&&!Object.values(legacy).some(Boolean);
  if(Object.values(legacy).some(Boolean))console.warn('Superseded runtime authority detected',legacy);
  if(!clean)console.warn('Runtime authority audit',{base,final,legacy});
  return{build:window.VU_BUILD,base,final,legacy,clean};
}
window.VURuntimeAudit={version:'9.2.0',audit};
window.addEventListener('vu:operational-authorities-ready',()=>setTimeout(audit,0));
})();