/* Factory OS 2.1.1 — production-safe audited output capture. */
(function(){
'use strict';
if(window.VUFactoryProductionOutput)return;
const RAW='Raw';
const allowedDivision=new Set(['Casting','Packing','Resin']);
const balanceId=(productId,colourName=RAW)=>`${productId}::${String(colourName).trim().toLowerCase()}`;
function canRecord(division){const role=window.VUFactoryOS?.role?.()||'Management';return role==='Management'||role===division;}
async function rawBalance(productId){const row=await window.getOne('inventoryBalances',balanceId(productId));return Number(row?.quantity||0);}
async function record(item,qty,note='',allowExtra=false){
 const division=String(item?.division||'').trim();
 if(!allowedDivision.has(division))throw new Error('Production output is only available for Casting, Packing and Resin.');
 if(!canRecord(division))throw new Error(`This device cannot record ${division} production.`);
 const quantity=Math.max(0,Math.round(Number(qty||0))),required=Math.max(0,Math.round(Number(item?.toMake||0)));
 if(!quantity)throw new Error('Enter the quantity that was physically manufactured.');
 if(required>0&&quantity>required&&!allowExtra)throw new Error(`This job currently requires ${required}. Enable “Add extra units to Raw stock” to record more than the job requirement.`);
 const product=await window.getOne('products',item.productId);if(!product)throw new Error('Product could not be found.');
 const now=new Date().toISOString(),id=balanceId(product.id),previous=await window.getOne('inventoryBalances',id),previousQuantity=Number(previous?.quantity||0),newQuantity=previousQuantity+quantity;
 await window.putOne('inventoryBalances',{id,productId:product.id,productCode:product.code,productName:product.name,colourName:RAW,quantity:newQuantity,updatedAt:now});
 await window.putOne('inventoryTransactions',{id:window.uid('inv'),productId:product.id,productCode:product.code,productName:product.name,colourName:RAW,type:'PRODUCTION_OUTPUT',division,previousQuantity,quantityChange:quantity,newQuantity,orderId:item.orderId||null,orderNumber:item.orderNumber||null,customerName:item.customerName||null,note:String(note||'').trim()||`${division} manufactured output`,recordedByRole:window.VUFactoryOS?.role?.()||'Management',extraStock:quantity>required,createdAt:now});
 return{productId:product.id,division,quantity,previousQuantity,newQuantity};
}
async function open(item,onSaved){
 const division=String(item?.division||'').trim();
 if(!canRecord(division)){window.alert(`This device cannot record ${division} production.`);return}
 const required=Math.max(0,Math.round(Number(item?.toMake||0))),before=await rawBalance(item.productId);
 window.openDialog(`<div class="dialog-head"><div><div class="step-label">${window.esc(division)} OUTPUT</div><h2>${window.esc(item.productCode)} · ${window.esc(item.productName)}</h2></div><button class="close-btn" type="button" id="fosOutputClose">×</button></div><div class="card fos-output-card"><p class="muted">Record only what was physically manufactured. Output enters Raw stock and creates an inventory audit transaction.</p><p><strong>${window.esc(item.orderNumber||'')}</strong>${item.customerName?` · ${window.esc(item.customerName)}`:''}</p><div class="fos-output-summary"><div><span>Required for this job</span><strong>${required}</strong></div><div><span>Raw stock before</span><strong>${before}</strong></div><div><span>Raw stock after</span><strong id="fosOutputAfter">${before}</strong></div></div><form id="fosOutputForm" class="fos-output-form"><label class="fos-output-field"><span>Quantity manufactured</span><input id="fosOutputQty" type="number" min="1" step="1" inputmode="numeric" placeholder="Enter quantity" autocomplete="off" required></label><label class="fos-output-field"><span>Note <small>(optional)</small></span><textarea id="fosOutputNote" rows="3" placeholder="Example: Morning shift, mould 3, batch 2"></textarea></label><label class="fos-extra-row" id="fosExtraRow" hidden><input id="fosOutputExtra" type="checkbox"><span>Add extra units to Raw stock beyond this job requirement</span></label><div class="actions"><button class="primary" type="submit">Save manufactured stock</button></div></form></div>`);
 const qty=document.getElementById('fosOutputQty'),after=document.getElementById('fosOutputAfter'),extraRow=document.getElementById('fosExtraRow');
 const refresh=()=>{const q=Math.max(0,Math.round(Number(qty.value||0)));after.textContent=String(before+q);extraRow.hidden=!(required>0&&q>required)};
 qty.addEventListener('input',refresh);
 document.getElementById('fosOutputClose').onclick=window.closeDialog;
 document.getElementById('fosOutputForm').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;try{const saved=await record(item,qty.value,document.getElementById('fosOutputNote').value,document.getElementById('fosOutputExtra')?.checked===true);window.closeDialog();window.notify(`${item.productCode} +${saved.quantity} Raw stock`);if(typeof onSaved==='function')await onSaved(saved)}catch(err){btn.disabled=false;window.alert(err?.message||String(err))}};
 requestAnimationFrame(()=>qty?.focus());
}
function style(){if(document.getElementById('fosOutputSafetyStyle'))return;const s=document.createElement('style');s.id='fosOutputSafetyStyle';s.textContent='.fos-output-card{overflow:hidden}.fos-output-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.fos-output-summary>div{padding:12px;border:1px solid var(--line);border-radius:14px}.fos-output-summary span{display:block;color:var(--muted);font-size:.76rem}.fos-output-summary strong{display:block;font-size:1.25rem;margin-top:3px}.fos-output-form{display:grid;gap:14px}.fos-output-field{display:grid;gap:7px}.fos-output-field>span{font-weight:700}.fos-output-field input,.fos-output-field textarea{width:100%;max-width:100%;min-width:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);padding:13px;font:inherit}.fos-output-field input{font-size:1.25rem}.fos-output-field textarea{resize:vertical}.fos-extra-row{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:12px}.fos-extra-row input{margin-top:3px}.fos-output-form .actions{margin-top:0}.fos-output-form .actions .primary{width:100%}@media(max-width:520px){.fos-output-summary{grid-template-columns:1fr}.fos-output-card{padding:14px}.fos-output-field input,.fos-output-field textarea{font-size:16px}}';document.head.appendChild(s)}
style();window.VUFactoryProductionOutput={version:'2.1.1',RAW,balanceId,canRecord,rawBalance,record,open};
})();