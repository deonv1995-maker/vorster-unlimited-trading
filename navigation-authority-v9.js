/* V9.0.77 — one serialized navigation/page authority.
   Only one page renderer may own the DOM at a time. The latest navigation request is queued
   while a page is rendering. Shared-data refresh uses refreshCurrent() and never fakes navigation. */
(function(){
'use strict';
const TITLES={dashboard:'Dashboard',products:'Products',customers:'Customers',visits:'Order Intelligence',quotes:'Quotes',orders:'Orders',production:'Operations',deliveries:'Deliveries',settings:'Settings'};
const HANDLERS={dashboard:'dashboard',products:'productsPage',customers:'customersPage',visits:'visitsPage',quotes:'quotesPage',orders:'ordersPage',production:'productionPage',deliveries:'deliveriesPage',settings:'settingsPage'};
let current='dashboard',dispatching=false,refreshing=false,backgroundSyncStarted=false,pendingRoute='';
function setNav(name){document.querySelectorAll('.bottom-nav button[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===name));}
function handlerFor(name){const fn=window[HANDLERS[name]];return typeof fn==='function'?fn:null;}
async function runRoute(name,{refresh=false}={}){
  const fn=handlerFor(name);if(!fn)throw new Error(`Current page handler is unavailable: ${name}`);
  if(refresh)refreshing=true;else dispatching=true;
  try{await fn();}finally{if(refresh)refreshing=false;else dispatching=false;}
}
async function authoritativeNavigate(name){
  const next=HANDLERS[name]?name:'dashboard';
  if(dispatching||refreshing){pendingRoute=next;return false;}
  current=next;pendingRoute='';setNav(next);
  const back=document.getElementById('backBtn');if(back)back.classList.add('hidden');
  const title=document.getElementById('pageTitle');if(title)title.textContent=TITLES[next]||'Vorster Unlimited Trading';
  await runRoute(next);
  if(pendingRoute){const queued=pendingRoute;pendingRoute='';if(queued!==current)return authoritativeNavigate(queued);}
  return true;
}
async function refreshCurrent(){
  if(dispatching||refreshing)return false;
  const name=current;
  await runRoute(name,{refresh:true});
  if(pendingRoute){const queued=pendingRoute;pendingRoute='';if(queued!==current)await authoritativeNavigate(queued);}
  return true;
}
window.navigate=authoritativeNavigate;try{navigate=authoritativeNavigate}catch{}
document.querySelectorAll('.bottom-nav button[data-route]').forEach(b=>{b.onclick=()=>authoritativeNavigate(b.dataset.route)});
function startBackgroundSharedSync(){
  if(backgroundSyncStarted)return;backgroundSyncStarted=true;
  const shared=window.VUSharedData;if(!shared?.enabled?.()||typeof shared.syncNow!=='function')return;
  Promise.resolve().then(()=>shared.syncNow({quiet:true})).catch(error=>console.warn('Background shared-data sync',error));
}
window.VUFinalizeInitialPage=async function(){await authoritativeNavigate('dashboard');startBackgroundSharedSync();};
window.VUNavigationAuthority={version:'9.0.77',navigate:authoritativeNavigate,refreshCurrent,current:()=>current,isDispatching:()=>dispatching,isRefreshing:()=>refreshing,isBusy:()=>dispatching||refreshing,pending:()=>pendingRoute};
})();