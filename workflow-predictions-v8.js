/* Version 8.3 workflow ETA layer. Predictions are advisory and never mutate order data. */
const VU_PREDICTION_VERSION='8.3.0';

function vuPredDateKey(date){const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function vuPredAddWorkingDays(value,days){const d=new Date(value||Date.now());let left=Math.max(0,Math.round(days||0));while(left>0){d.setDate(d.getDate()+1);if(![0,6].includes(d.getDay()))left--;}return d}
function vuPredDisplay(value){return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`))}

async function vuPredictOrderEta(order,job=null){
  if(order.deliveryDate)return{date:order.deliveryDate,label:'Scheduled delivery',confidence:'Confirmed'};
  const customers=await getAll('customers');const customer=customers.find(c=>c.id===order.customerId);const area=vuOrderArea?vuOrderArea(order,customer):(order.deliveryArea||customer?.area||customer?.suburb||'Area not set');
  if(vuIsDeliveryOrder(order)){
    const date=vuPredDateKey(vuPredAddWorkingDays(new Date(),1));
    return{date,label:area&&area!=='Area not set'?`Likely next ${area} route`:'Ready for delivery planning',confidence:area&&area!=='Area not set'?'Medium':'Low'};
  }
  if(vuIsFinishingOrder(order)){
    const lines=order.lines||[];const remaining=lines.reduce((sum,line,index)=>sum+Math.max(0,Number(line.qty||0)-vuFinishedQty(order,line,index)),0);
    const finishDays=remaining>0?1:0;const date=vuPredDateKey(vuPredAddWorkingDays(new Date(),finishDays+1));
    return{date,label:'Predicted delivery after finishing',confidence:'Medium'};
  }
  let productionDays=Number(job?.estimatedDays||0);let allCapacityKnown=true;
  if(job){
    productionDays=Math.max(0,...job.lines.map((line,index)=>{
      const made=vuChecklistMade(job.order,(job.order.lines||[])[index]||line,index);const remaining=Math.max(0,Number(line.required||0)-Number(line.allocated||0)-made);if(!remaining)return 0;if(!Number(line.capacity||0)){allCapacityKnown=false;return 0;}return Math.ceil(remaining/Number(line.capacity));
    }));
  }
  const date=vuPredDateKey(vuPredAddWorkingDays(new Date(),productionDays+2));
  return{date,label:allCapacityKnown?'Predicted delivery':'Estimate needs capacity data',confidence:allCapacityKnown?'Medium':'Low'};
}
function vuEtaHtml(eta){return `<div class="vu-eta"><span><small>${esc(eta.label)}</small><strong>${esc(eta.confidence)} confidence</strong></span><strong>${vuPredDisplay(eta.date)}</strong></div>`}

const vuPredProductionBase=productionPage;
productionPage=async function productionWithPredictions(){
  await vuPredProductionBase();const plan=await buildOptimizedOrderJobs();
  for(const job of plan.jobs.filter(j=>!j.order.rawIssued)){
    const marker=[...main.querySelectorAll('.vu-job-card')].find(card=>(card.textContent||'').includes(job.order.orderNumber||'__none__'));if(!marker||marker.querySelector('.vu-eta'))continue;
    const eta=await vuPredictOrderEta(job.order,job);marker.insertAdjacentHTML('beforeend',vuEtaHtml(eta));
  }
};

const vuPredFinishingBase=finishingPaintingPage;
finishingPaintingPage=async function finishingWithPredictions(){
  await vuPredFinishingBase();const orders=(await getAll('orders')).filter(vuIsFinishingOrder);
  for(const order of orders){const marker=[...main.querySelectorAll('.vu-job-card')].find(card=>(card.textContent||'').includes(order.orderNumber||'__none__'));if(!marker||marker.querySelector('.vu-eta'))continue;marker.insertAdjacentHTML('beforeend',vuEtaHtml(await vuPredictOrderEta(order)));}
};

const vuPredDeliveriesBase=deliveriesPage;
deliveriesPage=async function deliveriesWithPredictions(){
  await vuPredDeliveriesBase();const orders=(await getAll('orders')).filter(vuIsDeliveryOrder);
  for(const order of orders){const marker=[...main.querySelectorAll('.card,.list-item')].find(card=>(card.textContent||'').includes(order.orderNumber||'__none__'));if(!marker||marker.querySelector('.vu-eta'))continue;marker.insertAdjacentHTML('beforeend',vuEtaHtml(await vuPredictOrderEta(order)));}
};

window.vuPredictOrderEta=vuPredictOrderEta;
