/* V9.0.79 — customer commitment dates are hard inputs to business priority.
   Earlier commitments receive urgency; later commitments prevent premature rushing. */
(function(){
'use strict';
const base=window.VUBusinessOutcomeOptimizer;if(!base?.build||!window.VUOrderCommitment)return;
const dk=VUOrderCommitment.dateKey;
const today=()=>dk(new Date());
const daysFromToday=value=>{const d=dk(value);if(!d)return 999;return Math.round((new Date(`${d}T12:00:00`)-new Date(`${today()}T12:00:00`))/86400000)};
async function build(){
  const plan=await base.build();
  const rows=(plan.ranked||[]).map(r=>{
    const c=VUOrderCommitment.commitment(r.order),days=c.date?daysFromToday(c.date):999;
    let adjustment=0;const reasons=[...(r.reasons||[])];
    if(c.hard&&c.date){
      if(days<0){adjustment+=55;reasons.unshift(`${c.source} overdue by ${Math.abs(days)} day${Math.abs(days)===1?'':'s'}`);}
      else if(days===0){adjustment+=50;reasons.unshift(`${c.source} is today`);}
      else if(days===1){adjustment+=42;reasons.unshift(`${c.source} is tomorrow`);}
      else if(days<=3){adjustment+=32;reasons.unshift(`${c.source} in ${days} days`);}
      else if(days<=7){adjustment+=20;reasons.unshift(`${c.source} in ${days} days`);}
      else if(days>=14){adjustment-=Math.min(18,Math.floor((days-7)/3)*3);reasons.push(`${c.source} is later — capacity can serve nearer commitments first`);}
    }
    return{...r,score:Number((Number(r.score||0)+adjustment).toFixed(2)),commitmentType:c.type,commitmentDate:c.date,commitmentHard:c.hard,commitmentSource:c.source,commitmentDays:days,reasons};
  }).sort((a,b)=>b.score-a.score||a.commitmentDays-b.commitmentDays||b.efficiency-a.efficiency||b.value-a.value);
  rows.forEach((r,i)=>r.priority=i+1);
  const goalValue=Number(plan.target||0)||rows.reduce((s,r)=>s+Number(r.value||0),0);let selectedValue=0;const selected=[];
  for(const r of rows){const cSoon=r.commitmentHard&&r.commitmentDays<=7;if(goalValue>0&&selectedValue>=goalValue&&r.stage==='production'&&!cSoon&&r.commitmentDays>7)continue;selected.push(r);selectedValue+=Number(r.value||0);}
  return{...plan,ranked:rows,selected,selectedValue,byOrderId:new Map(rows.map(r=>[String(r.orderId),r]))};
}
async function priorityMap(){const p=await build();return new Map(p.ranked.map(r=>[String(r.orderId),r.priority]));}
window.VUBusinessOutcomeOptimizer={...base,version:'9.0.79',build,priorityMap};
})();