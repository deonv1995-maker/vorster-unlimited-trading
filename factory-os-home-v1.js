(function(){
'use strict';
if(window.VUFactoryOSHome)return;

const e=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const shared=['Shared Access','Connect and sync authorised devices','shared-access'];
const categories={
 Management:[
  ['Production',[['Casting','Casting priority and output','manufacturing-casting'],['Packing','Packing priority and output','manufacturing-packing'],['Resin','Resin priority, output and dependencies','manufacturing-resin'],['Finishing & Painting','Customer/order focus and colour batches','painting']]],
  ['Orders & Office',[['Orders','Active jobs and Sage imports','orders'],['Product Setup','New Sage items needing factory classification','product-setup'],['Print Centre','On-demand operational worksheets','print-centre']]],
  ['Delivery & Dispatch',[['Delivery Calendar','Projected delivery dates, completion and sendable value','delivery-calendar'],['Deliveries','Two-vehicle daily planning','deliveries'],['Invoice Prep','Sage invoices from confirmed vehicle loads','invoice-prep'],['Today’s Dispatches','Record delivered, partial or failed stops','dispatch-completion'],['Collections','Collection readiness','collections']]],
  ['Stock & Products',[['Stock','Inventory and adjustments','stock'],['Manufacturing Capacity','Daily capacity and mould quantity per product','manufacturing-capacity']]],
  ['Management & System',[['Planning','Targets, capacity and risks','planning'],shared]]
 ],
 Office:[['Orders & Office',[['Import / Update Orders','Import Sage job cards and revisions','order-intake'],['Order Status','Customer and job progress','orders'],['Print Centre','Print current operational sheets','print-centre']]],['Delivery & Dispatch',[['Delivery Calendar','Projected delivery dates, completion and sendable value','delivery-calendar'],['Delivery Schedule','Read delivery plans','deliveries'],['Invoice Prep','Prepare Sage invoices for confirmed loads','invoice-prep'],['Today’s Dispatches','Update customer delivery results','dispatch-completion'],['Collection Schedule','Read collection readiness','collections']]],['System',[shared]]],
 Casting:[['Casting',[['Today’s Casting','Casting requirements only','division'],['Casting Stock','Record output and adjustments','stock']]],['System',[shared]]],
 Packing:[['Packing',[['Today’s Packing','Packing requirements only','division'],['Packing Stock','Record output and adjustments','stock']]],['System',[shared]]],
 Resin:[['Resin',[['Today’s Resin','Resin requirements and dependencies only','division'],['Resin Stock','Record output and adjustments','stock']]],['System',[shared]]],
 Painting:[['Finishing & Painting',[['Finishing & Painting','Customer/order focus and colour batches','division'],['Finished Stock','Record completed quantities','stock']]],['System',[shared]]],
 Delivery:[['Delivery & Dispatch',[['Delivery Calendar','Projected dates and current readiness','delivery-calendar'],['Today’s Deliveries','Vehicle loads and stops','deliveries'],['Complete Stops','Record delivery results','dispatch-completion'],['Collections','Collection readiness','collections']]],['System',[shared]]]
};

const rand=n=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(Number(n||0));
const dayFmt=new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long'});
const shortFmt=new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'});
const dateKey=v=>{if(!v)return'';const raw=String(v).slice(0,10),d=new Date(`${raw}T12:00:00`);return Number.isNaN(d.getTime())?'':raw};
const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(key,n)=>{const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const formatDate=key=>{const d=new Date(`${key}T12:00:00`);return Number.isNaN(d.getTime())?key:shortFmt.format(d)};
const isCollection=o=>/collection/i.test(String(o.fulfilmentType||o.preference||''));

const categoryMarkup=(name,items,open=false)=>`<details class="factory-os-category"${open?' open':''}><summary><span><strong>${e(name)}</strong><small>${items.length} ${items.length===1?'section':'sections'}</small></span><b aria-hidden="true">⌄</b></summary><div class="factory-os-grid">${items.map(([t,d,a])=>`<button class="factory-os-card" data-fos-action="${e(a)}"><strong>${e(t)}</strong><span>${e(d)}</span></button>`).join('')}</div></details>`;

function workingDays(start,count=5){
 const out=[];let cursor=start;
 while(out.length<count){const d=new Date(`${cursor}T12:00:00`);if(d.getDay()!==0&&d.getDay()!==6)out.push(cursor);cursor=addDays(cursor,1)}
 return out;
}

function schedulePlans(snapshot){
 const orders=new Map(snapshot.activeOrders.map(o=>[String(o.id),o]));
 return (snapshot.deliveries||[])
  .filter(x=>x?.kind==='DELIVERY_CALENDAR_PLAN'&&dateKey(x.plannedDeliveryDate))
  .map(x=>{const order=orders.get(String(x.orderId));return order?{...x,order,value:VUFactoryOS.orderRemainingValue(order)}:null})
  .filter(Boolean);
}

function productionSummary(snapshot){
 const req=VUFactoryOS.requirements(snapshot);
 return ['Casting','Packing','Resin','Painting'].map(name=>{
  const rows=req[name]||[];
  return{name,lines:rows.length,qty:rows.reduce((s,r)=>s+Number(r.qtyRequired||0),0),value:rows.reduce((s,r)=>s+Number(r.remainingValue||0),0)};
 });
}

function diaryRows(snapshot,plans){
 const today=todayKey(),rows=[];
 const todayPlans=plans.filter(p=>dateKey(p.plannedDeliveryDate)===today);
 if(todayPlans.length)rows.push({tone:'accent',title:`${todayPlans.length} delivery ${todayPlans.length===1?'order':'orders'} planned today`,detail:`${rand(todayPlans.reduce((s,p)=>s+p.value,0))} outstanding order value on today’s calendar`,action:'delivery-calendar'});
 const overdue=snapshot.activeOrders.filter(o=>dateKey(o.dueDate)&&dateKey(o.dueDate)<today);
 if(overdue.length)rows.push({tone:'danger',title:`${overdue.length} overdue ${overdue.length===1?'order':'orders'} need review`,detail:`${rand(overdue.reduce((s,o)=>s+VUFactoryOS.orderRemainingValue(o),0))} still outstanding`,action:'orders'});
 const dueToday=snapshot.activeOrders.filter(o=>dateKey(o.dueDate)===today);
 if(dueToday.length)rows.push({tone:'warning',title:`${dueToday.length} ${dueToday.length===1?'order is':'orders are'} due today`,detail:`${rand(dueToday.reduce((s,o)=>s+VUFactoryOS.orderRemainingValue(o),0))} remaining`,action:'orders'});
 const collections=snapshot.activeOrders.filter(isCollection);
 if(collections.length)rows.push({tone:'plain',title:`${collections.length} active ${collections.length===1?'collection':'collections'}`,detail:'Keep collection readiness visible alongside deliveries',action:'collections'});
 if(!rows.length)rows.push({tone:'plain',title:'No urgent diary flags from current records',detail:'Open Planning or Orders to add and review the next commitments.',action:'planning'});
 return rows.slice(0,5);
}

function managementHub(snapshot,sync,member){
 const cfg=snapshot.settings,today=todayKey(),plans=schedulePlans(snapshot),prod=productionSummary(snapshot),diary=diaryRows(snapshot,plans),days=workingDays(today,5);
 const deliveryOrders=snapshot.activeOrders.filter(o=>!isCollection(o)),collections=snapshot.activeOrders.filter(isCollection);
 const todayPlanned=plans.filter(p=>dateKey(p.plannedDeliveryDate)===today);
 return `<section class="factory-os-home hub-home">
  <div class="hub-hero">
   <div><div class="eyebrow">BUSINESS DIARY · ${e(dayFmt.format(new Date()))}</div><h2>Vorster Unlimited</h2><p>${navigator.onLine?'Online':'Offline mode'}${member?` · Shared ${e(sync?.state==='ready'?'connected':sync?.state||'connected')}`:' · This device is local only'}</p></div>
   <button class="hub-today-button" data-fos-action="planning"><span>Today</span><strong>${snapshot.activeOrders.length}</strong><small>active orders</small></button>
  </div>

  <div class="hub-value-strip">
   <button data-fos-action="orders"><span>Outstanding orders</span><strong>${rand(snapshot.outstandingOrderValue)}</strong><small>${snapshot.activeOrders.length} active</small></button>
   <button data-fos-action="delivery-calendar"><span>Today’s planned value</span><strong>${rand(todayPlanned.reduce((s,p)=>s+p.value,0))}</strong><small>${todayPlanned.length} scheduled</small></button>
   <button data-fos-action="deliveries"><span>Delivery orders</span><strong>${deliveryOrders.length}</strong><small>${cfg.vehicleCount||2} vehicles available</small></button>
   <button data-fos-action="collections"><span>Collections</span><strong>${collections.length}</strong><small>active orders</small></button>
  </div>

  <div class="hub-section-head"><div><div class="step-label">THIS WORKING WEEK</div><h3>Calendar</h3></div><button data-fos-action="delivery-calendar">Open calendar →</button></div>
  <div class="hub-calendar-strip">${days.map(day=>{const rows=plans.filter(p=>dateKey(p.plannedDeliveryDate)===day),value=rows.reduce((s,p)=>s+p.value,0);return `<button class="hub-day${day===today?' is-today':''}" data-fos-action="delivery-calendar"><span>${e(formatDate(day))}</span><strong>${rows.length}</strong><small>${rows.length===1?'order':'orders'}</small><b>${rand(value)}</b></button>`}).join('')}</div>

  <div class="hub-columns">
   <section class="hub-panel">
    <div class="hub-section-head"><div><div class="step-label">OPERATING DIARY</div><h3>What needs attention</h3></div></div>
    <div class="hub-diary">${diary.map(r=>`<button class="hub-diary-row is-${e(r.tone)}" data-fos-action="${e(r.action)}"><i></i><span><strong>${e(r.title)}</strong><small>${e(r.detail)}</small></span><b>›</b></button>`).join('')}</div>
   </section>
   <section class="hub-panel">
    <div class="hub-section-head"><div><div class="step-label">PRODUCTION LOAD</div><h3>Required by division</h3></div><button data-fos-action="planning">Planning →</button></div>
    <div class="hub-production">${prod.map(p=>`<button data-fos-action="${p.name==='Painting'?'painting':`manufacturing-${p.name.toLowerCase()}`}"><span>${e(p.name)}</span><strong>${Math.round(p.qty)}</strong><small>units · ${p.lines} lines</small><b>${rand(p.value)}</b></button>`).join('')}</div>
   </section>
  </div>

  <div class="hub-target-line"><span>Daily dispatch guide</span><strong>Minimum ${rand(cfg.dailyDispatchMinimum)}</strong><strong>Profit target ${rand(cfg.dailyProfitTarget)}</strong></div>

  <details class="hub-tools"><summary><span><strong>Operations & admin tools</strong><small>Open detailed factory, office, stock and system screens</small></span><b>⌄</b></summary><div class="factory-os-categories">${categories.Management.map(g=>categoryMarkup(g[0],g[1],false)).join('')}</div></details>
 </section>`;
}

async function render(){
 const role=VUFactoryOS.role(),s=await VUFactoryOS.snapshot(),sync=window.VUSharedAccess?.status?.(),member=window.VUSharedAccess?.membership?.();
 pageTitle.textContent=role==='Management'?'Operations Hub':'Factory OS';
 document.getElementById('backBtn')?.classList.add('hidden');
 if(role==='Management'){main.innerHTML=managementHub(s,sync,member);return}
 const groups=categories[role]||categories.Management;
 main.innerHTML=`<section class="factory-os-home"><div class="factory-os-hero"><div><div class="eyebrow">VORSTER FACTORY OS</div><h2>${e(role)}</h2><p>${navigator.onLine?'Online':'Offline mode'}${member?` · Shared ${e(sync?.state==='ready'?'connected':sync?.state||'connected')}`:' · This device is local only'}</p></div><div class="factory-os-metric"><strong>${s.activeOrders.length}</strong><span>active jobs</span></div></div><div class="factory-os-categories">${groups.map((g,i)=>categoryMarkup(g[0],g[1],i===0)).join('')}</div></section>`;
}

window.VUFactoryOSHome={version:'2.9.0',render};
})();