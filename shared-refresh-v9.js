/* V9.0.77 — route-aware shared-data UI refresh authority.
   Remote writes are coalesced. Top-level pages refresh only for relevant stores, and refresh uses
   the navigation authority's refreshCurrent() instead of pretending to navigate to the same route. */
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
  production:new Set(['orders','products','inventoryBalances','inventoryTransactions','productionJobs','deliveries','customers']),
  deliveries:new Set(['deliveries','orders','customers','productionJobs']),
  settings:new Set()
};
function route(){const authority=window.VUNavigationAuthority;return authority?.current?.()||document.querySelector('.bottom-nav button.active')?.dataset?.route||'dashboard';}
function editing(){const a=document.activeElement;return !!a&&['INPUT','TEXTAREA','SELECT'].includes(a.tagName);}
function dialogOpen(){return !!document.querySelector('dialog[open]');}
function detailOpen(){const back=document.getElementById('backBtn');return !!back&&!back.classList.contains('hidden');}
function productSetupBusy(){return !!window.VUProductSetupQueue?.isBusy?.();}
function navBusy(){return !!window.VUNavigationAuthority?.isBusy?.();}
function relevant(r){const deps=DEPS[r]||new Set();return [...dirtyStores].some(store=>deps.has(store));}
async function refresh(){
  if(refreshing||document.visibilityState!=='visible'||editing()||dialogOpen()||detailOpen()||productSetupBusy()||navBusy())return false;
  const r=route();if(!TOP.has(r)){dirtyStores.clear();return true}if(!relevant(r)){dirtyStores.clear();return true}
  const authority=window.VUNavigationAuthority;if(typeof authority?.refreshCurrent!=='function')return false;
  refreshing=true;const y=window.scrollY;
  try{const ok=await authority.refreshCurrent();if(!ok)return false;dirtyStores.clear();requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));return true;}
  finally{refreshing=false;}
}
function schedule(store){if(store)dirtyStores.add(store);pending=true;clearTimeout(timer);timer=setTimeout(async()=>{if(!pending)return;pending=false;if(!await refresh())pending=true;},1200);}
function remoteWrite(store){return window.VUSyncSuspendDepth>0&&window.VU_SYNCABLE_STORES?.has(store);}
if(typeof window.VUDbRawPut==='function'&&!window.VUDbRawPut.__vuSharedRefresh){const base=window.VUDbRawPut;const wrapped=async function(store,value){const remote=remoteWrite(store);const result=await base(store,value);if(remote)schedule(store);return result;};wrapped.__vuSharedRefresh=true;window.VUDbRawPut=wrapped;}
if(typeof window.VUDbRawDelete==='function'&&!window.VUDbRawDelete.__vuSharedRefresh){const base=window.VUDbRawDelete;const wrapped=async function(store,id){const remote=remoteWrite(store);const result=await base(store,id);if(remote)schedule(store);return result;};wrapped.__vuSharedRefresh=true;window.VUDbRawDelete=wrapped;}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&pending)schedule();});
window.addEventListener('focus',()=>{if(pending)schedule();});
window.addEventListener('vu:product-setup-state',event=>{if(!event.detail?.busy&&pending)schedule();});
const dialog=document.getElementById('dialog');if(dialog&&!dialog.__vuRefreshClose){dialog.__vuRefreshClose=true;dialog.addEventListener('close',()=>{if(pending)schedule();});}
window.VUSharedRefresh={version:'9.0.77',schedule,refresh,dirtyStores,pending:()=>pending};
})();