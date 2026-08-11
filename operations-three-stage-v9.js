/* V9.0.51 — authoritative division-aware Operations renderer.
   Factory flow remains Production -> Finishing & Painting -> Delivery.
   Production is split into Casting, Packing, Resin and Painting using the existing product
   manufacturing classification. No duplicate stock or workflow databases are introduced. */
(function(){
'use strict';
const CLOSED=new Set(['draft','cancelled','delivered','collected','completed','invoiced']);
const DIVISIONS=['Casting','Packing','Resin','Painting'];
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
function productDivision(p){
  const d=String(p?.worksheetDivision||p?.primaryDivision||'').trim();
  if(DIVISIONS.includes(d))return d;
  const methods=String(p?.manufacturingMethods||'').split('|').map(x=>x.trim()).filter(Boolean);
  return DIVISIONS.find(x=>methods.includes(x))||'Unclassified';
}
function productionDivision(line,byId,byCode){
  const p=byId.get(String(line?.productId||''))||byCode.get(norm(line?.productCode));
  return productDivision(p);
}

const sequentialForecast=window.VUSequentialWorkflowForecast||window.buildWorkflowForecast;
async function buildThreeStagePlan(selected){
  const date=workday(selected||new Date());
  const base=typeof sequentialForecast==='function'?await sequentialForecast(date):{date,productionItems:[],rows:[]};
  const [orders,customers,balances,products]=await Promise.all([getAll('orders'),getAll('customers'),getAll('inventoryBalances'),getAll('products')]);
  const customerById=new Map(customers.map(c=>[String(c.id),c]));
  const productById=new Map(products.map(p=>[String(p.id),p]));
  const productByCode=new Map(products.map(p=>[norm(p.code),p]));
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

  const productionByDivision={Casting:[],Packing:[],Resin:[],Painting:[],Unclassified:[]};
  for(const item of base.productionItems||[]){
    const division=productionDivision(item,productById,productByCode);
    (productionByDivision[division]||(productionByDivision[division]=[])).push({...item,manufacturingDivision:division});
  }
  return {...base,date,products,productById,productByCode,productionByDivision,finishing:finishPaint,painting:[],finishingPainting:finishPaint,deliveryReady:deliveryCapable,delivery,deliveryValue,deliveryState:{gap:Math.max(0,target-deliveryValue),surplus:Math.max(0,deliveryValue-target),ok:target>0&&deliveryValue>=target},threeStageFlow:true};
}
window.buildWorkflowForecast=buildThreeStagePlan;
window.VUThreeStagePlan=buildThreeStagePlan;

function normalLines(r){return(r.order?.lines||[]).filter(l=>productLine(l)&&n(l.qty)>0).map(l=>`<div class="op-line"><span><b>${safe(l.productCode||l.code||'')}</b> ${safe(l.productName||l.name||'')}<small>${safe(colour(l))}</small></span><strong>${n(l.qty)}</strong></div>`).join('')}
function fpLines(r){return(r.workLines||[]).map(x=>`<div class="op-line"><span><b>${safe(x.line.productCode||x.line.code||'')}</b> ${safe(x.line.productName||x.line.name||'')}<small>${safe(colour(x.line))} · ${safe(x.source||'Available')}</small></span><strong>${n(x.workQty)} / ${n(x.required)}</strong></div>`).join('')}
function orderCard(r,stage,index){const o=r.order;const lines=stage==='finishing-painting'?fpLines(r):normalLines(r);const note=stage==='delivery'&&r.actualStage!=='delivery'?'<p class="muted">Can be finished & painted before loading today.</p>':'';return `<section class="card op-order"><div class="op-head"><div>${r.targetOrder?'<span class="op-priority">TARGET</span>':''}<small>Priority ${index+1} · ${safe(o.orderNumber||'Order')} · ${safe(r.area||'')}</small><h3>${safe(o.customerName||'Customer')}</h3></div></div>${lines}${note}<div class="actions"><button onclick="viewOrder('${o.id}')">Details</button></div></section>`}
function productionRows(items){if(!(items||[]).length)return'<div class="card op-empty">No production is forecast for this division on this date.</div>';const map=new Map();for(const x of items){const k=`${x.productId}|${norm(x.colourName)}`;if(!map.has(k))map.set(k,{...x,quantity:0,orders:[]});const r=map.get(k);r.quantity+=n(x.quantity);r.orders.push(`${x.orderNumber||''} ${x.customerName||''}`)}return[...map.values()].map((r,i)=>`<section class="card op-order"><div class="op-head"><div>${r.targetOrder?'<span class="op-priority">TARGET</span>':''}<small>${safe(r.manufacturingDivision||'Production')} priority ${i+1}</small><h3>${safe(r.productCode||'')} · ${safe(r.productName||'')}</h3><small>${safe(r.colourName||'Standard')} · ${safe(r.orders.join(' · '))}</small></div><strong>${n(r.quantity)} units</strong></div></section>`).join('')}

const printStyle='@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font:10.5px Arial;color:#111;margin:0}.bar{text-align:center;margin:8px}.sheet{page-break-after:always}.head{border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px}.head h1{margin:0;font-size:20px}.job{border:1.5px solid #555;padding:7px;margin:7px 0;break-inside:avoid}.line{display:grid;grid-template-columns:1fr 75px 95px;gap:6px;align-items:center}.write{height:25px;border:2px solid #111}.muted{color:#444}.foot{border-top:1px solid #111;margin-top:12px;padding-top:8px}.empty{border:1px dashed #999;padding:16px;text-align:center}@media print{.bar{display:none}.sheet:last-child{page-break-after:auto}}';
function productionSheet(plan,division){
  const items=plan.productionByDivision?.[division]||[];
  const rows=items.map((r,i)=>`<div class="job"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><div class="line"><div><b>${safe(r.productCode||'')} · ${safe(r.productName||'')}</b><br><span class="muted">${safe(r.colourName||'Standard')} · ${safe(r.orderNumber||'')} ${safe(r.customerName||'')}</span></div><b>${n(r.quantity)}</b><div><div class="write"></div><small>Qty completed</small></div></div></div>`).join('');
  return `<section class="sheet"><div class="head"><h1>${safe(division)} Production Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${items.length} production lines</div></div>${rows||`<div class="empty">No ${safe(division.toLowerCase())} production work planned for this date.</div>`}<div class="foot">${safe(division)} supervisor: ____________________ &nbsp; Completed: ________</div></section>`;
}
function finishingSheet(plan){const rows=plan.finishingPainting||[];return `<section class="sheet"><div class="head"><h1>Finishing & Painting Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${rows.length} orders</div></div>${rows.length?rows.map((r,i)=>`<div class="job"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><b>${safe(r.order.orderNumber||'')} · ${safe(r.order.customerName||'')}</b>${(r.workLines||[]).map(x=>`<div class="line"><div>${safe(x.line.productCode||'')} · ${safe(x.line.productName||'')}<br><span class="muted">${safe(colour(x.line))} · ${safe(x.source||'')}</span></div><b>${n(x.workQty)}</b><div><div class="write"></div><small>Qty completed</small></div></div>`).join('')}</div>`).join(''):'<div class="empty">No finishing or painting work planned for this date.</div>'}<div class="foot">Finishing & Painting supervisor: ____________________ &nbsp; Completed: ________</div></section>`}
function deliverySheet(plan){const rows=plan.delivery||[];return `<section class="sheet"><div class="head"><h1>Delivery & Collection Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${rows.length} stops</div></div>${rows.length?rows.map((r,i)=>`<div class="job"><div class="muted">Stop ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><b>${safe(r.order.orderNumber||'')} · ${safe(r.order.customerName||'')} · ${safe(r.area||'')}</b>${(r.order.lines||[]).filter(l=>productLine(l)&&n(l.qty)>0).map(l=>`<div class="line"><div>${safe(l.productCode||'')} · ${safe(l.productName||'')}<br><span class="muted">${safe(colour(l))}</span></div><b>${n(l.qty)}</b><div><div class="write"></div><small>Loaded</small></div></div>`).join('')}</div>`).join(''):'<div class="empty">No delivery or collection work planned for this date.</div>'}<div class="foot">Vehicle: ____________________ &nbsp; Driver: ____________________ &nbsp; Departed: ________</div></section>`}
function openPrint(title,body){const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return;}w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(title)}</title><style>${printStyle}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${body}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},250)}
window.opPrint=async function(stage,date,division=''){
  const plan=await buildThreeStagePlan(date||new Date());
  if(stage==='all')return openPrint('Daily Factory Worksheets',DIVISIONS.map(d=>productionSheet(plan,d)).join('')+finishingSheet(plan)+deliverySheet(plan));
  if(stage==='production-all')return openPrint('Production Division Worksheets',DIVISIONS.map(d=>productionSheet(plan,d)).join(''));
  if(stage==='production')return openPrint(`${division||'Production'} Worksheet`,productionSheet(plan,division||'Casting'));
  if(stage==='finishing-painting')return openPrint('Finishing & Painting Worksheet',finishingSheet(plan));
  if(stage==='delivery')return openPrint('Delivery Worksheet',deliverySheet(plan));
};
try{opPrint=window.opPrint}catch{}

