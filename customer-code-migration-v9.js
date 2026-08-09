/* V9.0.18 — one-time migration for imports that were saved before customer-code parsing was corrected.
   This does not use suburb/address similarity. The source job card itself is the authority:
   QU125057 belongs to Sage account BH023 (BUCO - HONEYDEW).
*/
(function(){
'use strict';
const text=v=>String(v??'').trim();
const code=v=>text(v).toUpperCase().replace(/\s+/g,'');
const key=v=>text(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const migrations={QU125057:{accountCode:'BH023',name:'BUCO - HONEYDEW'}};

async function migrateOrder(order){
  const wanted=migrations[code(order?.orderNumber||order?.sourceReference||'')];
  if(!wanted)return false;
  const [customers,jobs,deliveries]=await Promise.all([getAll('customers'),getAll('productionJobs'),getAll('deliveries')]);
  let target=customers.find(c=>code(c.accountCode)===wanted.accountCode);
  if(!target)target=customers.find(c=>key(c.name)===key(wanted.name));
  if(!target)return false;
  const now=new Date().toISOString();
  if(code(target.accountCode)!==wanted.accountCode){target.accountCode=wanted.accountCode;target.updatedAt=now;await putOne('customers',target);}
  const snap=order.customerSnapshot||{};
  const changed=order.customerId!==target.id||key(order.customerName)!==key(target.name)||code(order.customerCode||snap.accountCode)!==wanted.accountCode;
  if(!changed)return false;
  const oldCustomerId=order.customerId;
  const fixed={...order,customerId:target.id,customerName:target.name,customerCode:wanted.accountCode,customerSnapshot:{...snap,name:target.name,accountCode:wanted.accountCode,sageAccountCode:wanted.accountCode},updatedAt:now,customerCodeMigration:'V9.0.18'};
  await putOne('orders',fixed);
  for(const j of jobs.filter(j=>j.orderId===order.id&&(j.customerId!==target.id||key(j.customerName)!==key(target.name))))await putOne('productionJobs',{...j,customerId:target.id,customerName:target.name,updatedAt:now});
  for(const d of deliveries.filter(d=>d.orderId===order.id&&(d.customerId!==target.id||key(d.customerName)!==key(target.name))))await putOne('deliveries',{...d,customerId:target.id,customerName:target.name,updatedAt:now});
  if(oldCustomerId&&oldCustomerId!==target.id){
    const [allOrders,allJobs,allDeliveries]=await Promise.all([getAll('orders'),getAll('productionJobs'),getAll('deliveries')]);
    const used=allOrders.some(o=>o.id!==order.id&&o.customerId===oldCustomerId)||allJobs.some(j=>j.customerId===oldCustomerId)||allDeliveries.some(d=>d.customerId===oldCustomerId);
    if(!used){const old=customers.find(c=>c.id===oldCustomerId);if(old&&(/cnr|street|road|drive|sales\s*rep/i.test(text(old.name))||/imported from sage|job card/i.test(text(old.notes))))try{await deleteOne('customers',oldCustomerId)}catch(e){console.warn(e)}}
  }
  return true;
}
async function run(showNotice=false){
  const orders=await getAll('orders');let changed=0;
  for(const o of orders)if(await migrateOrder(o))changed++;
  if(showNotice&&typeof notify==='function')notify(`${changed} order customer link${changed===1?'':'s'} repaired from Sage customer code`);
  return{relinked:changed};
}
const previous=window.repairImportedCustomerLinks;
window.repairImportedCustomerLinks=async function(showNotice=false){if(typeof previous==='function')try{await previous(false)}catch(e){console.warn(e)}return run(showNotice)};
window.strongRepairImportedCustomerLinks=window.repairImportedCustomerLinks;
setTimeout(()=>run(false).catch(e=>console.warn('Customer-code migration failed',e)),2200);
})();