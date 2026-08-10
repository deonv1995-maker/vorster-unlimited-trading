/* V9.0.47 — authoritative page freshness coordinator.
   The first visible top-level page now waits for the enabled shared-data sync to finish
   before showing business counts. This prevents stale/default zero values from being shown
   while the cloud snapshot is still being pulled into IndexedDB.
   Also refreshes visible top-level pages after later remote writes.
   Does not mutate business records and never refreshes while the user is editing a field/dialog. */
(function(){
'use strict';

let refreshTimer=null;
let refreshing=false;
let remoteWriteSeen=false;
let initialSyncComplete=false;

const TOP_LEVEL_TITLES={
  dashboard:new Set(['Dashboard']),
  products:new Set(['Products']),
  customers:new Set(['Customers']),
  visits:new Set(['Order Intelligence','Order intelligence']),
  quotes:new Set(['Quotes']),
  orders:new Set(['Orders']),
  production:new Set(['Production','Operations']),
  deliveries:new Set(['Deliveries']),
  settings:new Set(['Settings'])
};

function currentRoute(){
  return document.querySelector('.bottom-nav button.active')?.dataset?.route||'dashboard';
}
function isTopLevel(routeName=currentRoute()){
  const title=String(document.getElementById('pageTitle')?.textContent||'').trim();
  return !!TOP_LEVEL_TITLES[routeName]?.has(title);
}
function isEditing(){
  const active=document.activeElement;
  return !!active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
}
function dialogOpen(){return !!document.querySelector('dialog[open]')}

async function refreshVisibleTopLevel(){
  if(refreshing||document.visibilityState!=='visible'||isEditing()||dialogOpen())return false;
  const routeName=currentRoute();
  if(!isTopLevel(routeName)||typeof navigate!=='function')return false;
  refreshing=true;
  const y=window.scrollY;
  try{
    await navigate(routeName);
    requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));
    return true;
  }finally{refreshing=false}
}
function scheduleRemoteRefresh(){
  remoteWriteSeen=true;
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{
    if(!remoteWriteSeen)return;
    remoteWriteSeen=false;
    const refreshed=await refreshVisibleTopLevel();
    if(!refreshed)remoteWriteSeen=true;
  },350);
}

/* Shared-data pull writes directly through the raw DB helpers while sync is suspended.
   Wrap those exact persistence boundaries so the page refresh occurs only after remote data
   has actually landed in IndexedDB, not merely when a network request completes. */
if(typeof window.VUDbRawPut==='function'&&!window.VUDbRawPut.__vuFreshnessWrapped){
  const basePut=window.VUDbRawPut;
  const wrapped=async function(store,value){
    const remote=window.VUSyncSuspendDepth>0&&window.VU_SYNCABLE_STORES?.has(store);
    const result=await basePut(store,value);
    if(remote)scheduleRemoteRefresh();
    return result;
  };
  wrapped.__vuFreshnessWrapped=true;
  window.VUDbRawPut=wrapped;
}
if(typeof window.VUDbRawDelete==='function'&&!window.VUDbRawDelete.__vuFreshnessWrapped){
  const baseDelete=window.VUDbRawDelete;
  const wrapped=async function(store,id){
    const remote=window.VUSyncSuspendDepth>0&&window.VU_SYNCABLE_STORES?.has(store);
    const result=await baseDelete(store,id);
    if(remote)scheduleRemoteRefresh();
    return result;
  };
  wrapped.__vuFreshnessWrapped=true;
  window.VUDbRawDelete=wrapped;
}

async function performInitialSharedSync(){
  if(initialSyncComplete)return;
  initialSyncComplete=true;
  const shared=window.VUSharedData;
  if(!shared?.enabled?.()||typeof shared.syncNow!=='function'||!navigator.onLine)return;

  const appMain=document.getElementById('main');
  if(appMain){
    appMain.innerHTML='<section class="card"><div class="section-head"><div><div class="step-label">Shared business data</div><h2>Refreshing business data…</h2><p class="muted">Loading the latest products, customers, orders, production and delivery status before showing totals.</p></div></div></section>';
  }

  try{
    const result=await shared.syncNow({quiet:true});
    /* syncNow can only return busy when another sync was already running. That should be rare
       during boot, but wait briefly for that pass to settle rather than immediately rendering
       a stale snapshot. */
    if(result?.busy){
      const started=Date.now();
      while(Date.now()-started<12000){
        await new Promise(r=>setTimeout(r,180));
        const retry=await shared.syncNow({quiet:true});
        if(!retry?.busy)break;
      }
    }
  }catch(error){
    console.warn('Initial shared-data freshness sync failed; using local snapshot',error);
  }
}

/* Called by the script loader only after every runtime module has installed its final wrappers.
   The cloud sync happens BEFORE the final page render, so users never see temporary zero totals
   when the current business snapshot is available remotely. */
window.VUFinalizeInitialPage=async function(){
  await performInitialSharedSync();
  const routeName=currentRoute();
  if(typeof navigate==='function')await navigate(routeName||'dashboard');
};
window.VURefreshVisiblePage=refreshVisibleTopLevel;
window.VUEnsureInitialSharedData=performInitialSharedSync;

/* If a remote refresh was deferred because a form/dialog was active, retry when it becomes safe. */
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&remoteWriteSeen)scheduleRemoteRefresh();
});
window.addEventListener('focus',()=>{if(remoteWriteSeen)scheduleRemoteRefresh()});

})();
