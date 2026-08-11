/* V9.0.72 — production worksheets aligned to physical factory flow.
   Casting/Packing/Resin are stable product-based raw-output sheets. Their first print/open snapshots
   the day's target, so later order imports do not rewrite the morning sheet. Painting remains
   order/product/colour specific and shows digital completion progress. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin','Painting'];
const RAW_DIVISIONS=new Set(['Casting','Packing','Resin']);
const norm=v=>String(v||'').trim().toLowerCase();
const n=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const productLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const dateKey=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const display=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${dateKey(v)}T12:00:00`));

function strictDivision(product){const worksheet=String(product?.worksheetDivision||'').trim();if(DIVISIONS.includes(worksheet))return worksheet;const primary=String(product?.primaryDivision||'').trim();if(DIVISIONS.includes(primary))return primary;return'Unclassified'}
async function strictPlan(date){
  const planner=window.VUThreeStagePlan||window.buildWorkflowForecast;if(typeof planner!=='function')throw new Error('Production planner is unavailable');
  const plan=await planner(date||new Date()),products=Array.isArray(plan?.products)?plan.products:await getAll('products');
  const byId=new Map(products.map(p=>[String(p.id),p])),byCode=new Map(products.map(p=>[norm(p.code),p]));
  const productionByDivision={Casting:[],Packing:[],Resin:[],Painting:[],Unclassified:[]};
  for(const item of plan.productionItems||[]){const product=byId.get(String(item.productId||''))||byCode.get(norm(item.productCode));const division=strictDivision(product);productionByDivision[division].push({...item,manufacturingDivision:division})}
  return {...plan,productionByDivision,strictDivisionRouting:true};
}

const style='@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font:10.5px Arial;color:#111;margin:0}.bar{text-align:center;margin:8px}.sheet{page-break-after:always}.head{border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px}.head h1{margin:0;font-size:20px}.job{border:1.5px solid #555;padding:7px;margin:7px 0;break-inside:avoid}.line{display:grid;grid-template-columns:1fr 70px 95px 95px;gap:6px;align-items:center}.write{height:25px;border:2px solid #111}.muted{color:#444}.progress{font-weight:700;margin-top:4px}.note{margin-top:4px;padding:4px 6px;border-left:3px solid #777;background:#f3f3f3}.foot{border-top:1px solid #111;margin-top:12px;padding-top:8px}.empty{border:1px dashed #999;padding:16px;text-align:center}.warning{border:2px solid #b36b00;padding:10px;margin:8px 0;background:#fff7e8}@media print{.bar{display:none}.sheet:last-child{page-break-after:auto}}';

async function rawProductionSheet(date,division){
  const rows=window.VUDivisionDailyWork?.rawRows?await VUDivisionDailyWork.rawRows(date,division):[];
  const total=rows.reduce((s,r)=>s+n(r.targetQty),0),produced=rows.reduce((s,r)=>s+n(r.producedQty),0);
  const body=rows.map((r,i)=>`<div class="job"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><div class="line"><div><b>${safe(r.productCode)} · ${safe(r.productName)}</b><br><span class="muted">Opening raw stock: ${n(r.rawStockAtStart)} · Current raw stock: ${n(r.rawStockNow)}</span>${r.note?`<div class="note">${safe(r.note)}</div>`:''}</div><b>${n(r.targetQty)}</b><div><b>${n(r.producedQty)}</b><br><small>digital produced</small></div><div><div class="write"></div><small>paper produced</small></div></div></div>`).join('');
  return `<section class="sheet"><div class="head"><h1>${safe(division)} Raw Production Sheet</h1><div>Vorster Unlimited Trading · ${safe(display(date))} · ${rows.length} products · Morning target ${total}</div><div class="progress">Digital output captured: ${produced}</div></div><div class="warning">Product-output sheet only. No customer allocation is recorded here. Production entered later becomes raw unfinished stock and the order planner reallocates that stock automatically.</div>${body||`<div class="empty">No ${safe(division.toLowerCase())} products were on the morning plan.</div>`}<div class="foot">${safe(division)} supervisor: ____________________ &nbsp; Total produced: ________</div></section>`;
}

async function paintingSheet(plan,date){
  const progress=window.VUDivisionDailyWork?.paintingRows?await VUDivisionDailyWork.paintingRows(date):[];
  const byId=new Map(progress.map(x=>[String(x.item?._workId),x.job]));
  const items=plan.productionByDivision?.Painting||[];
  const body=items.map((r,i)=>{const id=window.VUDivisionDailyWork?.paintWorkId?VUDivisionDailyWork.paintWorkId(date,r):'';const job=byId.get(id),done=Math.min(n(job?.completedQty),n(r.quantity)),pct=n(r.quantity)?Math.round(done/n(r.quantity)*100):0;return `<div class="job"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><div class="line"><div><b>${safe(r.productCode||'')} · ${safe(r.productName||'')}</b><br><span class="muted">${safe(r.colourName||'Standard')} · ${safe(r.orderNumber||'')} ${safe(r.customerName||'')}</span>${job?.note?`<div class="note">${safe(job.note)}</div>`:''}</div><b>${n(r.quantity)}</b><div><b>${done} (${pct}%)</b><br><small>${safe(job?.status||'Not started')}</small></div><div><div class="write"></div><small>paper completed</small></div></div></div>`}).join('');
  return `<section class="sheet"><div class="head"><h1>Painting Production Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(date))} · ${items.length} order-linked lines</div></div>${body||'<div class="empty">No painting work planned for this date.</div>'}<div class="foot">Painting supervisor: ____________________ &nbsp; Completed: ________</div></section>`;
}

function finishingSheet(plan){const rows=plan.finishingPainting||plan.finishing||[];return `<section class="sheet"><div class="head"><h1>Finishing & Painting Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${rows.length} orders</div></div>${rows.length?rows.map((r,i)=>`<div class="job"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><b>${safe(r.order?.orderNumber||'')} · ${safe(r.order?.customerName||'')}</b>${(r.workLines||[]).map(x=>`<div class="line"><div>${safe(x.line?.productCode||'')} · ${safe(x.line?.productName||'')}<br><span class="muted">${safe(colour(x.line))} · ${safe(x.source||'')}</span></div><b>${n(x.workQty)}</b><div></div><div><div class="write"></div><small>Qty completed</small></div></div>`).join('')}</div>`).join(''):'<div class="empty">No finishing or painting work planned for this date.</div>'}<div class="foot">Finishing & Painting supervisor: ____________________</div></section>`}
function deliverySheet(plan){const rows=plan.delivery||[];return `<section class="sheet"><div class="head"><h1>Delivery & Collection Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${rows.length} stops</div></div>${rows.length?rows.map((r,i)=>`<div class="job"><div class="muted">Stop ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><b>${safe(r.order?.orderNumber||'')} · ${safe(r.order?.customerName||'')} · ${safe(r.area||'')}</b>${(r.order?.lines||[]).filter(l=>productLine(l)&&n(l.qty)>0).map(l=>`<div class="line"><div>${safe(l.productCode||'')} · ${safe(l.productName||'')}<br><span class="muted">${safe(colour(l))}</span></div><b>${n(l.qty)}</b><div></div><div><div class="write"></div><small>Loaded</small></div></div>`).join('')}</div>`).join(''):'<div class="empty">No delivery or collection work planned for this date.</div>'}<div class="foot">Vehicle: ____________________ &nbsp; Driver: ____________________</div></section>`}
function unclassifiedNotice(plan){const items=plan.productionByDivision?.Unclassified||[];if(!items.length)return'';return `<section class="sheet"><div class="head"><h1>Unclassified Production — Setup Required</h1></div><div class="warning">${items.length} production lines need Worksheet division or Primary division.</div>${items.map(r=>`<div class="job"><b>${safe(r.productCode||'')} · ${safe(r.productName||'')}</b></div>`).join('')}</section>`}
function openPrint(title,body){const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return}w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(title)}</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${body}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},250)}

window.opPrint=async function strictDivisionOpPrint(stage,date,division=''){
  const d=dateKey(date||new Date()),plan=await strictPlan(d);
  if(stage==='production'&&RAW_DIVISIONS.has(division))return openPrint(`${division} Raw Production Sheet`,await rawProductionSheet(d,division));
  if(stage==='production'&&division==='Painting')return openPrint('Painting Production Worksheet',await paintingSheet(plan,d));
  if(stage==='production-all'){const parts=[];for(const div of ['Casting','Packing','Resin'])parts.push(await rawProductionSheet(d,div));parts.push(await paintingSheet(plan,d));return openPrint('Production Division Worksheets',parts.join('')+unclassifiedNotice(plan))}
  if(stage==='all'){const parts=[];for(const div of ['Casting','Packing','Resin'])parts.push(await rawProductionSheet(d,div));parts.push(await paintingSheet(plan,d));parts.push(finishingSheet(plan),deliverySheet(plan),unclassifiedNotice(plan));return openPrint('Daily Factory Worksheets',parts.join(''))}
  if(stage==='finishing-painting')return openPrint('Finishing & Painting Worksheet',finishingSheet(plan));
  if(stage==='delivery')return openPrint('Delivery Worksheet',deliverySheet(plan));
};
try{opPrint=window.opPrint}catch{}
window.VUStrictDivisionWorksheets={DIVISIONS,RAW_DIVISIONS,strictDivision,strictPlan,version:'9.0.72'};
})();
