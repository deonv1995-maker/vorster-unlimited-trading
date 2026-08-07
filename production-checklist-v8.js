/* Version 8.2 production checklist.
   Each active order is a job card; each order line is completed item-by-item.
   Production made directly for an order is assigned to that order and is NOT added to general stock. */
const VU_CHECKLIST_VERSION='8.2.0';

const vuLineKey=(line,index)=>String(line.id||line.lineId||`${line.productId||line.productCode||'product'}::${index}`);
const vuClamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value||0)));

function vuChecklistFor(order){
  const current=order.productionChecklist&&typeof order.productionChecklist==='object'?order.productionChecklist:{};
  return{version:VU_CHECKLIST_VERSION,startedAt:current.startedAt||null,updatedAt:current.updatedAt||null,lines:{...(current.lines||{})}};
}

function vuChecklistMade(order,line,index){
  const checklist=vuChecklistFor(order);const key=vuLineKey(line,index);
  return Math.max(0,Number(checklist.lines[key]?.madeQty||0));
}

async function vuSaveMadeQty(orderId,lineIndex,newQty){
  const order=await getOne('orders',orderId);if(!order)return;
  const line=(order.lines||[])[lineIndex];if(!line)return;
  const checklist=vuChecklistFor(order);const key=vuLineKey(line,lineIndex);
  const required=Math.max(0,Number(line.qty||0));
  const made=vuClamp(Math.round(Number(newQty||0)),0,required);
  const now=new Date().toISOString();
  checklist.startedAt=checklist.startedAt||now;checklist.updatedAt=now;
  checklist.lines[key]={...(checklist.lines[key]||{}),madeQty:made,updatedAt:now};
  await putOne('orders',{...order,productionChecklist:checklist,workflowStage:'raw',status:'In Production',updatedAt:now});
  notify(`${line.productCode||line.productName||'Item'}: ${made} made`);
  await productionPage();
}

async function vuAddMadeQty(orderId,lineIndex,delta){
  const order=await getOne('orders',orderId);if(!order)return;
  const line=(order.lines||[])[lineIndex];if(!line)return;
  const current=vuChecklistMade(order,line,lineIndex);
  await vuSaveMadeQty(orderId,lineIndex,current+Number(delta||0));
}

async function vuCompleteProductionLine(orderId,lineIndex,stockAllocated){
  const order=await getOne('orders',orderId);if(!order)return;
  const line=(order.lines||[])[lineIndex];if(!line)return;
  const required=Math.max(0,Number(line.qty||0));
  const needed=Math.max(0,required-Math.max(0,Number(stockAllocated||0)));
  await vuSaveMadeQty(orderId,lineIndex,needed);
}

async function vuResetProductionLine(orderId,lineIndex){await vuSaveMadeQty(orderId,lineIndex,0)}

async function vuIssueChecklistOrderToFinishing(orderId){
  const plan=await buildOptimizedOrderJobs();
  const job=plan.jobs.find(row=>row.order.id===orderId);if(!job)return;
  const order=await getOne('orders',orderId);if(!order)return;
  const checklist=vuChecklistFor(order);
  const incomplete=job.lines.some((line,index)=>{
    const made=Math.max(0,Number(checklist.lines[vuLineKey((order.lines||[])[index]||line,index)]?.madeQty||0));
    return made+Number(line.allocated||0)<Number(line.required||0);
  });
  if(incomplete){alert('This job is not complete yet. Finish every production line before moving it to painting.');return;}

  /* Only take the raw stock portion. Units made specifically for this job never entered general stock. */
  for(let i=0;i<job.lines.length;i++){
    const line=job.lines[i];const qty=Math.max(0,Number(line.allocated||0));if(!qty)continue;
    const remaining=await wfTakeRawStock(line.productId,qty);
    if(remaining>0){alert(`Raw stock changed while this job was open. ${line.productCode||line.productName} is short by ${remaining}. Re-open Production to recalculate.`);return;}
  }
  const now=new Date().toISOString();
  await putOne('orders',{...order,rawIssued:true,workflowStage:'finishing',finishingStatus:'In Progress',finishingStartedAt:order.finishingStartedAt||now,productionCompletedAt:order.productionCompletedAt||now,updatedAt:now});
  notify('Production complete — order moved to finishing & painting');
  await productionPage();
}