window.productionPage=async function productionPageThreeStage(){
  pageTitle.textContent='Operations';backBtn.classList.add('hidden');if(typeof navState==='function')navState('production');
  main.innerHTML='<section class="card"><p class="muted">Loading factory plan…</p></section>';
  await new Promise(r=>setTimeout(r,0));
  let current=await buildThreeStagePlan(new Date()),stage='production',division='Casting';
  const draw=()=>{
    let rows='';
    if(stage==='production')rows=productionRows(current.productionByDivision?.[division]||[]);
    else if(stage==='finishing-painting')rows=(current.finishingPainting||[]).map((r,i)=>orderCard(r,'finishing-painting',i)).join('')||'<div class="card op-empty">No raw stock or same-day production is available for finishing & painting.</div>';
    else rows=(current.delivery||[]).map((r,i)=>orderCard(r,'delivery',i)).join('')||'<div class="card op-empty">No orders can be completed for delivery on this date.</div>';
    const label=stage==='production'?`${division} Production`:stage==='finishing-painting'?'Finishing & Painting':'Delivery';
    const divisionTabs=stage==='production'?`<div class="op-division-tabs">${DIVISIONS.map(d=>`<button data-division="${d}" class="${d===division?'active':''}">${d}</button>`).join('')}</div>`:'';
    const printCurrent=stage==='production'?`<button onclick="opPrint('production',document.getElementById('opDate').value,'${division}')">Print ${division} worksheet</button><button onclick="opPrint('production-all',document.getElementById('opDate').value)">Print all 4 production worksheets</button>`:stage==='finishing-painting'?`<button onclick="opPrint('finishing-painting',document.getElementById('opDate').value)">Print Finishing & Painting</button>`:`<button onclick="opPrint('delivery',document.getElementById('opDate').value)">Print Delivery</button>`;
    main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Division-aware live planner · V9.0.51</div><h2>Production → Finishing & Painting → Delivery</h2></div></div><label>Work date<input id="opDate" type="date" value="${current.date}"></label><div class="op-toolbar"><button class="primary" onclick="opPrint('all',document.getElementById('opDate').value)">Print complete factory pack / Save PDF</button>${printCurrent}<button onclick="openOrderCompletionSchedule()">Completion schedule</button></div></section><div class="op-tabs op-tabs-three"><button data-stage="production">Production</button><button data-stage="finishing-painting">Finishing & Painting</button><button data-stage="delivery">Delivery</button></div>${divisionTabs}<div class="section-head"><h2>${safe(label)} · ${safe(display(current.date))}</h2></div>${rows}`;
    document.querySelectorAll('[data-stage]').forEach(b=>{b.classList.toggle('active',b.dataset.stage===stage);b.onclick=()=>{stage=b.dataset.stage;draw()}});
    document.querySelectorAll('[data-division]').forEach(b=>b.onclick=()=>{division=b.dataset.division;draw()});
    document.getElementById('opDate').onchange=async e=>{current=await buildThreeStagePlan(e.target.value);draw()};
  };
  draw();window.scrollTo({top:0,behavior:'smooth'});
};
try{productionPage=window.productionPage}catch{}
const st=document.createElement('style');st.textContent='.op-tabs-three{display:grid!important;grid-template-columns:1fr 1.4fr 1fr!important}.op-tabs-three button{min-width:0!important;white-space:normal!important}.op-division-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.op-division-tabs button{min-width:0;padding:10px 6px}.op-division-tabs button.active{background:var(--accent);color:#fff}.op-toolbar{display:flex;flex-wrap:wrap;gap:8px}@media(max-width:520px){.op-tabs-three{grid-template-columns:1fr!important}.op-tabs-three button{width:100%!important}.op-division-tabs{grid-template-columns:1fr 1fr}.op-toolbar>*{flex:1 1 100%}}';document.head.appendChild(st);
window.VUOperationsDivisionWorksheets={DIVISIONS,productionSheet,finishingSheet,deliverySheet,buildThreeStagePlan};
})();
