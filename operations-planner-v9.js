/* Version 9.0.0 — one target-driven operations plan for Production → Finishing → Painting → Delivery. */
(function(){
'use strict';
const CLOSED=new Set(['cancelled','delivered','collected','completed','invoiced']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const key=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const display=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${key(v)}T12:00:00`));
const cash=v=>typeof money==='function'?money(v):`R ${Number(v||0).toFixed(2)}`;
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const isProduct=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const targetValue=()=>typeof vuDailyInvoiceTarget==='function'?n(vuDailyInvoiceTarget()):n(localStorage.getItem('vu-daily-invoice-target'));
const area=(o,c)=>String(o?.deliveryArea||o?.area||c?.deliveryArea||c?.area||c?.suburb||c?.city||c?.location||'Area not set').split(',')[0].trim()||'Area not set';
const address=(o,c)=>o?.deliveryAddressSnapshot||o?.deliveryAddress||c?.primaryDeliveryAddress||c?.deliveryAddress||c?.address||'';
function nextWorkday(v){const d=new Date(`${key(v)}T12:00:00`);while([0,6].includes(d.getDay()))d.setDate(d.getDate()+1);return key(d)}
function stageOf(o){
  const wf=norm(o.workflowStage),fs=norm(o.finishingStatus),ps=norm(o.paintingStatus);
  if(['delivery','delivery-scheduled'].includes(wf)||ps==='completed')return 'delivery';
  if(wf==='painting'||fs==='completed')return 'painting';
  if(wf==='finishing'||o.rawIssued===true)return 'finishing';
  return 'production';
}
function dueSort(a,b){const da=a.dueDate||'9999-12-31',db=b.dueDate||'9999-12-31';return da.localeCompare(db)||new Date(a.createdAt||0)-new Date(b.createdAt||0)}
function targetBasket(orders,target){const picked=[];let value=0;for(const o of orders){picked.push(o);value+=n(o.grandTotal);if(target>0&&value>=target)break;}return{orders:picked,value,ids:new Set(picked.map(o=>o.id)),numbers:new Set(picked.map(o=>String(o.orderNumber||'').toUpperCase()))}}
function inBasket(o,b){return Boolean(o&&(b.ids.has(o.id)||b.numbers.has(String(o.orderNumber||'').toUpperCase())))}
function targetState(target,value){const gap=Math.max(0,target-value),surplus=Math.max(0,value-target);return{ok:target>0&&value>=target,gap,surplus,label:target<=0?'Target not set':value>=target?'Target covered':'Below target'}}
function lineUnits(o){return (o.lines||[]).filter(l=>isProduct(l)&&n(l.qty)>0).reduce((s,l)=>s+n(l.qty),0)}
function sortStage(rows,basket){return rows.sort((a,b)=>(inBasket(b.order,basket)?1:0)-(inBasket(a.order,basket)?1:0)||dueSort(a.order,b.order))}

async function buildOperationsPlan(selected){
  const date=nextWorkday(selected||new Date());
  const [orders,customers,deliveries,schedule]=await Promise.all([getAll('orders'),getAll('customers'),getAll('deliveries'),buildOrderCompletionSchedule()]);
  const customerById=new Map(customers.map(c=>[c.id,c]));
  const open=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>isProduct(l)&&n(l.qty)>0)).sort(dueSort);
  const target=targetValue(),basket=targetBasket(open,target);
  const plans=new Map((schedule.orders||[]).map(p=>[p.order.id,p]));
  const grouped={production:[],finishing:[],painting:[],delivery:[]};
  for(const order of open){
    const customer=customerById.get(order.customerId),stage=stageOf(order),plan=plans.get(order.id);
    grouped[stage].push({order,customer,stage,area:area(order,customer),plan,targetOrder:inBasket(order,basket),units:lineUnits(order)});
  }
  Object.keys(grouped).forEach(k=>sortStage(grouped[k],basket));
  const prodDay=(schedule.days||[]).find(d=>d.date===date);
  const productionItems=(prodDay?.items||[]).map(i=>({item:i,order:orders.find(o=>o.id===i.orderId)||orders.find(o=>String(o.orderNumber||'').toUpperCase()===String(i.orderNumber||'').toUpperCase())}));

  const explicitIds=new Set();
  for(const d of deliveries){if(key(d.deliveryDate)===date&&!['delivered','cancelled'].includes(norm(d.status)))explicitIds.add(d.orderId)}
  for(const r of grouped.delivery){if(r.order.deliveryDate&&key(r.order.deliveryDate)===date)explicitIds.add(r.order.id)}
  const delivery=[];let deliveryValue=0;
  for(const r of grouped.delivery.filter(r=>explicitIds.has(r.order.id))){delivery.push({...r,explicit:true});deliveryValue+=n(r.order.grandTotal)}
  const candidates=grouped.delivery.filter(r=>!explicitIds.has(r.order.id)&&!r.order.deliveryDate);
  if(target<=0){for(const r of candidates){delivery.push({...r,explicit:false});deliveryValue+=n(r.order.grandTotal)}}
  else if(deliveryValue<target){
    for(const r of candidates){delivery.push({...r,explicit:false});deliveryValue+=n(r.order.grandTotal);if(deliveryValue>=target){const a=r.area;for(const x of candidates){if(delivery.some(y=>y.order.id===x.order.id))continue;if(a!=='Area not set'&&x.area===a){delivery.push({...x,explicit:false});deliveryValue+=n(x.order.grandTotal)}}break}}
  }
  return{date,target,basket,targetState:targetState(target,basket.value),schedule,open,productionItems,production:grouped.production,finishing:grouped.finishing,painting:grouped.painting,deliveryReady:grouped.delivery,delivery,deliveryValue,deliveryState:targetState(target,deliveryValue)};
}
window.buildOperationsPlan=buildOperationsPlan;

async function opCompleteFinishing(orderId){
  const o=await getOne('orders',orderId);if(!o)return;const now=new Date().toISOString();
  await putOne('orders',{...o,rawIssued:true,workflowStage:'painting',finishingStatus:'Completed',finishingCompletedAt:now,paintingStatus:o.paintingStatus==='Completed'?'Completed':'Ready',updatedAt:now});
  if(typeof notify==='function')notify('Finishing completed; order moved to painting');
  productionPage();
}
async function opStartPainting(orderId){
  const o=await getOne('orders',orderId);if(!o)return;const now=new Date().toISOString();
  await putOne('orders',{...o,rawIssued:true,workflowStage:'painting',finishingStatus:'Completed',paintingStatus:'In Progress',paintingStartedAt:o.paintingStartedAt||now,updatedAt:now});
  if(typeof notify==='function')notify('Painting started');productionPage();
}
async function opCompletePainting(orderId){
  const o=await getOne('orders',orderId);if(!o)return;const now=new Date().toISOString();
  await putOne('orders',{...o,rawIssued:true,workflowStage:'delivery',finishingStatus:'Completed',paintingStatus:'Completed',paintingCompletedAt:now,updatedAt:now});
  if(typeof notify==='function')notify('Painting completed; order is ready for delivery');productionPage();
}
async function opApplyDeliveryPlan(date){
  const p=await buildOperationsPlan(date),now=new Date().toISOString();
  let changed=0;
  for(const r of p.delivery){if(r.explicit||r.order.deliveryDate)continue;await putOne('orders',{...r.order,deliveryDate:p.date,workflowStage:'delivery-scheduled',updatedAt:now});changed++}
  if(typeof notify==='function')notify(changed?`${changed} delivery order${changed===1?'':'s'} scheduled for ${display(p.date)}`:'Delivery plan already scheduled');productionPage();
}
window.opCompleteFinishing=opCompleteFinishing;window.opStartPainting=opStartPainting;window.opCompletePainting=opCompletePainting;window.opApplyDeliveryPlan=opApplyDeliveryPlan;

function targetPanel(p,value=p.basket.value,state=p.targetState){return p.target>0?`<div class="op-target"><div><small>Daily invoice target</small><strong>${cash(p.target)}</strong></div><div><small>Priority order value</small><strong>${cash(value)}</strong></div><div><small>${safe(state.label)}</small><strong>${state.gap?`Gap ${cash(state.gap)}`:`+${cash(state.surplus)}`}</strong></div></div>`:`<div class="op-note">Set the daily invoice target in Orders & Production to activate target-driven priorities.</div>`}
function orderLines(o){return (o.lines||[]).filter(l=>isProduct(l)&&n(l.qty)>0).map(l=>`<div class="op-line"><span><b>${safe(l.productCode||l.code||'')}</b> ${safe(l.productName||l.name||'')}<small>${safe(colour(l))}</small></span><strong>${n(l.qty)}</strong></div>`).join('')}
function orderCard(r,stage,index){
  const o=r.order,target=r.targetOrder?'<span class="op-priority">TARGET</span>':'';let action='';
  if(stage==='production')action=`<button onclick="openOrderCompletionSchedule()">Production plan</button>`;
  if(stage==='finishing')action=o.finishingStatus==='In Progress'?`<button class="primary" onclick="opCompleteFinishing('${o.id}')">Finishing complete → Painting</button>`:`<button class="primary" onclick="startFinishing('${o.id}')">Start finishing</button>`;
  if(stage==='painting')action=norm(o.paintingStatus)==='in progress'?`<button class="primary" onclick="opCompletePainting('${o.id}')">Painting complete → Delivery</button>`:`<button class="primary" onclick="opStartPainting('${o.id}')">Start painting</button>`;
  return `<section class="card op-order"><div class="op-head"><div>${target}<small>Priority ${index+1} · ${safe(o.orderNumber||'Order')} · ${safe(r.area)}</small><h3>${safe(o.customerName||'Customer')}</h3></div><strong>${cash(o.grandTotal||0)}</strong></div>${orderLines(o)}<div class="actions">${action}<button onclick="viewOrder('${o.id}')">Details</button></div></section>`;
}
function productionRows(p){
  if(!p.productionItems.length)return '<div class="card op-empty">No production is scheduled for this date.</div>';
  const m=new Map();for(const x of p.productionItems){const i=x.item,k=`${i.productId}::${norm(i.colourName)}`;if(!m.has(k))m.set(k,{...i,quantity:0,orders:[]});const r=m.get(k);r.quantity+=n(i.quantity);r.orders.push(`${i.orderNumber} ${i.customerName||''}`)}
  return [...m.values()].map((r,i)=>`<section class="card op-order"><div class="op-head"><div><small>Production priority ${i+1}</small><h3>${safe(r.productCode)} · ${safe(r.productName)}</h3><small>${safe(r.colourName||'Standard')} · ${safe(r.orders.join(' · '))}</small></div><strong>${r.quantity} units</strong></div><div class="op-line"><span>Daily capacity</span><strong>${n(r.dailyCapacity)||'—'}</strong></div><div class="op-line"><span>Mould quantity</span><strong>${n(r.mouldQuantity)||'—'}</strong></div></section>`).join('')}
function deliveryRows(p){return p.delivery.length?p.delivery.map((r,i)=>`<section class="card op-order"><div class="op-head"><div>${r.targetOrder?'<span class="op-priority">TARGET</span>':''}<small>Stop ${i+1} · ${safe(r.area)} ${r.explicit?'· Scheduled':'· Suggested'}</small><h3>${safe(r.order.orderNumber)} · ${safe(r.order.customerName)}</h3></div><strong>${cash(r.order.grandTotal||0)}</strong></div><p class="muted">${safe(address(r.order,r.customer)||'Delivery address not captured')}</p>${orderLines(r.order)}<div class="actions"><button onclick="viewOrder('${r.order.id}')">Details</button></div></section>`).join(''):'<div class="card op-empty">No delivery-ready orders are available for this date.</div>'}

const printStyle='@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font:11px Arial;color:#111;margin:0}.bar{text-align:center;padding:8px}.sheet{page-break-after:always}.head{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px}.head h1{font-size:21px;margin:0}.target{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:7px 0}.target div,.job{border:1px solid #888;padding:6px}.target b{display:block;font-size:14px}.job{margin:8px 0;break-inside:avoid}.job.target{border:2px solid #111}.job h2{font-size:14px;margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:5px}th,td{border:1px solid #aaa;padding:4px;text-align:left}.box{display:inline-block;width:13px;height:13px;border:1px solid #111}.write{height:22px}@media print{.bar{display:none}}';
function printTarget(p,value,state){return p.target>0?`<div class="target"><div>Daily invoice target<b>${safe(cash(p.target))}</b></div><div>Planned value<b>${safe(cash(value))}</b></div><div>${safe(state.label)}<b>${state.gap?`Gap ${safe(cash(state.gap))}`:`+${safe(cash(state.surplus))}`}</b></div></div>`:''}
function tableLines(o){const lines=(o.lines||[]).filter(l=>isProduct(l)&&n(l.qty)>0);return `<table><tr><th></th><th>Code / item</th><th>Colour</th><th>Qty</th><th>Actual</th></tr>${lines.map(l=>`<tr><td><span class="box"></span></td><td><b>${safe(l.productCode||'')}</b><br>${safe(l.productName||'')}</td><td>${safe(colour(l))}</td><td>${n(l.qty)}</td><td class="write"></td></tr>`).join('')}</table>`}
function sheet(stage,p){
  const title={production:'Production Worksheet',finishing:'Finishing Worksheet',painting:'Painting Worksheet',delivery:'Delivery & Collection Worksheet'}[stage];
  let body='',value=p.basket.value,state=p.targetState;
  if(stage==='production'){
    const m=new Map();for(const x of p.productionItems){const i=x.item,k=`${i.productId}::${norm(i.colourName)}`;if(!m.has(k))m.set(k,{...i,quantity:0,orders:[]});const r=m.get(k);r.quantity+=n(i.quantity);r.orders.push(`${i.orderNumber} ${i.customerName||''}`)}
    body=[...m.values()].map(r=>`<div class="job"><h2>${safe(r.productCode)} · ${safe(r.productName)}</h2><p>${safe(r.colourName||'Standard')} · Orders: ${safe(r.orders.join(' · '))}</p><table><tr><th></th><th>Planned</th><th>Actual</th><th>Capacity/day</th><th>Moulds</th></tr><tr><td><span class="box"></span></td><td>${r.quantity}</td><td class="write"></td><td>${n(r.dailyCapacity)||'—'}</td><td>${n(r.mouldQuantity)||'—'}</td></tr></table></div>`).join('')||'<p>No production planned.</p>';
  } else if(stage==='delivery'){
    value=p.deliveryValue;state=p.deliveryState;body=p.delivery.map((r,i)=>`<div class="job ${r.targetOrder?'target':''}"><h2>Stop ${i+1} · ${safe(r.order.orderNumber)} · ${safe(r.order.customerName)}</h2><p>${safe(r.area)} · ${safe(address(r.order,r.customer)||'Address not captured')} · ${safe(cash(r.order.grandTotal||0))}</p>${tableLines(r.order)}</div>`).join('')||'<p>No deliveries ready.</p>';
  } else {
    const rows=stage==='finishing'?p.finishing:p.painting;body=rows.map((r,i)=>`<div class="job ${r.targetOrder?'target':''}"><h2>${i+1}. ${safe(r.order.orderNumber)} · ${safe(r.order.customerName)}</h2><p>${r.targetOrder?'<b>DAILY TARGET ORDER</b> · ':''}${safe(r.area)} · Order value ${safe(cash(r.order.grandTotal||0))}</p>${tableLines(r.order)}<p>${stage==='finishing'?'Finishing':'Painting'} notes: ______________________________________________</p></div>`).join('')||`<p>No orders waiting for ${stage}.</p>`;
  }
  return `<section class="sheet"><div class="head"><div><h1>${title}</h1><p>${safe(display(p.date))}</p></div><div><b>${stage==='delivery'?p.delivery.length:stage==='production'?p.productionItems.length:(stage==='finishing'?p.finishing.length:p.painting.length)} jobs</b></div></div>${printTarget(p,value,state)}${body}<p>Supervisor / driver: ____________________ &nbsp; Completed: ________</p></section>`;
}
async function opPrint(stage,date){const p=await buildOperationsPlan(date);const stages=stage==='all'?['production','finishing','painting','delivery']:[stage],w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return}w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Daily Operations ${safe(p.date)}</title><style>${printStyle}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${stages.map(s=>sheet(s,p)).join('')}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},300)}
window.opPrint=opPrint;

function injectStyle(){if(document.getElementById('op-v9-style'))return;const s=document.createElement('style');s.id='op-v9-style';s.textContent='.op-toolbar{display:flex;gap:8px;flex-wrap:wrap}.op-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.op-tabs button{padding:10px 4px}.op-tabs button.active{outline:2px solid currentColor}.op-target{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.op-target>div{border:1px solid var(--border,#526258);border-radius:10px;padding:8px}.op-target small,.op-target strong{display:block}.op-priority{display:inline-block;font-size:10px;font-weight:800;border:1px solid currentColor;border-radius:999px;padding:2px 6px;margin-bottom:4px}.op-head{display:flex;justify-content:space-between;gap:10px}.op-head h3{margin:3px 0}.op-line{display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--border,#526258);padding:7px 0}.op-line small{display:block;opacity:.7}.op-empty,.op-note{padding:16px}.op-stage-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.op-stage-kpis>div{padding:9px;text-align:center;border:1px solid var(--border,#526258);border-radius:10px}.op-stage-kpis strong,.op-stage-kpis small{display:block}@media(max-width:520px){.op-target{grid-template-columns:1fr}.op-tabs{grid-template-columns:repeat(2,1fr)}.op-stage-kpis{grid-template-columns:repeat(2,1fr)}}';document.head.appendChild(s)}

productionPage=async function(){
  injectStyle();const initial=await buildOperationsPlan(new Date());pageTitle.textContent='Operations';backBtn.classList.add('hidden');if(typeof navState==='function')navState('production');
  const render=async(stage,date)=>{const p=await buildOperationsPlan(date);const root=document.getElementById('opRoot');if(!root)return;const rows=stage==='production'?productionRows(p):stage==='finishing'?(p.finishing.map((r,i)=>orderCard(r,'finishing',i)).join('')||'<div class="card op-empty">No orders waiting for finishing.</div>'):stage==='painting'?(p.painting.map((r,i)=>orderCard(r,'painting',i)).join('')||'<div class="card op-empty">No orders waiting for painting.</div>'):deliveryRows(p);root.innerHTML=`${targetPanel(p,stage==='delivery'?p.deliveryValue:p.basket.value,stage==='delivery'?p.deliveryState:p.targetState)}<div class="op-stage-kpis"><div><small>Production</small><strong>${p.production.length}</strong></div><div><small>Finishing</small><strong>${p.finishing.length}</strong></div><div><small>Painting</small><strong>${p.painting.length}</strong></div><div><small>Delivery ready</small><strong>${p.deliveryReady.length}</strong></div></div><div class="op-tabs"><button data-stage="production">Production</button><button data-stage="finishing">Finishing</button><button data-stage="painting">Painting</button><button data-stage="delivery">Delivery</button></div><div class="section-head"><div><h2>${stage[0].toUpperCase()+stage.slice(1)} · ${safe(display(p.date))}</h2><p class="muted">The same daily target drives priorities through every stage.</p></div></div>${rows}<div class="actions"><button onclick="opPrint('${stage}','${p.date}')">Print ${stage} worksheet</button>${stage==='delivery'?`<button class="primary" onclick="opApplyDeliveryPlan('${p.date}')">Apply suggested delivery plan</button>`:''}</div>`;root.querySelectorAll('[data-stage]').forEach(b=>{b.classList.toggle('active',b.dataset.stage===stage);b.onclick=()=>render(b.dataset.stage,p.date)});document.getElementById('opDate').value=p.date;document.getElementById('opDate').onchange=e=>render(stage,e.target.value)};
  main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Unified operations planner · V9</div><h2>Production → Finishing → Painting → Delivery</h2><p class="muted">One live plan from open orders, stock, capacity and the daily invoice target. No duplicate target logic.</p></div></div><label>Work date<input id="opDate" type="date" value="${initial.date}"></label><div class="op-toolbar"><button class="primary" onclick="opPrint('all',document.getElementById('opDate').value)">Print all 4 worksheets / Save PDF</button><button onclick="openOrderCompletionSchedule()">Completion schedule</button></div></section><div id="opRoot"></div>`;
  await render('production',initial.date);window.scrollTo({top:0,behavior:'smooth'});
};
})();