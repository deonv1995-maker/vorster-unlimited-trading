/* V9.0.38 — keep Products search/actions inside the mobile viewport. */
(function(){
'use strict';
if(document.getElementById('vuProductsMobileToolbarFix'))return;
const style=document.createElement('style');
style.id='vuProductsMobileToolbarFix';
style.textContent=`
  /* Products page mobile containment */
  #main{max-width:100%;overflow-x:hidden}
  .product-toolbar-row,
  .products-toolbar,
  .product-actions,
  .products-actions{
    width:100%;
    max-width:100%;
    min-width:0;
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    align-items:stretch;
    overflow:visible;
  }
  .product-toolbar-row > *,
  .products-toolbar > *,
  .product-actions > *,
  .products-actions > *{
    min-width:0;
    max-width:100%;
  }
  .product-toolbar-row input[type="search"],
  .product-toolbar-row input.search,
  .product-toolbar-row .search,
  .products-toolbar input[type="search"],
  .products-toolbar .search{
    flex:1 0 100%;
    width:100%!important;
    max-width:100%!important;
    box-sizing:border-box;
  }
  .product-toolbar-row button,
  .products-toolbar button,
  .product-actions button,
  .products-actions button{
    flex:1 1 calc(50% - 5px);
    width:auto;
    max-width:100%;
    white-space:normal;
    overflow-wrap:anywhere;
  }
  @media(max-width:520px){
    .product-toolbar-row,
    .products-toolbar,
    .product-actions,
    .products-actions{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
      width:100%!important;
      max-width:100%!important;
      overflow:visible!important;
    }
    .product-toolbar-row > input,
    .product-toolbar-row > .search,
    .products-toolbar > input,
    .products-toolbar > .search{
      grid-column:1 / -1!important;
      width:100%!important;
      min-width:0!important;
    }
    .product-toolbar-row button,
    .products-toolbar button,
    .product-actions button,
    .products-actions button{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      margin:0!important;
    }
    /* Filters can wrap naturally beneath the action grid without forcing horizontal scroll. */
    .filters,
    .product-filters,
    .status-tabs{
      max-width:100%;
      min-width:0;
      flex-wrap:wrap;
      overflow:visible;
    }
  }
`;
document.head.appendChild(style);
})();
