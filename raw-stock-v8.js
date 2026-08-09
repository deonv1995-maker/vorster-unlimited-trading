/* Version 8.5 raw stock model.
   Physical inventory is colour-neutral raw stock. Order colours belong only to finishing/painting. */
const VU_RAW_STOCK_VERSION='8.5.0';
const vuRawBalanceId=productId=>`${productId}::raw`;

async function vuMigrateProductBalancesToRaw(productId){
  const balances=(await getAll('inventoryBalances')).filter(b=>b.productId===productId);
  if(!balances.length)return 0;
  const rawId=vuRawBalanceId(productId);
  const raw=balances.find(b=>b.id===rawId);
  const coloured=balances.filter(b=>b.id!==rawId);
  if(!coloured.length)return Number(raw?.quantity||0);
  const total=Number(raw?.quantity||0)+coloured.reduce((sum,b)=>sum+Math.max(0,Number(b.quantity||0)),0);
  const product=await getOne('products',productId);
  const now=new Date().toISOString();
  await putOne('inventoryBalances',{
    id:rawId,productId,productCode:product?.code||raw?.productCode||'',productName:product?.name||raw?.productName||'',
    colourName:'Raw Stock',quantity:total,updatedAt:now
  });
  for(const balance of coloured)await deleteOne('inventoryBalances',balance.id);
  return total;
}

async function vuMigrateAllBalancesToRaw(){
  const balances=await getAll('inventoryBalances');
  const productIds=[...new Set(balances.map(b=>b.productId).filter(Boolean))];
  for(const productId of productIds)await vuMigrateProductBalancesToRaw(productId);
}

inventoryTotalFor=function inventoryTotalRaw(productId,snapshot){
  return (snapshot[productId]||[]).reduce((sum,item)=>sum+Math.max(0,Number(item.quantity||0)),0);
};

showStockCount=async function showRawStockCount(productId,context={}){
  const capturedBatchIds=[...document.querySelectorAll('#stockProductList [data-stock-product]')]
    .filter(row=>row.style.display!=='none')
    .map(row=>String(row.dataset.stockProduct||''))
    .filter(Boolean);
  const batchProductIds=Array.isArray(context.batchProductIds)&&context.batchProductIds.length
    ? context.batchProductIds.map(String)
    : capturedBatchIds;
  const batchIndex=batchProductIds.indexOf(String(productId));
  const inBatchMode=batchIndex>=0;
  const nextBatchProductId=inBatchMode?batchProductIds[batchIndex+1]||'':'';

  await vuMigrateProductBalancesToRaw(productId);
  const product=await getOne('products',productId);if(!product){notify('Product not found');return;}
  const id=vuRawBalanceId(productId);const current=await getOne('inventoryBalances',id);const currentQty=Math.max(0,Number(current?.quantity||0));
  const progressText=inBatchMode?` · ${batchIndex+1} of ${batchProductIds.length}`:'';
  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Raw stock on hand${progressText}</div><h2>${esc(product.code)} · ${esc(product.name)}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <p class="muted">Count only unfinished, unpainted units. Colour is assigned later in Finishing & Painting.${inBatchMode?' Saving moves straight to the next product.':''}</p>
    <form id="rawStockCountForm">
      <label>Raw units on hand<input id="rawStockQty" type="number" min="0" step="1" inputmode="numeric" value="${currentQty}" required></label>
      <label>Stock-count note<textarea id="rawStockNote" placeholder="Example: Opening raw stock count"></textarea></label>
      <button class="primary" type="submit">${inBatchMode?(nextBatchProductId?'Save & next product':'Save & finish'):'Save raw stock'}</button>
      ${inBatchMode?'<button id="finishRawStockCount" class="ghost" type="button">Finish stock count</button>':''}
    </form>
    <div class="stock-history-link"><button id="viewRawStockHistory" class="ghost" type="button">View stock history</button></div>`);

  const qtyInput=document.getElementById('rawStockQty');
  requestAnimationFrame(()=>{if(qtyInput){qtyInput.focus({preventScroll:true});qtyInput.select();}});

  document.getElementById('rawStockCountForm').onsubmit=async event=>{
    event.preventDefault();
    const submitButton=event.target.querySelector('button[type="submit"]');
    if(submitButton)submitButton.disabled=true;
    try{
      const previous=await getOne('inventoryBalances',id);const previousQuantity=Math.max(0,Number(previous?.quantity||0));
      const newQuantity=Math.max(0,Math.round(Number(document.getElementById('rawStockQty').value||0)));const now=new Date().toISOString();
      await putOne('inventoryBalances',{id,productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',quantity:newQuantity,updatedAt:now});
      if(previousQuantity!==newQuantity){
        await putOne('inventoryTransactions',{id:uid('inv'),productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',type:'STOCK_COUNT',previousQuantity,quantityChange:newQuantity-previousQuantity,newQuantity,note:document.getElementById('rawStockNote').value.trim()||'Manual raw stock count',createdAt:now});
      }
      if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();

      if(inBatchMode&&nextBatchProductId){
        notify(`${product.code} saved · next product`);
        await showStockCount(nextBatchProductId,{batchProductIds});
        return;
      }

      if(inBatchMode){
        closeDialog();
        notify('Stock count finished');
        if(route==='products')await productsPage();
        if(route==='production')await productionPage();
        return;
      }

      closeDialog();notify('Raw stock updated');
      if(route==='products')await productsPage();
      if(route==='production')await productionPage();
    }catch(error){
      console.error('Raw stock save failed',error);
      notify('Could not save raw stock');
      if(submitButton)submitButton.disabled=false;
    }
  };

  const finishButton=document.getElementById('finishRawStockCount');
  if(finishButton){
    finishButton.onclick=async()=>{
      closeDialog();
      notify('Stock count finished');
      if(route==='products')await productsPage();
      if(route==='production')await productionPage();
    };
  }
  document.getElementById('viewRawStockHistory').onclick=()=>showStockHistory(product.id);
};

showStockHistory=async function showRawStockHistory(productId=''){
  const [products,transactions]=await Promise.all([getAll('products'),getAll('inventoryTransactions')]);
  const product=products.find(p=>p.id===productId);
  const rows=transactions.filter(item=>!productId||item.productId===productId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  openDialog(`<div class="dialog-head"><div><div class="step-label">Raw inventory audit</div><h2>${product?`${esc(product.code)} stock history`:'Stock history'}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><div class="stock-history-list">${rows.length?rows.slice(0,100).map(item=>`<div class="stock-history-row"><div><strong>${esc(item.productCode)} · Raw Stock</strong><p>${esc(item.note||'Stock update')}</p><small>${dateText(item.createdAt)}</small></div><div class="stock-history-qty"><span>${Number(item.quantityChange||0)>=0?'+':''}${Number(item.quantityChange||0)}</span><strong>${Number(item.newQuantity??'')}</strong><small>raw on hand</small></div></div>`).join(''):'<div class="empty">No stock changes recorded yet.</div>'}</div>`);
};

window.showStockCount=showStockCount;window.showStockHistory=showStockHistory;window.vuMigrateAllBalancesToRaw=vuMigrateAllBalancesToRaw;
vuMigrateAllBalancesToRaw().catch(error=>console.warn('Raw stock migration failed',error));