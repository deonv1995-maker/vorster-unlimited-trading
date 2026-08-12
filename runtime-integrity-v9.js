/* V9.0.85 — runtime authority audit. Diagnostic only; never writes business data. */
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
  fulfilmentCalendar:()=>exact(window.VUFulfilmentCalendarAuthority,'9.0.85')&&exact(window.VUFulfilmentCalendar,'9.0.85'),
  calendarTopButton:()=>!!document.getElementById('vuCalendarTopBtn'),
  orderProgress:()=>exact(window.VUOrderProgress,'9.0.80'),
  guidedControlCenter:()=>exact(window.VUGuidedControlCenter,'9.0.80'),
  businessOptimizer:()=>exact(window.VUBusinessOutcomeOptimizer,'9.0.84'),
  optimizedSchedule:()=>present(window.VUOptimizedCompletionSchedule),
  completionCommitment:()=>present(window.VUCompletionCommitment),
  businessOperations:()=>present(window.VUBusinessOutcomeOperations),
  divisionWorksheets:()=>present(window.VUStrictDivisionWorksheets),
  unifiedRawProduction:()=>exact(window.VURawProductionUnified,'9.0.82'),
  dailyFactoryPack:()=>present(window.VUDailyFactoryPack),
  paintingCapture:()=>present(window.VUPaintingOrderCapture),
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
  if(Object.values(legacy).some(Boolean))console.warn('Legacy runtime authority detected',legacy);
  if(Object.values(status).some(v=>!v))console.warn('Runtime authority missing or stale',status);
  return{build:window.VU_BUILD,status,legacy,clean:!Object.values(legacy).some(Boolean)&&!Object.values(status).some(v=>!v)};
}
window.VURuntimeAudit={version:'9.0.85',audit};setTimeout(audit,0);
})();
