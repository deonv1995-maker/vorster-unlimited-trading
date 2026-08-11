/* V9.0.77 — final dashboard authority with atomic visible render.
   The legacy dashboard still supplies the full dashboard content, but intermediate legacy output is
   never shown. Quick Access is corrected before the page becomes visible, eliminating two-stage flash. */
(function(){
'use strict';
const norm=v=>String(v||'').trim().toLowerCase();
const num=v=>Math.max(0,Number(v||0));
const CLOSED=new Set(['draft','cancelled','completed','delivered','collected','invoiced']);
function stageOf(order){const workflow=norm(order?.workflowStage),finishing=norm(order?.finishingStatus),painting=norm(order?.paintingStatus);if(['delivery','delivery-scheduled'].includes(workflow)||painting==='completed')return'delivery';if(workflow==='painting'||finishing==='completed')return'painting';if(workflow==='finishing'||order?.rawIssued===true)return'finishing';return'production';}
async function currentQuickAccess(){
  const [products,customers,quotes,orders,deliveries]=await Promise.all([getAll('products'),getAll('customers'),getAll('quotes'),getAll('orders'),getAll('deliveries')]);
  const activeProducts=products.filter(p=>p.isActive!==false).length,activeCustomers=customers.filter(c=>c.isActive!==false).length;
  const openQuotes=quotes.filter(q=>!['converted','declined','expired','cancelled'].includes(norm(q.status))).length;
  const activeOrders=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>num(l.qty)>0));
  const stages={production:0,finishing:0,painting:0,delivery:0};activeOrders.forEach(o=>stages[stageOf(o)]++);
  const scheduled=deliveries.filter(d=>!['delivered','cancelled'].includes(norm(d.status))).length;
  let due=0;try{if(typeof customerInsight==='function')due=customers.filter(c=>c.isActive!==false&&['Overdue','Due soon'].includes(customerInsight(orders,c.id).status)).length}catch{}
  return [['Products',`${activeProducts} active products`,'products'],['Customers',`${activeCustomers} active customers`,'customers'],['Order intelligence',`${due} customers due`,'visits'],['Quotes',`${openQuotes} open quotes`,'quotes'],['Orders',`${activeOrders.length} active open orders`,'orders'],['Production',`${stages.production} in production · ${stages.finishing+stages.painting} finishing & painting`,'production'],['Deliveries',`${Math.max(stages.delivery,scheduled)} ready / scheduled`,'deliveries'],['Settings','Backups, imports & app settings','settings']];
}
async function applyQuickAccess(){const cards=[...document.querySelectorAll('.quick-grid .quick-card')];if(cards.length<8)return false;const specs=await currentQuickAccess();cards.slice(0,8).forEach((card,index)=>{const[title,subtitle,route]=specs[index],titleNode=card.querySelector('strong,h2,h3'),subNode=card.querySelector('small,p');if(titleNode)titleNode.textContent=title;if(subNode)subNode.textContent=subtitle;card.onclick=()=>window.navigate(route)});return true;}
const base=window.dashboard;
window.dashboard=async function dashboardV9077(){
  const host=document.getElementById('main');if(!host){if(typeof base==='function')await base();return;}
  const previousVisibility=host.style.visibility;host.style.visibility='hidden';
  try{if(typeof base==='function')await base();await applyQuickAccess();}
  finally{host.style.visibility=previousVisibility||'';}
};
window.VUDashboardAuthority={version:'9.0.77',apply:applyQuickAccess};
})();