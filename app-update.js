const APP_VERSION="2.0 Unified 1.0.1";

function applyDisplayedVersion(){
  document.querySelectorAll("p,strong,span,div").forEach(element=>{
    if(element.children.length)return;
    const text=element.textContent||"";
    const versionPattern=/(?:1\.0 Alpha 7\.\d+\.\d+|2\.0 Foundation \d+\.\d+\.\d+|2\.0 Unified \d+\.\d+\.\d+)/;
    if(versionPattern.test(text))element.textContent=text.replace(versionPattern,APP_VERSION);
  });
}

const versionObserver=new MutationObserver(applyDisplayedVersion);
versionObserver.observe(document.documentElement,{childList:true,subtree:true});
applyDisplayedVersion();

// GitHub Pages is the current delivery source. Remove old PWA workers and caches
// so each published release loads directly from the deployed files.
window.addEventListener("load",async()=>{
  try{
    if("serviceWorker" in navigator){
      const registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration=>registration.unregister()));
    }
    if("caches" in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(key=>caches.delete(key)));
    }
  }catch(error){
    console.warn("Cache cleanup failed",error);
  }
});
