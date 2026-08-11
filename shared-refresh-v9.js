/* V9.0.57 — background-only shared-data page freshness.
   No startup blocking, no navigation ownership, and no business-data mutation.
   Remote records are already written by the shared-data engine; this module only refreshes
   a safe visible top-level page after those writes land in IndexedDB. */
(function(){
'use strict';
let timer=null,refreshing=false,pending=false;
const TOP=new Set(['dashboard','products','customers','visits','quotes','orders','production','deliveries','settings']);
function route(){return document.querySelector('.bottom-nav button.active')?.dataset?.route||'dashboard';}
function editing(){const a=document.activeElement;return !!a&&['INPUT','TEXTAREA','SELECT'].includes(a.tagName);}
function dialogOpen(){return !!document.querySelector('dialog[open]');}
async function refresh(){
  if(refreshing||document.visibilityState!=='visible'||editing()||dialogOpen())return false;
  const r=route();if(!TOP.has(r)||typeof window.navigate!=='function')return false;
  refreshing=true;const y=window.scrollY;
  try{await window.navigate(r);requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));return true;}
  finally{refreshing=false;}
}
function schedule(){pending=true;clearTimeout(timer);timer=setTimeout(async()=>{if(!pending)return;pending=false;if(!await refresh())pending=true;},350);}
function remoteWrite(store){return window.VUSyncSuspendDepth>0&&window.VU_SYNCABLE_STORES?.has(store);}
if(typeof window.VUDbRawPut==='function'&&!window.VUDbRawPut.__vuSharedRefresh){
  const base=window.VUDbRawPut;const wrapped=async function(store,value){const remote=remoteWrite(store);const result=await base(store,value);if(remote)schedule();return result;};
  wrapped.__vuSharedRefresh=true;window.VUDbRawPut=wrapped;
}
if(typeof window.VUDbRawDelete==='function'&&!window.VUDbRawDelete.__vuSharedRefresh){
  const base=window.VUDbRawDelete;const wrapped=async function(store,id){const remote=remoteWrite(store);const result=await base(store,id);if(remote)schedule();return result;};
  wrapped.__vuSharedRefresh=true;window.VUDbRawDelete=wrapped;
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&pending)schedule();});
window.addEventListener('focus',()=>{if(pending)schedule();});
window.VUSharedRefresh={version:'9.0.57',schedule,refresh};
})();