/* Version 8.5.3 product search.
   The search input is never replaced while typing.
   Only a results container below the toolbar is updated, keeping Android keyboard focus stable. */
const VU_PRODUCT_SEARCH_VERSION='8.5.3';

const vuProductSearchBase=productsPage;
let vuProductSearchItems=[];
let vuProductSearchView='active';
let vuProductSearchCategory='';

function vuPSNormaliseCategory(product){
  return String(product.category||'Uncategorised').trim()||'Uncategorised';
}
function vuPSMatchesView(product,view){
  if(view==='all')return true;
  if(view==='archived')return product.isActive===false;
  return product.isActive!==false;
}
function vuPSResultHtml(product){
  const image=product.image?`<img src="${product.image}" alt="${esc(product.name)}">`:`<span>▦</span>`;
  return `<button class="compact-product-card vu-live-search-card ${product.isActive===false?'archived':''}" type="button" data-vu-search-product="${product.id}">
    <div class="compact-product-image">${image}</div>
    <div class="compact-product-info">
      <strong>${esc(product.code)}</strong>
      <span>${esc(product.name)}</span>
      <small>${esc(vuPSNormaliseCategory(product))} · ${money(product.price)} ex VAT</small>
    </div>
  </button>`;
}
function vuPSHideNormalContent(hidden){
  const toolbar=document.querySelector('.product-browser-toolbar');
  [...main.children].forEach(child=>{
    if(child===toolbar||child.id==='vuProductLiveResults'||child.classList.contains('fab'))return;
    if(hidden){
      if(!child.dataset.vuSearchDisplay)child.dataset.vuSearchDisplay=child.style.display||'';
      child.style.display='none';
    }else{
      child.style.display=child.dataset.vuSearchDisplay||'';
      delete child.dataset.vuSearchDisplay;
    }
  });
}
function vuPSRender(query){
  const text=String(query||'').trim().toLowerCase();
  let host=document.getElementById('vuProductLiveResults');
  if(!text){
    if(host)host.remove();
    vuPSHideNormalContent(false);
    return;
  }

  vuPSHideNormalContent(true);
  if(!host){
    host=document.createElement('section');
    host.id='vuProductLiveResults';
    host.className='vu-product-live-results';
    const toolbar=document.querySelector('.product-browser-toolbar');
    toolbar?.insertAdjacentElement('afterend',host);
  }

  const words=text.split(/\s+/).filter(Boolean);
  const matches=vuProductSearchItems
    .filter(product=>vuPSMatchesView(product,vuProductSearchView))
    .filter(product=>{
      const haystack=`${product.code||''} ${product.name||''} ${vuPSNormaliseCategory(product)} ${product.description||''}`.toLowerCase();
      return words.every(word=>haystack.includes(word));
    })
    .sort((a,b)=>{
      const ac=String(a.code||'').toLowerCase();
      const bc=String(b.code||'').toLowerCase();
      const exactA=ac===text?0:ac.startsWith(text)?1:2;
      const exactB=bc===text?0:bc.startsWith(text)?1:2;
      return exactA-exactB||ac.localeCompare(bc);
    });

  host.innerHTML=`
    <div class="section-head"><div><h2>Search results</h2><p class="muted">${matches.length} product${matches.length===1?'':'s'} found</p></div></div>
    <div class="compact-product-grid vu-live-search-grid">
      ${matches.length?matches.map(vuPSResultHtml).join(''):'<div class="empty">No products found.</div>'}
    </div>`;
  host.querySelectorAll('[data-vu-search-product]').forEach(button=>{
    button.onclick=()=>showProductForm(button.dataset.vuSearchProduct);
  });
}

async function vuProductsPageLiveSearch(filter='',view='active',category=''){
  vuProductSearchView=view;
  vuProductSearchCategory=category;
  vuProductSearchItems=await getAll('products');

  /* Build the normal Products page once. */
  await vuProductSearchBase(filter,view,category);

  const input=document.getElementById('productSearch');
  if(!input)return;
  input.setAttribute('autocomplete','off');
  input.setAttribute('autocorrect','off');
  input.setAttribute('autocapitalize','off');
  input.setAttribute('spellcheck','false');
  input.setAttribute('enterkeyhint','search');

  /* Critical: no productsPage() call here. The input remains the same DOM element. */
  input.oninput=event=>{
    pageTitle.textContent='Products';
    backBtn.classList.add('hidden');
    vuPSRender(event.currentTarget.value);
  };

  /* Preserve any initial filter supplied by another flow. */
  if(input.value)vuPSRender(input.value);
}

productsPage=vuProductsPageLiveSearch;
window.productsPage=productsPage;
