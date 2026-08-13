/* V9.1.06 — consolidated runtime build label and late operational authority loader.
   The base app finishes loading first; current operational authorities are then loaded sequentially
   so older modules cannot overwrite the latest Production/Painting/Dispatch behaviour. */
(function(){
'use strict';
const BUILD='V9.1.06';
window.VU_BUILD=BUILD;
function applyBuildLabel(){
  const runtime=document.getElementById('runtimeBuild');
  if(runtime)runtime.textContent=BUILD;
  document.querySelectorAll('[data-vu-build]').forEach(el=>el.textContent=BUILD);
}
function loadScriptOnce(src,marker,errorText){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[${marker}]`);
    if(existing){
      if(existing.dataset.loaded==='1')return resolve();
      existing.addEventListener('load',()=>resolve(),{once:true});
      existing.addEventListener('error',()=>reject(new Error(errorText)),{once:true});
      return;
    }
    const s=document.createElement('script');
    s.src=src;s.async=false;s.setAttribute(marker,'1');
    s.onload=()=>{s.dataset.loaded='1';resolve()};
    s.onerror=()=>{console.error(errorText);reject(new Error(errorText))};
    document.body.appendChild(s);
  });
}
async function waitForBase(){
  const start=Date.now();
  while(Date.now()-start<20000){
    if(window.VUUIStability&&window.VURuntimeAudit&&window.VUDailyFactoryPack&&window.VUPaintedStockInventoryAuthority)return true;
    await new Promise(r=>setTimeout(r,60));
  }
  console.warn('V9.1.06 base-runtime wait timed out; loading operational authorities anyway.');
  return false;
}
async function loadOperationalExtensions(){
  await waitForBase();
  try{
    await loadScriptOnce('daily-dispatch-capture-v9.js?v=9.1.02','data-vu-daily-dispatch','Could not load order-based Delivery & Collection read-in');
    await loadScriptOnce('production-set-delete-authority-v9.js?v=9.1.03','data-vu-production-set-delete','Could not load production-set delete authority');
    await loadScriptOnce('painting-worksheet-recovery-v9.js?v=9.1.04','data-vu-paint-recovery','Could not load Painting worksheet recovery');
    await loadScriptOnce('painting-full-order-authority-v9.js?v=9.1.05','data-vu-paint-full-order','Could not load full-order Painting authority');
    applyBuildLabel();
    window.dispatchEvent(new CustomEvent('vu:operational-authorities-ready',{detail:{build:BUILD}}));
    setTimeout(()=>{try{window.VURuntimeAudit?.audit?.()}catch{}},0);
  }catch(e){
    console.error('V9.1.06 operational authority load failed',e);
    const main=document.getElementById('main');
    if(main&&!document.getElementById('vuOperationalLoadWarning'))main.insertAdjacentHTML('afterbegin','<div id="vuOperationalLoadWarning" class="card" style="border-color:#b45c55"><b>Operational update did not load completely.</b><br><small>Refresh once while online before capturing factory results.</small></div>');
  }
}
applyBuildLabel();
loadOperationalExtensions();
window.VUApplyBuildLabel=applyBuildLabel;
window.VUOperationalBuild={version:'9.1.06',ready:()=>!!window.VUPaintingFullOrderAuthority&&!!window.VUDailyDispatchCapture&&!!window.VUProductionSetDeleteAuthority};
})();