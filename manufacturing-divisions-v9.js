/* V9.0.32 — manufacturing division classification and division stock/worksheet views.
   Classification is stored on existing product records. No duplicate product or stock databases. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin'];
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=v=>String(v||'').trim().toLowerCase();
const num=v=>Math.max(0,Math.round(Number(v||0)));
const todayKey=()=>new Date().toISOString().slice(0,10);
const rawId=productId=>typeof vuRawBalanceId==='function'?vuRawBalanceId(productId):`${productId}::raw`;
const methodsOf=p=>String(p?.manufacturingMethods||'').split('|').map(x=>x.trim()).filter(Boolean);
const visibleIn=p=>String(p?.divisionStockVisibility||'').split('|').map(x=>x.trim()).filter(Boolean);
const componentsOf=p=>String(p?.manufacturingComponentsSpec||'').split(/\n|,/).map(line=>{
  const [code,qty]=line.split(':').map(x=>String(x||'').trim());
  return code?{code,qty:Math.max(0,Number(qty||1))}:null;
}).filter(Boolean);
function divisionForWorksheet(p){return p?.worksheetDivision||p?.primaryDivision||'';}
function belongsToStock(p,division){
  const explicit=visibleIn(p);
  if(explicit.length)return explicit.includes(division);
  return p?.primaryDivision===division||methodsOf(p).includes(division);
}
function classificationSummary(p){
  const methods=methodsOf(p);
  if(!p?.primaryDivision&&!methods.length)return'Unclassified';
  return `${p.primaryDivision||methods[0]||'—'}${methods.length>1?` · ${methods.join(' / ')}`:''}`;
}

/* Product form extension. Existing form save already persists named fields from FormData. */
const baseShowProductForm=typeof showProductForm==='function'?showProductForm:null;
if(baseShowProductForm){
  showProductForm=async function showProductFormWithManufacturing(id=''){
    await baseShowProductForm(id);
    const form=document.getElementById('productForm');
    if(!form||form.querySelector('[data-manufacturing-classification]'))return;
    const product=id?await getOne('products',id):{};
    const currentMethods=methodsOf(product);
    const currentVisible=visibleIn(product);
    const primary=product?.primaryDivision||'';
    const worksheet=product?.worksheetDivision||primary||'';
    const stage=product?.inventoryStage||'Finished sale product';
    const anchor=form.querySelector('button[type="submit"]');
    const block=document.createElement('section');
    block.dataset.manufacturingClassification='1';
    block.className='manufacturing-classification';
    block.innerHTML=`
      <div class="manufacturing-title"><strong>Manufacturing classification</strong><small>Used by division stock sheets and production worksheets.</small></div>
      <label>Primary / default division
        <select name="primaryDivision" id="primaryDivision"><option value="">Unclassified</option>${DIVISIONS.map(d=>`<option value="${d}" ${primary===d?'selected':''}>${d}</option>`).join('')}</select>
      </label>
      <div class="manufacturing-field"><span>Allowed production methods</span><div class="manufacturing-checks">${DIVISIONS.map(d=>`<label><input type="checkbox" data-method="${d}" ${currentMethods.includes(d)?'checked':''}> ${d}</label>`).join('')}</div></div>
      <input type="hidden" name="manufacturingMethods" id="manufacturingMethods" value="${safe(currentMethods.join('|'))}">
      <label>Inventory stage
        <select name="inventoryStage"><option ${stage==='Raw component'?'selected':''}>Raw component</option><option ${stage==='Intermediate'?'selected':''}>Intermediate</option><option ${stage==='Finished sale product'?'selected':''}>Finished sale product</option></select>
      </label>
      <label>Worksheet division
        <select name="worksheetDivision" id="worksheetDivision"><option value="">Use primary division</option>${DIVISIONS.map(d=>`<option value="${d}" ${worksheet===d?'selected':''}>${d}</option>`).join('')}</select>
      </label>
      <div class="manufacturing-field"><span>Show on stock sheets</span><small>Leave all unticked to follow the allowed methods automatically.</small><div class="manufacturing-checks">${DIVISIONS.map(d=>`<label><input type="checkbox" data-stock-division="${d}" ${currentVisible.includes(d)?'checked':''}> ${d}</label>`).join('')}</div></div>
      <input type="hidden" name="divisionStockVisibility" id="divisionStockVisibility" value="${safe(currentVisible.join('|'))}">
      <label>Components consumed to make this product
        <textarea name="manufacturingComponentsSpec" placeholder="One per line: PRODUCTCODE:QTY\nExample: BASE001:1">${safe(product?.manufacturingComponentsSpec||'')}</textarea>
        <small>Use this for Resin products or any item that consumes another manufactured item.</small>
      </label>`;
    if(anchor)form.insertBefore(block,anchor);else form.appendChild(block);
    const sync=()=>{
      document.getElementById('manufacturingMethods').value=[...form.querySelectorAll('[data-method]:checked')].map(x=>x.dataset.method).join('|');
      document.getElementById('divisionStockVisibility').value=[...form.querySelectorAll('[data-stock-division]:checked')].map(x=>x.dataset.stockDivision).join('|');
    };
    form.querySelectorAll('[data-method],[data-stock-division]').forEach(x=>x.addEventListener('change',sync));
    document.getElementById('primaryDivision')?.addEventListener('change',e=>{
      if(!document.getElementById('worksheetDivision').value)document.getElementById('worksheetDivision').value=e.target.value;
    });
    sync();
  };
  try{window.showProductForm=showProductForm}catch{}
}

