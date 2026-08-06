const UNIFIED_VERSION='2.0 Unified 1.0.0';

async function unifiedSafeAll(store){try{return await getAll(store)}catch{return []}}
function unifiedOpenOrder(order){return !['Delivered','Collected','Cancelled','Invoiced'].includes(String(order?.status||''))}

async function unifiedSnapshot(){
  const [products,customers,orders,balances,mappings]=await Promise.all([
    unifiedSafeAll('products'),unifiedSafeAll('customers'),unifiedSafeAll('orders'),unifiedSafeAll('inventoryBalances'),unifiedSafeAll('importMappings')
  ]);
  const activeProducts=products.filter(product=>product.isActive!==false);
  const openOrders=orders.filter(unifiedOpenOrder);
  const placeholders=activeProducts.filter(product=>product.category==='Imported / Unclassified'||String(product.description||'').includes('Created from an imported job card'));
  const setup=activeProducts.filter(product=>Number(product.dailyCapacity||0)<=0&&openOrders.some(order=>(order.lines||[]).some(line=>line.productId===product.id&&Number(line.qty||0)>0)));
  const stock=balances.reduce((sum,balance)=>sum+Number(balance.quantity||0),0);
  return {products,activeProducts,customers,orders,openOrders,balances,mappings,placeholders,setup,stock};
}

async function openUnifiedOperations(){
  const data=await unifiedSnapshot();
  pageTitle.textContent='Operations';
  backBtn.classList.remove('hidden');
  if(typeof navState==='function')navState('');
  main.innerHTML=`
    <div class="unified-hub">
      <section class="unified-hero">
        <div class="step-label">Vorster Unlimited</div>
        <h2>Operations Centre</h2>
        <p class="muted">Products, customers, orders, imports, stock and production planning now sit inside one app.</p>
        <div class="unified-kpis">
          <div class="unified-kpi"><span>Products</span><strong>${data.activeProducts.length}</strong></div>
          <div class="unified-kpi"><span>Open orders</span><strong>${data.openOrders.length}</strong></div>
          <div class="unified-kpi"><span>Stock units</span><strong>${data.stock}</strong></div>
          <div class="unified-kpi"><span>Needs setup</span><strong>${data.setup.length}</strong></div>
        </div>
      </section>
      <section class="unified-actions">
        <button class="unified-action" onclick="navigate('products')"><strong>Products</strong><small>Catalogue, images, stock, moulds and capacity</small></button>
        <button class="unified-action" onclick="navigate('customers')"><strong>Customers</strong><small>Customer details and order history</small></button>
        <button class="unified-action" onclick="navigate('orders')"><strong>Orders</strong><small>Manual and imported orders in one list</small></button>
        <button class="unified-action" onclick="openCompletionSchedule()"><strong>Production</strong><small>Daily plan and completion dates</small></button>
        <button class="unified-action" onclick="openJobCardImport()"><strong>Import Centre</strong><small>Import current job cards and update records</small></button>
        <button class="unified-action" onclick="openMergeProducts()"><strong>Merge Products</strong><small>Combine duplicates and preserve aliases</small></button>
        <button class="unified-action" onclick="openImportMatching()"><strong>Product Matching</strong><small>Review imported product connections</small></button>
        <button class="unified-action" onclick="navigate('settings')"><strong>Settings</strong><small>Backup, Sage and application settings</small></button>
      </section>
      ${data.placeholders.length?`<section class="unified-section"><div class="section-head"><h2>Imported products to review</h2><span class="badge">${data.placeholders.length}</span></div>${data.placeholders.slice(0,12).map(product=>`<div class="unified-row"><div><strong>${esc(product.code)} · ${esc(product.name)}</strong><small>${esc(product.category||'Imported / Unclassified')}</small></div><button class="secondary" onclick="openMergeProducts()">Merge</button></div>`).join('')}</section>`:''}
    </div>`;
}

function installUnifiedEntry(){
  const topbar=document.querySelector('.topbar');
  if(!topbar||document.getElementById('unifiedOpsBtn'))return;
  const button=document.createElement('button');
  button.id='unifiedOpsBtn';
  button.className='unified-ops-btn';
  button.type='button';
  button.textContent='OPS';
  button.setAttribute('aria-label','Open Operations Centre');
  button.onclick=openUnifiedOperations;
  const theme=document.getElementById('themeBtn');
  topbar.insertBefore(button,theme||null);
}

const unifiedBack=backBtn.onclick;
backBtn.onclick=()=>{
  if(pageTitle.textContent==='Operations'){navigate('dashboard');return}
  if(typeof unifiedBack==='function')unifiedBack();
};

window.openUnifiedOperations=openUnifiedOperations;
window.addEventListener('load',()=>setTimeout(installUnifiedEntry,0));
new MutationObserver(installUnifiedEntry).observe(document.documentElement,{childList:true,subtree:true});
