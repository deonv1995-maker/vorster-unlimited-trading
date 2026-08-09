/* V9.0.24 — finishing and painting are one factory worksheet for now.
   Keeps internal stage data intact while combining the printable hand-out. */
(function(){
'use strict';
const escSafe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const n=v=>Math.max(0,Number(v||0));
const isProduct=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const displayDate=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`));
const cash=v=>typeof money==='function'?money(v):`R ${Number(v||0).toFixed(2)}`;

function combinedRows(plan){
  const map=new Map();
  for(const row of [...(plan.finishing||[]),...(plan.painting||[])]){
    const id=row?.order?.id||row?.order?.orderNumber;
    if(!id)continue;
    if(!map.has(id))map.set(id,row);
  }
  return [...map.values()];
}
function lineTable(order){
  const lines=(order?.lines||[]).filter(l=>isProduct(l)&&n(l.qty)>0);
  return lines.map(l=>`<p><span class="box"></span> <b>${escSafe(l.productCode||l.code||'')}</b> ${escSafe(l.productName||l.name||'')} · ${escSafe(colour(l))} · ${n(l.qty)} <span style="float:right">Done: ______</span></p>`).join('')||'<p>No product lines.</p>';
}
function targetPanel(plan){
  if(!(n(plan.target)>0))return'';
  const state=plan.targetState||{};
  return `<div class="target"><div>Daily target<b>${cash(plan.target)}</b></div><div>Target-linked value<b>${cash(plan.basketValue||0)}</b></div><div>${state.ok?'Covered':'Gap'}<b>${state.gap?cash(state.gap):'+'+cash(state.surplus||0)}</b></div></div>`;
}
function combinedSheet(plan){
  const rows=combinedRows(plan);
  const body=rows.map(r=>`<div class="job ${r.targetOrder?'target':''}"><h2>${escSafe(r.order.orderNumber||'Order')} · ${escSafe(r.order.customerName||'Customer')}</h2><p>${escSafe(r.area||'')} · ${escSafe(r.actualStage||'')} → Finishing & Painting</p>${lineTable(r.order)}<p>Finishing / painting notes: ____________________________________________</p></div>`).join('')||'<p>No finishing or painting work forecast for this date.</p>';
  return `<section class="sheet"><div class="head"><div><h1>Finishing & Painting Worksheet</h1><p>${escSafe(displayDate(plan.date))}</p></div><strong>${rows.length} jobs</strong></div>${targetPanel(plan)}${body}</section>`;
}

const basePrint=window.opPrint;
window.opPrint=async function(stage,date){
  if(typeof buildWorkflowForecast!=='function')return basePrint?.(stage,date);
  const plan=await buildWorkflowForecast(date);
  const printStyle='@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font:11px Arial;color:#111;margin:0}.bar{text-align:center;padding:8px}.sheet{page-break-after:always}.head{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:7px}.target{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:7px 0}.target div,.job{border:1px solid #888;padding:6px}.target b{display:block}.job{margin:8px 0;break-inside:avoid}.job.target{border:2px solid #111}.box{display:inline-block;width:13px;height:13px;border:1px solid #111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:4px;text-align:left}@media print{.bar{display:none}}';
  if(stage==='finishing'||stage==='painting'||stage==='finishing-painting'){
    const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Finishing & Painting ${escSafe(plan.date)}</title><style>${printStyle}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${combinedSheet(plan)}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},300);return;
  }
  if(stage==='all'){
    const productionHtml=typeof window.__vuWorksheetProduction==='function'?window.__vuWorksheetProduction(plan):null;
    const deliveryHtml=typeof window.__vuWorksheetDelivery==='function'?window.__vuWorksheetDelivery(plan):null;
    if(productionHtml&&deliveryHtml){
      const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return}
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Daily Factory Pack ${escSafe(plan.date)}</title><style>${printStyle}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${productionHtml}${combinedSheet(plan)}${deliveryHtml}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},300);return;
    }
  }
  return basePrint?.(stage,date);
};

window.VUCombinedFinishingPaintingWorksheet={combinedRows,combinedSheet};
})();