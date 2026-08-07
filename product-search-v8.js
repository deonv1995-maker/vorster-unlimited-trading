/* Version 8.5.4 product search.
   Android-safe search: build the searchable rows once when Products opens.
   Typing only toggles existing rows; no page/result DOM is rebuilt while the input has focus. */
const VU_PRODUCT_SEARCH_VERSION='8.5.4';

const vuProductSearchBase=productsPage;
let vuProductSearchItems=[];
let vuProductSearchView='active';

function vuPSNormaliseCategory(product){
  return String(product.category||'Uncategorised').trim()||'Uncategorised';
}
function vuPSMatchesView(product,view){
  if(view==='all')return true;
  if(view==='archived')return product.isActive===false;
  return product.isActive!==false;
}
function vuPSSearchText(product){
  return `${product.code||''} ${product.name||''} ${vuPSNormaliseCategory(product)} ${product.description||''}`.toLowerCase();
}
function vuPSStaticCard(product){
  const image=product.image?`<img src="${product.image}" alt="${esc(product.name)}">`:`<span>▦</span>`;
  return `<button class="compact-product-card vu-static-search-card ${product.isActive===false?'archived':''}" type="button"
    data-vu-search-product="${product.id}"
    data-vu-code="${esc(String(product.code||'').toLowerCase())}"
    data-vu-search="${esc(vuPSSearchText(product))}">
      <div class="compact-product-image">${image}</div>
      <div class="compact-product-info">
        <strong>${esc(product.code)}</strong>
        <span>${esc(product.name)}</span>
        <small>${esc(vuPSNormaliseCategory(product))} · ${money(product.price)} ex VAT</small>
      </div>
    </button>`;
}

function vuPSSetNormalContentVisible(visible){
  const toolbar=document.querySelector('.product-browser-toolbar');
  const searchHost=document.getElementById('vuProductStaticSearch');
  [...main.children].forEach(child=>{
    if(child===toolbar||child===searchHost||child.classList.contains('fab'))return;
    if(visible){
      if(child.dataset.vuOriginalDisplay!==undefined){
        child.style.display=child.dataset.vuOriginalDisplay;
        delete child.dataset.vuOriginalDisplay;
      }
    }else{
      if(child.dataset.vuOriginalDisplay===undefined)child.dataset.vuOriginalDisplay=child.style.display||'';
      child.style.display='none';
    }
  });
}

function vuPSFilterStaticRows(value){
  const inputText=String(value||'').trim().toLowerCase();
  const host=document.getElementById('vuProductStaticSearch');
  if(!host)return;

  if(!inputText){
    host.hidden=true;
    vuPSSetNormalContentVisible(true);
    return;
  }

  vuPSSetNormalContentVisible(false);
  host.hidden=false;
  const words=inputText.split(/\s+/).filter(Boolean);
  const rows=[...host.querySelectorAll('[data-vu-search-product]')];
  let count=0;

  rows.forEach(row=>{
    const haystack=row.dataset.vuSearch||'';
    const match=words.every(word=>haystack.includes(word));
    row.hidden=!match;
    if(match)count++;
  });

  /* Rank exact and code-prefix matches without recreating any elements. */
  rows.filter(row=>!row.hidden).sort((a,b)=>{
    const ac=a.dataset.vuCode||'';
    const bc=b.dataset.vuCode||'';
    const ar=ac===inputText?0:ac.startsWith(inputText)?1:2;
    const br=bc===inputText?0:bc.startsWith(inputText)?1:2;
    return ar-br||ac.localeCompare(bc);
  }).forEach(row=>row.parentElement?.appendChild(row));

  const countNode=document.getElementById('vuProductSearchCount');
  if(countNode)countNode.textContent=`${count} product${count===1?'':'s'} found`;
  const empty=document.getElementById('vuProductSearchEmpty');
  if(empty)empty.hidden=count!==0;
}

function vuPSBuildStaticIndex(){
  document.getElementById('vuProductStaticSearch')?.remove();
  const toolbar=document.querySelector('.product-browser-toolbar');
  if(!toolbar)return;

  const visibleItems=vuProductSearchItems.filter(product=>vuPSMatchesView(product,vuProductSearchView));
  const host=document.createElement('section');
  host.id='vuProductStaticSearch';
  host.className='vu-product-live-results';
  host.hidden=true;
  host.innerHTML=`
    <div class="section-head"><div><h2>Search results</h2><p id="vuProductSearchCount" class="muted">0 products found</p></div></div>
    <div class="compact-product-grid vu-live-search-grid">
      ${visibleItems.map(vuPSStaticCard).join('')}
      <div id="vuProductSearchEmpty" class="empty" hidden>No products found.</div>
    </div>`;
  toolbar.insertAdjacentElement('afterend',host);

  host.querySelectorAll('[data-vu-search-product]').forEach(button=>{
    button.addEventListener('click',()=>showProductForm(button.dataset.vuSearchProduct));
  });
}

async function vuProductsPageStaticSearch(filter='',view='active',category=''){
  vuProductSearchView=view;
  vuProductSearchItems=await getAll('products');

  await vuProductSearchBase(filter,view,category);
  vuPSBuildStaticIndex();

  const input=document.getElementById('productSearch');
  if(!input)return;

  input.autocomplete='off';
  input.setAttribute('autocorrect','off');
  input.setAttribute('autocapitalize','off');
  input.setAttribute('spellcheck','false');
  input.setAttribute('enterkeyhint','search');

  /* No async work, no innerHTML and no productsPage call while typing. */
  input.oninput=event=>{
    vuPSFilterStaticRows(event.currentTarget.value);
  };

  if(input.value)vuPSFilterStaticRows(input.value);
}

productsPage=vuProductsPageStaticSearch;
window.productsPage=productsPage;
