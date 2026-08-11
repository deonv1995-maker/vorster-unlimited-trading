/* V9.0.54 — authoritative division stock-sheet routing.
   Production worksheets use worksheetDivision -> primaryDivision.
   Stock sheets use divisionStockVisibility as their explicit routing field.
   A stock item may belong to exactly one stock sheet. Multiple saved stock-sheet divisions are setup-required. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin','Painting'];
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=v=>String(v||'').trim().toLowerCase();
const num=v=>Math.max(0,Math.round(Number(v||0)));
const rawId=productId=>typeof vuRawBalanceId==='function'?vuRawBalanceId(productId):`${productId}::raw`;
const componentsOf=p=>window.VUManufacturingDivisions?.componentsOf?.(p)||[];
function stockSheetDivision(product){
  const explicit=String(product?.divisionStockVisibility||'').split('|').map(x=>x.trim()).filter(x=>DIVISIONS.includes(x));
  if(explicit.length===1)return explicit[0];
  if(explicit.length>1)return 'Unclassified';
  const primary=String(product?.primaryDivision||'').trim();
  return DIVISIONS.includes(primary)?primary:'Unclassified';
}
async function strictProducts(division){
  const products=await getAll('products');
  return products.filter(p=>p.isActive!==false&&stockSheetDivision(p)===division).sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')));
}
async function rawQty(productId){const b=await getOne('inventoryBalances',rawId(productId));return num(b?.quantity||0)}
async function saveRaw(product,newQuantity,division){
  const id=rawId(product.id),old=await getOne('inventoryBalances',id),oldQty=num(old?.quantity||0),now=new Date().toISOString();
  await putOne('inventoryBalances',{id,productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',quantity:newQuantity,updatedAt:now});
  if(oldQty!==newQuantity)await putOne('inventoryTransactions',{id:uid('inv'),productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',type:'STOCK_COUNT',previousQuantity:oldQty,quantityChange:newQuantity-oldQty,newQuantity,note:`${division} division stock count`,createdAt:now});
}
async function printStockSheet(division){
  const products=await strictProducts(division),rows=await Promise.all(products.map(async p=>({p,qty:await rawQty(p.id)})));
  const date=new Intl.DateTimeFormat('en-ZA',{dateStyle:'long'}).format(new Date());
  const style='@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font:10.5px Arial;color:#111}h1{margin:0}.head{border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px}.meta{color:#444;margin:3px 0 10px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #777;padding:5px}th:nth-child(1){width:18%}th:nth-child(3){width:14%}th:nth-child(4){width:20%}.count{height:27px;border:2px solid #111}.component{font-size:9px;color:#444}.bar{text-align:center;margin:8px}@media print{.bar{display:none}}';
  const body=rows.map(({p,qty})=>{const comps=componentsOf(p);return `<tr><td><b>${safe(p.code||'')}</b></td><td>${safe(p.name||'')}${comps.length?`<div class="component">Uses: ${safe(comps.map(c=>`${c.qty} × ${c.code}`).join(' · '))}</div>`:''}</td><td style="text-align:center">${qty}</td><td><div class="count"></div></td></tr>`}).join('');
  const w=window.open('','_blank');if(!w){alert('Allow pop-ups and try again.');return;}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(division)} Stock Count</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">Print / Save PDF</button></div><div class="head"><h1>${safe(division)} Stock Count Sheet</h1><div class="meta">Vorster Unlimited Trading · ${safe(date)} · ${rows.length} products</div></div><table><thead><tr><th>Code</th><th>Product</th><th>Current</th><th>Counted Qty</th></tr></thead><tbody>${body||'<tr><td colspan="4">No products assigned to this stock sheet.</td></tr>'}</tbody></table></body></html>`);w.document.close();
}
async function openStock(division){
  const products=await strictProducts(division),rows=await Promise.all(products.map(async p=>({p,qty:await rawQty(p.id)})));
  openDialog(`<div class="dialog-head"><div><div class="step-label">${safe(division)} division</div><h2>Stock count</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><p class="muted">Stock-sheet routing follows each product's Show on stock sheets setting. Production worksheet routing remains separate.</p><div class="division-toolbar"><input id="strictDivisionSearch" class="search" placeholder="Search code or product"><button id="strictDivisionPrint" class="ghost" type="button">Print stock sheet</button><button id="strictDivisionWork" class="ghost" type="button">Print production worksheet</button></div><div id="strictDivisionRows" class="division-stock-list">${rows.length?rows.map(({p,qty})=>`<label class="division-stock-row" data-search="${safe(`${p.code||''} ${p.name||''} ${p.category||''}`.toLowerCase())}"><span><strong>${safe(p.code||'')}</strong><small>${safe(p.name||'')}</small><small>Stock sheet: ${safe(stockSheetDivision(p))}</small></span><input type="number" min="0" step="1" inputmode="numeric" enterkeyhint="next" data-strict-stock-id="${safe(p.id)}" data-original="${qty}" value="${qty}"></label>`).join(''):`<div class="empty">No products are assigned to ${safe(division)} stock sheet yet.</div>`}</div><button id="strictDivisionSave" class="primary" type="button" ${rows.length?'':'disabled'}>Save changed quantities</button>`);
  const inputs=[...document.querySelectorAll('[data-strict-stock-id]')],byId=new Map(products.map(p=>[String(p.id),p]));
  inputs.forEach((input,index)=>{input.addEventListener('input',()=>input.closest('.division-stock-row')?.classList.toggle('stock-row-changed',num(input.value)!==num(input.dataset.original)));input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inputs[index+1]?.focus();inputs[index+1]?.select();}})});
  document.getElementById('strictDivisionSearch').oninput=e=>{const q=norm(e.target.value);document.querySelectorAll('#strictDivisionRows .division-stock-row').forEach(row=>row.style.display=!q||row.dataset.search.includes(q)?'':'none')};
  document.getElementById('strictDivisionPrint').onclick=()=>printStockSheet(division);
  document.getElementById('strictDivisionWork').onclick=()=>window.opPrint?.('production',new Date().toISOString().slice(0,10),division);
  document.getElementById('strictDivisionSave').onclick=async()=>{const changed=inputs.filter(i=>num(i.value)!==num(i.dataset.original));if(!changed.length){notify('No stock quantities changed');return;}for(const input of changed){const p=byId.get(String(input.dataset.strictStockId));if(!p)continue;await saveRaw(p,num(input.value),division);input.dataset.original=String(num(input.value));input.closest('.division-stock-row')?.classList.remove('stock-row-changed');}if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();notify(`${changed.length} stock ${changed.length===1?'quantity':'quantities'} saved`);};
  requestAnimationFrame(()=>inputs[0]?.focus({preventScroll:true}));
}
function openPicker(){openDialog(`<div class="dialog-head"><div><div class="step-label">Manufacturing</div><h2>Division sheets</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><p class="muted">Stock sheets follow Show on stock sheets. Production worksheets follow Worksheet division.</p><div class="division-picker">${DIVISIONS.map(d=>`<button class="division-card" type="button" data-strict-division="${d}"><strong>${d}</strong><small>Stock count · stock sheet · production worksheet</small></button>`).join('')}</div>`);document.querySelectorAll('[data-strict-division]').forEach(b=>b.onclick=()=>openStock(b.dataset.strictDivision));}
function bindButton(){const b=document.getElementById('divisionSheetsBtn');if(b){b.onclick=openPicker;b.title='Division stock and production sheets';}}
const baseProducts=window.productsPage;
if(typeof baseProducts==='function'){window.productsPage=async function strictDivisionProductsPage(...args){const result=await baseProducts(...args);bindButton();return result;};try{productsPage=window.productsPage}catch{}}
setTimeout(bindButton,0);
window.VUStrictDivisionStock={DIVISIONS,strictDivision:stockSheetDivision,strictProducts,openStock,printStockSheet,openPicker,version:'9.0.54'};
})();