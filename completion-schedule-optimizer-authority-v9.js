/* V9.0.78 — optimized completion-schedule authority.
   Production stock/capacity allocation follows the business-outcome ranking. Raw manufacture is
   product-based (colour-neutral); Painting remains order/colour specific later in the workflow. */
(function(){
'use strict';
const CLOSED=new Set(['draft','cancelled','delivered','collected','completed','invoiced','declined']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const date=v=>new Date(`${dk(v)}T12:00:00`);
const isWork=d=>![0,6].includes(d.getDay());
const onWork=v=>{const d=date(v);while(!isWork(d))d.setDate(d.getDate()+1);return d};
const nextWork=v=>{const d=date(v);do d.setDate(d.getDate()+1);while(!isWork(d));return d};
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
function recentCapacity(jobs,productId,configured){
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-14);const days=new Map();
  for(const j of jobs){if(j?.kind!=='divisionRawDaily'||String(j.productId)!==String(productId))continue;const d=date(j.workDate||j.updatedAt);if(d<cutoff)continue;days.set(j.workDate,n(j.producedQty||j.completedQty));}
  const vals=[...days.values()].filter(x=>x>0);if(!vals.length)return configured;
  const avg=vals.reduce((s,x)=>s+x,0)/vals.length;if(!configured)return Math.max(1,Math.round(avg));
  return Math.max(1,Math.round(Math.min(configured*1.25,Math.max(configured*.6,configured*.35+avg*.65))));
}
async function optimizedSchedule(){
  const optimizer=window.VUBusinessOutcomeOptimizer;if(!optimizer?.build)throw new Error('Business outcome optimiser is unavailable');
  const [opt,orders,products,balances,jobs]=await Promise.all([optimizer.build(),getAll('orders'),getAll('products'),getAll('inventoryBalances'),getAll('productionJobs')]);
  const productById=new Map(products.map(p=>[String(p.id),p])),productByCode=new Map(products.map(p=>[String(p.code||'').trim().toUpperCase(),p]));
  const priority=opt.byOrderId;
  const active=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>productLine(l)&&n(l.qty)>0)).sort((a,b)=>(priority.get(String(a.id))?.priority||9999)-(priority.get(String(b.id))?.priority||9999));
  const rawByProduct=new Map(),hasRaw=new Set();
  for(const b of balances){const pid=String(b.productId||''),isRaw=norm(b.colourName)==='raw stock'||String(b.id||'').endsWith('::raw');if(isRaw){hasRaw.add(pid);rawByProduct.set(pid,n(rawByProduct.get(pid))+n(b.quantity));}}
  for(const b of balances){const pid=String(b.productId||'');if(hasRaw.has(pid))continue;rawByProduct.set(pid,n(rawByProduct.get(pid))+n(b.quantity));}
  const today=dk(new Date()),orderPlans=[],groups=new Map(),warnings=[];
  for(const order of active){
    const linePlans=[];
    for(const line of(order.lines||[])){
      const required=Math.max(0,Math.round(n(line.qty)));if(!required||!productLine(line))continue;
      const product=productById.get(String(line.productId||''))||productByCode.get(String(line.productCode||'').trim().toUpperCase());
      if(!product){linePlans.push({...line,required,stockAllocated:0,toManufacture:required,completionDate:null,issue:'Product is not linked'});warnings.push(`${line.productCode||line.productName||'Unknown product'} is not linked to an app product.`);continue;}
      const pid=String(product.id),available=n(rawByProduct.get(pid)),used=Math.min(available,required);rawByProduct.set(pid,available-used);const toManufacture=required-used;
      const lp={...line,productId:product.id,productCode:product.code,productName:product.name,colourName:line?.colour?.name||line?.colourName||'Standard',required,stockAllocated:used,toManufacture,completionDate:toManufacture?null:today,issue:''};linePlans.push(lp);
      if(toManufacture>0){if(!groups.has(pid)){const configured=Math.max(0,Math.round(n(product.dailyCapacity||product.manufacturingCapacityPerDay||product.capacityPerDay)));groups.set(pid,{product,tasks:[],dailyCapacity:recentCapacity(jobs,pid,configured),configuredCapacity:configured,mouldQuantity:Math.max(0,Math.round(n(product.mouldQuantity)))})}groups.get(pid).tasks.push({order,linePlan:lp,remaining:toManufacture});}
    }
    const optRow=priority.get(String(order.id));orderPlans.push({order,linePlans,optimization:optRow||null,optimizationPriority:optRow?.priority||9999,optimizationScore:optRow?.score||0,completionDate:null,readyNow:false,unscheduled:false,manufacturingRequired:linePlans.reduce((s,l)=>s+n(l.toManufacture),0),stockAllocated:linePlans.reduce((s,l)=>s+n(l.stockAllocated),0)});
  }
  const dailyPlan=new Map();
  for(const g of groups.values()){
    if(g.dailyCapacity<=0){for(const t of g.tasks)t.linePlan.issue='Daily manufacturing capacity is not set and no recent output history is available';warnings.push(`${g.product.code} has demand but no usable daily capacity.`);continue}
    let day=onWork(new Date()),capacity=g.dailyCapacity;
    for(const task of g.tasks){while(task.remaining>0){if(capacity<=0){day=nextWork(day);capacity=g.dailyCapacity}const qty=Math.min(capacity,task.remaining),key=dk(day);if(!dailyPlan.has(key))dailyPlan.set(key,[]);dailyPlan.get(key).push({productId:g.product.id,productCode:g.product.code,productName:g.product.name,colourName:'Raw Stock',quantity:qty,orderId:task.order.id,orderNumber:task.order.orderNumber,customerName:task.order.customerName,dailyCapacity:g.dailyCapacity,configuredCapacity:g.configuredCapacity,mouldQuantity:g.mouldQuantity,optimizationPriority:priority.get(String(task.order.id))?.priority||9999});task.remaining-=qty;capacity-=qty;task.linePlan.completionDate=key;}}
  }
  for(const p of orderPlans){const unresolved=p.linePlans.filter(l=>!l.completionDate);p.unscheduled=unresolved.length>0;if(!p.unscheduled){p.completionDate=p.linePlans.reduce((latest,l)=>!latest||l.completionDate>latest?l.completionDate:latest,today);p.readyNow=p.manufacturingRequired===0;}const due=p.order.dueDate?dk(p.order.dueDate):'';p.late=!!(due&&p.completionDate&&p.completionDate>due);p.overdue=!!(due&&due<today&&!p.readyNow);}
  const days=[...dailyPlan.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,items])=>({date,items,total:items.reduce((s,x)=>s+n(x.quantity),0)}));
  return{generatedAt:new Date().toISOString(),today,orders:orderPlans,days,warnings:[...new Set(warnings)],optimization:opt,summary:{openOrders:orderPlans.length,readyNow:orderPlans.filter(p=>p.readyNow).length,scheduled:orderPlans.filter(p=>p.completionDate&&!p.readyNow).length,unscheduled:orderPlans.filter(p=>p.unscheduled).length,late:orderPlans.filter(p=>p.late||p.overdue).length,totalUnitsToManufacture:orderPlans.reduce((s,p)=>s+p.manufacturingRequired,0),backlogValue:orderPlans.reduce((s,p)=>s+n(p.order.grandTotal),0),target:opt.target,selectedValue:opt.selectedValue}};
}
window.buildOrderCompletionSchedule=optimizedSchedule;try{buildOrderCompletionSchedule=optimizedSchedule}catch{}
window.VUOptimizedCompletionSchedule={version:'9.0.78',build:optimizedSchedule,recentCapacity};
})();
