const mergeNormalise=value=>String(value||"").trim().toUpperCase();

async function openMergeProducts(){
  const products=(await getAll("products"))
    .filter(product=>product.isActive!==false)
    .sort((a,b)=>String(a.code||"").localeCompare(String(b.code||"")));
  pageTitle.textContent="Merge Products";
  backBtn.classList.remove("hidden");
  main.innerHTML=`
    <section class="card">
      <div class="section-head"><div><div class="step-label">Product database</div><h2>Merge duplicate products</h2></div></div>
      <p class="muted">Choose the duplicate imported product first, then choose the correct product that must remain. Orders, production demand and remembered import names will be moved to the correct product.</p>
    </section>
    <section class="card">
      <label>Duplicate product to remove
        <select id="mergeSourceProduct">
          <option value="">Select duplicate product</option>
          ${products.map(product=>`<option value="${product.id}">${esc(product.code)} · ${esc(product.name)}${product.category==="Imported / Unclassified"?" · Imported":""}</option>`).join("")}
        </select>
      </label>
      <label>Correct product to keep
        <select id="mergeTargetProduct">
          <option value="">Select correct product</option>
          ${products.map(product=>`<option value="${product.id}">${esc(product.code)} · ${esc(product.name)}</option>`).join("")}
        </select>
      </label>
      <div id="mergeProductPreview" class="card" style="margin-top:12px"><p class="muted">Select both products to review the merge.</p></div>
      <button id="confirmProductMerge" class="primary" type="button" disabled>Merge products</button>
    </section>`;

  const sourceSelect=document.getElementById("mergeSourceProduct");
  const targetSelect=document.getElementById("mergeTargetProduct");
  const refresh=async()=>{
    const source=products.find(p=>p.id===sourceSelect.value);
    const target=products.find(p=>p.id===targetSelect.value);
    const button=document.getElementById("confirmProductMerge");
    if(!source||!target||source.id===target.id){
      document.getElementById("mergeProductPreview").innerHTML=`<p class="muted">${source&&target&&source.id===target.id?"Choose two different products.":"Select both products to review the merge."}</p>`;
      button.disabled=true;
      return;
    }
    const [orders,quotes,jobs,balances]=await Promise.all([getAll("orders"),getAll("quotes"),getAll("productionJobs"),getAll("inventoryBalances")]);
    const affectedOrders=orders.filter(order=>(order.lines||[]).some(line=>line.productId===source.id)).length;
    const affectedQuotes=quotes.filter(quote=>(quote.lines||[]).some(line=>line.productId===source.id)).length;
    const affectedJobs=jobs.filter(job=>job.productId===source.id).length;
    const sourceStock=balances.filter(balance=>balance.productId===source.id).reduce((sum,balance)=>sum+Number(balance.quantity||0),0);
    document.getElementById("mergeProductPreview").innerHTML=`
      <strong>${esc(source.code)} · ${esc(source.name)}</strong>
      <p>will be merged into</p>
      <strong>${esc(target.code)} · ${esc(target.name)}</strong>
      <p class="muted">${affectedOrders} orders · ${affectedQuotes} quotes · ${affectedJobs} production records · ${sourceStock} stock units to transfer</p>`;
    button.disabled=false;
  };
  sourceSelect.onchange=refresh;
  targetSelect.onchange=refresh;
  document.getElementById("confirmProductMerge").onclick=()=>mergeProducts(sourceSelect.value,targetSelect.value);
}

