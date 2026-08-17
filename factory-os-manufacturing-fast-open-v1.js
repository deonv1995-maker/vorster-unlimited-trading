/* Factory OS 2.10.34 — fast local-first manufacturing open with post-sync refresh. */
(function(){
'use strict';
if(window.VUFactoryManufacturingFastOpen||!window.VUFactoryManufacturing)return;
const DIVISIONS=new Set(['Casting','Packing','Resin']);
const originalOpen=window.VUFactoryManufacturing.open.bind(window.VUFactoryManufacturing);
let backgroundTimer=null,refreshing=false;
function actualRole(){return window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||''}
function divisionDevice(){return DIVISIONS.has(actualRole())&&!window.VUManagementPreview?.isActive?.()}
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
  if(refreshing)return;
  refreshing=true;
  try{await openLocal(division)}finally{refreshing=false}
 }catch(e){console.warn('Background production refresh failed',e)}
}
async function fastOpen(division){
 if(!divisionDevice())return originalOpen(division);
 await openLocal(division);
 clearTimeout(backgroundTimer);
 backgroundTimer=setTimeout(()=>backgroundSync(division),80);
}
window.VUFactoryManufacturing.open=fastOpen;
window.VUFactoryManufacturingFastOpen={version:'2.10.34',open:fastOpen,backgroundSync,openLocal};
})();