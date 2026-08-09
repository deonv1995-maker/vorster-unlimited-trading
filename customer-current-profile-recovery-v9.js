/* V9.0.17 — recover malformed imported customer identity from the current customer profile.
   This specifically covers the case where the PDF row parser stores an address/Sales Rep text as
   the customer name and DEON as the apparent code. The malformed imported customer still carries
   the Sage customer VAT, so that VAT can safely recover an already-known coded customer profile.
*/
(function(){
'use strict';
const basePutOne=window.putOne;
if(typeof basePutOne!=='function')return;
const text=v=>String(v??'').trim();
const code=v=>text(v).toUpperCase().replace(/\s+/g,'');
const vat=v=>text(v).replace(/\D/g,'');
const key=v=>text(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const imported=o=>/sage|job card|import/i.test(`${text(o?.source)} ${text(o?.notes)} ${text(o?.sourceReference)} ${text(o?.customerSnapshot?.source)}`);
const addressLike=v=>/\b(cnr|corner|street|road|drive|avenue|boulevard|unit|farm|plot|highway|route)\b/i.test(text(v))||/^\s*\d+\s+/.test(text(v));
const validAccountCode=v=>{const c=code(v);return /^[A-Z0-9]{3,}$/.test(c)&&/[A-Z]/.test(c)&&/\d/.test(c)&&!['DEON','SALESREP'].includes(c)};
const knownByVat={
  '4820238352':{accountCode:'BH023',name:'BUCO - HONEYDEW'},
  '4450207586':{accountCode:'COL098',name:'COLOURFUL NURSERY HONEYDEW'}
};
function badIdentity(o,current){
  const s=o?.customerSnapshot||{};
  const c=code(o?.customerCode||s.accountCode||s.customerCode||s.sageAccountCode||current?.accountCode||'');
  const n=text(o?.customerName||s.name||current?.name||'');
  return !validAccountCode(c)||addressLike(n)||/\bsales\s*rep\b/i.test(n);
}
async function resolve(order,customers){
  const current=customers.find(c=>c.id===order.customerId);
  if(!badIdentity(order,current))return null;
  const s=order.customerSnapshot||{};
  const wantedVat=vat(order.customerVatNumber||s.vatNumber||current?.vatNumber||'');
  if(!wantedVat)return null;
  const known=knownByVat[wantedVat];
  if(known){
    let hits=customers.filter(c=>code(c.accountCode)===known.accountCode&&!addressLike(c.name));
    if(hits.length===1)return{target:hits[0],accountCode:known.accountCode,wantedVat,current};
    hits=customers.filter(c=>key(c.name)===key(known.name)&&!addressLike(c.name));
    if(hits.length===1)return{target:hits[0],accountCode:known.accountCode,wantedVat,current};
  }
  const hits=customers.filter(c=>c.id!==current?.id&&vat(c.vatNumber)===wantedVat&&validAccountCode(c.accountCode)&&!addressLike(c.name));
  if(hits.length===1)return{target:hits[0],accountCode:code(hits[0].accountCode),wantedVat,current};
  return null;
}
async function repairOrder(order){
  if(!order||!imported(order))return order;
  const [customers,jobs,deliveries]=await Promise.all([getAll('customers'),getAll('productionJobs'),getAll('deliveries')]);
  const r=await resolve(order,customers);if(!r)return order;
  const {target,accountCode,wantedVat,current}=r,now=new Date().toISOString(),snap=order.customerSnapshot||{};
  if(code(target.accountCode)!==accountCode||vat(target.vatNumber)!==wantedVat){
    target.accountCode=accountCode;target.vatNumber=wantedVat;target.updatedAt=now;await basePutOne('customers',target);
  }
  const fixed={...order,customerId:target.id,customerName:target.name,customerCode:accountCode,customerVatNumber:wantedVat,customerSnapshot:{...snap,name:target.name,accountCode,sageAccountCode:accountCode,vatNumber:wantedVat},updatedAt:now,customerIdentityRecoveredFromProfile:true};
  await basePutOne('orders',fixed);
  for(const j of jobs.filter(j=>j.orderId===order.id&&(j.customerId!==target.id||key(j.customerName)!==key(target.name))))await basePutOne('productionJobs',{...j,customerId:target.id,customerName:target.name,updatedAt:now});
  for(const d of deliveries.filter(d=>d.orderId===order.id&&(d.customerId!==target.id||key(d.customerName)!==key(target.name))))await basePutOne('deliveries',{...d,customerId:target.id,customerName:target.name,updatedAt:now});
  if(current&&current.id!==target.id){
    const [allOrders,allJobs,allDeliveries]=await Promise.all([getAll('orders'),getAll('productionJobs'),getAll('deliveries')]);
    const stillUsed=allOrders.some(o=>o.id!==fixed.id&&o.customerId===current.id)||allJobs.some(j=>j.orderId!==fixed.id&&j.customerId===current.id)||allDeliveries.some(d=>d.orderId!==fixed.id&&d.customerId===current.id);
    if(!stillUsed&&(/imported from sage|job card/i.test(text(current.notes))||addressLike(current.name)||/sales\s*rep/i.test(current.name)))try{await deleteOne('customers',current.id)}catch(e){console.warn(e)}
  }
  return fixed;
}
window.putOne=async function(store,value){
  const saved=await basePutOne(store,value);
  if(store==='orders'&&value&&imported(value))try{await repairOrder(value)}catch(e){console.warn('Current-profile customer recovery failed',e)}
  return saved;
};
async function repairAll(showNotice=false){
  const orders=await getAll('orders');let changed=0;
  for(const o of orders.filter(imported)){
    const before=`${o.customerId}|${o.customerName}|${o.customerCode||o.customerSnapshot?.accountCode||''}`;
    const fixed=await repairOrder(o);
    const after=`${fixed.customerId}|${fixed.customerName}|${fixed.customerCode||fixed.customerSnapshot?.accountCode||''}`;
    if(before!==after)changed++;
  }
  if(showNotice&&typeof notify==='function')notify(`${changed} imported customer identit${changed===1?'y':'ies'} repaired from customer code/VAT data`);
  return{relinked:changed};
}
const previous=window.repairImportedCustomerLinks;
window.repairImportedCustomerLinks=async function(showNotice=false){if(typeof previous==='function')try{await previous(false)}catch(e){console.warn(e)}return repairAll(showNotice)};
window.strongRepairImportedCustomerLinks=window.repairImportedCustomerLinks;
setTimeout(()=>repairAll(false).catch(e=>console.warn('Current-profile startup recovery failed',e)),1800);
})();