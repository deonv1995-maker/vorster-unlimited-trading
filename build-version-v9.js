/* V9.0.95 — build label follows the authoritative loader build. */
(function(){
'use strict';
const BUILD=String(window.VU_BUILD||'V9.0.95');
window.VU_BUILD=BUILD;
function applyBuildLabel(){
  const runtime=document.getElementById('runtimeBuild');
  if(runtime)runtime.textContent=BUILD;
  document.querySelectorAll('[data-vu-build]').forEach(el=>el.textContent=BUILD);
}
applyBuildLabel();
window.VUApplyBuildLabel=applyBuildLabel;
})();