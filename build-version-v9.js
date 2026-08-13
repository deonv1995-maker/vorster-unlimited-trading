/* V9.4.3 — navigation clean runtime with separate Manager and leader paths. */
(function(){
'use strict';const BUILD='V9.4.3',ROLE_KEY='vu-digital-factory-device-role';window.VU_BUILD=BUILD;
function applyBuildLabel(){const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent=BUILD;document.querySelectorAll('[data-vu-build]').forEach(el=>el.textContent=BUILD)}
function loadScriptOnce(src,marker){return new Promise((resolve,reject)=>{const existing=document.querySelector(`script[${marker}]`);if(existing){if(existing.dataset.loaded==='1')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(marker,'1');s.onload=()=>{s.dataset.loaded='1';resolve()};s.onerror=reject;document.body.appendChild(s)})}
async function waitForBase(){const start=Date.now();while(Date.now()-start<20000){if(window.VUUIStability&&window.VURuntimeAudit&&window.VUDailyFactoryPack&&window.VUPaintedStockInventoryAuthority)return;await new Promise(r=>setTimeout(r,60))}}
async function loadOperationalExtensions(){await waitForBase();for(const [src,mark] of [['production-set-delete-authority-v9.js','production-set-delete'],['painting-full-order-authority-v9.js','paint-full-order'],['order-update-recalc-authority-v9.js','order-recalc'],['worksheet-paint-reconciliation-authority-v9.js','paint-reconcile'],['order-identity-reconciliation-v9.js','order-identity'],['partial-dispatch-capture-v9.js','partial-dispatch'],['dispatch-stepper-authority-v9.js','dispatch-stepper'],['live-factory-pack-authority-v9.js','live-pack']])await loadScriptOnce(`${src}?v=9.4.3`,`data-vu-${mark}`);
  const role=String(localStorage.getItem(ROLE_KEY)||'Manager');
  if(role==='Manager'){
    await loadScriptOnce('digital-factory-target-overrides-v93.js?v=9.4.3','data-vu-digital-target-overrides');
    await loadScriptOnce('digital-factory-exceptions-v93.js?v=9.4.3','data-vu-digital-exceptions');
    await loadScriptOnce('manager-command-centre-v93.js?v=9.4.3','data-vu-manager-command-centre');
  }else{
    await loadScriptOnce('digital-factory-v93.js?v=9.4.3','data-vu-digital-factory');
    await loadScriptOnce('digital-factory-target-overrides-v93.js?v=9.4.3','data-vu-digital-target-overrides');
    await loadScriptOnce('digital-factory-target-bridge-v93.js?v=9.4.3','data-vu-digital-target-bridge');
    await loadScriptOnce('digital-factory-exceptions-v93.js?v=9.4.3','data-vu-digital-exceptions');
    await loadScriptOnce('digital-factory-role-shell-v93.js?v=9.4.3','data-vu-digital-factory-role-shell');
  }
  applyBuildLabel();window.dispatchEvent(new CustomEvent('vu:operational-authorities-ready',{detail:{build:BUILD,role}}));
}
applyBuildLabel();loadOperationalExtensions().catch(e=>console.error('V9.4.3 operational authority load failed',e));window.VUApplyBuildLabel=applyBuildLabel;window.VUOperationalBuild={version:'9.4.3',ready:()=>!!window.VUPaintingFullOrderAuthority&&!!window.VUPartialDispatchCapture&&!!window.VUOrderIdentityReconciliation&&!!window.VULiveFactoryPackAuthority};
})();