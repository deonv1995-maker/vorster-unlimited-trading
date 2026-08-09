/* V9.0.16 — recover customer identity when the PDF row joiner misreads “Sales Rep: DEON” as the customer identity.
   The real Sage account code remains authoritative. VAT is used only to recover that code/profile when
   the parser produced an impossible non-account code or an address-like customer name.
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

// Confirmed Sage identities from source job cards currently in use.
const knownByVat={
  '4820238352':{accountCode:'BH023',name:'BUCO - HONEYDEW'},
  '4450207586':{accountCode:'COL098',name:'COLOURFUL NURSERY HONEYDEW'}
};

function orderVat(o){const s=o?.customerSnapshot||{};return vat(o?.customerVatNumber||s.vatNumber||'');}
function badIdentity(o){
  const s=o?.customerSnapshot||{},c=code(o?.customerCode||s.accountCode||s.customerCode||s.sageAccountCode||'');
  const n=text(o?.customerName||s.name||'');
  return !validAccountCode(c)||addressLike(n)||/\bsales\s*rep\b/i.test(n);
}
async function findTarget(o,customers){
  const wantedVat=orderVat(o),known=knownByVat[wantedVat];
  if(known){
    let exact=customers.filter(c=>code(c.accountCode)===known.accountCode);
    if(exact.length===1)return{customer:exact[0],accountCode:known.accountCode};
    exact=customers.filter(c=>key(c.name)===key(known.name));
    if(exact.length===1)return{customer:exact[0],accountCode:known.accountCode};
  }
  if(wantedVat){
    const exact=customers.filter(c=>vat(c.vatNumber)===wantedVat&&!addressLike(c.name));
    if(exact.length===1&&validAccountCode(exact[0].accountCode))return{customer:exact[0],accountCode:code(exact[0].accountCode)};
  }
  return null;
}
async function repairOrder(o){
  if(!o||!imported(o)||!badIdentity(o))return o;
  const [customers,jobs,deliveries]=await Promise.all([getAll('customers'),getAll('productionJobs'),getAll('deliveries')]);
  const resolved=await findTarget(o,customers);if(!resolved)return o;
  const target=resolved.customer,accountCode=resolved.accountCode,now=new Date().toISOString();
  let targetChanged=false;
  if(code(target.accountCode)!==accountCode){target.accountCode=accountCode;targetChanged=true;}
  const wantedVat=orderVat(o);if(wantedVat&&vat(target.vatNumber)!==wantedVat){target.vatNumber=wantedVat;targetChanged=true;}
  if(targetChanged){target.updatedAt=now;await basePutOne('customers',target);}
  const snap=o.customerSnapshot||{};
  const fixed={...o,customerId:target.id,customerName:target.name,customerCode:accountCode,customerSnapshot:{...snap,name:target.name,accountCode,sageAccountCode:accountCode,vatNumber:wantedVat||snap.vatNumber},updatedAt:now,customerIdentityRecovered:true};
  await basePutOne('orders',fixed);
  for(const j of jobs.filter(j=>j.orderId===o.id&&(j.customerId!==target.id||key(j.customerName)!==key(target.name))))await basePutOne('productionJobs',{...j,customerId:target.id,customerName:target.name,updatedAt:now});
  for(const d of deliveries.filter(d=>d.orderId===o.id&&(d.customerId!==target.id||key(d.customerName)!==key(target.name))))await basePutOne('deliveries',{...d,customerId:target.id,customerName:target.name,updatedAt:now});
  return fixed;
}

window.putOne=async function(store,value){
  const saved=await basePutOne(store,value);
  if(store==='orders'&&value&&imported(value)){
    try{await repairOrder(value);}catch(e){console.warn('Customer parser recovery after save failed',e)}
  }
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
  if(showNotice&&typeof notify==='function')notify(`${changed} imported customer identit${changed===1?'y':'ies'} repaired from Sage account data`);
  return{relinked:changed};
}
const previous=window.repairImportedCustomerLinks;
window.repairImportedCustomerLinks=async function(showNotice=false){if(typeof previous==='function')try{await previous(false)}catch(e){console.warn(e)}return repairAll(showNotice)};
window.strongRepairImportedCustomerLinks=window.repairImportedCustomerLinks;
setTimeout(()=>repairAll(false).catch(e=>console.warn('Customer parser startup recovery failed',e)),1500);
})();