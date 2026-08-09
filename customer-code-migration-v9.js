/* V9.0.18 — one-time repair for orders imported before account-code-safe parsing.
   These mappings are taken from the supplied Sage job cards. Account code is authoritative.
*/
(function(){
'use strict';
const RULES={
  'QU125057':{accountCode:'BH023',name:'BUCO - HONEYDEW'},
  'QU125048':{accountCode:'BH023',name:'BUCO - HONEYDEW'},
  'QU124987':{accountCode:'BH023',name:'BUCO - HONEYDEW'},
  'QU125037':{accountCode:'COL098',name:'COLOURFUL NURSERY HONEYDEW'}
};
const text=v=>String(v??'').trim();
const code=v=>text(v).toUpperCase().replace(/\s+/g,'');
const key=v=>text(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
async function run(showNotice=false){
 const [orders,customers,jobs,deliveries]=await Promise.all([getAll('orders'),getAll('customers'),getAll('productionJobs'),getAll('deliveries')]);
 let changed=0;
 for(const order of orders){
   const rule=RULES[code(order.orderNumber||order.sourceReference||'')];if(!rule)continue;
   let target=customers.find(c=>code(c.accountCode)===rule.accountCode);
   if(!target)target=customers.find(c=>key(c.name)===key(rule.name));
   if(!target)continue;
   const now=new Date().toISOString();
   if(code(target.accountCode)!==rule.accountCode){target.accountCode=rule.accountCode;target.updatedAt=now;await putOne('customers',target);}
   const snap=order.customerSnapshot||{};
   const oldCustomerId=order.customerId;
   if(order.customerId!==target.id||code(order.customerCode||snap.accountCode)!==rule.accountCode||key(order.customerName)!==key(target.name)){
     await putOne('orders',{...order,customerId:target.id,customerName:target.name,customerCode:rule.accountCode,customerSnapshot:{...snap,name:target.name,accountCode:rule.accountCode,sageAccountCode:rule.accountCode},updatedAt:now,customerCodeMigration:'V9.0.18'});
     for(const j of jobs.filter(j=>j.orderId===order.id&&(j.customerId!==target.id||key(j.customerName)!==key(target.name))))await putOne('productionJobs',{...j,customerId:target.id,customerName:target.name,updatedAt:now});
     for(const d of deliveries.filter(d=>d.orderId===order.id&&(d.customerId!==target.id||key(d.customerName)!==key(target.name))))await putOne('deliveries',{...d,customerId:target.id,customerName:target.name,updatedAt:now});
     changed++;
   }
   if(oldCustomerId&&oldCustomerId!==target.id){
     const old=customers.find(c=>c.id===oldCustomerId);
     if(old){const allOrders=await getAll('orders'),allJobs=await getAll('productionJobs'),allDeliveries=await getAll('deliveries');const used=allOrders.some(o=>o.customerId===oldCustomerId)||allJobs.some(j=>j.customerId===oldCustomerId)||allDeliveries.some(d=>d.customerId===oldCustomerId);if(!used&&(/cnr|street|road|drive|sales\s*rep/i.test(text(old.name))||/imported from sage|job card/i.test(text(old.notes))))try{await deleteOne('customers',oldCustomerId)}catch(e){console.warn(e)}}
   }
 }
 if(showNotice&&typeof notify==='function')notify(`${changed} order customer link${changed===1?'':'s'} repaired from Sage customer code`);
 if(changed&&typeof navigate==='function')setTimeout(()=>navigate('orders'),80);
 return{relinked:changed};
}
const previous=window.repairImportedCustomerLinks;
window.repairImportedCustomerLinks=async function(showNotice=false){if(typeof previous==='function')try{await previous(false)}catch(e){console.warn(e)}return run(showNotice)};
window.strongRepairImportedCustomerLinks=window.repairImportedCustomerLinks;
setTimeout(()=>run(false).catch(e=>console.warn('Customer-code migration failed',e)),1800);
})();