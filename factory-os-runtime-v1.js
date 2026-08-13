/* Factory OS clean runtime — no legacy dashboard dependency. */
(function(){
'use strict';
const BUILD='FACTORY-OS-2.0.0';
const $=s=>document.querySelector(s);
window.main=$('#main'); window.pageTitle=$('#pageTitle');
window.esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
window.uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
window.money=v=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(Number(v||0));
window.notify=msg=>{const t=$('#toast');if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(window.__fosToast);window.__fosToast=setTimeout(()=>t.hidden=true,2400)};
window.openDialog=html=>{const d=$('#dialog');d.innerHTML=html;d.showModal()};
window.closeDialog=()=>{const d=$('#dialog');if(d?.open)d.close()};
window.addEventListener('keydown',e=>{if(e.key==='Escape')window.closeDialog()});

const routes={
 dashboard:async()=>window.VUFactoryOSHome?.render?.(),
 manufacturing:async()=>window.VUFactoryManufacturing?.open?.(),
 orders:async()=>window.VUFactoryOfficeIntake?.open?.(),
 'order-intake':async()=>window.VUFactoryOfficeIntake?.open?.(),
 painting:async()=>window.VUFactoryManufacturing?.open?.('Painting')
};
window.navigate=async route=>{const fn=routes[route]||routes.dashboard;await fn();document.body.dataset.route=route};
window.dashboard=()=>window.navigate('dashboard');

function bindShell(){
 $('#themeBtn')?.addEventListener('click',()=>{const dark=document.documentElement.toggleAttribute('data-dark');localStorage.setItem('fos-theme',dark?'dark':'light')});
 if(localStorage.getItem('fos-theme')!=='light')document.documentElement.setAttribute('data-dark','');
 $('#backBtn')?.addEventListener('click',()=>window.navigate('dashboard'));
 document.addEventListener('click',e=>{const b=e.target.closest('[data-fos-action]');if(!b)return;const a=b.dataset.fosAction,role=window.VUFactoryOS?.role?.()||'Management';if(a==='manufacturing')return window.VUFactoryManufacturing?.open?.();if(a==='division')return window.VUFactoryManufacturing?.open?.(role);if(a==='painting')return window.VUFactoryManufacturing?.open?.('Painting');if(a==='order-intake'||a==='orders')return window.VUFactoryOfficeIntake?.open?.();if(a==='deliveries'||a==='collections'||a==='stock'||a==='planning')return window.notify(`${b.querySelector('strong')?.textContent||'Section'} is next in the Factory OS build.`)},true);
}

async function boot(){
 const build=$('#runtimeBuild');if(build)build.textContent=BUILD;
 bindShell();
 await window.navigate('dashboard');
 $('#splash')?.remove();$('#app')?.classList.remove('hidden');
 if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('sw.js?v=2.0.0',{updateViaCache:'none'})}catch(e){console.warn('Service worker registration failed',e)}}
}
window.addEventListener('DOMContentLoaded',()=>boot().catch(e=>{console.error(e);document.body.insertAdjacentHTML('afterbegin','<div class="fatal">Factory OS could not start. No data was changed.</div>')}),{once:true});
window.VUFactoryRuntime={version:BUILD};
})();