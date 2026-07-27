
const main=document.getElementById("main");
const pageTitle=document.getElementById("pageTitle");
const backBtn=document.getElementById("backBtn");
const dialog=document.getElementById("dialog");
const toast=document.getElementById("toast");
let route="dashboard";
let deferredPrompt=null;

const uid=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const money=n=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(Number(n||0));
const dateText=v=>new Intl.DateTimeFormat("en-ZA",{dateStyle:"medium"}).format(new Date(v));
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const statusClass=s=>String(s||"").toLowerCase().replaceAll(" ","-");
const fileToDataUrl=file=>new Promise((resolve,reject)=>{
  const r=new FileReader();
  r.onload=()=>resolve(r.result);
  r.onerror=()=>reject(r.error);
  r.readAsDataURL(file);
});

setTimeout(()=>{
  document.getElementById("splash").classList.add("hide");
  document.getElementById("app").classList.remove("hidden");
  setTimeout(()=>document.getElementById("splash").remove(),450);
},850);

if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();deferredPrompt=e;document.getElementById("installBtn").classList.remove("hidden");
});
document.getElementById("installBtn").onclick=async()=>{
  if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;}
};

document.querySelectorAll(".bottom-nav button").forEach(b=>b.onclick=()=>navigate(b.dataset.route));
backBtn.onclick=()=>navigate("orders");

function navState(name){
  document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.route===name));
}
function notify(msg){
  toast.textContent=msg;toast.classList.remove("hidden");
  setTimeout(()=>toast.classList.add("hidden"),2200);
}
function openDialog(html){
  dialog.innerHTML=`<div class="dialog-inner">${html}</div>`;dialog.showModal();
}
function closeDialog(){dialog.close()}
dialog.addEventListener("click",e=>{if(e.target===dialog)closeDialog()});

async function navigate(name){
  route=name;navState(name);backBtn.classList.add("hidden");
  const titles={dashboard:"Dashboard",products:"Products",customers:"Customers",orders:"Orders",settings:"Settings"};
  pageTitle.textContent=titles[name]||"Vorster Unlimited Trading";
  if(name==="dashboard")await dashboard();
  if(name==="products")await productsPage();
  if(name==="customers")await customersPage();
  if(name==="orders")await ordersPage();
  if(name==="settings")await settingsPage();
}

async function dashboard(){
  const [products,customers,orders]=await Promise.all([getAll("products"),getAll("customers"),getAll("orders")]);
  const drafts=orders.filter(o=>o.status==="Draft").length;
  const confirmed=orders.filter(o=>o.status==="Confirmed").length;
  const value=orders.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+Number(o.grandTotal||0),0);
  main.innerHTML=`
    <div class="grid two">
      <div class="card stat"><span class="muted">Products</span><strong>${products.length}</strong></div>
      <div class="card stat"><span class="muted">Customers</span><strong>${customers.length}</strong></div>
      <div class="card stat"><span class="muted">Draft orders</span><strong>${drafts}</strong></div>
      <div class="card stat"><span class="muted">Confirmed</span><strong>${confirmed}</strong></div>
    </div>
    <div class="card" style="margin-top:12px"><span class="muted">Recorded order value</span><h2>${money(value)}</h2></div>
    <div class="section-head"><h2>Quick actions</h2></div>
    <div class="quick-grid">
      <button class="quick-card" onclick="startOrder()"><span>▤</span><strong>New order</strong></button>
      <button class="quick-card" onclick="showProductForm()"><span>▦</span><strong>Add product</strong></button>
      <button class="quick-card" onclick="showCustomerForm()"><span>◉</span><strong>Add customer</strong></button>
      <button class="quick-card" onclick="navigate('settings')"><span>⬇</span><strong>Backup</strong></button>
    </div>`;
}

