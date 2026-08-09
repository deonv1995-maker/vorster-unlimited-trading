/* V9.0.10 — stable customer identity matching for Sage imports.
   Keeps repeat job cards under the existing customer profile using account code,
   VAT number and normalized customer name instead of trusting a misread address line.
*/
(function(){
  const text=v=>String(v??'').trim();
  const key=v=>text(v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const code=v=>text(v).toUpperCase().replace(/\s+/g,'');
  const vat=v=>text(v).replace(/\D/g,'');
  const addressLike=v=>/\b(cnr|corner|street|st|road|rd|drive|dr|avenue|ave|boulevard|blvd|unit|farm|plot|highway|route)\b/i.test(text(v))||/^\s*\d+\s+/.test(text(v));
  const importedCustomer=c=>/imported from sage|job card/i.test(text(c?.notes));

  function pickCandidate(order,current,customers){
    const snap=order.customerSnapshot||{};
    const wantedCode=code(snap.accountCode||current?.accountCode);
    const wantedVat=vat(order.customerVatNumber||snap.vatNumber||current?.vatNumber);
    const names=[snap.name,order.customerName,current?.name].map(key).filter(Boolean).filter(n=>!addressLike(n));
    const others=customers.filter(c=>c.id!==current?.id);

    if(wantedCode){
      const hits=others.filter(c=>code(c.accountCode)===wantedCode);
      if(hits.length===1)return hits[0];
    }
    if(wantedVat){
      const hits=others.filter(c=>vat(c.vatNumber)===wantedVat);
      if(hits.length===1)return hits[0];
    }
    for(const n of names){
      const hits=others.filter(c=>key(c.name)===n);
      if(hits.length===1)return hits[0];
    }

    // Last safe fallback: a unique existing customer whose name contains the delivery area.
    // This only runs when the imported customer name itself looks like an address.
    if(addressLike(current?.name)||addressLike(snap.name)){
      const area=key(order.deliveryArea||order.area||snap.deliveryArea);
      if(area){
        const hits=others.filter(c=>key(c.name).includes(area));
        if(hits.length===1)return hits[0];
      }
    }
    return null;
  }

  async function repairImportedCustomerLinks(showNotice=false){
    const [customers,orders,jobs,deliveries]=await Promise.all([
      getAll('customers'),getAll('orders'),getAll('productionJobs'),getAll('deliveries')
    ]);
    let relinked=0,removed=0,updatedProfiles=0;
    const byId=new Map(customers.map(c=>[c.id,c]));

    for(const order of orders){
      if(!/sage|job card/i.test(text(order.source))&&!/imported from job card/i.test(text(order.notes)))continue;
      const current=byId.get(order.customerId);
      if(!current)continue;
      const target=pickCandidate(order,current,customers);
      if(!target)continue;

      const snap=order.customerSnapshot||{};
      let targetChanged=false;
      if(!text(target.accountCode)&&text(snap.accountCode)){target.accountCode=text(snap.accountCode);targetChanged=true;}
      if(!text(target.vatNumber)&&text(order.customerVatNumber||snap.vatNumber)){target.vatNumber=text(order.customerVatNumber||snap.vatNumber);targetChanged=true;}
      if(!text(target.deliveryAddress)&&text(order.deliveryAddress||snap.deliveryAddress)){target.deliveryAddress=text(order.deliveryAddress||snap.deliveryAddress);targetChanged=true;}
      if(targetChanged){target.updatedAt=new Date().toISOString();await putOne('customers',target);updatedProfiles++;}

      const oldId=order.customerId;
      order.customerId=target.id;
      order.customerName=target.name;
      order.customerSnapshot={...snap,name:target.name,accountCode:text(snap.accountCode||target.accountCode),vatNumber:text(order.customerVatNumber||snap.vatNumber||target.vatNumber)};
      order.updatedAt=new Date().toISOString();
      await putOne('orders',order);
      relinked++;

      for(const job of jobs.filter(j=>j.orderId===order.id&&j.customerId!==target.id)){
        job.customerId=target.id;job.customerName=target.name;job.updatedAt=new Date().toISOString();await putOne('productionJobs',job);
      }
      for(const del of deliveries.filter(d=>d.orderId===order.id&&d.customerId!==target.id)){
        del.customerId=target.id;del.customerName=target.name;del.updatedAt=new Date().toISOString();await putOne('deliveries',del);
      }

      const stillUsed=orders.some(o=>o.id!==order.id&&o.customerId===oldId)||jobs.some(j=>j.customerId===oldId)||deliveries.some(d=>d.customerId===oldId);
      if(!stillUsed&&(addressLike(current.name)||importedCustomer(current))){
        await deleteOne('customers',oldId);removed++;byId.delete(oldId);
      }
    }
    if(showNotice)notify(relinked?`Customer links repaired: ${relinked} order${relinked===1?'':'s'}`:'No imported customer links needed repair');
    return{relinked,removed,updatedProfiles};
  }

  if(typeof customersPage==='function'){
    const baseCustomersPage=customersPage;
    customersPage=async function(...args){await repairImportedCustomerLinks(false);return baseCustomersPage(...args);};
  }
  if(typeof settingsPage==='function'){
    const baseSettingsPage=settingsPage;
    settingsPage=async function(...args){
      await baseSettingsPage(...args);
      if(document.getElementById('repairImportedCustomerLinksBtn'))return;
      const panel=document.createElement('section');panel.className='card';panel.style.marginTop='12px';
      panel.innerHTML='<div class="section-head"><div><h2>Imported customer matching</h2><p class="muted">Repair job cards that were linked to a duplicate customer instead of an existing profile.</p></div></div><button class="secondary" id="repairImportedCustomerLinksBtn">Repair imported customer links</button>';
      main.appendChild(panel);
      document.getElementById('repairImportedCustomerLinksBtn').onclick=async()=>{await repairImportedCustomerLinks(true);navigate('customers');};
    };
  }
  window.repairImportedCustomerLinks=repairImportedCustomerLinks;
})();