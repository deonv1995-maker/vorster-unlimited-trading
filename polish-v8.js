/* Version 8.6 polish layer.
   Non-destructive: normalises wording, live counts and mobile workflow ergonomics.
   No order, stock, quote or checklist data is migrated or restructured here. */
const VU_POLISH_VERSION='8.6.1';
const vuPolishClosed=new Set(['draft','cancelled','completed','delivered','collected','invoiced']);
const vuPolishLower=v=>String(v||'').trim().toLowerCase();

async function vuPolishForecastSafe(){
  try{return typeof buildPipelineForecast==='function'?await buildPipelineForecast():null}catch(error){console.warn('Polish forecast unavailable',error);return null;}
}
function vuPolishSetQuickCard(card,title,subtitle,action){
  if(!card)return;const strong=card.querySelector('strong,h2');const small=card.querySelector('small,p');
  if(strong)strong.textContent=title;if(small)small.textContent=subtitle;if(action)card.onclick=action;
}
function vuPolishFindQuick(label){return [...main.querySelectorAll('.quick-card,button.card')].find(card=>(card.querySelector('strong,h2')?.textContent||'').trim().toLowerCase()===label.toLowerCase());}

const vuPolishDashboardBase=dashboard;
dashboard=async function vuPolishedDashboard(){
  await vuPolishDashboardBase();const forecast=await vuPolishForecastSafe();const rows=forecast?.rows||[];
  const inProduction=rows.filter(r=>r.currentStage==='Production').length;const inFinishing=rows.filter(r=>r.currentStage==='Finishing & Painting').length;const readyDelivery=rows.filter(r=>r.currentStage==='Delivery').length;
  vuPolishSetQuickCard(vuPolishFindQuick('Orders')||vuPolishFindQuick('Orders & Production'),'Orders & Production',`${rows.length} open · ${inProduction} physically in production`,()=>navigate('production'));
  vuPolishSetQuickCard(vuPolishFindQuick('Production')||vuPolishFindQuick('Finishing & Painting'),'Finishing & Painting',`${inFinishing} current · ${Math.max(0,rows.length-inFinishing-readyDelivery)} incoming`,()=>finishingPaintingPage());
  vuPolishSetQuickCard(vuPolishFindQuick('Deliveries'),'Deliveries',`${readyDelivery} ready · ${Math.max(0,rows.length-readyDelivery)} forecast`,()=>navigate('deliveries'));
};window.dashboard=dashboard;

const vuPolishProductionBase=productionPage;
productionPage=async function vuPolishedProduction(){
  await vuPolishProductionBase();pageTitle.textContent='Orders & Production';const forecast=await vuPolishForecastSafe();
  if(forecast){const counts=[forecast.rows.filter(r=>r.currentStage==='Production').length,forecast.rows.filter(r=>r.currentStage==='Finishing & Painting').length,forecast.rows.filter(r=>r.currentStage==='Delivery').length,forecast.rows.length];const labels=['In production','In finishing','Ready for delivery','Total open orders'];[...main.querySelectorAll('.workflow-summary>div')].slice(0,4).forEach((node,i)=>{const small=node.querySelector('small'),strong=node.querySelector('strong');if(small)small.textContent=labels[i];if(strong)strong.textContent=String(counts[i]);});}
  const target=document.getElementById('vuInvoiceTarget'),save=document.getElementById('vuSaveInvoiceTarget');if(target&&save){const label=target.closest('label');if(label){label.childNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim())node.textContent='Daily invoice target (R)';});const row=document.createElement('div');row.className='vu-polish-target-row';label.parentNode?.insertBefore(row,label);row.append(label,save);}save.textContent='Save target & recalculate';}
  const intro=main.querySelector('.card .section-head p.muted');if(intro)intro.textContent='One order moves through Production → Finishing & Painting → Delivery. Later-stage tabs keep upstream orders visible as forecasts so each team can plan ahead.';
  const tabs=[...main.querySelectorAll('[data-vu-cross]')];tabs.forEach(button=>{const original=button.onclick;button.onclick=event=>{localStorage.setItem('vu-production-tab',button.dataset.vuCross||'production');if(typeof original==='function')return original.call(button,event);};});const preferred=localStorage.getItem('vu-production-tab');const preferredButton=tabs.find(b=>b.dataset.vuCross===preferred);if(preferredButton&&preferred!=='production')preferredButton.click();
};window.productionPage=productionPage;

const vuPolishProductsBase=productsPage;
productsPage=async function vuPolishedProducts(...args){await vuPolishProductsBase(...args);const stockButton=document.getElementById('stockCountBtn');if(stockButton)stockButton.textContent='Raw stock count';main.querySelectorAll('.stock-on-hand-badge span').forEach(node=>node.textContent='Raw stock on hand');main.querySelectorAll('.compact-stock-badge').forEach(node=>{node.textContent=node.textContent.replace(/^Stock\s+/i,'Raw ');});};window.productsPage=productsPage;

const vuPolishSettingsBase=settingsPage;
settingsPage=async function vuPolishedSettings(){await vuPolishSettingsBase();const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent='V8.6.1';};window.settingsPage=settingsPage;

const vuPolishObserver=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(!(node instanceof HTMLElement))continue;node.querySelectorAll?.('input,select,textarea').forEach(control=>{if(!control.style.fontSize)control.style.fontSize='16px';});}}});vuPolishObserver.observe(document.body,{childList:true,subtree:true});

/* Load the corrected prepared-order importer last so converted Sage files preserve delivery fees and instructions. */
(()=>{const script=document.createElement('script');script.src='job-card-import-fix-v861.js?v=8.6.1';script.async=false;document.body.appendChild(script);})();
