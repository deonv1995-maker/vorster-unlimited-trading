/* V9.0.79 — completion risk uses explicit customer commitment dates before general due date. */
(function(){
'use strict';
if(typeof window.buildOrderCompletionSchedule!=='function'||!window.VUOrderCommitment)return;
const base=window.buildOrderCompletionSchedule,dk=VUOrderCommitment.dateKey;
window.buildOrderCompletionSchedule=async function(){
  const result=await base(),today=dk(result.today||new Date());
  for(const p of result.orders||[]){
    const c=VUOrderCommitment.commitment(p.order),deadline=dk(c.date);
    p.commitment=c;p.commitmentDate=deadline;p.commitmentType=c.type;p.commitmentHard=c.hard;
    if(deadline){p.late=!!(p.completionDate&&p.completionDate>deadline);p.overdue=!!(deadline<today&&!p.readyNow);}
  }
  if(result.summary)result.summary.late=(result.orders||[]).filter(p=>p.late||p.overdue).length;
  return result;
};
try{buildOrderCompletionSchedule=window.buildOrderCompletionSchedule}catch{}
window.VUCompletionCommitment={version:'9.0.79'};
})();