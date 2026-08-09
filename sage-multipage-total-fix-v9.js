/* Version 9.0.9 — repair Sage multipage job-card totals without changing order lines. */
(function(){
'use strict';
const basePutOne=window.putOne;
if(typeof basePutOne!=='function')return;
const n=v=>Number(v||0);
const isImported=o=>/sage pdf|job card import/i.test(String(o?.source||o?.customerSnapshot?.source||''));
const productLines=o=>(o?.lines||[]).filter(l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l));
const lineSubtotal=o=>productLines(o).reduce((s,l)=>s+n(l.qty)*n(l.unitPrice),0);
const close=(a,b,t=.05)=>Math.abs(n(a)-n(b))<=t;

function repairImportedOrder(order){
  if(!order||!isImported(order))return order;
  const subtotal=lineSubtotal(order);
  const delivery=n(order.deliveryFee||order.delivery);
  const base=Number((subtotal+delivery).toFixed(2));
  const stored=n(order.grandTotal);
  if(!(base>0))return order;

  // Sage repeats the same document grand total on every page. Older importer summed
  // those repeated page totals, e.g. a 2-page R3,044.47 order became R6,088.94.
  const multiple=stored/base;
  const repeatedPages=Number.isFinite(multiple)&&multiple>=2&&multiple<=20&&close(multiple,Math.round(multiple),.001);
  if(!repeatedPages)return {...order,delivery,deliveryFee:delivery};

  return {
    ...order,
    subtotal:Number(subtotal.toFixed(2)),
    delivery,
    deliveryFee:delivery,
    vat:0,
    grandTotal:base,
    sageRepeatedPageTotalRepaired:true,
    sageRepeatedPageCount:Math.round(multiple),
    updatedAt:new Date().toISOString()
  };
}

window.putOne=async function(store,value){
  if(store==='orders'&&isImported(value))value=repairImportedOrder(value);
  return basePutOne(store,value);
};

async function repairExisting(){
  try{
    const orders=await getAll('orders');
    for(const order of orders){
      if(!isImported(order))continue;
      const fixed=repairImportedOrder(order);
      if(fixed!==order&&fixed.sageRepeatedPageTotalRepaired&&!order.sageRepeatedPageTotalRepaired){
        await basePutOne('orders',fixed);
      }
    }
  }catch(e){console.warn('Sage multipage total repair',e)}
}
setTimeout(repairExisting,0);
window.repairSageMultipageTotals=repairExisting;
})();