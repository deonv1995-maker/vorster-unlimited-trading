/* Version 8.4 pipeline intelligence.
   Open orders remain visible across Production, Finishing and Delivery forecasts until closed.
   Inventory changes automatically recalculate reservations, stage readiness and ETA forecasts.
   This layer does not duplicate stock: it reserves raw stock virtually until finishing consumes it. */
const VU_PIPELINE_INTELLIGENCE_VERSION='8.4.0';
const VU_FINAL_ORDER_STATUSES=new Set(['cancelled','completed','delivered','collected','invoiced']);
const vuPIText=v=>String(v||'').trim();
const vuPILower=v=>vuPIText(v).toLowerCase();
const vuPINum=v=>Math.max(0,Number(v||0));
const vuPIWorkingAdd=(value,days)=>{
  const d=new Date(value||Date.now());let left=Math.max(0,Math.ceil(Number(days||0)));
  while(left>0){d.setDate(d.getDate()+1);if(![0,6].includes(d.getDay()))left--;}
  return d;
};
const vuPIDateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

function vuPIIsOpenOrder(order){
  return !VU_FINAL_ORDER_STATUSES.has(vuPILower(order.status))&&(order.lines||[]).some(line=>vuPINum(line.qty)>0);
}
function vuPICustomerPreference(order,customer){
  const raw=vuPILower(order.fulfilmentType||order.preference||customer?.preference||customer?.deliveryPreference||'delivery');
  return raw.includes('collect')?'Collection':'Delivery';
}
function vuPIArea(order,customer){
  if(vuPICustomerPreference(order,customer)==='Collection')return'Collection';
  const raw=order.deliveryArea||order.area||customer?.deliveryArea||customer?.area||customer?.suburb||customer?.city||customer?.location||customer?.address||'Area not set';
  return vuPIText(raw).split(',')[0]||'Area not set';
}
function vuPIProductionMade(order,line,index){
  try{return typeof vuChecklistMade==='function'?vuPINum(vuChecklistMade(order,line,index)):vuPINum(order.productionChecklist?.lines?.[vuLineKey(line,index)]?.madeQty)}catch{return 0;}
}
function vuPIFinishingMade(order,line,index){
  try{return typeof vuFinishedQty==='function'?vuPINum(vuFinishedQty(order,line,index)):0}catch{return 0;}
}