async function mergeProducts(sourceId,targetId){
  if(!sourceId||!targetId||sourceId===targetId)return notify("Choose two different products");
  const [source,target,orders,quotes,jobs,balances]=await Promise.all([
    getOne("products",sourceId),getOne("products",targetId),getAll("orders"),getAll("quotes"),getAll("productionJobs"),getAll("inventoryBalances")
  ]);
  if(!source||!target)return notify("A selected product could not be found");
  const confirmed=confirm(`Merge ${source.code} · ${source.name} into ${target.code} · ${target.name}?\n\nThe duplicate will be removed after its records are moved.`);
  if(!confirmed)return;
  const now=new Date().toISOString();
  let changedOrders=0,changedQuotes=0,changedJobs=0;

  for(const order of orders){
    let changed=false;
    const lines=(order.lines||[]).map(line=>{
      if(line.productId!==sourceId)return line;
      changed=true;
      const colourName=line.colour?.name||"Standard";
      const colour=(target.colours||[]).find(c=>String(c.name||"").toLowerCase()===colourName.toLowerCase())||line.colour||{name:colourName,hex:"#999999"};
      return {...line,sourceProductCode:line.sourceProductCode||source.code,sourceProductName:line.sourceProductName||source.name,productId:target.id,productCode:target.code,productName:target.name,colour};
    });
    if(changed){await putOne("orders",{...order,lines,updatedAt:now});changedOrders++;}
  }

  for(const quote of quotes){
    let changed=false;
    const lines=(quote.lines||[]).map(line=>{
      if(line.productId!==sourceId)return line;
      changed=true;
      return {...line,productId:target.id,productCode:target.code,productName:target.name};
    });
    if(changed){await putOne("quotes",{...quote,lines,updatedAt:now});changedQuotes++;}
  }

  for(const job of jobs){
    if(job.productId!==sourceId)continue;
    await putOne("productionJobs",{...job,productId:target.id,productCode:target.code,productName:target.name,updatedAt:now});
    changedJobs++;
  }

  for(const balance of balances.filter(item=>item.productId===sourceId)){
    const colourName=balance.colourName||"Standard";
    const targetBalanceId=typeof inventoryBalanceId==="function"?inventoryBalanceId(target.id,colourName):`${target.id}::${colourName.toLowerCase()}`;
    const targetBalance=await getOne("inventoryBalances",targetBalanceId);
    const previous=Number(targetBalance?.quantity||0);
    const addition=Number(balance.quantity||0);
    const next=previous+addition;
    await putOne("inventoryBalances",{id:targetBalanceId,productId:target.id,productCode:target.code,productName:target.name,colourName,quantity:next,updatedAt:now});
    if(addition!==0)await putOne("inventoryTransactions",{id:uid("inv"),productId:target.id,productCode:target.code,productName:target.name,colourName,type:"PRODUCT_MERGE",previousQuantity:previous,quantityChange:addition,newQuantity:next,note:`Merged stock from ${source.code}`,createdAt:now});
    await deleteOne("inventoryBalances",balance.id);
  }

  const aliases=[...(target.aliases||[]),...(source.aliases||[]),source.code,source.name]
    .map(value=>String(value||"").trim()).filter(Boolean)
    .filter((value,index,list)=>list.findIndex(item=>mergeNormalise(item)===mergeNormalise(value))===index)
    .filter(value=>mergeNormalise(value)!==mergeNormalise(target.code));
  await putOne("products",{...target,aliases,updatedAt:now});
  if(typeof saveImportMapping==="function"){
    for(const alias of aliases)await saveImportMapping("product",alias,target.id,`${target.code} · ${target.name}`);
  }
  await deleteOne("products",source.id);
  alert(`Merge complete\n\nOrders updated: ${changedOrders}\nQuotes updated: ${changedQuotes}\nProduction records updated: ${changedJobs}\n\n${source.code} now resolves to ${target.code}.`);
  navigate("products");
}

function injectMergeProductsButton(){
  if(route!=="products"||document.getElementById("mergeProductsBtn"))return;
  const button=document.createElement("button");
  button.id="mergeProductsBtn";
  button.className="secondary";
  button.type="button";
  button.textContent="Merge products";
  button.onclick=openMergeProducts;
  const toolbar=document.querySelector(".product-toolbar-row")||main.querySelector(".actions")||main.firstElementChild;
  if(toolbar)toolbar.appendChild(button);
  else main.prepend(button);
}

const mergeProductsObserver=new MutationObserver(()=>injectMergeProductsButton());
mergeProductsObserver.observe(main,{childList:true,subtree:true});
const productsPageBeforeMerge=productsPage;
productsPage=async function(...args){await productsPageBeforeMerge(...args);injectMergeProductsButton();};

window.openMergeProducts=openMergeProducts;
window.mergeProducts=mergeProducts;
