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
function loadOperationalExtension(){
  if(window.VUDailyDispatchCapture||document.querySelector('script[data-vu-daily-dispatch]'))return;
  const s=document.createElement('script');
  s.src='daily-dispatch-capture-v9.js?v=9.1.00';
  s.async=false;
  s.dataset.vuDailyDispatch='1';
  s.onerror=()=>console.error('Could not load Daily Delivery & Collection read-in');
  document.body.appendChild(s);
}
applyBuildLabel();
loadOperationalExtension();
window.VUApplyBuildLabel=applyBuildLabel;
})();