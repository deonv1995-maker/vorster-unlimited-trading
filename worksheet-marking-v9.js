/* Version 9.0.4 — printable worksheet completion marking. */
(function(){
'use strict';
const n=v=>Math.max(0,Number(v||0));
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const cash=v=>typeof money==='function'?money(v):`R ${Number(v||0).toFixed(2)}`;
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const isProduct=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const display=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${v}T12:00:00`));

const printStyle=`
@page{size:A4;margin:9mm}
*{box-sizing:border-box}
body{font:10.5px Arial,sans-serif;color:#111;margin:0}
.bar{text-align:center;padding:8px}
.sheet{page-break-after:always}
.head{display:flex;justify-content:space-between;gap:12px;border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:7px}
.head h1{font-size:20px;margin:0 0 3px}
.head p{margin:1px 0}
.target{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:7px 0}
.target>div{border:1px solid #888;padding:5px}.target b{display:block;font-size:13px;margin-top:2px}
.job{border:1px solid #777;margin:8px 0;padding:6px;break-inside:avoid}.job.target-job{border:2px solid #111}
.job h2{font-size:13px;margin:0 0 4px}.job p{margin:2px 0}
table{width:100%;border-collapse:collapse;margin-top:5px;table-layout:fixed}
th,td{border:1px solid #999;padding:4px;vertical-align:middle;text-align:left}
th.mark,td.mark{width:7%;text-align:center}th.qty,td.qty{width:12%;text-align:center}th.done,td.done{width:16%;text-align:center}
.box{display:inline-block;width:15px;height:15px;border:1.5px solid #111;vertical-align:middle}
.writebox{height:25px;min-width:42px;border-bottom:1.5px solid #111;display:block}
.legend{font-size:9.5px;margin:5px 0 8px;padding:5px;border:1px solid #aaa}
.signoff{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}.signline{border-bottom:1px solid #111;height:24px}
.notes{border:1px solid #999;height:46px;margin-top:5px}
@media print{.bar{display:none}}
`;

function targetBlock(p,value){
  if(!(p.target>0))return'';
  const gap=Math.max(0,p.target-value),surplus=Math.max(0,value-p.target);
  return `<div class="target"><div>Daily invoice target<b>${safe(cash(p.target))}</b></div><div>Target-linked value<b>${safe(cash(value))}</b></div><div>${gap?'Gap':'Above target'}<b>${gap?safe(cash(gap)):'+'+safe(cash(surplus))}</b></div></div>`;
}
function lineTable(lines){
  return `<table><thead><tr><th class="mark">✓</th><th class="mark">X</th><th>Code / item</th><th>Colour</th><th class="qty">Planned</th><th class="done">Qty completed</th></tr></thead><tbody>${lines.map(x=>`<tr><td class="mark"><span class="box"></span></td><td class="mark"><span class="box"></span></td><td><b>${safe(x.code||'')}</b><br>${safe(x.name||'')}</td><td>${safe(x.colour||'Standard')}</td><td class="qty"><b>${n(x.qty)}</b></td><td class="done"><span class="writebox"></span></td></tr>`).join('')}</tbody></table>`;
}
function orderJob(r){
  const lines=(r.order.lines||[]).filter(l=>isProduct(l)&&n(l.qty)>0).map(l=>({code:l.productCode||l.code||'',name:l.productName||l.name||'',colour:colour(l),qty:n(l.qty)}));
  return `<div class="job ${r.targetOrder?'target-job':''}"><h2>${safe(r.order.orderNumber||'Order')} · ${safe(r.order.customerName||'Customer')}</h2><p>${safe(r.area||'')} · ${safe(r.actualStage||'')} → ${safe(r.predictedStage||'')}</p>${lineTable(lines)}</div>`;
}
function productionJobs(p){
  if(!p.productionItems?.length)return'<p>No production work forecast for this date.</p>';
  const groups=new Map();
  for(const i of p.productionItems){
    const k=`${i.productId}|${String(i.colourName||'Standard').toLowerCase()}`;
    if(!groups.has(k))groups.set(k,{code:i.productCode||'',name:i.productName||'',colour:i.colourName||'Standard',qty:0,orders:new Set(),target:false});
    const g=groups.get(k);g.qty+=n(i.quantity);if(i.orderNumber)g.orders.add(`${i.orderNumber}${i.customerName?' '+i.customerName:''}`);g.target=g.target||Boolean(i.targetOrder);
  }
  return [...groups.values()].map(g=>`<div class="job ${g.target?'target-job':''}"><h2>${safe(g.code)} · ${safe(g.name)}</h2><p>${safe(g.colour)} · Orders: ${safe([...g.orders].join(' · '))}</p>${lineTable([{code:g.code,name:g.name,colour:g.colour,qty:g.qty}])}</div>`).join('');
}
function footer(){return `<div class="legend"><b>Team marking:</b> Tick ✓ if the full planned quantity was completed. Tick X if none was completed. If partly completed, leave both boxes blank and write the actual quantity in “Qty completed”.</div><div><b>Notes / problems / shortages</b><div class="notes"></div></div><div class="signoff"><div><div class="signline"></div><small>Team leader / supervisor</small></div><div><div class="signline"></div><small>Checked at closeout</small></div></div>`}
function sheet(stage,p){
  const title={production:'Production Worksheet',finishing:'Finishing Worksheet',painting:'Painting Worksheet',delivery:'Delivery & Collection Worksheet'}[stage];
  const rows=stage==='delivery'?p.delivery:p[stage];
  const value=stage==='delivery'?p.deliveryValue:p.basketValue;
  const body=stage==='production'?productionJobs(p):(rows||[]).map(orderJob).join('')||`<p>No ${safe(stage)} work forecast for this date.</p>`;
  return `<section class="sheet"><div class="head"><div><h1>${title}</h1><p>${safe(display(p.date))}</p><p>Vorster Unlimited Trading · Daily operational worksheet</p></div><strong>${stage==='delivery'?safe(cash(p.deliveryValue)):`${rows?.length||0} jobs`}</strong></div>${targetBlock(p,value)}${body}${footer()}</section>`;
}
async function printMarkedWorksheets(stage,date){
  if(typeof window.buildWorkflowForecast!=='function')return;
  const p=await window.buildWorkflowForecast(date),stages=stage==='all'?['production','finishing','painting','delivery']:[stage];
  const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Daily Operations ${safe(p.date)}</title><style>${printStyle}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${stages.map(s=>sheet(s,p)).join('')}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},300);
}
window.opPrint=printMarkedWorksheets;
})();