async function divisionProducts(division){
  const products=(await getAll('products')).filter(p=>p.isActive!==false&&belongsToStock(p,division));
  return products.sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')));
}
async function rawQty(productId){
  const b=await getOne('inventoryBalances',rawId(productId));
  return num(b?.quantity||0);
}
async function saveRawQuantity(product,newQuantity,note){
  const id=rawId(product.id),previous=await getOne('inventoryBalances',id),oldQty=num(previous?.quantity||0),now=new Date().toISOString();
  await putOne('inventoryBalances',{id,productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',quantity:newQuantity,updatedAt:now});
  if(oldQty!==newQuantity){
    await putOne('inventoryTransactions',{id:uid('inv'),productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',type:'STOCK_COUNT',previousQuantity:oldQty,quantityChange:newQuantity-oldQty,newQuantity,note,createdAt:now});
  }
}

async function openDivisionStock(division){
  const products=await divisionProducts(division);
  const rows=await Promise.all(products.map(async p=>({p,qty:await rawQty(p.id)})));
  openDialog(`
    <div class="dialog-head"><div><div class="step-label">${safe(division)} division</div><h2>Stock count</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <div class="division-toolbar"><input id="divisionStockSearch" class="search" placeholder="Search code or product"><button id="printDivisionStock" class="ghost" type="button">Print stock sheet</button><button id="printDivisionWork" class="ghost" type="button">Print worksheet</button></div>
    <p class="muted">Edit quantities directly. Only changed rows are written to stock history.</p>
    <div id="divisionStockRows" class="division-stock-list">${rows.length?rows.map(({p,qty})=>`
      <label class="division-stock-row" data-search="${safe(`${p.code||''} ${p.name||''} ${p.category||''}`.toLowerCase())}">
        <span><strong>${safe(p.code||'')}</strong><small>${safe(p.name||'')}</small><small>${safe(classificationSummary(p))}</small></span>
        <input type="number" min="0" step="1" inputmode="numeric" enterkeyhint="next" data-division-stock-id="${safe(p.id)}" data-original="${qty}" value="${qty}">
      </label>`).join(''):'<div class="empty">No products are classified for this division yet.</div>'}</div>
    <button id="saveDivisionStock" class="primary" type="button" ${rows.length?'':'disabled'}>Save changed quantities</button>
  `);
  const inputs=[...document.querySelectorAll('[data-division-stock-id]')];
  inputs.forEach((input,index)=>{
    input.addEventListener('input',()=>input.closest('.division-stock-row')?.classList.toggle('stock-row-changed',num(input.value)!==num(input.dataset.original)));
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inputs[index+1]?.focus();inputs[index+1]?.select();}});
  });
  document.getElementById('divisionStockSearch').oninput=e=>{
    const q=norm(e.target.value);document.querySelectorAll('.division-stock-row').forEach(row=>row.style.display=!q||row.dataset.search.includes(q)?'':'none');
  };
  document.getElementById('saveDivisionStock').onclick=async()=>{
    const changed=inputs.filter(i=>num(i.value)!==num(i.dataset.original));
    if(!changed.length){notify('No stock quantities changed');return;}
    const byId=new Map(products.map(p=>[String(p.id),p]));
    for(const input of changed){
      const p=byId.get(String(input.dataset.divisionStockId));if(!p)continue;
      await saveRawQuantity(p,num(input.value),`${division} division stock count`);
      input.dataset.original=String(num(input.value));input.closest('.division-stock-row')?.classList.remove('stock-row-changed');
    }
    if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();
    notify(`${changed.length} stock ${changed.length===1?'quantity':'quantities'} saved`);
  };
  document.getElementById('printDivisionStock').onclick=()=>printDivisionStockSheet(division,products);
  document.getElementById('printDivisionWork').onclick=()=>printDivisionWorksheet(division);
  requestAnimationFrame(()=>inputs[0]?.focus({preventScroll:true}));
}

async function printDivisionStockSheet(division,products){
  const rows=await Promise.all(products.map(async p=>({p,qty:await rawQty(p.id)})));
  const date=new Intl.DateTimeFormat('en-ZA',{dateStyle:'long'}).format(new Date());
  const style='@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font:10.5px Arial;color:#111}h1{margin:0}.head{border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px}.meta{color:#444;margin:3px 0 10px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #777;padding:5px}th:nth-child(1){width:18%}th:nth-child(3){width:14%}th:nth-child(4){width:20%}.count{height:27px;border:2px solid #111}.component{font-size:9px;color:#444}.bar{text-align:center;margin:8px}@media print{.bar{display:none}}';
  const body=rows.map(({p,qty})=>{const comps=componentsOf(p);return `<tr><td><b>${safe(p.code||'')}</b></td><td>${safe(p.name||'')}${comps.length?`<div class="component">Uses: ${safe(comps.map(c=>`${c.qty} × ${c.code}`).join(' · '))}</div>`:''}</td><td style="text-align:center">${qty}</td><td><div class="count"></div></td></tr>`}).join('');
  const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return;}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(division)} Stock Count</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div><div class="head"><h1>${safe(division)} Stock Count Sheet</h1><div class="meta">Vorster Unlimited Trading · ${safe(date)} · ${rows.length} products</div></div><table><thead><tr><th>Code</th><th>Product</th><th>Current</th><th>Counted Qty</th></tr></thead><tbody>${body}</tbody></table></body></html>`);w.document.close();
}

async function printDivisionWorksheet(division,date=todayKey()){
  if(typeof window.buildWorkflowForecast!=='function'){notify('Production forecast is not available');return;}
  const [plan,products]=await Promise.all([window.buildWorkflowForecast(date),getAll('products')]);
  const byId=new Map(products.map(p=>[String(p.id),p]));
  const byCode=new Map(products.map(p=>[norm(p.code),p]));
  const lines=(plan.productionItems||[]).filter(line=>{
    const p=byId.get(String(line.productId||''))||byCode.get(norm(line.productCode));
    return p&&divisionForWorksheet(p)===division;
  });
  const style='@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font:10.5px Arial;color:#111}.head{border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px}h1{margin:0}.job{border:1px solid #777;padding:7px;margin:7px 0;break-inside:avoid}.line{display:grid;grid-template-columns:1fr 80px 100px;gap:6px;align-items:center}.write{height:25px;border:2px solid #111}.component{font-size:9px;color:#444;margin-top:4px}.bar{text-align:center;margin:8px}@media print{.bar{display:none}}';
  const rows=lines.map(line=>{const p=byId.get(String(line.productId||''))||byCode.get(norm(line.productCode));const comps=componentsOf(p);return `<div class="job"><div class="line"><div><b>${safe(line.productCode||p?.code||'')} · ${safe(line.productName||p?.name||'')}</b><br>${safe(line.orderNumber||'')} ${safe(line.customerName||'')}${comps.length?`<div class="component">Components required: ${safe(comps.map(c=>`${c.qty} × ${c.code}`).join(' · '))}</div>`:''}</div><div><b>Plan ${num(line.quantity)}</b></div><div><div class="write"></div><small>Qty completed</small></div></div></div>`}).join('');
  const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return;}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(division)} Worksheet</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div><div class="head"><h1>${safe(division)} Production Worksheet</h1><div>Vorster Unlimited Trading · ${safe(date)} · ${lines.length} production lines</div></div>${rows||'<p>No classified production work for this division on this date.</p>'}</body></html>`);w.document.close();
}

