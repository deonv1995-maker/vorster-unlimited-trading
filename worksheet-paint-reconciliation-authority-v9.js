/* V9.1.11 — authoritative Painting worksheet reconciliation.
   Every printable Painting instruction is reconciled from commercial order requirement minus
   cumulative orderPaintingLine.completedQty, independent of workflow-stage shortcuts. */
(function(){
'use strict';
if(window.VUWorksheetPaintReconciliationAuthority)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const key=(pid,code,c)=>`${String(pid||'')||norm(code)}|${norm(c||'Standard')}`;
function groupedOrder(order){
  const m=new Map();
  for(const l of(order?.lines||[])){
    if(!productLine(l)||n(l.qty)<=0)continue;
    const k=key(l.productId,l.productCode,colour(l));
    let g=m.get(k);if(!g){g={line:{...l},required:0};m.set(k,g)}
    g.required+=n(l.qty);
  }
  return m;
}
function groupedBase(lines){
  const m=new Map();
  for(const x of(lines||[])){
    const l=x?.line||{},k=key(l.productId,l.productCode,colour(l));
    let g=m.get(k);if(!g){g={line:{...l},workQty:0,required:0,sources:new Set()};m.set(k,g)}
    g.workQty+=n(x.workQty||x.required||l.qty);g.required+=n(x.required||l.qty);if(x.source)g.sources.add(String(x.source));
  }
  return m;
}
async function reconcilePlan(plan){
  const jobs=(await getAll('productionJobs')).filter(j=>j?.kind==='orderPaintingLine');
  const painted=new Map();
  for(const j of jobs){const k=`${String(j.orderId||'')}|${key(j.productId,j.productCode,j.colourName)}`;painted.set(k,Math.max(n(painted.get(k)),n(j.completedQty)))}
  const source=plan.finishingPainting||plan.finishing||[],rows=[];
  for(const row of source){
    const order=row.order||{},req=groupedOrder(order),base=groupedBase(row.workLines||[]),workLines=[];
    for(const [k,g] of req){
      const done=Math.min(g.required,n(painted.get(`${String(order.id||'')}|${k}`))),remaining=Math.max(0,g.required-done);
      if(!remaining)continue;
      const b=base.get(k),actual=norm(row.actualStage);
      let qty=actual==='painting'?remaining:Math.min(remaining,n(b?.workQty));
      if(!qty&&actual==='finishing'&&done>0)qty=remaining;
      if(!qty)continue;
      workLines.push({line:{...(b?.line||g.line)},required:g.required,workQty:qty,source:done>0?`${done} already painted · ${remaining} remaining`:((b?.sources&&[...b.sources].join(' + '))||'Remaining to paint')});
    }
    if(workLines.length)rows.push({...row,workLines,totalRequired:[...req.values()].reduce((s,x)=>s+n(x.required),0),totalReady:workLines.reduce((s,x)=>s+n(x.workQty),0),paintingWorksheetReconciled:true});
  }
  const out={...plan,finishingPainting:rows};
  if(plan.finishing)out.finishing=rows;
  return out;
}
const api=window.VUStrictDivisionWorksheets;
if(api?.strictPlan&&!api.__vuPaintReconciled){
  const base=api.strictPlan.bind(api);
  api.strictPlan=async function(...args){return reconcilePlan(await base(...args))};
  api.__vuPaintReconciled=true;
}
window.VUWorksheetPaintReconciliationAuthority={version:'9.1.11',reconcilePlan};
})();