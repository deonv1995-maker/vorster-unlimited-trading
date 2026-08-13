/* V9.4.3 — order-change recalculation without UI redraws. */
(function(){
'use strict';
if(window.VUOrderDataRecalc)return;
let timer=0,running=false,again=false;
function changedOrders(e){const d=e?.detail||{};return d.store==='orders'||d.stores?.includes?.('orders')||d.changes?.some?.(x=>x?.store==='orders')}
async function run(){if(running){again=true;return}running=true;try{window.VUOrderProgress?.invalidate?.();if(typeof window.buildOptimizedOrderJobs==='function')await window.buildOptimizedOrderJobs();await window.VUBusinessOutcomeOptimizer?.build?.()}catch(e){console.warn('Order data recalculation',e)}finally{running=false;if(again){again=false;schedule()}}}
function schedule(){clearTimeout(timer);timer=setTimeout(run,450)}
window.addEventListener('vu:local-mutation',e=>{if(changedOrders(e))schedule()});
window.addEventListener('vu:shared-data-dirty',e=>{if(e?.detail?.stores?.includes?.('orders'))schedule()});
window.VUOrderDataRecalc={version:'9.4.3',schedule,run};
})();