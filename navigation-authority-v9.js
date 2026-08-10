/* V9.0.48 — one final navigation/page authority.
   Older runtime modules may replace page functions as the app evolves. The original app.js
   router can retain references to earlier implementations, so this final router deliberately
   dispatches through window.* every time. This prevents a legacy page rendering first and the
   current page appearing only after a second navigation. No business data is mutated here. */
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

/* Initial render happens only through the final authority. Shared data gets one chance to finish
   first; if offline, the current local IndexedDB snapshot still renders normally. */
window.VUFinalizeInitialPage=async function(){
  const main=document.getElementById('main');
  const shared=window.VUSharedData;
  if(shared?.enabled?.()){
    if(main)main.innerHTML='<section class="card"><h2>Refreshing business data…</h2><p class="muted">Checking the shared Vorster Unlimited workspace before opening the dashboard.</p></section>';
    try{await shared.syncNow({quiet:true});}catch(error){console.warn('Initial shared-data refresh',error)}
  }
  await authoritativeNavigate('dashboard');
};

window.VUNavigationAuthority={version:'9.0.48',navigate:authoritativeNavigate,current:()=>current};
})();
