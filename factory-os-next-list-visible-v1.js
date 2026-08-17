/* Factory OS 2.10.35 — always expose follow-on production list action once the current list is complete. */
(function(){
'use strict';
if(window.VUFactoryNextListVisible||!window.VUFactoryManufacturing)return;
const DIVISIONS=new Set(['Casting','Packing','Resin']);
const originalOpen=window.VUFactoryManufacturing.open.bind(window.VUFactoryManufacturing);
let currentDivision='';
function role(){return window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||''}
function canOperate(division){return !window.VUManagementPreview?.isActive?.()&&(role()==='Management'||role()===division)}
function completeState(){
 const text=(window.main?.textContent||'').replace(/\s+/g,' ');
 return /list\s+\d+\s+complete/i.test(text)||/current list complete/i.test(text);
}
function inject(division){
 if(!DIVISIONS.has(division)||!canOperate(division)||!completeState())return;
 if(document.getElementById('fosNextProductionList'))return;
 const sections=[...document.querySelectorAll('#main section.card')];
 const host=sections[sections.length-1]||window.main;
 if(!host)return;
 const box=document.createElement('div');
 box.className='fos-next-list';
 box.innerHTML=`<strong>Continue production</strong><p class="muted">Check the live order backlog and prepare the next ${window.esc?window.esc(division.toLowerCase()):division.toLowerCase()} priority list.</p><button class="primary" id="fosNextProductionList" type="button">Start next ${window.esc?window.esc(division):division} list</button>`;
 host.appendChild(box);
 const btn=box.querySelector('button');
 btn.onclick=async()=>{
  btn.disabled=true;btn.textContent='Checking next priority list…';
  try{
   if(navigator.onLine&&window.VUSharedAccess?.membership?.()){
    const sync=await window.VUSharedAccess.sync({reason:`${division.toLowerCase()}-next-list-check`,resetPull:true});
    if(sync?.state==='error')throw new Error(sync.message||'Shared data refresh failed.');
   }
   await window.VUFactoryProductionRecommendation.nextList(division);
   if(navigator.onLine&&window.VUSharedAccess?.membership?.()){
    const sync=await window.VUSharedAccess.sync({reason:`${division.toLowerCase()}-next-list-created`});
    if(sync?.state==='error')console.warn('Next-list sync failed after local creation',sync.message);
   }
   window.notify?.(`${division} next priority list ready`);
   await window.VUFactoryManufacturing.open(division);
  }catch(e){
   btn.disabled=false;btn.textContent=`Start next ${division} list`;
   window.alert(e?.message||String(e));
  }
 };
}
async function open(division){currentDivision=division;await originalOpen(division);setTimeout(()=>inject(division),0)}
window.VUFactoryManufacturing.open=open;
window.addEventListener('vu:sync-status',()=>{if(currentDivision)setTimeout(()=>inject(currentDivision),80)});
window.VUFactoryNextListVisible={version:'2.10.35',inject,open};
})();