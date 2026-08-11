/* V9.0.52 — strict manufacturing worksheet routing.
   A production line belongs to exactly one worksheet:
   worksheetDivision -> primaryDivision -> Unclassified.
   manufacturingMethods describes capability only and NEVER decides worksheet placement. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin','Painting'];
const norm=v=>String(v||'').trim().toLowerCase();
const n=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const display=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`));

function strictDivision(product){
  const worksheet=String(product?.worksheetDivision||'').trim();
  if(DIVISIONS.includes(worksheet))return worksheet;
  const primary=String(product?.primaryDivision||'').trim();
  if(DIVISIONS.includes(primary))return primary;
  return 'Unclassified';
}

async function strictPlan(date){
  const planner=window.VUThreeStagePlan||window.buildWorkflowForecast;
  if(typeof planner!=='function')throw new Error('Production planner is unavailable');
  const plan=await planner(date||new Date());
  const products=Array.isArray(plan?.products)?plan.products:await getAll('products');
  const byId=new Map(products.map(p=>[String(p.id),p]));
  const byCode=new Map(products.map(p=>[norm(p.code),p]));
  const productionByDivision={Casting:[],Packing:[],Resin:[],Painting:[],Unclassified:[]};
  for(const item of plan.productionItems||[]){
    const product=byId.get(String(item.productId||''))||byCode.get(norm(item.productCode));
    const division=strictDivision(product);
    productionByDivision[division].push({...item,manufacturingDivision:division});
  }
  return {...plan,productionByDivision,strictDivisionRouting:true};
}

const style='@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font:10.5px Arial;color:#111;margin:0}.bar{text-align:center;margin:8px}.sheet{page-break-after:always}.head{border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px}.head h1{margin:0;font-size:20px}.job{border:1.5px solid #555;padding:7px;margin:7px 0;break-inside:avoid}.line{display:grid;grid-template-columns:1fr 75px 95px;gap:6px;align-items:center}.write{height:25px;border:2px solid #111}.muted{color:#444}.foot{border-top:1px solid #111;margin-top:12px;padding-top:8px}.empty{border:1px dashed #999;padding:16px;text-align:center}.warning{border:2px solid #b36b00;padding:10px;margin:8px 0;background:#fff7e8}@media print{.bar{display:none}.sheet:last-child{page-break-after:auto}}';
function productionSheet(plan,division){
  const items=plan.productionByDivision?.[division]||[];
  const rows=items.map((r,i)=>`<div class="job"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><div class="line"><div><b>${safe(r.productCode||'')} · ${safe(r.productName||'')}</b><br><span class="muted">${safe(r.colourName||'Standard')} · ${safe(r.orderNumber||'')} ${safe(r.customerName||'')}</span></div><b>${n(r.quantity)}</b><div><div class="write"></div><small>Qty completed</small></div></div></div>`).join('');
  return `<section class="sheet"><div class="head"><h1>${safe(division)} Production Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${items.length} production lines</div></div>${rows||`<div class="empty">No ${safe(division.toLowerCase())} production work planned for this date.</div>`}<div class="foot">${safe(division)} supervisor: ____________________ &nbsp; Completed: ________</div></section>`;
}
function finishingSheet(plan){
  const rows=plan.finishingPainting||plan.finishing||[];
  return `<section class="sheet"><div class="head"><h1>Finishing & Painting Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${rows.length} orders</div></div>${rows.length?rows.map((r,i)=>`<div class="job"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><b>${safe(r.order?.orderNumber||'')} · ${safe(r.order?.customerName||'')}</b>${(r.workLines||[]).map(x=>`<div class="line"><div>${safe(x.line?.productCode||'')} · ${safe(x.line?.productName||'')}<br><span class="muted">${safe(colour(x.line))} · ${safe(x.source||'')}</span></div><b>${n(x.workQty)}</b><div><div class="write"></div><small>Qty completed</small></div></div>`).join('')}</div>`).join(''):'<div class="empty">No finishing or painting work planned for this date.</div>'}<div class="foot">Finishing & Painting supervisor: ____________________ &nbsp; Completed: ________</div></section>`;
}
function deliverySheet(plan){
  const rows=plan.delivery||[];
  return `<section class="sheet"><div class="head"><h1>Delivery & Collection Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${rows.length} stops</div></div>${rows.length?rows.map((r,i)=>`<div class="job"><div class="muted">Stop ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><b>${safe(r.order?.orderNumber||'')} · ${safe(r.order?.customerName||'')} · ${safe(r.area||'')}</b>${(r.order?.lines||[]).filter(l=>productLine(l)&&n(l.qty)>0).map(l=>`<div class="line"><div>${safe(l.productCode||'')} · ${safe(l.productName||'')}<br><span class="muted">${safe(colour(l))}</span></div><b>${n(l.qty)}</b><div><div class="write"></div><small>Loaded</small></div></div>`).join('')}</div>`).join(''):'<div class="empty">No delivery or collection work planned for this date.</div>'}<div class="foot">Vehicle: ____________________ &nbsp; Driver: ____________________ &nbsp; Departed: ________</div></section>`;
}
function unclassifiedNotice(plan){
  const items=plan.productionByDivision?.Unclassified||[];
  if(!items.length)return '';
  return `<section class="sheet"><div class="head"><h1>Unclassified Production — Setup Required</h1><div>${items.length} production lines were NOT assigned to a division worksheet.</div></div><div class="warning">These products need a Worksheet division or Primary division before they can appear on Casting, Packing, Resin or Painting worksheets.</div>${items.map(r=>`<div class="job"><b>${safe(r.productCode||'')} · ${safe(r.productName||'')}</b><div class="muted">${safe(r.orderNumber||'')} ${safe(r.customerName||'')}</div></div>`).join('')}</section>`;
}
function openPrint(title,body){
  const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return;}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(title)}</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${body}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},250);
}

window.opPrint=async function strictDivisionOpPrint(stage,date,division=''){
  const plan=await strictPlan(date||new Date());
  if(stage==='production'&&DIVISIONS.includes(division))return openPrint(`${division} Production Worksheet`,productionSheet(plan,division));
  if(stage==='production-all')return openPrint('Production Division Worksheets',DIVISIONS.map(d=>productionSheet(plan,d)).join('')+unclassifiedNotice(plan));
  if(stage==='all')return openPrint('Daily Factory Worksheets',DIVISIONS.map(d=>productionSheet(plan,d)).join('')+finishingSheet(plan)+deliverySheet(plan)+unclassifiedNotice(plan));
  if(stage==='finishing-painting')return openPrint('Finishing & Painting Worksheet',finishingSheet(plan));
  if(stage==='delivery')return openPrint('Delivery Worksheet',deliverySheet(plan));
};
try{opPrint=window.opPrint}catch{}

window.VUStrictDivisionWorksheets={DIVISIONS,strictDivision,strictPlan,version:'9.0.52'};
})();
