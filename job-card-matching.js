const IMPORT_MAPPING_STORE="importMappings";
const importMappingId=(type,source)=>`${type}:${String(source||"").trim().toUpperCase()}`;
const normaliseMatchValue=value=>String(value||"").trim().toUpperCase();

async function getImportMapping(type,source){
  if(!source)return null;
  return getOne(IMPORT_MAPPING_STORE,importMappingId(type,source));
}

async function saveImportMapping(type,source,targetId,targetLabel){
  const record={
    id:importMappingId(type,source),
    type,
    source:String(source||"").trim(),
    targetId,
    targetLabel:targetLabel||"",
    updatedAt:new Date().toISOString()
  };
  await putOne(IMPORT_MAPPING_STORE,record);
  return record;
}

async function importedProductCandidates(){
  const [products,orders,mappings]=await Promise.all([
    getAll("products"),getAll("orders"),getAll(IMPORT_MAPPING_STORE)
  ]);
  const mappedSources=new Set(mappings.filter(m=>m.type==="product").map(m=>normaliseMatchValue(m.source)));
  const usedCodes=new Set();
  orders.forEach(order=>(order.lines||[]).forEach(line=>{
    if(order.source==="Job Card Import"&&line.productCode)usedCodes.add(normaliseMatchValue(line.productCode));
  }));
  return products.filter(product=>{
    const imported=product.category==="Imported / Unclassified"||String(product.description||"").includes("Created from an imported job card");
    return imported&&usedCodes.has(normaliseMatchValue(product.code))&&!mappedSources.has(normaliseMatchValue(product.code));
  });
}

async function importedCustomerCandidates(){
  const [customers,orders,mappings]=await Promise.all([
    getAll("customers"),getAll("orders"),getAll(IMPORT_MAPPING_STORE)
  ]);
  const mappedSources=new Set(mappings.filter(m=>m.type==="customer").map(m=>normaliseMatchValue(m.source)));
  const usedIds=new Set(orders.filter(o=>o.source==="Job Card Import").map(o=>o.customerId));
  return customers.filter(customer=>{
    const imported=String(customer.notes||"").includes("Created from imported Sage job card");
    const source=customer.accountCode||customer.name;
    return imported&&usedIds.has(customer.id)&&!mappedSources.has(normaliseMatchValue(source));
  });
}

async function openImportMatching(){
  const [unmatchedProducts,unmatchedCustomers,mappings]=await Promise.all([
    importedProductCandidates(),importedCustomerCandidates(),getAll(IMPORT_MAPPING_STORE)
  ]);
  pageTitle.textContent="Import matching";
  backBtn.classList.remove("hidden");
  navState("settings");
  main.innerHTML=`
    <section class="card">
      <div class="section-head"><div><div class="step-label">Imported records</div><h2>Product and customer matching</h2></div><span class="badge">${unmatchedProducts.length+unmatchedCustomers.length} unmatched</span></div>
      <p class="muted">Link an imported placeholder to the correct record already in the app. Existing stock, images, mould quantities and manufacturing capacity stay on the selected app record.</p>
    </section>

    <div class="section-head"><h2>Products to match</h2><span class="badge">${unmatchedProducts.length}</span></div>
    <div class="list">${unmatchedProducts.length?unmatchedProducts.map(product=>`
      <article class="list-item match-list-item">
        <div><strong>${esc(product.code)}</strong><p>${esc(product.name)}</p><small class="muted">Imported placeholder</small></div>
        <button class="primary" onclick="openProductMatch('${product.id}')">Link product</button>
      </article>`).join(""):`<div class="empty">All imported products are linked.</div>`}</div>

    <div class="section-head"><h2>Customers to match</h2><span class="badge">${unmatchedCustomers.length}</span></div>
    <div class="list">${unmatchedCustomers.length?unmatchedCustomers.map(customer=>`
      <article class="list-item match-list-item">
        <div><strong>${esc(customer.name)}</strong><p>${esc(customer.accountCode||"No account code")}</p><small class="muted">Imported customer</small></div>
        <button class="primary" onclick="openCustomerMatch('${customer.id}')">Link customer</button>
      </article>`).join(""):`<div class="empty">All imported customers are linked.</div>`}</div>

    <div class="section-head"><h2>Remembered links</h2><span class="badge">${mappings.length}</span></div>
    <div class="list">${mappings.length?mappings.sort((a,b)=>a.type.localeCompare(b.type)||a.source.localeCompare(b.source)).map(mapping=>`
      <div class="list-item"><div><strong>${esc(mapping.source)}</strong><p class="muted">${esc(mapping.type)} → ${esc(mapping.targetLabel)}</p></div><button class="ghost" onclick="removeImportMapping('${mapping.id}')">Remove</button></div>`).join(""):`<div class="empty">No remembered links yet.</div>`}</div>`;
}

