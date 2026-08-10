/* V9.0.37 — hardened bulk/division stock-count save handler.
   Reads current input values at click time and commits only real changes through the existing inventory stores. */
(function(){
'use strict';
const q=v=>Math.max(0,Math.round(Number(v||0)));
const rawId=id=>typeof vuRawBalanceId==='function'?vuRawBalanceId(id):`${id}::raw`;

async function saveInput(input,note){
  const productId=input.dataset.bulkStock||input.dataset.divisionStockId;
  if(!productId)return false;
  const product=await getOne('products',productId);if(!product)return false;
  const next=q(input.value),old=q(input.dataset.original);
  if(next===old)return false;
  const id=rawId(product.id),now=new Date().toISOString();
  const previous=await getOne('inventoryBalances',id);
  const previousQty=q(previous?.quantity||old);
  await putOne('inventoryBalances',{id,productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',quantity:next,updatedAt:now});
  await putOne('inventoryTransactions',{id:uid('inv'),productId:product.id,productCode:product.code,productName:product.name,colourName:'Raw Stock',type:'STOCK_COUNT',previousQuantity:previousQty,quantityChange:next-previousQty,newQuantity:next,note,createdAt:now});
  input.dataset.original=String(next);
  input.closest('.bulk-stock-row,.division-stock-row')?.classList.remove('stock-row-changed');
  const row=input.closest('.bulk-stock-row,.division-stock-row');
  const current=[...row?.querySelectorAll('small')||[]].find(x=>/current raw stock/i.test(x.textContent||''));
  if(current)current.textContent=`Current raw stock: ${next}`;
  return true;
}

function statusMessage(button,text,ok=true){
  let el=button.parentElement?.querySelector('[data-stock-save-status]');
  if(!el){el=document.createElement('div');el.dataset.stockSaveStatus='1';el.style.marginTop='8px';el.style.fontWeight='700';button.insertAdjacentElement('afterend',el);}
  el.textContent=text;
  el.style.opacity='1';
  setTimeout(()=>{if(el)el.style.opacity='.65'},2200);
  try{notify(text)}catch{}
}

document.addEventListener('input',event=>{
  const input=event.target.closest?.('[data-bulk-stock],[data-division-stock-id]');if(!input)return;
  input.closest('.bulk-stock-row,.division-stock-row')?.classList.toggle('stock-row-changed',q(input.value)!==q(input.dataset.original));
},true);

document.addEventListener('click',async event=>{
  const button=event.target.closest?.('#bulkStockSave,#saveDivisionStock');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(button.disabled)return;
  button.disabled=true;
  const originalText=button.textContent;button.textContent='Saving…';
  try{
    const selector=button.id==='bulkStockSave'?'[data-bulk-stock]':'[data-division-stock-id]';
    const inputs=[...document.querySelectorAll(selector)];
    let saved=0;
    for(const input of inputs){if(await saveInput(input,button.id==='bulkStockSave'?'Bulk stock count':'Division stock count'))saved++;}
    if(saved){if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();statusMessage(button,`${saved} stock ${saved===1?'quantity':'quantities'} saved`);}
    else statusMessage(button,'No changed quantities to save');
  }catch(error){console.error('Stock count save failed',error);statusMessage(button,'Stock save failed — please try again',false);}
  finally{button.disabled=false;button.textContent=originalText;}
},true);
})();