/* Factory OS 2.10.37 — fast local-first manufacturing open, post-sync refresh, and one-time Casting plan reset for 2026-08-17. */
(function(){
'use strict';
if(window.VUFactoryManufacturingFastOpen||!window.VUFactoryManufacturing)return;
const DIVISIONS=new Set(['Casting','Packing','Resin']);
const RESET_DATE='2026-08-17',RESET_KEY='vu-casting-plan-reset-2026-08-17-v1';
const originalOpen=window.VUFactoryManufacturing.open.bind(window.VUFactoryManufacturing);
let backgroundTimer=null,refreshing=false;
function actualRole(){return window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||''}
function divisionDevice(){return DIVISIONS.has(actualRole())&&!window.VUManagementPreview?.isActive?.()}
async function resetCastingPlanIfRequested(division){
 if(division!=='Casting'||actualRole()!=='Casting'||localStorage.getItem(RESET_KEY)==='done')return false;
 const planApi=window.VUFactoryDailyProductionPlan;if(!planApi||planApi.localDate()!==RESET_DATE)return false;
 const id=planApi.planId('Casting',RESET_DATE),current=await window.getOne('productionJobs',id),now=new Date().toISOString();
 if(current){
  await window.putOne('productionJobs',{...current,listNumber:1,scheduleFingerprint:`FORCE-RESET-${now}`,updatedAt:now,updatedByRole:'Factory OS reset'});
 }else{
  await window.putOne('productionJobs',{id,kind:'FACTORY_DAILY_PRODUCTION_PLAN',date:RESET_DATE,division:'Casting',requestedTarget:0,assignedTarget:0,unfilledTarget:0,assignments:[],planSource:'MANAGER_SCHEDULE',scheduleFingerprint:`FORCE-RESET-${now}`,listNumber:1,createdAt:now,generatedAt:now,updatedAt:now,updatedByRole:'Factory OS reset'});
 }
 localStorage.setItem(RESET_KEY,'done');return true;
}
async function openLocal(division){
 const access=window.VUSharedAccess,membership=access?.membership;let suppressed=false;
 try{
  if(access&&typeof membership==='function'){access.membership=()=>null;suppressed=true}
  await originalOpen(division);
 }finally{if(suppressed)access.membership=membership}
}
async function backgroundSync(division){
 if(!navigator.onLine||!window.VUSharedAccess?.membership?.())return;
 try{
  await window.VUFactoryManufacturing.queueMissingTodayOutput?.(division);
  const result=await window.VUSharedAccess.sync({reason:`${String(division).toLowerCase()}-workstation-background-open`});
  if(result?.state==='error'){console.warn('Background production sync failed',result.message);return}
  if(refreshing)return;refreshing=true;try{await openLocal(division)}finally{refreshing=false}
 }catch(e){console.warn('Background production refresh failed',e)}
}
async function fastOpen(division){
 if(!divisionDevice())return originalOpen(division);
 try{await resetCastingPlanIfRequested(division)}catch(e){console.warn('Casting plan reset failed',e)}
 await openLocal(division);
 clearTimeout(backgroundTimer);backgroundTimer=setTimeout(()=>backgroundSync(division),80);
}
window.VUFactoryManufacturing.open=fastOpen;
window.VUFactoryManufacturingFastOpen={version:'2.10.37',open:fastOpen,backgroundSync,openLocal,resetCastingPlanIfRequested};
})();