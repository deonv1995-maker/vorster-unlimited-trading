/* Conversation-fed order seeds. Append-only business planning facts supplied by Deon. */
(function(){
'use strict';
const diary=window.VUOrderDiary;
if(!diary?.knownOrders)return;
const orders=diary.knownOrders;
function add(order){if(!orders.some(o=>String(o.orderNumber||'').toUpperCase()===String(order.orderNumber||'').toUpperCase()))orders.push(order)}
add({
 id:'planning-qu125074',
 orderNumber:'QU125074',
 customerName:'ANTIQUE SHACK',
 source:'planning-diary',
 status:'In progress',
 orderDate:'2026-08-16',
 dueDate:'2026-08-31',
 fulfilmentType:'Collection',
 preference:'Collection',
 planningNote:'Customer note on job card: Collection 27 October.',
 orderTotalInclVat:888.26,
 orderTotalExVat:772.40,
 lines:[
  {productCode:'AKMH01',productName:'AK MINI HANDS',quantity:40,unitPrice:19.31,colourName:'Dry brush'}
 ]
});
})();