/* V9.5.0 — deterministic startup with standalone Home authority.
   Legacy app.js may still define/render its old dashboard while modules load, but it never owns the
   first visible page. Before initial navigation, load dashboard-standalone-v95.js and then render once. */
(function installRuntimeGuard(){
  try{
    document.documentElement.classList.add('vu-booting');
    if(!document.getElementById('vuBootGateStyle')){
      const style=document.createElement('style');
      style.id='vuBootGateStyle';
      style.textContent='html.vu-booting #app{visibility:hidden!important;pointer-events:none!important}';
      document.head.appendChild(style);
    }
  }catch{}

  let released=false,finalizing=false,dashboardReady=false;
  window.VUReleaseBootGate=function(){if(released)return;released=true;try{document.documentElement.classList.remove('vu-booting')}catch{}};

  async function ensureStandaloneDashboard(){
    if(dashboardReady||String(window.VUDashboardStandalone?.version||'')==='9.5.0'){dashboardReady=true;return}
    const existing=document.querySelector('script[data-vu-dashboard-standalone]');
    if(existing){await new Promise((resolve,reject)=>{if(existing.dataset.loaded==='1')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true})});dashboardReady=true;return}
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='dashboard-standalone-v95.js?v=9.5.0';s.async=false;s.dataset.vuDashboardStandalone='1';s.onload=()=>{s.dataset.loaded='1';resolve()};s.onerror=reject;document.body.appendChild(s)});
    dashboardReady=String(window.VUDashboardStandalone?.version||'')==='9.5.0';
  }

  async function finalizeInitialPage(){
    if(finalizing||released)return;finalizing=true;
    try{
      await ensureStandaloneDashboard();
      if(typeof window.VUFinalizeInitialPage==='function')await window.VUFinalizeInitialPage();
      else if(window.VUNavigationAuthority?.navigate)await window.VUNavigationAuthority.navigate('dashboard');
      else if(typeof window.dashboard==='function')await window.dashboard();
    }catch(error){console.error('Authoritative initial page failed',error)}
    finally{requestAnimationFrame(()=>window.VUReleaseBootGate?.())}
  }

  window.addEventListener('vu:operational-authorities-ready',()=>{finalizeInitialPage()},{once:true});
  window.addEventListener('vu:page-rendered',event=>{if(event?.detail?.refresh)return;requestAnimationFrame(()=>window.VUReleaseBootGate?.())},{once:true});

  setTimeout(()=>{if(released)return;finalizeInitialPage();setTimeout(()=>window.VUReleaseBootGate?.(),1800)},5000);

  if(!('serviceWorker' in navigator))return;
  const sw=navigator.serviceWorker,original=sw.register.bind(sw);
  try{Object.defineProperty(sw,'register',{configurable:true,value:function guardedRegister(scriptURL,options){const url=String(scriptURL||'');if(url==='sw.js'||url.endsWith('/sw.js'))return Promise.resolve({active:null,installing:null,waiting:null,update:async()=>undefined,unregister:async()=>false,addEventListener:()=>undefined});return original(scriptURL,options)}})}catch(error){console.warn('Could not install service-worker registration guard.',error)}
  window.__vuOriginalServiceWorkerRegister=original;
})();