async function openProductMatch(importedId,filter=""){
  const [imported,products]=await Promise.all([getOne("products",importedId),getAll("products")]);
  if(!imported){notify("Imported product not found");return openImportMatching();}
  const query=String(filter||"").trim().toLowerCase();
  const choices=products
    .filter(product=>product.id!==importedId&&product.isActive!==false&&product.category!=="Imported / Unclassified")
    .filter(product=>(`${product.code} ${product.name} ${product.category||""}`).toLowerCase().includes(query))
    .sort((a,b)=>a.code.localeCompare(b.code));
  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Imported product</div><h2>${esc(imported.code)} · ${esc(imported.name)}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <p class="muted">Select the existing app product that this imported code must use.</p>
    <input id="productMatchSearch" class="search" placeholder="Search product code or name" value="${esc(filter)}">
    <div class="match-choice-list">${choices.length?choices.slice(0,100).map(product=>`
      <button class="match-choice" type="button" data-target-product="${product.id}">
        <span><strong>${esc(product.code)}</strong><small>${esc(product.name)}</small></span>
        <span><small>Stock and capacity kept</small><strong>Link</strong></span>
      </button>`).join(""):`<div class="empty">No matching app products found.</div>`}</div>`);
  document.getElementById("productMatchSearch").oninput=event=>openProductMatch(importedId,event.target.value);
  document.querySelectorAll("[data-target-product]").forEach(button=>button.onclick=()=>linkImportedProduct(importedId,button.dataset.targetProduct));
}

async function linkImportedProduct(importedId,targetId){
  const [imported,target,orders]=await Promise.all([getOne("products",importedId),getOne("products",targetId),getAll("orders")]);
  if(!imported||!target)return notify("Product link could not be completed");
  const now=new Date().toISOString();
  let changedOrders=0;
  for(const order of orders){
    let changed=false;
    const lines=(order.lines||[]).map(line=>{
      if(line.productId!==importedId&&normaliseMatchValue(line.productCode)!==normaliseMatchValue(imported.code))return line;
      changed=true;
      const colourName=line.colour?.name||"Standard";
      const colour=(target.colours||[]).find(c=>String(c.name||"").toLowerCase()===colourName.toLowerCase())||line.colour||{name:"Standard",hex:"#999999"};
      return {...line,productId:target.id,productCode:target.code,productName:target.name,colour};
    });
    if(changed){
      await putOne("orders",{...order,lines,updatedAt:now});
      changedOrders++;
    }
  }
  await saveImportMapping("product",imported.code,target.id,`${target.code} · ${target.name}`);
  await deleteOne("products",imported.id);
  closeDialog();
  notify(`Product linked in ${changedOrders} order${changedOrders===1?"":"s"}`);
  openImportMatching();
}

async function openCustomerMatch(importedId,filter=""){
  const [imported,customers]=await Promise.all([getOne("customers",importedId),getAll("customers")]);
  if(!imported){notify("Imported customer not found");return openImportMatching();}
  const query=String(filter||"").trim().toLowerCase();
  const choices=customers
    .filter(customer=>customer.id!==importedId&&customer.isActive!==false&&!String(customer.notes||"").includes("Created from imported Sage job card"))
    .filter(customer=>(`${customer.name} ${customer.accountCode||""} ${customer.contactPerson||""}`).toLowerCase().includes(query))
    .sort((a,b)=>a.name.localeCompare(b.name));
  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Imported customer</div><h2>${esc(imported.name)}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <p class="muted">Select the existing app customer that these imported job cards belong to.</p>
    <input id="customerMatchSearch" class="search" placeholder="Search customer or account code" value="${esc(filter)}">
    <div class="match-choice-list">${choices.length?choices.slice(0,100).map(customer=>`
      <button class="match-choice" type="button" data-target-customer="${customer.id}">
        <span><strong>${esc(customer.name)}</strong><small>${esc(customer.accountCode||"No account code")}</small></span>
        <span><strong>Link</strong></span>
      </button>`).join(""):`<div class="empty">No matching customers found.</div>`}</div>`);
  document.getElementById("customerMatchSearch").oninput=event=>openCustomerMatch(importedId,event.target.value);
  document.querySelectorAll("[data-target-customer]").forEach(button=>button.onclick=()=>linkImportedCustomer(importedId,button.dataset.targetCustomer));
}

