/* V9.0.55 — direct division print-button authority.
   Prevents legacy generic production print handlers from firing for Casting/Packing/Resin/Painting.
   Division PDFs are built directly from the same strict division plan used by the current Operations view. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin','Painting'];
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const n=v=>Math.max(0,Number(v||0));
const dateValue=()=>document.getElementById('opDate')?.value||new Date().toISOString().slice(0,10);
const display=v=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`));
const style='@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font:10.5px Arial;color:#111;margin:0}.bar{text-align:center;margin:8px}.sheet{page-break-after:always}.head{border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px}.head h1{margin:0;font-size:20px}.job{border:1.5px solid #555;padding:7px;margin:7px 0;break-inside:avoid}.line{display:grid;grid-template-columns:1fr 75px 95px;gap:6px;align-items:center}.write{height:25px;border:2px solid #111}.muted{color:#444}.foot{border-top:1px solid #111;margin-top:12px;padding-top:8px}.empty{border:1px dashed #999;padding:16px;text-align:center}@media print{.bar{display:none}.sheet:last-child{page-break-after:auto}}';
async function strictPlan(date){
  const api=window.VUStrictDivisionWorksheets;
  if(api?.strictPlan)return api.strictPlan(date);
  throw new Error('Strict division planner is unavailable');
}
function sheet(plan,division){
  const items=plan.productionByDivision?.[division]||[];
  const rows=items.map((r,i)=>`<div class="job"><div class="muted">Priority ${i+1}${r.targetOrder?' · TARGET PRIORITY':''}</div><div class="line"><div><b>${safe(r.productCode||'')} · ${safe(r.productName||'')}</b><br><span class="muted">${safe(r.colourName||'Standard')} · ${safe(r.orderNumber||'')} ${safe(r.customerName||'')}</span></div><b>${n(r.quantity)}</b><div><div class="write"></div><small>Qty completed</small></div></div></div>`).join('');
  return `<section class="sheet"><div class="head"><h1>${safe(division)} Production Worksheet</h1><div>Vorster Unlimited Trading · ${safe(display(plan.date))} · ${items.length} production lines</div></div>${rows||`<div class="empty">No ${safe(division.toLowerCase())} production work planned for this date.</div>`}<div class="foot">${safe(division)} supervisor: ____________________ &nbsp; Completed: ________</div></section>`;
}
function openPrint(title,body){
  const w=window.open('','_blank');
  if(!w){alert('Allow pop-ups and try again.');return;}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(title)}</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${body}</body></html>`);
  w.document.close();
  setTimeout(()=>{try{w.focus();w.print()}catch{}},250);
}
async function printDivision(division){
  const plan=await strictPlan(dateValue());
  openPrint(`${division} Production Worksheet`,sheet(plan,division));
}
async function printAll(){
  const plan=await strictPlan(dateValue());
  openPrint('Production Division Worksheets',DIVISIONS.map(d=>sheet(plan,d)).join(''));
}
window.VUPrintDivisionProduction=printDivision;
window.VUPrintAllDivisionProduction=printAll;

document.addEventListener('click',function(e){
  const button=e.target?.closest?.('button');
  if(!button)return;
  const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
  const match=text.match(/^Print (Casting|Packing|Resin|Painting) worksheet$/i);
  if(match){
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const division=DIVISIONS.find(d=>d.toLowerCase()===match[1].toLowerCase());
    printDivision(division).catch(err=>{console.error(err);alert('Could not build the division worksheet.');});
    return;
  }
  if(/^Print all 4 production worksheets$/i.test(text)){
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    printAll().catch(err=>{console.error(err);alert('Could not build the production worksheets.');});
  }
},true);

window.VUDivisionPrintClickAuthority={version:'9.0.55',printDivision,printAll};
})();