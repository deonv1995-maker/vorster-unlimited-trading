/* V9.0.67 — one final navigation/page authority.
   Startup is local-first. Shared sync never owns navigation or redraw; remote-data page refresh
   is handled only by shared-refresh-v9.js. */
(function(){
'use strict';
const TITLES={dashboard:'Dashboard',products:'Products',customers:'Customers',visits:'Order Intelligence',quotes:'Quotes',orders:'Orders',production:'Operations',deliveries:'Deliveries',settings:'Settings'};
const HANDLERS={dashboard:'dashboard',products:'productsPage',customers:'customersPage',visits:'visitsPage',quotes:'quotesPage',orders:'ordersPage',production:'productionPage',deliveries:'deliveriesPage',settings:'settingsPage'};
let current='dashboard',dispatching=false,backgroundSyncStarted=false;
function setNav(name){document.querySelectorAll('.bottom-nav button[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===name));}
function handlerFor(name){const fn=window[HANDLERS[name]];return typeof fn==='function'?fn:null;}
async function authoritativeNavigate(name){
  const next=HANDLERS[name]?name:'dashboard';
  if(dispatching&&next===current)return;
  current=next;setNav(next);
  const back=document.getElementById('backBtn');if(back)back.classList.add('hidden');
  const title=document.getElementById('pageTitle');if(title)title.textContent=TITLES[next]||'Vorster Unlimited Trading';
  const fn=handlerFor(next);if(!fn)throw new Error(`Current page handler is unavailable: ${next}`);
  dispatching=true;try{await fn();}finally{dispatching=false;}
}
window.navigate=authoritativeNavigate;try{navigate=authoritativeNavigate}catch{}
document.querySelectorAll('.bottom-nav button[data-route]').forEach(b=>{b.onclick=()=>authoritativeNavigate(b.dataset.route)});
function startBackgroundSharedSync(){
  if(backgroundSyncStarted)return;backgroundSyncStarted=true;
  const shared=window.VUSharedData;if(!shared?.enabled?.()||typeof shared.syncNow!=='function')return;
  Promise.resolve().then(()=>shared.syncNow({quiet:true})).catch(error=>console.warn('Background shared-data sync',error));
}
window.VUFinalizeInitialPage=async function(){await authoritativeNavigate('dashboard');startBackgroundSharedSync();};
window.VUNavigationAuthority={version:'9.0.67',navigate:authoritativeNavigate,current:()=>current,isDispatching:()=>dispatching};
})();