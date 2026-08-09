/* V9.0.21 — lightweight build label. No page-wide DOM observer. */
(function(){
'use strict';
const BUILD=String(window.VU_BUILD||'V9.0.21');
window.VU_BUILD=BUILD;
function applyBuildLabel(){
  const runtime=document.getElementById('runtimeBuild');
  if(runtime)runtime.textContent=BUILD;
  document.querySelectorAll('[data-vu-build]').forEach(el=>el.textContent=BUILD);
}
applyBuildLabel();
window.VUApplyBuildLabel=applyBuildLabel;
})();