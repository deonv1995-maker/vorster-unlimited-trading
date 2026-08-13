/* V9.4.4 — one navigation owner without blanking or animated page movement.
   Pages render in one serialized transaction. The workspace is never hidden, and route changes
   finish at the top with instant scroll so legacy smooth-scroll calls cannot keep moving the page. */
(function(){
'use strict';
const TITLES={dashboard:'Dashboard',products:'Products',customers:'Customers',visits:'Order Intelligence',quotes:'Quotes',orders:'Orders',production:'Operations',deliveries:'Deliveries',settings:'Settings'};
const HANDLERS={dashboard:'dashboard',products:'productsPage',customers:'customersPage',visits:'visitsPage',quotes:'quotesPage',orders:'ordersPage',production:'productionPage',deliveries:'deliveriesPage',settings:'settingsPage'};
let current='dashboard',dispatching=false,refreshing=false,backgroundSyncStarted=false,pendingRoute='',transaction=false;
const nativeScrollTo=window.scrollTo.bind(window);
function setNav(name){document.querySelectorAll('.bottom-nav button[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===name));}
function handlerFor(name){const fn=window[HANDLERS[name]];return typeof fn==='function'?fn:null;}
function setBusy(on){const h=document.getElementById('main');if(!h)return;if(on){h.dataset.vuNavigationBusy='1';h.setAttribute('aria-busy','true');h.style.pointerEvents='none'}else{delete h.dataset.vuNavigationBusy;h.removeAttribute('aria-busy');h.style.pointerEvents=''}}
function prepareChrome(name){setNav(name);const back=document.getElementById('backBtn');if(back)back.classList.add('hidden');const title=document.getElementById('pageTitle');if(title)title.textContent=TITLES[name]||'Vorster Unlimited Trading';}
async function renderRoute(name,{refresh=false}={}){const fn=handlerFor(name);if(!fn)throw new Error(`Current page handler is unavailable: ${name}`);if(refresh)refreshing=true;else dispatching=true;try{await fn();}finally{if(refresh)refreshing=false;else dispatching=false;}}
function emitRendered(name,refresh=false){try{window.dispatchEvent(new CustomEvent('vu:page-rendered',{detail:{route:name,refresh}}))}catch{}}
function snapTop(){try{nativeScrollTo({top:0,left:0,behavior:'auto'})}catch{nativeScrollTo(0,0)}}
async function authoritativeNavigate(name){
  const requested=HANDLERS[name]?name:'dashboard';
  if(requested===current&&!dispatching&&!refreshing&&!transaction)return true;
  if(dispatching||refreshing||transaction){pendingRoute=requested;return false;}
  transaction=true;setBusy(true);
  try{
    let next=requested;
    while(next){pendingRoute='';current=next;prepareChrome(next);await renderRoute(next);const queued=pendingRoute;next=queued&&queued!==current?queued:'';}
    snapTop();emitRendered(current,false);return true;
  }finally{transaction=false;setBusy(false);}
}
async function refreshCurrent(options={}){
  if(options?.force!==true)return false;
  if(dispatching||refreshing||transaction)return false;
  const name=current;refreshing=true;setBusy(true);
  try{const fn=handlerFor(name);if(!fn)return false;await fn();emitRendered(name,true);return true;}finally{refreshing=false;setBusy(false);}
}
window.navigate=authoritativeNavigate;try{navigate=authoritativeNavigate}catch{}
document.querySelectorAll('.bottom-nav button[data-route]').forEach(b=>{b.onclick=()=>authoritativeNavigate(b.dataset.route)});
function startBackgroundSharedSync(){if(backgroundSyncStarted)return;backgroundSyncStarted=true;const shared=window.VUSharedData;if(!shared?.enabled?.()||typeof shared.syncNow!=='function')return;Promise.resolve().then(()=>shared.syncNow({quiet:true})).catch(error=>console.warn('Background shared-data sync',error));}
window.VUFinalizeInitialPage=async function(){current='';await authoritativeNavigate('dashboard');startBackgroundSharedSync();};
window.VUNavigationAuthority={version:'9.4.4',navigate:authoritativeNavigate,refreshCurrent,current:()=>current,isDispatching:()=>dispatching,isRefreshing:()=>refreshing,isBusy:()=>dispatching||refreshing||transaction,pending:()=>pendingRoute};
})();