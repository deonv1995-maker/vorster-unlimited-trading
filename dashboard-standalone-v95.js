/* V9.5.0 — standalone authoritative dashboard. No legacy dashboard dependency. */
(function(){
'use strict';
const norm=v=>String(v||'').trim().toLowerCase();
const num=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const CLOSED=new Set(['draft','cancelled','completed','delivered','collected','invoiced']);
function stageOf(o){const w=norm(o?.workflowStage),f=norm(o?.finishingStatus),p=norm(o?.paintingStatus);if(['delivery','delivery-scheduled'].includes(w)||p==='completed')return'delivery';if(w==='painting'||f==='completed')return'painting';if(w==='finishing'||o?.rawIssued===true)return'finishing';return'production'}
async function state(){
 const [products,customers,quotes,orders,deliveries]=await Promise.all([getAll('products'),getAll('customers'),getAll('quotes'),getAll('orders'),getAll('deliveries')]);
 const activeProducts=products.filter(x=>x.isActive!==false),activeCustomers=customers.filter(x=>x.isActive!==false),openQuotes=quotes.filter(x=>!['converted','declined','expired','cancelled'].includes(norm(x.status))),activeOrders=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>num(l.qty)>0));
 const stages={production:0,finishing:0,painting:0,delivery:0};activeOrders.forEach(o=>stages[stageOf(o)]++);
 const scheduled=deliveries.filter(d=>!['delivered','cancelled'].includes(norm(d.status))).length;
 let due=0;try{if(typeof customerInsight==='function')due=activeCustomers.filter(c=>['Overdue','Due soon'].includes(customerInsight(orders,c.id).status)).length}catch{}
 let ready=stages.delivery;try{if(window.VUOrderProgress?.buildAll){const p=await VUOrderProgress.buildAll();ready=activeOrders.filter(o=>num(p.get(String(o.id))?.percent)>=100).length}}catch{}
 let top=null;try{top=(await window.VUBusinessOutcomeOptimizer?.build?.())?.ranked?.[0]||null}catch{}
 return{activeProducts,activeCustomers,openQuotes,activeOrders,stages,scheduled,due,ready,top};
}
const card=(icon,title,sub,route)=>`<button class="quick-card" data-route="${route}"><span>${icon}</span><strong>${safe(title)}</strong><small>${safe(sub)}</small></button>`;
async function render(){
 const host=document.getElementById('main');if(!host)return;const s=await state(),delivery=Math.max(s.ready,s.stages.delivery,s.scheduled),top=s.top;
 document.getElementById('pageTitle').textContent='Dashboard';document.getElementById('backBtn')?.classList.add('hidden');
 host.innerHTML=`<section class="hero-card smart-hero"><div><div class="step-label">TODAY</div><h2>Factory & order control</h2><p>${s.activeOrders.length} active orders · ${delivery} ready / scheduled</p></div><button class="primary hero-order-btn" data-new>+ New order</button></section><section class="card"><div class="section-head"><div><div class="step-label">CURRENT PRIORITY</div><h2>${safe(top?`${top.order?.orderNumber||'Order'} · ${top.order?.customerName||'Customer'}`:'No priority order selected')}</h2></div></div><p class="muted">${safe(top?.reasons?.slice?.(0,2)?.join(' · ')||'The optimiser will show the next focus when enough order data is available.')}</p><div class="grid two smart-health-grid"><div class="stat"><span class="muted">Production</span><strong>${s.stages.production}</strong><small>orders</small></div><div class="stat"><span class="muted">Finishing</span><strong>${s.stages.finishing}</strong><small>orders</small></div><div class="stat"><span class="muted">Painting</span><strong>${s.stages.painting}</strong><small>orders</small></div><div class="stat"><span class="muted">Ready</span><strong>${delivery}</strong><small>delivery / collection</small></div></div></section><div class="section-head"><h2>Quick access</h2></div><div class="quick-grid premium">${card('▦','Products',`${s.activeProducts.length} active products`,'products')}${card('◉','Customers',`${s.activeCustomers.length} active customers`,'customers')}${card('⌖','Order intelligence',`${s.due} customers due`,'visits')}${card('▧','Quotes',`${s.openQuotes.length} open quotes`,'quotes')}${card('▤','Orders',`${s.activeOrders.length} active open orders`,'orders')}${card('🏭','Production',`${s.stages.production} in production · ${s.stages.finishing+s.stages.painting} finishing & painting`,'production')}${card('🚚','Deliveries',`${delivery} ready / scheduled`,'deliveries')}${card('⚙','Settings','Backups, imports & app settings','settings')}</div>`;
 host.querySelector('[data-new]')?.addEventListener('click',()=>window.startOrder?.());host.querySelectorAll('[data-route]').forEach(x=>x.addEventListener('click',()=>window.navigate?.(x.dataset.route)));
 try{await window.VUGuidedControlCenter?.insert?.()}catch(e){console.warn('Control centre insert',e)}
 return s;
}
window.dashboard=render;try{dashboard=render}catch{}
window.VUDashboardStandalone={version:'9.5.0',render,state};
})();