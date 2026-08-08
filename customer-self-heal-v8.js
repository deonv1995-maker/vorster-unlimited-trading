/* Version 8.7.6 — repair blank customer master fields from linked imported order snapshots. */
(function(){
  const txt=v=>String(v??'').trim();
  async function repairCustomerFromOrders(customerId){
    if(!customerId)return null;
    const [customer,orders]=await Promise.all([getOne('customers',customerId),getAll('orders')]);
    if(!customer)return null;
    const linked=orders.filter(o=>o.customerId===customerId&&o.customerSnapshot).sort((a,b)=>String(b.customerDataImportedAt||b.updatedAt||'').localeCompare(String(a.customerDataImportedAt||a.updatedAt||'')));
    if(!linked.length)return customer;
    const snap=linked[0].customerSnapshot||{};
    const updated={...customer};
    const fill=(field,value)=>{if(!txt(updated[field])&&txt(value))updated[field]=value;};
    fill('accountCode',snap.accountCode);fill('vatNumber',snap.vatNumber);fill('contactPerson',snap.contactPerson);fill('phone',snap.phone);fill('whatsapp',snap.whatsapp||snap.phone);fill('email',snap.email);fill('address',snap.address);fill('deliveryAddress',snap.deliveryAddress);fill('primaryDeliveryAddress',snap.deliveryAddress);fill('deliveryArea',snap.deliveryArea);fill('area',snap.deliveryArea);fill('preference',snap.preference);
    if(/^Created from imported Sage job card/i.test(txt(updated.notes)))updated.notes='Imported from Sage job card. Customer details maintained from source job cards.';
    if(JSON.stringify(updated)!==JSON.stringify(customer)){updated.updatedAt=new Date().toISOString();await putOne('customers',updated);return updated;}
    return customer;
  }

  if(typeof showCustomerForm==='function'){
    const baseForm=showCustomerForm;
    showCustomerForm=async function(id=''){
      if(id)await repairCustomerFromOrders(id);
      return baseForm(id);
    };
    window.showCustomerForm=showCustomerForm;
  }
  if(typeof viewCustomer==='function'){
    const baseView=viewCustomer;
    viewCustomer=async function(id){
      if(id)await repairCustomerFromOrders(id);
      return baseView(id);
    };
    window.viewCustomer=viewCustomer;
  }
  window.repairCustomerFromOrders=repairCustomerFromOrders;
})();