async function linkImportedCustomer(importedId,targetId){
  const [imported,target,orders]=await Promise.all([getOne("customers",importedId),getOne("customers",targetId),getAll("orders")]);
  if(!imported||!target)return notify("Customer link could not be completed");
  const now=new Date().toISOString();
  let changedOrders=0;
  for(const order of orders){
    if(order.customerId!==importedId)return;
    await putOne("orders",{...order,customerId:target.id,customerName:target.name,updatedAt:now});
    changedOrders++;
  }
  const source=imported.accountCode||imported.name;
  await saveImportMapping("customer",source,target.id,target.name);
  await deleteOne("customers",imported.id);
  closeDialog();
  notify(`Customer linked in ${changedOrders} order${changedOrders===1?"":"s"}`);
  openImportMatching();
}

async function removeImportMapping(id){
  if(!confirm("Remove this remembered link? Existing orders will not be changed."))return;
  await deleteOne(IMPORT_MAPPING_STORE,id);
  notify("Remembered link removed");
  openImportMatching();
}

async function addImportMatchingButtons(){
  if(document.querySelector(".import-matching-panel"))return;
  const [products,customers]=await Promise.all([importedProductCandidates(),importedCustomerCandidates()]);
  const panel=document.createElement("section");
  panel.className="card import-matching-panel";
  panel.style.marginTop="12px";
  panel.innerHTML=`
    <div class="section-head"><div><h2>Match imported records</h2><p class="muted">Connect imported products and customers to records already in the app.</p></div><span class="badge">${products.length+customers.length}</span></div>
    <div class="actions"><button class="primary" onclick="openImportMatching()">Open matching</button></div>`;
  const importPanel=document.querySelector(".job-card-import-panel");
  if(importPanel)importPanel.insertAdjacentElement("afterend",panel);else main.prepend(panel);
}

const settingsPageBeforeImportMatching=settingsPage;
settingsPage=async function(...args){
  await settingsPageBeforeImportMatching(...args);
  await addImportMatchingButtons();
};

const originalBackForMatching=backBtn.onclick;
backBtn.onclick=()=>{
  if(pageTitle.textContent==="Import matching")navigate("settings");
  else originalBackForMatching();
};

window.openImportMatching=openImportMatching;
window.openProductMatch=openProductMatch;
window.openCustomerMatch=openCustomerMatch;
window.linkImportedProduct=linkImportedProduct;
window.linkImportedCustomer=linkImportedCustomer;
window.removeImportMapping=removeImportMapping;

