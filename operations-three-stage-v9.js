/* V9.0.40 — authoritative three-stage Operations renderer.
   Factory flow: Production -> Finishing & Painting -> Delivery.
   Raw stock on hand and production planned for the selected day may feed Finishing & Painting the same day.
   Orders that can be fully completed through that flow may appear on Delivery the same day. */
(function(){
'use strict';
const CLOSED=new Set(['draft','cancelled','delivered','collected','completed','invoiced']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const targetValue=()=>typeof vuDailyInvoiceTarget==='function'?n(vuDailyInvoiceTarget()):n(localStorage.getItem('vu-daily-invoice-target'));
const dateKey=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const workday=v=>window.VUFactoryCalendar?.onOrAfter?VUFactoryCalendar.onOrAfter(v):dateKey(v);
const display=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${dateKey(v)}T12:00:00`));
function stageOf(o){const wf=norm(o?.workflowStage),fs=norm(o?.finishingStatus),ps=norm(o?.paintingStatus);if(['delivery','delivery-scheduled'].includes(wf)||ps==='completed')return'delivery';if(wf==='painting'||fs==='completed')return'painting';if(wf==='finishing'||o?.rawIssued===true)return'finishing';return'production'}
function dueSort(a,b){return String(a?.dueDate||'9999-12-31').localeCompare(String(b?.dueDate||'9999-12-31'))||new Date(a?.createdAt||0)-new Date(b?.createdAt||0)}
function area(o,c){return String(o?.deliveryArea||o?.area||c?.deliveryArea||c?.area||c?.suburb||c?.city||c?.location||'Area not set').split(',')[0].trim()||'Area not set'}
function rowKey(orderId,productId){return `${orderId}|${productId}`}

const sequentialForecast=window.VUSequentialWorkflowForecast||window.buildWorkflowForecast;
async function buildThreeStagePlan(selected){
  const date=workday(selected||new Date());
  const base=typeof sequentialForecast==='function'?await sequentialForecast(date):{date,productionItems:[],rows:[]};
  const [orders,customers,balances]=await Promise.all([getAll('orders'),getAll('customers'),getAll('inventoryBalances')]);
  const customerById=new Map(customers.map(c=>[String(c.id),c]));
  const raw=new Map();
  for(const b of balances){
    if(n(b.quantity)<=0)continue;
    const isRaw=norm(b.colourName)==='raw stock'||String(b.id||'').endsWith('::raw');
    if(!isRaw)continue;
    const pid=String(b.productId||'');raw.set(pid,n(raw.get(pid))+n(b.quantity));
  }
  const todayProduction=new Map();
  for(const p of base.productionItems||[]){const k=rowKey(p.orderId,p.productId);todayProduction.set(k,n(todayProduction.get(k))+n(p.quantity))}
  const baseByOrder=new Map((base.rows||[]).map(r=>[String(r.order?.id||''),r]));
  const open=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>productLine(l)&&n(l.qty)>0));
  open.sort((a,b)=>{const ar=baseByOrder.get(String(a.id)),br=baseByOrder.get(String(b.id));return (br?.targetOrder?1:0)-(ar?.targetOrder?1:0)||dueSort(a,b)});

  const finishPaint=[],deliveryCapable=[];
  for(const o of open){
    const actual=stageOf(o),baseRow=baseByOrder.get(String(o.id)),customer=customerById.get(String(o.customerId));
    const workLines=[];let full=true,totalRequired=0,totalReady=0;
    for(const l of(o.lines||[]).filter(x=>productLine(x)&&n(x.qty)>0)){
      const required=n(l.qty),pid=String(l.productId||''),k=rowKey(o.id,pid);totalRequired+=required;
      let ready=0,source='';
      if(actual==='finishing'||actual==='painting'||actual==='delivery'){ready=required;source=actual==='finishing'?'Already in finishing':actual==='painting'?'Already in painting':'Delivery ready'}
      else{
        const fromRaw=Math.min(required,n(raw.get(pid)));raw.set(pid,Math.max(0,n(raw.get(pid))-fromRaw));
        const remaining=Math.max(0,required-fromRaw),fromToday=Math.min(remaining,n(todayProduction.get(k)));todayProduction.set(k,Math.max(0,n(todayProduction.get(k))-fromToday));
        ready=fromRaw+fromToday;source=fromRaw&&fromToday?'Raw stock + today production':fromRaw?'Raw stock on hand':fromToday?'Today production':'';
      }
      totalReady+=ready;if(ready<required)full=false;
      if(ready>0)workLines.push({line:l,required,workQty:ready,source});
    }
    const row={...(baseRow||{}),order:o,customer,area:area(o,customer),actualStage:actual,targetOrder:!!baseRow?.targetOrder,workLines,totalRequired,totalReady,canCompleteToday:full&&totalRequired>0};
    if(actual!=='delivery'&&workLines.length)finishPaint.push(row);
    if(actual==='delivery'||row.canCompleteToday)deliveryCapable.push({...row,predictedStage:'delivery'});
  }
  const target=targetValue();let deliveryValue=0;const delivery=[];
  const explicitFirst=deliveryCapable.sort((a,b)=>(b.order?.deliveryDate?1:0)-(a.order?.deliveryDate?1:0)||(b.targetOrder?1:0)-(a.targetOrder?1:0)||dueSort(a.order,b.order));
  for(const r of explicitFirst){delivery.push(r);deliveryValue+=n(r.order.grandTotal);if(target>0&&deliveryValue>=target&&!r.order.deliveryDate)break}
  return {...base,date,finishing:finishPaint,painting:[],finishingPainting:finishPaint,deliveryReady:deliveryCapable,delivery,deliveryValue,deliveryState:{gap:Math.max(0,target-deliveryValue),surplus:Math.max(0,deliveryValue-target),ok:target>0&&deliveryValue>=target},threeStageFlow:true};
}
window.buildWorkflowForecast=buildThreeStagePlan;
window.VUThreeStagePlan=buildThreeStagePlan;

function normalLines(r){return(r.order?.lines||[]).filter(l=>productLine(l)&&n(l.qty)>0).map(l=>`<div class="op-line"><span><b>${safe(l.productCode||l.code||'')}</b> ${safe(l.productName||l.name||'')}<small>${safe(colour(l))}</small></span><strong>${n(l.qty)}</strong></div>`).join('')}
function fpLines(r){return(r.workLines||[]).map(x=>`<div class="op-line"><span><b>${safe(x.line.productCode||x.line.code||'')}</b> ${safe(x.line.productName||x.line.name||'')}<small>${safe(colour(x.line))} · ${safe(x.source||'Available')}</small></span><strong>${n(x.workQty)} / ${n(x.required)}</strong></div>`).join('')}
function orderCard(r,stage,index){const o=r.order;const lines=stage==='finishing-painting'?fpLines(r):normalLines(r);const note=stage==='delivery'&&r.actualStage!=='delivery'?'<p class="muted">Can be finished & painted before loading today.</p>':'';return `<section class="card op-order"><div class="op-head"><div>${r.targetOrder?'<span class="op-priority">TARGET</span>':''}<small>Priority ${index+1} · ${safe(o.orderNumber||'Order')} · ${safe(r.area||'')}</small><h3>${safe(o.customerName||'Customer')}</h3></div></div>${lines}${note}<div class="actions"><button onclick="viewOrder('${o.id}')">Details</button></div></section>`}
function productionRows(plan){if(!(plan.productionItems||[]).length)return'<div class="card op-empty">No production is forecast for this date.</div>';const map=new Map();for(const x of plan.productionItems){const k=`${x.productId}|${norm(x.colourName)}`;if(!map.has(k))map.set(k,{...x,quantity:0,orders:[]});const r=map.get(k);r.quantity+=n(x.quantity);r.orders.push(`${x.orderNumber||''} ${x.customerName||''}`)}return[...map.values()].map((r,i)=>`<section class="card op-order"><div class="op-head"><div>${r.targetOrder?'<span class="op-priority">TARGET</span>':''}<small>Production priority ${i+1}</small><h3>${safe(r.productCode||'')} · ${safe(r.productName||'')}</h3><small>${safe(r.colourName||'Standard')} · ${safe(r.orders.join(' · '))}</small></div><strong>${n(r.quantity)} units</strong></div></section>`).join('')}

window.productionPage=async function productionPageThreeStage(){
  pageTitle.textContent='Operations';backBtn.classList.add('hidden');if(typeof navState==='function')navState('production');
  main.innerHTML='<section class="card"><p class="muted">Loading factory plan…</p></section>';
  await new Promise(r=>setTimeout(r,0));
  let current=await buildThreeStagePlan(new Date()),stage='production';
  const draw=()=>{
    let rows='';
    if(stage==='production')rows=productionRows(current);
    else if(stage==='finishing-painting')rows=(current.finishingPainting||[]).map((r,i)=>orderCard(r,'finishing-painting',i)).join('')||'<div class="card op-empty">No raw stock or same-day production is available for finishing & painting.</div>';
    else rows=(current.delivery||[]).map((r,i)=>orderCard(r,'delivery',i)).join('')||'<div class="card op-empty">No orders can be completed for delivery on this date.</div>';
    const label=stage==='finishing-painting'?'Finishing & Painting':stage[0].toUpperCase()+stage.slice(1);
    main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Live three-stage planner · V9.0.40</div><h2>Production → Finishing & Painting → Delivery</h2></div></div><label>Work date<input id="opDate" type="date" value="${current.date}"></label><div class="op-toolbar"><button class="primary" onclick="opPrint('all',document.getElementById('opDate').value)">Print all 3 worksheets / Save PDF</button><button onclick="openOrderCompletionSchedule()">Completion schedule</button></div></section><div class="op-tabs op-tabs-three"><button data-stage="production">Production</button><button data-stage="finishing-painting">Finishing & Painting</button><button data-stage="delivery">Delivery</button></div><div class="section-head"><h2>${label} · ${safe(display(current.date))}</h2></div>${rows}`;
    document.querySelectorAll('[data-stage]').forEach(b=>{b.classList.toggle('active',b.dataset.stage===stage);b.onclick=()=>{stage=b.dataset.stage;draw()}});
    document.getElementById('opDate').onchange=async e=>{current=await buildThreeStagePlan(e.target.value);draw()};
  };
  draw();window.scrollTo({top:0,behavior:'smooth'});
};
try{productionPage=window.productionPage}catch{}
const st=document.createElement('style');st.textContent='.op-tabs-three{display:grid!important;grid-template-columns:1fr 1.4fr 1fr!important}.op-tabs-three button{min-width:0!important;white-space:normal!important}@media(max-width:520px){.op-tabs-three{grid-template-columns:1fr!important}.op-tabs-three button{width:100%!important}}';document.head.appendChild(st);
})();