function openDivisionPicker(){
  openDialog(`<div class="dialog-head"><div><div class="step-label">Manufacturing</div><h2>Division sheets</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><p class="muted">Choose a division to count its stock or print its stock/production sheets.</p><div class="division-picker">${DIVISIONS.map(d=>`<button class="division-card" type="button" data-division="${d}"><strong>${d}</strong><small>Stock count · stock sheet · production worksheet</small></button>`).join('')}</div>`);
  document.querySelectorAll('[data-division]').forEach(b=>b.onclick=()=>openDivisionStock(b.dataset.division));
}

async function decorateProducts(){
  if(typeof route!=='undefined'&&route!=='products')return;
  const toolbar=document.querySelector('.product-toolbar-row');
  if(toolbar&&!document.getElementById('divisionSheetsBtn')){
    const b=document.createElement('button');b.id='divisionSheetsBtn';b.className='ghost';b.type='button';b.textContent='Division sheets';b.onclick=openDivisionPicker;toolbar.appendChild(b);
  }
}
const baseProductsPage=typeof productsPage==='function'?productsPage:null;
if(baseProductsPage){
  productsPage=async function productsPageManufacturing(...args){await baseProductsPage(...args);await decorateProducts();};
  try{window.productsPage=productsPage}catch{}
}

