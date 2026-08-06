const APP_VERSION="1.0 Alpha 7.8.4";

function applyDisplayedVersion(){
  document.querySelectorAll("p,strong,span,div").forEach(element=>{
    if(element.children.length)return;
    const text=element.textContent||"";
    if(/1\.0 Alpha 7\.\d+\.\d+/.test(text)){
      element.textContent=text.replace(/1\.0 Alpha 7\.\d+\.\d+/,APP_VERSION);
    }
  });
}

const versionObserver=new MutationObserver(applyDisplayedVersion);
versionObserver.observe(document.documentElement,{childList:true,subtree:true});
applyDisplayedVersion();

if("serviceWorker" in navigator){
  let refreshing=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(refreshing)return;
    refreshing=true;
    location.reload();
  });

  window.addEventListener("load",async()=>{
    try{
      const registration=await navigator.serviceWorker.register("sw.js",{updateViaCache:"none"});
      await registration.update();
      if(registration.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"});
      registration.addEventListener("updatefound",()=>{
        const worker=registration.installing;
        if(!worker)return;
        worker.addEventListener("statechange",()=>{
          if(worker.state==="installed"&&navigator.serviceWorker.controller){
            worker.postMessage({type:"SKIP_WAITING"});
          }
        });
      });
    }catch(error){
      console.warn("App update check failed",error);
    }
  });
}
