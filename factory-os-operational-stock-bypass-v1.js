/* Factory OS 2.10.13 — temporary operational stock bypass for Painting and Delivery.
   Physical workflow confirmation is allowed to advance even when recorded stock is behind.
   Missing stock is added as an audited OPERATIONAL_STOCK_RECONCILIATION before normal movements run. */
(function(){
'use strict';
if(window.VUOperationalStockBypass)return;
const n=v=>Math.max(0,Math.round(Number(v||0)));
const norm=v=>String(v||'').trim().toLowerCase();
const colour=v=>String(v||'Standard').trim()||'Standard';
const balanceId=(productId,c)=>`${productId}::${colour(c).toLowerCase()}`;
const previewRole=()=>window.VUManagementPreview?.role?.()||null;
const actualRole=()=>window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.()||null;
const paintingContext=()=>actualRole()==='Painting'||previewRole()==='Painting';
const deliveryContext=()=>actualRole()==='Delivery'||previewRole()==='Delivery';
const isPreview=()=>!!window.VUManagementPreview?.isActive?.();

async function productInfo(productId,productCode,productName){
  let p=productId?await getOne('products',productId):null;
  if(!p&&productCode){const all=await getAll('products');p=all.find(x=>String(x.code||'').trim().toUpperCase()===String(productCode||'').trim().toUpperCase())||null;}
  return {id:p?.id||productId||null,code:p?.code||productCode||'',name:p?.name||productName||productCode||'Product'};
}
async function ensureRecordedStock({productId,productCode,productName,colourName,required,orderId=null,orderNumber=null,customerName=null,reason}){
  const need=n(required);if(!need)return 0;
  const p=await productInfo(productId,productCode,productName);if(!p.id)return 0;
  const c=colour(colourName),id=balanceId(p.id,c),row=await getOne('inventoryBalances',id),before=n(row?.quantity),missing=Math.max(0,need-before);
  if(!missing)return 0;
  const now=new Date().toISOString(),after=before+missing;
  await putOne('inventoryBalances',{...(row||{}),id,productId:p.id,productCode:p.code,productName:p.name,colourName:c,quantity:after,updatedAt:now});
  await putOne('inventoryTransactions',{id:uid('inv'),productId:p.id,productCode:p.code,productName:p.name,colourName:c,type:'OPERATIONAL_STOCK_RECONCILIATION',previousQuantity:before,quantityChange:missing,newQuantity:after,orderId,orderNumber,customerName,note:reason||'Temporary operational stock catch-up: physical units confirmed while recorded stock was behind.',recordedByRole:actualRole()||'Management',createdAt:now});
  return missing;
}

/* Painting: keep the normal conversion authority, but top up only the missing Raw quantity first. */
const originalFinishConvert=window.VUFactoryFinishing?.convert?.bind(window.VUFactoryFinishing);
if(originalFinishConvert){
  window.VUFactoryFinishing.convert=async function(item,qty,note=''){
    const q=n(qty);
    if(q&&paintingContext()&&!isPreview())await ensureRecordedStock({productId:item.productId,productCode:item.productCode,productName:item.productName,colourName:'Raw',required:q,orderId:item.orderId,orderNumber:item.orderNumber,customerName:item.customerName,reason:'Temporary Raw stock catch-up from Finishing & Painting: physical item confirmed ready for painting while the stock count was behind.'});
    return originalFinishConvert(item,qty,note);
  };
}

/* Painting workspace enhancer: stock remains visible, but it no longer limits the quantity the leader can record. */
const originalFinishOpen=window.VUFactoryFinishingWorkspace?.open?.bind(window.VUFactoryFinishingWorkspace);
const originalFinishBuild=window.VUFactoryFinishingWorkspace?.build?.bind(window.VUFactoryFinishingWorkspace);
const paintDraft=new Map();
const finishKey=x=>`${x.orderId}::${x.productId}::${colour(x.colour).toLowerCase()}`;
function updatePaintSave(){const total=[...paintDraft.values()].reduce((s,v)=>s+n(v),0),count=document.getElementById('fosFinishSelectedCount'),btn=document.getElementById('fosFinishSaveAll');if(count)count.textContent=`${total} unit${total===1?'':'s'} selected`;if(btn)btn.disabled=!total||isPreview();}
async function enhancePainting(){
  if(!paintingContext()||!originalFinishBuild)return;
  const rows=await originalFinishBuild(),byKey=new Map(rows.map(x=>[finishKey(x),x]));
  for(const [k,x] of byKey){const el=document.querySelector(`[data-finish-key="${CSS.escape(k)}"]`);if(!el)continue;const max=n(x.toFinish),recordedRaw=n(x.readyToFinish),short=Math.max(0,max-recordedRaw),input=el.querySelector('[data-finish-qty]'),minus=el.querySelector('[data-finish-minus]'),plus=el.querySelector('[data-finish-plus]'),all=el.querySelector('[data-finish-max]');
    const info=el.querySelector('.fos-finish-info small');if(info)info.textContent=short?`${recordedRaw} Raw recorded · ${short} stock count behind · physical capture allowed`:`${recordedRaw} Raw recorded`;
    if(input){input.max=String(max);input.disabled=isPreview();input.value=String(Math.min(max,n(paintDraft.get(k))));input.oninput=e=>{e.stopPropagation();const q=Math.min(max,n(input.value));if(q)paintDraft.set(k,q);else paintDraft.delete(k);input.value=String(q);updatePaintSave()};}
    if(minus){minus.disabled=isPreview();minus.onclick=e=>{e.stopPropagation();const q=Math.max(0,n(paintDraft.get(k))-1);if(q)paintDraft.set(k,q);else paintDraft.delete(k);if(input)input.value=String(q);updatePaintSave()};}
    if(plus){plus.disabled=isPreview();plus.onclick=e=>{e.stopPropagation();const q=Math.min(max,n(paintDraft.get(k))+1);if(q)paintDraft.set(k,q);if(input)input.value=String(q);updatePaintSave()};}
    if(all){all.disabled=isPreview();all.textContent=`All ${max}`;all.onclick=e=>{e.stopPropagation();if(max)paintDraft.set(k,max);if(input)input.value=String(max);updatePaintSave()};}
    el.querySelector('.fos-finish-stepper')?.classList.remove('is-disabled');
  }
  const btn=document.getElementById('fosFinishSaveAll');if(btn&&!isPreview())btn.onclick=async()=>{const selected=rows.filter(x=>n(paintDraft.get(finishKey(x)))>0);if(!selected.length)return;btn.disabled=true;let saved=0,corrected=0;try{for(const x of selected){const q=n(paintDraft.get(finishKey(x)));const raw=await window.VUFactoryFinishing.balance(x.productId,'Raw');corrected+=Math.max(0,q-n(raw));await window.VUFactoryFinishing.convert(x,q,'Bulk finishing capture · operational stock bypass');saved+=q;paintDraft.delete(finishKey(x));}if(window.VUSharedAccess?.membership?.()&&navigator.onLine){try{await VUSharedAccess.sync({reason:'painting-operational-save'})}catch{}}window.notify(`${saved} painted unit${saved===1?'':'s'} saved${corrected?` · ${corrected} stock unit${corrected===1?'':'s'} reconciled`:''}`);await window.VUFactoryFinishingWorkspace.open();}catch(e){alert(e?.message||String(e));btn.disabled=false;}};
  updatePaintSave();
}
if(originalFinishOpen)window.VUFactoryFinishingWorkspace.open=async function(view='orders'){await originalFinishOpen(view);await enhancePainting();};

/* Delivery view: scheduled physical order requirements are loadable even when finished stock bookkeeping is behind. */
const originalDispatchBuild=window.VUFactoryDispatch?.build?.bind(window.VUFactoryDispatch);
if(originalDispatchBuild){window.VUFactoryDispatch.build=async function(...args){const model=await originalDispatchBuild(...args);if(!deliveryContext())return model;const cloneOrder=o=>{const lines=(o.lines||[]).map(l=>{const required=n(l.required);return{...l,ready:required,waiting:0}}),totalReady=lines.reduce((s,l)=>s+n(l.ready),0),totalRemaining=lines.reduce((s,l)=>s+n(l.required),0),readyValue=lines.reduce((s,l)=>s+n(l.ready)*Number(l.unitPrice||0),0);return{...o,lines,totalReady,totalRemaining,readyValue,complete:totalRemaining>0&&totalReady>=totalRemaining,partial:totalReady>0&&totalReady<totalRemaining}};return{...model,orders:(model.orders||[]).map(cloneOrder),deliveries:(model.deliveries||[]).map(cloneOrder)};};}

/* Loading completion: if the physical load exceeds the recorded finished balance, catch the balance up before confirming the vehicle. */
const originalConfirmVehicle=window.VUFactoryDispatchControl?.confirmVehicle?.bind(window.VUFactoryDispatchControl);
if(originalConfirmVehicle){window.VUFactoryDispatchControl.confirmVehicle=async function(vehicle,date){if(deliveryContext()&&!isPreview()){for(const o of vehicle?.orders||[])for(const l of o.lines||[]){const q=n(l.ready);if(q)await ensureRecordedStock({productId:l.productId,productCode:l.productCode,productName:l.productName,colourName:l.colour,required:q,orderId:o.orderId,orderNumber:o.orderNumber,customerName:o.customerName,reason:'Temporary finished-stock catch-up from Delivery loading: physical units confirmed on vehicle while the stock count was behind.'});}}return originalConfirmVehicle(vehicle,date);};}

/* Safety net for stop completion in case another stock movement happened after loading. */
const originalCompleteStop=window.VUFactoryDispatchControl?.completeStop?.bind(window.VUFactoryDispatchControl);
if(originalCompleteStop){window.VUFactoryDispatchControl.completeStop=async function(dispatchId,stopId,status,quantities={}){if(['Delivered','Partial'].includes(String(status||''))){const d=await getOne('deliveries',dispatchId),stop=(d?.stops||[]).find(s=>s.id===stopId);if(stop){for(const l of stop.lines||[]){const q=status==='Delivered'?n(l.plannedQty):n(quantities[`${l.productCode}::${l.colour}`]);if(q)await ensureRecordedStock({productId:l.productId,productCode:l.productCode,productName:l.productName,colourName:l.colour,required:q,orderId:stop.orderId,orderNumber:stop.orderNumber,customerName:stop.customerName,reason:'Temporary finished-stock catch-up at delivery completion: physical delivered units exceeded the recorded stock balance.'});}}}return originalCompleteStop(dispatchId,stopId,status,quantities);};}

window.VUOperationalStockBypass={version:'2.10.13',ensureRecordedStock,enhancePainting};
})();
