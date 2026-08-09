/* Version 9.0.5 — safe manual order → quotation correction without polluting factory demand. */
(function(){
'use strict';
const CLOSED_BLOCK=new Set(['delivered','collected','completed','invoiced']);
const norm=v=>String(v||'').trim().toLowerCase();
const now=()=>new Date().toISOString();

async function cancelLinkedOperationalRecords(order){
  const [jobs,deliveries]=await Promise.all([getAll('productionJobs'),getAll('deliveries')]);
  for(const job of jobs.filter(j=>j.orderId===order.id&&!['completed','cancelled'].includes(norm(j.status)))){
    await putOne('productionJobs',{...job,status:'Cancelled',cancelReason:`Order ${order.orderNumber||''} converted back to quotation`,convertedToQuote:true,updatedAt:now()});
  }
  for(const delivery of deliveries.filter(d=>d.orderId===order.id&&!['delivered','cancelled'].includes(norm(d.status)))){
    await putOne('deliveries',{...delivery,status:'Cancelled',cancelReason:`Order ${order.orderNumber||''} converted back to quotation`,convertedToQuote:true,updatedAt:now()});
  }
}

async function convertOrderToQuote(id){
  const order=await getOne('orders',id);
  if(!order)return;
  if(order.convertedQuoteId){notify('This order has already been converted to a quotation');return viewQuote(order.convertedQuoteId);}
  if(CLOSED_BLOCK.has(norm(order.status))){alert('Completed, delivered, collected or invoiced orders cannot be converted back to quotations.');return;}
  const warning=`Convert ${order.orderNumber||'this order'} back to a quotation?\n\nIt will be removed from active production, stock allocation, finishing, painting, delivery planning and the daily invoice-target forecast. Any open production job or delivery linked to it will be cancelled, but the original order will be kept for audit history.`;
  if(!confirm(warning))return;

  const quoteId=uid('quo'),quoteNumber=await nextQuoteNumber(),stamp=now();
  const quote={
    id:quoteId,
    quoteNumber,
    customerId:order.customerId||'',
    customerName:order.customerName||'',
    customerSnapshot:order.customerSnapshot||{},
    status:'Draft',
    lines:structuredClone(order.lines||[]),
    delivery:Number(order.delivery||0),
    discountType:'Percent',
    discountValue:0,
    discount:0,
    subtotal:Number(order.subtotal||0),
    vatRate:Number(order.vatRate||15),
    vat:Number(order.vat||0),
    grandTotal:Number(order.grandTotal||0),
    customerNotes:order.notes||'',
    internalNotes:`Converted manually from order ${order.orderNumber||''}. Original order retained as cancelled for audit history.`,
    validUntil:'',
    sourceOrderId:order.id,
    sourceOrderNumber:order.orderNumber||'',
    createdAt:stamp,
    updatedAt:stamp
  };

  await putOne('quotes',quote);
  await cancelLinkedOperationalRecords(order);
  await putOne('orders',{
    ...order,
    status:'Cancelled',
    convertedToQuote:true,
    convertedQuoteId:quote.id,
    convertedQuoteNumber:quote.quoteNumber,
    cancellationReason:`Converted to quotation ${quote.quoteNumber}`,
    workflowStage:'',
    finishingStatus:'',
    paintingStatus:'',
    deliveryDate:'',
    updatedAt:stamp
  });
  await putOne('activities',{
    id:uid('act'),customerId:order.customerId,type:'Order Converted to Quote',
    notes:`${order.orderNumber||'Order'} converted to ${quote.quoteNumber}. Original order retained as cancelled.`,createdAt:stamp
  });
  notify(`Converted to ${quote.quoteNumber}`);
  viewQuote(quote.id);
}
window.convertOrderToQuote=convertOrderToQuote;

const originalViewOrder=window.viewOrder;
if(typeof originalViewOrder==='function'){
  window.viewOrder=async function(id){
    await originalViewOrder(id);
    try{
      const order=await getOne('orders',id);if(!order)return;
      const existing=document.getElementById('orderToQuoteControl');if(existing)return;
      const card=document.createElement('div');card.id='orderToQuoteControl';card.className='card no-print';card.style.marginTop='12px';
      if(order.convertedQuoteId){
        card.innerHTML=`<div class="linked-document"><span>Converted quotation</span><button class="secondary" onclick="viewQuote('${order.convertedQuoteId}')">${order.convertedQuoteNumber||'Open quotation'}</button></div><p class="muted">This original order is retained as cancelled audit history and no longer contributes to factory demand.</p>`;
      }else if(!CLOSED_BLOCK.has(norm(order.status))){
        card.innerHTML=`<h3>Correct document type</h3><p class="muted">If this was entered as an order by mistake, convert it back to a quotation. The order will immediately stop contributing to operational demand and target planning.</p><div class="actions"><button class="secondary" onclick="convertOrderToQuote('${order.id}')">Convert order to quote</button></div>`;
      }else return;
      main.appendChild(card);
    }catch(e){console.warn('Order to quote control',e)}
  };
}
})();