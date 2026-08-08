/* Version 8.7.1 — reliable customer enrichment from imported job cards.
   Existing good customer data is preserved. Imported data fills gaps, new addresses are retained,
   and each order keeps the delivery-address snapshot supplied by its job card. */
(function(){
  const norm=v=>String(v??'').trim();
  const normKey=v=>norm(v).toLowerCase().replace(/\s+/g,' ');
  const codeKey=v=>norm(v).toUpperCase();
  const first=(...values)=>values.map(value=>Array.isArray(value)?value.filter(Boolean).join(', '):norm(value)).find(Boolean)||'';
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};

  function importedCustomerData(card){
    const nested=obj(card.customer),delivery=obj(card.delivery),shipping=obj(card.shipping);
    const address=first(card.deliveryAddress,card.customerAddress,card.shipToAddress,card.shippingAddress,card.address,delivery.address,shipping.address,nested.deliveryAddress,nested.address);
    const suburb=first(card.suburb,card.deliverySuburb,delivery.suburb,shipping.suburb,nested.suburb);
    const city=first(card.city,card.deliveryCity,delivery.city,shipping.city,nested.city);
    const area=first(card.deliveryArea,card.area,suburb,city,delivery.area,nested.deliveryArea,nested.area);
    const contactPerson=first(card.contactPerson,card.customerContact,card.contactName,card.buyer,nested.contactPerson,nested.contactName,nested.buyer);
    const phone=first(card.phone,card.telephone,card.tel,card.customerPhone,nested.phone,nested.telephone);
    const whatsapp=first(card.whatsapp,nested.whatsapp);
    const email=first(card.email,card.customerEmail,nested.email);
    const vatNumber=first(card.vatNumber,card.customerVatNumber,card.vatNo,nested.vatNumber,nested.vatNo);
    const instructionText=[...(card.instructions||[]),card.notes,card.deliveryInstructions].filter(Boolean).join(' | ');
    const rawPreference=first(card.fulfilmentType,card.deliveryType,card.preference,delivery.type,nested.preference,instructionText);
    const preference=/\bcollect(?:ion)?\b/i.test(rawPreference)?'Collection':(/\bdeliver(?:y|ies)?\b/i.test(rawPreference)?'Delivery':'');
    return{address,suburb,city,area,contactPerson,phone,whatsapp,email,vatNumber,preference,instructionText};
  }

  function locationList(customer){
    const existing=Array.isArray(customer.deliveryLocations)?customer.deliveryLocations:[];
    return existing.map(item=>typeof item==='string'?{label:'Delivery location',address:item}:item).filter(item=>norm(item?.address));
  }
  function addLocation(customer,address,meta,now){
    if(!address)return customer;
    const locations=locationList(customer),key=normKey(address);
    if(!locations.some(location=>normKey(location.address)===key)){
      locations.push({label:meta.area||meta.suburb||meta.city||'Delivery location',address,suburb:meta.suburb||'',city:meta.city||'',area:meta.area||'',source:'Job Card Import',firstSeenAt:now});
    }
    return{...customer,deliveryLocations:locations};
  }

  async function enrichImportedJobCards(cards){
    if(!Array.isArray(cards)||!cards.length)return{customers:0,orders:0,matched:0};
    const now=new Date().toISOString();
    const [customers,orders]=await Promise.all([getAll('customers'),getAll('orders')]);
    const byCode=new Map(customers.filter(c=>c.accountCode).map(c=>[codeKey(c.accountCode),c]));
    const byName=new Map(customers.map(c=>[normKey(c.name),c]));
    const byId=new Map(customers.map(c=>[c.id,c]));
    const ordersByNumber=new Map(orders.map(o=>[codeKey(o.orderNumber),o]));
    let changedCustomers=0,changedOrders=0,matched=0;

    for(const card of cards){
      const order=ordersByNumber.get(codeKey(card.orderNumber));
      const customerCode=codeKey(card.customerCode||card.accountCode);
      const customerName=norm(card.customerName||obj(card.customer).name);
      let customer=(customerCode&&byCode.get(customerCode))||byName.get(normKey(customerName))||(order?.customerId?byId.get(order.customerId):null);
      if(!customer)continue;
      matched++;

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
        if(!norm(updated.primaryDeliveryAddress))updated.primaryDeliveryAddress=first(updated.deliveryAddress,updated.address,meta.address);
        if(!norm(updated.deliveryAddress))updated.deliveryAddress=meta.address;
        if(!norm(updated.address))updated.address=meta.address;
      }
      updated.updatedAt=now;
      if(JSON.stringify(updated)!==JSON.stringify(customer)){
        await putOne('customers',updated);
        changedCustomers++;
        customer=updated;
        byId.set(updated.id,updated);
        if(customerCode)byCode.set(customerCode,updated);
        byName.set(normKey(updated.name),updated);
      }

      if(order){
        const orderAddress=meta.address||first(customer.primaryDeliveryAddress,customer.deliveryAddress,customer.address);
        const patch={...order};
        if(orderAddress){patch.deliveryAddressSnapshot=orderAddress;patch.deliveryAddress=orderAddress;}
        if(meta.area){patch.deliveryArea=meta.area;patch.area=meta.area;}
        else if(meta.suburb||meta.city)patch.deliveryArea=meta.suburb||meta.city;
        if(meta.preference){patch.fulfilmentType=meta.preference;patch.preference=meta.preference;}
        if(meta.contactPerson&&!norm(patch.deliveryContact))patch.deliveryContact=meta.contactPerson;
        if(meta.phone&&!norm(patch.deliveryPhone))patch.deliveryPhone=meta.phone;
        if(meta.instructionText&&!norm(patch.deliveryInstructions))patch.deliveryInstructions=meta.instructionText;
        patch.customerDataImportedAt=now;
        patch.updatedAt=now;
        await putOne('orders',patch);
        ordersByNumber.set(codeKey(card.orderNumber),patch);
        changedOrders++;
      }
    }

    if(typeof reconcilePipelineFromStock==='function'){
      try{await reconcilePipelineFromStock();}catch(error){console.warn('Customer import pipeline refresh failed',error);}
    }
    return{customers:changedCustomers,orders:changedOrders,matched};
  }

  // IMPORTANT: reassign the actual global function binding used by the inline Import button,
  // not only window.commitJobCardImport. This was the reason V8.6.4 could import orders without
  // running the customer enrichment pass.
  if(typeof commitJobCardImport==='function'){
    const baseCommitJobCardImport=commitJobCardImport;
    commitJobCardImport=async function(){
      let snapshot=[];
      try{
        if(typeof pendingJobCardImport!=='undefined'&&Array.isArray(pendingJobCardImport)){
          snapshot=pendingJobCardImport.map(card=>typeof structuredClone==='function'?structuredClone(card):JSON.parse(JSON.stringify(card)));
        }
      }catch(error){console.warn('Could not snapshot import data for customer enrichment',error);}

      await baseCommitJobCardImport();

      if(snapshot.length){
        const result=await enrichImportedJobCards(snapshot);
        const message=`Customer update complete: ${result.matched} matched · ${result.customers} customer records changed · ${result.orders} order addresses linked`;
        if(typeof notify==='function')notify(message);
        console.info(message);
      }
    };
    window.commitJobCardImport=commitJobCardImport;
  }

  window.enrichImportedJobCards=enrichImportedJobCards;
  window.vuImportedCustomerData=importedCustomerData;
})();