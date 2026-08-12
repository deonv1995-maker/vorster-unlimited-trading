/* V9.0.78 — holiday-aware adapter for optimized colour-neutral raw production. */
(function(){
'use strict';
if(!window.VUFactoryCalendar||typeof window.buildOrderCompletionSchedule!=='function')return;
const cal=window.VUFactoryCalendar;
const original=window.buildOrderCompletionSchedule;
window.buildOrderCompletionSchedule=async function(){
  const result=await original();
  const source=(result.days||[]).flatMap(day=>(day.items||[]).map(item=>({...item,sourceDate:day.date}))).sort((a,b)=>a.sourceDate.localeCompare(b.sourceDate)||(Number(a.optimizationPriority||9999)-Number(b.optimizationPriority||9999)));
  if(!source.length){result.today=cal.onOrAfter(result.today||new Date());return result}
  const used=new Map(),days=new Map(),completion=new Map();
  for(const item of source){
    const group=String(item.productId||item.productCode||''),capacity=Math.max(1,Math.round(Number(item.dailyCapacity||item.quantity||1)));let remaining=Math.max(0,Math.round(Number(item.quantity||0))),date=cal.onOrAfter(item.sourceDate);
    while(remaining>0){
      const usageKey=`${group}::${date}`,already=Number(used.get(usageKey)||0),space=Math.max(0,capacity-already);
      if(space<=0){date=cal.nextWorkingDay(date);continue}
      const qty=Math.min(space,remaining);used.set(usageKey,already+qty);if(!days.has(date))days.set(date,[]);days.get(date).push({...item,colourName:'Raw Stock',quantity:qty});remaining-=qty;
      const lineKey=`${item.orderId}::${item.productId}`;if(!completion.has(lineKey)||date>completion.get(lineKey))completion.set(lineKey,date);
      if(remaining>0)date=cal.nextWorkingDay(date);
    }
  }
  result.days=[...days.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,items])=>({date,items,total:items.reduce((s,i)=>s+Number(i.quantity||0),0)}));
  const today=cal.onOrAfter(result.today||new Date());result.today=today;
  for(const plan of result.orders||[]){
    for(const line of plan.linePlans||[]){if(Number(line.toManufacture||0)<=0)continue;const lineKey=`${plan.order.id}::${line.productId}`;if(completion.has(lineKey))line.completionDate=completion.get(lineKey)}
    const unresolved=(plan.linePlans||[]).filter(line=>!line.completionDate);plan.unscheduled=unresolved.length>0;
    if(!plan.unscheduled)plan.completionDate=(plan.linePlans||[]).reduce((latest,line)=>!latest||line.completionDate>latest?line.completionDate:latest,today);
    const due=plan.order?.dueDate?String(plan.order.dueDate).slice(0,10):'';plan.late=Boolean(due&&plan.completionDate&&plan.completionDate>due);plan.overdue=Boolean(due&&due<today&&!plan.readyNow);
  }
  if(result.summary){result.summary.scheduled=(result.orders||[]).filter(p=>p.completionDate&&!p.readyNow).length;result.summary.unscheduled=(result.orders||[]).filter(p=>p.unscheduled).length;result.summary.late=(result.orders||[]).filter(p=>p.late||p.overdue).length}
  return result;
};
try{buildOrderCompletionSchedule=window.buildOrderCompletionSchedule}catch{}
window.VUOptimizedCompletionCalendar={version:'9.0.78'};
})();