async function buildPipelineForecast(){
  if(typeof syncConfirmedOrdersToProduction==='function')await syncConfirmedOrdersToProduction();
  const [orders,products,customers,balances]=await Promise.all([getAll('orders'),getAll('products'),getAll('customers'),getAll('inventoryBalances')]);
  const open=orders.filter(vuPIIsOpenOrder);
  const productById=new Map(products.map(p=>[p.id,p]));
  const customerById=new Map(customers.map(c=>[c.id,c]));
  const stock=new Map();for(const row of balances)stock.set(row.productId,(stock.get(row.productId)||0)+vuPINum(row.quantity));

  /* Existing explicit reservations are honoured first, then stock is allocated by optimizer priority. */
  const optimizer=typeof buildOptimizedOrderJobs==='function'?await buildOptimizedOrderJobs():{jobs:open.map((order,i)=>({order,priority:i+1}))};
  const priorityIds=optimizer.jobs.map(j=>j.order.id);const rank=new Map(priorityIds.map((id,i)=>[id,i]));
  open.sort((a,b)=>(rank.get(a.id)??9999)-(rank.get(b.id)??9999));
  const available=new Map(stock);
  const today=new Date();
  const rows=[];

  for(const order of open){
    const customer=customerById.get(order.customerId);
    const lines=(order.lines||[]).filter(l=>vuPINum(l.qty)>0).map((line,index)=>{
      const required=vuPINum(line.qty);const made=vuPIProductionMade(order,line,index);
      const needAfterMade=Math.max(0,required-made);
      const stockAvail=vuPINum(available.get(line.productId));
      const allocated=Math.min(stockAvail,needAfterMade);available.set(line.productId,stockAvail-allocated);
      const remainingToMake=Math.max(0,required-made-allocated);
      const product=productById.get(line.productId)||{};
      const capacity=vuPINum(product.manufacturingCapacityPerDay||product.dailyCapacity||product.capacityPerDay);
      const productionDays=remainingToMake===0?0:(capacity>0?Math.ceil(remainingToMake/capacity):null);
      const finished=vuPIFinishingMade(order,line,index);
      return{line,index,required,made,allocated,remainingToMake,capacity,productionDays,finished,remainingToFinish:Math.max(0,required-finished)};
    });
    const productionComplete=lines.every(l=>l.remainingToMake===0);
    const finishingComplete=order.finishingStatus==='Completed'||lines.every(l=>l.remainingToFinish===0&&order.rawIssued===true);
    const unknownCapacity=lines.some(l=>l.remainingToMake>0&&l.productionDays===null);
    const productionDays=unknownCapacity?null:Math.max(0,...lines.map(l=>l.productionDays||0));
    let currentStage='Production';
    if(finishingComplete||['delivery','delivery-scheduled'].includes(order.workflowStage))currentStage='Delivery';
    else if(order.rawIssued===true||['finishing','finishing-ready'].includes(order.workflowStage)||productionComplete)currentStage='Finishing & Painting';
    const finishingDays=currentStage==='Delivery'?0:(productionComplete||currentStage==='Finishing & Painting'?1:1);
    const routeDays=vuPICustomerPreference(order,customer)==='Collection'?0:1;
    const etaKnown=productionDays!==null;
    const etaWorkingDays=etaKnown?(productionDays||0)+finishingDays+routeDays:null;
    const estimatedDate=etaKnown?vuPIDateKey(vuPIWorkingAdd(today,etaWorkingDays)):'';
    const totalRequired=lines.reduce((s,l)=>s+l.required,0);
    const totalCovered=lines.reduce((s,l)=>s+l.made+l.allocated,0);
    rows.push({order,customer,lines,currentStage,productionComplete,finishingComplete,productionDays,estimatedDate,etaKnown,fulfilment:vuPICustomerPreference(order,customer),area:vuPIArea(order,customer),totalRequired,totalCovered,coverage:totalRequired?totalCovered/totalRequired:1,priority:(rank.get(order.id)??9999)+1});
  }
  return{rows,production:rows,finishingForecast:rows.filter(r=>r.currentStage!=='Delivery'),deliveryForecast:rows,generatedAt:new Date().toISOString()};
}

async function reconcilePipelineFromStock(){
  const forecast=await buildPipelineForecast();const now=new Date().toISOString();
  for(const row of forecast.rows){
    const order=await getOne('orders',row.order.id);if(!order)continue;
    const reservation={version:VU_PIPELINE_INTELLIGENCE_VERSION,updatedAt:now,lines:{}};
    row.lines.forEach(({line,index,allocated})=>reservation.lines[String(line.id||line.lineId||`${line.productId||line.productCode||'product'}::${index}`)]={allocatedQty:allocated});
    const patch={...order,rawReservation:reservation,predictedFulfilmentDate:row.estimatedDate,predictedFulfilmentType:row.fulfilment,pipelineForecastUpdatedAt:now,updatedAt:now};
    /* Stock can advance readiness automatically, but does not claim physical painting/delivery happened. */
    if(row.productionComplete&&!order.rawIssued&&!["finishing","delivery","delivery-scheduled"].includes(order.workflowStage)){
      patch.workflowStage='finishing-ready';patch.productionReadyAt=order.productionReadyAt||now;patch.finishingStatus=order.finishingStatus||'Queued';
    } else if(!row.productionComplete&&!order.rawIssued&&order.workflowStage==='finishing-ready'){
      patch.workflowStage='raw';patch.finishingStatus='';
    }
    await putOne('orders',patch);
  }
  window.dispatchEvent(new CustomEvent('vu:pipeline-recalculated',{detail:{count:forecast.rows.length}}));
  return forecast;
}

/* InventoryBalance writes from stock counts and production output trigger one debounced recalculation. */
if(!window.__vuPipelinePutWrapped){
  window.__vuPipelinePutWrapped=true;
  const vuPIBasePutOne=putOne;let vuPIRecalcTimer=null;let vuPIReconciling=false;
  putOne=async function vuPipelineAwarePutOne(store,value){
    const result=await vuPIBasePutOne(store,value);
    if(store==='inventoryBalances'&&!vuPIReconciling){
      clearTimeout(vuPIRecalcTimer);vuPIRecalcTimer=setTimeout(async()=>{
        try{vuPIReconciling=true;await reconcilePipelineFromStock();}catch(error){console.warn('Pipeline stock reconciliation failed',error)}finally{vuPIReconciling=false;}
      },150);
    }
    return result;
  };
}

