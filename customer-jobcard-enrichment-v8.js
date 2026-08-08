/* Version 8.6.4 — enrich customer master data from imported job cards.
   Existing good customer data is preserved. Imported data fills gaps, new addresses are retained,
   and each order keeps the delivery-address snapshot supplied by its job card. */
(function(){
  const norm=v=>String(v??'').trim();
  const normKey=v=>norm(v).toLowerCase().replace(/\s+/g,' ');
  const codeKey=v=>norm(v).toUpperCase();
  const first=(...values)=>values.map(value=>Array.isArray(value)?value.filter(Boolean).join(', '):norm(value)).find(Boolean)||'';
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};

  function importedCustomerData(card){
    const nested=obj(card.customer);
    const delivery=obj(card.delivery);
    const shipping=obj(card.shipping);
    const address=first(
      card.deliveryAddress,card.customerAddress,card.shipToAddress,card.shippingAddress,card.address,
      delivery.address,shipping.address,nested.deliveryAddress,nested.address
    );
    const suburb=first(card.suburb,card.deliverySuburb,delivery.suburb,shipping.suburb,nested.suburb);
    const city=first(card.city,card.deliveryCity,delivery.city,shipping.city,nested.city);
    const area=first(card.deliveryArea,card.area,suburb,city,delivery.area,nested.deliveryArea,nested.area);
    const contactPerson=first(card.contactPerson,card.customerContact,card.contactName,card.buyer,nested.contactPerson,nested.contactName,nested.buyer);
    const phone=first(card.phone,card.telephone,card.tel,card.customerPhone,nested.phone,nested.telephone);
    const whatsapp=first(card.whatsapp,nested.whatsapp);
    const email=first(card.email,card.customerEmail,nested.email);
    const vatNumber=first(card.vatNumber,card.customerVatNumber,card.vatNo,nested.vatNumber,nested.vatNo);
    const rawPreference=first(card.fulfilmentType,card.deliveryType,card.preference,delivery.type,nested.preference);
    const preference=/collect/i.test(rawPreference)?'Collection':(/deliver/i.test(rawPreference)?'Delivery':'');
    return{address,suburb,city,area,contactPerson,phone,whatsapp,email,vatNumber,preference};
  }

  function locationList(customer){
    const existing=Array.isArray(customer.deliveryLocations)?customer.deliveryLocations:[];
    return existing.map(item=>typeof item==='string'?{label:'Delivery location',address:item}:item).filter(item=>norm(item?.address));
  }

  function addLocation(customer,address,meta,now){
    if(!address)return customer;
    const locations=locationList(customer);
    const key=normKey(address);
    if(!locations.some(location=>normKey(location.address)===key)){
      locations.push({label:meta.area||meta.suburb||meta.city||'Delivery location',address,suburb:meta.suburb||'',city:meta.city||'',area:meta.area||'',source:'Job Card Import',firstSeenAt:now});
    }
    return{...customer,deliveryLocations:locations};
  }

  async function enrichImportedJobCards(cards){
    if(!Array.isArray(cards)||!cards.length)return{customers:0,orders:0};
    const now=new Date().toISOString();
    const [customers,orders]=await Promise.all([getAll('customers'),getAll('orders')]);
    const byCode=new Map(customers.filter(c=>c.accountCode).map(c=>[codeKey(c.accountCode),c]));
    const byName=new Map(customers.map(c=>[normKey(c.name),c]));
    const ordersByNumber=new Map(orders.map(o=>[codeKey(o.orderNumber),o]));
    let changedCustomers=0,changedOrders=0;

    for(const card of cards){
      const customerCode=codeKey(card.customerCode||card.accountCode);
      const customerName=norm(card.customerName||obj(card.customer).name);
      let customer=(customerCode&&byCode.get(customerCode))||byName.get(normKey(customerName));
      if(!customer)continue; // Base importer creates it first.
      const meta=importedCustomerData(card);
      let updated={...customer};
      const fill=(field,value)=>{if(value&&!norm(updated[field]))updated[field]=value;};
      fill('accountCode',card.customerCode||card.accountCode);
      fill('contactPerson',meta.contactPerson);
      fill('phone',meta.phone);
      fill('whatsapp',meta.whatsapp||meta.phone);
      fill('email',meta.email);
      fill('vatNumber',meta.vatNumber);
      fill('suburb',meta.suburb);
      fill('city',meta.city);
      fill('deliveryArea',meta.area);
      fill('area',meta.area);
      fill('preference',meta.preference);

      if(meta.address){
        updated=addLocation(updated,meta.address,meta,now);
        if(!norm(updated.primaryDeliveryAddress)&&!norm(updated.deliveryAddress)&&!norm(updated.address)){
          updated.primaryDeliveryAddress=meta.address;
          updated.deliveryAddress=meta.address;
          updated.address=meta.address; // legacy field used by route/area intelligence
        } else if(!norm(updated.primaryDeliveryAddress)){
          updated.primaryDeliveryAddress=first(updated.deliveryAddress,updated.address,meta.address);
        }
      }
      updated.updatedAt=now;
      if(JSON.stringify(updated)!==JSON.stringify(customer)){
        await putOne('customers',updated);changedCustomers++;
        customer=updated;
        if(customerCode)byCode.set(customerCode,updated);byName.set(normKey(updated.name),updated);
      }

      const order=ordersByNumber.get(codeKey(card.orderNumber));
      if(order){
        const orderAddress=meta.address||first(customer.primaryDeliveryAddress,customer.deliveryAddress,customer.address);
        const patch={...order};
        if(orderAddress){patch.deliveryAddressSnapshot=orderAddress;patch.deliveryAddress=orderAddress;}
        if(meta.area){patch.deliveryArea=meta.area;patch.area=meta.area;}
        else if(meta.suburb||meta.city){patch.deliveryArea=meta.suburb||meta.city;}
        if(meta.preference){patch.fulfilmentType=meta.preference;patch.preference=meta.preference;}
        if(meta.contactPerson&&!norm(patch.deliveryContact))patch.deliveryContact=meta.contactPerson;
        if(meta.phone&&!norm(patch.deliveryPhone))patch.deliveryPhone=meta.phone;
        patch.customerDataImportedAt=now;patch.updatedAt=now;
        await putOne('orders',patch);ordersByNumber.set(codeKey(card.orderNumber),patch);changedOrders++;
      }
    }
    if(typeof reconcilePipelineFromStock==='function'){
      try{await reconcilePipelineFromStock();}catch(error){console.warn('Customer import pipeline refresh failed',error);}
    }
    return{customers:changedCustomers,orders:changedOrders};
  }

  const baseCommit=window.commitJobCardImport;
  if(typeof baseCommit==='function'){
    window.commitJobCardImport=async function(){
      let snapshot=[];
      try{if(typeof pendingJobCardImport!=='undefined'&&Array.isArray(pendingJobCardImport))snapshot=pendingJobCardImport.map(card=>structuredClone?structuredClone(card):JSON.parse(JSON.stringify(card)));}catch(_){ }
      await baseCommit();
      if(snapshot.length){
        const result=await enrichImportedJobCards(snapshot);
        if(typeof notify==='function')notify(`Customer details updated: ${result.customers} · Order addresses linked: ${result.orders}`);
      }
    };
  }

  window.enrichImportedJobCards=enrichImportedJobCards;
  window.vuImportedCustomerData=importedCustomerData;
})();