function vuChecklistLine(job,line,index){
  const orderLine=(job.order.lines||[])[index]||line;
  const required=Math.max(0,Number(line.required||orderLine.qty||0));
  const allocated=Math.max(0,Number(line.allocated||0));
  const made=vuChecklistMade(job.order,orderLine,index);
  const remaining=Math.max(0,required-allocated-made);
  const done=remaining===0;
  const code=esc(line.productCode||line.productName||line.product?.code||'Product');
  return `<div class="vu-check-line ${done?'done':''}">
    <button class="vu-check-box" onclick="vuCompleteProductionLine('${job.order.id}',${index},${allocated})" aria-label="Complete line">${done?'✓':'○'}</button>
    <div class="vu-check-main"><strong>${code}</strong><small>${required} ordered · ${allocated} from stock · ${made} made · ${remaining} remaining</small></div>
    <div class="vu-check-controls">
      <button onclick="vuAddMadeQty('${job.order.id}',${index},-1)" ${made<=0?'disabled':''}>−</button>
      <strong>${made}</strong>
      <button onclick="vuAddMadeQty('${job.order.id}',${index},1)" ${remaining<=0?'disabled':''}>+</button>
    </div>
  </div>`;
}

function vuChecklistJobCard(job){
  const lines=job.lines.map((line,index)=>vuChecklistLine(job,line,index)).join('');
  const checklist=vuChecklistFor(job.order);
  const complete=job.lines.every((line,index)=>{
    const made=Math.max(0,Number(checklist.lines[vuLineKey((job.order.lines||[])[index]||line,index)]?.madeQty||0));
    return made+Number(line.allocated||0)>=Number(line.required||0);
  });
  const doneCount=job.lines.filter((line,index)=>{
    const made=Math.max(0,Number(checklist.lines[vuLineKey((job.order.lines||[])[index]||line,index)]?.madeQty||0));
    return made+Number(line.allocated||0)>=Number(line.required||0);
  }).length;
  const progress=job.lines.length?Math.round(doneCount/job.lines.length*100):100;
  let action=`<button onclick="viewOrder('${job.order.id}')">Order details</button>`;
  if(complete&&!job.order.rawIssued)action=`<button class="primary" onclick="vuIssueChecklistOrderToFinishing('${job.order.id}')">Production complete → Painting</button>${action}`;
  if(job.stage==='Finishing & painting')action=`<button class="primary" onclick="completeFinishing('${job.order.id}')">Mark painting complete</button>${action}`;
  if(job.stage==='Delivery planning')action=`<button onclick="viewOrder('${job.order.id}')">Open order</button>`;
  return `<section class="card workflow-order vu-job-card">
    <div class="workflow-order-head"><div><small>Job ${job.priority} · ${esc(job.order.orderNumber||'Order')} · ${esc(job.area)}</small><h3>${esc(job.order.customerName||'Customer')}</h3></div><span class="workflow-badge">${complete&&!job.order.rawIssued?'Ready for painting':esc(job.stage)}</span></div>
    <div class="vu-progress"><div style="width:${progress}%"></div></div><small>${doneCount} of ${job.lines.length} product lines complete · ${progress}%</small>
    <div class="workflow-line"><span>Order value</span><strong>${money(job.order.grandTotal)}</strong></div>
    <div class="vu-checklist">${lines}</div>
    <p class="muted">Work this job from top to bottom. Tick a line when the required quantity is made; stock already allocated counts toward completion.</p>
    <div class="workflow-actions">${action}</div>
  </section>`;
}

