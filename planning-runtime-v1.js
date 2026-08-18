/* Vorster Planning Hub 3.0.0 — minimal order-only runtime. */
(function(){
'use strict';
const BUILD='PLANNING-HUB-3.0.0';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
Object.assign(window,{
 main:$('#main'),
 pageTitle:$('#pageTitle'),
 backBtn:$('#backBtn'),
 esc,
 notify:m=>{const t=$('#toast');if(!t)return;t.textContent=String(m??'');t.hidden=false;clearTimeout(window.__planningToast);window.__planningToast=setTimeout(()=>t.hidden=true,2200)}
});

async function route(name){
 try{
  if(name==='orders')return await VUOrderDiary.open();
  if(name==='calendar'||name==='delivery-calendar')return await VUOrderPlanningHub.openCalendar();
  return await VUOrderPlanningHub.renderHome();
 }catch(err){
  console.error('Planning route failed',name,err);
  window.notify?.(`Could not open ${name||'home'}: ${err?.message||err}`);
 }
}
window.navigate=route;

function bindShell(){
 const theme=$('#themeBtn');
 if(localStorage.getItem('planning-theme')==='dark')document.documentElement.setAttribute('data-dark','');
 theme?.addEventListener('click',()=>{
  const dark=document.documentElement.toggleAttribute('data-dark');
  localStorage.setItem('planning-theme',dark?'dark':'light');
 });
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-fos-action]');
  if(!b)return;
  const action=b.dataset.fosAction;
  if(!['orders','delivery-calendar','calendar','dashboard','home'].includes(action))return;
  e.preventDefault();e.stopPropagation();route(action);
 },true);
}

async function registerServiceWorker(){
 if(!('serviceWorker' in navigator))return;
 try{
  const reg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
  await reg.update();
  if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
 }catch(err){console.warn('Planning Hub update check failed',err)}
}

async function boot(){
 const build=$('#runtimeBuild');if(build)build.textContent=BUILD;
 await openDB();
 await VUOrderDiary.seedKnownOrders();
 bindShell();
 await registerServiceWorker();
 await route('home');
 $('#splash')?.remove();
 $('#app')?.classList.remove('hidden');
}

window.addEventListener('DOMContentLoaded',()=>boot().catch(err=>{
 console.error(err);
 document.body.insertAdjacentHTML('afterbegin',`<div class="fatal">Planning Hub could not start.<br><small>${esc(err?.message||err)}</small></div>`);
}),{once:true});
window.VUPlanningRuntime={version:BUILD};
})();