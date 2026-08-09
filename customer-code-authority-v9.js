/* V9.0.15 — Sage customer account code is the authoritative order/customer identity.
   Names, addresses, suburbs and VAT may enrich a profile, but they may not move an order
   between customers when a Sage customer code is present.
*/
(function(){
'use strict';
const basePutOne=window.putOne;
if(typeof basePutOne!=='function')return;
const text=v=>String(v??'').trim();
const code=v=>text(v).toUpperCase().replace(/\s+/g,'');
const key=v=>text(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const imported=o=>/sage|job card|import/i.test(`${text(o?.source)} ${text(o?.notes)} ${text(o?.sourceReference)} ${text(o?.customerSnapshot?.source)}`);
const stableOwners={BH023:'buco honeydew'};

function orderCustomerCode(order){
  const s=order?.customerSnapshot||{};
  return code(order?.customerCode||s.accountCode||s.customerCode||s.sageAccountCode||'');
}
function sourceCustomerName(order){
  const s=order?.customerSnapshot||{};
  return text(s.originalName||s.importedName||order?.importedCustomerName||s.sourceName||'');
}
async function assignCodeOwner(customers,accountCode,preferred){
  if(!preferred)return null;
  const now=new Date().toISOString();
  for(const c of customers){
    if(c.id!==preferred.id&&code(c.accountCode)===accountCode){
      c.accountCode='';c.updatedAt=now;await basePutOne('customers',c);
    }
  }
  if(code(preferred.accountCode)!==accountCode){
    preferred.accountCode=accountCode;preferred.updatedAt=now;await basePutOne('customers',preferred);
  }
  return preferred;
}
async function resolveByCode(order,customers){
  const accountCode=orderCustomerCode(order);if(!accountCode)return null;
  const fixedName=stableOwners[accountCode];
  if(fixedName){
    const exact=customers.filter(c=>key(c.name)===fixedName);
    if(exact.length===1)return assignCodeOwner(customers,accountCode,exact[0]);
  }
  const importedName=key(sourceCustomerName(order));
  if(importedName){
    const exactName=customers.filter(c=>key(c.name)===importedName);
    if(exactName.length===1){
      const currentOwners=customers.filter(c=>code(c.accountCode)===accountCode);
      if(currentOwners.length!==1||currentOwners[0].id!==exactName[0].id)return assignCodeOwner(customers,accountCode,exactName[0]);
    }
  }
  const owners=customers.filter(c=>code(c.accountCode)===accountCode);
  return owners.length===1?owners[0]:null;
}
async function relinkOrder(order,showNotice=false){
  if(!order||!imported(order))return order;
  const accountCode=orderCustomerCode(order);if(!accountCode)return order;
  const [customers,jobs,deliveries]=await Promise.all([getAll('customers'),getAll('productionJobs'),getAll('deliveries')]);
  const target=await resolveByCode(order,customers);if(!target)return order;
  const now=new Date().toISOString();
  let changed=order.customerId!==target.id||key(order.customerName)!==key(target.name)||code(order.customerSnapshot?.accountCode)!==accountCode;
  if(changed){
    const snap=order.customerSnapshot||{};
    order={...order,customerId:target.id,customerName:target.name,customerCode:accountCode,customerSnapshot:{...snap,name:target.name,accountCode:accountCode,sageAccountCode:accountCode},updatedAt:now};
    await basePutOne('orders',order);
    for(const j of jobs.filter(j=>j.orderId===order.id&&(j.customerId!==target.id||key(j.customerName)!==key(target.name))))await basePutOne('productionJobs',{...j,customerId:target.id,customerName:target.name,updatedAt:now});
    for(const d of deliveries.filter(d=>d.orderId===order.id&&(d.customerId!==target.id||key(d.customerName)!==key(target.name))))await basePutOne('deliveries',{...d,customerId:target.id,customerName:target.name,updatedAt:now});
    if(showNotice&&typeof notify==='function')notify(`${order.orderNumber||'Order'} linked to ${target.name} by customer code ${accountCode}`);
  }
  return order;
}

window.putOne=async function(store,value){
  if(store!=='orders'||!value||!imported(value))return basePutOne(store,value);
  const accountCode=orderCustomerCode(value);
  if(accountCode){
    const customers=await getAll('customers');
    const target=await resolveByCode(value,customers);
    if(target){
      const snap=value.customerSnapshot||{};
      value={...value,customerId:target.id,customerName:target.name,customerCode:accountCode,customerSnapshot:{...snap,name:target.name,accountCode:accountCode,sageAccountCode:accountCode}};
    }
  }
  const saved=await basePutOne(store,value);
  try{await relinkOrder(value,false);}catch(e){console.warn('Customer-code relink after save failed',e)}
  return saved;
};

async function repairAll(showNotice=false){
  const orders=await getAll('orders');let changed=0,unresolved=0;
  for(const original of orders.filter(imported)){
    const accountCode=orderCustomerCode(original);if(!accountCode)continue;
    const before=original.customerId;
    const after=await relinkOrder(original,false);
    if(after?.customerId!==before)changed++;
    const customers=await getAll('customers');
    if(!(await resolveByCode(after||original,customers)))unresolved++;
  }
  if(showNotice&&typeof notify==='function')notify(unresolved?`${changed} customer links repaired; ${unresolved} customer-code conflict${unresolved===1?'':'s'} need review`:`${changed} customer link${changed===1?'':'s'} repaired by Sage customer code`);
  return{relinked:changed,unresolved};
}
window.repairImportedCustomerLinks=repairAll;
window.strongRepairImportedCustomerLinks=repairAll;
setTimeout(()=>repairAll(false).catch(e=>console.warn('Customer-code startup repair failed',e)),1200);
})();
