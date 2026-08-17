/* Factory OS 2.10.19 — management authority for correcting existing product manufacturing divisions. */
(function(){
'use strict';
if(window.VUFactoryProductDivisionEditor)return;
const DIVISIONS=['Casting','Packing','Resin'];
const safe=v=>window.esc?window.esc(v):String(v??'');
const code=v=>String(v||'').trim().toUpperCase();
const role=()=>window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||'Management';

async function saveDivision(product,newDivision){
  if(role()!=='Management')throw new Error('Only Management can change a product manufacturing division.');
  if(!DIVISIONS.includes(newDivision))throw new Error('Choose Casting, Packing or Resin.');
  const now=new Date().toISOString();
  const next={
    ...product,
    primaryDivision:newDivision,
    worksheetDivision:newDivision,
    divisionStockVisibility:newDivision,
    manufacturingMethods:newDivision,
    updatedAt:now
  };
  await putOne('products',next);
  if(window.VUSharedAccess?.membership?.()&&navigator.onLine){
    try{await VUSharedAccess.sync({reason:'product-manufacturing-division-change'});}catch(e){console.warn('Division change saved locally; sync will retry.',e);}
  }
  return next;
}

async function edit(productId,back){
  if(role()!=='Management')throw new Error('Only Management can change manufacturing divisions.');
  const product=await getOne('products',productId);
  if(!product)throw new Error('Product not found.');
  const current=String(product.worksheetDivision||product.primaryDivision||'');
  openDialog(`<div class="dialog-head"><div><div class="step-label">MANUFACTURING CLASSIFICATION</div><h2>${safe(product.code)} · ${safe(product.name)}</h2></div><button class="close-btn" id="fosDivisionClose" type="button">×</button></div><form id="fosDivisionForm" class="card"><p class="muted">This controls which manufacturing team makes the product and where its Raw stock is shown. Existing stock quantities are not changed.</p><label class="fos-division-editor-field"><span>Manufacturing division</span><select id="fosDivisionSelect" required><option value="">Choose division</option>${DIVISIONS.map(d=>`<option value="${d}" ${current===d?'selected':''}>${d}</option>`).join('')}</select></label><button class="primary" type="submit">Save manufacturing division</button></form>`);
  document.getElementById('fosDivisionClose').onclick=closeDialog;
  document.getElementById('fosDivisionForm').onsubmit=async e=>{
    e.preventDefault();
    const btn=e.currentTarget.querySelector('button[type="submit"]'),division=document.getElementById('fosDivisionSelect').value;
    btn.disabled=true;
    try{
      await saveDivision(product,division);
      closeDialog();
      notify(`${product.code} moved to ${division}`);
      if(typeof back==='function')await back();
    }catch(err){btn.disabled=false;alert(err?.message||String(err));}
  };
}

function addDetailButton(productId,back){
  if(role()!=='Management'||document.getElementById('fosChangeProductDivision'))return;
  const count=document.getElementById('fosCountProduct');
  if(!count)return;
  const button=document.createElement('button');
  button.id='fosChangeProductDivision';button.type='button';button.className='secondary';button.textContent='Change manufacturing division';button.style.width='100%';button.style.marginTop='8px';
  button.onclick=()=>edit(productId,back).catch(e=>alert(e?.message||String(e)));
  count.insertAdjacentElement('afterend',button);
}

function patchStockWorkspace(){
  const ws=window.VUFactoryStockWorkspace;
  if(!ws||ws.__divisionEditorPatched)return;
  ws.__divisionEditorPatched=true;
  const originalOpenProduct=ws.openProduct.bind(ws),originalOpen=ws.open.bind(ws);
  ws.openProduct=async function(productId,back){await originalOpenProduct(productId,back);addDetailButton(productId,back);};
  ws.open=async function(...args){
    await originalOpen(...args);
    document.querySelectorAll('[data-stock-product]').forEach(btn=>{
      const productId=btn.dataset.stockProduct;
      btn.onclick=()=>ws.openProduct(productId,ws.open).catch(e=>alert(e?.message||String(e)));
    });
  };
}

async function repairKnownMisclassification(){
  const products=await getAll('products');
  const product=products.find(p=>code(p.code)==='DKS007/B');
  if(!product)return false;
  const current=String(product.worksheetDivision||product.primaryDivision||'').trim();
  if(current!=='Packing')return false;
  await saveDivision(product,'Resin');
  return true;
}

async function init(){
  patchStockWorkspace();
  if(role()==='Management'){
    try{const fixed=await repairKnownMisclassification();if(fixed)console.info('Corrected DKS007/B manufacturing division to Resin.');}catch(e){console.warn('Product division correction will retry when data is available.',e);}
  }
}

function style(){if(document.getElementById('fosDivisionEditorStyle'))return;const s=document.createElement('style');s.id='fosDivisionEditorStyle';s.textContent='.fos-division-editor-field{display:grid;gap:7px;margin:10px 0 14px}.fos-division-editor-field span{font-weight:700}.fos-division-editor-field select{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);padding:13px;font:inherit;font-size:16px}';document.head.appendChild(s)}
style();
window.VUFactoryProductDivisionEditor={version:'2.10.19',DIVISIONS,saveDivision,edit,patchStockWorkspace,repairKnownMisclassification,init};
})();