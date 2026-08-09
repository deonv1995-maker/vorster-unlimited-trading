/* V9.0.14 — strict Sage customer identity matching.
   Imported orders may only auto-relink on stable identity evidence: Sage account code,
   VAT number, or an exact normalized customer name when no stable identifier exists.
   Area/branch similarity is deliberately never sufficient because different customers can
   share the same suburb (for example BUCO Honeydew and Colourful Honeydew).
*/
(function(){
  const basePutOne=putOne;
  const text=v=>String(v??'').trim();
  const key=v=>text(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const code=v=>text(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const vat=v=>text(v).replace(/\D/g,'');
  const addressLike=v=>/\b(cnr|corner|street|road|drive|avenue|boulevard|unit|farm|plot|highway|route)\b/i.test(text(v))||/^\s*\d+\s+/.test(text(v));
  const imported=o=>/sage|job card/i.test(text(o?.source))||/imported from job card/i.test(text(o?.notes));

  function evidenceFor(customer,orders){
    const linked=orders.filter(o=>o.customerId===customer.id);
    const codes=new Set(),vats=new Set(),names=new Set([key(customer.name)].filter(Boolean));
    if(customer.accountCode)codes.add(code(customer.accountCode));
    if(customer.vatNumber)vats.add(vat(customer.vatNumber));
    for(const o of linked){
      const s=o.customerSnapshot||{};
      [s.accountCode,o.customerCode].filter(Boolean).forEach(x=>codes.add(code(x)));
      [s.vatNumber,o.customerVatNumber].filter(Boolean).forEach(x=>vats.add(vat(x)));
      [s.name,o.customerName].filter(Boolean).forEach(x=>names.add(key(x)));
    }
    return{customer,codes,vats,names};
  }

  function chooseTarget(order,current,customers,orders){
    const s=order.customerSnapshot||{};
    const wantedCode=code(s.accountCode||order.customerCode||'');
    const wantedVat=vat(order.customerVatNumber||s.vatNumber||'');
    const rawName=text(s.originalName||s.importedName||s.name||order.importedCustomerName||order.customerName||'');
    const wantedName=!addressLike(rawName)?key(rawName):'';
    const evidence=customers.map(c=>evidenceFor(c,orders));

    // Stable identifiers are authoritative. If more than one customer carries the same
    // identifier we stop rather than guess and corrupt another customer's history.
    if(wantedCode){
      const hits=evidence.filter(e=>e.codes.has(wantedCode));
      if(hits.length===1)return hits[0].customer;
      if(hits.length>1)return null;
    }
    if(wantedVat){
      const hits=evidence.filter(e=>e.vats.has(wantedVat));
      if(hits.length===1)return hits[0].customer;
      if(hits.length>1)return null;
    }
    if(wantedName){
      const hits=evidence.filter(e=>e.names.has(wantedName));
      if(hits.length===1)return hits[0].customer;
    }
    return null;
  }

  async function repairOrder(orderId){
    const [order,customers,orders,jobs,deliveries]=await Promise.all([
      getOne('orders',orderId),getAll('customers'),getAll('orders'),getAll('productionJobs'),getAll('deliveries')
    ]);
    if(!order||!imported(order))return order;
    const current=customers.find(c=>c.id===order.customerId);
    if(!current)return order;
    const target=chooseTarget(order,current,customers,orders);
    if(!target||target.id===current.id)return order;

    const snap=order.customerSnapshot||{},now=new Date().toISOString(),oldId=current.id;
    if(!text(target.accountCode)&&text(snap.accountCode||order.customerCode))target.accountCode=text(snap.accountCode||order.customerCode);
    if(!text(target.vatNumber)&&text(order.customerVatNumber||snap.vatNumber))target.vatNumber=text(order.customerVatNumber||snap.vatNumber);
    if(!text(target.deliveryAddress)&&text(order.deliveryAddress||snap.deliveryAddress))target.deliveryAddress=text(order.deliveryAddress||snap.deliveryAddress);
    target.updatedAt=now;await basePutOne('customers',target);

    order.customerId=target.id;order.customerName=target.name;
    order.customerSnapshot={...snap,name:target.name,accountCode:text(snap.accountCode||order.customerCode||target.accountCode),vatNumber:text(order.customerVatNumber||snap.vatNumber||target.vatNumber)};
    order.updatedAt=now;await basePutOne('orders',order);
    for(const j of jobs.filter(j=>j.orderId===order.id&&j.customerId!==target.id)){j.customerId=target.id;j.customerName=target.name;j.updatedAt=now;await basePutOne('productionJobs',j);}
    for(const d of deliveries.filter(d=>d.orderId===order.id&&d.customerId!==target.id)){d.customerId=target.id;d.customerName=target.name;d.updatedAt=now;await basePutOne('deliveries',d);}

    const stillUsed=orders.some(o=>o.id!==order.id&&o.customerId===oldId)||jobs.some(j=>j.customerId===oldId)||deliveries.some(d=>d.customerId===oldId);
    if(!stillUsed&&(addressLike(current.name)||/imported from sage|job card/i.test(text(current.notes))))await deleteOne('customers',oldId);
    return order;
  }

  putOne=async function(store,value){
    const saved=await basePutOne(store,value);
    if(store==='orders'&&value?.id&&imported(value)){
      try{return await repairOrder(value.id)||saved;}catch(err){console.warn('Imported customer auto-repair failed',err);}
    }
    return saved;
  };

  window.repairImportedCustomerLinks=async function(showNotice=false){
    const orders=await getAll('orders');let changed=0;
    for(const o of orders.filter(imported)){
      const before=o.customerId,after=await repairOrder(o.id);if(after&&after.customerId!==before)changed++;
    }
    if(showNotice)notify(changed?`Customer links repaired: ${changed} order${changed===1?'':'s'}`:'No imported customer links needed repair');
    return{relinked:changed};
  };

  setTimeout(()=>window.repairImportedCustomerLinks(false).catch(err=>console.warn('Startup customer repair failed',err)),0);
})();