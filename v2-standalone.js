const v2Main=document.getElementById('v2Main');
const v2Title=document.getElementById('v2Title');
const v2Esc=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const v2Uid=prefix=>`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
const v2Normalise=value=>String(value||'').trim().toUpperCase();
const v2OpenOrder=order=>!['Delivered','Collected','Cancelled','Invoiced'].includes(String(order?.status||''));

async function v2SafeAll(store){try{return await getAll(store)}catch{return []}}
async function v2Data(){
  const [products,customers,orders,balances,mappings]=await Promise.all([
    v2SafeAll('products'),v2SafeAll('customers'),v2SafeAll('orders'),v2SafeAll('inventoryBalances'),v2SafeAll('importMappings')
  ]);
  const activeProducts=products.filter(p=>p.isActive!==false);
  const openOrders=orders.filter(v2OpenOrder);
  const placeholders=activeProducts.filter(p=>p.category==='Imported / Unclassified'||String(p.description||'').includes('Created from an imported job card'));
  const setup=activeProducts.filter(product=>Number(product.dailyCapacity||0)<=0&&openOrders.some(order=>(order.lines||[]).some(line=>line.productId===product.id&&Number(line.qty||0)>0)));
  return {products,activeProducts,customers,orders,openOrders,balances,mappings,placeholders,setup};
}

function v2SetRoute(route){
  document.querySelectorAll('[data-v2-route]').forEach(button=>button.classList.toggle('active',button.dataset.v2Route===route));
  if(route==='products')return v2Products();
  if(route==='merge')return v2Merge();
  if(route==='imports')return v2Imports();
  if(route==='orders')return v2Orders();
  return v2Dashboard();
}

document.querySelectorAll('[data-v2-route]').forEach(button=>button.onclick=()=>v2SetRoute(button.dataset.v2Route));

async function v2Dashboard(){
  const data=await v2Data();v2Title.textContent='Operations Centre';
  const stock=data.balances.reduce((sum,b)=>sum+Number(b.quantity||0),0);
  v2Main.innerHTML=`<section class="v2-card"><h2>Vorster Unlimited V2</h2><p class="muted">This page uses the same products, customers, orders, stock and production-capacity data as the current app.</p><div class="v2-grid"><div class="v2-stat"><span>Products</span><strong>${data.activeProducts.length}</strong></div><div class="v2-stat"><span>Open orders</span><strong>${data.openOrders.length}</strong></div><div class="v2-stat"><span>Stock units</span><strong>${stock}</strong></div><div class="v2-stat"><span>Needs setup</span><strong>${data.setup.length}</strong></div></div></section><section class="v2-card"><h2>Start here</h2><div class="v2-actions"><button class="v2-button" onclick="v2SetRoute('merge')">Merge duplicate products</button><button class="v2-button secondary" onclick="v2SetRoute('products')">Review product database</button><button class="v2-button secondary" onclick="v2SetRoute('orders')">Review current orders</button><a class="v2-button secondary" style="text-align:center;text-decoration:none" href="./">Open current app</a></div></section>${data.setup.length?`<section class="v2-card v2-warning"><h2>Information needed</h2><div class="v2-list">${data.setup.slice(0,20).map(p=>`<div class="v2-row"><div><strong>${v2Esc(p.code)} · ${v2Esc(p.name)}</strong><small>No daily manufacturing capacity for current demand.</small></div></div>`).join('')}</div></section>`:''}`;
}

async function v2Products(){
  const data=await v2Data();v2Title.textContent='Product Centre';
  v2Main.innerHTML=`<section class="v2-card"><h2>Product database</h2><p class="muted">${data.activeProducts.length} active products. ${data.placeholders.length} imported placeholders may require merging.</p><input id="v2ProductSearch" class="v2-input" placeholder="Search code or product name"></section><section class="v2-card"><div id="v2ProductList" class="v2-list"></div></section>`;
  const render=()=>{const q=document.getElementById('v2ProductSearch').value.trim().toLowerCase();const rows=data.activeProducts.filter(p=>`${p.code} ${p.name} ${p.category||''}`.toLowerCase().includes(q)).slice(0,150);document.getElementById('v2ProductList').innerHTML=rows.map(p=>`<div class="v2-row"><div><strong>${v2Esc(p.code)} · ${v2Esc(p.name)}</strong><small>${v2Esc(p.category||'Uncategorised')} · Moulds ${Number(p.mouldQuantity||0)} · Capacity ${Number(p.dailyCapacity||0)}/day</small></div>${p.category==='Imported / Unclassified'?'<button class="v2-button secondary" style="width:auto;padding:10px" onclick="v2SetRoute(\'merge\')">Merge</button>':''}</div>`).join('')||'<p class="muted">No products found.</p>'};
  document.getElementById('v2ProductSearch').oninput=render;render();
}

async function v2Merge(){
  const data=await v2Data();v2Title.textContent='Merge Products';
  const products=data.activeProducts.sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')));
  const options=products.map(p=>`<option value="${v2Esc(p.id)}">${v2Esc(p.code)} · ${v2Esc(p.name)}${p.category==='Imported / Unclassified'?' · Imported':''}</option>`).join('');
  v2Main.innerHTML=`<section class="v2-card"><h2>Merge duplicate products</h2><p class="muted">Choose the duplicate to remove, then the correct master product to keep. Existing stock and order demand will move to the master product.</p><label class="v2-label">Duplicate product to remove</label><select id="v2MergeSource" class="v2-select"><option value="">Select duplicate</option>${options}</select><label class="v2-label">Correct product to keep</label><select id="v2MergeTarget" class="v2-select"><option value="">Select correct product</option>${options}</select><div id="v2MergePreview" class="v2-preview"><p class="muted">Select both products.</p></div><button id="v2MergeConfirm" class="v2-button" disabled>Merge products</button></section>`;
  const source=document.getElementById('v2MergeSource'),target=document.getElementById('v2MergeTarget'),confirmButton=document.getElementById('v2MergeConfirm');
  async function preview(){
    const sourceProduct=products.find(p=>p.id===source.value),targetProduct=products.find(p=>p.id===target.value);
    if(!sourceProduct||!targetProduct||sourceProduct.id===targetProduct.id){document.getElementById('v2MergePreview').innerHTML=`<p class="muted">${sourceProduct&&targetProduct?'Choose two different products.':'Select both products.'}</p>`;confirmButton.disabled=true;return}
    const affectedOrders=data.orders.filter(o=>(o.lines||[]).some(l=>l.productId===sourceProduct.id));
    const units=affectedOrders.reduce((sum,o)=>sum+(o.lines||[]).filter(l=>l.productId===sourceProduct.id).reduce((s,l)=>s+Number(l.qty||0),0),0);
    const stock=data.balances.filter(b=>b.productId===sourceProduct.id).reduce((sum,b)=>sum+Number(b.quantity||0),0);
    document.getElementById('v2MergePreview').innerHTML=`<strong>${v2Esc(sourceProduct.code)} · ${v2Esc(sourceProduct.name)}</strong><p>will be merged into</p><strong>${v2Esc(targetProduct.code)} · ${v2Esc(targetProduct.name)}</strong><p class="muted">${affectedOrders.length} affected orders · ${units} ordered units · ${stock} stock units</p>`;confirmButton.disabled=false;
  }
  source.onchange=preview;target.onchange=preview;confirmButton.onclick=()=>v2ExecuteMerge(source.value,target.value);
}

async function v2ExecuteMerge(sourceId,targetId){
  if(!sourceId||!targetId||sourceId===targetId)return;
  const [source,target,orders,quotes,jobs,balances,mappings]=await Promise.all([getOne('products',sourceId),getOne('products',targetId),v2SafeAll('orders'),v2SafeAll('quotes'),v2SafeAll('productionJobs'),v2SafeAll('inventoryBalances'),v2SafeAll('importMappings')]);
  if(!source||!target)return alert('A selected product could not be found.');
  if(!confirm(`Merge ${source.code} into ${target.code}?\n\nThe duplicate product will be removed after its records are transferred.`))return;
  const now=new Date().toISOString();let changedOrders=0;
  for(const order of orders){let changed=false;const lines=(order.lines||[]).map(line=>{if(line.productId!==sourceId)return line;changed=true;return {...line,sourceProductCode:line.sourceProductCode||source.code,sourceProductName:line.sourceProductName||source.name,productId:target.id,productCode:target.code,productName:target.name}});if(changed){await putOne('orders',{...order,lines,updatedAt:now});changedOrders++}}
  for(const quote of quotes){let changed=false;const lines=(quote.lines||[]).map(line=>{if(line.productId!==sourceId)return line;changed=true;return {...line,productId:target.id,productCode:target.code,productName:target.name}});if(changed)await putOne('quotes',{...quote,lines,updatedAt:now})}
  for(const job of jobs)if(job.productId===sourceId)await putOne('productionJobs',{...job,productId:target.id,productCode:target.code,productName:target.name,updatedAt:now});
  for(const balance of balances.filter(b=>b.productId===sourceId)){
    const colour=balance.colourName||'Standard';const id=`${target.id}::${colour.toLowerCase()}`;const existing=await getOne('inventoryBalances',id);const previous=Number(existing?.quantity||0),addition=Number(balance.quantity||0),next=previous+addition;
    await putOne('inventoryBalances',{id,productId:target.id,productCode:target.code,productName:target.name,colourName:colour,quantity:next,updatedAt:now});
    if(addition)await putOne('inventoryTransactions',{id:v2Uid('inv'),productId:target.id,productCode:target.code,productName:target.name,colourName:colour,type:'PRODUCT_MERGE',previousQuantity:previous,quantityChange:addition,newQuantity:next,note:`Merged from ${source.code}`,createdAt:now});
    await deleteOne('inventoryBalances',balance.id);
  }
  const aliases=[...(target.aliases||[]),...(source.aliases||[]),source.code,source.name].map(v=>String(v||'').trim()).filter(Boolean).filter((v,i,a)=>a.findIndex(x=>v2Normalise(x)===v2Normalise(v))===i).filter(v=>v2Normalise(v)!==v2Normalise(target.code));
  await putOne('products',{...target,aliases,updatedAt:now});
  for(const alias of aliases){const id=`product:${v2Normalise(alias)}`;await putOne('importMappings',{id,type:'product',source:alias,targetId:target.id,targetLabel:`${target.code} · ${target.name}`,updatedAt:now}).catch(()=>{})}
  for(const mapping of mappings.filter(m=>m.type==='product'&&m.targetId===sourceId))await putOne('importMappings',{...mapping,targetId:target.id,targetLabel:`${target.code} · ${target.name}`,updatedAt:now});
  await deleteOne('products',source.id);
  alert(`Merge complete.\n\n${changedOrders} orders updated.\n${source.code} now resolves to ${target.code}.`);v2SetRoute('products');
}

async function v2Imports(){const data=await v2Data();v2Title.textContent='Import Centre';v2Main.innerHTML=`<section class="v2-card"><h2>Import status</h2><div class="v2-grid"><div class="v2-stat"><span>Imported placeholders</span><strong>${data.placeholders.length}</strong></div><div class="v2-stat"><span>Remembered mappings</span><strong>${data.mappings.length}</strong></div><div class="v2-stat"><span>Customers</span><strong>${data.customers.length}</strong></div><div class="v2-stat"><span>Orders</span><strong>${data.orders.length}</strong></div></div></section><section class="v2-card"><h2>Available actions</h2><div class="v2-actions"><button class="v2-button" onclick="v2SetRoute('merge')">Merge duplicate products</button><a class="v2-button secondary" style="text-align:center;text-decoration:none" href="./">Open current app to import job-card file</a></div></section>`}

async function v2Orders(){const data=await v2Data();v2Title.textContent='Orders';v2Main.innerHTML=`<section class="v2-card"><h2>Open orders</h2><p class="muted">${data.openOrders.length} orders currently require action.</p><div class="v2-list">${data.openOrders.sort((a,b)=>String(a.dueDate||'').localeCompare(String(b.dueDate||''))).slice(0,100).map(o=>`<div class="v2-row"><div><strong>${v2Esc(o.orderNumber||'Order')} · ${v2Esc(o.customerName||'Customer')}</strong><small>${(o.lines||[]).length} product lines · ${v2Esc(o.status||'Open')} · Due ${v2Esc(o.dueDate||'Not set')}</small></div></div>`).join('')||'<p class="muted">No open orders.</p>'}</div></section>`}

v2SetRoute('dashboard');
