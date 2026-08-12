/* V9.0.84 — manager planned fulfilment dates influence priority without becoming customer commitments. */
(function(){
'use strict';
const base=window.VUBusinessOutcomeOptimizer;if(!base?.build||!window.VUOrderCommitment)return;
const dk=VUOrderCommitment.dateKey;
const today=()=>dk(new Date());
const daysFromToday=value=>{const d=dk(value);if(!d)return 999;return Math.round((new Date(`${d}T12:00:00`)-new Date(`${today()}T12:00:00`))/86400000)};
async function build(){
  const plan=await base.build();
  const rows=(plan.ranked||[]).map(r=>{
    const c=VUOrderCommitment.commitment(r.order),planned=dk(r.order?.managerPlannedDate),days=planned?daysFromToday(planned):999;
    let adjustment=0;const reasons=[...(r.reasons||[])];
    if(planned){
      if(days<0){adjustment+=34;reasons.unshift(`manager plan overdue by ${Math.abs(days)} day${Math.abs(days)===1?'':'s'}`)}
      else if(days===0){adjustment+=32;reasons.unshift('manager plan is today')}
      else if(days===1){adjustment+=26;reasons.unshift('manager plan is tomorrow')}
      else if(days<=3){adjustment+=18;reasons.unshift(`manager plan in ${days} days`)}
      else if(days<=7){adjustment+=9;reasons.push(`manager plan within ${days} days`)}
      else if(days>=14){adjustment-=Math.min(8,Math.floor((days-10)/5)*2)}
      if(c.hard&&c.date&&c.date!==planned)reasons.unshift(`${c.source} remains the hard commitment`);
    }
    return{...r,score:Number((Number(r.score||0)+adjustment).toFixed(2)),managerPlannedDate:planned,managerPlannedType:r.order?.managerPlannedType||VUOrderCommitment.typeOf(r.order),managerPlanDays:days,reasons};
  }).sort((a,b)=>b.score-a.score||a.commitmentDays-b.commitmentDays||a.managerPlanDays-b.managerPlanDays||b.efficiency-a.efficiency||b.value-a.value);
  rows.forEach((r,i)=>r.priority=i+1);
  const goal=Number(plan.target||0)||rows.reduce((s,r)=>s+Number(r.value||0),0);let value=0;const selected=[];
  for(const r of rows){const protectedDate=(r.commitmentHard&&r.commitmentDays<=7)||(r.managerPlannedDate&&r.managerPlanDays<=5);if(goal>0&&value>=goal&&r.stage==='production'&&!protectedDate&&r.commitmentDays>7)continue;selected.push(r);value+=Number(r.value||0)}
  return{...plan,ranked:rows,selected,selectedValue:value,byOrderId:new Map(rows.map(r=>[String(r.orderId),r]))};
}
async function priorityMap(){const p=await build();return new Map(p.ranked.map(r=>[String(r.orderId),r.priority]));}
window.VUBusinessOutcomeOptimizer={...base,version:'9.0.84',build,priorityMap};
window.VUManagerPlanPriority={version:'9.0.84'};
})();
