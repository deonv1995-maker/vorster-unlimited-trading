/* V9.0.69 — merge duplicate products directly from the mandatory setup queue. */
(function(){
'use strict';
if(window.VUProductSetupMerge)return;

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function ensureStyle(){
  if(document.getElementById('vuProductSetupMergeStyle'))return;
  const style=document.createElement('style');
  style.id='vuProductSetupMergeStyle';
  style.textContent=`
    .product-setup-merge-action{margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
    .product-setup-merge-action button{width:100%;min-height:48px;font-weight:800}
    .product-setup-merge-action small{display:block;margin-top:7px;color:var(--muted);line-height:1.35}
  `;
  document.head.appendChild(style);
}

async function addMergeAction(productId){
  const form=document.getElementById('productForm');
  const banner=form?.querySelector('.product-setup-banner');
  if(!form||!banner||banner.querySelector('[data-setup-merge]'))return;
  const product=await getOne('products',productId);
  if(!product)return;
  const wrap=document.createElement('div');
  wrap.className='product-setup-merge-action';
  wrap.dataset.setupMerge='1';
  wrap.innerHTML=`<button type="button" class="secondary" data-merge-incomplete-product="${esc(product.id)}">⇄ Merge with existing product</button><small>If this imported product is a duplicate, merge it instead of completing all setup fields. The current product will already be selected as the duplicate and the queue will move to the next item after the merge.</small>`;
  banner.appendChild(wrap);
  wrap.querySelector('button').onclick=async()=>{
    if(typeof window.openNativeProductMerge!=='function'){
      alert('The product merge tool is not available. Reopen the app while online and try again.');
      return;
    }
    const dialog=document.getElementById('dialog');
    if(dialog)delete dialog.dataset.productSetupLocked;
    try{
      await window.openNativeProductMerge({sourceId:String(product.id),fromSetupQueue:true});
    }catch(error){
      console.error('Setup queue merge',error);
      alert(error?.message||'The merge screen could not be opened.');
    }
  };
}

ensureStyle();
const base=window.showProductForm;
if(typeof base==='function'){
  window.showProductForm=async function setupMergeAwareProductForm(id='',context={}){
    const result=await base(id,context);
    if(context?.productSetupQueue&&id)await addMergeAction(id);
    return result;
  };
  try{showProductForm=window.showProductForm}catch{}
}
window.VUProductSetupMerge={version:'9.0.69',addMergeAction};
})();
