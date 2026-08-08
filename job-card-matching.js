const IMPORT_MAPPING_STORE="importMappings";
const importMappingId=(type,source)=>`${type}:${String(source||"").trim().toUpperCase()}`;
const normaliseMatchValue=value=>String(value||"").trim().toUpperCase();

async function getImportMapping(type,source){if(!source)return null;return getOne(IMPORT_MAPPING_STORE,importMappingId(type,source));}
async function saveImportMapping(type,source,targetId,targetLabel){const record={id:importMappingId(type,source),type,source:String(source||"").trim(),targetId,targetLabel:targetLabel||"",updatedAt:new Date().toISOString()};await putOne(IMPORT_MAPPING_STORE,record);return record;}

async function importedProductCandidates(){
  const [products,orders,mappings]=await Promise.all([getAll("products"),getAll("orders"),getAll(IMPORT_MAPPING_STORE)]);
  const mappedSources=new Set(mappings.filter(m=>m.type==="product").map(m=>normaliseMatchValue(m.source))),usedCodes=new Set();
  orders.forEach(order=>(order.lines||[]).forEach(line=>{if((order.source==="Job Card Import"||order.source==="Sage PDF")&&line.productCode)usedCodes.add(normaliseMatchValue(line.sourceProductCode||line.productCode));}));
  return products.filter(product=>{const imported=product.category==="Imported / Unclassified"||/Created from (?:an )?imported job card/i.test(String(product.description||""));return imported&&usedCodes.has(normaliseMatchValue(product.code))&&!mappedSources.has(normaliseMatchValue(product.code));});
}

async function importedCustomerCandidates(){
  const [customers,orders,mappings]=await Promise.all([getAll("customers"),getAll("orders"),getAll(IMPORT_MAPPING_STORE)]);
  const mappedSources=new Set(mappings.filter(m=>m.type==="customer").map(m=>normaliseMatchValue(m.source))),usedIds=new Set(orders.filter(o=>o.source==="Job Card Import"||o.source==="Sage PDF").map(o=>o.customerId));
  return customers.filter(customer=>{const imported=/Imported from Sage job card|Created from imported Sage job card/i.test(String(customer.notes||"")),source=customer.accountCode||customer.name;return imported&&usedIds.has(customer.id)&&!mappedSources.has(normaliseMatchValue(source));});
}

async function openProductMatch(importedId,filter=""){
  const [imported,products]=await Promise.all([getOne("products",importedId),getAll("products")]);if(!imported){notify("Imported product not found");return openImportMatching();}
  const query=String(filter||"").trim().toLowerCase(),choices=products.filter(p=>p.id!==importedId&&p.isActive!==false&&p.category!=="Imported / Unclassified").filter(p=>(`${p.code} ${p.name} ${p.category||""}`).toLowerCase().includes(query)).sort((a,b)=>a.code.localeCompare(b.code));
  openDialog(`<div class="dialog-head"><div><div class="step-label">Imported product</div><h2>${esc(imported.code)} · ${esc(imported.name)}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><p class="muted">Select the existing app product that this imported code must use.</p><input id="productMatchSearch" class="search" placeholder="Search product code or name" value="${esc(filter)}"><div class="match-choice-list">${choices.length?choices.slice(0,100).map(p=>`<button class="match-choice" type="button" data-target-product="${p.id}"><span><strong>${esc(p.code)}</strong><small>${esc(p.name)}</small></span><span><small>Stock and capacity kept</small><strong>Link</strong></span></button>`).join(""):`<div class="empty">No matching app products found.</div>`}</div>`);
  document.getElementById("productMatchSearch").oninput=e=>openProductMatch(importedId,e.target.value);document.querySelectorAll("[data-target-product]").forEach(b=>b.onclick=()=>linkImportedProduct(importedId,b.dataset.targetProduct));
}

