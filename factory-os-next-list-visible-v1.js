/* Factory OS 2.10.40 — follow-on production list recovery without full dataset downloads. */
(function(){
'use strict';
if(window.VUFactoryNextListVisible||!window.VUFactoryManufacturing)return;
const DIVISIONS=new Set(['Casting','Packing','Resin']);
const originalOpen=window.VUFactoryManufacturing.open.bind(window.VUFactoryManufacturing);
let currentDivision='';
function role(){return window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||''}
function canOperate(division){return !window.VUManagementPreview?.isActive?.()&&(role()==='Management'||role()===division)}
function completeState(){const text=(window.main?.textContent||'').replace(/\s+/g,' ');return /list\s+\d+\s+complete/i.test(text)||/current list complete/i.test(text)}
function inject(division){
 if(!DIVISIONS.has(division)||!canOperate(division)||!completeState())return;
 if(document.getElementById('fosNextProductionList'))return;
 const sections=[...document.querySelectorAll('#main section.card')],host=sections[sections.length-1]||window.main;if(!host)return;
 const box=document.createElement('div');box.className='fos-next-list';box.innerHTML=`<strong>Continue production</strong><p class="muted">There is more scheduled ${window.esc?window.esc(division.toLowerCase()):division.toLowerCase()} work waiting. Start the next priority list so the division can keep working.</p><button class="primary" id="fosNextProductionList" type="button">Start next ${window.esc?window.esc(division):division} list</button>`;host.appendChild(box);
 const btn=box.querySelector('button');btn.onclick=async()=>{
  btn.disabled=true;btn.textContent='Preparing next priority list…';
  try{
   // Only pull changes since the device's cursor. A next-list action must never download the full Factory OS dataset.
   if(navigator.onLine&&window.VUSharedAccess?.membership?.()){
    const sync=await window.VUSharedAccess.sync({reason:`${division.toLowerCase()}-next-list-check`});
    if(sync?.state==='error')throw new Error(sync.message||'Shared data refresh failed.');
   }
   // Rebuild the live manager-scheduled backlog first. The old completed plan may still have the same schedule fingerprint,
   // so ensureDivision alone can legally return that completed plan. nextList intentionally builds from the live priority backlog.
   const live=await window.VUFactoryDailyProductionPlan.buildDivision(division);
   if(live.remaining>0){await window.VUFactoryManufacturing.open(division);return}
   const created=await window.VUFactoryProductionRecommendation.nextList(division);
   if(!created?.assignments?.length)throw new Error(`The next ${division} list was created without work items.`);
   if(navigator.onLine&&window.VUSharedAccess?.membership?.()){
    const sync=await window.VUSharedAccess.sync({reason:`${division.toLowerCase()}-next-list-created`});
    if(sync?.state==='error')console.warn('Next-list sync failed after local creation',sync.message);
   }
   window.notify?.(`${division} list ${created.listNumber||''} ready`);
   await window.VUFactoryManufacturing.open(division);
  }catch(e){btn.disabled=false;btn.textContent=`Start next ${division} list`;window.alert(e?.message||String(e))}
 };
}
async function open(division){currentDivision=division;await originalOpen(division);setTimeout(()=>inject(division),0)}
window.VUFactoryManufacturing.open=open;
window.addEventListener('vu:sync-status',()=>{if(currentDivision)setTimeout(()=>inject(currentDivision),80)});
window.VUFactoryNextListVisible={version:'2.10.40',inject,open};
})();