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
async function run(){
 const [orders,customers,jobs,deliveries]=await Promise.all([getAll('orders'),getAll('customers'),getAll('productionJobs'),getAll('deliveries')]);
 let changed=0;
 for(const order of orders){
   const rule=RULES[code(order.orderNumber)];if(!rule)continue;
   let target=customers.find(c=>code(c.accountCode)===rule.accountCode);
   if(!target)target=customers.find(c=>key(c.name)===key(rule.name));
   if(!target)continue;
   const now=new Date().toISOString();
   if(code(target.accountCode)!==rule.accountCode){target.accountCode=rule.accountCode;target.updatedAt=now;await putOne('customers',target);}
   if(order.customerId!==target.id||code(order.customerCode)!==rule.accountCode||key(order.customerName)!==key(target.name)){
     const snap=order.customerSnapshot||{};
     await putOne('orders',{...order,customerId:target.id,customerName:target.name,customerCode:rule.accountCode,customerSnapshot:{...snap,name:target.name,accountCode:rule.accountCode,sageAccountCode:rule.accountCode},updatedAt:now,customerCodeMigratedAt:now});
     for(const j of jobs.filter(j=>j.orderId===order.id&&(j.customerId!==target.id||key(j.customerName)!==key(target.name))))await putOne('productionJobs',{...j,customerId:target.id,customerName:target.name,updatedAt:now});
     for(const d of deliveries.filter(d=>d.orderId===order.id&&(d.customerId!==target.id||key(d.customerName)!==key(target.name))))await putOne('deliveries',{...d,customerId:target.id,customerName:target.name,updatedAt:now});
     changed++;
   }
 }
 if(changed&&typeof navigate==='function'){const route=location.hash?.replace('#','')||'';if(/orders|customers/.test(route))setTimeout(()=>navigate(route.includes('customers')?'customers':'orders'),50);}
 return changed;
}
window.repairKnownSageCustomerCodes=run;
setTimeout(()=>run().catch(e=>console.warn('Sage customer-code migration failed',e)),1200);
})();