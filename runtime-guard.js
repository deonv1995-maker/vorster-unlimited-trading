/* Version 8 runtime guard: disable legacy service-worker caching without changing app data. */
(function installRuntimeGuard(){
  if(!('serviceWorker' in navigator))return;

  const serviceWorker=navigator.serviceWorker;
  const originalRegister=serviceWorker.register.bind(serviceWorker);

  try{
    Object.defineProperty(serviceWorker,'register',{
      configurable:true,
      value:async function disabledServiceWorkerRegistration(){
        console.info('Service-worker registration disabled for Version 8.');
        return {
          active:null,
          installing:null,
          waiting:null,
          unregister:async()=>true,
          update:async()=>undefined,
          addEventListener:()=>undefined
        };
      }
    });
  }catch(error){
    console.warn('Could not replace service-worker registration; cleaning registrations instead.',error);
  }

  window.__vuOriginalServiceWorkerRegister=originalRegister;
})();