const style=document.createElement('style');style.textContent=`
.manufacturing-classification{margin:16px 0;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--surface-2);display:grid;gap:10px}.manufacturing-title{display:flex;flex-direction:column;gap:2px}.manufacturing-title small,.manufacturing-field small{color:var(--muted)}.manufacturing-field{display:grid;gap:7px}.manufacturing-checks{display:flex;flex-wrap:wrap;gap:8px}.manufacturing-checks label{display:flex;align-items:center;gap:5px;margin:0;padding:7px 9px;border:1px solid var(--border);border-radius:10px}.manufacturing-checks input{width:auto;margin:0}.division-picker{display:grid;gap:10px}.division-card{display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;padding:16px;border:1px solid var(--border);border-radius:15px;background:var(--surface-2);color:var(--text);text-align:left}.division-card strong{font-size:1.1rem}.division-card small{color:var(--muted)}.division-toolbar{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center}.division-toolbar .search{margin:0}.division-stock-list{display:grid;gap:7px;max-height:57vh;overflow:auto;margin:12px 0}.division-stock-row{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:10px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:13px;background:var(--surface)}.division-stock-row>span{display:flex;flex-direction:column;gap:2px}.division-stock-row small{color:var(--muted)}.division-stock-row input{margin:0;text-align:center;font-size:1.05rem;font-weight:700}.stock-row-changed{outline:2px solid var(--accent)}@media(max-width:520px){.division-toolbar{grid-template-columns:1fr 1fr}.division-toolbar .search{grid-column:1/-1}.division-stock-row{grid-template-columns:minmax(0,1fr) 82px}}
`;document.head.appendChild(style);

window.VUManufacturingDivisions={DIVISIONS,methodsOf,visibleIn,componentsOf,divisionForWorksheet,belongsToStock,openDivisionStock,printDivisionStockSheet,printDivisionWorksheet,openDivisionPicker};
if(typeof route!=='undefined'&&route==='products')decorateProducts();
})();