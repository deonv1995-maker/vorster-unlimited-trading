/* V9.0.27 Android-safe raw stock search.
   Mirrors the Products search behaviour: build rows once, then only toggle visibility while typing.
   No dialog rebuild, no async DB work and no focus loss on input. */
(function(){
'use strict';
const norm=v=>String(v||'').trim().toLowerCase();
const searchText=p=>`${p.code||''} ${p.name||''} ${p.category||''} ${p.description||''}`.toLowerCase();

window.openStockCountList=async function openStockCountListStatic(){
  const [products,snapshot]=await Promise.all([getAll('products'),inventorySnapshot()]);
  const shown=products.filter(p=>p.isActive!==false).sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')));
  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Physical stocktake</div><h2>Update raw stock on hand</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <input id="stockProductSearch" class="search" placeholder="Search products, codes or categories" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
    <p id="stockSearchCount" class="muted">${shown.length} products</p>
    <div id="stockProductList" class="stock-product-list">
      ${shown.map(product=>`
        <button class="stock-product-row" type="button"
          data-stock-product="${product.id}"
          data-stock-code="${esc(norm(product.code))}"
          data-stock-search="${esc(searchText(product))}">
          <div>${product.image?`<img src="${product.image}" alt="">`:`<span class="stock-placeholder">▦</span>`}</div>
          <span><strong>${esc(product.code)}</strong><small>${esc(product.name)}</small><small>${esc(product.category||'Uncategorised')}</small></span>
          <span class="stock-total"><strong>${inventoryTotalFor(product.id,snapshot)}</strong><small>raw on hand</small></span>
        </button>`).join('')}
      <div id="stockSearchEmpty" class="empty" style="display:none">No products found.</div>
    </div>
    <button id="allStockHistory" class="ghost" type="button">View all stock history</button>
  `);

  const input=document.getElementById('stockProductSearch');
  const list=document.getElementById('stockProductList');
  const rows=[...list.querySelectorAll('[data-stock-product]')];
  const count=document.getElementById('stockSearchCount');
  const empty=document.getElementById('stockSearchEmpty');

  input.oninput=event=>{
    const query=norm(event.currentTarget.value);
    const words=query.split(/\s+/).filter(Boolean);
    let matched=[];
    rows.forEach(row=>{
      const haystack=row.dataset.stockSearch||'';
      const visible=!words.length||words.every(word=>haystack.includes(word));
      row.style.display=visible?'':'none';
      if(visible)matched.push(row);
    });
    if(query){
      matched.sort((a,b)=>{
        const ac=a.dataset.stockCode||'',bc=b.dataset.stockCode||'';
        const ar=ac===query?0:ac.startsWith(query)?1:2;
        const br=bc===query?0:bc.startsWith(query)?1:2;
        return ar-br||ac.localeCompare(bc);
      }).forEach(row=>list.insertBefore(row,empty));
    }
    count.textContent=`${matched.length} product${matched.length===1?'':'s'} found`;
    empty.style.display=matched.length?'none':'block';
  };

  rows.forEach(button=>button.onclick=()=>showStockCount(button.dataset.stockProduct));
  document.getElementById('allStockHistory').onclick=()=>showStockHistory();
  requestAnimationFrame(()=>input.focus({preventScroll:true}));
};
try{openStockCountList=window.openStockCountList}catch{}
})();