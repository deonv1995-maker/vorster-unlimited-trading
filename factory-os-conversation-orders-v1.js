/* Conversation-fed order seeds. Business planning facts supplied through the management conversation. */
(function(){
'use strict';
const diary=window.VUOrderDiary;
if(!diary?.knownOrders)return;
const orders=diary.knownOrders;
const norm=v=>String(v??'').trim().toUpperCase();
function key(o){return norm(o.orderNumber)||`CUSTOMER:${norm(o.customerName)}`}
function add(order){const k=key(order);if(!orders.some(o=>key(o)===k))orders.push(order)}

add({
 id:'planning-qu125074',
 orderNumber:'QU125074',
 customerName:'ANTIQUE SHACK',
 source:'planning-diary',
 status:'In progress',
 orderDate:'2026-08-16',
 dueDate:'2026-08-31',
 plannedDate:'2026-10-27',
 fulfilmentType:'Collection',
 preference:'Collection',
 planningNote:'Customer note on job card: Collection 27 October.',
 orderTotalInclVat:888.26,
 orderTotalExVat:772.40,
 lines:[
  {productCode:'AKMH01',productName:'AK MINI HANDS',quantity:40,unitPrice:19.31,colourName:'Dry brush'}
 ]
});

add({
 id:'planning-crisandra',
 customerName:'CRISANDRA',
 source:'planning-diary',
 status:'In progress',
 plannedDate:'2026-08-20',
 fulfilmentType:'Delivery',
 preference:'Delivery',
 planningNote:'Most of the remaining order is completed. Planned with Magic Garden for one Thursday delivery route. Job card details still needed.',
 lines:[]
});

add({
 id:'planning-magic-garden',
 customerName:'MAGIC GARDEN',
 source:'planning-diary',
 status:'In progress',
 plannedDate:'2026-08-20',
 fulfilmentType:'Delivery',
 preference:'Delivery',
 planningNote:'Backorder exists. Planned with Crisandra for one Thursday delivery route. Job card details still needed.',
 lines:[]
});

add({
 id:'planning-water-plant',
 customerName:'WATER PLANT',
 source:'planning-diary',
 status:'In progress',
 fulfilmentType:'Collection',
 preference:'Collection',
 planningNote:'Large amount of ordered goods is ready and waiting. Customer wants all outstanding items across all orders complete before collection is arranged. Job card details still needed.',
 lines:[]
});
})();