/* Factory OS 2.10.39 — low-data local-first manufacturing open with delta-sync recovery. */
(function(){
'use strict';
if(window.VUFactoryManufacturingFastOpen||!window.VUFactoryManufacturing)return;
const DIVISIONS=new Set(['Casting','Packing','Resin']);
const originalOpen=window.VUFactoryManufacturing.open.bind(window.VUFactoryManufacturing);
let backgroundTimer=null,refreshing=false,lastBackgroundSyncAt=0;
function actualRole(){return window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||''}
function divisionDevice(){return DIVISIONS.has(actualRole())&&!window.VUManagementPreview?.isActive?.()}
async function openLocal(division){
 const access=window.VUSharedAccess,membership=access?.membership;let suppressed=false;
 try{
  if(access&&typeof membership==='function'){access.membership=()=>null;suppressed=true}
  await originalOpen(division);
 }finally{if(suppressed)access.membership=membership}
}
async function discardObsoleteResetMutation(division){
 const planApi=window.VUFactoryDailyProductionPlan;if(!planApi)return false;
 const date=planApi.localDate(),id=planApi.planId(division,date),outboxId=`productionJobs|${id}`;
 const pending=await window.VUDbRawGetOne?.('syncOutbox',outboxId);
 const local=await window.getOne?.('productionJobs',id);
 const resetTagged=String(pending?.payload?.updatedByRole||local?.updatedByRole||'').toLowerCase().includes('factory os reset')||String(pending?.payload?.scheduleFingerprint||local?.scheduleFingerprint||'').startsWith('FORCE-RESET-');
 if(!resetTagged)return false;
 await window.VUDbRawDelete?.('syncOutbox',outboxId);
 await window.VUDbRawDelete?.('syncConflicts',outboxId);
 return true;
}
async function backgroundSync(division,{force=false}={}){
 if(!navigator.onLine||!window.VUSharedAccess?.membership?.())return;
 const now=Date.now();
 if(!force&&now-lastBackgroundSyncAt<60000)return;
 lastBackgroundSyncAt=now;
 try{
  await window.VUFactoryManufacturing.queueMissingTodayOutput?.(division);
  const hadObsoleteReset=await discardObsoleteResetMutation(division);
  /* Normal workstation refresh is incremental. A full pull is used only once when repairing
     the known obsolete reset record, never on every page open. */
  let result=await window.VUSharedAccess.sync({reason:`${String(division).toLowerCase()}-workstation-delta-refresh`,resetPull:hadObsoleteReset});
  if(result?.state==='error'){console.warn('Background production sync failed',result.message);return}
  const before=await window.VUFactoryDailyProductionPlan?.get?.(division);
  const rebuilt=await window.VUFactoryProductionRecommendation?.ensureDivision?.(division);
  const changed=before?.updatedAt!==rebuilt?.updatedAt||before?.scheduleFingerprint!==rebuilt?.scheduleFingerprint||Number(before?.assignedTarget||0)!==Number(rebuilt?.assignedTarget||0);
  if(changed&&window.VUSharedAccess?.membership?.()){
   result=await window.VUSharedAccess.sync({reason:`${String(division).toLowerCase()}-workstation-plan-recovered`});
   if(result?.state==='error')console.warn('Recovered production plan sync failed',result.message);
  }
  if(refreshing)return;refreshing=true;try{await openLocal(division)}finally{refreshing=false}
 }catch(e){console.warn('Background production refresh failed',e)}
}
async function fastOpen(division){
 if(!divisionDevice())return originalOpen(division);
 await openLocal(division);
 clearTimeout(backgroundTimer);backgroundTimer=setTimeout(()=>backgroundSync(division),250);
}
window.VUFactoryManufacturing.open=fastOpen;
window.VUFactoryManufacturingFastOpen={version:'2.10.39',open:fastOpen,backgroundSync,openLocal,discardObsoleteResetMutation};
})();