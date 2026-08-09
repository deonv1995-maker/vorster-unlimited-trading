/* V9.0.25 — final authoritative dashboard bindings + 3-sheet factory print pack.
   Non-destructive: reads current stores only; does not mutate business data.
   Operational worksheets deliberately hide all Rand values from workforce printouts. */
(function(){
'use strict';
const norm=v=>String(v||'').trim().toLowerCase();
const num=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const CLOSED=new Set(['draft','cancelled','completed','delivered','collected','invoiced']);
function stageOf(o){const wf=norm(o?.workflowStage),fs=norm(o?.finishingStatus),ps=norm(o?.paintingStatus);if(['delivery','delivery-scheduled'].includes(wf)||ps==='completed')return'delivery';if(wf==='painting'||fs==='completed')return'painting';if(wf==='finishing'||o?.rawIssued===true)return'finishing';return'production';}

async function refreshQuickAccess(){
  const cards=[...document.querySelectorAll('.quick-grid .quick-card')];
  if(cards.length<8)return;
  const [products,customers,quotes,orders,deliveries]=await Promise.all([getAll('products'),getAll('customers'),getAll('quotes'),getAll('orders'),getAll('deliveries')]);
  const activeOrders=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>num(l.qty)>0));
  const counts={production:0,finishing:0,painting:0,delivery:0};activeOrders.forEach(o=>counts[stageOf(o)]++);
  const openQuotes=quotes.filter(q=>!['converted','declined','expired','cancelled'].includes(norm(q.status))).length;
  const activeProducts=products.filter(p=>p.isActive!==false).length,activeCustomers=customers.filter(c=>c.isActive!==false).length;
  const scheduled=deliveries.filter(d=>!['delivered','cancelled'].includes(norm(d.status))).length;
  let due=0;try{if(typeof customerInsight==='function')due=customers.filter(c=>c.isActive!==false&&['Overdue','Due soon'].includes(customerInsight(orders,c.id).status)).length}catch{}
  const specs=[
    ['Products',`${activeProducts} active products`,()=>navigate('products')],
    ['Customers',`${activeCustomers} active customers`,()=>navigate('customers')],
    ['Order intelligence',`${due} customers due`,()=>navigate('visits')],
    ['Quotes',`${openQuotes} open quotes`,()=>navigate('quotes')],
    ['Orders',`${activeOrders.length} active open orders`,()=>navigate('orders')],
    ['Production',`${counts.production} in production · ${counts.finishing+counts.painting} finishing & painting`,()=>navigate('production')],
    ['Deliveries',`${Math.max(counts.delivery,scheduled)} ready / scheduled`,()=>navigate('deliveries')],
    ['Settings','Backups, imports & app settings',()=>navigate('settings')]
  ];
  cards.slice(0,8).forEach((card,i)=>{const [title,subtitle,action]=specs[i];const titleNode=card.querySelector('strong,h2,h3');const subNode=card.querySelector('small,p');if(titleNode)titleNode.textContent=title;if(subNode)subNode.textContent=subtitle;card.onclick=action;});
}
const dashBase=window.dashboard;
window.dashboard=async function dashboardV9025(){await dashBase();await refreshQuickAccess();};
try{dashboard=window.dashboard}catch{}

