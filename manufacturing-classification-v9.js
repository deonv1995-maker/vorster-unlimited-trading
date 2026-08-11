/* V9.0.63 — single manufacturing-classification authority.
   Owns product classification fields and the Division Sheets entry point only.
   Stock sheets are owned by strict-division-stock-v9.js; production worksheets are owned by strict-division-worksheets-v9.js.
   UI-only refresh: full-row mobile choices with unmistakable selected states.
   No business data is migrated or rewritten by this module. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin','Painting'];
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const methodsOf=p=>String(p?.manufacturingMethods||'').split('|').map(x=>x.trim()).filter(Boolean);
const visibleIn=p=>String(p?.divisionStockVisibility||'').split('|').map(x=>x.trim()).filter(Boolean);
const componentsOf=p=>String(p?.manufacturingComponentsSpec||'').split(/\n|,/).map(line=>{const [code,qty]=line.split(':').map(x=>String(x||'').trim());return code?{code,qty:Math.max(0,Number(qty||1))}:null}).filter(Boolean);
const divisionForWorksheet=p=>String(p?.worksheetDivision||p?.primaryDivision||'').trim();

function ensureChoiceStyles(){
  if(document.getElementById('vuManufacturingChoiceStyles'))return;
  const style=document.createElement('style');
  style.id='vuManufacturingChoiceStyles';
  style.textContent=`
    .manufacturing-classification .manufacturing-field{margin-top:14px}
    .manufacturing-classification .manufacturing-field>span{display:block;font-weight:800;font-size:1rem;margin-bottom:3px}
    .manufacturing-classification .manufacturing-field>small{display:block;opacity:.72;line-height:1.35;margin-bottom:10px}
    .manufacturing-classification .manufacturing-checks{display:grid;gap:8px;margin-top:8px}
    .manufacturing-classification .vu-division-choice{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px;width:100%;box-sizing:border-box;padding:13px 14px;margin:0!important;border:1px solid rgba(150,180,165,.28);border-radius:14px;background:rgba(255,255,255,.025);cursor:pointer;min-height:52px}
    .manufacturing-classification .vu-division-choice .vu-choice-text{display:flex;flex-direction:column;gap:2px;min-width:0}
    .manufacturing-classification .vu-division-choice .vu-choice-name{font-weight:800;font-size:1rem;line-height:1.2}
    .manufacturing-classification .vu-division-choice .vu-choice-status{font-size:.78rem;opacity:.58}
    .manufacturing-classification .vu-division-choice input{order:2;flex:0 0 auto;width:24px!important;height:24px!important;margin:0!important;accent-color:#82b49e}
    .manufacturing-classification .vu-division-choice.is-selected{border-color:#82b49e;background:rgba(130,180,158,.16);box-shadow:inset 0 0 0 1px rgba(130,180,158,.25)}
    .manufacturing-classification .vu-division-choice.is-selected .vu-choice-status{opacity:1;font-weight:700}
    .manufacturing-classification .vu-division-choice.is-selected .vu-choice-name{color:#9bc8b4}
    .manufacturing-classification .vu-stock-choice.is-selected{background:rgba(130,180,158,.20)}
  `;
  document.head.appendChild(style);
}

const choiceRow=(type,attr,value,checked,label,extraClass='')=>`<label class="vu-division-choice ${extraClass} ${checked?'is-selected':''}"><span class="vu-choice-text"><span class="vu-choice-name">${safe(label)}</span><span class="vu-choice-status">${checked?'Selected':'Tap to select'}</span></span><input type="${type}" ${type==='radio'?'name="vuStockDivisionChoice"':''} ${attr}="${safe(value)}" ${checked?'checked':''}></label>`;

const baseShow=window.showProductForm;
if(typeof baseShow==='function'){
  window.showProductForm=async function manufacturingClassificationForm(id=''){
    await baseShow(id);
    const form=document.getElementById('productForm');
    if(!form||form.querySelector('[data-manufacturing-classification]'))return;
    ensureChoiceStyles();
    const product=id?await getOne('products',id):{};
    const methods=methodsOf(product),visible=visibleIn(product),primary=String(product?.primaryDivision||''),worksheet=String(product?.worksheetDivision||''),stage=String(product?.inventoryStage||'Finished sale product');
    const block=document.createElement('section');
    block.dataset.manufacturingClassification='1';block.className='manufacturing-classification';
    block.innerHTML=`<div class="manufacturing-title"><strong>Manufacturing classification</strong><small>One production worksheet division and one stock-sheet route; allowed methods only describe capability.</small></div>
      <label>Primary / default division<select name="primaryDivision" id="primaryDivision"><option value="">Unclassified</option>${DIVISIONS.map(d=>`<option value="${d}" ${primary===d?'selected':''}>${d}</option>`).join('')}</select></label>
      <label>Worksheet division<select name="worksheetDivision" id="worksheetDivision"><option value="">Use primary division</option>${DIVISIONS.map(d=>`<option value="${d}" ${worksheet===d?'selected':''}>${d}</option>`).join('')}</select></label>
      <div class="manufacturing-field"><span>Allowed production methods</span><small>Capability only — this does not decide which worksheet prints the product.</small><div class="manufacturing-checks">${DIVISIONS.map(d=>choiceRow('checkbox','data-method',d,methods.includes(d),d,'vu-method-choice')).join('')}</div></div>
      <input type="hidden" name="manufacturingMethods" id="manufacturingMethods" value="${safe(methods.join('|'))}">
      <label>Inventory stage<select name="inventoryStage"><option ${stage==='Raw component'?'selected':''}>Raw component</option><option ${stage==='Intermediate'?'selected':''}>Intermediate</option><option ${stage==='Finished sale product'?'selected':''}>Finished sale product</option></select></label>
      <div class="manufacturing-field"><span>Show on stock sheets</span><small>Select one division. If blank, the strict stock system falls back to Primary division.</small><div class="manufacturing-checks">${DIVISIONS.map(d=>choiceRow('radio','data-stock-division',d,visible.length===1&&visible[0]===d,d,'vu-stock-choice')).join('')}${choiceRow('radio','data-stock-division','',visible.length!==1,'Use primary / unclassified','vu-stock-choice')}</div></div>
      <input type="hidden" name="divisionStockVisibility" id="divisionStockVisibility" value="${safe(visible.length===1?visible[0]:'')}">
      <label>Components consumed to make this product<textarea name="manufacturingComponentsSpec" placeholder="One per line: PRODUCTCODE:QTY\nExample: BASE001:1">${safe(product?.manufacturingComponentsSpec||'')}</textarea><small>Use for Resin products or any item that consumes another manufactured item.</small></label>`;
    const submit=form.querySelector('button[type="submit"]');if(submit)form.insertBefore(block,submit);else form.appendChild(block);
    const sync=()=>{
      const mh=form.querySelector('#manufacturingMethods');if(mh)mh.value=[...form.querySelectorAll('[data-method]:checked')].map(x=>x.dataset.method).join('|');
      const sh=form.querySelector('#divisionStockVisibility');if(sh)sh.value=form.querySelector('[data-stock-division]:checked')?.dataset.stockDivision||'';
      form.querySelectorAll('.vu-division-choice').forEach(row=>{
        const input=row.querySelector('input');const selected=!!input?.checked;
        row.classList.toggle('is-selected',selected);
        const status=row.querySelector('.vu-choice-status');if(status)status.textContent=selected?'Selected':'Tap to select';
      });
    };
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
window.VUManufacturingDivisions={DIVISIONS,methodsOf,visibleIn,componentsOf,divisionForWorksheet,version:'9.0.63'};
window.VUManufacturingClassification={DIVISIONS,bindDivisionButton,version:'9.0.63'};
})();