// Override the importer so remembered links are applied before direct code/name matching.
window.commitJobCardImport=async function(){
  const data=pendingJobCardImport;
  if(!data?.length)return;
  const now=new Date().toISOString();
  const [products,customers,orders,mappings]=await Promise.all([
    getAll("products"),getAll("customers"),getAll("orders"),getAll(IMPORT_MAPPING_STORE)
  ]);
  const productByCode=new Map(products.map(p=>[normaliseImportCode(p.code),p]));
  const customerByCode=new Map(customers.filter(c=>c.accountCode).map(c=>[normaliseImportCode(c.accountCode),c]));
  const customerByName=new Map(customers.map(c=>[String(c.name||"").trim().toLowerCase(),c]));
  const orderByNumber=new Map(orders.map(o=>[normaliseImportCode(o.orderNumber),o]));
  const productMappings=new Map(mappings.filter(m=>m.type==="product").map(m=>[normaliseImportCode(m.source),m.targetId]));
  const customerMappings=new Map(mappings.filter(m=>m.type==="customer").map(m=>[normaliseImportCode(m.source),m.targetId]));
  const productsById=new Map(products.map(p=>[p.id,p]));
  const customersById=new Map(customers.map(c=>[c.id,c]));
  let createdProducts=0,createdCustomers=0,createdOrders=0,updatedOrders=0;

  for(const card of data){
    const customerCode=normaliseImportCode(card.customerCode);
    const customerName=String(card.customerName||"").trim();
    const mappedCustomerId=customerMappings.get(customerCode)||customerMappings.get(normaliseImportCode(customerName));
    let customer=(mappedCustomerId&&customersById.get(mappedCustomerId))||(customerCode&&customerByCode.get(customerCode))||customerByName.get(customerName.toLowerCase());
    if(!customer){
      customer={id:uid("cus"),name:customerName,accountCode:card.customerCode||"",contactPerson:"",phone:"",whatsapp:"",email:"",preference:"Delivery",notes:"Created from imported Sage job card. Complete missing customer details.",isActive:true,createdAt:now,updatedAt:now};
      await putOne("customers",customer);createdCustomers++;
      customerByName.set(customerName.toLowerCase(),customer);customersById.set(customer.id,customer);
      if(customerCode)customerByCode.set(customerCode,customer);
    }

    const orderLines=[];const instructions=[];
    for(const line of card.lines){
      const kind=line.kind||"product";
      if(kind!=="product"){instructions.push(`${line.code||"Instruction"}: ${line.name||""}`);continue;}
      const sourceCode=normaliseImportCode(line.code);
      const mappedProductId=productMappings.get(sourceCode);
      let product=(mappedProductId&&productsById.get(mappedProductId))||productByCode.get(sourceCode);
      if(!product){
        product={id:uid("prd"),code:line.code||"UNKNOWN",name:line.name||line.code||"Imported product",description:"Created from an imported job card. Complete the category, image, mould quantity and manufacturing capacity.",category:"Imported / Unclassified",price:Number(line.unitPrice||0),colours:[{name:line.colour||"Standard",hex:"#999999"}],image:"",mouldQuantity:0,dailyCapacity:0,isActive:true,createdAt:now,updatedAt:now};
        await putOne("products",product);productByCode.set(sourceCode,product);productsById.set(product.id,product);createdProducts++;
      }
      const colourName=line.colour||"Standard";
      let colour=(product.colours||[]).find(c=>String(c.name||"").toLowerCase()===colourName.toLowerCase());
      if(!colour){colour={name:colourName,hex:"#999999"};product={...product,colours:[...(product.colours||[]),colour],updatedAt:now};await putOne("products",product);productsById.set(product.id,product);}
      orderLines.push({productId:product.id,productCode:product.code,productName:product.name,colour,qty:Number(line.qty||0),unitPrice:Number(line.unitPrice||0),allocatedQty:0,completedQty:0,sourceLineType:"product",importedCode:line.code||""});
    }

    const existing=orderByNumber.get(normaliseImportCode(card.orderNumber));
    const lineSubtotal=orderLines.reduce((sum,line)=>sum+line.qty*line.unitPrice,0);
    const grandTotal=Number(card.grandTotal||lineSubtotal);
    const importedNotes=[`Imported from job card ${card.orderNumber}.`,instructions.length?`Instructions: ${instructions.join(" | ")}`:""].filter(Boolean).join("\n");
    const order={...(existing||{id:uid("ord"),createdAt:parseImportDate(card.date)}),orderNumber:card.orderNumber,customerId:customer.id,customerName:customer.name,lines:orderLines,status:existing?.status||"Confirmed",dueDate:parseImportDate(card.dueDate),subtotal:lineSubtotal,vat:Math.max(0,grandTotal-lineSubtotal),deliveryFee:0,grandTotal,notes:[existing?.notes,importedNotes].filter(Boolean).join("\n"),source:"Job Card Import",sourceReference:card.orderNumber,readOnly:false,updatedAt:now};
    await putOne("orders",order);orderByNumber.set(normaliseImportCode(card.orderNumber),order);
    if(existing)updatedOrders++;else createdOrders++;
  }
  pendingJobCardImport=null;closeDialog();
  alert(`Import complete\n\nNew customers: ${createdCustomers}\nNew products: ${createdProducts}\nNew orders: ${createdOrders}\nUpdated orders: ${updatedOrders}`);
  navigate("orders");
};
