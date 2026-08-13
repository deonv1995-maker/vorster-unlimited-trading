/* V9.1.07 — authoritative downstream recalculation after order changes/imports.
   Any local order write invalidates cached progress and debounces one optimiser rebuild/refresh,
   so imported order updates immediately flow into Painting, completion %, worksheets and priorities. */
(function(){
'use strict';
if(window.VUOrderUpdateRecalcAuthority)return;
let timer=0,running=false,pending=false;
async function recalc(){
  if(running){pending=true;return}
  running=true;
  try{
    try{window.VUOrderProgress?.invalidate?.()}catch{}
    try{if(typeof window.buildOptimizedOrderJobs==='function')await window.buildOptimizedOrderJobs()}catch(e){console.warn('Order-change optimiser rebuild',e)}
    try{if(window.VUNavigationAuthority?.refreshCurrent)await window.VUNavigationAuthority.refreshCurrent()}catch(e){console.warn('Order-change screen refresh',e)}
  }finally{
    running=false;
    if(pending){pending=false;schedule()}
  }
}
function schedule(){clearTimeout(timer);timer=setTimeout(recalc,450)}
window.addEventListener('vu:local-mutation',e=>{if(e?.detail?.store==='orders')schedule()});
window.addEventListener('vu:shared-data-refreshed',schedule);
window.VUOrderUpdateRecalcAuthority={version:'9.1.07',schedule,recalc};
})();
