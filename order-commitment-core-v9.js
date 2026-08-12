/* V9.0.79 — customer commitment dates for orders.
   Required delivery/collection dates are explicit customer commitments and take precedence over
   the general due date for prioritisation. Collection commitments are not delivery-route work. */
(function(){
'use strict';
const norm=v=>String(v||'').trim().toLowerCase();
const dk=v=>{if(!v)return'';const s=String(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''};
function typeOf(order){
  const explicit=norm(order?.fulfilmentType||order?.fulfillmentType||order?.deliveryPreference||order?.preference);
  if(explicit.includes('collect'))return'Collection';
  if(explicit.includes('deliver'))return'Delivery';
  if(dk(order?.requiredCollectionDate)&&!dk(order?.requiredDeliveryDate))return'Collection';
  return'Delivery';
}
function commitment(order){
  const type=typeOf(order),delivery=dk(order?.requiredDeliveryDate),collection=dk(order?.requiredCollectionDate);
  if(type==='Collection'&&collection)return{type,date:collection,hard:true,source:'Required collection date'};
  if(type==='Delivery'&&delivery)return{type,date:delivery,hard:true,source:'Required delivery date'};
  if(collection&&!delivery)return{type:'Collection',date:collection,hard:true,source:'Required collection date'};
  if(delivery&&!collection)return{type:'Delivery',date:delivery,hard:true,source:'Required delivery date'};
  if(delivery&&collection){const date=delivery<=collection?delivery:collection;return{type:date===delivery?'Delivery':'Collection',date,hard:true,source:'Customer commitment date'};}
  const due=dk(order?.dueDate||order?.requiredDate);return{type,date:due,hard:false,source:due?'General due date':'No date set'};
}
function isCollection(order){return commitment(order).type==='Collection';}
function isDelivery(order){return !isCollection(order);}
function requestedFor(order,date){const c=commitment(order),d=dk(date);return !!(c.hard&&c.date&&d&&c.date===d);}
window.VUOrderCommitment={version:'9.0.79',typeOf,commitment,isCollection,isDelivery,requestedFor,dateKey:dk};
})();