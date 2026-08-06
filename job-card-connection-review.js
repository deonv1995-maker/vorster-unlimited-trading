const importedJobCardOrders=orders=>(orders||[]).filter(order=>order.source==="Job Card Import");

async function importedConnectionRows(){
  const [products,orders,mappings]=await Promise.all([
    getAll("products"),getAll("orders"),getAll("importMappings")
  ]);
  const productsById=new Map(products.map(product=>[product.id,product]));
  const mappingBySource=new Map(mappings.filter(mapping=>mapping.type==="product").map(mapping=>[normaliseMatchValue(mapping.source),mapping]));
  const rows=new Map();

  for(const order of importedJobCardOrders(orders)){
    for(const line of (order.lines||[])){
      if(line.sourceLineType&&line.sourceLineType!=="product")continue;
      const sourceCode=normaliseMatchValue(line.sourceProductCode||line.productCode);
      const key=`${sourceCode}::${line.productId||""}`;
      if(!rows.has(key))rows.set(key,{
        key,
        sourceCode:line.sourceProductCode||line.productCode||"Unknown",
        sourceName:line.sourceProductName||line.productName||"Imported product",
        currentProductId:line.productId||"",
        currentProduct:productsById.get(line.productId)||null,
        orderNumbers:new Set(),
        totalQty:0,
        remembered:mappingBySource.get(sourceCode)||null
      });
      const row=rows.get(key);
      row.orderNumbers.add(order.orderNumber||"Order");
      row.totalQty+=Number(line.qty||0);
    }
  }
  return [...rows.values()].sort((a,b)=>String(a.sourceCode).localeCompare(String(b.sourceCode)));
}

async function openImportMatching(){
  const [connections,customers,mappings]=await Promise.all([
    importedConnectionRows(),importedCustomerCandidates(),getAll("importMappings")
  ]);
  pageTitle.textContent="Import matching";
  backBtn.classList.remove("hidden");
  main.innerHTML=`
    <section class="card">
      <div class="section-head"><div><div class="step-label">Imported job cards</div><h2>Review product connections</h2></div><span class="badge">${connections.length}</span></div>
      <p class="muted">Every product currently used by an imported job card is shown below. “Connected” only means the job-card line points to a product record; it does not guarantee that the connection is correct.</p>
    </section>

    <div class="section-head"><h2>Imported product connections</h2><span class="badge">${connections.length}</span></div>
    <div class="list">${connections.length?connections.map(row=>`
      <article class="list-item match-list-item">
        <div>
          <strong>${esc(row.sourceCode)} · ${esc(row.sourceName)}</strong>
          <p>${row.currentProduct?`Currently linked to: <strong>${esc(row.currentProduct.code)} · ${esc(row.currentProduct.name)}</strong>`:`<strong>Current product record missing</strong>`}</p>
          <small class="muted">${row.orderNumbers.size} job card${row.orderNumbers.size===1?"":"s"} · ${row.totalQty} units${row.remembered?` · remembered link`:""}</small>
        </div>
        <button class="primary" onclick="reviewImportedProductConnection('${esc(row.sourceCode)}','${row.currentProductId}')">Review / change</button>
      </article>`).join(""):`<div class="empty">No imported job-card product lines were found.</div>`}</div>

    <div class="section-head"><h2>Imported customers to match</h2><span class="badge">${customers.length}</span></div>
    <div class="list">${customers.length?customers.map(customer=>`
      <article class="list-item match-list-item">
        <div><strong>${esc(customer.name)}</strong><p>${esc(customer.accountCode||"No account code")}</p></div>
        <button class="primary" onclick="openCustomerMatch('${customer.id}')">Link customer</button>
      </article>`).join(""):`<div class="empty">No imported customer placeholders require attention.</div>`}</div>

    <div class="section-head"><h2>Remembered links</h2><span class="badge">${mappings.length}</span></div>
    <div class="list">${mappings.length?mappings.map(mapping=>`
      <div class="list-item"><div><strong>${esc(mapping.source)}</strong><p class="muted">${esc(mapping.type)} → ${esc(mapping.targetLabel)}</p></div><button class="ghost" onclick="removeImportMapping('${mapping.id}')">Remove</button></div>`).join(""):`<div class="empty">No remembered links yet.</div>`}</div>`;
}

