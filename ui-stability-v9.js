/* V9.0.81 — final mobile stability layer + daily factory routine bootstrap. */
(function(){
'use strict';
if(!document.getElementById('vuStabilityStyles')){
  const s=document.createElement('style');s.id='vuStabilityStyles';s.textContent=`
html,body{max-width:100%;overflow-x:hidden}
dialog{max-width:min(720px,calc(100vw - 12px));width:min(720px,calc(100vw - 12px));max-height:96dvh;padding:0;overscroll-behavior:contain}
dialog .modal-form,dialog .dialog-inner{max-width:100%;box-sizing:border-box;overscroll-behavior:contain}
.route-settings{display:grid;grid-template-columns:1fr 1fr;gap:8px}.route-settings label{margin:0}
.route-actions{display:flex;gap:8px;flex-wrap:wrap}.route-actions button{flex:1;min-width:145px}
.route-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.route-summary>div{padding:10px;border:1px solid var(--border);border-radius:14px;text-align:center}
.route-stop{padding:12px;margin:8px 0;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}.route-stop small{display:block;color:var(--muted);line-height:1.4}.route-warning{border-color:#b88468}
[data-factory-pack-quick]{border:2px solid var(--border);box-shadow:0 2px 10px rgba(0,0,0,.05)}
[data-factory-pack-quick] .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(max-width:520px){.route-settings{grid-template-columns:1fr}.route-summary{grid-template-columns:1fr 1fr 1fr}.route-actions button{min-width:100%}[data-factory-pack-quick] .actions{grid-template-columns:1fr}}
`;
  document.head.appendChild(s);
}
function loadDailyFactoryPack(){
  if(window.VUDailyFactoryPack)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    if(document.querySelector('script[data-daily-factory-pack]')){const wait=()=>window.VUDailyFactoryPack?resolve():setTimeout(wait,30);return wait();}
    const script=document.createElement('script');script.src='daily-factory-pack-v9.js?v=9.0.81';script.async=false;script.dataset.dailyFactoryPack='1';script.onload=resolve;script.onerror=()=>reject(new Error('Failed to load daily factory pack'));document.body.appendChild(script);
  });
}
const baseFinalize=window.VUFinalizeInitialPage;
if(typeof baseFinalize==='function'&&!baseFinalize.__vuDailyPack){
  const wrapped=async function(){
    try{await loadDailyFactoryPack();window.VU_BUILD='V9.0.81';const el=document.getElementById('runtimeBuild');if(el)el.textContent='V9.0.81';}
    catch(e){console.error('Daily factory pack bootstrap',e)}
    return baseFinalize();
  };
  wrapped.__vuDailyPack=true;window.VUFinalizeInitialPage=wrapped;
}
window.VUUIStability={version:'9.0.81',loadDailyFactoryPack};
})();