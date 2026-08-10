/* V9.0.34 — mandatory product setup queue.
   Keeps existing product records and save flow; adds system-critical completeness validation
   and guides incomplete active products through the existing Edit Product form one by one. */
(function(){
'use strict';

const DIVISIONS=new Set(['Casting','Packing','Resin']);
const STAGES=new Set(['Raw component','Intermediate','Finished sale product']);
const norm=v=>String(v??'').trim();
const methodsOf=p=>String(p?.manufacturingMethods||'').split('|').map(x=>x.trim()).filter(Boolean);
const stockDivisionsOf=p=>String(p?.divisionStockVisibility||'').split('|').map(x=>x.trim()).filter(Boolean);
const componentLines=p=>String(p?.manufacturingComponentsSpec||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean);
let queueOpening=false;
let queueActiveProductId='';

function componentModeOf(p){
  if(p?.manufacturingComponentMode==='none'||p?.manufacturingComponentMode==='uses')return p.manufacturingComponentMode;
  return componentLines(p).length?'uses':'';
}

function parseComponentLine(line){
  const parts=String(line||'').split(':');
  const code=norm(parts[0]);
  const qty=Number(parts[1]);
  return {code,qty};
}

function baseMissing(p){
  const missing=[];
  if(!norm(p?.code))missing.push('Product code');
  if(!norm(p?.name))missing.push('Product name');
  if(!norm(p?.category))missing.push('Category');
  if(p?.price===''||p?.price===null||p?.price===undefined||!Number.isFinite(Number(p.price))||Number(p.price)<0)missing.push('Valid price');

  const primary=norm(p?.primaryDivision);
  const methods=methodsOf(p);
  if(!DIVISIONS.has(primary))missing.push('Primary division');
  if(!methods.length||methods.some(x=>!DIVISIONS.has(x)))missing.push('Allowed production method');
  else if(primary&&!methods.includes(primary))missing.push('Primary division must be an allowed method');

  if(!STAGES.has(norm(p?.inventoryStage)))missing.push('Inventory stage');
  const worksheet=norm(p?.worksheetDivision);
  if(worksheet&&!DIVISIONS.has(worksheet))missing.push('Valid worksheet division');
  const visible=stockDivisionsOf(p);
  if(visible.some(x=>!DIVISIONS.has(x)))missing.push('Valid stock-sheet division');

  const componentMode=componentModeOf(p);
  if(!componentMode)missing.push('Component dependency decision');
  if(componentMode==='uses'&&!componentLines(p).length)missing.push('Components consumed');
  return missing;
}

function validateComponents(p,products){
  const errors=[];
  if(componentModeOf(p)!=='uses')return errors;
  const byCode=new Map((products||[]).map(x=>[norm(x.code).toLowerCase(),x]));
  for(const line of componentLines(p)){
    const {code,qty}=parseComponentLine(line);
    if(!code||!Number.isFinite(qty)||qty<=0){errors.push(`Invalid component entry: ${line}`);continue;}
    if(code.toLowerCase()===norm(p.code).toLowerCase()){errors.push(`${code} cannot consume itself`);continue;}
    if(!byCode.has(code.toLowerCase()))errors.push(`Component ${code} is not in the product database`);
  }
  return errors;
}

function missingFor(p,products){
  return [...baseMissing(p),...validateComponents(p,products)];
}

async function incompleteProducts(){
  const products=(await getAll('products')).filter(p=>p.isActive!==false);
  return products
    .map(p=>({product:p,missing:missingFor(p,products)}))
    .filter(x=>x.missing.length)
    .sort((a,b)=>String(a.product.code||'').localeCompare(String(b.product.code||''))||String(a.product.name||'').localeCompare(String(b.product.name||'')));
}

function ensureStyles(){
  if(document.getElementById('productSetupQueueStyles'))return;
  const style=document.createElement('style');
  style.id='productSetupQueueStyles';
  style.textContent=`
    .product-setup-banner{padding:12px 14px;margin:0 0 14px;border:2px solid var(--border);border-radius:16px;background:var(--surface-2)}
    .product-setup-banner strong{display:block;font-size:1rem;margin-bottom:4px}.product-setup-banner small{display:block;color:var(--muted)}
    .product-setup-missing{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.product-setup-missing span{padding:5px 8px;border:1px solid var(--border);border-radius:999px;font-size:.78rem;font-weight:700}
    .product-setup-progress{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}
    .component-decision{margin:12px 0}.component-decision small{display:block;color:var(--muted);margin-top:4px}
    .product-setup-status{margin:10px 0;padding:9px 11px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);font-size:.85rem}
    dialog[data-product-setup-locked="1"] .close-btn{opacity:.35;pointer-events:none}
    .setup-field-error{outline:2px solid currentColor;outline-offset:2px}
  `;
  document.head.appendChild(style);
}

function formSnapshot(form,stored={}){
  const data=Object.fromEntries(new FormData(form));
  const methods=[...form.querySelectorAll('[data-method]:checked')].map(x=>x.dataset.method);
  const visibility=[...form.querySelectorAll('[data-stock-division]:checked')].map(x=>x.dataset.stockDivision);
  return {
    ...stored,...data,
    price:data.price===''?'':Number(data.price),
    manufacturingMethods:methods.join('|')||data.manufacturingMethods||'',
    divisionStockVisibility:visibility.join('|')||data.divisionStockVisibility||'',
    manufacturingComponentMode:data.manufacturingComponentMode||'',
    manufacturingComponentsSpec:data.manufacturingComponentsSpec||''
  };
}

function addComponentDecision(form,stored){
  const manufacturing=form.querySelector('[data-manufacturing-classification]');
  if(!manufacturing||form.querySelector('[data-component-decision]'))return;
  const spec=form.querySelector('[name="manufacturingComponentsSpec"]');
  if(!spec)return;
  const mode=componentModeOf(stored);
  const wrap=document.createElement('label');
  wrap.dataset.componentDecision='1';
  wrap.className='component-decision';
  wrap.innerHTML=`Does this product consume another manufactured product?
    <select name="manufacturingComponentMode" required>
      <option value="" ${!mode?'selected':''}>Select…</option>
      <option value="none" ${mode==='none'?'selected':''}>No — it is manufactured directly</option>
      <option value="uses" ${mode==='uses'?'selected':''}>Yes — it consumes manufactured components</option>
    </select>
    <small>This explicit decision lets the production planner distinguish standalone products from dependent products.</small>`;
  spec.closest('label')?.before(wrap);
  const select=wrap.querySelector('select');
  const sync=()=>{
    const uses=select.value==='uses';
    spec.required=uses;
    spec.closest('label').style.display=uses?'':'none';
    if(!uses&&select.value==='none')spec.value='';
  };
  select.addEventListener('change',sync);sync();
}

function markLikelyFields(form,missing){
  form.querySelectorAll('.setup-field-error').forEach(x=>x.classList.remove('setup-field-error'));
  const mappings=[
    ['Product code','[name="code"]'],['Product name','[name="name"]'],['Category','[name="category"]'],['Valid price','[name="price"]'],
    ['Primary division','#primaryDivision'],['Allowed production method','[data-method]'],['Primary division must be an allowed method','[data-method]'],
    ['Inventory stage','[name="inventoryStage"]'],['Valid worksheet division','#worksheetDivision'],['Valid stock-sheet division','[data-stock-division]'],
    ['Component dependency decision','[name="manufacturingComponentMode"]'],['Components consumed','[name="manufacturingComponentsSpec"]']
  ];
  mappings.forEach(([label,selector])=>{if(missing.some(x=>x===label||x.startsWith('Invalid component')||x.startsWith('Component '))){const el=form.querySelector(selector);el?.classList.add('setup-field-error')}});
}

function lockQueueDialog(locked){
  const dialog=document.getElementById('dialog');
  if(!dialog)return;
  if(locked)dialog.dataset.productSetupLocked='1';else delete dialog.dataset.productSetupLocked;
  const close=dialog.querySelector('.close-btn');
  if(close&&locked){close.removeAttribute('onclick');close.onclick=e=>{e.preventDefault();notify('Complete and save this product to continue the setup queue.');};}
}

async function decorateProductForm(id,queueContext=null){
  const form=document.getElementById('productForm');
  if(!form)return;
  const stored=id?await getOne('products',id):{};
  addComponentDecision(form,stored||{});
  const products=await getAll('products');
  const current=stored||{};
  const initialMissing=missingFor(current,products);

  if(queueContext){
    const banner=document.createElement('div');
    banner.className='product-setup-banner';
    banner.innerHTML=`<div class="product-setup-progress"><strong>Product setup required</strong><b>${queueContext.position} of ${queueContext.total}</b></div><small>Complete the system information below. This product cannot be skipped while it is incomplete.</small><div class="product-setup-missing">${initialMissing.map(x=>`<span>${String(x).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</span>`).join('')}</div>`;
    form.prepend(banner);
    lockQueueDialog(true);
    queueActiveProductId=id;
  }

  form.addEventListener('submit',async event=>{
    const snapshot=formSnapshot(form,stored||{});
    const allProducts=await getAll('products');
    if(!id&&!allProducts.some(p=>String(p.id)===String(snapshot.id)))allProducts.push(snapshot);
    const errors=missingFor(snapshot,allProducts);
    if(errors.length){
      event.preventDefault();event.stopImmediatePropagation();
      markLikelyFields(form,errors);
      const banner=form.querySelector('.product-setup-banner');
      if(banner){const box=banner.querySelector('.product-setup-missing');if(box)box.innerHTML=errors.map(x=>`<span>${String(x).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</span>`).join('');}
      notify(`Complete ${errors.length} required product ${errors.length===1?'field':'fields'}`);
      return;
    }
    lockQueueDialog(false);
    queueActiveProductId='';
  },true);
}

async function openNextIncomplete(){
  if(queueOpening||typeof route==='undefined'||route!=='products')return;
  if(document.getElementById('dialog')?.open)return;
  queueOpening=true;
  try{
    const queue=await incompleteProducts();
    renderStatus(queue.length);
    if(!queue.length)return;
    const first=queue[0];
    await window.showProductForm(first.product.id,{productSetupQueue:true,position:1,total:queue.length});
  }finally{queueOpening=false;}
}

function renderStatus(count){
  const toolbar=document.querySelector('.product-toolbar-row');
  if(!toolbar)return;
  let status=document.getElementById('productSetupStatus');
  if(!status){status=document.createElement('div');status.id='productSetupStatus';status.className='product-setup-status';toolbar.insertAdjacentElement('afterend',status);}
  status.textContent=count?`${count} active product${count===1?'':'s'} still need system setup. The setup queue will open them one by one.`:'Product system setup complete — all active products have the required internal classification.';
}

ensureStyles();

const baseShowProductForm=window.showProductForm||showProductForm;
window.showProductForm=async function productSetupAwareForm(id='',context={}){
  await baseShowProductForm(id);
  const isQueue=Boolean(context?.productSetupQueue);
  await decorateProductForm(id,isQueue?{position:context.position||1,total:context.total||1}:null);
};
try{showProductForm=window.showProductForm}catch{}

const baseProductsPage=window.productsPage||productsPage;
window.productsPage=async function productsPageWithSetupQueue(...args){
  await baseProductsPage(...args);
  if(typeof route!=='undefined'&&route==='products')setTimeout(()=>openNextIncomplete(),120);
};
try{productsPage=window.productsPage}catch{}

/* Existing backdrop click listener closes dialogs. Stop that only while the mandatory queue is active. */
const dialog=document.getElementById('dialog');
if(dialog){
  dialog.addEventListener('click',event=>{
    if(dialog.dataset.productSetupLocked==='1'&&event.target===dialog){event.preventDefault();event.stopImmediatePropagation();notify('Complete and save this product to continue the setup queue.');}
  },true);
  dialog.addEventListener('cancel',event=>{
    if(dialog.dataset.productSetupLocked==='1'){event.preventDefault();notify('Complete and save this product to continue the setup queue.');}
  });
}

window.VUProductSetupQueue={incompleteProducts,missingFor,openNextIncomplete};
})();