/* V9.1.06 — consolidated runtime authority audit. Diagnostic only; never writes business data. */
(function(){
'use strict';
const exact=(obj,version)=>!!obj&&String(obj.version||'')===version;
const present=obj=>!!obj;
const checks={
  businessTarget:()=>exact(window.VUBusinessTarget,'9.0.83'),
  sageDocumentImport:()=>exact(window.VUSageDocumentImport,'9.0.83'),
  navigation:()=>present(window.VUNavigationAuthority),
  dashboard:()=>present(window.VUDashboardAuthority),
  orderCommitment:()=>present(window.VUOrderCommitment),
  managerPlanPriority:()=>exact(window.VUManagerPlanPriority,'9.0.84'),
  autoFulfilmentPlanner:()=>exact(window.VUAutoFulfilmentPlanner,'9.0.90'),
  fulfilmentCalendar:()=>exact(window.VUFulfilmentCalendarStandalone,'9.0.89')&&typeof window.openFulfilmentCalendar==='function',
  calendarQuickButton:()=>!!document.getElementById('calendarQuickBtn'),
  orderProgress:()=>exact(window.VUOrderProgress,'9.0.80'),
  guidedControlCenter:()=>exact(window.VUGuidedControlCenter,'9.0.80'),
  businessOptimizer:()=>present(window.VUBusinessOutcomeOptimizer),
  optimizedSchedule:()=>present(window.VUOptimizedCompletionSchedule),
  completionCommitment:()=>present(window.VUCompletionCommitment),
  businessOperations:()=>present(window.VUBusinessOutcomeOperations),
  divisionWorksheets:()=>present(window.VUStrictDivisionWorksheets),
  unifiedRawProduction:()=>exact(window.VURawProductionUnified,'9.0.82'),
  dailyFactoryPack:()=>exact(window.VUFactoryPackFulfilmentAuthority,'9.1.06')&&String(window.VUDailyFactoryPack?.version||'')==='9.1.06',
  paintedStockInventory:()=>exact(window.VUPaintedStockInventoryAuthority,'9.0.96'),
  fullOrderPainting:()=>exact(window.VUPaintingFullOrderAuthority,'9.1.05')&&String(window.VUPaintingOrderCapture?.version||'')==='9.1.05',
  productionSetDelete:()=>exact(window.VUProductionSetDeleteAuthority,'9.1.03'),
  dispatchCapture:()=>exact(window.VUDailyDispatchCapture,'9.1.02'),
  deliveryLogistics:()=>present(window.VUDeliveryLogisticsPlanner),
  sharedData:()=>present(window.VUSharedData),
  sharedRefresh:()=>present(window.VUSharedRefresh),
  uiStability:()=>present(window.VUUIStability),
  serviceWorkerGuard:()=>typeof window.__vuOriginalServiceWorkerRegister==='function'
};
const legacyChecks={
  oldOptimizerVersion:()=>typeof window.VU_OPTIMIZER_VERSION!=='undefined',
  oldChecklist:()=>typeof window.VU_CHECKLIST_VERSION!=='undefined'||typeof window.vuIssueChecklistOrderToFinishing==='function',
  oldBusinessPipeline:()=>typeof window.VU_PIPELINE_VERSION!=='undefined'||typeof window.vuMoveFinishedOrderToDelivery==='function',
  oldWorkflowPredictions:()=>typeof window.VU_PREDICTION_VERSION!=='undefined',
  oldPipelineIntelligence:()=>typeof window.VU_PIPELINE_INTELLIGENCE_VERSION!=='undefined'||typeof window.buildPipelineForecast==='function',
  oldCrossStage:()=>typeof window.VU_CROSS_STAGE_VERSION!=='undefined',
  oldDailyWorkPacks:()=>typeof window.openDailyWorkPacks==='function',
  workforcePrintRouter:()=>!!window.VUWorkforcePrintV9026,
  factorySheetsV9025:()=>!!window.VUFactorySheetsV9025,
  combinedFinishingPrint:()=>!!window.VUCombinedFinishingPaintingWorksheet,
  oldFreshnessCoordinator:()=>!!window.VUEnsureInitialSharedData,
  oldPaintingPatch:()=>!!window.VUPaintingManufacturingDivision
};
function audit(){
  const status={};for(const[name,test]of Object.entries(checks)){try{status[name]=!!test()}catch{status[name]=false}}
  const legacy={};for(const[name,test]of Object.entries(legacyChecks)){try{legacy[name]=!!test()}catch{legacy[name]=false}}
  const operationalReady=!!window.VUOperationalBuild?.ready?.();
  if(Object.values(legacy).some(Boolean))console.warn('Legacy runtime authority detected',legacy);
  if(operationalReady&&Object.values(status).some(v=>!v))console.warn('Runtime authority missing or stale',status);
  return{build:window.VU_BUILD,status,legacy,operationalReady,clean:operationalReady&&!Object.values(legacy).some(Boolean)&&!Object.values(status).some(v=>!v)};
}
window.VURuntimeAudit={version:'9.1.06',audit};
window.addEventListener('vu:operational-authorities-ready',()=>setTimeout(audit,0));
setTimeout(()=>{if(window.VUOperationalBuild?.ready?.())audit()},4500);
})();