async function linkImportedProduct(importedId,targetId){
  const [imported,target,orders]=await Promise.all([getOne("products",importedId),getOne("products",targetId),getAll("orders")]);if(!imported||!target)return notify("Product link could not be completed");const now=new Date().toISOString();let changedOrders=0;
  for(const order of orders){let changed=false;const lines=(order.lines||[]).map(line=>{if(line.productId!==importedId&&normaliseMatchValue(line.sourceProductCode||line.productCode)!==normaliseMatchValue(imported.code))return line;changed=true;const colourName=line.colour?.name||"Standard",colour=(target.colours||[]).find(c=>String(c.name||"").toLowerCase()===colourName.toLowerCase())||line.colour||{name:"Standard",hex:"#999999"};return {...line,sourceProductCode:line.sourceProductCode||line.productCode,sourceProductName:line.sourceProductName||line.productName,productId:target.id,productCode:target.code,productName:target.name,colour};});if(changed){await putOne("orders",{...order,lines,updatedAt:now});changedOrders++;}}
  await saveImportMapping("product",imported.code,target.id,`${target.code} · ${target.name}`);await deleteOne("products",imported.id);closeDialog();notify(`Product linked in ${changedOrders} order${changedOrders===1?"":"s"}`);openImportMatching();
}

async function openCustomerMatch(importedId,filter=""){
  const [imported,customers]=await Promise.all([getOne("customers",importedId),getAll("customers")]);if(!imported){notify("Imported customer not found");return openImportMatching();}const query=String(filter||"").trim().toLowerCase();
  const choices=customers.filter(c=>c.id!==importedId&&c.isActive!==false&&!/Imported from Sage job card|Created from imported Sage job card/i.test(String(c.notes||""))).filter(c=>(`${c.name} ${c.accountCode||""} ${c.contactPerson||""}`).toLowerCase().includes(query)).sort((a,b)=>a.name.localeCompare(b.name));
  openDialog(`<div class="dialog-head"><div><div class="step-label">Imported customer</div><h2>${esc(imported.name)}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div><p class="muted">Select the existing app customer that these imported job cards belong to.</p><input id="customerMatchSearch" class="search" placeholder="Search customer or account code" value="${esc(filter)}"><div class="match-choice-list">${choices.length?choices.slice(0,100).map(c=>`<button class="match-choice" type="button" data-target-customer="${c.id}"><span><strong>${esc(c.name)}</strong><small>${esc(c.accountCode||"No account code")}</small></span><span><strong>Link</strong></span></button>`).join(""):`<div class="empty">No matching customers found.</div>`}</div>`);
  document.getElementById("customerMatchSearch").oninput=e=>openCustomerMatch(importedId,e.target.value);document.querySelectorAll("[data-target-customer]").forEach(b=>b.onclick=()=>linkImportedCustomer(importedId,b.dataset.targetCustomer));
}

async function linkImportedCustomer(importedId,targetId){
  const [imported,target,orders]=await Promise.all([getOne("customers",importedId),getOne("customers",targetId),getAll("orders")]);if(!imported||!target)return notify("Customer link could not be completed");const now=new Date().toISOString();let changedOrders=0;
  for(const order of orders){if(order.customerId!==importedId)continue;await putOne("orders",{...order,customerId:target.id,customerName:target.name,updatedAt:now});changedOrders++;}
  const source=imported.accountCode||imported.name;await saveImportMapping("customer",source,target.id,target.name);await deleteOne("customers",imported.id);closeDialog();notify(`Customer linked in ${changedOrders} order${changedOrders===1?"":"s"}`);openImportMatching();
}
async function removeImportMapping(id){if(!confirm("Remove this remembered link? Existing orders will not be changed."))return;await deleteOne(IMPORT_MAPPING_STORE,id);notify("Remembered link removed");openImportMatching();}

window.openProductMatch=openProductMatch;window.openCustomerMatch=openCustomerMatch;window.linkImportedProduct=linkImportedProduct;window.linkImportedCustomer=linkImportedCustomer;window.removeImportMapping=removeImportMapping;window.saveImportMapping=saveImportMapping;window.importedCustomerCandidates=importedCustomerCandidates;window.importedProductCandidates=importedProductCandidates;
