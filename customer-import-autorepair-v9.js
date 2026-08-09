/* V9.0.11 — automatic imported-customer relinking.
   Runs at the order persistence boundary so a Sage import finishes under the correct
   existing customer even when the PDF parser temporarily misreads an address as a name.
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
    const codes=new Set(),vats=new Set(),names=new Set([key(customer.name)]),areas=new Set();
    if(customer.accountCode)codes.add(code(customer.accountCode));
    if(customer.vatNumber)vats.add(vat(customer.vatNumber));
    for(const o of linked){
      const s=o.customerSnapshot||{};
      [s.accountCode,o.customerCode].filter(Boolean).forEach(x=>codes.add(code(x)));
      [s.vatNumber,o.customerVatNumber].filter(Boolean).forEach(x=>vats.add(vat(x)));
      [s.name,o.customerName].filter(Boolean).forEach(x=>names.add(key(x)));
      [s.deliveryArea,o.deliveryArea,o.area].filter(Boolean).forEach(x=>areas.add(key(x)));
    }
    return{customer,codes,vats,names,areas};
  }

  function scoreCandidate(order,current,e){
    if(e.customer.id===current?.id)return -1;
    const s=order.customerSnapshot||{};
    const wantedCode=code(s.accountCode||order.customerCode||current?.accountCode);
    const wantedVat=vat(order.customerVatNumber||s.vatNumber||current?.vatNumber);
    const rawNames=[s.name,order.customerName,current?.name].filter(Boolean);
    const wantedNames=rawNames.filter(n=>!addressLike(n)).map(key).filter(Boolean);
    const area=key(order.deliveryArea||order.area||s.deliveryArea||'');
    let score=0;
    if(wantedCode&&e.codes.has(wantedCode))score+=100;
    if(wantedVat&&e.vats.has(wantedVat))score+=90;
    for(const n of wantedNames){if(e.names.has(n))score=Math.max(score,80);}
    if(area&&(e.areas.has(area)||key(e.customer.name).includes(area)))score=Math.max(score,45);
    const source=key(rawNames.join(' '));
    const branch=area||wantedNames.find(n=>n.includes('honeydew'))||'';
    if(branch&&source.includes('buco')){
      const cname=key(e.customer.name);
      if(cname.includes('buco')&&cname.includes(branch))score=Math.max(score,70);
    }
    return score;
  }

  async function repairOrder(orderId){
    const [order,customers,orders,jobs,deliveries]=await Promise.all([
      getOne('orders',orderId),getAll('customers'),getAll('orders'),getAll('productionJobs'),getAll('deliveries')
    ]);
    if(!order||!imported(order))return order;
    const current=customers.find(c=>c.id===order.customerId);
    if(!current)return order;
    const ranked=customers.map(c=>evidenceFor(c,orders)).map(e=>({e,score:scoreCandidate(order,current,e)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(!ranked.length||ranked[0].score<45)return order;
    if(ranked[1]&&ranked[1].score===ranked[0].score)return order;
    const target=ranked[0].e.customer;
    if(target.id===current.id)return order;

    const snap=order.customerSnapshot||{},now=new Date().toISOString();
    if(!text(target.accountCode)&&text(snap.accountCode))target.accountCode=text(snap.accountCode);
    if(!text(target.vatNumber)&&text(order.customerVatNumber||snap.vatNumber))target.vatNumber=text(order.customerVatNumber||snap.vatNumber);
    if(!text(target.deliveryAddress)&&text(order.deliveryAddress||snap.deliveryAddress))target.deliveryAddress=text(order.deliveryAddress||snap.deliveryAddress);
    target.updatedAt=now;await basePutOne('customers',target);

    const oldId=order.customerId;
    order.customerId=target.id;order.customerName=target.name;
    order.customerSnapshot={...snap,name:target.name,accountCode:text(snap.accountCode||target.accountCode),vatNumber:text(order.customerVatNumber||snap.vatNumber||target.vatNumber)};
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

  const previousRepair=window.repairImportedCustomerLinks;
  window.repairImportedCustomerLinks=async function(showNotice=false){
    if(typeof previousRepair==='function')await previousRepair(false);
    const orders=await getAll('orders');let changed=0;
    for(const o of orders.filter(imported)){
      const before=o.customerId,after=await repairOrder(o.id);if(after&&after.customerId!==before)changed++;
    }
    if(showNotice)notify(changed?`Customer links repaired: ${changed} order${changed===1?'':'s'}`:'No imported customer links needed repair');
    return{relinked:changed};
  };
})();