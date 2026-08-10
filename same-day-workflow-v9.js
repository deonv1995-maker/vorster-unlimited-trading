/* V9.0.39 — same-day operational flow correction. */
(function(){
'use strict';
const prior=window.buildWorkflowForecast;
if(typeof prior!=='function')return;
const n=v=>Math.max(0,Number(v||0)),norm=v=>String(v||'').trim().toLowerCase();
const CLOSED=new Set(['cancelled','delivered','collected','completed','invoiced']);
const isProduct=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
function stageOf(o){const wf=norm(o.workflowStage),fs=norm(o.finishingStatus),ps=norm(o.paintingStatus);if(['delivery','delivery-scheduled'].includes(wf)||ps==='completed')return'delivery';if(wf==='painting'||fs==='completed')return'painting';if(wf==='finishing'||o.rawIssued===true)return'finishing';return'production'}
function targetValue(){return typeof vuDailyInvoiceTarget==='function'?n(vuDailyInvoiceTarget()):n(localStorage.getItem('vu-daily-invoice-target'))}
function dueSort(a,b){return String(a.order?.dueDate||'9999-12-31').localeCompare(String(b.order?.dueDate||'9999-12-31'))||new Date(a.order?.createdAt||0)-new Date(b.order?.createdAt||0)}
function area(o,c){return String(o?.deliveryArea||o?.area||c?.deliveryArea||c?.area||c?.suburb||c?.city||c?.location||'Area not set').split(',')[0].trim()||'Area not set'}
function lineUnits(o){return(o.lines||[]).filter(l=>isProduct(l)&&n(l.qty)>0).reduce((s,l)=>s+n(l.qty),0)}
async function sameDayForecast(selected){
 const base=await prior(selected);if(!base)return base;
 const [orders,customers,balances]=await Promise.all([getAll('orders'),getAll('customers'),getAll('inventoryBalances')]);
 const customerById=new Map(customers.map(c=>[String(c.id),c])),raw=new Map();
 for(const b of balances){if(n(b.quantity)<=0)continue;if(norm(b.colourName)==='raw stock'||String(b.id||'').endsWith('::raw'))raw.set(String(b.productId),n(raw.get(String(b.productId)))+n(b.quantity))}
 const downstream=[];
 for(const o of orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>isProduct(l)&&n(l.qty)>0))){
  const actual=stageOf(o),c=customerById.get(String(o.customerId));let ready=actual!=='production';
  if(actual==='production'){ready=true;const local=new Map(raw);for(const l of(o.lines||[]).filter(x=>isProduct(x)&&n(x.qty)>0)){const pid=String(l.productId||''),need=n(l.qty),avail=n(local.get(pid));if(avail<need){ready=false;break}local.set(pid,avail-need)}}
  downstream.push({order:o,customer:c,area:area(o,c),actualStage:actual,targetOrder:false,units:lineUnits(o),ready});
 }
 const rank=s=>({delivery:0,painting:1,finishing:2,production:3}[s]??4);downstream.sort((a,b)=>rank(a.actualStage)-rank(b.actualStage)||dueSort(a,b));
 const target=targetValue();let linked=0;for(const r of downstream){r.targetOrder=target<=0||linked<target;if(r.targetOrder)linked+=n(r.order.grandTotal)}
 const finishing=downstream.filter(r=>r.actualStage==='finishing'||(r.actualStage==='production'&&r.ready));
 const painting=downstream.filter(r=>['painting','finishing'].includes(r.actualStage)||(r.actualStage==='production'&&r.ready));
 const deliveryReady=downstream.filter(r=>['delivery','painting','finishing'].includes(r.actualStage)||(r.actualStage==='production'&&r.ready));
 let deliveryValue=0;const delivery=[];for(const r of deliveryReady){delivery.push({...r,predictedStage:'delivery',explicit:!!r.order.deliveryDate});deliveryValue+=n(r.order.grandTotal);if(target>0&&deliveryValue>=target)break}
 return {...base,finishing:finishing.map(r=>({...r,predictedStage:'finishing'})),painting:painting.map(r=>({...r,predictedStage:'painting'})),deliveryReady:deliveryReady.map(r=>({...r,predictedStage:'delivery'})),delivery,deliveryValue,deliveryState:{gap:Math.max(0,target-deliveryValue),surplus:Math.max(0,deliveryValue-target),ok:target>0&&deliveryValue>=target},sameDayOperationalFlow:true};
}
window.VUSequentialWorkflowForecast=prior;window.buildWorkflowForecast=sameDayForecast;
})();
