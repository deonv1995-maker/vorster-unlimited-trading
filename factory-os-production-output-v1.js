/* Factory OS 2.1 — audited production output into Raw stock. */
(function(){
'use strict';
if(window.VUFactoryProductionOutput)return;
const RAW='Raw';
const balanceId=(productId,colourName=RAW)=>`${productId}::${String(colourName).trim().toLowerCase()}`;
const allowedDivision=new Set(['Casting','Packing','Resin']);
function canRecord(division){const role=window.VUFactoryOS?.role?.()||'Management';return role==='Management'||role===division;}
async function record(item,qty,note=''){
 const division=String(item?.division||'').trim();
 if(!allowedDivision.has(division))throw new Error('Production output is only available for Casting, Packing and Resin.');
 if(!canRecord(division))throw new Error(`This device cannot record ${division} production.`);
 const quantity=Math.max(0,Math.round(Number(qty||0)));
 if(!quantity)throw new Error('Enter a manufactured quantity greater than zero.');
 const product=await window.getOne('products',item.productId);
 if(!product)throw new Error('Product could not be found.');
 const now=new Date().toISOString(),id=balanceId(product.id),previous=await window.getOne('inventoryBalances',id),previousQuantity=Number(previous?.quantity||0),newQuantity=previousQuantity+quantity;
 await window.putOne('inventoryBalances',{id,productId:product.id,productCode:product.code,productName:product.name,colourName:RAW,quantity:newQuantity,updatedAt:now});
 await window.putOne('inventoryTransactions',{id:window.uid('inv'),productId:product.id,productCode:product.code,productName:product.name,colourName:RAW,type:'PRODUCTION_OUTPUT',division,previousQuantity,quantityChange:quantity,newQuantity,orderId:item.orderId||null,orderNumber:item.orderNumber||null,customerName:item.customerName||null,note:String(note||'').trim()||`${division} manufactured output`,recordedByRole:window.VUFactoryOS?.role?.()||'Management',createdAt:now});
 return{productId:product.id,division,quantity,previousQuantity,newQuantity};
}
async function open(item,onSaved){
 const division=String(item?.division||'').trim();
 if(!canRecord(division)){window.alert(`This device cannot record ${division} production.`);return}
 window.openDialog(`<div class="dialog-head"><div><div class="step-label">${window.esc(division)} OUTPUT</div><h2>${window.esc(item.productCode)} · ${window.esc(item.productName)}</h2></div><button class="close-btn" type="button" id="fosOutputClose">×</button></div><div class="card"><p class="muted">Record what was physically manufactured. This adds to Raw stock and creates an inventory audit transaction.</p><p><strong>${window.esc(item.orderNumber||'')}</strong>${item.customerName?` · ${window.esc(item.customerName)}`:''}</p><form id="fosOutputForm"><label>Quantity manufactured<input id="fosOutputQty" type="number" min="1" step="1" inputmode="numeric" value="${Math.max(1,Math.round(Number(item.toMake||1)))}" required></label><label>Note (optional)<textarea id="fosOutputNote" placeholder="Example: Morning shift, mould 3, batch 2"></textarea></label><div class="actions"><button class="primary" type="submit">Save manufactured stock</button></div></form></div>`);
 document.getElementById('fosOutputClose').onclick=window.closeDialog;
 document.getElementById('fosOutputForm').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;try{const saved=await record(item,document.getElementById('fosOutputQty').value,document.getElementById('fosOutputNote').value);window.closeDialog();window.notify(`${item.productCode} +${saved.quantity} Raw stock`);if(typeof onSaved==='function')await onSaved(saved)}catch(err){btn.disabled=false;window.alert(err?.message||String(err))}};
 requestAnimationFrame(()=>document.getElementById('fosOutputQty')?.select());
}
window.VUFactoryProductionOutput={version:'2.1.0',RAW,balanceId,canRecord,record,open};
})();