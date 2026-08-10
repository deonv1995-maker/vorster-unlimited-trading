/* V9.0.49 — one final navigation/page authority.
   Startup is local-first: the current IndexedDB snapshot renders immediately and shared data
   refreshes in the background. Network/shared-data availability must never block the app shell. */
(function(){
'use strict';

const TITLES={
  dashboard:'Dashboard',products:'Products',customers:'Customers',visits:'Order Intelligence',
  quotes:'Quotes',orders:'Orders',production:'Operations',deliveries:'Deliveries',settings:'Settings'
};
const HANDLERS={
  dashboard:'dashboard',products:'productsPage',customers:'customersPage',visits:'visitsPage',
  quotes:'quotesPage',orders:'ordersPage',production:'productionPage',deliveries:'deliveriesPage',settings:'settingsPage'
};
let current='dashboard';
let dispatching=false;
let backgroundSyncStarted=false;

function setNav(name){
  document.querySelectorAll('.bottom-nav button[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===name));
}
function handlerFor(name){
  const fn=window[HANDLERS[name]];
  return typeof fn==='function'?fn:null;
}
async function authoritativeNavigate(name){
  const next=HANDLERS[name]?name:'dashboard';
  if(dispatching&&next===current)return;
  current=next;
  setNav(next);
  const back=document.getElementById('backBtn');if(back)back.classList.add('hidden');
  const title=document.getElementById('pageTitle');if(title)title.textContent=TITLES[next]||'Vorster Unlimited Trading';
  const fn=handlerFor(next);
  if(!fn)throw new Error(`Current page handler is unavailable: ${next}`);
  dispatching=true;
  try{await fn();}finally{dispatching=false;}
}

window.navigate=authoritativeNavigate;
try{navigate=authoritativeNavigate}catch{}
document.querySelectorAll('.bottom-nav button[data-route]').forEach(b=>{b.onclick=()=>authoritativeNavigate(b.dataset.route)});

function startBackgroundSharedSync(){
  if(backgroundSyncStarted)return;
  backgroundSyncStarted=true;
  const shared=window.VUSharedData;
  if(!shared?.enabled?.()||typeof shared.syncNow!=='function')return;

  Promise.resolve()
    .then(()=>shared.syncNow({quiet:true}))
    .then(()=>{
      /* Only refresh a top-level dashboard that the user is still viewing. Never pull the user
         away from another page or detail/edit workflow when background sync finishes. */
      if(current==='dashboard'&&!dispatching) return authoritativeNavigate('dashboard');
    })
    .catch(error=>console.warn('Background shared-data refresh',error));
}

window.VUFinalizeInitialPage=async function(){
  /* Local-first render: no Supabase/network promise is awaited before opening the app. */
  await authoritativeNavigate('dashboard');
  startBackgroundSharedSync();
};

window.VUNavigationAuthority={version:'9.0.49',navigate:authoritativeNavigate,current:()=>current};
})();
