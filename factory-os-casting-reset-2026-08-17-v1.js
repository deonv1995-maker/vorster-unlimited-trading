/* One-time Casting plan reset for 2026-08-17. Preserves production output/history; forces plan regeneration from current demand/capacity. */
(function(){
'use strict';
if(window.VUCastingReset20260817)return;
const TARGET_DATE='2026-08-17';
const MARKER='vu-casting-reset-2026-08-17-v1';
async function run(){
  const role=window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||'';
  if(role!=='Casting')return false;
  if(localStorage.getItem(MARKER)==='done')return false;
  if(!window.VUFactoryDailyProductionPlan||!window.getOne||!window.putOne)return false;
  const today=window.VUFactoryDailyProductionPlan.localDate();
  if(today!==TARGET_DATE)return false;
  const id=window.VUFactoryDailyProductionPlan.planId('Casting',TARGET_DATE);
  const current=await window.getOne('productionJobs',id);
  const now=new Date().toISOString();
  if(current){
    await window.putOne('productionJobs',{
      ...current,
      listNumber:1,
      scheduleFingerprint:`FORCE-RESET-${now}`,
      updatedAt:now,
      updatedByRole:'Factory OS reset'
    });
  } else {
    await window.putOne('productionJobs',{
      id,
      kind:'FACTORY_DAILY_PRODUCTION_PLAN',
      date:TARGET_DATE,
      division:'Casting',
      requestedTarget:0,
      assignedTarget:0,
      unfilledTarget:0,
      assignments:[],
      planSource:'MANAGER_SCHEDULE',
      scheduleFingerprint:`FORCE-RESET-${now}`,
      listNumber:1,
      createdAt:now,
      generatedAt:now,
      updatedAt:now,
      updatedByRole:'Factory OS reset'
    });
  }
  localStorage.setItem(MARKER,'done');
  if(window.VUSharedAccess?.membership?.()&&navigator.onLine){
    try{await window.VUSharedAccess.sync({reason:'casting-plan-reset-2026-08-17'});}catch(e){console.warn('Casting reset sync failed',e)}
  }
  return true;
}
window.VUCastingReset20260817={version:'1.0.0',run};
})();