async function productsPage(filter=""){
  const items=(await getAll("products")).sort((a,b)=>a.code.localeCompare(b.code));
  const shown=items.filter(p=>(p.code+" "+p.name+" "+(p.category||"")).toLowerCase().includes(filter.toLowerCase()));
  main.innerHTML=`
    <input id="productSearch" class="search" placeholder="Search products" value="${esc(filter)}">
    <div class="list" style="margin-top:10px">${shown.length?shown.map(p=>`
      <div class="list-item">
        <div>
          <h3>${esc(p.code)} · ${esc(p.name)}</h3>
          <p>${money(p.price)} <span class="muted">ex VAT</span></p>
          <div class="colour-tiles">${(p.colours||[]).map(c=>`<span class="colour-tile"><span class="swatch" style="--swatch:${esc(c.hex||"#ccc")}"></span>${esc(c.name)}</span>`).join("")}</div>
        </div>
        <div class="actions">
          <button class="ghost" onclick="showProductForm('${p.id}')">Edit</button>
          <button class="danger" onclick="removeProduct('${p.id}')">Delete</button>
        </div>
      </div>`).join(""):`<div class="empty">No products yet. Tap + to add one.</div>`}</div>
    <button class="fab" onclick="showProductForm()">+</button>`;
  document.getElementById("productSearch").oninput=e=>productsPage(e.target.value);
}

async function showProductForm(id=""){
  const p=id?await getOne("products",id):{id:uid("prd"),code:"",name:"",description:"",category:"",price:"",colours:[],image:""};
  let colours=[...(p.colours||[])];
  openDialog(`
    <div class="dialog-head"><h2>${id?"Edit":"Add"} product</h2><button class="close-btn" onclick="closeDialog()">×</button></div>
    <form id="productForm">
      <div class="image-picker">
        <img id="productPreview" src="${p.image||"vorster-logo.jpg"}" alt="Product preview">
        <label class="secondary image-upload">Choose product image<input id="productImage" type="file" accept="image/*" hidden></label>
      </div>
      <label>Product code<input name="code" required value="${esc(p.code)}"></label>
      <label>Product name<input name="name" required value="${esc(p.name)}"></label>
      <label>Description<textarea name="description">${esc(p.description||"")}</textarea></label>
      <label>Category or range<input name="category" value="${esc(p.category||"")}"></label>
      <label>Price excluding VAT<input name="price" type="number" min="0" step="0.01" required value="${esc(p.price)}"></label>
      <div>
        <label>Available colours</label>
        <div class="colour-entry">
          <input id="colourName" placeholder="Colour name">
          <input id="colourHex" type="color" value="#777777" style="width:58px;padding:4px">
          <button id="addColour" class="secondary" type="button">Add</button>
        </div>
        <div id="savedColours" class="colour-tiles"></div>
      </div>
      <button class="primary" type="submit">Save product</button>
    </form>`);
  const renderColours=()=>{
    document.getElementById("savedColours").innerHTML=colours.length?colours.map((c,i)=>`
      <button type="button" class="colour-tile" data-i="${i}">
        <span class="swatch" style="--swatch:${esc(c.hex)}"></span>${esc(c.name)} ×
      </button>`).join(""):`<span class="muted">Add at least one colour.</span>`;
    document.querySelectorAll("#savedColours button").forEach(b=>b.onclick=()=>{colours.splice(Number(b.dataset.i),1);renderColours()});
  };
  document.getElementById("addColour").onclick=()=>{
    const name=document.getElementById("colourName").value.trim();
    const hex=document.getElementById("colourHex").value;
    if(name&&!colours.some(c=>c.name.toLowerCase()===name.toLowerCase())) colours.push({name,hex});
    document.getElementById("colourName").value="";renderColours();
  };
  renderColours();
  let productImage=p.image||"";
  document.getElementById("productImage").onchange=async e=>{
    const file=e.target.files[0];
    if(file){
      productImage=await fileToDataUrl(file);
      document.getElementById("productPreview").src=productImage;
    }
  };
  document.getElementById("productForm").onsubmit=async e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.target));
    await putOne("products",{...p,...d,price:Number(d.price),colours,image:productImage,updatedAt:new Date().toISOString()});
    closeDialog();notify("Product saved");navigate("products");
  };
}
async function removeProduct(id){
  if(confirm("Delete this product? Existing orders will keep their saved product information.")){
    await deleteOne("products",id);notify("Product deleted");productsPage();
  }
}

