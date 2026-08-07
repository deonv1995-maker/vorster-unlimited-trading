/* Version 8.1 order-level production optimizer.
   One active order = one production job. Planning never mutates stock. */
const VU_OPTIMIZER_VERSION='8.1.0';
const VU_CLOSED_ORDER_STATUSES=new Set(['draft','cancelled','completed','delivered','collected','invoiced']);
const vuNorm=value=>String(value||'').trim().toLowerCase();
const vuNum=value=>Math.max(0,Number(value||0));

function vuDailyInvoiceTarget(){
  return Math.max(0,Number(localStorage.getItem('vu-daily-invoice-target')||0));
}
function vuSetDailyInvoiceTarget(value){
  localStorage.setItem('vu-daily-invoice-target',String(Math.max(0,Number(value||0))));
}
function vuOrderArea(order,customer){
  const raw=order.deliveryArea||order.area||customer?.deliveryArea||customer?.area||customer?.suburb||customer?.city||customer?.location||customer?.address||'Area not set';
  return String(raw).split(',')[0].trim()||'Area not set';
}
function vuWorkingDaysUntil(value){
  if(!value)return 30;
  const due=new Date(value);const now=new Date();
  if(Number.isNaN(due.getTime()))return 30;
  let days=0;const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  while(cursor<due&&days<365){cursor.setDate(cursor.getDate()+1);if(![0,6].includes(cursor.getDay()))days++;}
  return due<now?0:days;
}

async function buildOptimizedOrderJobs(){
  await (window.syncConfirmedOrdersToProduction?.()||Promise.resolve());
  const [orders,products,customers,balances]=await Promise.all([
    getAll('orders'),getAll('products'),getAll('customers'),getAll('inventoryBalances')
  ]);
  const productById=new Map(products.map(p=>[p.id,p]));
  const customerById=new Map(customers.map(c=>[c.id,c]));
  const stock=new Map();
  for(const balance of balances)stock.set(balance.productId,(stock.get(balance.productId)||0)+vuNum(balance.quantity));

  const active=orders.filter(order=>{
    const status=vuNorm(order.status);
    const hasDemand=(order.lines||[]).some(line=>vuNum(line.qty)>0);
    return hasDemand&&!VU_CLOSED_ORDER_STATUSES.has(status);
  });
  const areaStats=new Map();
  for(const order of active){
    const area=vuOrderArea(order,customerById.get(order.customerId));
    const row=areaStats.get(area)||{count:0,value:0};row.count++;row.value+=vuNum(order.grandTotal);areaStats.set(area,row);
  }
  const target=vuDailyInvoiceTarget();

  const candidates=active.map(order=>{
    const area=vuOrderArea(order,customerById.get(order.customerId));
    const areaStat=areaStats.get(area)||{count:1,value:vuNum(order.grandTotal)};
    const lines=(order.lines||[]).filter(line=>vuNum(line.qty)>0).map(line=>{
      const product=productById.get(line.productId)||{};
      const required=vuNum(line.qty);
      const available=vuNum(stock.get(line.productId));
      const capacity=vuNum(product.manufacturingCapacityPerDay||product.dailyCapacity||product.capacityPerDay);
      return{...line,required,available,capacity,product};
    });
    const totalRequired=lines.reduce((s,l)=>s+l.required,0);
    const immediatelyAvailable=lines.reduce((s,l)=>s+Math.min(l.required,l.available),0);
    const coverage=totalRequired?immediatelyAvailable/totalRequired:0;
    const fullStock=lines.every(l=>l.available>=l.required);
    const estimatedDays=Math.max(0,...lines.map(l=>Math.ceil(Math.max(0,l.required-l.available)/(l.capacity||0||1))));
    const dueDays=vuWorkingDaysUntil(order.dueDate||order.requiredDate||order.deliveryDate);
    let score=coverage*60;
    if(fullStock)score+=70;
    score+=Math.max(0,30-Math.min(30,estimatedDays*5));
    score+=Math.max(0,25-Math.min(25,dueDays));
    score+=Math.min(25,areaStat.count*5);
    if(target>0)score+=Math.min(30,(areaStat.value/target)*20)+Math.min(15,(vuNum(order.grandTotal)/target)*15);
    else score+=Math.min(15,vuNum(order.grandTotal)/10000);
    if(order.rawIssued===true)score+=100;
    if(order.finishingStatus==='Completed'||['delivery','delivery-scheduled'].includes(order.workflowStage))score+=150;
    return{order,area,areaStat,lines,totalRequired,coverage,fullStock,estimatedDays,dueDays,score};
  }).sort((a,b)=>b.score-a.score||a.estimatedDays-b.estimatedDays||b.order.grandTotal-a.order.grandTotal);

  const availableStock=new Map(stock);
  const jobs=candidates.map((candidate,index)=>{
    let allocated=0,shortage=0,maxDays=0;
    const lines=candidate.lines.map(line=>{
      const available=vuNum(availableStock.get(line.productId));
      const used=Math.min(available,line.required);
      availableStock.set(line.productId,available-used);
      const missing=line.required-used;
      const days=missing>0?(line.capacity>0?Math.ceil(missing/line.capacity):null):0;
      allocated+=used;shortage+=missing;if(days!==null)maxDays=Math.max(maxDays,days);
      return{...line,allocated:used,shortage:missing,days};
    });
    let stage='Raw production';
    if(candidate.order.rawIssued===true)stage=candidate.order.finishingStatus==='Completed'?'Delivery planning':'Finishing & painting';
    else if(shortage===0)stage='Ready for finishing';
    const reasons=[];
    if(shortage===0)reasons.push('fully covered by raw stock');
    else if(allocated>0)reasons.push(`${Math.round((allocated/candidate.totalRequired)*100)}% stock covered`);
    if(candidate.areaStat.count>1)reasons.push(`${candidate.areaStat.count} orders in ${candidate.area}`);
    if(target>0&&candidate.areaStat.value>=target)reasons.push('area batch can reach daily invoice target');
    if(candidate.dueDays<=3)reasons.push('urgent due date');
    return{...candidate,lines,allocated,shortage,estimatedDays:maxDays,stage,priority:index+1,reasons};
  });
  return{jobs,target,totalValue:jobs.reduce((s,j)=>s+vuNum(j.order.grandTotal),0),rawJobs:jobs.filter(j=>j.stage==='Raw production'),readyJobs:jobs.filter(j=>j.stage==='Ready for finishing'),finishingJobs:jobs.filter(j=>j.stage==='Finishing & painting'),deliveryJobs:jobs.filter(j=>j.stage==='Delivery planning')};
}

