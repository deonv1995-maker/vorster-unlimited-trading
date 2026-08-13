/* V9.1.12 — authoritative Painting worksheet reconciliation.
   Every printable Painting instruction is reconciled from commercial order requirement minus
   cumulative orderPaintingLine.completedQty. Product code + colour is the primary identity so
   catalogue/product-id changes cannot make already-painted work reappear on worksheets. */
(function(){
'use strict';
if(window.VUWorksheetPaintReconciliationAuthority&&String(window.VUWorksheetPaintReconciliationAuthority.version||'')==='9.1.12')return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const codeKey=(code,c)=>norm(code)?`code:${norm(code)}|${norm(c||'Standard')}`:'';
const idKey=(pid,c)=>String(pid||'')?`id:${String(pid)}|${norm(c||'Standard')}`:'';
function keysFor(pid,code,c){return [codeKey(code,c),idKey(pid,c)].filter(Boolean)}
function groupedOrder(order){
  const m=new Map();
  for(const l of(order?.lines||[])){
    if(!productLine(l)||n(l.qty)<=0)continue;
    const primary=codeKey(l.productCode||l.code,colour(l))||idKey(l.productId,colour(l));if(!primary)continue;
    let g=m.get(primary);if(!g){g={line:{...l},required:0,aliases:new Set(keysFor(l.productId,l.productCode||l.code,colour(l)))};m.set(primary,g)}
    g.required+=n(l.qty);for(const a of keysFor(l.productId,l.productCode||l.code,colour(l)))g.aliases.add(a);
  }
  return m;
}
function groupedBase(lines){
  const m=new Map();
  for(const x of(lines||[])){
    const l=x?.line||{},primary=codeKey(l.productCode||l.code,colour(l))||idKey(l.productId,colour(l));if(!primary)continue;
    let g=m.get(primary);if(!g){g={line:{...l},workQty:0,required:0,sources:new Set(),aliases:new Set(keysFor(l.productId,l.productCode||l.code,colour(l)))};m.set(primary,g)}
    g.workQty+=n(x.workQty||x.required||l.qty);g.required+=n(x.required||l.qty);if(x.source)g.sources.add(String(x.source));for(const a of keysFor(l.productId,l.productCode||l.code,colour(l)))g.aliases.add(a);
  }
  return m;
}
async function reconcilePlan(plan){
  const jobs=(await getAll('productionJobs')).filter(j=>j?.kind==='orderPaintingLine');
  const painted=new Map();
  for(const j of jobs){
    for(const k of keysFor(j.productId,j.productCode,j.colourName)){
      const full=`${String(j.orderId||'')}|${k}`;painted.set(full,Math.max(n(painted.get(full)),n(j.completedQty)));
    }
  }
  const source=plan.finishingPainting||plan.finishing||[],rows=[];
  for(const row of source){
    const order=row.order||{},req=groupedOrder(order),base=groupedBase(row.workLines||[]),workLines=[];
    for(const [primary,g] of req){
      let done=0;for(const alias of g.aliases)done=Math.max(done,n(painted.get(`${String(order.id||'')}|${alias}`)));done=Math.min(g.required,done);
      const remaining=Math.max(0,g.required-done);if(!remaining)continue;
      let b=base.get(primary);if(!b){for(const alias of g.aliases){b=[...base.values()].find(x=>x.aliases?.has(alias));if(b)break}}
      const actual=norm(row.actualStage);
      let qty=actual==='painting'?remaining:Math.min(remaining,n(b?.workQty));
      if(!qty&&done>0)qty=remaining;
      if(!qty)continue;
      workLines.push({line:{...(b?.line||g.line)},required:g.required,workQty:qty,source:done>0?`${done} already painted · ${remaining} remaining`:((b?.sources&&[...b.sources].join(' + '))||'Remaining to paint')});
    }
    if(workLines.length)rows.push({...row,workLines,totalRequired:[...req.values()].reduce((s,x)=>s+n(x.required),0),totalReady:workLines.reduce((s,x)=>s+n(x.workQty),0),paintingWorksheetReconciled:true});
  }
  const out={...plan,finishingPainting:rows};if(plan.finishing)out.finishing=rows;return out;
}
const api=window.VUStrictDivisionWorksheets;
if(api?.strictPlan){
  const prior=api.__vuPaintReconcileBase||api.strictPlan.bind(api);api.__vuPaintReconcileBase=prior;
  api.strictPlan=async function(...args){return reconcilePlan(await prior(...args))};
  api.__vuPaintReconciled=true;
}
window.VUWorksheetPaintReconciliationAuthority={version:'9.1.12',reconcilePlan};
})();