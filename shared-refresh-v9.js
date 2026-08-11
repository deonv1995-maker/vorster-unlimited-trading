/* V9.0.67 — single safe shared-data UI refresh authority.
   Remote writes may update IndexedDB at any time, but this module is the ONLY layer allowed to
   redraw a visible top-level page because of those writes. It never navigates away from a detail,
   edit or dialog workflow and coalesces a burst of remote writes into one redraw. */
(function(){
'use strict';
let timer=null,refreshing=false,pending=false;
const TOP=new Set(['dashboard','products','customers','visits','quotes','orders','production','deliveries','settings']);
function route(){
  const authority=window.VUNavigationAuthority;
  if(authority?.current)return authority.current();
  return document.querySelector('.bottom-nav button.active')?.dataset?.route||'dashboard';
}
function editing(){const a=document.activeElement;return !!a&&['INPUT','TEXTAREA','SELECT'].includes(a.tagName);}
function dialogOpen(){return !!document.querySelector('dialog[open]');}
function detailOpen(){const back=document.getElementById('backBtn');return !!back&&!back.classList.contains('hidden');}
async function refresh(){
  if(refreshing||document.visibilityState!=='visible'||editing()||dialogOpen()||detailOpen())return false;
  const r=route();if(!TOP.has(r)||typeof window.navigate!=='function')return false;
  refreshing=true;const y=window.scrollY;
  try{
    await window.navigate(r);
    requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));
    return true;
  }finally{refreshing=false;}
}
function schedule(){
  pending=true;clearTimeout(timer);
  timer=setTimeout(async()=>{if(!pending)return;pending=false;if(!await refresh())pending=true;},700);
}
function remoteWrite(store){return window.VUSyncSuspendDepth>0&&window.VU_SYNCABLE_STORES?.has(store);}
if(typeof window.VUDbRawPut==='function'&&!window.VUDbRawPut.__vuSharedRefresh){
  const base=window.VUDbRawPut;
  const wrapped=async function(store,value){const remote=remoteWrite(store);const result=await base(store,value);if(remote)schedule();return result;};
  wrapped.__vuSharedRefresh=true;window.VUDbRawPut=wrapped;
}
if(typeof window.VUDbRawDelete==='function'&&!window.VUDbRawDelete.__vuSharedRefresh){
  const base=window.VUDbRawDelete;
  const wrapped=async function(store,id){const remote=remoteWrite(store);const result=await base(store,id);if(remote)schedule();return result;};
  wrapped.__vuSharedRefresh=true;window.VUDbRawDelete=wrapped;
}
window.addEventListener('vu:shared-reconciled',()=>{if(!pending)schedule();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&pending)schedule();});
window.addEventListener('focus',()=>{if(pending)schedule();});
window.VUSharedRefresh={version:'9.0.67',schedule,refresh};
})();