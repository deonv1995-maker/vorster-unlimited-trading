/* V9.0.68 — single route-aware shared-data UI refresh authority.
   Remote writes may update IndexedDB at any time, but a visible top-level page is redrawn only
   when one of that page's actual data dependencies changed. Detail/edit/dialog workflows are
   never navigated away from, and bursts of writes are coalesced into one refresh. */
(function(){
'use strict';
let timer=null,refreshing=false,pending=false;
const dirtyStores=new Set();
const TOP=new Set(['dashboard','products','customers','visits','quotes','orders','production','deliveries','settings']);
const DEPS={
  dashboard:new Set(['products','customers','quotes','orders','deliveries','visits','productionJobs','inventoryBalances']),
  products:new Set(['products','inventoryBalances','inventoryTransactions','importMappings']),
  customers:new Set(['customers','orders','activities','visits']),
  visits:new Set(['customers','orders','visits','activities']),
  quotes:new Set(['quotes','customers','products']),
  orders:new Set(['orders','customers','products','quotes']),
  production:new Set(['orders','products','inventoryBalances','inventoryTransactions','productionJobs','deliveries']),
  deliveries:new Set(['deliveries','orders','customers']),
  settings:new Set()
};
function route(){
  const authority=window.VUNavigationAuthority;
  if(authority?.current)return authority.current();
  return document.querySelector('.bottom-nav button.active')?.dataset?.route||'dashboard';
}
function editing(){const a=document.activeElement;return !!a&&['INPUT','TEXTAREA','SELECT'].includes(a.tagName);}
function dialogOpen(){return !!document.querySelector('dialog[open]');}
function detailOpen(){const back=document.getElementById('backBtn');return !!back&&!back.classList.contains('hidden');}
function relevant(r){const deps=DEPS[r]||new Set();return [...dirtyStores].some(store=>deps.has(store));}
async function refresh(){
  if(refreshing||document.visibilityState!=='visible'||editing()||dialogOpen()||detailOpen())return false;
  const r=route();
  if(!TOP.has(r)||typeof window.navigate!=='function'){dirtyStores.clear();return true}
  if(!relevant(r)){dirtyStores.clear();return true}
  refreshing=true;const y=window.scrollY;
  try{
    await window.navigate(r);
    requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));
    dirtyStores.clear();
    return true;
  }finally{refreshing=false;}
}
function schedule(store){
  if(store)dirtyStores.add(store);
  pending=true;clearTimeout(timer);
  timer=setTimeout(async()=>{if(!pending)return;pending=false;if(!await refresh())pending=true;},900);
}
function remoteWrite(store){return window.VUSyncSuspendDepth>0&&window.VU_SYNCABLE_STORES?.has(store);}
if(typeof window.VUDbRawPut==='function'&&!window.VUDbRawPut.__vuSharedRefresh){
  const base=window.VUDbRawPut;
  const wrapped=async function(store,value){const remote=remoteWrite(store);const result=await base(store,value);if(remote)schedule(store);return result;};
  wrapped.__vuSharedRefresh=true;window.VUDbRawPut=wrapped;
}
if(typeof window.VUDbRawDelete==='function'&&!window.VUDbRawDelete.__vuSharedRefresh){
  const base=window.VUDbRawDelete;
  const wrapped=async function(store,id){const remote=remoteWrite(store);const result=await base(store,id);if(remote)schedule(store);return result;};
  wrapped.__vuSharedRefresh=true;window.VUDbRawDelete=wrapped;
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&pending)schedule();});
window.addEventListener('focus',()=>{if(pending)schedule();});
window.VUSharedRefresh={version:'9.0.68',schedule,refresh,dirtyStores};
})();