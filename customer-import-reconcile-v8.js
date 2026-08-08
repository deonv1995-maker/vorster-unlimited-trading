/* Version 8.7.5 — verified customer reconciliation after job-card import.
   One canonical customer per Sage account/customer identity.
   Imported customer metadata is persisted, orders are re-linked, and safe legacy duplicates are removed.
*/
(function(){
  const text=v=>String(v??'').trim();
  const nameKey=v=>text(v).toLowerCase().replace(/\s+/g,' ');
  const codeKey=v=>text(v).toUpperCase();
  const sameName=(a,b)=>nameKey(a)===nameKey(b);

  function metaFromCard(card){
    const address=text(card.customerAddress||card.deliveryAddress||card.address);
    const deliveryAddress=text(card.deliveryAddress||card.customerAddress||card.address);
    const area=text(card.deliveryArea||card.area||card.suburb||card.city);
    const vatNumber=text(card.customerVatNumber||card.vatNumber||card.vatNo);
    const contactPerson=text(card.contactPerson||card.customerContact||card.contactName||card.buyer);
    const phone=text(card.phone||card.telephone||card.tel||card.customerPhone);
    const whatsapp=text(card.whatsapp)||phone;
    const email=text(card.email||card.customerEmail);
    const instructions=[...(Array.isArray(card.instructions)?card.instructions:[]),card.deliveryInstructions,card.notes].filter(Boolean).join(' | ');
    const rawPreference=text(card.fulfilmentType||card.deliveryType||card.preference||instructions);
    const preference=/collect/i.test(rawPreference)?'Collection':(/deliver/i.test(rawPreference)?'Delivery':'');
    return{address,deliveryAddress,area,vatNumber,contactPerson,phone,whatsapp,email,preference,instructions};
  }

  function mergeExistingFields(target,source){
    if(!source)return target;
    const fields=['contactPerson','phone','whatsapp','email','vatNumber','address','deliveryAddress','primaryDeliveryAddress','deliveryArea','area','suburb','city'];
    for(const field of fields){if(!text(target[field])&&text(source[field]))target[field]=source[field];}
    if(!text(target.preference)&&text(source.preference))target.preference=source.preference;
    return target;
  }

  function addDeliveryLocation(customer,address,area,now){
    if(!address)return customer;
    const locations=(Array.isArray(customer.deliveryLocations)?customer.deliveryLocations:[])
      .map(item=>typeof item==='string'?{label:'Delivery location',address:item}:item)
      .filter(item=>text(item?.address));
    const key=nameKey(address);
    if(!locations.some(item=>nameKey(item.address)===key))locations.push({label:area||'Delivery location',address,area:area||'',source:'Job Card Import',firstSeenAt:now});
    customer.deliveryLocations=locations;
    return customer;
  }

  async function reconcileImportedCustomers(cards){
    if(!Array.isArray(cards)||!cards.length)return{matched:0,updated:0,verified:0,duplicatesRemoved:0,ordersRelinked:0,missing:[]};
    const now=new Date().toISOString();
    let customers=await getAll('customers');
    let orders=await getAll('orders');
    let matched=0,updated=0,verified=0,duplicatesRemoved=0,ordersRelinked=0;
    const missing=[];

    for(const card of cards){
      const cardCode=codeKey(card.customerCode||card.accountCode);
      const cardName=text(card.customerName||card.customer?.name);
      const cardOrderNo=codeKey(card.orderNumber);
      const meta=metaFromCard(card);
      const order=orders.find(o=>codeKey(o.orderNumber)===cardOrderNo);

      // Safe candidate rule: exact Sage code, or exact name only where the stored record has no conflicting Sage code.
      const candidates=customers.filter(c=>{
        const storedCode=codeKey(c.accountCode);
        if(cardCode&&storedCode===cardCode)return true;
        if(sameName(c.name,cardName)&&(!storedCode||!cardCode||storedCode===cardCode))return true;
        return false;
      });
      if(order?.customerId){
        const linked=customers.find(c=>c.id===order.customerId);
        if(linked&&sameName(linked.name,cardName)&&!candidates.some(c=>c.id===linked.id))candidates.unshift(linked);
      }
      if(!candidates.length){missing.push(`${card.orderNumber}: ${cardName}`);continue;}
      matched++;

      // Prefer the customer already linked to this order, then exact Sage-code record, then first safe name match.
      let canonical=(order?.customerId&&candidates.find(c=>c.id===order.customerId))||candidates.find(c=>cardCode&&codeKey(c.accountCode)===cardCode)||candidates[0];
      let merged={...canonical};
      for(const candidate of candidates)if(candidate.id!==canonical.id)merged=mergeExistingFields(merged,candidate);

      if(cardCode)merged.accountCode=text(card.customerCode||card.accountCode);
      if(cardName)merged.name=cardName;
      if(meta.vatNumber)merged.vatNumber=meta.vatNumber;
      if(meta.contactPerson)merged.contactPerson=meta.contactPerson;
      if(meta.phone)merged.phone=meta.phone;
      if(meta.whatsapp)merged.whatsapp=meta.whatsapp;
      if(meta.email)merged.email=meta.email;
      if(meta.address)merged.address=meta.address;
      if(meta.deliveryAddress){merged.deliveryAddress=meta.deliveryAddress;merged.primaryDeliveryAddress=meta.deliveryAddress;}
      if(meta.area){merged.deliveryArea=meta.area;merged.area=meta.area;}
      if(meta.preference)merged.preference=meta.preference;
      if(/^Created from imported Sage job card/i.test(text(merged.notes)))merged.notes='Imported from Sage job card. Customer details maintained from source job cards.';
      merged.updatedAt=now;
      addDeliveryLocation(merged,meta.deliveryAddress||meta.address,meta.area,now);
      await putOne('customers',merged);
      updated++;

      // Re-link all orders from safe duplicate customer IDs before deleting duplicates.
      const duplicateIds=candidates.filter(c=>c.id!==merged.id).map(c=>c.id);
      for(const existingOrder of orders){
        if(existingOrder.customerId===merged.id||duplicateIds.includes(existingOrder.customerId)||codeKey(existingOrder.orderNumber)===cardOrderNo){
          if(existingOrder.customerId!==merged.id||existingOrder.customerName!==merged.name){
            existingOrder.customerId=merged.id;existingOrder.customerName=merged.name;ordersRelinked++;
          }
          if(codeKey(existingOrder.orderNumber)===cardOrderNo){
            const deliveryAddress=meta.deliveryAddress||meta.address||merged.primaryDeliveryAddress||merged.deliveryAddress||merged.address||'';
            if(deliveryAddress){existingOrder.deliveryAddressSnapshot=deliveryAddress;existingOrder.deliveryAddress=deliveryAddress;}
            if(meta.area){existingOrder.deliveryArea=meta.area;existingOrder.area=meta.area;}
            if(meta.contactPerson)existingOrder.deliveryContact=meta.contactPerson;
            if(meta.phone)existingOrder.deliveryPhone=meta.phone;
            if(meta.preference){existingOrder.fulfilmentType=meta.preference;existingOrder.preference=meta.preference;}
            existingOrder.customerDataImportedAt=now;
          }
          existingOrder.updatedAt=now;
          await putOne('orders',existingOrder);
        }
      }
      for(const id of duplicateIds){await deleteOne('customers',id);duplicatesRemoved++;}

      // Verify persisted fields from IndexedDB, not just the in-memory object.
      const persisted=await getOne('customers',merged.id);
      const expected=[meta.vatNumber,meta.contactPerson,meta.phone,meta.address,meta.deliveryAddress].filter(Boolean);
      const actual=[persisted?.vatNumber,persisted?.contactPerson,persisted?.phone,persisted?.address,persisted?.deliveryAddress].filter(Boolean);
      if(!expected.length||actual.length)verified++;

      customers=await getAll('customers');
      orders=await getAll('orders');
    }
    return{matched,updated,verified,duplicatesRemoved,ordersRelinked,missing};
  }

  if(typeof commitJobCardImport==='function'){
    const base=commitJobCardImport;
    commitJobCardImport=async function(){
      let snapshot=[];
      try{if(Array.isArray(pendingJobCardImport))snapshot=pendingJobCardImport.map(x=>JSON.parse(JSON.stringify(x)));}catch(e){console.warn('Customer reconciliation snapshot failed',e);}
      await base();
      if(!snapshot.length)return;
      const result=await reconcileImportedCustomers(snapshot);
      const message=`Customer verification: ${result.verified}/${result.matched} persisted · ${result.duplicatesRemoved} duplicate records removed · ${result.ordersRelinked} orders re-linked`;
      console.info(message,result);
      if(typeof notify==='function')notify(message);
      // Give a durable result because mobile toasts can disappear quickly.
      setTimeout(()=>alert(`${message}${result.missing.length?`\n\nUnmatched:\n${result.missing.join('\n')}`:''}`),150);
    };
    window.commitJobCardImport=commitJobCardImport;
  }

  window.reconcileImportedCustomers=reconcileImportedCustomers;
})();