async function customersPage(filter=""){
  const items=(await getAll("customers")).sort((a,b)=>a.name.localeCompare(b.name));
  const shown=items.filter(c=>(c.name+" "+(c.contactPerson||"")+" "+(c.phone||"")).toLowerCase().includes(filter.toLowerCase()));
  main.innerHTML=`
    <input id="customerSearch" class="search" placeholder="Search customers" value="${esc(filter)}">
    <div class="list" style="margin-top:10px">${shown.length?shown.map(c=>`
      <div class="list-item">
        <div><h3>${esc(c.name)}</h3><p>${esc(c.contactPerson||"No contact person")}</p><p class="muted">${esc(c.phone||"")} ${c.vatNumber?`· VAT ${esc(c.vatNumber)}`:""}</p></div>
        <div class="actions"><button class="ghost" onclick="showCustomerForm('${c.id}')">Edit</button><button class="danger" onclick="removeCustomer('${c.id}')">Delete</button></div>
      </div>`).join(""):`<div class="empty">No customers yet. Tap + to add one.</div>`}</div>
    <button class="fab" onclick="showCustomerForm()">+</button>`;
  document.getElementById("customerSearch").oninput=e=>customersPage(e.target.value);
}
async function showCustomerForm(id=""){
  const c=id?await getOne("customers",id):{id:uid("cus"),name:"",vatNumber:"",contactPerson:"",phone:"",whatsapp:"",email:"",address:"",deliveryAddress:"",preference:"Delivery",notes:""};
  openDialog(`
    <div class="dialog-head"><h2>${id?"Edit":"Add"} customer</h2><button class="close-btn" onclick="closeDialog()">×</button></div>
    <form id="customerForm">
      <label>Customer name<input name="name" required value="${esc(c.name)}"></label>
      <label>VAT number<input name="vatNumber" value="${esc(c.vatNumber)}"></label>
      <label>Contact person<input name="contactPerson" value="${esc(c.contactPerson)}"></label>
      <label>Telephone<input name="phone" value="${esc(c.phone)}"></label>
      <label>WhatsApp<input name="whatsapp" value="${esc(c.whatsapp)}"></label>
      <label>Email<input type="email" name="email" value="${esc(c.email)}"></label>
      <label>Physical address<textarea name="address">${esc(c.address)}</textarea></label>
      <label>Delivery address<textarea name="deliveryAddress">${esc(c.deliveryAddress)}</textarea></label>
      <label>Default preference<select name="preference"><option ${c.preference==="Delivery"?"selected":""}>Delivery</option><option ${c.preference==="Collection"?"selected":""}>Collection</option></select></label>
      <label>Notes<textarea name="notes">${esc(c.notes)}</textarea></label>
      <button class="primary" type="submit">Save customer</button>
    </form>`);
  document.getElementById("customerForm").onsubmit=async e=>{
    e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    await putOne("customers",{...c,...d,updatedAt:new Date().toISOString()});
    closeDialog();notify("Customer saved");navigate("customers");
  };
}
async function removeCustomer(id){
  if(confirm("Delete this customer? Existing orders will keep their saved customer details.")){
    await deleteOne("customers",id);notify("Customer deleted");customersPage();
  }
}

async function ordersPage(){
  const orders=(await getAll("orders")).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  main.innerHTML=`
    <div class="section-head"><h2>All orders</h2><button class="primary" onclick="startOrder()">New order</button></div>
    <div class="list">${orders.length?orders.map(o=>`
      <button class="list-item" style="width:100%;text-align:left" onclick="viewOrder('${o.id}')">
        <div><h3>${esc(o.orderNumber)} · ${esc(o.customerName)}</h3><p class="muted">${dateText(o.createdAt)}</p><span class="badge ${statusClass(o.status)}">${esc(o.status)}</span></div>
        <strong>${money(o.grandTotal)}</strong>
      </button>`).join(""):`<div class="empty">No orders yet.</div>`}</div>`;
}

