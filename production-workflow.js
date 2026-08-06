const WORKFLOW_CLOSED=new Set(['cancelled','delivered','collected','completed','invoiced']);
const wfNorm=v=>String(v||'').trim().toLowerCase();
const wfDateKey=value=>{const d=value instanceof Date?new Date(value):new Date(value||Date.now());return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const wfNextWeekday=value=>{const d=value instanceof Date?new Date(value):new Date(value||Date.now());while([0,6].includes(d.getDay()))d.setDate(d.getDate()+1);return d};
const wfAddWorkingDays=(value,days)=>{const d=wfNextWeekday(value);let count=0;while(count<days){d.setDate(d.getDate()+1);if(![0,6].includes(d.getDay()))count++}return d};
const wfDisplay=value=>value?new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`)):'Not scheduled';

function wfCustomerArea(order,customer){
  const value=order.deliveryArea||order.area||customer?.deliveryArea||customer?.area||customer?.suburb||customer?.city||customer?.location||customer?.address||'Area not set';
  return String(value).split(',')[0].trim()||'Area not set';
}

async function wfTakeRawStock(productId,quantity){
  let remaining=Math.max(0,Number(quantity||0));
  const balances=(await getAll('inventoryBalances')).filter(b=>b.productId===productId&&Number(b.quantity||0)>0).sort((a,b)=>Number(b.quantity||0)-Number(a.quantity||0));
  for(const balance of balances){
    if(remaining<=0)break;
    const available=Number(balance.quantity||0);const used=Math.min(available,remaining);
    await putOne('inventoryBalances',{...balance,quantity:available-used,updatedAt:new Date().toISOString()});
    remaining-=used;
  }
  return remaining;
}

async function wfAddRawStock(productId,quantity,reference='Production output'){
  const product=await getOne('products',productId);if(!product)return;
  const id=`${productId}::standard`;const current=await getOne('inventoryBalances',id);const now=new Date().toISOString();
  await putOne('inventoryBalances',{id,productId,productCode:product.code,productName:product.name,colourName:'Standard',quantity:Number(current?.quantity||0)+Number(quantity||0),updatedAt:now});
  try{await putOne('inventoryTransactions',{id:uid('inv'),productId,productCode:product.code,productName:product.name,colourName:'Standard',quantity:Number(quantity||0),type:'Production output',reference,createdAt:now})}catch{}
}

const originalTakeScheduleStock=typeof takeScheduleStock==='function'?takeScheduleStock:null;
if(originalTakeScheduleStock){
  takeScheduleStock=function(stockByKey,productId,colourName,quantity){
    let remaining=Math.max(0,Number(quantity||0)),allocated=0;
    const keys=[...stockByKey.keys()].filter(key=>key.startsWith(`${productId}::`)).sort((a,b)=>Number(stockByKey.get(b)||0)-Number(stockByKey.get(a)||0));
    for(const key of keys){if(remaining<=0)break;const available=Math.max(0,Number(stockByKey.get(key)||0));const used=Math.min(available,remaining);stockByKey.set(key,available-used);allocated+=used;remaining-=used}
    return allocated;
  };
}

const originalBuildCompletion=typeof buildOrderCompletionSchedule==='function'?buildOrderCompletionSchedule:null;
if(originalBuildCompletion){
  buildOrderCompletionSchedule=async function(){
    const result=await originalBuildCompletion();
    const issuedIds=new Set(result.orders.filter(p=>p.order.rawIssued===true).map(p=>p.order.id));
    if(!issuedIds.size)return result;
    result.days=result.days.map(day=>({...day,items:day.items.filter(item=>!issuedIds.has(item.orderId))})).filter(day=>day.items.length).map(day=>({...day,total:day.items.reduce((s,i)=>s+i.quantity,0)}));
    for(const plan of result.orders){
      if(!issuedIds.has(plan.order.id))continue;
      plan.linePlans.forEach(line=>{line.stockAllocated=line.required;line.toManufacture=0;line.completionDate=result.today;line.issue=''});
      plan.stockAllocated=plan.linePlans.reduce((s,l)=>s+l.required,0);plan.manufacturingRequired=0;plan.readyNow=true;plan.unscheduled=false;plan.completionDate=result.today;
    }
    result.summary.readyNow=result.orders.filter(p=>p.readyNow).length;
    result.summary.scheduled=result.orders.filter(p=>p.completionDate&&!p.readyNow).length;
    result.summary.unscheduled=result.orders.filter(p=>p.unscheduled).length;
    result.summary.totalUnitsToManufacture=result.orders.reduce((s,p)=>s+p.manufacturingRequired,0);
    return result;
  };
}

async function buildIntegratedWorkflow(){
  const [schedule,customers,products]=await Promise.all([buildOrderCompletionSchedule(),getAll('customers'),getAll('products')]);
  const customerById=new Map(customers.map(c=>[c.id,c]));const productById=new Map(products.map(p=>[p.id,p]));
  const orders=schedule.orders.filter(plan=>!WORKFLOW_CLOSED.has(wfNorm(plan.order.status))).map(plan=>{
    const order=plan.order;const customer=customerById.get(order.customerId);const area=wfCustomerArea(order,customer);
    let stage='raw';
    if(plan.manufacturingRequired===0||order.rawIssued===true)stage=order.finishingStatus==='Completed'||order.workflowStage==='delivery'||order.workflowStage==='delivery-scheduled'?'delivery':'finishing';
    const readyDate=plan.completionDate||schedule.today;
    return{...plan,stage,area,customer,readyDate,products:plan.linePlans.map(line=>({...line,product:productById.get(line.productId)}))};
  });
  const raw=orders.filter(x=>x.stage==='raw');const finishing=orders.filter(x=>x.stage==='finishing');const delivery=orders.filter(x=>x.stage==='delivery');
  return{schedule,orders,raw,finishing,delivery};
}

async function recordWorkflowOutput(productId,quantity,reference){
  const qty=Math.max(0,Math.round(Number(quantity||0)));if(!qty)return;
  await wfAddRawStock(productId,qty,reference);notify(`${qty} raw units added to stock`);productionPage();
}

async function openRecordOutput(productId,productCode,suggested,reference){
  openDialog(`<button class="close" onclick="closeDialog()">×</button><h2>Record raw production</h2><p><strong>${esc(productCode)}</strong></p><label>Quantity produced<input id="wfOutputQty" type="number" min="1" step="1" value="${Number(suggested||1)}"></label><button class="primary" id="wfSaveOutput">Add to raw stock</button>`);
  document.getElementById('wfSaveOutput').onclick=async()=>{const qty=document.getElementById('wfOutputQty').value;closeDialog();await recordWorkflowOutput(productId,qty,reference)};
}

async function startFinishing(orderId){
  const order=await getOne('orders',orderId);if(!order)return;
  if(order.rawIssued!==true){
    for(const line of order.lines||[]){const remaining=await wfTakeRawStock(line.productId,Number(line.qty||0));if(remaining>0){alert(`Not enough raw stock for ${line.productCode||line.productName}. ${remaining} units are still missing.`);return}}
  }
  const now=new Date().toISOString();await putOne('orders',{...order,rawIssued:true,workflowStage:'finishing',finishingStatus:'In Progress',finishingStartedAt:order.finishingStartedAt||now,updatedAt:now});notify('Order moved to finishing and painting');productionPage();
}

async function completeFinishing(orderId){
  const order=await getOne('orders',orderId);if(!order)return;const now=new Date().toISOString();
  await putOne('orders',{...order,rawIssued:true,workflowStage:'delivery',finishingStatus:'Completed',finishingCompletedAt:now,updatedAt:now});notify('Painting completed; order is ready for delivery planning');productionPage();
}

async function confirmAreaDelivery(area,date){
  const workflow=await buildIntegratedWorkflow();const orders=workflow.delivery.filter(x=>x.area===area&&!x.order.deliveryDate);
  const now=new Date().toISOString();for(const item of orders)await putOne('orders',{...item.order,deliveryDate:date,workflowStage:'delivery-scheduled',updatedAt:now});
  notify(`${orders.length} orders scheduled for ${area}`);productionPage();
}

function workflowOrderCard(item){
  const order=item.order;const type=item.stage==='raw'?'raw':item.stage==='finishing'?'finish':'delivery';
  const lines=item.products.map(line=>`<div class="workflow-line"><span>${esc(line.productCode||line.productName)} · ${esc(line.colourName||line.colour?.name||'Standard')}</span><strong>${Number(line.required||line.qty||0)}</strong></div>`).join('');
  let action='';
  if(item.stage==='raw')action=`<button class="primary" onclick="openOrderCompletionSchedule()">View production plan</button>`;
  if(item.stage==='finishing'&&order.finishingStatus!=='In Progress')action=`<button class="primary" onclick="startFinishing('${order.id}')">Start finishing & painting</button>`;
  if(item.stage==='finishing'&&order.finishingStatus==='In Progress')action=`<button class="primary" onclick="completeFinishing('${order.id}')">Mark painting complete</button>`;
  if(item.stage==='delivery')action=`<button onclick="viewOrder('${order.id}')">Open order</button>`;
  return `<section class="card workflow-order ${type}"><div class="workflow-order-head"><div><small>${esc(order.orderNumber||'Order')} · ${esc(item.area)}</small><h3>${esc(order.customerName||'Customer')}</h3></div><span class="workflow-badge">${item.stage==='raw'?`${item.manufacturingRequired} to make`:item.stage==='finishing'?(order.finishingStatus||'Ready to finish'):(order.deliveryDate?wfDisplay(order.deliveryDate):'Ready for route')}</span></div><div class="workflow-lines">${lines}</div><div class="workflow-actions">${action}<button onclick="viewOrder('${order.id}')">Details</button></div></section>`;
}

function buildDeliveryGroups(delivery){
  const groups=new Map();for(const item of delivery){if(!groups.has(item.area))groups.set(item.area,[]);groups.get(item.area).push(item)}
  const rows=[];for(const [area,items] of groups){
    const existing=items.map(x=>x.order.deliveryDate).filter(Boolean).sort()[0];
    const earliestReady=items.map(x=>x.order.finishingCompletedAt?wfDateKey(x.order.finishingCompletedAt):x.readyDate).sort().pop()||wfDateKey(new Date());
    const due=items.map(x=>x.order.dueDate).filter(Boolean).sort()[0];
    let suggested=existing||wfDateKey(wfAddWorkingDays(`${earliestReady}T12:00:00`,1));if(due&&due>earliestReady&&due<suggested)suggested=due;
    rows.push({area,items,date:suggested,confirmed:Boolean(existing),value:items.reduce((s,x)=>s+Number(x.order.grandTotal||0),0)});
  }
  return rows.sort((a,b)=>a.date.localeCompare(b.date)||b.items.length-a.items.length);
}

async function renderDeliveryCalendar(delivery){
  const groups=buildDeliveryGroups(delivery);const start=wfNextWeekday(new Date());const days=[];for(let i=0;i<20;i++){const d=wfAddWorkingDays(start,i);days.push(wfDateKey(d))}
  return `<section class="card"><div class="section-head"><div><h2>Area delivery calendar</h2><p class="muted">Orders from the same area are grouped onto the same trip.</p></div></div><div class="calendar-week">${days.map(date=>{const trips=groups.filter(g=>g.date===date);return `<div class="calendar-day"><h4>${wfDisplay(date)}</h4>${trips.map(group=>`<div class="calendar-trip"><strong>${esc(group.area)} · ${group.items.length} order${group.items.length===1?'':'s'}</strong><small>${group.items.map(x=>esc(x.order.customerName)).join(' · ')}</small><small>${money(group.value)}</small>${group.confirmed?'<span class="workflow-badge">Confirmed</span>':`<button onclick="confirmAreaDelivery('${esc(group.area).replaceAll("'","\\'")}','${date}')">Confirm trip</button>`}</div>`).join('')||'<small class="muted">No trip planned</small>'}</div>`}).join('')}</div></section>`;
}

productionPage=async function(){
  const workflow=await buildIntegratedWorkflow();pageTitle.textContent='Production';backBtn.classList.add('hidden');
  const dailyItems=workflow.schedule.days.flatMap(day=>day.items.map(item=>({...item,date:day.date})));const byProduct=new Map();for(const item of dailyItems){const key=item.productId;if(!byProduct.has(key))byProduct.set(key,{...item,quantity:0,orders:new Set()});const row=byProduct.get(key);row.quantity+=item.quantity;row.orders.add(item.orderNumber)}
  main.innerHTML=`<div class="workflow-summary"><div><small>Raw production</small><strong>${workflow.raw.length}</strong></div><div><small>Finishing & painting</small><strong>${workflow.finishing.length}</strong></div><div><small>Delivery planning</small><strong>${workflow.delivery.length}</strong></div><div><small>Raw units to make</small><strong>${workflow.schedule.summary.totalUnitsToManufacture}</strong></div></div><div class="workflow-tabs"><button class="workflow-tab active" data-wf="raw">Raw production</button><button class="workflow-tab" data-wf="finish">Finishing & painting</button><button class="workflow-tab" data-wf="delivery">Delivery calendar</button></div><div id="workflowBody"></div>`;
  const render=async tab=>{document.querySelectorAll('.workflow-tab').forEach(b=>b.classList.toggle('active',b.dataset.wf===tab));const body=document.getElementById('workflowBody');if(tab==='raw'){body.innerHTML=`<section class="card"><div class="section-head"><div><h2>Raw production output</h2><p class="muted">Stock on hand and recorded production are raw, unfinished and unpainted.</p></div><button class="primary" onclick="openOrderCompletionSchedule()">Completion schedule</button></div>${[...byProduct.values()].map(row=>`<div class="workflow-line"><span><strong>${esc(row.productCode)} · ${esc(row.productName)}</strong><small>${[...row.orders].join(' · ')}</small></span><span><strong>${row.quantity}</strong><button onclick="openRecordOutput('${row.productId}','${esc(row.productCode)}',${row.quantity},'${esc([...row.orders].join(', '))}')">Record output</button></span></div>`).join('')||'<div class="workflow-empty">No raw manufacturing is required. Orders covered by stock have moved to finishing.</div>'}</section>${workflow.raw.map(workflowOrderCard).join('')}`}
    if(tab==='finish')body.innerHTML=workflow.finishing.map(workflowOrderCard).join('')||'<div class="card workflow-empty">No orders are waiting for finishing and painting.</div>';
    if(tab==='delivery')body.innerHTML=await renderDeliveryCalendar(workflow.delivery)+workflow.delivery.map(workflowOrderCard).join('');};
  document.querySelectorAll('.workflow-tab').forEach(b=>b.onclick=()=>render(b.dataset.wf));await render('raw');window.scrollTo({top:0,behavior:'smooth'});
};

const workflowDashboardOriginal=dashboard;
dashboard=async function(){await workflowDashboardOriginal();const workflow=await buildIntegratedWorkflow();const card=document.createElement('section');card.className='card workflow-dashboard';card.innerHTML=`<div class="section-head"><div><div class="step-label">Factory workflow</div><h2>Production, finishing & delivery</h2></div><span class="badge">${workflow.orders.length} open jobs</span></div><div class="schedule-dashboard-grid"><div><small>Raw production</small><strong>${workflow.raw.length}</strong></div><div><small>Finishing & painting</small><strong>${workflow.finishing.length}</strong></div><div><small>Ready for delivery</small><strong>${workflow.delivery.length}</strong></div></div><button class="primary" onclick="navigate('production')">Open production workflow</button>`;main.prepend(card);
  [...main.querySelectorAll('*')].filter(el=>el.children.length===0&&/open jobs/i.test(el.textContent||'')).forEach(el=>{const parent=el.closest('.card,.stat');const number=parent?.querySelector('strong');if(number)number.textContent=workflow.orders.length});
};

const completionOriginal=openOrderCompletionSchedule;
openOrderCompletionSchedule=async function(){await completionOriginal();const workflow=await buildIntegratedWorkflow();const note=document.createElement('section');note.className='card';note.innerHTML=`<div class="section-head"><div><div class="step-label">Next process</div><h2>After raw production</h2></div><button class="primary" onclick="navigate('production')">Open finishing & delivery workflow</button></div><p class="muted">Orders fully covered by raw stock automatically move to finishing and painting. Completed painting then moves them into the area-grouped delivery calendar.</p>`;main.prepend(note)};

window.startFinishing=startFinishing;window.completeFinishing=completeFinishing;window.confirmAreaDelivery=confirmAreaDelivery;window.openRecordOutput=openRecordOutput;window.recordWorkflowOutput=recordWorkflowOutput;