/* Boost any job already being worked so the queue completes started jobs before opening new ones. */
const vuChecklistBaseBuild=buildOptimizedOrderJobs;
buildOptimizedOrderJobs=async function buildChecklistOptimizedJobs(){
  const plan=await vuChecklistBaseBuild();
  for(const job of plan.jobs){
    const checklist=vuChecklistFor(job.order);
    const madeTotal=Object.values(checklist.lines||{}).reduce((sum,row)=>sum+Math.max(0,Number(row?.madeQty||0)),0);
    job.startedProduction=madeTotal>0;
    if(job.startedProduction){job.score+=250;job.reasons.unshift('production already started — finish this job first');}
  }
  plan.jobs.sort((a,b)=>b.score-a.score||a.priority-b.priority);
  plan.jobs.forEach((job,index)=>job.priority=index+1);
  plan.rawJobs=plan.jobs.filter(j=>!j.order.rawIssued&&j.stage!=='Delivery planning'&&j.stage!=='Finishing & painting');
  plan.readyJobs=plan.jobs.filter(j=>j.stage==='Ready for finishing');
  plan.finishingJobs=plan.jobs.filter(j=>j.stage==='Finishing & painting');
  plan.deliveryJobs=plan.jobs.filter(j=>j.stage==='Delivery planning');
  return plan;
};

productionPage=async function productionChecklistPageV8(){
  const plan=await buildOptimizedOrderJobs();pageTitle.textContent='Production';backBtn.classList.add('hidden');
  const active=plan.jobs.filter(job=>!['Finishing & painting','Delivery planning'].includes(job.stage));
  const finishing=plan.jobs.filter(job=>job.stage==='Finishing & painting');
  const delivery=plan.jobs.filter(job=>job.stage==='Delivery planning');
  main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Factory job-card checklist</div><h2>${plan.jobs.length} open production job${plan.jobs.length===1?'':'s'}</h2><p class="muted">Complete one order after another. Each item is checked off as its required quantity is made.</p></div></div><label>Daily invoice target<input id="vuInvoiceTarget" type="number" min="0" step="100" value="${plan.target}"></label><button id="vuSaveInvoiceTarget" class="primary">Save target & recalculate queue</button></section>
  <div class="workflow-summary"><div><small>Production jobs</small><strong>${active.length}</strong></div><div><small>Painting</small><strong>${finishing.length}</strong></div><div><small>Delivery planning</small><strong>${delivery.length}</strong></div><div><small>Total jobs</small><strong>${plan.jobs.length}</strong></div></div>
  <div class="workflow-tabs"><button class="workflow-tab active" data-vu-tab="jobs">Production checklist</button><button class="workflow-tab" data-vu-tab="finish">Finishing</button><button class="workflow-tab" data-vu-tab="delivery">Delivery</button></div><div id="vuChecklistBody"></div>`;
  document.getElementById('vuSaveInvoiceTarget').onclick=()=>{vuSetDailyInvoiceTarget(document.getElementById('vuInvoiceTarget').value);productionPage();};
  const render=tab=>{document.querySelectorAll('.workflow-tab').forEach(b=>b.classList.toggle('active',b.dataset.vuTab===tab));const body=document.getElementById('vuChecklistBody');const rows=tab==='jobs'?active:tab==='finish'?finishing:delivery;body.innerHTML=rows.map(vuChecklistJobCard).join('')||`<section class="card"><p>No ${tab==='jobs'?'production':tab==='finish'?'finishing':'delivery'} jobs waiting.</p></section>`;};
  document.querySelectorAll('.workflow-tab').forEach(b=>b.onclick=()=>render(b.dataset.vuTab));render('jobs');window.scrollTo({top:0,behavior:'smooth'});
};

window.vuSaveMadeQty=vuSaveMadeQty;window.vuAddMadeQty=vuAddMadeQty;window.vuCompleteProductionLine=vuCompleteProductionLine;window.vuResetProductionLine=vuResetProductionLine;window.vuIssueChecklistOrderToFinishing=vuIssueChecklistOrderToFinishing;
