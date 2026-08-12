/* V9.0.90 — hard fulfilment safety rule.
   A delivery may not be scheduled for today when raw-stock coverage is below 75%.
   Customer commitments remain visible as commitments, but the operational assignment moves
   to the next working day and is flagged at risk. Collections are not affected. */
(function(){
'use strict';
if(window.VURawCoverageFulfilmentRule)return;
var base=window.VUAutoFulfilmentPlanner;
if(!base||typeof base.build!=='function')return;
function num(v){v=Number(v||0);return isFinite(v)?v:0;}
function dateKey(v){
  if(v instanceof Date&&!isNaN(v.getTime()))return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
  var s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
}
function nextWorkingDay(v){
  var k=dateKey(v),d=k?new Date(k+'T12:00:00'):new Date();
  do d.setDate(d.getDate()+1);while(d.getDay()===0||d.getDay()===6);
  return dateKey(d);
}
function rebuildDays(assignments){
  var days=new Map();
  for(var i=0;i<assignments.length;i++){
    var a=assignments[i],k=dateKey(a.date);if(!k)continue;
    if(!days.has(k))days.set(k,{date:k,value:0,deliveries:0,collections:0,areas:{},orders:[]});
    var d=days.get(k);d.value+=num(a.value);
    if(a.type==='Delivery')d.deliveries++;else if(a.type==='Collection')d.collections++;
    var area=String(a.area||'Area not set');d.areas[area]=(d.areas[area]||0)+1;
    d.orders.push(String(a.order&&a.order.id||''));
  }
  return days;
}
async function build(){
  var plan=await base.build(),today=dateKey(plan.today||new Date()),moved=0;
  var assignments=(plan.assignments||[]).map(function(a){
    var raw=num(a.progress&&a.progress.rawPct);
    if(a.type!=='Delivery'||dateKey(a.date)!==today||raw>=75)return a;
    moved++;
    var newDate=nextWorkingDay(today);
    var commitmentToday=!!(a.commitment&&a.commitment.hard&&dateKey(a.commitment.date)===today);
    var managerToday=String(a.source||'').toLowerCase().indexOf('manager')>=0;
    var reason='Same-day delivery blocked: raw-stock coverage is '+Math.round(raw)+'%, below the 75% minimum.';
    if(commitmentToday)reason+=' Customer requested today, so this order is at risk and must be escalated.';
    else if(managerToday)reason+=' Manager override cannot bypass the 75% raw-stock rule.';
    return Object.assign({},a,{date:newDate,source:'75% raw-stock rule',hard:commitmentToday||!!a.hard,risk:reason,rawCoverageRuleApplied:true,rawPct:raw});
  });
  assignments.sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''))||(a.priority||9999)-(b.priority||9999);});
  return Object.assign({},plan,{assignments:assignments,days:rebuildDays(assignments),rawCoverageRule:{minimumPercent:75,movedSameDayDeliveries:moved}});
}
window.VUAutoFulfilmentPlanner={version:'9.0.90',build:build};
window.VURawCoverageFulfilmentRule={version:'9.0.90',minimumPercent:75};
})();