async function reviewImportedProductConnection(sourceCode,currentProductId="",filter=""){
  const [products,current]=await Promise.all([
    getAll("products"),
    currentProductId?getOne("products",currentProductId):Promise.resolve(null)
  ]);
  const query=String(filter||"").trim().toLowerCase();
  const choices=products
    .filter(product=>product.isActive!==false)
    .filter(product=>(`${product.code} ${product.name} ${product.category||""}`).toLowerCase().includes(query))
    .sort((a,b)=>a.code.localeCompare(b.code));

  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Imported code ${esc(sourceCode)}</div><h2>Choose the correct app product</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    ${current?`<div class="card"><span class="muted">Current connection</span><strong>${esc(current.code)} · ${esc(current.name)}</strong></div>`:""}
    <input id="connectionReviewSearch" class="search" placeholder="Search product code or name" value="${esc(filter)}">
    <div class="match-choice-list">${choices.length?choices.slice(0,150).map(product=>`
      <button class="match-choice ${product.id===currentProductId?"selected":""}" type="button" data-review-target="${product.id}">
        <span><strong>${esc(product.code)}</strong><small>${esc(product.name)}</small></span>
        <span><small>${esc(product.category||"Uncategorised")}</small><strong>${product.id===currentProductId?"Current":"Use this"}</strong></span>
      </button>`).join(""):`<div class="empty">No products found.</div>`}</div>`);
  document.getElementById("connectionReviewSearch").oninput=event=>reviewImportedProductConnection(sourceCode,currentProductId,event.target.value);
  document.querySelectorAll("[data-review-target]").forEach(button=>button.onclick=()=>applyImportedProductConnection(sourceCode,currentProductId,button.dataset.reviewTarget));
}

async function applyImportedProductConnection(sourceCode,currentProductId,targetId){
  const [target,sourceProduct,orders]=await Promise.all([
    getOne("products",targetId),
    currentProductId?getOne("products",currentProductId):Promise.resolve(null),
    getAll("orders")
  ]);
  if(!target)return notify("Selected product was not found");
  const sourceKey=normaliseMatchValue(sourceCode);
  const now=new Date().toISOString();
  let changedOrders=0;

  for(const order of importedJobCardOrders(orders)){
    let changed=false;
    const lines=(order.lines||[]).map(line=>{
      const lineSource=normaliseMatchValue(line.sourceProductCode||line.productCode);
      const currentMatches=!currentProductId||line.productId===currentProductId;
      if(lineSource!==sourceKey||!currentMatches)return line;
      changed=true;
      const colourName=line.colour?.name||"Standard";
      const colour=(target.colours||[]).find(c=>String(c.name||"").toLowerCase()===colourName.toLowerCase())||line.colour||{name:colourName,hex:"#999999"};
      return {
        ...line,
        sourceProductCode:line.sourceProductCode||sourceCode,
        sourceProductName:line.sourceProductName||line.productName,
        productId:target.id,
        productCode:target.code,
        productName:target.name,
        colour
      };
    });
    if(changed){await putOne("orders",{...order,lines,updatedAt:now});changedOrders++;}
  }

  await saveImportMapping("product",sourceCode,target.id,`${target.code} · ${target.name}`);

  const sourceIsPlaceholder=sourceProduct&&sourceProduct.id!==target.id&&(
    sourceProduct.category==="Imported / Unclassified"||
    String(sourceProduct.description||"").includes("Created from an imported job card")
  );
  if(sourceIsPlaceholder){
    const allOrders=await getAll("orders");
    const stillUsed=allOrders.some(order=>(order.lines||[]).some(line=>line.productId===sourceProduct.id));
    if(!stillUsed)await deleteOne("products",sourceProduct.id);
  }

  closeDialog();
  notify(`Connection updated in ${changedOrders} job card${changedOrders===1?"":"s"}`);
  openImportMatching();
}

window.openImportMatching=openImportMatching;
window.reviewImportedProductConnection=reviewImportedProductConnection;
window.applyImportedProductConnection=applyImportedProductConnection;