async function startOrder(existingId=""){
  const [products,customers]=await Promise.all([getAll("products"),getAll("customers")]);
  if(!products.length){alert("Add at least one product first.");return navigate("products")}
  if(!customers.length){alert("Add at least one customer first.");return navigate("customers")}
  const existing=existingId?await getOne("orders",existingId):null;
  const order=existing?structuredClone(existing):{
    id:uid("ord"),orderNumber:`SO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    customerId:"",status:"Draft",lines:[],delivery:0,notes:"",vatRate:15,createdAt:new Date().toISOString()
  };
  let lines=order.lines||[];
  let selectedProduct=null,selectedColour=null,selectedQty=1;
  pageTitle.textContent=existing?"Edit order":"New order";
  backBtn.classList.remove("hidden");
  main.innerHTML=`
    <div class="order-shell">
      <div>
        <div class="step-label">Step 1</div>
        <label>Select customer<select id="orderCustomer"><option value="">Choose customer</option>${customers.map(c=>`<option value="${c.id}" ${order.customerId===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
      </div>
      <div>
        <div class="step-label">Step 2</div>
        <label>Choose products</label>
        <input id="catalogueSearch" class="search" placeholder="Search by code or product name">
        <div id="catalogue" class="product-grid" style="margin-top:10px"></div>
      </div>
      <div id="picker" class="picker-panel hidden"></div>
      <div>
        <div class="step-label">Step 3</div>
        <div class="section-head"><h2>Review order</h2><span id="basketCount" class="badge"></span></div>
        <div id="basket" class="basket"></div>
      </div>
      <label>Delivery charge<input id="delivery" type="number" min="0" step="0.01" value="${Number(order.delivery||0)}"></label>
      <label>Order notes<textarea id="orderNotes">${esc(order.notes||"")}</textarea></label>
      <div id="totals" class="total-box"></div>
      <div class="save-actions"><button id="saveDraft" class="secondary">Save draft</button><button id="saveConfirm" class="primary">Save & confirm</button></div>
    </div>`;
  const catalogue=document.getElementById("catalogue"),picker=document.getElementById("picker"),basket=document.getElementById("basket");
  function renderCatalogue(filter=""){
    const shown=products.filter(p=>(p.code+" "+p.name+" "+(p.category||"")).toLowerCase().includes(filter.toLowerCase()));
    catalogue.innerHTML=shown.map(p=>`
      <button class="product-card" data-id="${p.id}">
        ${p.image?`<img src="${p.image}" alt="${esc(p.name)}">`:`<div class="catalogue-placeholder">▦</div>`}
        <div><strong>${esc(p.code)}</strong><div>${esc(p.name)}</div></div>
        <small>${money(p.price)} ex VAT</small>
      </button>`).join("");
    catalogue.querySelectorAll("button").forEach(b=>b.onclick=()=>openPicker(b.dataset.id));
  }
  function openPicker(id){
    selectedProduct=products.find(p=>p.id===id);selectedQty=1;
    selectedColour=(selectedProduct.colours||[])[0]||{name:"Standard",hex:"#bbbbbb"};
    picker.classList.remove("hidden");
    picker.innerHTML=`
      <div class="dialog-head"><div><strong>${esc(selectedProduct.code)}</strong><div>${esc(selectedProduct.name)}</div></div><button id="closePicker" class="close-btn">×</button></div>
      <label>Choose colour</label>
      <div class="colour-tiles">${((selectedProduct.colours||[]).length?selectedProduct.colours:[{name:"Standard",hex:"#bbbbbb"}]).map((c,i)=>`
        <button class="colour-tile ${i===0?"selected":""}" data-name="${esc(c.name)}" data-hex="${esc(c.hex)}"><span class="swatch" style="--swatch:${esc(c.hex)}"></span>${esc(c.name)}</button>`).join("")}</div>
      <div class="qty-row"><button id="minusQty">−</button><strong id="qtyValue">1</strong><button id="plusQty">+</button></div>
      <button id="addLine" class="primary">Add to order</button>`;
    picker.querySelectorAll(".colour-tile").forEach(b=>b.onclick=()=>{
      selectedColour={name:b.dataset.name,hex:b.dataset.hex};
      picker.querySelectorAll(".colour-tile").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");
    });
    document.getElementById("minusQty").onclick=()=>{selectedQty=Math.max(1,selectedQty-1);document.getElementById("qtyValue").textContent=selectedQty};
    document.getElementById("plusQty").onclick=()=>{selectedQty++;document.getElementById("qtyValue").textContent=selectedQty};
    document.getElementById("closePicker").onclick=()=>picker.classList.add("hidden");
    document.getElementById("addLine").onclick=()=>{
      const same=lines.find(l=>l.productId===selectedProduct.id&&l.colour.name===selectedColour.name);
      if(same)same.qty+=selectedQty;
      else lines.push({productId:selectedProduct.id,productCode:selectedProduct.code,productName:selectedProduct.name,colour:selectedColour,qty:selectedQty,unitPrice:Number(selectedProduct.price)});
      picker.classList.add("hidden");renderBasket();notify("Added to order");
    };
  }
  function calculate(){
    const subtotal=lines.reduce((s,l)=>s+Number(l.qty)*Number(l.unitPrice),0);
    const delivery=Number(document.getElementById("delivery").value||0);
    const vat=(subtotal+delivery)*(Number(order.vatRate||15)/100);
    return{subtotal,delivery,vat,grandTotal:subtotal+delivery+vat};
  }
  function renderBasket(){
    document.getElementById("basketCount").textContent=`${lines.reduce((s,l)=>s+Number(l.qty),0)} items`;
    basket.innerHTML=lines.length?lines.map((l,i)=>`
      <div class="basket-line">
        <div><strong>${esc(l.productCode)} · ${esc(l.productName)}</strong><div class="muted"><span class="swatch" style="display:inline-block;vertical-align:middle;--swatch:${esc(l.colour.hex)}"></span> ${esc(l.colour.name)}</div></div>
        <div class="basket-controls"><button data-a="minus" data-i="${i}">−</button><strong>${l.qty}</strong><button data-a="plus" data-i="${i}">+</button><button class="danger" data-a="remove" data-i="${i}">×</button></div>
        <strong class="basket-price">${money(l.qty*l.unitPrice)}</strong>
      </div>`).join(""):`<div class="empty">No products added yet.</div>`;
    basket.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      const i=Number(b.dataset.i),a=b.dataset.a;
      if(a==="plus")lines[i].qty++;
      if(a==="minus")lines[i].qty=Math.max(1,lines[i].qty-1);
      if(a==="remove")lines.splice(i,1);
      renderBasket();
    });
    const t=calculate();
    document.getElementById("totals").innerHTML=`
      <div class="total-row"><span>Subtotal ex VAT</span><strong>${money(t.subtotal)}</strong></div>
      <div class="total-row"><span>Delivery</span><strong>${money(t.delivery)}</strong></div>
      <div class="total-row"><span>VAT (${order.vatRate}%)</span><strong>${money(t.vat)}</strong></div>
      <div class="total-row grand"><span>Total</span><span>${money(t.grandTotal)}</span></div>`;
  }
  document.getElementById("catalogueSearch").oninput=e=>renderCatalogue(e.target.value);
  document.getElementById("delivery").oninput=renderBasket;
  async function saveOrder(status){
    const customerId=document.getElementById("orderCustomer").value;
    if(!customerId){alert("Select a customer.");return}
    if(!lines.length){alert("Add at least one product.");return}
    const customer=customers.find(c=>c.id===customerId),t=calculate();
    const saved={...order,status,customerId,customerName:customer.name,customerSnapshot:customer,lines,delivery:t.delivery,subtotal:t.subtotal,vat:t.vat,grandTotal:t.grandTotal,notes:document.getElementById("orderNotes").value,updatedAt:new Date().toISOString()};
    await putOne("orders",saved);
    notify(status==="Confirmed"?"Order confirmed":"Draft saved");
    viewOrder(saved.id);
  }
  document.getElementById("saveDraft").onclick=()=>saveOrder("Draft");
  document.getElementById("saveConfirm").onclick=()=>saveOrder("Confirmed");
  renderCatalogue();renderBasket();
}

async function viewOrder(id){
  const o=await getOne("orders",id);
  const statuses=["Draft","Sent","Confirmed","In Production","Ready","Delivered","Collected","Completed","Cancelled"];
  pageTitle.textContent="Order details";backBtn.classList.remove("hidden");navState("orders");
  main.innerHTML=`
    <div class="card order-doc" id="printArea">
      <div class="order-doc-head">
        <div><div class="step-label">Vorster Unlimited Trading</div><h2>${esc(o.orderNumber)}</h2><span class="badge ${statusClass(o.status)}">${esc(o.status)}</span></div>
        <img src="vorster-logo.jpg" alt="">
      </div>
      <p><strong>Customer:</strong> ${esc(o.customerName)}</p>
      <p><strong>Date:</strong> ${dateText(o.createdAt)}</p>
      <div class="list">${o.lines.map(l=>`
        <div class="list-item"><div><strong>${esc(l.productCode)} · ${esc(l.productName)}</strong><p class="muted">${esc(l.colour.name)} · Qty ${l.qty}</p></div><strong>${money(l.qty*l.unitPrice)}</strong></div>`).join("")}</div>
      <div class="total-box" style="margin-top:12px">
        <div class="total-row"><span>Subtotal ex VAT</span><strong>${money(o.subtotal)}</strong></div>
        <div class="total-row"><span>Delivery</span><strong>${money(o.delivery)}</strong></div>
        <div class="total-row"><span>VAT</span><strong>${money(o.vat)}</strong></div>
        <div class="total-row grand"><span>Total</span><span>${money(o.grandTotal)}</span></div>
      </div>
      ${o.notes?`<p><strong>Notes:</strong> ${esc(o.notes)}</p>`:""}
    </div>
    <div class="card no-print" style="margin-top:12px">
      <label>Status<select id="statusSelect">${statuses.map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select></label>
      <div class="actions" style="margin-top:10px">
        ${o.status==="Draft"?`<button class="secondary" onclick="startOrder('${o.id}')">Edit</button>`:""}
        <button class="primary" onclick="shareOrder('${o.id}')">Share</button>
        <button class="ghost" onclick="window.print()">Print / Save PDF</button>
        <button class="danger" onclick="removeOrder('${o.id}')">Delete</button>
      </div>
    </div>`;
  document.getElementById("statusSelect").onchange=async e=>{
    const next=e.target.value;
    if(confirm(`Change status from ${o.status} to ${next}?`)){
      o.status=next;o.updatedAt=new Date().toISOString();await putOne("orders",o);notify("Status updated");viewOrder(id);
    }else e.target.value=o.status;
  };
}
async function shareOrder(id){
  const o=await getOne("orders",id);
  const items=o.lines.map(l=>`${l.productCode} ${l.productName} | ${l.colour.name} | Qty ${l.qty} | ${money(l.qty*l.unitPrice)}`).join("\n");
  const text=`Vorster Unlimited Trading\nOrder ${o.orderNumber}\nCustomer: ${o.customerName}\nStatus: ${o.status}\n\n${items}\n\nTotal: ${money(o.grandTotal)}`;
  try{
    if(navigator.share)await navigator.share({title:`Order ${o.orderNumber}`,text});
    else{await navigator.clipboard.writeText(text);notify("Order copied")}
  }catch(err){if(err.name!=="AbortError")alert("Sharing failed. Use Print / Save PDF.")}
}
async function removeOrder(id){
  if(confirm("Delete this order permanently?")){await deleteOne("orders",id);notify("Order deleted");navigate("orders")}
}

async function settingsPage(){
  main.innerHTML=`
    <div class="card">
      <h2>Backup and restore</h2>
      <p class="muted">Data is currently stored on this phone. Export a backup regularly.</p>
      <div class="actions">
        <button class="primary" onclick="exportBackup()">Export backup</button>
        <label class="secondary" style="display:inline-flex;align-items:center;cursor:pointer">Restore backup<input id="restoreInput" type="file" accept=".json" hidden></label>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <h2>Application</h2>
      <p><strong>Version:</strong> 1.0 Alpha 2</p>
      <p><strong>Currency:</strong> South African Rand</p>
      <p><strong>VAT:</strong> 15%</p>
      <p class="muted">Phone-first local version. Cloud sync will be added later.</p>
    </div>`;
  document.getElementById("restoreInput").onchange=restoreBackup;
}
async function exportBackup(){
  const data={version:1,exportedAt:new Date().toISOString()};
  for(const s of STORES)data[s]=await getAll(s);
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`vorster-trading-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);notify("Backup exported");
}
async function restoreBackup(e){
  const file=e.target.files[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!confirm("Replace current data with this backup?"))return;
    for(const s of STORES){await clearStore(s);for(const item of(data[s]||[]))await putOne(s,item)}
    notify("Backup restored");navigate("dashboard");
  }catch{alert("The selected backup could not be read.")}
}

navigate("dashboard");
