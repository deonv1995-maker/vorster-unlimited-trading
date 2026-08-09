/* V9.0.12 — imported customer repair control.
   Ensures the latest repair engine actually runs for existing bad imports and
   rebinds the Settings repair button to the current repair implementation.
*/
(function(){
  const text=v=>String(v??'').trim();
  const vat=v=>text(v).replace(/\D/g,'');
  const key=v=>text(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const addressLike=v=>/\b(cnr|corner|street|road|drive|avenue|boulevard|unit|farm|plot|highway|route)\b/i.test(text(v))||/^\s*\d+\s+/.test(text(v));
  const imported=o=>/sage|job card/i.test(text(o?.source))||/imported from job card/i.test(text(o?.notes));

  async function strongRepairExisting(showNotice=false){
    // First run the latest general repair engine.
    if(typeof window.repairImportedCustomerLinks==='function'){
      try{await window.repairImportedCustomerLinks(false);}catch(e){console.warn(e);}
    }

    const [customers,orders,jobs,deliveries]=await Promise.all([
      getAll('customers'),getAll('orders'),getAll('productionJobs'),getAll('deliveries')
    ]);
    let changed=0,removed=0;

    const customerEvidence=c=>{
      const linked=orders.filter(o=>o.customerId===c.id);
      const vats=new Set([vat(c.vatNumber)].filter(Boolean));
      const names=new Set([key(c.name)].filter(Boolean));
      for(const o of linked){
        const s=o.customerSnapshot||{};
        [o.customerVatNumber,s.vatNumber].map(vat).filter(Boolean).forEach(x=>vats.add(x));
        [o.customerName,s.name].map(key).filter(Boolean).forEach(x=>names.add(x));
      }
      return{c,vats,names};
    };
    const evidence=customers.map(customerEvidence);

    for(const order of orders.filter(imported)){
      const current=customers.find(c=>c.id===order.customerId);
      if(!current||!addressLike(current.name))continue;
      const s=order.customerSnapshot||{};
      const wantedVat=vat(order.customerVatNumber||s.vatNumber||current.vatNumber);

      let candidates=[];
      if(wantedVat)candidates=evidence.filter(e=>e.c.id!==current.id&&e.vats.has(wantedVat));

      // When the malformed customer is an address, prefer one unique non-address
      // customer already carrying the same VAT in either its profile or order history.
      if(candidates.length!==1)continue;
      const target=candidates[0].c;
      if(addressLike(target.name))continue;

      const now=new Date().toISOString(),oldId=current.id;
      order.customerId=target.id;
      order.customerName=target.name;
      order.customerSnapshot={...s,name:target.name,vatNumber:text(order.customerVatNumber||s.vatNumber||target.vatNumber),accountCode:text(s.accountCode||target.accountCode)};
      order.updatedAt=now;
      await putOne('orders',order);

      for(const j of jobs.filter(j=>j.orderId===order.id&&j.customerId!==target.id)){
        j.customerId=target.id;j.customerName=target.name;j.updatedAt=now;await putOne('productionJobs',j);
      }
      for(const d of deliveries.filter(d=>d.orderId===order.id&&d.customerId!==target.id)){
        d.customerId=target.id;d.customerName=target.name;d.updatedAt=now;await putOne('deliveries',d);
      }
      changed++;

      const stillUsed=(await getAll('orders')).some(o=>o.customerId===oldId)||(await getAll('productionJobs')).some(j=>j.customerId===oldId)||(await getAll('deliveries')).some(d=>d.customerId===oldId);
      if(!stillUsed){await deleteOne('customers',oldId);removed++;}
    }

    if(showNotice)notify(changed?`Customer links repaired: ${changed} order${changed===1?'':'s'}`:'No imported customer links needed repair');
    return{relinked:changed,removed};
  }

  const baseCustomersPage=customersPage;
  customersPage=async function(...args){
    await strongRepairExisting(false);
    return baseCustomersPage(...args);
  };

  const baseSettingsPage=settingsPage;
  settingsPage=async function(...args){
    await baseSettingsPage(...args);
    const btn=document.getElementById('repairImportedCustomerLinksBtn');
    if(btn)btn.onclick=async()=>{await strongRepairExisting(true);navigate('customers');};
  };

  // Repair already-imported records once on startup after IndexedDB and modules are ready.
  setTimeout(()=>strongRepairExisting(false).catch(e=>console.warn('Startup customer repair failed',e)),800);
  window.strongRepairImportedCustomerLinks=strongRepairExisting;
})();
