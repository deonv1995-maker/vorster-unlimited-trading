/* V9.0.33 — unified on-screen stocktake + scan-ready paper capture.
   One review/apply pipeline for stock sheets and factory worksheets.
   OCR is proposal-only: no scan result writes to business data without review. */
(function(){
'use strict';
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=v=>String(v||'').trim().toLowerCase();
const qty=v=>Math.max(0,Math.round(Number(v||0)));
const rawId=id=>typeof vuRawBalanceId==='function'?vuRawBalanceId(id):`${id}::raw`;
const dateKey=()=>new Date().toISOString().slice(0,10);
const isProductLine=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
const DIVISIONS=['Casting','Packing','Resin'];

function injectStyles(){
  if(document.getElementById('vuPaperCaptureStyle'))return;
  const s=document.createElement('style');s.id='vuPaperCaptureStyle';s.textContent=`
  .bulk-stock-toolbar,.paper-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}.bulk-stock-list{display:grid;gap:7px;max-height:58vh;overflow:auto;margin:10px 0}.bulk-stock-row{display:grid;grid-template-columns:minmax(0,1fr) 86px;gap:10px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:13px;background:var(--surface)}.bulk-stock-row span{display:flex;flex-direction:column}.bulk-stock-row small{color:var(--muted)}.bulk-stock-row input{margin:0;text-align:center;font-weight:800;font-size:1.05rem}.stock-row-changed,.paper-review-row.changed{outline:2px solid currentColor}.paper-review{display:grid;gap:7px;max-height:55vh;overflow:auto;margin:10px 0}.paper-review-row{display:grid;grid-template-columns:minmax(0,1fr) 82px;gap:10px;align-items:center;padding:9px;border:1px solid var(--border);border-radius:12px}.paper-review-row.uncertain{border-style:dashed}.paper-review-row input{margin:0;text-align:center}.paper-status{font-size:.72rem;color:var(--muted)}.paper-status.uncertain{font-weight:700}.paper-upload{display:grid;gap:10px}.paper-upload label{display:block}.paper-progress{padding:8px;border:1px solid var(--border);border-radius:10px}.paper-hub{display:grid;gap:8px}.paper-hub button{text-align:left;padding:12px}.machine-id{font-family:monospace;font-size:8px;letter-spacing:.1px}.scan-box{height:29px;border:2px solid #111;min-width:55px}`;document.head.appendChild(s);
}
injectStyles();

async function rawQuantity(productId){const b=await getOne('inventoryBalances',rawId(productId));return qty(b?.quantity||0)}
async function setRawQuantity(product,newQty,note){
  const id=rawId(product.id),previous=await getOne('inventoryBalances',id),oldQty=qty(previous?.quantity||0),now=new Date().toISOString();
  await putOne('inventoryBalances',{id,productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',quantity:newQty,updatedAt:now});
  if(oldQty!==newQty)await putOne('inventoryTransactions',{id:uid('inv'),productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',type:'STOCK_COUNT',previousQuantity:oldQty,quantityChange:newQty-oldQty,newQuantity:newQty,note,createdAt:now});
}
async function addRawOutput(productId,amount,reference){
  const amountQty=qty(amount);if(!amountQty)return;
  const product=await getOne('products',productId);if(!product)return;
  const id=rawId(productId),current=await getOne('inventoryBalances',id),oldQty=qty(current?.quantity||0),newQty=oldQty+amountQty,now=new Date().toISOString();
  await putOne('inventoryBalances',{id,productId,productCode:product.code,productName:product.name,colourName:'Raw Stock',quantity:newQty,updatedAt:now});
  await putOne('inventoryTransactions',{id:uid('inv'),productId,productCode:product.code,productName:product.name,colourName:'Raw Stock',type:'PRODUCTION_OUTPUT',previousQuantity:oldQty,quantityChange:amountQty,newQuantity:newQty,note:reference||'Scanned production worksheet',createdAt:now});
}
function methodsOf(p){return String(p?.manufacturingMethods||'').split('|').map(x=>x.trim()).filter(Boolean)}
function visibilityOf(p){return String(p?.divisionStockVisibility||'').split('|').map(x=>x.trim()).filter(Boolean)}
function belongsToDivision(p,d){const vis=visibilityOf(p);return vis.length?vis.includes(d):p?.primaryDivision===d||methodsOf(p).includes(d)}
function worksheetDivision(p){return p?.worksheetDivision||p?.primaryDivision||''}
async function productsForScope(scope={}){let p=(await getAll('products')).filter(x=>x.isActive!==false);if(scope.division)p=p.filter(x=>belongsToDivision(x,scope.division));return p.sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')))}

/* ---------- Bulk stocktake: authoritative general stock screen ---------- */
window.openStockCountList=async function openBulkStockCountList(filter=''){
  const products=await productsForScope({});const rows=await Promise.all(products.map(async p=>({p,current:await rawQuantity(p.id)})));
  openDialog(`<div class="dialog-head"><div><div class="step-label">Physical stocktake</div><h2>Bulk raw stock count</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <div class="bulk-stock-toolbar"><input id="bulkStockSearch" class="search" placeholder="Search code, product or category" value="${safe(filter)}"><button id="bulkStockPrint" class="ghost" type="button">Print stock sheet</button><button id="bulkStockScan" class="ghost" type="button">Scan / import completed sheet</button></div>
    <p class="muted">Edit quantities directly. Changed rows are highlighted. Only changed quantities create stock-history transactions.</p>
    <div id="bulkStockRows" class="bulk-stock-list">${rows.map(({p,current})=>`<label class="bulk-stock-row" data-search="${safe(`${p.code||''} ${p.name||''} ${p.category||''}`.toLowerCase())}"><span><strong>${safe(p.code||'')}</strong><small>${safe(p.name||'')}</small><small>Current raw stock: ${current}</small></span><input type="number" min="0" step="1" inputmode="numeric" enterkeyhint="next" data-bulk-stock="${safe(p.id)}" data-original="${current}" value="${current}"></label>`).join('')||'<div class="empty">No products found.</div>'}</div>
    <button id="bulkStockSave" class="primary" type="button">Save changed quantities</button>`);
  const inputs=[...document.querySelectorAll('[data-bulk-stock]')];
  const search=document.getElementById('bulkStockSearch');
  const applyFilter=()=>{const q=norm(search.value);document.querySelectorAll('.bulk-stock-row').forEach(r=>r.style.display=!q||r.dataset.search.includes(q)?'':'none')};
  search.oninput=applyFilter;applyFilter();
  inputs.forEach((i,index)=>{i.oninput=()=>i.closest('.bulk-stock-row')?.classList.toggle('stock-row-changed',qty(i.value)!==qty(i.dataset.original));i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();inputs[index+1]?.focus();inputs[index+1]?.select()}}});
  document.getElementById('bulkStockSave').onclick=async()=>{const changed=inputs.filter(i=>qty(i.value)!==qty(i.dataset.original));if(!changed.length){notify('No stock quantities changed');return}const map=new Map(products.map(p=>[String(p.id),p]));for(const i of changed){const p=map.get(String(i.dataset.bulkStock));if(!p)continue;await setRawQuantity(p,qty(i.value),'Bulk stock count');i.dataset.original=String(qty(i.value));i.closest('.bulk-stock-row')?.classList.remove('stock-row-changed')}if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();notify(`${changed.length} stock ${changed.length===1?'quantity':'quantities'} saved`)};
  document.getElementById('bulkStockPrint').onclick=async()=>printStockSheet(products,'All Products Stock Count',{type:'stock'});
  document.getElementById('bulkStockScan').onclick=()=>openPaperImport({kind:'stock',title:'Stock Count',products});
  requestAnimationFrame(()=>search.focus({preventScroll:true}));
};
try{openStockCountList=window.openStockCountList}catch{}

/* ---------- Scan-ready printing ---------- */
function openPrintWindow(title,body){const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return}const style=`@page{size:A4;margin:8mm}*{box-sizing:border-box}body{font:10.5px Arial;color:#111;margin:0}.bar{text-align:center;padding:7px}.head{border-bottom:3px solid #111;padding-bottom:6px;margin-bottom:7px}.head h1{margin:0;font-size:19px}.meta{font-size:9px;margin-top:2px}.machine-id{font:7px monospace;letter-spacing:.1px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1.5px solid #555;padding:5px;vertical-align:middle}th.code{width:18%}th.current{width:13%}th.mark{width:10%}th.done{width:18%}.countbox{height:31px;border:2.5px solid #111}.box{width:17px;height:17px;border:2px solid #111;display:inline-block}.row{border:1.5px solid #666;margin:6px 0;padding:6px;break-inside:avoid}.rowgrid{display:grid;grid-template-columns:minmax(0,1fr) 60px 45px 45px 90px;gap:6px;align-items:center}.donebox{height:29px;border:2.5px solid #111}.small{font-size:9px}@media print{.bar{display:none}}`;w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(title)}</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div>${body}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus()}catch{}},100)}
async function printStockSheet(products,title,scope={}){
  const rows=await Promise.all(products.map(async p=>({p,current:await rawQuantity(p.id)}))),day=dateKey();
  const body=`<div class="head"><h1>${safe(title)}</h1><div>Vorster Unlimited Trading · ${safe(day)} · ${rows.length} products</div><div class="meta">Write one clear whole number in each Counted Qty box. This sheet is designed for photo/PDF import and review.</div></div><table><thead><tr><th class="code">Code</th><th>Product</th><th class="current">Current</th><th class="done">Counted Qty</th></tr></thead><tbody>${rows.map(({p,current})=>`<tr><td><b>${safe(p.code||'')}</b><div class="machine-id">[VUROW|STOCK|${safe(p.id)}|${safe(p.code||'')}]</div></td><td>${safe(p.name||'')}</td><td style="text-align:center"><b>${current}</b></td><td><div>COUNTED:</div><div class="countbox"></div></td></tr>`).join('')}</tbody></table>`;
  openPrintWindow(title,body);window.VUPaperLastContext={kind:'stock',products,scope};
}

