/* V9.0.83 — minimal shared business-target settings.
   Replaces the old V8 production optimizer as the source for the daily invoice target only. */
(function(){
'use strict';
function dailyTarget(){return Math.max(0,Number(localStorage.getItem('vu-daily-invoice-target')||0));}
function setDailyTarget(value){const next=Math.max(0,Number(value||0));localStorage.setItem('vu-daily-invoice-target',String(next));window.dispatchEvent(new CustomEvent('vu:daily-target-changed',{detail:{value:next}}));return next;}
window.vuDailyInvoiceTarget=dailyTarget;
window.vuSetDailyInvoiceTarget=setDailyTarget;
window.VUBusinessTarget={version:'9.0.83',get:dailyTarget,set:setDailyTarget};
try{vuDailyInvoiceTarget=dailyTarget;vuSetDailyInvoiceTarget=setDailyTarget}catch{}
})();
