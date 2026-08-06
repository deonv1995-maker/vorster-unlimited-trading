const V2_LABEL="V2 Operations";

function v2IsOpenOrder(order){
  return !["Delivered","Collected","Cancelled","Invoiced"].includes(String(order?.status||""));
}

async function v2Snapshot(){
  const [products,customers,orders,balances,mappings]=await Promise.all([
    getAll("products"),getAll("customers"),getAll("orders"),getAll("inventoryBalances"),getAll("importMappings").catch(()=>[])
  ]);
  const activeProducts=products.filter(product=>product.isActive!==false);
  const openOrders=orders.filter(v2IsOpenOrder);
  const importedProducts=activeProducts.filter(product=>product.category==="Imported / Unclassified"||String(product.description||"").includes("Created from an imported job card"));
  const setupProducts=activeProducts.filter(product=>Number(product.dailyCapacity||0)<=0&&openOrders.some(order=>(order.lines||[]).some(line=>line.productId===product.id&&Number(line.qty||0)>0)));
  const stockUnits=balances.reduce((sum,balance)=>sum+Number(balance.quantity||0),0);
  return {products,activeProducts,customers,orders,openOrders,balances,mappings,importedProducts,setupProducts,stockUnits};
}

async function openV2ControlCentre(){
  const data=await v2Snapshot();
  pageTitle.textContent=V2_LABEL;
  backBtn.classList.remove("hidden");
  main.innerHTML=`
    <section class="v2-launch-card">
      <div class="step-label">Vorster Unlimited V2 foundation</div>
      <h2>Operations control centre</h2>
      <p class="muted">A stable entry point for products, imports, orders and production. Existing data remains in the current database.</p>
      <div class="v2-kpi-grid">
        <div class="v2-kpi"><span>Active products</span><strong>${data.activeProducts.length}</strong></div>
        <div class="v2-kpi"><span>Open orders</span><strong>${data.openOrders.length}</strong></div>
        <div class="v2-kpi"><span>Stock units recorded</span><strong>${data.stockUnits}</strong></div>
        <div class="v2-kpi"><span>Products needing setup</span><strong>${data.setupProducts.length}</strong></div>
      </div>
      <div class="v2-action-grid">
        <button class="primary" onclick="openV2ProductCentre()"><strong>Product Centre</strong><small>Catalogue, duplicates and aliases</small></button>
        <button class="primary" onclick="openV2ImportCentre()"><strong>Import Centre</strong><small>Job cards and matching</small></button>
        <button class="secondary" onclick="navigate('orders')"><strong>Orders</strong><small>Open orders and job cards</small></button>
        <button class="secondary" onclick="openCompletionSchedule()"><strong>Production Schedule</strong><small>Completion dates and daily plan</small></button>
      </div>
    </section>
    ${data.setupProducts.length?`<section class="card v2-warning"><h2>Information needed</h2>${data.setupProducts.slice(0,12).map(product=>`<div class="v2-list-row"><div><strong>${esc(product.code)} · ${esc(product.name)}</strong><small>Daily capacity is not set for current demand.</small></div><button class="secondary" onclick="showProductForm('${product.id}')">Edit product</button></div>`).join("")}</section>`:""}`;
}

async function openV2ProductCentre(){
  const data=await v2Snapshot();
  pageTitle.textContent="Product Centre";
  backBtn.classList.remove("hidden");
  const duplicates=data.importedProducts;
  main.innerHTML=`
    <section class="v2-launch-card">
      <div class="step-label">V2 product module</div>
      <h2>Product Centre</h2>
      <p class="muted">Manage the permanent catalogue separately from imported product references.</p>
      <div class="v2-action-grid">
        <button class="primary" onclick="navigate('products')"><strong>Open catalogue</strong><small>Edit products, stock and capacities</small></button>
        <button class="primary" onclick="openMergeProducts()"><strong>Merge products</strong><small>Move duplicate demand into the correct master product</small></button>
        <button class="secondary" onclick="openImportMatching()"><strong>Review connections</strong><small>Correct imported job-card links</small></button>
        <button class="secondary" onclick="openStockCountList()"><strong>Stock count</strong><small>Update physical stock on hand</small></button>
      </div>
    </section>
    <section class="card">
      <div class="section-head"><h2>Imported product placeholders</h2><span class="badge">${duplicates.length}</span></div>
      ${duplicates.length?duplicates.slice(0,50).map(product=>`<div class="v2-list-row"><div><strong>${esc(product.code)} · ${esc(product.name)}</strong><small>${esc(product.category||"Imported / Unclassified")}</small></div><button class="primary" onclick="openMergeProducts()">Merge</button></div>`).join(""):`<div class="empty">No imported placeholders remain.</div>`}
    </section>`;
}

async function openV2ImportCentre(){
  const data=await v2Snapshot();
  pageTitle.textContent="Import Centre";
  backBtn.classList.remove("hidden");
  main.innerHTML=`
    <section class="v2-launch-card">
      <div class="step-label">V2 import module</div>
      <h2>Import Centre</h2>
      <p class="muted">One permanent place for importing, reviewing and connecting business records.</p>
      <div class="v2-action-grid">
        <button class="primary" onclick="openJobCardImport()"><strong>Import job cards</strong><small>Create or update customers, products and orders</small></button>
        <button class="primary" onclick="openImportMatching()"><strong>Review imported connections</strong><small>Link descriptions and codes to master records</small></button>
        <button class="secondary" onclick="openMergeProducts()"><strong>Merge duplicate products</strong><small>Consolidate placeholders safely</small></button>
        <button class="secondary" onclick="navigate('settings')"><strong>Sage Sync settings</strong><small>Prepare the future secure connector</small></button>
      </div>
    </section>
    <section class="card">
      <div class="section-head"><h2>Import status</h2></div>
      <div class="v2-kpi-grid">
        <div class="v2-kpi"><span>Imported placeholders</span><strong>${data.importedProducts.length}</strong></div>
        <div class="v2-kpi"><span>Remembered mappings</span><strong>${data.mappings.length}</strong></div>
        <div class="v2-kpi"><span>Total customers</span><strong>${data.customers.length}</strong></div>
        <div class="v2-kpi"><span>Total orders</span><strong>${data.orders.length}</strong></div>
      </div>
    </section>`;
}

function injectV2Entry(){
  if(!main||document.getElementById("v2PrimaryEntry"))return;
  if(!["dashboard","products","orders","settings"].includes(route))return;
  const button=document.createElement("button");
  button.id="v2PrimaryEntry";
  button.className="primary v2-primary-entry";
  button.type="button";
  button.textContent="Open V2 Operations Centre";
  button.onclick=openV2ControlCentre;
  main.prepend(button);
}

const v2Observer=new MutationObserver(()=>injectV2Entry());
v2Observer.observe(main,{childList:true,subtree:true});
setTimeout(injectV2Entry,0);

const v2BackHandler=backBtn.onclick;
backBtn.onclick=()=>{
  if([V2_LABEL,"Product Centre","Import Centre"].includes(pageTitle.textContent)){
    navigate("dashboard");
    return;
  }
  if(typeof v2BackHandler==="function")v2BackHandler();
};

window.openV2ControlCentre=openV2ControlCentre;
window.openV2ProductCentre=openV2ProductCentre;
window.openV2ImportCentre=openV2ImportCentre;
