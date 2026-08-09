/* V9.0.31 — authoritative fast raw-stock counting workflow.
   Loaded last so older inventory/raw-stock handlers cannot restore slow navigation. */
(function(){
'use strict';

const rawBalanceId=productId=>`${productId}::raw`;

async function restoreStockList(searchQuery=''){
  await window.openStockCountList();
  const input=document.getElementById('stockProductSearch');
  if(input&&searchQuery){
    input.value=searchQuery;
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  requestAnimationFrame(()=>input?.focus({preventScroll:true}));
}

window.showStockCount=async function showFastRawStockCount(productId,context={}){
  const listInput=document.getElementById('stockProductSearch');
  const searchQuery=context.searchQuery!==undefined?String(context.searchQuery||''):String(listInput?.value||'');
  const capturedBatchIds=[...document.querySelectorAll('#stockProductList [data-stock-product]')]
    .filter(row=>row.style.display!=='none')
    .map(row=>String(row.dataset.stockProduct||''))
    .filter(Boolean);
  const batchProductIds=Array.isArray(context.batchProductIds)&&context.batchProductIds.length
    ? context.batchProductIds.map(String)
    : capturedBatchIds;
  const batchIndex=batchProductIds.indexOf(String(productId));
  const nextProductId=batchIndex>=0?batchProductIds[batchIndex+1]||'':'';

  if(typeof window.vuMigrateProductBalancesToRaw==='function'){
    await window.vuMigrateProductBalancesToRaw(productId);
  }

  const product=await getOne('products',productId);
  if(!product){notify('Product not found');return;}
  const id=rawBalanceId(productId);
  const current=await getOne('inventoryBalances',id);
  const currentQty=Math.max(0,Number(current?.quantity||0));
  const progress=batchIndex>=0&&batchProductIds.length>1?` · ${batchIndex+1} of ${batchProductIds.length}`:'';

  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Raw stock on hand${progress}</div><h2>${esc(product.code)} · ${esc(product.name)}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <p class="muted">Count unfinished, unpainted units. Save & continue keeps you inside Stock Count.</p>
    <form id="rawStockCountForm">
      <label>Raw units on hand<input id="rawStockQty" type="number" min="0" step="1" inputmode="numeric" value="${currentQty}" required></label>
      <label>Stock-count note<textarea id="rawStockNote" placeholder="Example: Opening raw stock count"></textarea></label>
      <button class="primary" type="submit">Save & continue</button>
    </form>
    <div class="stock-history-link"><button id="viewRawStockHistory" class="ghost" type="button">View stock history</button></div>
  `);

  const qtyInput=document.getElementById('rawStockQty');
  requestAnimationFrame(()=>{if(qtyInput){qtyInput.focus({preventScroll:true});qtyInput.select();}});

  document.getElementById('rawStockCountForm').onsubmit=async event=>{
    event.preventDefault();
    const button=event.currentTarget.querySelector('button[type="submit"]');
    if(button)button.disabled=true;
    try{
      const previous=await getOne('inventoryBalances',id);
      const previousQuantity=Math.max(0,Number(previous?.quantity||0));
      const newQuantity=Math.max(0,Math.round(Number(document.getElementById('rawStockQty').value||0)));
      const note=document.getElementById('rawStockNote').value.trim()||'Manual raw stock count';
      const now=new Date().toISOString();

      await putOne('inventoryBalances',{
        id,productId:product.id,productCode:product.code,productName:product.name,
        colourName:'Raw Stock',quantity:newQuantity,updatedAt:now
      });

      if(previousQuantity!==newQuantity){
        await putOne('inventoryTransactions',{
          id:uid('inv'),productId:product.id,productCode:product.code,productName:product.name,
          colourName:'Raw Stock',type:'STOCK_COUNT',previousQuantity,
          quantityChange:newQuantity-previousQuantity,newQuantity,note,createdAt:now
        });
      }

      if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();
      notify(`${product.code} stock saved`);

      if(nextProductId){
        await window.showStockCount(nextProductId,{batchProductIds,searchQuery});
      }else{
        await restoreStockList(searchQuery);
      }
    }catch(error){
      console.error('Raw stock save failed',error);
      notify('Could not save raw stock');
      if(button)button.disabled=false;
    }
  };

  document.getElementById('viewRawStockHistory').onclick=()=>showStockHistory(product.id);
};

try{showStockCount=window.showStockCount}catch{}
})();
