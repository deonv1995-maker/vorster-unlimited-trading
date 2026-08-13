/* V9.4.6 — deterministic startup gate + service-worker registration guard.
   Legacy app.js may render its old dashboard during module loading, but that output remains hidden.
   Once the operational runtime is ready, explicitly run the authoritative initial page, then reveal.
   A safety timeout guarantees the app can never remain permanently hidden. */
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

  let released=false,finalizing=false;
  window.VUReleaseBootGate=function(){
    if(released)return;
    released=true;
    try{document.documentElement.classList.remove('vu-booting')}catch{}
  };

  async function finalizeInitialPage(){
    if(finalizing||released)return;
    finalizing=true;
    try{
      if(typeof window.VUFinalizeInitialPage==='function'){
        await window.VUFinalizeInitialPage();
      }else if(window.VUNavigationAuthority?.navigate){
        await window.VUNavigationAuthority.navigate('dashboard');
      }else if(typeof window.dashboard==='function'){
        await window.dashboard();
      }
    }catch(error){
      console.error('Authoritative initial page failed',error);
    }finally{
      requestAnimationFrame(()=>window.VUReleaseBootGate?.());
    }
  }

  window.addEventListener('vu:page-rendered',event=>{
    if(event?.detail?.refresh)return;
    requestAnimationFrame(()=>window.VUReleaseBootGate?.());
  },{once:true});

  window.addEventListener('vu:operational-authorities-ready',()=>{
    finalizeInitialPage();
  },{once:true});

  // Never allow a module failure to strand the user on a blank screen.
  setTimeout(()=>{
    if(released)return;
    if(window.VUNavigationAuthority||typeof window.dashboard==='function')finalizeInitialPage();
    setTimeout(()=>window.VUReleaseBootGate?.(),1500);
  },4500);

  if(!('serviceWorker' in navigator))return;
  const sw=navigator.serviceWorker,original=sw.register.bind(sw);
  try{
    Object.defineProperty(sw,'register',{configurable:true,value:function guardedRegister(scriptURL,options){
      const url=String(scriptURL||'');
      if(url==='sw.js'||url.endsWith('/sw.js')){
        console.info('Ignored legacy unversioned service-worker registration.');
        return Promise.resolve({active:null,installing:null,waiting:null,update:async()=>undefined,unregister:async()=>false,addEventListener:()=>undefined});
      }
      return original(scriptURL,options);
    }});
  }catch(error){console.warn('Could not install service-worker registration guard.',error);}
  window.__vuOriginalServiceWorkerRegister=original;
})();