const style='@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font:11px Arial;color:#111;margin:0}.bar{text-align:center;padding:8px}.sheet{page-break-after:always}.head{display:flex;justify-content:space-between;gap:10px;border-bottom:3px solid #111;padding-bottom:7px}.head h1{margin:0;font-size:21px}.job{border:1.5px solid #444;padding:7px;margin:8px 0;break-inside:avoid}.job.target{border-width:2.5px}.job h2{font-size:14px;margin:2px 0 6px}.line{display:grid;grid-template-columns:18px 1fr 80px 55px 70px;gap:5px;align-items:center;border-top:1px solid #bbb;padding:5px 0}.box{width:14px;height:14px;border:1.5px solid #111;display:inline-block}.write{height:20px;border-bottom:1px solid #111}.muted{color:#444}.foot{border-top:1px solid #111;margin-top:12px;padding-top:8px}.empty{border:1px dashed #999;padding:18px;text-align:center}@media print{.bar{display:none}}';
const dateLabel=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`));
function itemLines(order){return (order?.lines||[]).filter(l=>productLine(l)&&num(l.qty)>0).map(l=>`<div class="line"><span class="box"></span><span><b>${safe(l.productCode||l.code||'')}</b> ${safe(l.productName||l.name||'')}<br><span class="muted">${safe(colour(l))}</span></span><b>${num(l.qty)}</b><span class="write"></span><span>✓ / X</span></div>`).join('');}
function productionSheet(plan){const rows=plan.productionItems||[];return `<section class="sheet"><div class="head"><div><h1>Production Worksheet</h1><div>${safe(dateLabel(plan.date))}</div></div><b>${rows.reduce((s,r)=>s+num(r.quantity),0)} units planned</b></div>${rows.length?rows.map((r,i)=>`<div class="job ${r.targetOrder?'target':''}"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><h2>${safe(r.productCode)} · ${safe(r.productName)}</h2><div class="line"><span class="box"></span><span>${safe(r.colourName||'Standard')}<br><span class="muted">${safe(r.orderNumber||'')} ${safe(r.customerName||'')}</span></span><b>${num(r.quantity)}</b><span class="write"></span><span>✓ / X</span></div></div>`).join(''):'<div class="empty">No production work planned for this date.</div>'}<div class="foot">Production supervisor: ____________________ &nbsp; Completed: ________</div></section>`;}
function finishingRows(plan){const map=new Map();for(const r of [...(plan.finishing||[]),...(plan.painting||[])]){const id=r?.order?.id||r?.order?.orderNumber;if(id&&!map.has(id))map.set(id,r);}return [...map.values()];}
function finishingSheet(plan){const rows=finishingRows(plan);return `<section class="sheet"><div class="head"><div><h1>Finishing & Painting Worksheet</h1><div>${safe(dateLabel(plan.date))}</div></div><b>${rows.length} orders</b></div>${rows.length?rows.map((r,i)=>`<div class="job ${r.targetOrder?'target':''}"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><h2>${safe(r.order.orderNumber||'Order')} · ${safe(r.order.customerName||'Customer')}</h2>${itemLines(r.order)}<p>Finishing / painting notes: ____________________________________________</p></div>`).join(''):'<div class="empty">No finishing or painting work planned for this date.</div>'}<div class="foot">Finishing & Painting supervisor: ____________________ &nbsp; Completed: ________</div></section>`;}
function deliverySheet(plan){const rows=plan.delivery||[];return `<section class="sheet"><div class="head"><div><h1>Delivery & Collection Worksheet</h1><div>${safe(dateLabel(plan.date))}</div></div><b>${rows.length} stops</b></div>${rows.length?rows.map((r,i)=>`<div class="job ${r.targetOrder?'target':''}"><div class="muted">Stop ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><h2>${safe(r.order.orderNumber||'Order')} · ${safe(r.order.customerName||'Customer')}</h2><p>${safe(r.area||'Area not set')}</p>${itemLines(r.order)}</div>`).join(''):'<div class="empty">No delivery or collection work planned for this date.</div>'}<div class="foot">Vehicle: ____________________ &nbsp; Driver: ____________________ &nbsp; Departed: ________</div></section>`;}
function openPrint(title,body){const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return;}w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(title)}</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${body}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},300);}
const oldPrint=window.opPrint;
window.opPrint=async function(stage,date){if(typeof buildWorkflowForecast!=='function')return oldPrint?.(stage,date);const plan=await buildWorkflowForecast(date);if(stage==='all')return openPrint('Daily Factory Pack',productionSheet(plan)+finishingSheet(plan)+deliverySheet(plan));if(stage==='production')return openPrint('Production Worksheet',productionSheet(plan));if(['finishing','painting','finishing-painting'].includes(stage))return openPrint('Finishing & Painting Worksheet',finishingSheet(plan));if(stage==='delivery')return openPrint('Delivery & Collection Worksheet',deliverySheet(plan));return oldPrint?.(stage,date);};
window.VUFactorySheetsV9025={productionSheet,finishingSheet,deliverySheet};
})();