async function worksheetRows(stage,date,division=''){
  if(typeof buildWorkflowForecast!=='function')return[];
  const [plan,products]=await Promise.all([buildWorkflowForecast(date),getAll('products')]);const byId=new Map(products.map(p=>[String(p.id),p])),byCode=new Map(products.map(p=>[norm(p.code),p]));const rows=[];
  if(stage==='production'){
    (plan.productionItems||[]).forEach((r,index)=>{const p=byId.get(String(r.productId||''))||byCode.get(norm(r.productCode));if(!p)return;if(division&&worksheetDivision(p)!==division)return;rows.push({token:`PROD-${index}-${p.id}`,stage,orderId:r.orderId||'',orderNumber:r.orderNumber||'',productId:p.id,code:r.productCode||p.code,name:r.productName||p.name,planned:qty(r.quantity),customer:r.customerName||''})});
  }else{
    const source=stage==='finishing-painting'?[...(plan.finishing||[]),...(plan.painting||[])]:plan[stage]||[];const seen=new Set();source.forEach((r,ri)=>{const o=r.order;if(!o)return;(o.lines||[]).filter(l=>isProductLine(l)&&qty(l.qty)>0).forEach((l,li)=>{const key=`${stage}|${o.id}|${l.productId||l.productCode}`;if(seen.has(key))return;seen.add(key);rows.push({token:`${stage.toUpperCase()}-${ri}-${li}-${o.id}`,stage,orderId:o.id,orderNumber:o.orderNumber||'',productId:l.productId||'',code:l.productCode||l.code||'',name:l.productName||l.name||'',planned:qty(l.qty),customer:o.customerName||''})})});
  }
  return rows;
}
async function printScanReadyWorksheet(stage,date=dateKey(),division=''){
  const rows=await worksheetRows(stage,date,division),label=division?`${division} Production`:stage==='finishing-painting'?'Finishing & Painting':stage.charAt(0).toUpperCase()+stage.slice(1);const body=`<div class="head"><h1>${safe(label)} Worksheet</h1><div>Vorster Unlimited Trading · ${safe(date)} · ${rows.length} lines</div><div class="meta">Tick FULL when the entire planned quantity is complete, NONE if zero was completed, or write the actual partial quantity in Qty completed.</div></div>${rows.map(r=>`<div class="row"><div class="machine-id">[VUROW|WORK|${safe(r.stage)}|${safe(r.orderId||'-')}|${safe(r.productId||'-')}|${r.planned}|${safe(r.token)}]</div><div class="rowgrid"><div><b>${safe(r.code)} · ${safe(r.name)}</b><div class="small">${safe(r.orderNumber)} ${safe(r.customer)}</div></div><div><b>Plan ${r.planned}</b></div><div><span class="box"></span><div class="small">FULL</div></div><div><span class="box"></span><div class="small">NONE</div></div><div><div>DONE:</div><div class="donebox"></div></div></div></div>`).join('')||'<p>No worksheet lines for this date.</p>'}`;openPrintWindow(`${label} ${date}`,body);window.VUPaperLastContext={kind:'worksheet',stage,date,division,rows};
}

