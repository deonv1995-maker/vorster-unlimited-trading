/* V9.3.5 — Digital Factory automatic exception handling.
   Leader problems become operational blocks linked to affected orders. Blocked work remains required;
   the optimiser may favour unblocked work while hard customer commitments remain visible and protected. */
(function(){
'use strict';
if(window.VUDigitalFactoryExceptions)return;
const VERSION='9.3.5';
const RAW=['Casting','Packing','Resin'];
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const today=()=>dk(new Date());
const pkey=(division,code,id)=>`${norm(division)}|${norm(code)||String(id||'')}`;
async function activeProblems(date=today()){
  const d=dk(date),jobs=await getAll('productionJobs');
  return jobs.filter(j=>j?.kind==='digitalDivisionActual'&&j.workDate===d&&RAW.includes(j.division)&&j.status==='Problem'&&j.problemType&&j.exceptionResolved!==true).map(j=>({
    id:j.id,workDate:d,division:j.division,productId:j.productId||'',productCode:j.productCode||'',productName:j.productName||'',problemType:j.problemType||'Problem',note:j.note||'',actualQty:n(j.actualQty),targetQty:n(j.targetQty),updatedAt:j.updatedAt||j.createdAt||''
  }));
}
async function strictPlan(date=today()){
  if(window.VUStrictDivisionWorksheets?.strictPlan)return window.VUStrictDivisionWorksheets.strictPlan(date);
  if(window.VUThreeStagePlan)return window.VUThreeStagePlan(date);
  return null;
}
async function impact(date=today()){
  const d=dk(date),problems=await activeProblems(d),plan=await strictPlan(d),orders=await getAll('orders');
  const orderById=new Map(orders.map(o=>[String(o.id),o])),blocked=new Map();
  if(plan){
    const problemMap=new Map(problems.map(p=>[pkey(p.division,p.productCode,p.productId),p]));
    for(const division of RAW){for(const item of plan.productionByDivision?.[division]||[]){
      const problem=problemMap.get(pkey(division,item.productCode,item.productId));if(!problem)continue;
      const oid=String(item.orderId||'');if(!oid)continue;
      let row=blocked.get(oid);if(!row){const o=orderById.get(oid);row={orderId:oid,orderNumber:o?.orderNumber||item.orderNumber||'',customerName:o?.customerName||item.customerName||'',order:o||null,blocks:[]};blocked.set(oid,row)}
      if(!row.blocks.some(x=>x.problemId===problem.id))row.blocks.push({problemId:problem.id,division,productCode:problem.productCode,productName:problem.productName,problemType:problem.problemType,note:problem.note,quantity:n(item.quantity)});
    }}
  }
  const byProblem=new Map(problems.map(p=>[p.id,{...p,orders:[]}]))
  for(const row of blocked.values())for(const b of row.blocks){const p=byProblem.get(b.problemId);if(p&&!p.orders.some(x=>x.orderId===row.orderId))p.orders.push({orderId:row.orderId,orderNumber:row.orderNumber,customerName:row.customerName,quantity:b.quantity})}
  return{date:d,problems:[...byProblem.values()],blockedOrders:[...blocked.values()],byOrderId:blocked};
}
async function resolve(problemId,resolved=true){
  const job=await getOne('productionJobs',problemId);if(!job)return false;const now=new Date().toISOString();
  await putOne('productionJobs',{...job,exceptionResolved:!!resolved,exceptionResolvedAt:resolved?now:null,exceptionResolvedBy:'Manager',updatedAt:now,status:resolved&&job.status==='Problem'?'In progress':job.status});
  try{window.VUOrderProgress?.invalidate?.();window.dispatchEvent(new CustomEvent('vu:digital-exception-changed',{detail:{problemId,resolved:!!resolved}}))}catch{}
  return true;
}
const base=window.VUBusinessOutcomeOptimizer;
if(base?.build&&!base.__digitalExceptionBase){
  const baseBuild=base.build.bind(base);
  async function build(){
    const [plan,imp]=await Promise.all([baseBuild(),impact(today())]);
    const rows=(plan.ranked||[]).map(r=>{
      const hit=imp.byOrderId.get(String(r.orderId||r.order?.id||''));if(!hit)return r;
      const hard=!!r.commitmentHard,days=Number(r.commitmentDays??999),protectedCommitment=hard&&days<=3;
      const penalty=protectedCommitment?0:hard?6:24;
      const reasons=[...(r.reasons||[])];
      reasons.unshift(`${hit.blocks.length} active factory block${hit.blocks.length===1?'':'s'}: ${hit.blocks.map(b=>`${b.division} ${b.productCode||''} (${b.problemType})`).join(', ')}`);
      if(protectedCommitment)reasons.unshift('customer commitment remains protected despite factory block');
      return{...r,score:Number((Number(r.score||0)-penalty).toFixed(2)),factoryBlocked:true,factoryBlocks:hit.blocks,exceptionPenalty:penalty,reasons};
    }).sort((a,b)=>b.score-a.score||Number(a.commitmentDays||999)-Number(b.commitmentDays||999)||Number(b.value||0)-Number(a.value||0));
    rows.forEach((r,i)=>r.priority=i+1);
    const goal=Number(plan.target||0)||0,selected=[],deferredBlocked=[];let value=0;
    for(const r of rows){
      const protectedCommitment=!!r.commitmentHard&&Number(r.commitmentDays??999)<=3;
      if(r.factoryBlocked&&!protectedCommitment){deferredBlocked.push(r);continue}
      if(goal>0&&value>=goal&&r.stage==='production'&&!protectedCommitment)continue;
      selected.push(r);value+=Number(r.value||0);
    }
    if(goal<=0||value<goal){for(const r of deferredBlocked){selected.push(r);value+=Number(r.value||0);if(goal>0&&value>=goal)break}}
    return{...plan,ranked:rows,selected,selectedValue:value,factoryExceptions:imp,byOrderId:new Map(rows.map(r=>[String(r.orderId),r]))};
  }
  window.VUBusinessOutcomeOptimizer={...base,__digitalExceptionBase:true,version:'9.3.5',build,priorityMap:async()=>new Map((await build()).ranked.map(r=>[String(r.orderId),r.priority]))};
}
window.VUDigitalFactoryExceptions={version:VERSION,activeProblems,impact,resolve};
})();