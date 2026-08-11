/* V9.0.58 — single manufacturing-classification authority.
   Owns product classification fields and the Division Sheets entry point only.
   Stock sheets are owned by strict-division-stock-v9.js; production worksheets are owned by strict-division-worksheets-v9.js.
   No business data is migrated or rewritten by this module. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin','Painting'];
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const methodsOf=p=>String(p?.manufacturingMethods||'').split('|').map(x=>x.trim()).filter(Boolean);
const visibleIn=p=>String(p?.divisionStockVisibility||'').split('|').map(x=>x.trim()).filter(Boolean);
const componentsOf=p=>String(p?.manufacturingComponentsSpec||'').split(/\n|,/).map(line=>{const [code,qty]=line.split(':').map(x=>String(x||'').trim());return code?{code,qty:Math.max(0,Number(qty||1))}:null}).filter(Boolean);
const divisionForWorksheet=p=>String(p?.worksheetDivision||p?.primaryDivision||'').trim();

const baseShow=window.showProductForm;
if(typeof baseShow==='function'){
  window.showProductForm=async function manufacturingClassificationForm(id=''){
    await baseShow(id);
    const form=document.getElementById('productForm');
    if(!form||form.querySelector('[data-manufacturing-classification]'))return;
    const product=id?await getOne('products',id):{};
    const methods=methodsOf(product),visible=visibleIn(product),primary=String(product?.primaryDivision||''),worksheet=String(product?.worksheetDivision||''),stage=String(product?.inventoryStage||'Finished sale product');
    const block=document.createElement('section');
    block.dataset.manufacturingClassification='1';block.className='manufacturing-classification';
    block.innerHTML=`<div class="manufacturing-title"><strong>Manufacturing classification</strong><small>One production worksheet division and one stock-sheet route; allowed methods only describe capability.</small></div>
      <label>Primary / default division<select name="primaryDivision" id="primaryDivision"><option value="">Unclassified</option>${DIVISIONS.map(d=>`<option value="${d}" ${primary===d?'selected':''}>${d}</option>`).join('')}</select></label>
      <label>Worksheet division<select name="worksheetDivision" id="worksheetDivision"><option value="">Use primary division</option>${DIVISIONS.map(d=>`<option value="${d}" ${worksheet===d?'selected':''}>${d}</option>`).join('')}</select></label>
      <div class="manufacturing-field"><span>Allowed production methods</span><small>Capability only — this does not decide which worksheet prints the product.</small><div class="manufacturing-checks">${DIVISIONS.map(d=>`<label><input type="checkbox" data-method="${d}" ${methods.includes(d)?'checked':''}> ${d}</label>`).join('')}</div></div>
      <input type="hidden" name="manufacturingMethods" id="manufacturingMethods" value="${safe(methods.join('|'))}">
      <label>Inventory stage<select name="inventoryStage"><option ${stage==='Raw component'?'selected':''}>Raw component</option><option ${stage==='Intermediate'?'selected':''}>Intermediate</option><option ${stage==='Finished sale product'?'selected':''}>Finished sale product</option></select></label>
      <div class="manufacturing-field"><span>Show on stock sheets</span><small>Select one division. If blank, the strict stock system falls back to Primary division.</small><div class="manufacturing-checks">${DIVISIONS.map(d=>`<label><input type="radio" name="vuStockDivisionChoice" data-stock-division="${d}" ${visible.length===1&&visible[0]===d?'checked':''}> ${d}</label>`).join('')}<label><input type="radio" name="vuStockDivisionChoice" data-stock-division="" ${visible.length!==1?'checked':''}> Use primary / unclassified</label></div></div>
      <input type="hidden" name="divisionStockVisibility" id="divisionStockVisibility" value="${safe(visible.length===1?visible[0]:'')}">
      <label>Components consumed to make this product<textarea name="manufacturingComponentsSpec" placeholder="One per line: PRODUCTCODE:QTY\nExample: BASE001:1">${safe(product?.manufacturingComponentsSpec||'')}</textarea><small>Use for Resin products or any item that consumes another manufactured item.</small></label>`;
    const submit=form.querySelector('button[type="submit"]');if(submit)form.insertBefore(block,submit);else form.appendChild(block);
    const sync=()=>{const mh=form.querySelector('#manufacturingMethods');if(mh)mh.value=[...form.querySelectorAll('[data-method]:checked')].map(x=>x.dataset.method).join('|');const sh=form.querySelector('#divisionStockVisibility');if(sh)sh.value=form.querySelector('[data-stock-division]:checked')?.dataset.stockDivision||''};
    form.querySelectorAll('[data-method],[data-stock-division]').forEach(x=>x.addEventListener('change',sync));sync();
  };
  try{showProductForm=window.showProductForm}catch{}
}

function bindDivisionButton(){
  let button=document.getElementById('divisionSheetsBtn');
  if(!button){
    const toolbar=document.querySelector('.product-toolbar-row,.product-browser-toolbar,.toolbar-stack');
    if(toolbar){button=document.createElement('button');button.id='divisionSheetsBtn';button.type='button';button.className='ghost';button.textContent='Division sheets';toolbar.appendChild(button)}
  }
  if(button)button.onclick=()=>window.VUStrictDivisionStock?.openPicker?.();
}
const baseProducts=window.productsPage;
if(typeof baseProducts==='function'){
  window.productsPage=async function manufacturingAwareProductsPage(...args){const result=await baseProducts(...args);bindDivisionButton();return result};
  try{productsPage=window.productsPage}catch{}
}
window.VUManufacturingDivisions={DIVISIONS,methodsOf,visibleIn,componentsOf,divisionForWorksheet,version:'9.0.58'};
window.VUManufacturingClassification={DIVISIONS,bindDivisionButton,version:'9.0.58'};
})();