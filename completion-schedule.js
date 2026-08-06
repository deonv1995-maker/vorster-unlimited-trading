const CLOSED_SCHEDULE_STATUSES=new Set(["cancelled","delivered","completed","invoiced"]);

const scheduleDateKey=value=>{
  const date=value instanceof Date?new Date(value):new Date(value||Date.now());
  if(Number.isNaN(date.getTime()))return "";
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};
const scheduleDateFromKey=value=>{
  const match=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):new Date(value||Date.now());
};
const isWorkingDay=date=>![0,6].includes(date.getDay());
const nextWorkingDay=value=>{
  const date=value instanceof Date?new Date(value):scheduleDateFromKey(value);
  while(!isWorkingDay(date))date.setDate(date.getDate()+1);
  return date;
};
const followingWorkingDay=value=>{
  const date=value instanceof Date?new Date(value):scheduleDateFromKey(value);
  date.setDate(date.getDate()+1);
  return nextWorkingDay(date);
};
const scheduleDisplayDate=value=>{
  if(!value)return "Not scheduled";
  return new Intl.DateTimeFormat("en-ZA",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(scheduleDateFromKey(value));
};
const scheduleNormalise=value=>String(value||"").trim().toLowerCase();
const scheduleColourName=line=>line?.colour?.name||line?.colourName||"Standard";

function takeScheduleStock(stockByKey,productId,colourName,quantity){
  let remaining=Math.max(0,Number(quantity||0));
  let allocated=0;
  const exactKey=`${productId}::${scheduleNormalise(colourName||"Standard")}`;
  if(scheduleNormalise(colourName)!=="standard"){
    const available=Math.max(0,Number(stockByKey.get(exactKey)||0));
    const used=Math.min(available,remaining);
    stockByKey.set(exactKey,available-used);
    return used;
  }
  const keys=[...stockByKey.keys()].filter(key=>key.startsWith(`${productId}::`));
  keys.sort((a,b)=>Number(stockByKey.get(b)||0)-Number(stockByKey.get(a)||0));
  for(const key of keys){
    if(remaining<=0)break;
    const available=Math.max(0,Number(stockByKey.get(key)||0));
    const used=Math.min(available,remaining);
    stockByKey.set(key,available-used);
    allocated+=used;
    remaining-=used;
  }
  return allocated;
}

async function buildOrderCompletionSchedule(){
  const [orders,products,balances]=await Promise.all([
    getAll("orders"),getAll("products"),getAll("inventoryBalances")
  ]);
  const productById=new Map(products.map(product=>[product.id,product]));
  const productByCode=new Map(products.map(product=>[String(product.code||"").trim().toUpperCase(),product]));
  const stockByKey=new Map();
  balances.forEach(balance=>{
    const key=`${balance.productId}::${scheduleNormalise(balance.colourName||"Standard")}`;
    stockByKey.set(key,(stockByKey.get(key)||0)+Math.max(0,Number(balance.quantity||0)));
  });

  const openOrders=orders
    .filter(order=>!CLOSED_SCHEDULE_STATUSES.has(scheduleNormalise(order.status)))
    .filter(order=>(order.lines||[]).some(line=>Number(line.qty||0)>0))
    .sort((a,b)=>{
      const dueA=a.dueDate?scheduleDateFromKey(a.dueDate).getTime():Number.MAX_SAFE_INTEGER;
      const dueB=b.dueDate?scheduleDateFromKey(b.dueDate).getTime():Number.MAX_SAFE_INTEGER;
      return dueA-dueB||new Date(a.createdAt||0)-new Date(b.createdAt||0)||String(a.orderNumber||"").localeCompare(String(b.orderNumber||""));
    });

  const today=scheduleDateKey(new Date());
  const orderPlans=[];
  const productionGroups=new Map();
  const warnings=[];

  for(const order of openOrders){
    const linePlans=[];
    for(const line of (order.lines||[])){
      const required=Math.max(0,Math.round(Number(line.qty||0)));
      if(!required)continue;
      const product=productById.get(line.productId)||productByCode.get(String(line.productCode||"").trim().toUpperCase());
      const colourName=scheduleColourName(line);
      if(!product){
        linePlans.push({...line,required,stockAllocated:0,toManufacture:required,completionDate:null,issue:"Product is not linked"});
        warnings.push(`${line.productCode||line.productName||"Unknown product"} is not linked to an app product.`);
        continue;
      }
      const stockAllocated=takeScheduleStock(stockByKey,product.id,colourName,required);
      const toManufacture=Math.max(0,required-stockAllocated);
      const linePlan={...line,productId:product.id,productCode:product.code,productName:product.name,colourName,required,stockAllocated,toManufacture,completionDate:toManufacture?null:today,issue:""};
      linePlans.push(linePlan);
      if(toManufacture>0){
        const groupKey=`${product.id}::${scheduleNormalise(colourName)}`;
        if(!productionGroups.has(groupKey))productionGroups.set(groupKey,{
          key:groupKey,product,colourName,tasks:[],totalRequired:0,dailyCapacity:Math.max(0,Math.round(Number(product.dailyCapacity||0))),mouldQuantity:Math.max(0,Math.round(Number(product.mouldQuantity||0)))
        });
        const group=productionGroups.get(groupKey);
        const task={order,linePlan,remaining:toManufacture};
        group.tasks.push(task);
        group.totalRequired+=toManufacture;
      }
    }
    orderPlans.push({order,linePlans,completionDate:null,readyNow:false,unscheduled:false,manufacturingRequired:linePlans.reduce((sum,line)=>sum+line.toManufacture,0),stockAllocated:linePlans.reduce((sum,line)=>sum+line.stockAllocated,0)});
  }

  const dailyPlan=new Map();
  for(const group of productionGroups.values()){
    if(group.dailyCapacity<=0){
      group.tasks.forEach(task=>{
        task.linePlan.issue="Daily manufacturing capacity is not set";
      });
      warnings.push(`${group.product.code} has outstanding demand but no daily manufacturing capacity.`);
      continue;
    }
    if(group.mouldQuantity<=0)warnings.push(`${group.product.code} has production scheduled but its mould quantity is zero.`);
    let day=nextWorkingDay(new Date());
    let dayCapacity=group.dailyCapacity;
    for(const task of group.tasks){
      while(task.remaining>0){
        if(dayCapacity<=0){
          day=followingWorkingDay(day);
          dayCapacity=group.dailyCapacity;
        }
        const quantity=Math.min(dayCapacity,task.remaining);
        const dayKey=scheduleDateKey(day);
        if(!dailyPlan.has(dayKey))dailyPlan.set(dayKey,[]);
        dailyPlan.get(dayKey).push({
          productId:group.product.id,productCode:group.product.code,productName:group.product.name,
          colourName:group.colourName,quantity,orderId:task.order.id,orderNumber:task.order.orderNumber,customerName:task.order.customerName,
          dailyCapacity:group.dailyCapacity,mouldQuantity:group.mouldQuantity
        });
        task.remaining-=quantity;
        dayCapacity-=quantity;
        task.linePlan.completionDate=dayKey;
      }
    }
  }

  for(const plan of orderPlans){
    const issues=plan.linePlans.filter(line=>!line.completionDate);
    plan.unscheduled=issues.length>0;
    if(!plan.unscheduled){
      plan.completionDate=plan.linePlans.reduce((latest,line)=>!latest||line.completionDate>latest?line.completionDate:latest,today);
      plan.readyNow=plan.manufacturingRequired===0;
    }
    const dueKey=plan.order.dueDate?scheduleDateKey(scheduleDateFromKey(plan.order.dueDate)):"";
    plan.late=Boolean(dueKey&&plan.completionDate&&plan.completionDate>dueKey);
    plan.overdue=Boolean(dueKey&&dueKey<today&&!plan.readyNow);
  }

  const days=[...dailyPlan.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,items])=>({date,items,total:items.reduce((sum,item)=>sum+item.quantity,0)}));
  return{
    generatedAt:new Date().toISOString(),today,orders:orderPlans,days,warnings:[...new Set(warnings)],
    summary:{
      openOrders:orderPlans.length,
      readyNow:orderPlans.filter(plan=>plan.readyNow).length,
      scheduled:orderPlans.filter(plan=>plan.completionDate&&!plan.readyNow).length,
      unscheduled:orderPlans.filter(plan=>plan.unscheduled).length,
      late:orderPlans.filter(plan=>plan.late||plan.overdue).length,
      totalUnitsToManufacture:orderPlans.reduce((sum,plan)=>sum+plan.manufacturingRequired,0),
      backlogValue:orderPlans.reduce((sum,plan)=>sum+Number(plan.order.grandTotal||0),0)
    }
  };
}

