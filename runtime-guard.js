/* V9.4.5 — startup gate + service-worker registration guard.
   Legacy app.js still performs an early dashboard render. Keep the app visually gated until the
   final navigation authority has rendered the authoritative first page, so legacy dashboard data
   can never flash on screen during startup. */
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
  window.VUReleaseBootGate=function(){
    try{document.documentElement.classList.remove('vu-booting')}catch{}
  };

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