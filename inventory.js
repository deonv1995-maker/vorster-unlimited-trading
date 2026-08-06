
const inventoryBalanceId=(productId,colourName)=>`${productId}::${String(colourName||"Standard").trim().toLowerCase()}`;

async function inventorySnapshot(){
  const balances=await getAll("inventoryBalances");
  const byProduct={};
  for(const balance of balances){
    if(!byProduct[balance.productId])byProduct[balance.productId]=[];
    byProduct[balance.productId].push(balance);
  }
  return byProduct;
}

function inventoryTotalFor(productId,snapshot){
  return (snapshot[productId]||[]).reduce((sum,item)=>sum+Number(item.quantity||0),0);
}

async function showStockCount(productId){
  const [product,balances]=await Promise.all([
    getOne("products",productId),
    getAll("inventoryBalances")
  ]);
  if(!product){notify("Product not found");return;}

  const saved=balances.filter(item=>item.productId===productId);
  const configured=(product.colours||[]).map(c=>({name:c.name||"Standard",hex:c.hex||"#cccccc"}));
  const savedOnly=saved
    .filter(item=>!configured.some(c=>c.name.toLowerCase()===String(item.colourName||"").toLowerCase()))
    .map(item=>({name:item.colourName||"Standard",hex:"#cccccc"}));
  const colours=[...(configured.length?configured:[{name:"Standard",hex:"#cccccc"}]),...savedOnly];
  const uniqueColours=colours.filter((colour,index,list)=>list.findIndex(c=>c.name.toLowerCase()===colour.name.toLowerCase())===index);
  const currentByColour=Object.fromEntries(saved.map(item=>[String(item.colourName||"Standard").toLowerCase(),Number(item.quantity||0)]));

  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Stock on hand</div><h2>${esc(product.code)} · ${esc(product.name)}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <p class="muted">Enter the physical quantity currently counted for each colour. Saving creates an inventory transaction and keeps the previous count in the history.</p>
    <form id="stockCountForm">
      <div class="stock-count-list">
        ${uniqueColours.map((colour,index)=>{
          const current=currentByColour[colour.name.toLowerCase()]||0;
          return `<label class="stock-count-row">
            <span class="stock-colour"><span class="swatch" style="--swatch:${esc(colour.hex)}"></span><strong>${esc(colour.name)}</strong><small>Current: ${current}</small></span>
            <input type="number" min="0" step="1" inputmode="numeric" name="stock_${index}" data-colour="${esc(colour.name)}" value="${current}" required>
          </label>`;
        }).join("")}
      </div>
      <label>Stock-count note<textarea name="note" placeholder="Example: Opening count, weekly stocktake or correction"></textarea></label>
      <button class="primary" type="submit">Save stock on hand</button>
    </form>
    <div class="stock-history-link"><button id="viewStockHistory" class="ghost" type="button">View stock history</button></div>
  `);

  document.getElementById("stockCountForm").onsubmit=async event=>{
    event.preventDefault();
    const form=event.target;
    const note=new FormData(form).get("note")?.trim()||"Manual stock count";
    const now=new Date().toISOString();
    const inputs=[...form.querySelectorAll("input[data-colour]")];
    for(const input of inputs){
      const colourName=input.dataset.colour||"Standard";
      const newQuantity=Math.max(0,Math.round(Number(input.value||0)));
      const id=inventoryBalanceId(product.id,colourName);
      const previous=await getOne("inventoryBalances",id);
      const previousQuantity=Number(previous?.quantity||0);
      await putOne("inventoryBalances",{
        id,
        productId:product.id,
        productCode:product.code,
        productName:product.name,
        colourName,
        quantity:newQuantity,
        updatedAt:now
      });
      if(previousQuantity!==newQuantity){
        await putOne("inventoryTransactions",{
          id:uid("inv"),
          productId:product.id,
          productCode:product.code,
          productName:product.name,
          colourName,
          type:"STOCK_COUNT",
          previousQuantity,
          quantityChange:newQuantity-previousQuantity,
          newQuantity,
          note,
          createdAt:now
        });
      }
    }
    closeDialog();
    notify("Stock on hand updated");
    if(route==="products")await productsPage();
  };
  document.getElementById("viewStockHistory").onclick=()=>showStockHistory(product.id);
}

async function showStockHistory(productId=""){
  const [products,transactions]=await Promise.all([getAll("products"),getAll("inventoryTransactions")]);
  const product=products.find(p=>p.id===productId);
  const rows=transactions
    .filter(item=>!productId||item.productId===productId)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Inventory audit</div><h2>${product?`${esc(product.code)} stock history`:"Stock history"}</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <div class="stock-history-list">
      ${rows.length?rows.slice(0,100).map(item=>`
        <div class="stock-history-row">
          <div><strong>${esc(item.productCode)} · ${esc(item.colourName)}</strong><p>${esc(item.note||"Manual stock count")}</p><small>${dateText(item.createdAt)}</small></div>
          <div class="stock-history-qty"><span>${item.quantityChange>=0?"+":""}${item.quantityChange}</span><strong>${item.newQuantity}</strong><small>on hand</small></div>
        </div>`).join(""):`<div class="empty">No stock changes recorded yet.</div>`}
    </div>
  `);
}

