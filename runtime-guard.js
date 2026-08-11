/* V9.0.77 — service-worker registration guard.
   Legacy app.js still attempts an unversioned sw.js registration very early. Ignore only that call.
   The final loader's versioned sw.js?v=<build> registration is allowed through normally. */
(function installRuntimeGuard(){
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