function aggregateDailyScheduleItems(items){
  const grouped=new Map();
  for(const item of items){
    const key=`${item.productId}::${scheduleNormalise(item.colourName)}`;
    if(!grouped.has(key))grouped.set(key,{...item,quantity:0,orders:[]});
    const row=grouped.get(key);
    row.quantity+=item.quantity;
    if(!row.orders.some(order=>order.orderNumber===item.orderNumber))row.orders.push({orderNumber:item.orderNumber,customerName:item.customerName,quantity:item.quantity});
    else row.orders.find(order=>order.orderNumber===item.orderNumber).quantity+=item.quantity;
  }
  return [...grouped.values()].sort((a,b)=>a.productCode.localeCompare(b.productCode));
}

async function openOrderCompletionSchedule(){
  const schedule=await buildOrderCompletionSchedule();
  pageTitle.textContent="Completion Schedule";
  backBtn.classList.remove("hidden");
  navState("orders");
  const firstDays=schedule.days.slice(0,14);
  main.innerHTML=`
    <section class="schedule-hero card">
      <div><div class="step-label">Calculated from live app data</div><h2>Order completion schedule</h2><p class="muted">Uses open orders, stock on hand, mould quantities and each product's daily manufacturing capacity. Earlier due dates receive stock and production first.</p></div>
      <button class="primary" id="refreshCompletionSchedule">Recalculate</button>
    </section>
    <div class="grid two schedule-stats">
      <div class="card stat"><span class="muted">Open orders</span><strong>${schedule.summary.openOrders}</strong></div>
      <div class="card stat"><span class="muted">Ready now</span><strong>${schedule.summary.readyNow}</strong></div>
      <div class="card stat"><span class="muted">Units to make</span><strong>${schedule.summary.totalUnitsToManufacture}</strong></div>
      <div class="card stat"><span class="muted">Backlog value</span><strong>${money(schedule.summary.backlogValue)}</strong></div>
      <div class="card stat"><span class="muted">Late or at risk</span><strong>${schedule.summary.late}</strong></div>
      <div class="card stat"><span class="muted">Needs setup</span><strong>${schedule.summary.unscheduled}</strong></div>
    </div>

    ${schedule.warnings.length?`<section class="card schedule-warning"><h3>Information needed</h3>${schedule.warnings.map(warning=>`<p>⚠ ${esc(warning)}</p>`).join("")}</section>`:""}

    <div class="section-head"><div><h2>Daily production plan</h2><p class="muted">The first 14 scheduled working days are shown.</p></div></div>
    <div class="schedule-day-list">
      ${firstDays.length?firstDays.map(day=>{
        const rows=aggregateDailyScheduleItems(day.items);
        return `<section class="card schedule-day">
          <div class="schedule-day-head"><div><span class="muted">Working day</span><h3>${scheduleDisplayDate(day.date)}</h3></div><strong>${day.total} units</strong></div>
          ${rows.map(row=>`<div class="schedule-production-row">
            <div><strong>${esc(row.productCode)} · ${esc(row.productName)}</strong><p>${esc(row.colourName)}</p><small>${row.orders.map(order=>`${esc(order.orderNumber)} ${esc(order.customerName)} (${order.quantity})`).join(" · ")}</small></div>
            <div class="schedule-qty"><strong>${row.quantity}</strong><small>make</small></div>
          </div>`).join("")}
        </section>`;
      }).join(""):`<div class="empty">No manufacturing is currently required. Orders may already be covered by stock, or no open imported orders are available.</div>`}
    </div>

    <div class="section-head"><div><h2>Order completion dates</h2><p class="muted">Tap an order to open its full details.</p></div></div>
    <div class="schedule-order-list">
      ${schedule.orders.length?schedule.orders.map(plan=>{
        const label=plan.unscheduled?"Needs setup":plan.readyNow?"Ready now":scheduleDisplayDate(plan.completionDate);
        const badgeClass=plan.unscheduled?"schedule-needs-setup":plan.late||plan.overdue?"schedule-late":plan.readyNow?"schedule-ready":"schedule-planned";
        return `<button class="card schedule-order-card" onclick="viewOrder('${plan.order.id}')">
          <div class="schedule-order-head"><div><strong>${esc(plan.order.orderNumber||"Order")}</strong><h3>${esc(plan.order.customerName||"Customer")}</h3></div><span class="badge ${badgeClass}">${esc(label)}</span></div>
          <div class="schedule-order-metrics">
            <span><small>Due</small><strong>${plan.order.dueDate?scheduleDisplayDate(plan.order.dueDate):"Not set"}</strong></span>
            <span><small>Stock allocated</small><strong>${plan.stockAllocated}</strong></span>
            <span><small>Still to make</small><strong>${plan.manufacturingRequired}</strong></span>
            <span><small>Value</small><strong>${money(plan.order.grandTotal||0)}</strong></span>
          </div>
          ${plan.unscheduled?`<p class="schedule-problem">${esc(plan.linePlans.filter(line=>!line.completionDate).map(line=>`${line.productCode}: ${line.issue||"Cannot schedule"}`).join(" · "))}</p>`:""}
        </button>`;
      }).join(""):`<div class="empty">No open orders found. Import or create orders first.</div>`}
    </div>`;
  document.getElementById("refreshCompletionSchedule").onclick=openOrderCompletionSchedule;
  window.scrollTo({top:0,behavior:"smooth"});
}