function vuJobCard(job){
  const lines=job.lines.map(line=>`<div class="workflow-line"><span>${esc(line.productCode||line.productName||line.product?.code||'Product')}</span><strong>${line.required} ordered · ${line.allocated} stock · ${line.shortage} make</strong></div>`).join('');
  const eta=job.shortage===0?'Can move now':job.estimatedDays>0?`${job.estimatedDays} production day${job.estimatedDays===1?'':'s'}`:'Capacity needed';
  let action=`<button onclick="viewOrder('${job.order.id}')">Open order</button>`;
  if(job.stage==='Ready for finishing')action=`<button class="primary" onclick="startFinishing('${job.order.id}')">Issue stock to finishing</button>${action}`;
  if(job.stage==='Finishing & painting')action=`<button class="primary" onclick="completeFinishing('${job.order.id}')">Mark painting complete</button>${action}`;
  return `<section class="card workflow-order"><div class="workflow-order-head"><div><small>Priority ${job.priority} · ${esc(job.order.orderNumber||'Order')} · ${esc(job.area)}</small><h3>${esc(job.order.customerName||'Customer')}</h3></div><span class="workflow-badge">${esc(job.stage)}</span></div><div class="workflow-line"><span>Order value</span><strong>${money(job.order.grandTotal)}</strong></div><div class="workflow-line"><span>Estimated readiness</span><strong>${eta}</strong></div>${lines}<p class="muted">Why this priority: ${esc(job.reasons.join(' · ')||'oldest active order')}</p><div class="workflow-actions">${action}</div></section>`;
}

productionPage=async function productionPageOptimizedV8(){
  const plan=await buildOptimizedOrderJobs();pageTitle.textContent='Production';backBtn.classList.add('hidden');
  main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Order-level production queue</div><h2>${plan.jobs.length} production job${plan.jobs.length===1?'':'s'}</h2><p class="muted">Every active order is one job. Stock is allocated in priority order without changing the real stock count until finishing starts.</p></div></div><label>Daily invoice target<input id="vuInvoiceTarget" type="number" min="0" step="100" value="${plan.target}"></label><button id="vuSaveInvoiceTarget" class="primary">Save target and recalculate</button></section><div class="workflow-summary"><div><small>Raw production</small><strong>${plan.rawJobs.length}</strong></div><div><small>Ready for finishing</small><strong>${plan.readyJobs.length}</strong></div><div><small>Finishing</small><strong>${plan.finishingJobs.length}</strong></div><div><small>Delivery planning</small><strong>${plan.deliveryJobs.length}</strong></div></div><section class="card"><h2>Recommended job order</h2><p class="muted">The queue favours orders that can be completed fastest, then groups compatible delivery areas and invoice value.</p></section>${plan.jobs.map(vuJobCard).join('')||'<section class="card"><p>No active production jobs.</p></section>'}`;
  document.getElementById('vuSaveInvoiceTarget').onclick=()=>{vuSetDailyInvoiceTarget(document.getElementById('vuInvoiceTarget').value);productionPage();};
  window.scrollTo({top:0,behavior:'smooth'});
};

const vuDashboardBase=dashboard;
dashboard=async function dashboardWithOrderJobsV8(){
  await vuDashboardBase();
  const plan=await buildOptimizedOrderJobs();
  const cards=[...main.querySelectorAll('.card')];
  for(const card of cards){
    if(/Production/i.test(card.textContent||'')){
      const textNodes=[...card.querySelectorAll('p,small,strong,span,div')].filter(el=>el.children.length===0);
      const countNode=textNodes.find(el=>/open jobs?/i.test(el.textContent||''));
      if(countNode)countNode.textContent=`${plan.jobs.length} open job${plan.jobs.length===1?'':'s'}`;
    }
  }
};

window.buildOptimizedOrderJobs=buildOptimizedOrderJobs;