function vuPIForecastBadge(row,stage){
  const when=row.etaKnown?(row.estimatedDate?dateText(`${row.estimatedDate}T12:00:00`):'Soon'):'Capacity needed';
  const prefix=stage==='finishing'?(row.currentStage==='Production'?'Incoming':'Current'):stage==='delivery'?(row.currentStage==='Delivery'?'Ready':'Forecast'):'Target';
  return `<div class="vu-pipeline-forecast"><strong>${prefix}: ${esc(when)}</strong><small>${esc(row.fulfilment)} · ${esc(row.area)} · ${Math.round(row.coverage*100)}% raw coverage</small></div>`;
}

/* Keep all open orders visible as forecasts on Finishing, not only those physically at that stage. */
const vuPIBaseFinishingPage=typeof finishingPaintingPage==='function'?finishingPaintingPage:null;
if(vuPIBaseFinishingPage){
  finishingPaintingPage=async function finishingWithForecast(){
    const forecast=await buildPipelineForecast();const current=forecast.rows.filter(r=>r.currentStage==='Finishing & Painting');const incoming=forecast.rows.filter(r=>r.currentStage==='Production');
    pageTitle.textContent='Finishing & Painting';backBtn.classList.add('hidden');navState('');
    main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Stage 2 workload</div><h2>${current.length} current · ${incoming.length} incoming</h2><p class="muted">Every open order remains here as a forecast so finishing can see what is coming and when.</p></div></div></section><h2>Current finishing jobs</h2>${current.map((r,i)=>vuFinishingCard(r.order,i+1)+vuPIForecastBadge(r,'finishing')).join('')||'<section class="card"><p>No orders physically in finishing yet.</p></section>'}<h2>Incoming from production</h2>${incoming.map(r=>`<section class="card workflow-order"><small>Priority ${r.priority} · ${esc(r.order.orderNumber||'Order')}</small><h3>${esc(r.order.customerName||'Customer')}</h3>${vuPIForecastBadge(r,'finishing')}<p class="muted">${r.lines.reduce((s,l)=>s+l.remainingToMake,0)} raw units still need manufacturing before this order can enter finishing.</p></section>`).join('')||'<section class="card"><p>No additional incoming orders.</p></section>'}`;
    window.scrollTo({top:0,behavior:'smooth'});
  };
  window.finishingPaintingPage=finishingPaintingPage;
}

/* Delivery page retains ready work and adds all upstream orders as forecast targets. */
const vuPIBaseDeliveriesPage=deliveriesPage;
deliveriesPage=async function deliveriesWithPipelineForecast(){
  await vuPIBaseDeliveriesPage();
  const forecast=await buildPipelineForecast();const upstream=forecast.rows.filter(r=>r.currentStage!=='Delivery');
  const section=document.createElement('section');section.className='card';section.innerHTML=`<div class="section-head"><div><div class="step-label">Forecast delivery / collection</div><h2>${forecast.rows.length} open order target${forecast.rows.length===1?'':'s'}</h2><p class="muted">Ready orders stay in the normal delivery schedule. Upstream orders remain visible here with predicted fulfilment dates.</p></div></div>${upstream.map(r=>`<div class="workflow-line"><span><strong>${esc(r.order.orderNumber||'Order')} · ${esc(r.order.customerName||'Customer')}</strong><small>${esc(r.currentStage)} · ${esc(r.fulfilment)} · ${esc(r.area)}</small></span><strong>${r.etaKnown?esc(r.estimatedDate):'Capacity needed'}</strong></div>`).join('')||'<p class="muted">All open orders are already in delivery stage.</p>'}`;main.prepend(section);
};

window.buildPipelineForecast=buildPipelineForecast;window.reconcilePipelineFromStock=reconcilePipelineFromStock;
setTimeout(()=>reconcilePipelineFromStock().catch(error=>console.warn('Initial pipeline reconciliation failed',error)),500);
