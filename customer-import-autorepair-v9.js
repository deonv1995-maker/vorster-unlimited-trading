/* V9.0.14 — strict Sage customer identity matching.
   Imported orders may only auto-relink on stable identity evidence. Area/suburb similarity
   is never an identity signal because separate customers can share the same branch area.
*/
(function(){
  const basePutOne=putOne;
  const text=v=>String(v??'').trim();
  const key=v=>text(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const code=v=>text(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const vat=v=>text(v).replace(/\D/g,'');
  const addressLike=v=>/\b(cnr|corner|street|road|drive|avenue|boulevard|unit|farm|plot|highway|route)\b/i.test(text(v))||/^\s*\d+\s+/.test(text(v));
  const imported=o=>/sage|job card/i.test(text(o?.source))||/imported from job card/i.test(text(o?.notes));

  // Stable Sage identities confirmed from imported source documents. Keep this registry
  // inside the import identity layer so account-code ownership cannot drift between customers.
  const SAGE_IDENTITIES={
    BH023:{name:'buco honeydew'}
  };

  function profileMatchesIdentity(customer,accountCode){
    const known=SAGE_IDENTITIES[accountCode];
    return !!known&&key(customer?.name)===known.name;
  }

  async function normalizeKnownIdentity(customers,accountCode){
    const known=SAGE_IDENTITIES[accountCode];
    if(!known)return null;
    const matches=customers.filter(c=>key(c.name)===known.name);
    if(matches.length!==1)return null;
    const target=matches[0];
    // Remove a wrongly learned account code from any other customer before assigning it.
    for(const c of customers){
      if(c.id!==target.id&&code(c.accountCode)===accountCode){c.accountCode='';c.updatedAt=new Date().toISOString();await basePutOne('customers',c);}
    }
    if(code(target.accountCode)!==accountCode){target.accountCode=accountCode;target.updatedAt=new Date().toISOString();await basePutOne('customers',target);}
    return target;
  }

  function chooseByProfile(order,current,customers){
    const s=order.customerSnapshot||{};
    const wantedCode=code(s.accountCode||order.customerCode||'');
    const wantedVat=vat(order.customerVatNumber||s.vatNumber||'');
    const rawName=text(s.originalName||s.importedName||s.name||order.importedCustomerName||order.customerName||'');
    const wantedName=!addressLike(rawName)?key(rawName):'';

    if(wantedCode){
      const hits=customers.filter(c=>code(c.accountCode)===wantedCode);
      if(hits.length===1)return hits[0];
      if(hits.length>1)return null;
    }
    if(wantedVat){
      const hits=customers.filter(c=>vat(c.vatNumber)===wantedVat);
      if(hits.length===1)return hits[0];
      if(hits.length>1)return null;
    }
    if(wantedName){
      const hits=customers.filter(c=>key(c.name)===wantedName);
      if(hits.length===1)return hits[0];
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
    const s=order.customerSnapshot||{};
    const wantedCode=code(s.accountCode||order.customerCode||'');

    // A confirmed Sage account registry takes precedence over any previously contaminated
    // customer profile/history. This repairs the BUCO Honeydew / Colourful Honeydew mix-up.
    let target=wantedCode?await normalizeKnownIdentity(customers,wantedCode):null;
    if(!target)target=chooseByProfile(order,current,customers);
    if(!target||target.id===current.id)return order;

    const snap=order.customerSnapshot||{},now=new Date().toISOString(),oldId=current.id;
    if(!text(target.accountCode)&&wantedCode)target.accountCode=wantedCode;
    if(!text(target.vatNumber)&&text(order.customerVatNumber||snap.vatNumber))target.vatNumber=text(order.customerVatNumber||snap.vatNumber);
    if(!text(target.deliveryAddress)&&text(order.deliveryAddress||snap.deliveryAddress))target.deliveryAddress=text(order.deliveryAddress||snap.deliveryAddress);
    target.updatedAt=now;await basePutOne('customers',target);

    order.customerId=target.id;order.customerName=target.name;
    order.customerSnapshot={...snap,name:target.name,accountCode:text(wantedCode||target.accountCode),vatNumber:text(order.customerVatNumber||snap.vatNumber||target.vatNumber)};
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