async function openStockCountList(filter=""){
  const [products,snapshot]=await Promise.all([getAll("products"),inventorySnapshot()]);
  const query=filter.trim().toLowerCase();
  const shown=products
    .filter(p=>p.isActive!==false)
    .filter(p=>(`${p.code} ${p.name} ${p.category||""}`).toLowerCase().includes(query))
    .sort((a,b)=>a.code.localeCompare(b.code));
  openDialog(`
    <div class="dialog-head"><div><div class="step-label">Physical stocktake</div><h2>Update stock on hand</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <input id="stockProductSearch" class="search" placeholder="Search product code or name" value="${esc(filter)}">
    <div id="stockProductList" class="stock-product-list">
      ${shown.length?shown.map(product=>`
        <button class="stock-product-row" type="button" data-stock-product="${product.id}">
          <div>${product.image?`<img src="${product.image}" alt="">`:`<span class="stock-placeholder">▦</span>`}</div>
          <span><strong>${esc(product.code)}</strong><small>${esc(product.name)}</small></span>
          <span class="stock-total"><strong>${inventoryTotalFor(product.id,snapshot)}</strong><small>on hand</small></span>
        </button>`).join(""):`<div class="empty">No products found.</div>`}
    </div>
    <button id="allStockHistory" class="ghost" type="button">View all stock history</button>
  `);
  document.getElementById("stockProductSearch").oninput=e=>openStockCountList(e.target.value);
  document.querySelectorAll("[data-stock-product]").forEach(button=>button.onclick=()=>showStockCount(button.dataset.stockProduct));
  document.getElementById("allStockHistory").onclick=()=>showStockHistory();
}

async function decorateProductsWithStock(){
  if(route!=="products")return;
  const [products,snapshot]=await Promise.all([getAll("products"),inventorySnapshot()]);
  const toolbar=document.querySelector(".product-toolbar-row");
  if(toolbar&&!document.getElementById("stockCountBtn")){
    const button=document.createElement("button");
    button.id="stockCountBtn";
    button.className="primary stock-count-button";
    button.type="button";
    button.textContent="Stock count";
    button.onclick=()=>openStockCountList();
    toolbar.appendChild(button);
  }

  document.querySelectorAll(".management-product-card").forEach(card=>{
    const editButton=card.querySelector('button[onclick^="showProductForm"]');
    const match=editButton?.getAttribute("onclick")?.match(/'([^']+)'/);
    const productId=match?.[1];
    if(!productId||card.querySelector(".stock-on-hand-badge"))return;
    const total=inventoryTotalFor(productId,snapshot);
    const body=card.querySelector(".management-card-body");
    const badge=document.createElement("div");
    badge.className="stock-on-hand-badge";
    badge.innerHTML=`<span>Stock on hand</span><strong>${total}</strong>`;
    body?.insertBefore(badge,body.querySelector(".actions"));
    const stockButton=document.createElement("button");
    stockButton.className="primary";
    stockButton.type="button";
    stockButton.textContent="Update stock";
    stockButton.onclick=()=>showStockCount(productId);
    card.querySelector(".actions")?.prepend(stockButton);
  });

  document.querySelectorAll(".compact-product-card").forEach(card=>{
    const match=card.getAttribute("onclick")?.match(/'([^']+)'/);
    const productId=match?.[1];
    if(!productId||card.querySelector(".compact-stock-badge"))return;
    const badge=document.createElement("span");
    badge.className="compact-stock-badge";
    badge.textContent=`Stock ${inventoryTotalFor(productId,snapshot)}`;
    card.appendChild(badge);
  });
}

const originalProductsPage=productsPage;
productsPage=async function(...args){
  await originalProductsPage(...args);
  await decorateProductsWithStock();
};

window.showStockCount=showStockCount;
window.showStockHistory=showStockHistory;
window.openStockCountList=openStockCountList;

if(route==="products")decorateProductsWithStock();
