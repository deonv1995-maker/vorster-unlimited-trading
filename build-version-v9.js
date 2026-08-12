/* V9.0.90 — lightweight build label. */
(function(){
'use strict';
const BUILD='V9.0.90';
window.VU_BUILD=BUILD;
function applyBuildLabel(){const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent=BUILD;document.querySelectorAll('[data-vu-build]').forEach(el=>el.textContent=BUILD);}
applyBuildLabel();window.VUApplyBuildLabel=applyBuildLabel;
})();