/* V9.1.08 — Painting worksheet grouping authority.
   Factory instructions are grouped by order + product + colour, while commercial order lines remain untouched. */
(function(){
'use strict';
if(window.VUPaintingWorksheetGroupAuthority)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
function groupWorkLines(lines){
  const map=new Map();
  for(const x of(lines||[])){
    const l=x?.line||{},code=String(l.productCode||'').trim(),c=colour(l),key=`${norm(code)||String(l.productId||'')}|${norm(c)}`;
    let g=map.get(key);
    if(!g){g={...x,line:{...l},workQty:0,required:0,__sources:new Set()};map.set(key,g)}
    g.workQty+=n(x.workQty||x.required||l.qty);
    g.required+=n(x.required||l.qty);
    if(x.source)g.__sources.add(String(x.source));
  }
  return [...map.values()].map(g=>{const source=[...g.__sources].join(' + ');delete g.__sources;return{...g,source}});
}
function groupPaintingItems(items){
  const map=new Map();
  for(const r of(items||[])){
    const key=`${String(r.orderId||'')}|${norm(r.productCode)||String(r.productId||'')}|${norm(r.colourName||'Standard')}`;
    let g=map.get(key);
    if(!g){g={...r,quantity:0};map.set(key,g)}
    g.quantity+=n(r.quantity);
  }
  return [...map.values()];
}
const api=window.VUStrictDivisionWorksheets;
if(api?.strictPlan&&!api.__vuGroupedPainting){
  const base=api.strictPlan.bind(api);
  api.strictPlan=async function(...args){
    const plan=await base(...args);
    const finishing=(plan.finishingPainting||plan.finishing||[]).map(r=>({...r,workLines:groupWorkLines(r.workLines||[])}));
    const productionByDivision={...(plan.productionByDivision||{})};
    if(Array.isArray(productionByDivision.Painting))productionByDivision.Painting=groupPaintingItems(productionByDivision.Painting);
    return{...plan,finishingPainting:plan.finishingPainting?finishing:plan.finishingPainting,finishing:plan.finishing&&!plan.finishingPainting?finishing:plan.finishing,productionByDivision,paintingWorksheetGrouped:true};
  };
  api.__vuGroupedPainting=true;
}
window.VUPaintingWorksheetGroupAuthority={version:'9.1.08',groupWorkLines,groupPaintingItems};
})();