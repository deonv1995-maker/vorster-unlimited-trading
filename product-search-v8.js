/* Version 8.5.2 product search UX fix.
   Prevents the Products page from rebuilding on every keystroke.
   Search is debounced and focus/caret are restored after filtering. */
const VU_PRODUCT_SEARCH_VERSION='8.5.2';

const vuProductSearchBase=productsPage;
let vuProductSearchTimer=null;
let vuProductSearchPending='';
let vuProductSearchView='active';
let vuProductSearchCategory='';
let vuProductSearchFocused=false;

async function vuProductsPageStableSearch(filter='',view='active',category=''){
  vuProductSearchPending=String(filter||'');
  vuProductSearchView=view;
  vuProductSearchCategory=category;

  await vuProductSearchBase(filter,view,category);

  const input=document.getElementById('productSearch');
  if(!input)return;

  /* Replace the legacy handler that rebuilt the page on every character. */
  input.oninput=event=>{
    const field=event.currentTarget;
    vuProductSearchPending=field.value;
    vuProductSearchFocused=true;
    clearTimeout(vuProductSearchTimer);

    /* Wait until typing pauses briefly before rebuilding the result list. */
    vuProductSearchTimer=setTimeout(async()=>{
      const query=vuProductSearchPending;
      const active=document.activeElement===field;
      const caret=field.selectionStart??query.length;

      pageTitle.textContent='Products';
      backBtn.classList.add('hidden');

      await vuProductsPageStableSearch(query,vuProductSearchView,'');

      const replacement=document.getElementById('productSearch');
      if(replacement&&(active||vuProductSearchFocused)){
        /* requestAnimationFrame keeps focus restoration inside the same visual update. */
        requestAnimationFrame(()=>{
          replacement.focus({preventScroll:true});
          try{replacement.setSelectionRange(Math.min(caret,replacement.value.length),Math.min(caret,replacement.value.length));}catch{}
        });
      }
    },260);
  };

  input.onfocus=()=>{vuProductSearchFocused=true;};
  input.onblur=()=>{
    /* A blur caused by our own controlled rerender should not cancel focus restoration. */
    setTimeout(()=>{
      const current=document.getElementById('productSearch');
      if(current&&document.activeElement!==current)vuProductSearchFocused=false;
    },400);
  };

  /* Clear searches immediately without making the user fight the keyboard. */
  input.setAttribute('autocomplete','off');
  input.setAttribute('autocorrect','off');
  input.setAttribute('autocapitalize','off');
  input.setAttribute('spellcheck','false');
}

productsPage=vuProductsPageStableSearch;
window.productsPage=productsPage;
