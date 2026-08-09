/* V9.0.23 — one authoritative Quick Access binding layer.
   Reads the current stores once when Dashboard renders; no timers/observers.
   Keeps navigation labels and counts aligned with the current order-based workflow. */
(function(){
'use strict';
const CLOSED=new Set(['draft','cancelled','completed','delivered','collected','invoiced']);
const norm=v=>String(v||'').trim().toLowerCase();
const hasDemand=o=>(o?.lines||[]).some(l=>Number(l.qty||0)>0);
function stageOf(o){
  const wf=norm(o?.workflowStage),fs=norm(o?.finishingStatus),ps=norm(o?.paintingStatus);
  if(['delivery','delivery-scheduled'].includes(wf)||ps==='completed')return'delivery';
  if(wf==='painting'||fs==='completed')return'painting';
  if(wf==='finishing'||o?.rawIssued===true)return'finishing';
  return'production';
}
function quickCard(label){
  return [...document.querySelectorAll('.quick-grid .quick-card')].find(card=>(card.querySelector('strong')?.textContent||'').trim().toLowerCase()===label.toLowerCase());
}
function bind(label,subtitle,routeName){
  const card=quickCard(label);if(!card)return;
  const small=card.querySelector('small');if(small)small.textContent=subtitle;
  card.onclick=()=>navigate(routeName);
  card.removeAttribute('data-legacy-route');
}
async function applyDashboardRuntime(){
  const [products,customers,quotes,orders,deliveries]=await Promise.all([
    getAll('products'),getAll('customers'),getAll('quotes'),getAll('orders'),getAll('deliveries')
  ]);
  const activeOrders=orders.filter(o=>!CLOSED.has(norm(o.status))&&hasDemand(o));
  const stages={production:0,finishing:0,painting:0,delivery:0};
  activeOrders.forEach(o=>stages[stageOf(o)]++);
  const openQuotes=quotes.filter(q=>!['converted','declined','expired','cancelled'].includes(norm(q.status))).length;
  const activeProducts=products.filter(p=>p.isActive!==false).length;
  const activeCustomers=customers.filter(c=>c.isActive!==false).length;
  const scheduled=deliveries.filter(d=>!['delivered','cancelled'].includes(norm(d.status))).length;
  const deliveryReady=Math.max(stages.delivery,scheduled);
  let due=0;
  try{
    if(typeof customerInsight==='function')due=customers.filter(c=>c.isActive!==false).filter(c=>['Overdue','Due soon'].includes(customerInsight(orders,c.id).status)).length;
  }catch{}

  bind('Products',`${activeProducts} active product${activeProducts===1?'':'s'}`,'products');
  bind('Customers',`${activeCustomers} active customer${activeCustomers===1?'':'s'}`,'customers');
  bind('Order intelligence',`${due} customer${due===1?'':'s'} due`,'visits');
  bind('Quotes',`${openQuotes} open quote${openQuotes===1?'':'s'}`,'quotes');
  bind('Orders',`${activeOrders.length} active order${activeOrders.length===1?'':'s'}`,'orders');
  bind('Production',`${stages.production} production · ${stages.finishing+stages.painting} finishing/painting`,'production');
  bind('Deliveries',`${deliveryReady} ready / scheduled`,'deliveries');
  bind('Settings','Backups, imports & app settings','settings');
}

const baseDashboard=dashboard;
dashboard=async function dashboardV9023(){
  await baseDashboard();
  await applyDashboardRuntime();
};
window.dashboard=dashboard;
window.applyDashboardRuntime=applyDashboardRuntime;
})();