async function addCompletionScheduleDashboardCard(){
  if(route!=="dashboard"||document.querySelector(".completion-schedule-dashboard"))return;
  const schedule=await buildOrderCompletionSchedule();
  const card=document.createElement("section");
  card.className="card completion-schedule-dashboard";
  card.innerHTML=`
    <div class="section-head"><div><div class="step-label">Production control</div><h2>Order completion schedule</h2></div><span class="badge">${schedule.summary.openOrders} open</span></div>
    <div class="schedule-dashboard-grid">
      <div><small>Ready now</small><strong>${schedule.summary.readyNow}</strong></div>
      <div><small>Units to manufacture</small><strong>${schedule.summary.totalUnitsToManufacture}</strong></div>
      <div><small>Late or at risk</small><strong>${schedule.summary.late}</strong></div>
    </div>
    <button class="primary" onclick="openOrderCompletionSchedule()">Open completion schedule</button>`;
  main.prepend(card);
}

async function addCompletionScheduleOrdersButton(){
  if(route!=="orders"||document.getElementById("completionScheduleOrdersBtn"))return;
  const button=document.createElement("button");
  button.id="completionScheduleOrdersBtn";
  button.className="primary";
  button.textContent="Completion schedule";
  button.onclick=openOrderCompletionSchedule;
  const firstActions=main.querySelector(".actions,.section-head,.toolbar-stack");
  if(firstActions?.classList.contains("actions"))firstActions.prepend(button);
  else main.prepend(button);
}

const dashboardBeforeCompletionSchedule=dashboard;
dashboard=async function(...args){
  await dashboardBeforeCompletionSchedule(...args);
  await addCompletionScheduleDashboardCard();
};
const ordersPageBeforeCompletionSchedule=ordersPage;
ordersPage=async function(...args){
  await ordersPageBeforeCompletionSchedule(...args);
  await addCompletionScheduleOrdersButton();
};

window.buildOrderCompletionSchedule=buildOrderCompletionSchedule;
window.openOrderCompletionSchedule=openOrderCompletionSchedule;
