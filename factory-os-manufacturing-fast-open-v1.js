/* Factory OS 2.10.41 — low-data local-first manufacturing open with one-time local Casting list rebuild. */
(function(){
'use strict';
if(window.VUFactoryManufacturingFastOpen||!window.VUFactoryManufacturing)return;
const DIVISIONS=new Set(['Casting','Packing','Resin']);
const CASTING_RESET_DATE='2026-08-17';
const CASTING_RESET_KEY='vu-casting-local-list-rebuild-2026-08-17-v2';
const originalOpen=window.VUFactoryManufacturing.open.bind(window.VUFactoryManufacturing);
let backgroundTimer=null,refreshing=false,lastBackgroundSyncAt=0;
function actualRole(){return window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||''}
function divisionDevice(){return DIVISIONS.has(actualRole())&&!window.VUManagementPreview?.isActive?.()}
async function rebuildCastingListLocallyOnce(division){
 if(division!=='Casting'||actualRole()!=='Casting'||localStorage.getItem(CASTING_RESET_KEY)==='done')return false;
 const planApi=window.VUFactoryDailyProductionPlan;
 if(!planApi||planApi.localDate()!==CASTING_RESET_DATE)return false;
 const id=planApi.planId('Casting',CASTING_RESET_DATE),outboxId=`productionJobs|${id}`;
 /* This repair is deliberately local-only. It clears the stale plan on the Casting leader's
    phone and rebuilds List 1 from the order/delivery/capacity data already present on that phone.
    Existing PRODUCTION_OUTPUT transactions are untouched, and no reset/delete is published. */
 window.VUSyncSuspendDepth=(window.VUSyncSuspendDepth||0)+1;
 try{
  await window.VUDbRawDelete?.('productionJobs',id);
  await window.VUDbRawDelete?.('syncOutbox',outboxId);
  await window.VUDbRawDelete?.('syncConflicts',outboxId);
  const rebuilt=await window.VUFactoryProductionRecommendation?.ensureDivision?.('Casting',CASTING_RESET_DATE);
  if(!rebuilt?.assignments?.length)throw new Error('Casting list rebuild returned no work items.');
 }finally{
  window.VUSyncSuspendDepth=Math.max(0,(window.VUSyncSuspendDepth||1)-1);
 }
 localStorage.setItem(CASTING_RESET_KEY,'done');
 return true;
}
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
 const now=Date.now();if(!force&&now-lastBackgroundSyncAt<60000)return;lastBackgroundSyncAt=now;
 try{
  await window.VUFactoryManufacturing.queueMissingTodayOutput?.(division);
  const hadObsoleteReset=await discardObsoleteResetMutation(division);
  let result=await window.VUSharedAccess.sync({reason:`${String(division).toLowerCase()}-workstation-delta-refresh`,resetPull:hadObsoleteReset});
  if(result?.state==='error'){console.warn('Background production sync failed',result.message);return}
  if(refreshing)return;refreshing=true;try{await openLocal(division)}finally{refreshing=false}
 }catch(e){console.warn('Background production refresh failed',e)}
}
async function fastOpen(division){
 if(!divisionDevice())return originalOpen(division);
 try{await rebuildCastingListLocallyOnce(division)}catch(e){console.warn('Local Casting list rebuild failed',e)}
 await openLocal(division);
 clearTimeout(backgroundTimer);backgroundTimer=setTimeout(()=>backgroundSync(division),250);
}
window.VUFactoryManufacturing.open=fastOpen;
window.VUFactoryManufacturingFastOpen={version:'2.10.41',open:fastOpen,backgroundSync,openLocal,discardObsoleteResetMutation,rebuildCastingListLocallyOnce};
})();