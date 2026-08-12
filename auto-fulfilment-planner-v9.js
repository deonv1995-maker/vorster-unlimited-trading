/* V9.0.89 — automatic delivery/collection day assignment.
   The algorithm owns the calendar by default. Customer commitments are hard constraints;
   manager planned dates are explicit overrides; all other orders are assigned automatically. */
(function(){
'use strict';
if(window.VUAutoFulfilmentPlanner)return;
function num(v){v=Number(v||0);return isFinite(v)&&v>0?v:0;}
function norm(v){return String(v||'').trim().toLowerCase();}
function dk(v){if(v instanceof Date&&!isNaN(v.getTime()))return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');var s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';}
function date(v){var k=dk(v);return k?new Date(k+'T12:00:00'):new Date();}
function workday(v){var d=date(v);while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+1);return dk(d);}
function addWorkdays(v,n){var d=date(v),left=Math.max(0,Number(n||0));while(left>0){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)left--;}return workday(d);}
function daysBetween(a,b){return Math.round((date(b)-date(a))/86400000);}
function typeOf(o){try{if(window.VUOrderCommitment&&typeof window.VUOrderCommitment.typeOf==='function')return window.VUOrderCommitment.typeOf(o);}catch(e){}return /collect/i.test(String((o&&(o.fulfilmentType||o.fulfillmentType||o.preference))||''))?'Collection':'Delivery';}
function commitment(o){try{if(window.VUOrderCommitment&&typeof window.VUOrderCommitment.commitment==='function')return window.VUOrderCommitment.commitment(o);}catch(e){}var t=typeOf(o),d=dk(t==='Collection'?o.requiredCollectionDate:o.requiredDeliveryDate);return{type:t,date:d,hard:!!d,source:d?'Required '+t.toLowerCase()+' date':'No required date'};}
function areaOf(o,c){return String((o&&(o.deliveryArea||o.area))||(c&&(c.deliveryArea||c.area||c.suburb||c.city||c.location))||'Area not set').split(',')[0].trim()||'Area not set';}
async function build(){
  var today=workday(new Date()),target=0;try{target=typeof vuDailyInvoiceTarget==='function'?num(vuDailyInvoiceTarget()):num(localStorage.getItem('vu-daily-invoice-target'));}catch(e){}
  var results=await Promise.all([getAll('orders'),getAll('customers'),getAll('productionJobs'),window.buildOrderCompletionSchedule?window.buildOrderCompletionSchedule():Promise.resolve({orders:[]}),window.VUBusinessOutcomeOptimizer&&window.VUBusinessOutcomeOptimizer.build?window.VUBusinessOutcomeOptimizer.build():Promise.resolve({ranked:[]}),window.VUOrderProgress&&window.VUOrderProgress.buildAll?window.VUOrderProgress.buildAll():Promise.resolve(new Map())]);
  var orders=results[0]||[],customers=results[1]||[],jobs=results[2]||[],schedule=results[3]||{orders:[]},opt=results[4]||{ranked:[]},progress=results[5]||new Map();
  var customerById=new Map();for(var i=0;i<customers.length;i++)customerById.set(String(customers[i].id),customers[i]);
  var scheduleById=new Map();for(var s=0;s<(schedule.orders||[]).length;s++)scheduleById.set(String(schedule.orders[s].order.id),schedule.orders[s]);
  var priority=new Map();for(var r=0;r<(opt.ranked||[]).length;r++)priority.set(String(opt.ranked[r].orderId),opt.ranked[r]);
  var savedRouteByOrder=new Map();for(var j=0;j<jobs.length;j++){var job=jobs[j];if(!job||job.kind!=='deliveryRoutePlan'||!dk(job.workDate))continue;for(var st=0;st<(job.stops||[]).length;st++){for(var oi=0;oi<(job.stops[st].orderIds||[]).length;oi++)savedRouteByOrder.set(String(job.stops[st].orderIds[oi]),dk(job.workDate));}}
  var closed={draft:1,cancelled:1,delivered:1,collected:1,completed:1,invoiced:1,declined:1},active=[];
  for(var o=0;o<orders.length;o++){var order=orders[o];if(closed[norm(order.status)])continue;var has=false;for(var l=0;l<(order.lines||[]).length;l++)if(num(order.lines[l].qty)>0){has=true;break;}if(!has)continue;var sp=scheduleById.get(String(order.id))||{},rank=priority.get(String(order.id))||{},c=customerById.get(String(order.customerId)),com=commitment(order),type=typeOf(order),p=progress.get(String(order.id))||{};var earliest=sp.readyNow?today:dk(sp.completionDate);if(!earliest&&num(p.percent)>=100)earliest=today;if(earliest)earliest=workday(earliest);active.push({order:order,type:type,commitment:com,customer:c,area:areaOf(order,c),value:num(order.grandTotal),priority:rank.priority||9999,score:num(rank.score),progress:p,schedule:sp,earliest:earliest,manager:dk(order.managerPlannedDate),savedRoute:savedRouteByOrder.get(String(order.id))||'',due:dk(order.dueDate)});}
  active.sort(function(a,b){return a.priority-b.priority||b.value-a.value;});
  var days=new Map(),assignments=[],unassigned=[];
  function dayState(k){if(!days.has(k))days.set(k,{date:k,value:0,deliveries:0,collections:0,areas:{},orders:[]});return days.get(k);}
  function place(row,k,source,hard,risk){var d=dayState(k);d.value+=row.value;if(row.type==='Delivery')d.deliveries++;else d.collections++;d.areas[row.area]=(d.areas[row.area]||0)+1;d.orders.push(String(row.order.id));var a={order:row.order,date:k,type:row.type,source:source,hard:!!hard,risk:risk||'',priority:row.priority,value:row.value,area:row.area,progress:row.progress,earliest:row.earliest,commitment:row.commitment,schedule:row.schedule};assignments.push(a);return a;}
  for(var x=0;x<active.length;x++){
    var row=active[x],com=row.commitment;
    if(com.hard&&dk(com.date)){var hardDate=dk(com.date),risk='';if(row.earliest&&row.earliest>hardDate)risk='Projected completion is after the customer-required date';place(row,hardDate,com.source,true,risk);continue;}
    if(row.manager){var mrisk='';if(row.earliest&&row.earliest>row.manager)mrisk='Manager override is earlier than projected completion';place(row,row.manager,'Manager override',true,mrisk);continue;}
    if(!row.earliest){unassigned.push({order:row.order,type:row.type,source:'Needs production/setup information',priority:row.priority,value:row.value,progress:row.progress,schedule:row.schedule});continue;}
    if(row.type==='Collection'){var ck=row.earliest;if(row.due&&row.due>ck&&daysBetween(ck,row.due)<=2)ck=workday(row.due);place(row,ck,'Algorithm planned',false,'');continue;}
    var best='',bestScore=-1e9,maxLook=8;
    for(var off=0;off<=maxLook;off++){
      var cand=addWorkdays(row.earliest,off),state=dayState(cand),score=0;
      var areaCount=state.areas[row.area]||0;score+=areaCount*18;
      if(row.savedRoute&&cand===row.savedRoute)score+=35;
      if(target>0){var before=Math.abs(target-state.value),after=Math.abs(target-(state.value+row.value));score+=(before-after)/Math.max(1,target)*28;}
      score-=state.deliveries*4;score-=off*3;
      if(row.due){var dd=daysBetween(cand,row.due);if(dd<0)score-=Math.abs(dd)*22;else if(dd<=2)score+=10;}
      if(row.priority<=5)score-=off*2;
      if(score>bestScore){bestScore=score;best=cand;}
    }
    place(row,best||row.earliest,'Algorithm planned',false,'');
  }
  assignments.sort(function(a,b){return a.date.localeCompare(b.date)||a.priority-b.priority;});
  return{generatedAt:new Date().toISOString(),today:today,target:target,assignments:assignments,unassigned:unassigned,days:days};
}
window.VUAutoFulfilmentPlanner={version:'9.0.89',build:build};
})();
