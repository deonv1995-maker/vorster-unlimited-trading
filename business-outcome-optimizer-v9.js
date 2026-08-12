/* V9.0.78 — business-outcome order optimiser.
   Scores open orders against one common goal: maximise realistically achievable invoiced/delivered
   value while protecting due dates, continuity, stock accuracy, production capacity and fairness.
   Previous actual factory work is part of the score so yesterday's effort is not discarded. */
(function(){
'use strict';
if(window.VUBusinessOutcomeOptimizer)return;
const CLOSED=new Set(['draft','cancelled','delivered','collected','completed','invoiced','declined']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const dateKey=v=>{const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const previousWorkday=()=>{const d=new Date();do d.setDate(d.getDate()-1);while([0,6].includes(d.getDay()));return dateKey(d)};
const dayDiff=v=>{if(!v)return 999;const a=new Date(`${dateKey(new Date())}T12:00:00`),b=new Date(`${dateKey(v)}T12:00:00`);return Math.round((b-a)/86400000)};
const stageOf=o=>{const wf=norm(o?.workflowStage),fs=norm(o?.finishingStatus),ps=norm(o?.paintingStatus);if(['delivery','delivery-scheduled'].includes(wf)||ps==='completed')return'delivery';if(wf==='painting'||fs==='completed')return'painting';if(wf==='finishing'||o?.rawIssued===true)return'finishing';return'production'};
const target=()=>typeof vuDailyInvoiceTarget==='function'?n(vuDailyInvoiceTarget()):n(localStorage.getItem('vu-daily-invoice-target'));
const areaOf=(o,c)=>String(o?.deliveryArea||o?.area||c?.deliveryArea||c?.area||c?.suburb||c?.city||c?.location||'Area not set').split(',')[0].trim()||'Area not set';
const productCost=p=>{for(const v of [p?.unitCost,p?.costPrice,p?.manufacturingCost,p?.cost,p?.averageCost]){const x=Number(v);if(Number.isFinite(x)&&x>0)return x}return null};
function recentOutput(jobs,days=7){
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);const byProduct=new Map();
  for(const j of jobs){if(j?.kind!=='divisionRawDaily')continue;const dt=new Date(`${j.workDate||dateKey(j.updatedAt)}T12:00:00`);if(Number.isNaN(dt.getTime())||dt<cutoff)continue;const pid=String(j.productId||'');if(!pid)continue;const row=byProduct.get(pid)||{qty:0,days:new Set()};row.qty+=n(j.producedQty||j.completedQty);row.days.add(j.workDate);byProduct.set(pid,row)}
  const out=new Map();for(const [pid,row] of byProduct)out.set(pid,row.days.size?row.qty/row.days.size:0);return out;
}
async function build(){
  const [orders,products,customers,balances,jobs]=await Promise.all([getAll('orders'),getAll('products'),getAll('customers'),getAll('inventoryBalances'),getAll('productionJobs')]);
  const productById=new Map(products.map(p=>[String(p.id),p])),customerById=new Map(customers.map(c=>[String(c.id),c]));
  const raw=new Map();for(const b of balances){const isRaw=norm(b.colourName)==='raw stock'||String(b.id||'').endsWith('::raw');if(isRaw)raw.set(String(b.productId||''),n(raw.get(String(b.productId||'')))+n(b.quantity))}
  const avgOutput=recentOutput(jobs),yesterday=previousWorkday();
  const yesterdayProducts=new Set(jobs.filter(j=>j?.kind==='divisionRawDaily'&&j.workDate===yesterday&&n(j.producedQty||j.completedQty)>0).map(j=>String(j.productId||'')));
  const yesterdayOrders=new Set();for(const j of jobs){if((j?.kind==='paintingCaptureSet'||j?.kind==='orderPaintingLine')&&(j.workDate===yesterday||j.lastCapturedDate===yesterday))yesterdayOrders.add(String(j.orderId||''))}
  const active=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>productLine(l)&&n(l.qty)>0));
  const areaStats=new Map();for(const o of active){const a=areaOf(o,customerById.get(String(o.customerId))),r=areaStats.get(a)||{count:0,value:0};r.count++;r.value+=n(o.grandTotal);areaStats.set(a,r)}
  const dailyTarget=target();
  const prelim=active.map(order=>{
    const lines=(order.lines||[]).filter(l=>productLine(l)&&n(l.qty)>0);let contribution=0,costedRevenue=0,knownCostLines=0;
    for(const l of lines){const p=productById.get(String(l.productId||''))||{},q=n(l.qty),sell=n(l.unitPrice||l.price),cost=productCost(p);if(cost!==null&&sell>0){contribution+=Math.max(0,(sell-cost)*q);costedRevenue+=sell*q;knownCostLines++}}
    return{order,estimatedContribution:knownCostLines?contribution:n(order.grandTotal),marginDataCoverage:lines.length?knownCostLines/lines.length:0};
  });
  const maxEconomic=Math.max(1,...prelim.map(x=>x.estimatedContribution));
  const rows=prelim.map(({order,estimatedContribution,marginDataCoverage})=>{
    const customer=customerById.get(String(order.customerId)),stage=stageOf(order),lines=(order.lines||[]).filter(l=>productLine(l)&&n(l.qty)>0);
    let required=0,covered=0,effortDays=0,continuityLines=0,noCapacity=0;
    for(const l of lines){const pid=String(l.productId||''),q=n(l.qty),available=n(raw.get(pid)),use=Math.min(q,available),short=Math.max(0,q-use),p=productById.get(pid)||{},historical=n(avgOutput.get(pid)),configured=n(p.dailyCapacity||p.manufacturingCapacityPerDay||p.capacityPerDay),capacity=historical>0?Math.max(historical,configured*.5):configured;required+=q;covered+=use;if(yesterdayProducts.has(pid))continuityLines++;if(short>0){if(capacity>0)effortDays=Math.max(effortDays,short/capacity);else noCapacity++}}
    const coverage=required?covered/required:0,value=n(order.grandTotal),dueDays=dayDiff(order.dueDate||order.requiredDate||order.deliveryDate),ageDays=Math.max(0,Math.round((Date.now()-new Date(order.createdAt||Date.now()).getTime())/86400000)),area=areaOf(order,customer),areaStat=areaStats.get(area)||{count:1,value};
    let score=0;const reasons=[];
    const stagePts={delivery:42,painting:30,finishing:20,production:0}[stage]||0;score+=stagePts;if(stagePts)reasons.push(`${stage} is close to invoicing`);
    const coveragePts=coverage*32;score+=coveragePts;if(coverage>=.8)reasons.push(`${Math.round(coverage*100)}% raw-stock covered`);
    const economicPts=(estimatedContribution/maxEconomic)*22;score+=economicPts;
    if(marginDataCoverage>=.5)reasons.push('profit contribution considered');
    else if(dailyTarget>0&&value>=dailyTarget*.35)reasons.push('meaningful contribution to daily target');
    const urgency=dueDays<=0?28:dueDays<=2?23:dueDays<=5?15:dueDays<=10?7:0;score+=urgency;if(urgency>=15)reasons.push(dueDays<=0?'overdue':'due soon');
    const continuation=(yesterdayOrders.has(String(order.id))?18:0)+Math.min(12,continuityLines*4);score+=continuation;if(continuation)reasons.push('continues yesterday\'s work');
    const routePts=Math.min(12,Math.max(0,(areaStat.count-1)*3));score+=routePts;if(routePts)reasons.push(`${areaStat.count} open orders in ${area}`);
    const fairness=Math.min(10,ageDays/3);score+=fairness;if(ageDays>=21)reasons.push('older order protected from starvation');
    const effortPenalty=Math.min(24,effortDays*6);score-=effortPenalty;if(effortDays<=1&&stage==='production')reasons.push('low remaining production effort');
    if(noCapacity){score-=30;reasons.push('capacity information missing')}
    if(norm(order.status)==='confirmed')score+=4;
    const efficiency=estimatedContribution/Math.max(1,required+effortDays*10);
    return{orderId:order.id,order,customer,stage,area,score:Number(score.toFixed(2)),coverage,required,covered,effortDays:Number(effortDays.toFixed(2)),value,estimatedContribution:Number(estimatedContribution.toFixed(2)),marginDataCoverage,dueDays,ageDays,efficiency,reasons};
  }).sort((a,b)=>b.score-a.score||b.efficiency-a.efficiency||b.value-a.value||new Date(a.order.createdAt||0)-new Date(b.order.createdAt||0));
  rows.forEach((r,i)=>r.priority=i+1);
  const goalValue=dailyTarget||rows.reduce((s,r)=>s+r.value,0);let selectedValue=0;const selected=[];
  for(const r of rows){if(goalValue>0&&selectedValue>=goalValue&&r.stage==='production'&&r.dueDays>5)continue;selected.push(r);selectedValue+=r.value}
  return{generatedAt:new Date().toISOString(),previousWorkday:yesterday,target:dailyTarget,ranked:rows,selected,selectedValue,byOrderId:new Map(rows.map(r=>[String(r.orderId),r]))};
}
async function priorityMap(){const p=await build();return new Map(p.ranked.map(r=>[String(r.orderId),r.priority]))}
window.VUBusinessOutcomeOptimizer={version:'9.0.78',build,priorityMap,stageOf};
})();
