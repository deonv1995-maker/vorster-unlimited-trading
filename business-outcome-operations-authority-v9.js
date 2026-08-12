/* V9.0.78 — final business-outcome authority for Operations and Orders.
   Applies one shared optimizer ranking to production, finishing, painting and delivery candidates,
   and surfaces the reasons so management can audit the algorithm. */
(function(){
'use strict';
if(window.VUBusinessOutcomeOperations)return;
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const cash=v=>typeof money==='function'?money(v):`R ${Number(v||0).toFixed(2)}`;
const basePlan=window.VUThreeStagePlan||window.buildWorkflowForecast;
async function optimizedPlan(date){
  const [plan,opt]=await Promise.all([basePlan(date),window.VUBusinessOutcomeOptimizer.build()]);
  const rank=id=>opt.byOrderId.get(String(id))?.priority||9999,decorate=row=>{const x=opt.byOrderId.get(String(row?.order?.id||row?.orderId||''));return x?{...row,businessPriority:x.priority,businessScore:x.score,businessReasons:x.reasons}:row};
  const sortRows=rows=>(rows||[]).map(decorate).sort((a,b)=>rank(a?.order?.id||a?.orderId)-rank(b?.order?.id||b?.orderId));
  const productionByDivision={};for(const [division,items] of Object.entries(plan.productionByDivision||{}))productionByDivision[division]=sortRows(items);
  return{...plan,productionByDivision,finishing:sortRows(plan.finishing),finishingPainting:sortRows(plan.finishingPainting),deliveryReady:sortRows(plan.deliveryReady),delivery:sortRows(plan.delivery),businessOptimization:opt};
}
window.VUThreeStagePlan=optimizedPlan;window.buildWorkflowForecast=optimizedPlan;
function priorityCard(opt,compact=false){
  const top=opt.ranked.slice(0,compact?5:12),target=Number(opt.target||0),value=top.reduce((s,r)=>s+Number(r.value||0),0);
  return `<section class="card business-priority-card"><div class="section-head"><div><div class="step-label">Business outcome optimiser · V9.0.78</div><h2>Business Priority Queue</h2><p class="muted">One ranking across Orders → Production → Painting → Delivery. Yesterday's actual work, stock, capacity, due dates, order value and route grouping all contribute.</p></div></div><div class="workflow-summary"><div><small>Daily target</small><strong>${target?cash(target):'Not set'}</strong></div><div><small>Open orders</small><strong>${opt.ranked.length}</strong></div><div><small>Previous workday</small><strong>${safe(opt.previousWorkday)}</strong></div></div>${top.map(r=>`<button class="card" style="width:100%;text-align:left;margin-top:8px" onclick="viewOrder('${safe(r.orderId)}')"><div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><div><small>Priority ${r.priority} · score ${Math.round(r.score)} · ${safe(r.stage)}</small><h3 style="margin:3px 0">${safe(r.order.orderNumber||'Order')} · ${safe(r.order.customerName||'Customer')}</h3></div><strong>${cash(r.value)}</strong></div><small>${Math.round(r.coverage*100)}% raw coverage · ${r.effortDays} est. production days${r.area&&r.area!=='Area not set'?` · ${safe(r.area)}`:''}</small><p class="muted" style="margin:6px 0 0">Why: ${safe(r.reasons.slice(0,4).join(' · ')||'balanced business priority')}</p></button>`).join('')}${compact&&opt.ranked.length>top.length?`<p class="muted">Showing top ${top.length} of ${opt.ranked.length} open orders.</p>`:''}</section>`;
}
const baseProduction=window.productionPage;
if(typeof baseProduction==='function')window.productionPage=async function businessOptimizedProductionPage(...args){const result=await baseProduction(...args);try{const opt=await window.VUBusinessOutcomeOptimizer.build(),host=document.getElementById('main');if(host&&!host.querySelector('.business-priority-card'))host.insertAdjacentHTML('afterbegin',priorityCard(opt,true));}catch(e){console.warn('Business priority panel',e)}return result;};
const baseOrders=window.ordersPage;
if(typeof baseOrders==='function')window.ordersPage=async function businessOptimizedOrdersPage(...args){const result=await baseOrders(...args);try{const opt=await window.VUBusinessOutcomeOptimizer.build(),host=document.getElementById('main');if(host&&!host.querySelector('.business-priority-card'))host.insertAdjacentHTML('afterbegin',priorityCard(opt,false));}catch(e){console.warn('Business priority orders panel',e)}return result;};
try{productionPage=window.productionPage;ordersPage=window.ordersPage}catch{}
window.VUBusinessOutcomeOperations={version:'9.0.78',plan:optimizedPlan,priorityCard};
})();
