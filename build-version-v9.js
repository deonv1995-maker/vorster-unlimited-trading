/* Build label follows the authoritative loader build and loads late operational extensions safely. */
(function(){
'use strict';
const BUILD=String(window.VU_BUILD||'V9.0.99');
window.VU_BUILD=BUILD;
function applyBuildLabel(){
  const runtime=document.getElementById('runtimeBuild');
  if(runtime)runtime.textContent=BUILD;
  document.querySelectorAll('[data-vu-build]').forEach(el=>el.textContent=BUILD);
}
function loadScriptOnce(src,marker,errorText){
  if(document.querySelector(`script[${marker}]`))return;
  const s=document.createElement('script');
  s.src=src;s.async=false;s.setAttribute(marker,'1');
  s.onerror=()=>console.error(errorText);
  document.body.appendChild(s);
}
function loadOperationalExtensions(){
  if(!window.VUDailyDispatchCapture)loadScriptOnce('daily-dispatch-capture-v9.js?v=9.1.02','data-vu-daily-dispatch','Could not load order-based Delivery & Collection read-in');
  if(!window.VUProductionSetDeleteAuthority)loadScriptOnce('production-set-delete-authority-v9.js?v=9.1.03','data-vu-production-set-delete','Could not load production set delete authority');
  if(!window.VUPaintingWorksheetRecovery)loadScriptOnce('painting-worksheet-recovery-v9.js?v=9.1.04','data-vu-paint-recovery','Could not load reliable Painting worksheet recovery');
  loadScriptOnce('painting-full-order-authority-v9.js?v=9.1.05','data-vu-paint-full-order','Could not load full-order Painting authority');
}
applyBuildLabel();
loadOperationalExtensions();
window.VUApplyBuildLabel=applyBuildLabel;
})();