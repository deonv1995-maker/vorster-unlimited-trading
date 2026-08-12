/* V9.0.80 — shared order completion progress engine.
   One consistent factory-completion percentage across Orders, Operations and order detail.
   Raw readiness is based on current priority-aware stock allocation; Painting uses actual order capture. */
(function(){
'use strict';
if(window.VUOrderProgress)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const isProduct=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
let cache=null,cacheAt=0,inflight=null;
function stageOf(o){const wf=norm(o?.workflowStage),fs=norm(o?.finishingStatus),ps=norm(o?.paintingStatus);if(['delivery','delivery-scheduled'].includes(wf)||ps==='completed')return'delivery';if(wf==='painting'||fs==='completed')return'painting';if(wf==='finishing'||o?.rawIssued===true)return'finishing';return'production'}
async function calculate(){
  const [orders,jobs,schedule]=await Promise.all([getAll('orders'),getAll('productionJobs'),typeof buildOrderCompletionSchedule==='function'?buildOrderCompletionSchedule():Promise.resolve({orders:[]})]);
  const scheduleByOrder=new Map((schedule?.orders||[]).map(p=>[String(p.order?.id||''),p]));
  const paintedByOrder=new Map();
  for(const j of jobs){if(j?.kind!=='orderPaintingLine')continue;const oid=String(j.orderId||'');if(!oid)continue;const r=paintedByOrder.get(oid)||{done:0,target:0};r.done+=n(j.completedQty);r.target+=n(j.targetQty);paintedByOrder.set(oid,r)}
  const map=new Map();
  for(const o of orders){
    const lines=(o.lines||[]).filter(l=>isProduct(l)&&n(l.qty)>0),required=lines.reduce((s,l)=>s+n(l.qty),0),stage=stageOf(o),plan=scheduleByOrder.get(String(o.id));
    let rawReady=0;if(['finishing','painting','delivery'].includes(stage))rawReady=required;else rawReady=Math.min(required,n(plan?.stockAllocated));
    const rawPct=required?Math.round(rawReady/required*100):100;
    let finishingPct=0;if(stage==='finishing')finishingPct=norm(o.finishingStatus)==='completed'?100:norm(o.finishingStatus)==='in progress'?50:20;if(['painting','delivery'].includes(stage))finishingPct=100;
    const painted=paintedByOrder.get(String(o.id));let paintingPct=painted?.target?Math.round(Math.min(painted.done,painted.target)/painted.target*100):n(o.paintingPercent);if(stage==='delivery')paintingPct=100;paintingPct=Math.max(0,Math.min(100,paintingPct));
    let percent=Math.round(rawPct*.55+finishingPct*.15+paintingPct*.30);if(stage==='delivery')percent=100;percent=Math.max(0,Math.min(100,percent));
    let nextAction='Build raw stock';if(rawPct>=100&&finishingPct<100)nextAction='Finish order';if(finishingPct>=100&&paintingPct<100)nextAction='Complete painting';if(percent>=100)nextAction=VUOrderCommitment?.typeOf?.(o)==='Collection'?'Ready for collection':'Ready for delivery';
    const remainingPaint=painted?.target?Math.max(0,painted.target-painted.done):Math.max(0,required-n(o.paintedQty));
    map.set(String(o.id),{orderId:o.id,percent,stage,rawPct,finishingPct,paintingPct,required,rawReady,remainingPaint,nextAction,deliveryReady:percent>=100});
  }
  cache=map;cacheAt=Date.now();return map;
}
async function buildAll(options={}){if(!options?.fresh&&cache&&Date.now()-cacheAt<2500)return cache;if(inflight&&!options?.fresh)return inflight;inflight=calculate().finally(()=>{inflight=null});return inflight}
async function one(orderId){return (await buildAll()).get(String(orderId))||null}
function invalidate(){cache=null;cacheAt=0}
window.addEventListener('vu:product-setup-state',invalidate);
window.VUOrderProgress={version:'9.0.80',buildAll,one,stageOf,invalidate};
})();