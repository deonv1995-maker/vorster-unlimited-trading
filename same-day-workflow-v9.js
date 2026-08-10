/* V9.0.39 — same-day operational flow correction.
   Finishing, painting and delivery may happen on the same operational day when stock/stage readiness allows it.
   Production remains capacity-driven; downstream worksheets must not be artificially delayed by one workday per stage. */
(function(){
'use strict';
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const CLOSED=new Set(['cancelled','delivered','collected','completed','invoiced']);
const isProduct=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
function stageOf(o){const wf=norm(o.workflowStage),fs=norm(o.finishingStatus),ps=norm(o.paintingStatus);if(['delivery','delivery-scheduled'].includes(wf)||ps==='completed')return'delivery';if(wf==='painting'||fs==='completed')return'painting';if(wf==='finishing'||o.rawIssued===true)return'finishing';return'production'}
function workday(v){return window.VUFactoryCalendar?.onOrAfter?VUFactoryCalendar.onOrAfter(v):dk(v)}
function targetValue(){return typeof vuDailyInvoiceTarget==='function'?n(vuDailyInvoiceTarget()):n(localStorage.getItem('vu-daily-invoice-target'))}
function dueSort(a,b){return String(a.order?.dueDate||'9999-12-31').localeCompare(String(b.order?.dueDate||'9999-12-31'))||new Date(a.order?.createdAt||0)-new Date(b.order?.createdAt||0)}
function lineUnits(o){return(o.lines||[]).filter(l=>isProduct(l)&&n(l.qty)>0).reduce((s,l)=>s+n(l.qty),0)}
function area(o,c){return String(o?.deliveryArea||o?.area||c?.deliveryArea||c?.area||c?.suburb||c?.city||c?.location||'Area not set').split(',')[0].trim()||'Area not set'}
async function sameDayForecast(selected){
  const date=workday(selected||new Date());
  const base=typeof window.buildWorkflowForecast==='function'?await window.buildWorkflowForecast(date):null;
  if(!base)return base;
  const [orders,customers,balances]=await Promise.all([getAll('orders'),getAll('customers'),getAll('inventoryBalances')]);
  const customerById=new Map(customers.map(c=>[String(c.id),c]));
  const raw=new Map();for(const b of balances){if(n(b.quantity)<=0)continue;const rawLike=norm(b.colourName)==='raw stock'||String(b.id||'').endsWith('::raw');if(rawLike)raw.set(String(b.productId),n(raw.get(String(b.productId)))+n(b.quantity))}
  const open=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>isProduct(l)&&n(l.qty)>0));
  const downstream=[];
  for(const o of open){
    const actual=stageOf(o),c=customerById.get(String(o.customerId));let ready=actual!=='production';
    if(actual==='production'){
      ready=true;const local=new Map(raw);for(const l of(o.lines||[]).filter(x=>isProduct(x)&&n(x.qty)>0)){const pid=String(l.productId||''),need=n(l.qty),avail=n(local.get(pid));if(avail<need){ready=false;break}local.set(pid,avail-need)}
    }
    downstream.push({order:o,customer:c,area:area(o,c),actualStage:actual,targetOrder:false,units:lineUnits(o),ready});
  }
  downstream.sort((a,b)=>{const rank=s=>({delivery:0,painting:1,finishing:2,production:3}[s]??4);return rank(a.actualStage)-rank(b.actualStage)||dueSort(a,b)});
  const target=targetValue();let value=0;for(const r of downstream){r.targetOrder=target<=0||value<target;if(r.targetOrder)value+=n(r.order.grandTotal)}
  /* Same-day rule: anything already in finishing/painting/delivery is actionable today.
     Production-stage orders are also actionable downstream today when current raw stock fully covers them. */
  const finishing=downstream.filter(r=>r.actualStage==='finishing'||(r.actualStage==='production'&&r.ready));
  const painting=downstream.filter(r=>r.actualStage==='painting'||r.actualStage==='finishing'||(r.actualStage==='production'&&r.ready));
  const deliveryReady=downstream.filter(r=>r.actualStage==='delivery'||r.actualStage==='painting'||r.actualStage==='finishing'||(r.actualStage==='production'&&r.ready));
  let deliveryValue=0;const delivery=[];for(const r of deliveryReady){delivery.push({...r,predictedStage:'delivery',explicit:!!r.order.deliveryDate});deliveryValue+=n(r.order.grandTotal);if(target>0&&deliveryValue>=target)break}
  return {...base,date,finishing:finishing.map(r=>({...r,predictedStage:'finishing'})),painting:painting.map(r=>({...r,predictedStage:'painting'})),deliveryReady:deliveryReady.map(r=>({...r,predictedStage:'delivery'})),delivery,deliveryValue,deliveryState:{gap:Math.max(0,target-deliveryValue),surplus:Math.max(0,deliveryValue-target),ok:target>0&&deliveryValue>=target},sameDayOperationalFlow:true};
}
const prior=window.buildWorkflowForecast;
window.VUSequentialWorkflowForecast=prior;
window.buildWorkflowForecast=sameDayForecast;
})();
