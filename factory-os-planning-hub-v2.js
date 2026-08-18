/* Vorster Planning Hub 3.0.0 — order-first visual diary and calendar. */
(function(){
'use strict';
const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const n=v=>Math.max(0,Number(v||0));
const money=v=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(n(v));
const dateKey=v=>{if(!v)return'';const raw=String(v).slice(0,10),d=new Date(`${raw}T12:00:00`);return Number.isNaN(d.getTime())?'':raw};
const todayKey=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(key,x)=>{const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+x);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmt=key=>{if(!key)return'Not scheduled';const d=new Date(`${key}T12:00:00`);return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(d)};
const longFmt=key=>{const d=new Date(`${key}T12:00:00`);return new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long'}).format(d)};
function q(line){return n(line?.quantity||line?.qty||line?.orderedQty)}
function nominated(line){return Math.min(q(line),n(line?.nominatedQty))}
function stats(o){let ordered=0,nom=0;for(const l of o.lines||[]){ordered+=q(l);nom+=nominated(l)}return{ordered,nom,short:Math.max(0,ordered-nom),pct:ordered?Math.round(nom/ordered*100):null}}
function planDate(o){return dateKey(o.plannedDate||o.manualPlannedDeliveryDate||o.plannedDeliveryDate||o.collectionDate||o.deliveryDate)}
function mode(o){return String(o.fulfilmentType||o.preference||'Plan pending')}
function isReady(o){const s=stats(o);return s.ordered>0&&s.short===0}
async function orders(){await window.VUOrderDiary?.seedKnownOrders?.();return(await getAll('orders')).filter(o=>String(o.source||'').toLowerCase().includes('planning-diary')).sort((a,b)=>(planDate(a)||'9999').localeCompare(planDate(b)||'9999')||String(a.customerName||'').localeCompare(String(b.customerName||'')))}
function startMonday(key){const d=new Date(`${key}T12:00:00`),day=d.getDay(),delta=day===0?-6:1-day;d.setDate(d.getDate()+delta);return dateKey(d.toISOString())}
function nextWorkingDays(start,count=5){const out=[];let cursor=start;while(out.length<count){const d=new Date(`${cursor}T12:00:00`);if(d.getDay()!==0&&d.getDay()!==6)out.push(cursor);cursor=addDays(cursor,1)}return out}
function knownValue(rows){return rows.reduce((s,o)=>s+n(o.orderTotalInclVat),0)}
function orderCard(o){const s=stats(o),p=planDate(o),ready=isReady(o);return`<button class="vuph-order${ready?' is-ready':''}" data-vuph-order="${safe(o.id)}" type="button"><div><strong>${safe(o.customerName||'Customer')}</strong><small>${safe(o.orderNumber||'Order details pending')} · ${safe(mode(o))}</small><em>${p?safe(fmt(p)):'Date not set'}${o.planningNote?` · ${safe(o.planningNote)}`:''}</em></div><div class="vuph-order-state">${s.pct==null?'<b>Job card needed</b>':`<b>${s.nom}/${s.ordered} nominated</b><small>${s.short} short</small>`}${o.orderTotalInclVat?`<strong>${money(o.orderTotalInclVat)}</strong>`:'<strong>Value pending</strong>'}</div></button>`}
function bindOrders(){document.querySelectorAll('[data-vuph-order]').forEach(b=>b.onclick=()=>window.VUOrderDiary?.openOrder?.(b.dataset.vuphOrder))}
function dayTile(k,list,today){const rows=list.filter(o=>planDate(o)===k),value=knownValue(rows);return`<button class="hub-day${k===today?' is-today':''}" data-vuph-date="${k}"><span>${safe(fmt(k))}</span><strong>${rows.length}</strong><small>${rows.length===1?'order':'orders'}</small><b>${money(value)}</b></button>`}

async function renderHome(){
 const list=await orders(),today=todayKey(),scheduled=list.filter(o=>planDate(o)),unscheduled=list.filter(o=>!planDate(o)),detailsPending=list.filter(o=>!(o.lines||[]).length),days=nextWorkingDays(today,5),todayRows=list.filter(o=>planDate(o)===today),weekRows=list.filter(o=>{const p=planDate(o);return p&&p>=today&&p<=addDays(today,6)}),urgent=[...list].filter(o=>planDate(o)&&planDate(o)>=today).sort((a,b)=>planDate(a).localeCompare(planDate(b))).slice(0,5);
 pageTitle.textContent='Planning Hub';backBtn.classList.add('hidden');
 main.innerHTML=`<section class="factory-os-home hub-home vuph-home">
  <div class="hub-hero"><div><div class="eyebrow">ORDER DIARY · ${safe(longFmt(today))}</div><h2>Vorster Unlimited</h2><p>This is the working record for customer orders, commitments and nominated quantities.</p></div><button class="hub-today-button" data-fos-action="orders"><span>Orders</span><strong>${list.length}</strong><small>tracked</small></button></div>
  <div class="hub-value-strip">
   <button data-fos-action="orders"><span>Tracked orders</span><strong>${list.length}</strong><small>${scheduled.length} dated</small></button>
   <button data-fos-action="delivery-calendar"><span>Today</span><strong>${todayRows.length}</strong><small>${money(knownValue(todayRows))}</small></button>
   <button data-fos-action="delivery-calendar"><span>Next 7 days</span><strong>${money(knownValue(weekRows))}</strong><small>${weekRows.length} planned</small></button>
   <button data-fos-action="orders"><span>Job cards needed</span><strong>${detailsPending.length}</strong><small>${unscheduled.length} also need dates</small></button>
  </div>
  <div class="hub-section-head"><div><div class="step-label">THIS WORKING WEEK</div><h3>Order calendar</h3></div><button data-fos-action="delivery-calendar">Open calendar →</button></div>
  <div class="hub-calendar-strip">${days.map(k=>dayTile(k,list,today)).join('')}</div>
  <section class="hub-panel"><div class="hub-section-head"><div><div class="step-label">NEXT COMMITMENTS</div><h3>What needs attention</h3></div></div><div class="vuph-attention">${urgent.map(orderCard).join('')||'<div class="empty">No dated commitments yet.</div>'}${unscheduled.slice(0,3).map(orderCard).join('')}</div></section>
  <section class="hub-panel"><div class="hub-section-head"><div><div class="step-label">ACTIVE ORDERS</div><h3>Working list</h3></div><button data-fos-action="orders">All orders →</button></div><div class="vuph-order-list">${list.map(orderCard).join('')||'<div class="empty">No tracked orders yet.</div>'}</div></section>
 </section>`;
 bindOrders();document.querySelectorAll('[data-vuph-date]').forEach(b=>b.onclick=()=>openCalendar(b.dataset.vuphDate));style();
}

let week=null,selected=null;
async function openCalendar(initial){
 const list=await orders(),today=todayKey();
 if(initial){selected=dateKey(initial);week=startMonday(selected)}
 if(!selected)selected=today;if(!week)week=startMonday(selected);
 pageTitle.textContent='Order Calendar';backBtn.classList.remove('hidden');backBtn.onclick=()=>renderHome();
 const days=Array.from({length:7},(_,i)=>addDays(week,i));
 main.innerHTML=`<section class="card vuph-calendar-head"><div class="step-label">ORDER PLANNING</div><h2>Order Calendar</h2><p class="muted">Only dates we have explicitly planned are shown here. An order can stay in the database without a date or full job-card details.</p></section>
 <section class="card"><div class="fos-cal-nav"><button class="secondary" id="vuphPrev">←</button><strong>${safe(fmt(days[0]))} – ${safe(fmt(days[6]))}</strong><button class="secondary" id="vuphNext">→</button></div><div class="vuph-week">${days.map(k=>{const rows=list.filter(o=>planDate(o)===k);return`<button class="vuph-day${k===selected?' is-selected':''}" data-vuph-day="${k}"><span>${safe(fmt(k))}</span><strong>${rows.length}</strong><small>${rows.length===1?'order':'orders'}</small><b>${money(knownValue(rows))}</b></button>`}).join('')}</div></section>
 <section class="card" id="vuphDay"></section>
 <section class="card"><div class="section-head"><div><h3>Waiting for a date</h3><p class="muted">These orders remain visible until we decide when they should go out.</p></div></div><div class="vuph-order-list">${list.filter(o=>!planDate(o)).map(orderCard).join('')||'<div class="empty">Every tracked order currently has a planned date.</div>'}</div></section>`;
 function renderDay(){const rows=list.filter(o=>planDate(o)===selected),box=document.getElementById('vuphDay');box.innerHTML=`<div class="section-head"><div><div class="step-label">SELECTED DAY</div><h2>${safe(longFmt(selected))}</h2><p class="muted">${rows.length} planned order${rows.length===1?'':'s'} · ${money(knownValue(rows))} known value</p></div></div><div class="vuph-order-list">${rows.map(orderCard).join('')||'<div class="empty">No orders are planned for this day.</div>'}</div>`;bindOrders();document.querySelectorAll('[data-vuph-day]').forEach(b=>b.classList.toggle('is-selected',b.dataset.vuphDay===selected))}
 renderDay();document.querySelectorAll('[data-vuph-day]').forEach(b=>b.onclick=()=>{selected=b.dataset.vuphDay;renderDay()});
 document.getElementById('vuphPrev').onclick=()=>{week=addDays(week,-7);selected=week;openCalendar()};
 document.getElementById('vuphNext').onclick=()=>{week=addDays(week,7);selected=week;openCalendar()};
 bindOrders();style();
}

function style(){if(document.getElementById('vuphStyle'))return;const s=document.createElement('style');s.id='vuphStyle';s.textContent=`.vuph-home{padding-bottom:90px}.vuph-attention,.vuph-order-list{display:grid;gap:8px}.vuph-order{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;text-align:left;border:1px solid var(--line);border-radius:14px;background:var(--panel);color:var(--text);padding:13px}.vuph-order.is-ready{border-color:var(--accent)}.vuph-order>div:first-child{display:grid;gap:4px}.vuph-order small,.vuph-order em{color:var(--muted);font-style:normal;font-size:.78rem}.vuph-order em{line-height:1.35}.vuph-order-state{display:grid;gap:3px;text-align:right}.vuph-order-state strong{font-size:.85rem}.vuph-week{display:grid;grid-template-columns:repeat(7,minmax(92px,1fr));gap:8px;overflow-x:auto;padding-top:12px}.vuph-day{min-width:92px;border:1px solid var(--line);border-radius:13px;background:var(--panel);color:var(--text);padding:10px;text-align:center}.vuph-day span,.vuph-day small{display:block;color:var(--muted);font-size:.72rem}.vuph-day strong{display:block;font-size:1.25rem;margin:5px 0}.vuph-day b{display:block;margin-top:6px;font-size:.78rem}.vuph-day.is-selected{outline:2px solid var(--accent);outline-offset:1px}@media(max-width:620px){.vuph-order{grid-template-columns:1fr}.vuph-order-state{text-align:left;grid-template-columns:repeat(3,auto);justify-content:start;gap:10px}.hub-value-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}`;document.head.appendChild(s)}
window.VUOrderPlanningHub={version:'3.0.0',renderHome,openCalendar};
})();