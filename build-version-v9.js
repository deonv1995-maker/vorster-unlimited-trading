/* V9.3.2 — cleaned operational runtime + Digital Factory phase 3 manager dashboard. */
(function(){
'use strict';
const BUILD='V9.3.2';
window.VU_BUILD=BUILD;
function applyBuildLabel(){const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent=BUILD;document.querySelectorAll('[data-vu-build]').forEach(el=>el.textContent=BUILD)}
function loadScriptOnce(src,marker){return new Promise((resolve,reject)=>{const existing=document.querySelector(`script[${marker}]`);if(existing){if(existing.dataset.loaded==='1')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(marker,'1');s.onload=()=>{s.dataset.loaded='1';resolve()};s.onerror=reject;document.body.appendChild(s)})}
async function waitForBase(){const start=Date.now();while(Date.now()-start<20000){if(window.VUUIStability&&window.VURuntimeAudit&&window.VUDailyFactoryPack&&window.VUPaintedStockInventoryAuthority)return;await new Promise(r=>setTimeout(r,60))}}
async function loadOperationalExtensions(){
  await waitForBase();
  await loadScriptOnce('production-set-delete-authority-v9.js?v=9.3.2','data-vu-production-set-delete');
  await loadScriptOnce('painting-full-order-authority-v9.js?v=9.3.2','data-vu-paint-full-order');
  await loadScriptOnce('order-update-recalc-authority-v9.js?v=9.3.2','data-vu-order-recalc');
  await loadScriptOnce('worksheet-paint-reconciliation-authority-v9.js?v=9.3.2','data-vu-paint-reconcile');
  await loadScriptOnce('order-identity-reconciliation-v9.js?v=9.3.2','data-vu-order-identity');
  await loadScriptOnce('partial-dispatch-capture-v9.js?v=9.3.2','data-vu-partial-dispatch');
  await loadScriptOnce('dispatch-stepper-authority-v9.js?v=9.3.2','data-vu-dispatch-stepper');
  await loadScriptOnce('live-factory-pack-authority-v9.js?v=9.3.2','data-vu-live-pack');
  await loadScriptOnce('digital-factory-v93.js?v=9.3.2','data-vu-digital-factory');
  await loadScriptOnce('digital-factory-role-shell-v93.js?v=9.3.2','data-vu-digital-factory-role-shell');
  await loadScriptOnce('digital-factory-manager-dashboard-v93.js?v=9.3.2','data-vu-digital-factory-manager-dashboard');
  applyBuildLabel();
  window.dispatchEvent(new CustomEvent('vu:operational-authorities-ready',{detail:{build:BUILD}}));
}
applyBuildLabel();
loadOperationalExtensions().catch(e=>console.error('V9.3.2 operational authority load failed',e));
window.VUApplyBuildLabel=applyBuildLabel;
window.VUOperationalBuild={version:'9.3.2',ready:()=>String(window.VUPaintingFullOrderAuthority?.version||'')==='9.1.05'&&String(window.VUPartialDispatchCapture?.version||'')==='9.1.14'&&String(window.VUOrderIdentityReconciliation?.version||'')==='9.2.0'&&!!window.VULiveFactoryPackAuthority&&String(window.VUWorksheetPaintReconciliationAuthority?.version||'')==='9.1.12'&&!!window.VUDispatchStepperAuthority&&!!window.VUProductionSetDeleteAuthority&&!!window.VUOrderUpdateRecalcAuthority&&String(window.VUDigitalFactory?.version||'')==='9.3.0'&&String(window.VUDigitalFactoryRoleShell?.version||'')==='9.3.1'&&String(window.VUDigitalFactoryManagerDashboard?.version||'')==='9.3.2'};
})();