/* V9.1.09 — line-level remaining Painting planner authority.
   Orders already in Painting no longer send their full commercial quantities back to the worksheet.
   Remaining Painting = grouped order requirement - cumulative painted quantity. */
(function(){
'use strict';
if(window.VUPaintingRemainingAuthority)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const key=(productId,productCode,colourName)=>`${String(productId||'')||norm(productCode)}|${norm(colourName||'Standard')}`;
const base=window.VUThreeStagePlan||window.buildWorkflowForecast;
if(typeof base!=='function')return;
function groupedOrderLines(order){
  const map=new Map();
  for(const l of(order?.lines||[])){
    if(!productLine(l)||n(l.qty)<=0)continue;
    const k=key(l.productId,l.productCode,colour(l));let g=map.get(k);
    if(!g){g={line:{...l},required:0};map.set(k,g)}
    g.required+=n(l.qty);
  }
  return map;
}
async function correctedPlan(selected){
  const plan=await base(selected);
  const jobs=(await getAll('productionJobs')).filter(j=>j?.kind==='orderPaintingLine');
  const byOrder=new Map();
  for(const j of jobs){const oid=String(j.orderId||'');if(!byOrder.has(oid))byOrder.set(oid,new Map());const m=byOrder.get(oid),k=key(j.productId,j.productCode,j.colourName);m.set(k,j)}
  const sourceRows=plan.finishingPainting||plan.finishing||[];
  const corrected=[];
  for(const row of sourceRows){
    const order=row.order||{},actual=String(row.actualStage||'').toLowerCase();
    if(actual!=='painting') { corrected.push(row); continue; }
    const grouped=groupedOrderLines(order),saved=byOrder.get(String(order.id))||new Map(),workLines=[];
    let totalRequired=0,totalPainted=0;
    for(const [k,g] of grouped){
      const j=saved.get(k),painted=Math.min(g.required,n(j?.completedQty)),remaining=Math.max(0,g.required-painted);
      totalRequired+=g.required;totalPainted+=painted;
      if(remaining>0)workLines.push({line:g.line,required:g.required,workQty:remaining,source:painted>0?`${painted} already painted · ${remaining} remaining`:'Remaining to paint'});
    }
    if(!workLines.length)continue;
    corrected.push({...row,workLines,totalRequired,totalReady:totalPainted,canCompleteToday:false,paintingRemainingCorrected:true});
  }
  const result={...plan,finishingPainting:corrected};
  if(plan.finishing)result.finishing=corrected;
  return result;
}
window.VUThreeStagePlan=correctedPlan;
window.buildWorkflowForecast=correctedPlan;
try{buildWorkflowForecast=window.buildWorkflowForecast}catch{}
window.VUPaintingRemainingAuthority={version:'9.1.09',build:correctedPlan};
})();