/* Make scan-ready worksheets the final print authority. */
const priorOpPrint=window.opPrint;
window.opPrint=async function(stage,date){if(stage==='all'){for(const s of ['production','finishing-painting','delivery'])await printScanReadyWorksheet(s,date||dateKey());return}const mapped=['finishing','painting','finishing-painting'].includes(stage)?'finishing-painting':stage;if(['production','finishing-painting','delivery'].includes(mapped))return printScanReadyWorksheet(mapped,date||dateKey());return priorOpPrint?.(stage,date)};

/* ---------- OCR ---------- */
function loadScript(src,id){return new Promise((resolve,reject)=>{if(window[id])return resolve(window[id]);const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>resolve(window[id]);s.onerror=()=>reject(new Error(`Could not load ${id}`));document.head.appendChild(s)})}
async function ensureOCR(){if(!window.Tesseract)await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js','Tesseract');return window.Tesseract}
async function ensurePdf(){if(!window.pdfjsLib){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdfjsLib');if(window.pdfjsLib)window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}return window.pdfjsLib}
async function fileToCanvases(file){if(file.type!=='application/pdf')return[file];const pdfjs=await ensurePdf(),data=await file.arrayBuffer(),pdf=await pdfjs.getDocument({data}).promise,out=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),viewport=page.getViewport({scale:2}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;out.push(canvas)}return out}
async function recognizeFile(file,onProgress){const T=await ensureOCR(),sources=await fileToCanvases(file);let text='';for(let i=0;i<sources.length;i++){onProgress?.(`Reading page ${i+1} of ${sources.length}…`);const result=await T.recognize(sources[i],'eng',{logger:m=>{if(m.status==='recognizing text')onProgress?.(`Reading page ${i+1}: ${Math.round((m.progress||0)*100)}%`)}});text+='\n'+(result?.data?.text||'')}return text}
function lineForCode(text,code){const lines=String(text||'').split(/\r?\n/);return lines.find(l=>norm(l).includes(norm(code)))||''}
function detectedNumber(line,keywords=['counted','done']){for(const k of keywords){const m=line.match(new RegExp(`${k}\\D{0,12}(\\d+)`,'i'));if(m)return qty(m[1])}const nums=line.match(/\b\d+\b/g);return nums?.length?qty(nums[nums.length-1]):null}

/* ---------- Review/apply ---------- */
async function openPaperImport(context={}){
  const title=context.title||'Paper import';openDialog(`<div class="dialog-head"><div><div class="step-label">Paper → app</div><h2>${safe(title)}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><p class="muted">Take a clear photo or import an image/PDF. Recognition only proposes values. You must review them before anything is saved.</p><div class="paper-upload"><label class="primary">Take photo<input id="paperCamera" type="file" accept="image/*" capture="environment" hidden></label><label class="ghost">Import photo / PDF<input id="paperFile" type="file" accept="image/*,application/pdf" hidden></label><div id="paperProgress" class="paper-progress">Waiting for sheet…</div></div>`);
  const handle=async file=>{if(!file)return;const progress=document.getElementById('paperProgress');try{progress.textContent='Preparing recognition…';const text=await recognizeFile(file,msg=>{if(progress)progress.textContent=msg});await buildReview(context,text)}catch(error){console.error(error);progress.textContent='Automatic recognition could not run. You can still use the review screen and enter the values manually.';await buildReview(context,'')}};
  document.getElementById('paperCamera').onchange=e=>handle(e.target.files?.[0]);document.getElementById('paperFile').onchange=e=>handle(e.target.files?.[0]);
}
async function buildReview(context,text){
  let rows=[];
  if(context.kind==='stock'){const products=context.products||await productsForScope(context.scope||{});rows=await Promise.all(products.map(async p=>({kind:'stock',productId:p.id,code:p.code,name:p.name,current:await rawQuantity(p.id),planned:null,detected:detectedNumber(lineForCode(text,p.code),['counted'])})))}
  else{rows=context.rows||await worksheetRows(context.stage,context.date||dateKey(),context.division||'');rows=rows.map(r=>({...r,kind:'worksheet',current:null,detected:detectedNumber(lineForCode(text,r.code),['done'])}))}
  openDialog(`<div class="dialog-head"><div><div class="step-label">Review required</div><h2>${context.kind==='stock'?'Review stock count':'Review worksheet results'}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><p class="muted">Check every proposed value. Dashed rows were not confidently read and need manual entry. Blank rows will not be applied.</p><div class="paper-review">${rows.map((r,i)=>`<label class="paper-review-row ${Number.isFinite(r.detected)?'':'uncertain'}"><span><strong>${safe(r.code)} · ${safe(r.name||'')}</strong><small>${r.kind==='stock'?`Current ${r.current}`:`${safe(r.orderNumber||'')} · planned ${r.planned}`}</small><span class="paper-status ${Number.isFinite(r.detected)?'':'uncertain'}">${Number.isFinite(r.detected)?'OCR proposal — verify':'Needs review / enter manually'}</span></span><input type="number" min="0" step="1" inputmode="numeric" data-review-index="${i}" value="${Number.isFinite(r.detected)?r.detected:''}" placeholder="Qty"></label>`).join('')}</div><button id="applyPaperReview" class="primary" type="button">Apply reviewed results</button>`);
  document.getElementById('applyPaperReview').onclick=async()=>{const values=[...document.querySelectorAll('[data-review-index]')].map(i=>({row:rows[Number(i.dataset.reviewIndex)],value:i.value===''?null:qty(i.value)})).filter(x=>x.value!==null);if(!values.length){notify('No reviewed quantities to apply');return}if(context.kind==='stock')await applyStockReview(values);else await applyWorksheetReview(values,context);closeDialog();notify(`${values.length} reviewed ${values.length===1?'result':'results'} applied`)};
}
async function applyStockReview(values){const products=await getAll('products'),map=new Map(products.map(p=>[String(p.id),p]));for(const {row,value} of values){const p=map.get(String(row.productId));if(p)await setRawQuantity(p,value,'Scanned stock count — reviewed')}if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();if(typeof route!=='undefined'&&route==='products')await productsPage()}
async function applyWorksheetReview(values,context){
  const stage=context.stage;
  if(stage==='production'){for(const {row,value} of values)if(value>0)await addRawOutput(row.productId,value,`Reviewed ${row.orderNumber||''} production worksheet`);if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();return}
  const grouped=new Map();for(const v of values){if(!v.row.orderId)continue;if(!grouped.has(v.row.orderId))grouped.set(v.row.orderId,[]);grouped.get(v.row.orderId).push(v)}
  for(const [orderId,items] of grouped){const order=await getOne('orders',orderId);if(!order)continue;const full=items.length&&items.every(x=>x.value>=qty(x.row.planned));const now=new Date().toISOString();if(!full)continue;
    if(stage==='finishing-painting')await putOne('orders',{...order,rawIssued:true,workflowStage:'delivery',finishingStatus:'Completed',paintingStatus:'Completed',finishingCompletedAt:order.finishingCompletedAt||now,paintingCompletedAt:now,updatedAt:now});
    if(stage==='delivery')await putOne('orders',{...order,workflowStage:'delivery',deliveryWorksheetCompletedAt:now,updatedAt:now});
  }
  if(typeof productionPage==='function'&&typeof route!=='undefined'&&route==='production')await productionPage();
}

/* ---------- Paper capture hub ---------- */
async function openWorksheetImportSetup(){openDialog(`<div class="dialog-head"><div><div class="step-label">Worksheet capture</div><h2>Scan completed worksheet</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><label>Worksheet date<input id="paperWorkDate" type="date" value="${dateKey()}"></label><label>Worksheet type<select id="paperWorkStage"><option value="production">Production</option><option value="finishing-painting">Finishing & Painting</option><option value="delivery">Delivery & Collection</option></select></label><label>Manufacturing division (optional)<select id="paperWorkDivision"><option value="">All divisions</option>${DIVISIONS.map(d=>`<option>${d}</option>`).join('')}</select></label><button id="paperWorkContinue" class="primary" type="button">Choose photo / PDF</button>`);document.getElementById('paperWorkContinue').onclick=async()=>{const stage=document.getElementById('paperWorkStage').value,date=document.getElementById('paperWorkDate').value,division=stage==='production'?document.getElementById('paperWorkDivision').value:'';const rows=await worksheetRows(stage,date,division);openPaperImport({kind:'worksheet',title:`${division?division+' ':''}${stage==='finishing-painting'?'Finishing & Painting':stage} worksheet`,stage,date,division,rows})}}
window.openPaperCaptureHub=function(){openDialog(`<div class="dialog-head"><div><div class="step-label">Paper → app</div><h2>Scan & import</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><div class="paper-hub"><button id="paperHubStock" type="button"><strong>Stock count sheet</strong><small>Photo/PDF → review → inventory</small></button><button id="paperHubWork" type="button"><strong>Factory worksheet</strong><small>Production / finishing & painting / delivery → review → workflow</small></button></div>`);document.getElementById('paperHubStock').onclick=async()=>{const products=await productsForScope({});openPaperImport({kind:'stock',title:'Stock Count',products})};document.getElementById('paperHubWork').onclick=openWorksheetImportSetup};

/* Decorate division stock dialogs without duplicating their stock engine. */
const baseOpenDialog=typeof openDialog==='function'?openDialog:null;
if(baseOpenDialog){window.openDialog=function(html){baseOpenDialog(html);setTimeout(async()=>{const label=document.querySelector('#dialog .step-label')?.textContent||'',heading=document.querySelector('#dialog h2')?.textContent||'';const m=label.match(/^(Casting|Packing|Resin) division$/);if(!m||!/stock count/i.test(heading))return;const division=m[1],toolbar=document.querySelector('#dialog .division-toolbar');if(!toolbar||document.getElementById('divisionScanImport'))return;const products=await productsForScope({division});const scan=document.createElement('button');scan.id='divisionScanImport';scan.className='ghost';scan.type='button';scan.textContent='Scan / import';scan.onclick=()=>openPaperImport({kind:'stock',title:`${division} Stock Count`,products,scope:{division}});toolbar.appendChild(scan);const print=document.getElementById('printDivisionStock');if(print)print.onclick=()=>printStockSheet(products,`${division} Stock Count`,{type:'stock',division});const work=document.getElementById('printDivisionWork');if(work)work.onclick=()=>printScanReadyWorksheet('production',dateKey(),division)},0)};try{openDialog=window.openDialog}catch{}}

/* Add access point on Products page after all existing decorators. */
const baseProductsPage=typeof productsPage==='function'?productsPage:null;
if(baseProductsPage){productsPage=async function(...args){await baseProductsPage(...args);const toolbar=document.querySelector('.product-toolbar-row');if(toolbar&&!document.getElementById('paperCaptureBtn')){const b=document.createElement('button');b.id='paperCaptureBtn';b.className='ghost';b.type='button';b.textContent='Scan sheets';b.onclick=window.openPaperCaptureHub;toolbar.appendChild(b)}};try{window.productsPage=productsPage}catch{}}

window.VUPaperCapture={version:'9.0.33',printStockSheet,printScanReadyWorksheet,openPaperImport,openWorksheetImportSetup};
})();