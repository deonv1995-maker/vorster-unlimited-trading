/* V9.0.64 — final Products merge + visible build authority.
   UI/runtime only. Does not modify business data unless the user explicitly runs a merge. */
(function(){
'use strict';
const currentBuild=()=>String(window.VU_BUILD||'V9.0.64');

function applyBuild(){
  const el=document.getElementById('runtimeBuild');
  if(el)el.textContent=currentBuild();
  document.querySelectorAll('[data-vu-build]').forEach(node=>node.textContent=currentBuild());
}

function bindHeaderMerge(){
  const btn=document.getElementById('mergeNativeBtn');
  if(!btn)return;
  btn.onclick=()=>{
    if(typeof window.openNativeProductMerge==='function')window.openNativeProductMerge();
    else alert('Merge products is still loading. Please try again.');
  };
}

function installProductsMergeButton(){
  if(!document.getElementById('main'))return;
  const existing=document.getElementById('vuProductsMergeBtn');
  if(existing){
    existing.onclick=()=>window.openNativeProductMerge?.();
    return;
  }
  const buttons=[...main.querySelectorAll('button')];
  const stock=buttons.find(b=>/^\s*Stock count\s*$/i.test(b.textContent||''));
  const division=buttons.find(b=>/Division sheets/i.test(b.textContent||''));
  const scan=buttons.find(b=>/Scan sheets/i.test(b.textContent||''));
  const host=(stock||division||scan)?.parentElement;
  if(!host)return;
  const btn=document.createElement('button');
  btn.id='vuProductsMergeBtn';
  btn.type='button';
  btn.className='secondary';
  btn.textContent='Merge products';
  btn.style.minHeight='52px';
  btn.onclick=()=>{
    if(typeof window.openNativeProductMerge==='function')window.openNativeProductMerge();
    else alert('Merge products is still loading. Please try again.');
  };
  if(division&&division.parentElement===host)host.insertBefore(btn,division);
  else host.appendChild(btn);
}

const previousProducts=window.productsPage;
if(typeof previousProducts==='function'){
  window.productsPage=async function finalProductsAuthority(...args){
    const result=await previousProducts(...args);
    applyBuild();
    bindHeaderMerge();
    installProductsMergeButton();
    return result;
  };
  try{productsPage=window.productsPage}catch{}
}

applyBuild();
bindHeaderMerge();
if(String(window.route||'').toLowerCase()==='products')setTimeout(installProductsMergeButton,0);
window.VUProductMergeVersionAuthority={version:'9.0.64',applyBuild,installProductsMergeButton};
})();
