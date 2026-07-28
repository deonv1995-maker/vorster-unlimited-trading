
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
const customerOrdersFor=(orders,customerId)=>orders.filter(o=>o.customerId===customerId && o.status!=="Cancelled");
const mostFrequent=(values)=>{
  const counts={};
  values.filter(Boolean).forEach(v=>counts[v]=(counts[v]||0)+1);
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
};
const daysBetween=(a,b)=>Math.round(Math.abs(new Date(b)-new Date(a))/86400000);
const groupLinesByColour=lines=>{
  const groups={};
  for(const line of (lines||[])){
    const colour=line?.colour?.name||"Standard";
    if(!groups[colour]) groups[colour]=[];
    groups[colour].push(line);
  }
  return groups;
};
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
backBtn.onclick=()=>{
  if(pageTitle.textContent==="Customer details") navigate("customers");
  else if(["Quote details","New quote","Edit quote"].includes(pageTitle.textContent)) navigate("quotes");
  else if(["Sales Visits","Visit details","Record visit","Edit visit"].includes(pageTitle.textContent)) navigate("visits");
  else if(pageTitle.textContent==="Production job") navigate("production");
  else if(pageTitle.textContent==="Delivery details") navigate("deliveries");
  else navigate("orders");
};

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
  const titles={dashboard:"Dashboard",products:"Products",customers:"Customers",visits:"Sales Visits",quotes:"Quotes",orders:"Orders",production:"Production",deliveries:"Deliveries",settings:"Settings"};
  pageTitle.textContent=titles[name]||"Vorster Unlimited Trading";
  if(name==="dashboard")await dashboard();
  if(name==="products")await productsPage();
  if(name==="customers")await customersPage();
  if(name==="visits")await visitsPage();
  if(name==="quotes")await quotesPage();
  if(name==="orders")await ordersPage();
  if(name==="production")await productionPage();
  if(name==="deliveries")await deliveriesPage();
  if(name==="settings")await settingsPage();
}

async function dashboard(){
  const [products,customers,visits,quotes,orders,productionJobs,deliveries]=await Promise.all([
    getAll("products"),getAll("customers"),getAll("visits"),getAll("quotes"),getAll("orders"),getAll("productionJobs"),getAll("deliveries")
  ]);
  const activeProducts=products.filter(p=>p.isActive!==false);
  const activeCustomers=customers.filter(c=>c.isActive!==false);
  const drafts=orders.filter(o=>o.status==="Draft").length;
  const upcomingVisits=visits.filter(v=>v.nextVisitDate&&new Date(v.nextVisitDate)>=new Date(new Date().toDateString())).length;
  const openQuotes=quotes.filter(q=>["Draft","Sent","Accepted"].includes(q.status)).length;
  const confirmed=orders.filter(o=>o.status==="Confirmed").length;
  const production=orders.filter(o=>o.status==="In Production").length;
  const ready=orders.filter(o=>o.status==="Ready").length;
  const openProduction=productionJobs.filter(j=>!["Completed","Cancelled"].includes(j.status)).length;
  const scheduledDeliveries=deliveries.filter(d=>!["Delivered","Cancelled"].includes(d.status)).length;
  const value=orders.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+Number(o.grandTotal||0),0);
  const recent=[...orders].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).slice(0,4);

  main.innerHTML=`
    <section class="hero-card">
      <div>
        <div class="step-label">Business overview</div>
        <h2>Welcome back</h2>
        <p>Manage products, customers and orders from your phone.</p>
      </div>
      <button class="primary hero-order-btn" onclick="startOrder()">+ New order</button>
    </section>

    <div class="grid two dashboard-stats">
      <div class="card stat"><span class="muted">Active products</span><strong>${activeProducts.length}</strong></div>
      <div class="card stat"><span class="muted">Active customers</span><strong>${activeCustomers.length}</strong></div>
      <div class="card stat"><span class="muted">Upcoming visits</span><strong>${upcomingVisits}</strong></div>
      <div class="card stat"><span class="muted">Open quotes</span><strong>${openQuotes}</strong></div>
      <div class="card stat"><span class="muted">Draft orders</span><strong>${drafts}</strong></div>
      <div class="card stat"><span class="muted">Confirmed</span><strong>${confirmed}</strong></div>
      <div class="card stat"><span class="muted">In production</span><strong>${production}</strong></div>
      <div class="card stat"><span class="muted">Ready</span><strong>${ready}</strong></div>
    </div>

    <div class="card value-card">
      <span class="muted">Recorded order value</span>
      <h2>${money(value)}</h2>
    </div>

    <div class="section-head"><h2>Quick access</h2></div>
    <div class="quick-grid premium">
      <button class="quick-card" onclick="navigate('products')"><span>▦</span><strong>Products</strong><small>Catalogue and colours</small></button>
      <button class="quick-card" onclick="navigate('customers')"><span>◉</span><strong>Customers</strong><small>Contacts and notes</small></button>
      <button class="quick-card" onclick="navigate('visits')"><span>⌖</span><strong>Sales visits</strong><small>${upcomingVisits} upcoming</small></button>
      <button class="quick-card" onclick="navigate('quotes')"><span>▧</span><strong>Quotes</strong><small>${openQuotes} open quotes</small></button>
      <button class="quick-card" onclick="navigate('orders')"><span>▤</span><strong>Orders</strong><small>Drafts and statuses</small></button>
      <button class="quick-card" onclick="navigate('production')"><span>🏭</span><strong>Production</strong><small>${openProduction} open jobs</small></button>
      <button class="quick-card" onclick="navigate('deliveries')"><span>🚚</span><strong>Deliveries</strong><small>${scheduledDeliveries} scheduled</small></button>
      <button class="quick-card" onclick="navigate('settings')"><span>⚙</span><strong>Settings</strong><small>Backups and colours</small></button>
    </div>

    <div class="section-head"><h2>Customers to revisit</h2></div>
    <div class="list">${(()=>{
      const due=activeCustomers.map(c=>{
        const customerOrders=orders.filter(o=>o.customerId===c.id&&o.status!=="Cancelled").sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        const last=customerOrders[0];
        const days=last?daysBetween(last.createdAt,new Date()):9999;
        return{customer:c,last,days};
      }).sort((a,b)=>b.days-a.days).slice(0,4);
      return due.length?due.map(x=>`
        <button class="list-item" style="width:100%;text-align:left" onclick="viewCustomer('${x.customer.id}')">
          <div><h3>${esc(x.customer.name)}</h3><p class="muted">${x.last?`${x.days} days since last order`:"No recorded orders"}</p></div>
          <span class="badge">${x.last?dateText(x.last.createdAt):"New"}</span>
        </button>`).join(""):`<div class="empty">No active customers yet.</div>`;
    })()}</div>

    <div class="section-head"><h2>Recent orders</h2></div>
    <div class="list">${recent.length?recent.map(o=>`
      <button class="list-item" style="width:100%;text-align:left" onclick="viewOrder('${o.id}')">
        <div><h3>${esc(o.orderNumber)} · ${esc(o.customerName)}</h3><p class="muted">${dateText(o.createdAt)}</p><span class="badge ${statusClass(o.status)}">${esc(o.status)}</span></div>
        <strong>${money(o.grandTotal)}</strong>
      </button>`).join(""):`<div class="empty">No recent orders yet.</div>`}</div>

    <button class="new-order-fab" onclick="startOrder()">+ New order</button>`;
}

async function productsPage(filter="",view="active"){
  const items=(await getAll("products")).sort((a,b)=>a.code.localeCompare(b.code));
  const filteredByState=items.filter(p=>view==="all" ? true : view==="archived" ? p.isActive===false : p.isActive!==false);
  const shown=filteredByState.filter(p=>(p.code+" "+p.name+" "+(p.category||"")).toLowerCase().includes(filter.toLowerCase()));
  main.innerHTML=`
    <div class="toolbar-stack">
      <input id="productSearch" class="search" placeholder="Search products" value="${esc(filter)}">
      <div class="filter-chips">
        <button class="filter-chip ${view==="active"?"selected":""}" data-view="active">Active</button>
        <button class="filter-chip ${view==="archived"?"selected":""}" data-view="archived">Archived</button>
        <button class="filter-chip ${view==="all"?"selected":""}" data-view="all">All</button>
      </div>
    </div>
    <div class="product-management-grid">${shown.length?shown.map(p=>`
      <article class="management-product-card ${p.isActive===false?"archived":""}">
        ${p.image?`<img src="${p.image}" alt="${esc(p.name)}">`:`<div class="catalogue-placeholder">▦</div>`}
        <div class="management-card-body">
          <div class="management-card-head">
            <div><strong>${esc(p.code)}</strong><h3>${esc(p.name)}</h3></div>
            ${p.isActive===false?`<span class="badge">Archived</span>`:""}
          </div>
          <p class="muted">${esc(p.category||"Uncategorised")}</p>
          <p class="product-price">${money(p.price)} <small>ex VAT</small></p>
          <div class="colour-tiles compact">${(p.colours||[]).map(c=>`<span class="colour-tile"><span class="swatch" style="--swatch:${esc(c.hex||"#ccc")}"></span>${esc(c.name)}</span>`).join("")}</div>
          <div class="actions">
            <button class="ghost" onclick="showProductForm('${p.id}')">Edit</button>
            <button class="ghost" onclick="duplicateProduct('${p.id}')">Duplicate</button>
            ${p.isActive===false
              ? `<button class="secondary" onclick="setProductActive('${p.id}',true)">Restore</button>`
              : `<button class="secondary" onclick="setProductActive('${p.id}',false)">Archive</button>`}
            <button class="danger" onclick="removeProduct('${p.id}')">Delete</button>
          </div>
        </div>
      </article>`).join(""):`<div class="empty">No products found.</div>`}</div>
    <button class="fab" onclick="showProductForm()">+</button>`;
  document.getElementById("productSearch").oninput=e=>productsPage(e.target.value,view);
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>productsPage(filter,b.dataset.view));
}
async function duplicateProduct(id){
  const p=await getOne("products",id);
  const copy={...structuredClone(p),id:uid("prd"),code:`${p.code}-COPY`,name:`${p.name} Copy`,isActive:true,updatedAt:new Date().toISOString()};
  await putOne("products",copy);
  notify("Product duplicated");
  productsPage();
}
async function setProductActive(id,isActive){
  const p=await getOne("products",id);
  p.isActive=isActive;
  p.updatedAt=new Date().toISOString();
  await putOne("products",p);
  notify(isActive?"Product restored":"Product archived");
  productsPage();
}

async function showProductForm(id=""){
  const p=id?await getOne("products",id):{id:uid("prd"),code:"",name:"",description:"",category:"",price:"",colours:[],image:""};
  let colours=[...(p.colours||[])];
  const appSettings=(await getAll("settings"))[0]||{companyColours:[]};
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
        <div id="companyColourChoices" class="colour-tiles"></div>
        <div class="colour-entry">
          <input id="colourName" placeholder="Colour name">
          <input id="colourHex" type="color" value="#777777" style="width:58px;padding:4px">
          <button id="addColour" class="secondary" type="button">Add</button>
        </div>
        <div id="savedColours" class="colour-tiles"></div>
      </div>
      <button class="primary" type="submit">Save product</button>
    </form>`);
  const renderCompanyChoices=()=>{
    const box=document.getElementById("companyColourChoices");
    box.innerHTML=(appSettings.companyColours||[]).map(c=>`
      <button type="button" class="colour-tile company-choice" data-name="${esc(c.name)}" data-hex="${esc(c.hex)}">
        <span class="swatch" style="--swatch:${esc(c.hex)}"></span>${esc(c.name)}
      </button>`).join("");
    box.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      if(!colours.some(c=>c.name.toLowerCase()===b.dataset.name.toLowerCase())){
        colours.push({name:b.dataset.name,hex:b.dataset.hex});
        renderColours();
      }
    });
  };
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
  renderCompanyChoices();
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
    await putOne("products",{...p,...d,price:Number(d.price),colours,image:productImage,isActive:p.isActive!==false,updatedAt:new Date().toISOString()});
    closeDialog();notify("Product saved");navigate("products");
  };
}
async function removeProduct(id){
  if(confirm("Delete this product? Existing orders will keep their saved product information.")){
    await deleteOne("products",id);notify("Product deleted");productsPage();
  }
}

async function customersPage(filter="",view="active"){
  const items=(await getAll("customers")).sort((a,b)=>a.name.localeCompare(b.name));
  const filteredByState=items.filter(c=>view==="all" ? true : view==="archived" ? c.isActive===false : c.isActive!==false);
  const shown=filteredByState.filter(c=>(c.name+" "+(c.contactPerson||"")+" "+(c.phone||"")+" "+(c.whatsapp||"")).toLowerCase().includes(filter.toLowerCase()));
  main.innerHTML=`
    <div class="toolbar-stack">
      <input id="customerSearch" class="search" placeholder="Search customers" value="${esc(filter)}">
      <div class="filter-chips">
        <button class="filter-chip ${view==="active"?"selected":""}" data-view="active">Active</button>
        <button class="filter-chip ${view==="archived"?"selected":""}" data-view="archived">Archived</button>
        <button class="filter-chip ${view==="all"?"selected":""}" data-view="all">All</button>
      </div>
    </div>
    <div class="customer-card-grid">${shown.length?shown.map(c=>`
      <article class="customer-card ${c.isActive===false?"archived":""}">
        <div class="customer-avatar">${esc((c.name||"?").charAt(0).toUpperCase())}</div>
        <div class="customer-card-content">
          <div class="management-card-head"><h3>${esc(c.name)}</h3>${c.isActive===false?`<span class="badge">Archived</span>`:""}</div>
          <p><strong>${esc(c.contactPerson||"No contact person")}</strong></p>
          <p class="muted">${esc(c.phone||"No telephone")}</p>
          <p class="muted">WhatsApp: ${esc(c.whatsapp||"Not supplied")}</p>
          <span class="badge">${esc(c.preference||"Delivery")}</span>
          ${c.notes?`<p class="customer-note">${esc(c.notes)}</p>`:""}
          <div class="actions">
            <button class="primary" onclick="viewCustomer('${c.id}')">View</button>
            <button class="secondary" onclick="startOrderForCustomer('${c.id}')">New order</button>
            <button class="ghost" onclick="startQuoteForCustomer('${c.id}')">New quote</button>
            <button class="ghost" onclick="startVisitForCustomer('${c.id}')">Record visit</button>
            <button class="ghost" onclick="showCustomerForm('${c.id}')">Edit</button>
            ${c.isActive===false
              ? `<button class="secondary" onclick="setCustomerActive('${c.id}',true)">Restore</button>`
              : `<button class="secondary" onclick="setCustomerActive('${c.id}',false)">Archive</button>`}
            <button class="danger" onclick="removeCustomer('${c.id}')">Delete</button>
          </div>
        </div>
      </article>`).join(""):`<div class="empty">No customers found.</div>`}</div>
    <button class="fab" onclick="showCustomerForm()">+</button>`;
  document.getElementById("customerSearch").oninput=e=>customersPage(e.target.value,view);
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>customersPage(filter,b.dataset.view));
}
async function startOrderForCustomer(customerId){
  await startOrder();
  const select=document.getElementById("orderCustomer");
  if(select){
    select.value=customerId;
    select.dispatchEvent(new Event("change"));
  }
}
async function setCustomerActive(id,isActive){
  const c=await getOne("customers",id);
  c.isActive=isActive;
  c.updatedAt=new Date().toISOString();
  await putOne("customers",c);
  notify(isActive?"Customer restored":"Customer archived");
  customersPage();
}

async function viewCustomer(id){
  const [c,orders,quotes,visits,activities]=await Promise.all([
    getOne("customers",id),
    getAll("orders"),
    getAll("quotes"),
    getAll("visits"),
    getAll("activities")
  ]);
  if(!c){alert("Customer not found.");return navigate("customers");}
  const customerOrders=customerOrdersFor(orders,id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const customerActivities=activities.filter(a=>a.customerId===id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const customerQuotes=quotes.filter(q=>q.customerId===id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const customerVisits=visits.filter(v=>v.customerId===id).sort((a,b)=>new Date(b.visitDate||b.createdAt)-new Date(a.visitDate||a.createdAt));
  const lastVisit=customerVisits[0];
  const outstandingQuotes=customerQuotes.filter(q=>["Draft","Sent","Accepted"].includes(q.status));
  const totalValue=customerOrders.reduce((s,o)=>s+Number(o.grandTotal||0),0);
  const averageValue=customerOrders.length?totalValue/customerOrders.length:0;
  const favouriteProduct=mostFrequent(customerOrders.flatMap(o=>o.lines||[]).map(l=>l.productName));
  const favouriteColour=mostFrequent(customerOrders.flatMap(o=>o.lines||[]).map(l=>l.colour?.name));
  const lastOrder=customerOrders[0];
  const intervals=[];
  for(let i=0;i<customerOrders.length-1;i++) intervals.push(daysBetween(customerOrders[i].createdAt,customerOrders[i+1].createdAt));
  const averageInterval=intervals.length?Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length):null;
  const nextEstimate=lastOrder&&averageInterval?new Date(new Date(lastOrder.createdAt).getTime()+averageInterval*86400000):null;

  pageTitle.textContent="Customer details";
  backBtn.classList.remove("hidden");
  navState("customers");
  main.innerHTML=`
    <section class="customer-profile card">
      <div class="customer-profile-head">
        <div class="customer-avatar large">${esc((c.name||"?").charAt(0).toUpperCase())}</div>
        <div>
          <div class="step-label">Customer account</div>
          <h2>${esc(c.name)}</h2>
          <p>${esc(c.contactPerson||"No contact person")}</p>
          ${c.isActive===false?`<span class="badge">Archived</span>`:`<span class="badge confirmed">Active</span>`}
        </div>
      </div>
      <div class="contact-grid">
        <div><span class="muted">Telephone</span><strong>${esc(c.phone||"—")}</strong></div>
        <div><span class="muted">WhatsApp</span><strong>${esc(c.whatsapp||"—")}</strong></div>
        <div><span class="muted">Email</span><strong>${esc(c.email||"—")}</strong></div>
        <div><span class="muted">Preference</span><strong>${esc(c.preference||"Delivery")}</strong></div>
      </div>
      <div class="actions">
        <button class="primary" onclick="startOrderForCustomer('${c.id}')">New order</button>
        <button class="secondary" onclick="startQuoteForCustomer('${c.id}')">New quote</button>
        <button class="secondary" onclick="startVisitForCustomer('${c.id}')">Record visit</button>
        <button class="secondary" onclick="showCustomerForm('${c.id}')">Edit customer</button>
        ${c.whatsapp?`<button class="ghost" onclick="openWhatsApp('${esc(c.whatsapp)}')">WhatsApp</button>`:""}
      </div>
    </section>

    <div class="grid two customer-metrics">
      <div class="card stat"><span class="muted">Orders</span><strong>${customerOrders.length}</strong></div>
      <div class="card stat"><span class="muted">Average order</span><strong>${money(averageValue)}</strong></div>
      <div class="card stat"><span class="muted">Open quotes</span><strong>${outstandingQuotes.length}</strong></div>
      <div class="card stat"><span class="muted">Last visit</span><strong>${lastVisit?dateText(lastVisit.visitDate||lastVisit.createdAt):"Never"}</strong></div>
      <div class="card stat"><span class="muted">Favourite product</span><strong class="small-stat">${esc(favouriteProduct)}</strong></div>
      <div class="card stat"><span class="muted">Favourite colour</span><strong class="small-stat">${esc(favouriteColour)}</strong></div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3>Ordering pattern</h3>
      <div class="pattern-grid">
        <div><span class="muted">Last order</span><strong>${lastOrder?dateText(lastOrder.createdAt):"No orders yet"}</strong></div>
        <div><span class="muted">Average interval</span><strong>${averageInterval?`${averageInterval} days`:"Not enough history"}</strong></div>
        <div><span class="muted">Estimated next order</span><strong>${nextEstimate?dateText(nextEstimate):"Not available"}</strong></div>
        <div><span class="muted">Lifetime value</span><strong>${money(totalValue)}</strong></div>
      </div>
    </div>

    <div class="section-head"><h2>Activity</h2><button class="secondary" onclick="showActivityForm('${c.id}')">Add activity</button></div>
    <div class="list">${customerActivities.length?customerActivities.slice(0,10).map(a=>`
      <div class="list-item activity-item">
        <div><h3>${esc(a.type)}</h3><p>${esc(a.notes||"No notes")}</p><p class="muted">${dateText(a.createdAt)}</p></div>
      </div>`).join(""):`<div class="empty">No customer activities recorded yet.</div>`}</div>

    <div class="section-head"><h2>Order history</h2></div>
    <div class="list">${customerOrders.length?customerOrders.map(o=>`
      <button class="list-item" style="width:100%;text-align:left" onclick="viewOrder('${o.id}')">
        <div><h3>${esc(o.orderNumber)}</h3><p class="muted">${dateText(o.createdAt)}</p><span class="badge ${statusClass(o.status)}">${esc(o.status)}</span></div>
        <strong>${money(o.grandTotal)}</strong>
      </button>`).join(""):`<div class="empty">No orders for this customer yet.</div>`}</div>`;
}

function openWhatsApp(number){
  const cleaned=String(number||"").replace(/\D/g,"");
  if(!cleaned)return;
  const international=cleaned.startsWith("0")?`27${cleaned.slice(1)}`:cleaned;
  window.open(`https://wa.me/${international}`,"_blank");
}

async function showActivityForm(customerId){
  openDialog(`
    <div class="dialog-head"><h2>Add customer activity</h2><button class="close-btn" onclick="closeDialog()">×</button></div>
    <form id="activityForm">
      <label>Activity type<select name="type">
        <option>Visit</option>
        <option>Phone Call</option>
        <option>WhatsApp</option>
        <option>Quote Sent</option>
        <option>Order</option>
        <option>No Order</option>
        <option>Unavailable</option>
        <option>Follow-up</option>
        <option>Display Checked</option>
        <option>Samples Delivered</option>
      </select></label>
      <label>Notes<textarea name="notes" placeholder="What happened?"></textarea></label>
      <button class="primary" type="submit">Save activity</button>
    </form>`);
  document.getElementById("activityForm").onsubmit=async e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.target));
    await putOne("activities",{id:uid("act"),customerId,...d,createdAt:new Date().toISOString()});
    closeDialog();
    notify("Activity saved");
    viewCustomer(customerId);
  };
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
    await putOne("customers",{...c,...d,isActive:c.isActive!==false,updatedAt:new Date().toISOString()});
    closeDialog();notify("Customer saved");navigate("customers");
  };
}
async function removeCustomer(id){
  if(confirm("Delete this customer? Existing orders will keep their saved customer details.")){
    await deleteOne("customers",id);notify("Customer deleted");customersPage();
  }
}


async function nextQuoteNumber(){
  const quotes=await getAll("quotes");
  const year=new Date().getFullYear();
  const prefix=`QUO-${year}-`;
  const highest=quotes
    .map(q=>q.quoteNumber||"")
    .filter(n=>n.startsWith(prefix))
    .map(n=>Number(n.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((m,n)=>Math.max(m,n),0);
  return `${prefix}${String(highest+1).padStart(4,"0")}`;
}


async function visitsPage(filter="",outcome="All"){
  const [visits,customers]=await Promise.all([getAll("visits"),getAll("customers")]);
  const sorted=visits.sort((a,b)=>new Date(b.visitDate||b.createdAt)-new Date(a.visitDate||a.createdAt));
  const shown=sorted.filter(v=>{
    const text=`${v.customerName} ${v.personSpokenTo||""} ${v.outcome||""} ${v.notes||""}`.toLowerCase();
    return text.includes(filter.toLowerCase())&&(outcome==="All"||v.outcome===outcome);
  });
  const outcomes=["All","Order placed","Quote requested","Follow-up required","No order","Customer unavailable","Display work","Samples left"];
  main.innerHTML=`
    <div class="section-head"><div><h2>Sales visits</h2><p class="muted">${visits.length} recorded visits</p></div><button class="primary" onclick="startVisit()">Record visit</button></div>
    <input id="visitSearch" class="search" placeholder="Search customer, outcome or notes" value="${esc(filter)}">
    <div id="visitFilters" class="filter-chips" style="margin-top:9px">${outcomes.map(o=>`<button class="filter-chip ${o===outcome?"selected":""}" data-outcome="${esc(o)}">${esc(o)}</button>`).join("")}</div>
    <div class="list" style="margin-top:10px">${shown.length?shown.map(v=>`
      <button class="list-item visit-list-item" style="width:100%;text-align:left" onclick="viewVisit('${v.id}')">
        <div><h3>${esc(v.customerName)}</h3><p class="muted">${dateText(v.visitDate||v.createdAt)}${v.personSpokenTo?` · ${esc(v.personSpokenTo)}`:""}</p><span class="badge">${esc(v.outcome||"Visit")}</span></div>
        <div style="text-align:right">${v.nextVisitDate?`<strong>${dateText(v.nextVisitDate)}</strong><small class="muted" style="display:block">Next visit</small>`:""}</div>
      </button>`).join(""):`<div class="empty">No visits found.</div>`}</div>`;
  document.getElementById("visitSearch").oninput=e=>visitsPage(e.target.value,outcome);
  document.querySelectorAll("#visitFilters button").forEach(b=>b.onclick=()=>visitsPage(filter,b.dataset.outcome));
}

async function startVisitForCustomer(customerId){ await startVisit(customerId); }

async function startVisit(customerId="",existingId=""){
  const [customers,existing]=await Promise.all([getAll("customers"),existingId?getOne("visits",existingId):Promise.resolve(null)]);
  const activeCustomers=customers.filter(c=>c.isActive!==false);
  if(!activeCustomers.length){alert("Add a customer first.");return navigate("customers")}
  const visit=existing||{id:uid("vis"),customerId:customerId||"",visitDate:new Date().toISOString().slice(0,16),personSpokenTo:"",outcome:"Follow-up required",productsDiscussed:"",samplesLeft:"",displayWork:"",notes:"",nextVisitDate:"",createdAt:new Date().toISOString()};
  pageTitle.textContent=existing?"Edit visit":"Record visit";backBtn.classList.remove("hidden");navState("visits");
  main.innerHTML=`<div class="card visit-form">
    <div class="section-head"><div><h2>${existing?"Edit sales visit":"Record sales visit"}</h2><p class="muted">Capture the result while the visit is still fresh.</p></div></div>
    <label>Customer<select id="visitCustomer"><option value="">Choose customer</option>${activeCustomers.map(c=>`<option value="${c.id}" ${visit.customerId===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
    <label>Visit date and time<input id="visitDate" type="datetime-local" value="${esc((visit.visitDate||"").slice(0,16))}"></label>
    <label>Person spoken to<input id="personSpokenTo" value="${esc(visit.personSpokenTo||"")}" placeholder="Buyer, owner or staff member"></label>
    <label>Visit outcome<select id="visitOutcome">${["Order placed","Quote requested","Follow-up required","No order","Customer unavailable","Display work","Samples left"].map(o=>`<option ${visit.outcome===o?"selected":""}>${o}</option>`).join("")}</select></label>
    <label>Products discussed<textarea id="productsDiscussed" placeholder="Products, ranges, colours or prices discussed">${esc(visit.productsDiscussed||"")}</textarea></label>
    <label>Samples left<textarea id="samplesLeft" placeholder="Sample name, quantity and colour">${esc(visit.samplesLeft||"")}</textarea></label>
    <label>Display work<textarea id="displayWork" placeholder="Display cleaned, rearranged, photographed or repaired">${esc(visit.displayWork||"")}</textarea></label>
    <label>Visit notes<textarea id="visitNotes" placeholder="Important discussion points and customer feedback">${esc(visit.notes||"")}</textarea></label>
    <label>Next visit date<input id="nextVisitDate" type="date" value="${esc(visit.nextVisitDate||"")}"></label>
    <div class="save-actions"><button class="secondary" onclick="navigate('visits')">Cancel</button><button id="saveVisit" class="primary">Save visit</button></div>
  </div>`;
  document.getElementById("saveVisit").onclick=async()=>{
    const selectedId=document.getElementById("visitCustomer").value;if(!selectedId){alert("Select a customer.");return}
    const customer=activeCustomers.find(c=>c.id===selectedId);
    const saved={...visit,customerId:selectedId,customerName:customer.name,visitDate:document.getElementById("visitDate").value||new Date().toISOString(),personSpokenTo:document.getElementById("personSpokenTo").value.trim(),outcome:document.getElementById("visitOutcome").value,productsDiscussed:document.getElementById("productsDiscussed").value.trim(),samplesLeft:document.getElementById("samplesLeft").value.trim(),displayWork:document.getElementById("displayWork").value.trim(),notes:document.getElementById("visitNotes").value.trim(),nextVisitDate:document.getElementById("nextVisitDate").value,updatedAt:new Date().toISOString()};
    await putOne("visits",saved);await putOne("activities",{id:uid("act"),customerId:selectedId,type:"Sales Visit",notes:`${saved.outcome}${saved.notes?` — ${saved.notes}`:""}`,createdAt:new Date().toISOString()});notify("Sales visit saved");viewVisit(saved.id);
  };
}

async function viewVisit(id){
  const [visit,orders,quotes]=await Promise.all([getOne("visits",id),getAll("orders"),getAll("quotes")]);if(!visit)return navigate("visits");
  const customerOrders=orders.filter(o=>o.customerId===visit.customerId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const customerQuotes=quotes.filter(q=>q.customerId===visit.customerId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const lastOrder=customerOrders[0],openQuotes=customerQuotes.filter(q=>["Draft","Sent","Accepted"].includes(q.status));
  pageTitle.textContent="Visit details";backBtn.classList.remove("hidden");navState("visits");
  main.innerHTML=`<div class="card visit-detail">
    <div class="section-head"><div><h2>${esc(visit.customerName)}</h2><p class="muted">${dateText(visit.visitDate||visit.createdAt)}</p></div><span class="badge">${esc(visit.outcome||"Visit")}</span></div>
    <div class="visit-intelligence-grid"><div><span class="muted">Person spoken to</span><strong>${esc(visit.personSpokenTo||"Not recorded")}</strong></div><div><span class="muted">Last order</span><strong>${lastOrder?`${esc(lastOrder.orderNumber)} · ${money(lastOrder.grandTotal)}`:"No orders"}</strong></div><div><span class="muted">Open quotes</span><strong>${openQuotes.length}</strong></div><div><span class="muted">Next visit</span><strong>${visit.nextVisitDate?dateText(visit.nextVisitDate):"Not scheduled"}</strong></div></div>
    ${visit.productsDiscussed?`<section><h3>Products discussed</h3><p>${esc(visit.productsDiscussed)}</p></section>`:""}
    ${visit.samplesLeft?`<section><h3>Samples left</h3><p>${esc(visit.samplesLeft)}</p></section>`:""}
    ${visit.displayWork?`<section><h3>Display work</h3><p>${esc(visit.displayWork)}</p></section>`:""}
    ${visit.notes?`<section><h3>Visit notes</h3><p>${esc(visit.notes)}</p></section>`:""}
    <div class="actions no-print" style="margin-top:12px"><button class="primary" onclick="startOrderForCustomer('${visit.customerId}')">New order</button><button class="secondary" onclick="startQuoteForCustomer('${visit.customerId}')">New quote</button><button class="secondary" onclick="startVisit('${visit.customerId}','${visit.id}')">Edit visit</button><button class="ghost" onclick="viewCustomer('${visit.customerId}')">Open customer</button><button class="danger" onclick="removeVisit('${visit.id}')">Delete</button></div>
  </div>`;
}

async function removeVisit(id){if(confirm("Delete this visit record permanently?")){await deleteOne("visits",id);notify("Visit deleted");navigate("visits");}}

async function quotesPage(filter="",status="All"){
  const quotes=(await getAll("quotes")).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const shown=quotes.filter(q=>{
    const text=`${q.quoteNumber} ${q.customerName} ${q.status}`.toLowerCase();
    return text.includes(filter.toLowerCase())&&(status==="All"||q.status===status);
  });
  const totalOpen=quotes.filter(q=>["Draft","Sent","Accepted"].includes(q.status)).reduce((s,q)=>s+Number(q.grandTotal||0),0);
  main.innerHTML=`
    <div class="section-head"><div><h2>Quotations</h2><p class="muted">${money(totalOpen)} open quote value</p></div><button class="primary" onclick="startQuote()">New quote</button></div>
    <input id="quoteSearch" class="search" placeholder="Search quote or customer" value="${esc(filter)}">
    <div id="quoteFilters" class="filter-chips" style="margin-top:9px">
      ${["All","Draft","Sent","Accepted","Declined","Expired","Converted"].map(s=>`<button class="filter-chip ${s===status?"selected":""}" data-status="${s}">${s}</button>`).join("")}
    </div>
    <div class="list" style="margin-top:10px">${shown.length?shown.map(q=>`
      <button class="list-item quote-list-item" style="width:100%;text-align:left" onclick="viewQuote('${q.id}')">
        <div>
          <h3>${esc(q.quoteNumber)} · ${esc(q.customerName)}</h3>
          <p class="muted">${dateText(q.createdAt)} · Valid until ${q.validUntil?dateText(q.validUntil):"not set"}</p>
          <span class="badge ${statusClass(q.status)}">${esc(q.status)}</span>
        </div>
        <strong>${money(q.grandTotal)}</strong>
      </button>`).join(""):`<div class="empty">No quotations found.</div>`}</div>`;
  document.getElementById("quoteSearch").oninput=e=>quotesPage(e.target.value,status);
  document.querySelectorAll("#quoteFilters button").forEach(b=>b.onclick=()=>quotesPage(filter,b.dataset.status));
}

async function startQuoteForCustomer(customerId){
  await startQuote();
  const select=document.getElementById("quoteCustomer");
  if(select){
    select.value=customerId;
    select.dispatchEvent(new Event("change"));
  }
}

async function startQuote(existingId=""){
  const [allProducts,allCustomers]=await Promise.all([getAll("products"),getAll("customers")]);
  const products=allProducts.filter(p=>p.isActive!==false);
  const customers=allCustomers.filter(c=>c.isActive!==false);
  if(!products.length){alert("Add at least one product first.");return navigate("products")}
  if(!customers.length){alert("Add at least one customer first.");return navigate("customers")}
  const existing=existingId?await getOne("quotes",existingId):null;
  const quote=existing?structuredClone(existing):{
    id:uid("quo"),
    quoteNumber:await nextQuoteNumber(),
    customerId:"",
    status:"Draft",
    lines:[],
    delivery:0,
    discountType:"Percent",
    discountValue:0,
    internalNotes:"",
    customerNotes:"",
    vatRate:15,
    validUntil:new Date(Date.now()+30*86400000).toISOString().slice(0,10),
    createdAt:new Date().toISOString()
  };
  let lines=quote.lines||[];
  let selectedProduct=null,selectedColour=null,selectedQty=1;
  pageTitle.textContent=existing?"Edit quote":"New quote";
  backBtn.classList.remove("hidden");
  navState("quotes");
  main.innerHTML=`
    <div class="order-shell">
      <div class="document-banner">
        <div><div class="step-label">Quotation</div><h2>${esc(quote.quoteNumber)}</h2></div>
        <span class="badge ${statusClass(quote.status)}">${esc(quote.status)}</span>
      </div>
      <div>
        <div class="step-label">Step 1</div>
        <label>Select customer<select id="quoteCustomer"><option value="">Choose customer</option>${customers.map(c=>`<option value="${c.id}" ${quote.customerId===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
        <div id="quoteCustomerSummary" class="customer-summary hidden"></div>
        <label>Valid until<input id="validUntil" type="date" value="${esc(quote.validUntil||"")}"></label>
      </div>
      <div>
        <div class="step-label">Step 2</div>
        <label>Choose products</label>
        <input id="quoteCatalogueSearch" class="search" placeholder="Search by code or product name">
        <div id="quoteCategoryFilters" class="filter-chips"></div>
        <div id="quoteCatalogue" class="product-grid" style="margin-top:10px"></div>
      </div>
      <div id="quotePicker" class="picker-panel hidden"></div>
      <div>
        <div class="step-label">Step 3</div>
        <div class="section-head"><h2>Review quote</h2><span id="quoteBasketCount" class="badge"></span></div>
        <div id="quoteBasket" class="basket"></div>
      </div>
      <div class="grid two">
        <label>Delivery charge<input id="quoteDelivery" type="number" min="0" step="0.01" value="${Number(quote.delivery||0)}"></label>
        <label>Discount type<select id="discountType"><option ${quote.discountType==="Percent"?"selected":""}>Percent</option><option ${quote.discountType==="Amount"?"selected":""}>Amount</option></select></label>
      </div>
      <label>Discount value<input id="discountValue" type="number" min="0" step="0.01" value="${Number(quote.discountValue||0)}"></label>
      <label>Customer notes<textarea id="quoteCustomerNotes" placeholder="Shown to the customer">${esc(quote.customerNotes||"")}</textarea></label>
      <label>Internal notes<textarea id="quoteInternalNotes" placeholder="Only visible inside the app">${esc(quote.internalNotes||"")}</textarea></label>
      <div id="quoteTotals" class="total-box"></div>
      <div class="save-actions"><button id="saveQuoteDraft" class="secondary">Save draft</button><button id="saveQuoteSent" class="primary">Save as sent</button></div>
    </div>`;

  const catalogue=document.getElementById("quoteCatalogue");
  const picker=document.getElementById("quotePicker");
  const basket=document.getElementById("quoteBasket");
  let activeCategory="All";
  const categories=["All",...Array.from(new Set(products.map(p=>p.category).filter(Boolean))).sort()];

  function renderCustomerSummary(){
    const id=document.getElementById("quoteCustomer").value;
    const box=document.getElementById("quoteCustomerSummary");
    const c=customers.find(x=>x.id===id);
    if(!c){box.classList.add("hidden");box.innerHTML="";return;}
    box.classList.remove("hidden");
    box.innerHTML=`<strong>${esc(c.name)}</strong><span>${esc(c.contactPerson||"No contact person")}</span><span>${esc(c.phone||c.whatsapp||"No phone number")}</span><span>${esc(c.email||"No email")}</span>`;
  }
  function renderCategoryFilters(){
    document.getElementById("quoteCategoryFilters").innerHTML=categories.map(c=>`<button type="button" class="filter-chip ${c===activeCategory?"selected":""}" data-category="${esc(c)}">${esc(c)}</button>`).join("");
    document.querySelectorAll("#quoteCategoryFilters .filter-chip").forEach(b=>b.onclick=()=>{
      activeCategory=b.dataset.category;renderCategoryFilters();renderCatalogue(document.getElementById("quoteCatalogueSearch").value);
    });
  }
  function renderCatalogue(filter=""){
    const shown=products.filter(p=>(activeCategory==="All"||p.category===activeCategory)&&(p.code+" "+p.name+" "+(p.category||"")).toLowerCase().includes(filter.toLowerCase()));
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
      <div class="dialog-head"><div><strong>${esc(selectedProduct.code)}</strong><div>${esc(selectedProduct.name)}</div></div><button id="closeQuotePicker" class="close-btn">×</button></div>
      <label>Choose colour</label>
      <div class="colour-tiles">${((selectedProduct.colours||[]).length?selectedProduct.colours:[{name:"Standard",hex:"#bbbbbb"}]).map((c,i)=>`
        <button class="colour-tile ${i===0?"selected":""}" data-name="${esc(c.name)}" data-hex="${esc(c.hex)}"><span class="swatch" style="--swatch:${esc(c.hex)}"></span>${esc(c.name)}</button>`).join("")}</div>
      <div class="qty-row"><button id="quoteMinusQty">−</button><strong id="quoteQtyValue">1</strong><button id="quotePlusQty">+</button></div>
      <button id="addQuoteLine" class="primary">Add to quote</button>`;
    picker.querySelectorAll(".colour-tile").forEach(b=>b.onclick=()=>{
      selectedColour={name:b.dataset.name,hex:b.dataset.hex};
      picker.querySelectorAll(".colour-tile").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");
    });
    document.getElementById("quoteMinusQty").onclick=()=>{selectedQty=Math.max(1,selectedQty-1);document.getElementById("quoteQtyValue").textContent=selectedQty};
    document.getElementById("quotePlusQty").onclick=()=>{selectedQty++;document.getElementById("quoteQtyValue").textContent=selectedQty};
    document.getElementById("closeQuotePicker").onclick=()=>picker.classList.add("hidden");
    document.getElementById("addQuoteLine").onclick=()=>{
      const same=lines.find(l=>l.productId===selectedProduct.id&&l.colour.name===selectedColour.name);
      if(same)same.qty+=selectedQty;
      else lines.push({productId:selectedProduct.id,productCode:selectedProduct.code,productName:selectedProduct.name,colour:selectedColour,qty:selectedQty,unitPrice:Number(selectedProduct.price)});
      picker.classList.add("hidden");renderBasket();notify("Added to quote");
    };
  }
  function calculate(){
    const subtotal=lines.reduce((s,l)=>s+Number(l.qty)*Number(l.unitPrice),0);
    const delivery=Number(document.getElementById("quoteDelivery").value||0);
    const type=document.getElementById("discountType").value;
    const value=Number(document.getElementById("discountValue").value||0);
    const discount=type==="Percent"?subtotal*Math.min(value,100)/100:Math.min(value,subtotal);
    const taxable=Math.max(0,subtotal-discount+delivery);
    const vat=taxable*(Number(quote.vatRate||15)/100);
    return{subtotal,delivery,discount,taxable,vat,grandTotal:taxable+vat};
  }
  function renderBasket(){
    document.getElementById("quoteBasketCount").textContent=`${lines.reduce((s,l)=>s+Number(l.qty),0)} items`;
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
    document.getElementById("quoteTotals").innerHTML=`
      <div class="total-row"><span>Subtotal ex VAT</span><strong>${money(t.subtotal)}</strong></div>
      <div class="total-row"><span>Discount</span><strong>− ${money(t.discount)}</strong></div>
      <div class="total-row"><span>Delivery</span><strong>${money(t.delivery)}</strong></div>
      <div class="total-row"><span>VAT (${quote.vatRate}%)</span><strong>${money(t.vat)}</strong></div>
      <div class="total-row grand"><span>Total</span><span>${money(t.grandTotal)}</span></div>`;
  }
  document.getElementById("quoteCatalogueSearch").oninput=e=>renderCatalogue(e.target.value);
  document.getElementById("quoteCustomer").onchange=renderCustomerSummary;
  ["quoteDelivery","discountValue"].forEach(id=>document.getElementById(id).oninput=renderBasket);
  document.getElementById("discountType").onchange=renderBasket;

  async function saveQuote(status){
    const customerId=document.getElementById("quoteCustomer").value;
    if(!customerId){alert("Select a customer.");return}
    if(!lines.length){alert("Add at least one product.");return}
    const customer=customers.find(c=>c.id===customerId),t=calculate();
    const saved={
      ...quote,status,customerId,customerName:customer.name,customerSnapshot:customer,lines,
      validUntil:document.getElementById("validUntil").value,
      delivery:t.delivery,discountType:document.getElementById("discountType").value,
      discountValue:Number(document.getElementById("discountValue").value||0),
      discount:t.discount,subtotal:t.subtotal,vat:t.vat,grandTotal:t.grandTotal,
      customerNotes:document.getElementById("quoteCustomerNotes").value,
      internalNotes:document.getElementById("quoteInternalNotes").value,
      updatedAt:new Date().toISOString()
    };
    await putOne("quotes",saved);
    notify(status==="Sent"?"Quote saved as sent":"Quote draft saved");
    viewQuote(saved.id);
  }
  document.getElementById("saveQuoteDraft").onclick=()=>saveQuote("Draft");
  document.getElementById("saveQuoteSent").onclick=()=>saveQuote("Sent");
  renderCategoryFilters();renderCatalogue();renderBasket();renderCustomerSummary();
}

async function viewQuote(id){
  const [q,settingsRows]=await Promise.all([getOne("quotes",id),getAll("settings")]);
  if(!q)return navigate("quotes");
  const settings=settingsRows[0]||{};
  const customer=q.customerSnapshot||{};
  const statuses=["Draft","Sent","Accepted","Declined","Expired","Converted"];
  pageTitle.textContent="Quote details";backBtn.classList.remove("hidden");navState("quotes");
  main.innerHTML=`
    <div class="professional-document quotation-document" id="printArea">
      <header class="document-letterhead">
        <div class="document-brand">
          <img src="vorster-logo.jpg" alt="Vorster Unlimited Trading">
          <div>
            <h1>${esc(settings.companyName||"Vorster Unlimited Trading")}</h1>
            <p>${esc(settings.companyAddress||"FARM118, UNIT 426, RIETFONTEIN, MULDERSDRIFT, 1747")}</p>
            <p>${esc(settings.companyPhone||"072 407 3086")} · ${esc(settings.companyEmail||"sales@v-unlimited.com")}</p>
            <p>VAT: ${esc(settings.vatNumber||"4810233942")} · Reg: ${esc(settings.registrationNumber||"CC 2005/063515/23")}</p>
          </div>
        </div>
        <div class="document-title-block">
          <div class="document-title">QUOTATION</div>
          <div class="document-number">${esc(q.quoteNumber)}</div>
          <span class="badge ${statusClass(q.status)}">${esc(q.status)}</span>
        </div>
      </header>

      <section class="document-parties">
        <div>
          <span class="document-label">QUOTED TO</span>
          <h3>${esc(q.customerName)}</h3>
          <p>${esc(customer.contactPerson||"")}</p>
          <p>${esc(customer.address||"")}</p>
          <p>${esc(customer.phone||customer.whatsapp||"")}</p>
          <p>${esc(customer.email||"")}</p>
          ${customer.vat?`<p>VAT: ${esc(customer.vat)}</p>`:""}
        </div>
        <div class="document-meta">
          <div><span>Quote date</span><strong>${dateText(q.createdAt)}</strong></div>
          <div><span>Valid until</span><strong>${q.validUntil?dateText(q.validUntil):"Not set"}</strong></div>
          <div><span>Reference</span><strong>${esc(q.quoteNumber)}</strong></div>
          <div><span>Delivery / Collection</span><strong>${esc(customer.preference||"Delivery")}</strong></div>
        </div>
      </section>

      <section class="document-items">
        ${Object.entries(groupLinesByColour(q.lines)).map(([colour,items])=>`
          <div class="quote-colour-section">
            <div class="quote-colour-heading">${esc(colour)}</div>
            <div class="quote-table quote-table-head">
              <div>Code & description</div><div>Qty</div><div>Unit ex VAT</div><div>Total ex VAT</div>
            </div>
            ${items.map(l=>`
              <div class="quote-table">
                <div><strong>${esc(l.productCode)}</strong><span>${esc(l.productName)}</span></div>
                <div>${l.qty}</div>
                <div>${money(l.unitPrice)}</div>
                <div>${money(l.qty*l.unitPrice)}</div>
              </div>`).join("")}
          </div>`).join("")}
      </section>

      <section class="document-summary">
        <div class="document-notes">
          ${q.customerNotes?`<div><span class="document-label">NOTES</span><p>${esc(q.customerNotes)}</p></div>`:""}
          <div>
            <span class="document-label">TERMS AND CONDITIONS</span>
            <p>${esc(settings.quoteTerms||"Quotation valid until the date shown. Prices are subject to stock availability. Delivery dates are confirmed once the order is accepted. Goods remain the property of Vorster Unlimited Trading until paid in full.")}</p>
          </div>
        </div>
        <div class="document-totals">
          <div><span>Subtotal ex VAT</span><strong>${money(q.subtotal)}</strong></div>
          <div><span>Discount</span><strong>− ${money(q.discount||0)}</strong></div>
          <div><span>Delivery</span><strong>${money(q.delivery)}</strong></div>
          <div><span>VAT (${q.vatRate||15}%)</span><strong>${money(q.vat)}</strong></div>
          <div class="document-grand-total"><span>TOTAL</span><strong>${money(q.grandTotal)}</strong></div>
        </div>
      </section>

      <section class="acceptance-section">
        <span class="document-label">QUOTATION ACCEPTANCE</span>
        <p>I accept this quotation and authorise Vorster Unlimited Trading to proceed with the order.</p>
        <div class="signature-grid">
          <div><span>Customer name</span></div><div><span>Signature</span></div><div><span>Date</span></div>
        </div>
      </section>

      <footer class="document-footer">
        Thank you for the opportunity to quote. Please use ${esc(q.quoteNumber)} as your reference.
      </footer>
    </div>

    <div class="card no-print quote-control-panel" style="margin-top:12px">
      ${q.internalNotes?`<p><strong>Internal notes:</strong> ${esc(q.internalNotes)}</p>`:""}
      ${q.linkedOrderId?`<div class="linked-document"><span>Converted order</span><button class="secondary" onclick="viewOrder('${q.linkedOrderId}')">${esc(q.linkedOrderNumber||"Open order")}</button></div>`:""}
      <label>Status<select id="quoteStatusSelect">${statuses.map(s=>`<option ${s===q.status?"selected":""}>${s}</option>`).join("")}</select></label>
      <div class="actions" style="margin-top:10px">
        ${q.status==="Draft"?`<button class="secondary" onclick="startQuote('${q.id}')">Edit</button>`:""}
        <button class="primary" onclick="printQuote('${q.id}')">Professional PDF</button>
        <button class="secondary" onclick="shareQuote('${q.id}')">Share summary</button>
        ${!q.linkedOrderId&&!["Declined","Expired"].includes(q.status)?`<button class="primary" onclick="convertQuoteToOrder('${q.id}')">Convert to order</button>`:""}
        <button class="ghost" onclick="duplicateQuote('${q.id}')">Duplicate</button>
        <button class="danger" onclick="removeQuote('${q.id}')">Delete</button>
      </div>
      <p class="muted sprint-note">Use Professional PDF, then choose “Save as PDF” in the phone’s print menu. The PDF uses the quotation details saved in Settings.</p>
    </div>`;
  document.getElementById("quoteStatusSelect").onchange=async e=>{
    const next=e.target.value;
    if(confirm(`Change quote status from ${q.status} to ${next}?`)){
      q.status=next;q.updatedAt=new Date().toISOString();await putOne("quotes",q);notify("Quote status updated");viewQuote(id);
    }else e.target.value=q.status;
  };
}

function printQuote(){
  document.body.classList.add("printing-quotation");
  window.print();
  setTimeout(()=>document.body.classList.remove("printing-quotation"),1000);
}

async function nextOrderNumber(){
  const orders=await getAll("orders");
  const year=new Date().getFullYear();
  const prefix=`ORD-${year}-`;
  const highest=orders
    .map(o=>o.orderNumber||"")
    .filter(n=>n.startsWith(prefix))
    .map(n=>Number(n.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((m,n)=>Math.max(m,n),0);
  return `${prefix}${String(highest+1).padStart(4,"0")}`;
}

async function convertQuoteToOrder(id){
  const q=await getOne("quotes",id);
  if(!q)return;
  if(q.linkedOrderId){notify("Quote is already converted");return viewOrder(q.linkedOrderId);}
  if(!confirm(`Convert ${q.quoteNumber} into a confirmed order?`))return;
  const order={
    id:uid("ord"),
    orderNumber:await nextOrderNumber(),
    customerId:q.customerId,
    customerName:q.customerName,
    customerSnapshot:structuredClone(q.customerSnapshot||{}),
    status:"Confirmed",
    lines:structuredClone(q.lines||[]),
    delivery:Number(q.delivery||0),
    subtotal:Number(q.subtotal||0)-Number(q.discount||0),
    vatRate:Number(q.vatRate||15),
    vat:Number(q.vat||0),
    grandTotal:Number(q.grandTotal||0),
    notes:`Converted from quotation ${q.quoteNumber}${q.customerNotes?` — ${q.customerNotes}`:""}`,
    sourceQuoteId:q.id,
    sourceQuoteNumber:q.quoteNumber,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  await putOne("orders",order);
  q.status="Converted";
  q.linkedOrderId=order.id;
  q.linkedOrderNumber=order.orderNumber;
  q.updatedAt=new Date().toISOString();
  await putOne("quotes",q);
  await putOne("activities",{
    id:uid("act"),
    customerId:q.customerId,
    type:"Quote Converted",
    notes:`${q.quoteNumber} converted to ${order.orderNumber}`,
    createdAt:new Date().toISOString()
  });
  notify("Quote converted to confirmed order");
  viewOrder(order.id);
}

async function shareQuote(id){
  const q=await getOne("quotes",id);
  const grouped=Object.entries(groupLinesByColour(q.lines)).map(([colour,items])=>{
    const lines=items.map(l=>`${l.productCode} ${l.productName} | Qty ${l.qty} | ${money(l.qty*l.unitPrice)}`).join("\n");
    return `${colour.toUpperCase()}\n${lines}`;
  }).join("\n\n");
  const text=`Vorster Unlimited Trading\nQuotation ${q.quoteNumber}\nCustomer: ${q.customerName}\nValid until: ${q.validUntil?dateText(q.validUntil):"Not set"}\n\n${grouped}\n\nSubtotal ex VAT: ${money(q.subtotal)}\nDiscount: ${money(q.discount||0)}\nDelivery: ${money(q.delivery)}\nVAT: ${money(q.vat)}\nTOTAL: ${money(q.grandTotal)}\n\n072 407 3086 | sales@v-unlimited.com`;
  try{
    if(navigator.share)await navigator.share({title:`Quotation ${q.quoteNumber}`,text});
    else{await navigator.clipboard.writeText(text);notify("Quote copied")}
  }catch(err){if(err.name!=="AbortError")alert("Sharing failed. Use Print / Save PDF.")}
}

async function duplicateQuote(id){
  const original=await getOne("quotes",id);
  const copy={
    ...structuredClone(original),
    id:uid("quo"),
    quoteNumber:await nextQuoteNumber(),
    status:"Draft",
    linkedOrderId:"",
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  await putOne("quotes",copy);
  notify("Quote duplicated as draft");
  viewQuote(copy.id);
}

async function removeQuote(id){
  if(confirm("Delete this quotation permanently?")){
    await deleteOne("quotes",id);notify("Quotation deleted");navigate("quotes");
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
  const [allProducts,allCustomers]=await Promise.all([getAll("products"),getAll("customers")]);
  const products=allProducts.filter(p=>p.isActive!==false);
  const customers=allCustomers.filter(c=>c.isActive!==false);
  if(!products.length){alert("Add at least one product first.");return navigate("products")}
  if(!customers.length){alert("Add at least one customer first.");return navigate("customers")}
  const existing=existingId?await getOne("orders",existingId):null;
  const order=existing?structuredClone(existing):{
    id:uid("ord"),orderNumber:await nextOrderNumber(),
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
        <div id="customerSummary" class="customer-summary hidden"></div>
      </div>
      <div>
        <div class="step-label">Step 2</div>
        <label>Choose products</label>
        <input id="catalogueSearch" class="search" placeholder="Search by code or product name">
        <div id="categoryFilters" class="filter-chips"></div>
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
  let activeCategory="All";
  const categories=["All",...Array.from(new Set(products.map(p=>p.category).filter(Boolean))).sort()];
  function renderCustomerSummary(){
    const id=document.getElementById("orderCustomer").value;
    const box=document.getElementById("customerSummary");
    const c=customers.find(x=>x.id===id);
    if(!c){box.classList.add("hidden");box.innerHTML="";return;}
    box.classList.remove("hidden");
    box.innerHTML=`<strong>${esc(c.name)}</strong><span>${esc(c.contactPerson||"No contact person")}</span><span>${esc(c.phone||c.whatsapp||"No phone number")}</span><span>${esc(c.preference||"Delivery")}</span>`;
  }
  function renderCategoryFilters(){
    document.getElementById("categoryFilters").innerHTML=categories.map(c=>`<button type="button" class="filter-chip ${c===activeCategory?"selected":""}" data-category="${esc(c)}">${esc(c)}</button>`).join("");
    document.querySelectorAll(".filter-chip").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;renderCategoryFilters();renderCatalogue(document.getElementById("catalogueSearch").value);});
  }
  function renderCatalogue(filter=""){
    const shown=products.filter(p=>(activeCategory==="All"||p.category===activeCategory)&&(p.code+" "+p.name+" "+(p.category||"")).toLowerCase().includes(filter.toLowerCase()));
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
  document.getElementById("orderCustomer").onchange=renderCustomerSummary;
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
  renderCategoryFilters();renderCatalogue();renderBasket();renderCustomerSummary();
}

async function viewOrder(id){
  const o=await getOne("orders",id);
  const statuses=["Draft","Sent","Confirmed","In Production","Ready","Delivered","Collected","Completed","Cancelled"];
  pageTitle.textContent="Order details";backBtn.classList.remove("hidden");navState("orders");
  main.innerHTML=`
    <div class="card order-doc" id="printArea">
      <div class="order-doc-head">
        <div><div class="step-label">Vorster Unlimited Trading</div><h2>${esc(o.orderNumber)}</h2><span class="badge ${statusClass(o.status)}">${esc(o.status)}</span>${o.sourceQuoteId?`<p class="muted">From quotation <button class="link-button no-print" onclick="viewQuote('${o.sourceQuoteId}')">${esc(o.sourceQuoteNumber||"Open quote")}</button></p>`:""}</div>
        <img src="vorster-logo.jpg" alt="">
      </div>
      <p><strong>Customer:</strong> ${esc(o.customerName)}</p>
      <p><strong>Date:</strong> ${dateText(o.createdAt)}</p>
      <div class="colour-groups">${Object.entries(groupLinesByColour(o.lines)).map(([colour,items])=>`
        <section class="colour-group">
          <div class="colour-group-head"><h3>${esc(colour)}</h3><span class="badge">${items.reduce((s,x)=>s+Number(x.qty),0)} items</span></div>
          <div class="list">${items.map(l=>`
            <div class="list-item"><div><strong>${esc(l.productCode)} · ${esc(l.productName)}</strong><p class="muted">Qty ${l.qty} × ${money(l.unitPrice)}</p></div><strong>${money(l.qty*l.unitPrice)}</strong></div>`).join("")}</div>
        </section>`).join("")}</div>
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
        <button class="primary" onclick="shareOrder('${o.id}')">Share order</button>
        <button class="ghost" onclick="window.print()">Print / Save PDF</button>
        <button class="ghost" onclick="duplicateOrder('${o.id}')">Duplicate</button>
        ${["Confirmed","In Production"].includes(o.status)?`<button class="secondary" onclick="createProductionJob('${o.id}')">Production job</button>`:""}
        ${["Ready","Delivered"].includes(o.status)?`<button class="secondary" onclick="scheduleDelivery('${o.id}')">Schedule delivery</button>`:""}
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
  const grouped=Object.entries(groupLinesByColour(o.lines)).map(([colour,items])=>{
    const lines=items.map(l=>`${l.productCode} ${l.productName} | Qty ${l.qty} | ${money(l.qty*l.unitPrice)}`).join("\n");
    return `${colour.toUpperCase()}\n${lines}`;
  }).join("\n\n");
  const text=`Vorster Unlimited Trading\nOrder ${o.orderNumber}\nCustomer: ${o.customerName}\nStatus: ${o.status}\n\n${grouped}\n\nSubtotal ex VAT: ${money(o.subtotal)}\nVAT: ${money(o.vat)}\nDelivery: ${money(o.delivery)}\nTOTAL: ${money(o.grandTotal)}\n\n072 407 3086 | sales@v-unlimited.com`;
  try{
    if(navigator.share)await navigator.share({title:`Order ${o.orderNumber}`,text});
    else{await navigator.clipboard.writeText(text);notify("Order copied")}
  }catch(err){if(err.name!=="AbortError")alert("Sharing failed. Use Print / Save PDF.")}
}
async function duplicateOrder(id){
  const original=await getOne("orders",id);
  const copy={
    ...structuredClone(original),
    id:uid("ord"),
    orderNumber:await nextOrderNumber(),
    status:"Draft",
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  await putOne("orders",copy);
  notify("Order duplicated as draft");
  viewOrder(copy.id);
}
async function removeOrder(id){
  if(confirm("Delete this order permanently?")){await deleteOne("orders",id);notify("Order deleted");navigate("orders")}
}


async function createProductionJob(orderId){
  const [order,jobs]=await Promise.all([getOne("orders",orderId),getAll("productionJobs")]);
  const existing=jobs.find(j=>j.orderId===orderId && j.status!=="Cancelled");
  if(existing){notify("Production job already exists");return viewProductionJob(existing.id);}
  const job={
    id:uid("job"),
    jobNumber:`JOB-${String(Date.now()).slice(-6)}`,
    orderId,
    orderNumber:order.orderNumber,
    customerId:order.customerId,
    customerName:order.customerName,
    status:"Pending",
    lines:structuredClone(order.lines||[]),
    notes:"",
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  await putOne("productionJobs",job);
  if(order.status==="Confirmed"){order.status="In Production";order.updatedAt=new Date().toISOString();await putOne("orders",order);}
  notify("Production job created");
  viewProductionJob(job.id);
}

async function productionPage(){
  const jobs=(await getAll("productionJobs")).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  main.innerHTML=`
    <div class="section-head"><h2>Production jobs</h2></div>
    <div class="filter-chips" id="productionFilters">
      <button class="filter-chip selected" data-status="All">All</button>
      <button class="filter-chip" data-status="Pending">Pending</button>
      <button class="filter-chip" data-status="In Progress">In Progress</button>
      <button class="filter-chip" data-status="Completed">Completed</button>
    </div>
    <div id="productionList" class="list"></div>`;
  const render=status=>{
    const shown=status==="All"?jobs:jobs.filter(j=>j.status===status);
    document.getElementById("productionList").innerHTML=shown.length?shown.map(j=>`
      <button class="list-item" style="width:100%;text-align:left" onclick="viewProductionJob('${j.id}')">
        <div><h3>${esc(j.jobNumber)} · ${esc(j.customerName)}</h3><p class="muted">${esc(j.orderNumber)} · ${dateText(j.createdAt)}</p><span class="badge ${statusClass(j.status)}">${esc(j.status)}</span></div>
        <strong>${(j.lines||[]).reduce((s,l)=>s+Number(l.qty||0),0)} items</strong>
      </button>`).join(""):`<div class="empty">No production jobs found.</div>`;
  };
  document.querySelectorAll("#productionFilters button").forEach(b=>b.onclick=()=>{
    document.querySelectorAll("#productionFilters button").forEach(x=>x.classList.remove("selected"));
    b.classList.add("selected");render(b.dataset.status);
  });
  render("All");
}

async function viewProductionJob(id){
  const job=await getOne("productionJobs",id);
  if(!job)return navigate("production");
  pageTitle.textContent="Production job";
  backBtn.classList.remove("hidden");
  main.innerHTML=`
    <div class="card">
      <div class="order-doc-head"><div><div class="step-label">Production job</div><h2>${esc(job.jobNumber)}</h2><span class="badge ${statusClass(job.status)}">${esc(job.status)}</span></div><img src="vorster-logo.jpg" alt=""></div>
      <p><strong>Order:</strong> ${esc(job.orderNumber)}</p>
      <p><strong>Customer:</strong> ${esc(job.customerName)}</p>
      <div class="colour-groups">${Object.entries(groupLinesByColour(job.lines)).map(([colour,items])=>`
        <section class="colour-group">
          <div class="colour-group-head"><h3>${esc(colour)}</h3><span class="badge">${items.reduce((s,x)=>s+Number(x.qty),0)} items</span></div>
          <div class="list">${items.map(l=>`<div class="list-item"><div><strong>${esc(l.productCode)} · ${esc(l.productName)}</strong><p class="muted">Qty ${l.qty}</p></div></div>`).join("")}</div>
        </section>`).join("")}</div>
    </div>
    <div class="card no-print" style="margin-top:12px">
      <label>Status<select id="jobStatus">
        ${["Pending","In Progress","Completed","Cancelled"].map(s=>`<option ${s===job.status?"selected":""}>${s}</option>`).join("")}
      </select></label>
      <label>Production notes<textarea id="jobNotes">${esc(job.notes||"")}</textarea></label>
      <button id="saveJob" class="primary">Save production job</button>
    </div>`;
  document.getElementById("saveJob").onclick=async()=>{
    const previous=job.status;
    job.status=document.getElementById("jobStatus").value;
    job.notes=document.getElementById("jobNotes").value;
    job.updatedAt=new Date().toISOString();
    await putOne("productionJobs",job);
    if(job.status==="Completed"&&previous!=="Completed"){
      const order=await getOne("orders",job.orderId);
      if(order){order.status="Ready";order.updatedAt=new Date().toISOString();await putOne("orders",order);}
    }
    notify("Production job saved");
    viewProductionJob(id);
  };
}

async function scheduleDelivery(orderId){
  const [order,deliveries]=await Promise.all([getOne("orders",orderId),getAll("deliveries")]);
  const existing=deliveries.find(d=>d.orderId===orderId && d.status!=="Cancelled");
  if(existing){notify("Delivery already scheduled");return viewDelivery(existing.id);}
  openDialog(`
    <div class="dialog-head"><h2>Schedule delivery</h2><button class="close-btn" onclick="closeDialog()">×</button></div>
    <form id="deliveryForm">
      <label>Delivery date<input name="deliveryDate" type="date" required></label>
      <label>Vehicle<select name="vehicle"><option>Bakkie 1</option><option>Bakkie 2</option><option>Other</option></select></label>
      <label>Driver<input name="driver" placeholder="Driver name"></label>
      <label>Notes<textarea name="notes"></textarea></label>
      <button class="primary" type="submit">Schedule delivery</button>
    </form>`);
  document.getElementById("deliveryForm").onsubmit=async e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.target));
    const delivery={id:uid("del"),orderId,orderNumber:order.orderNumber,customerId:order.customerId,customerName:order.customerName,status:"Scheduled",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...d};
    await putOne("deliveries",delivery);
    closeDialog();notify("Delivery scheduled");viewDelivery(delivery.id);
  };
}

async function deliveriesPage(){
  const deliveries=(await getAll("deliveries")).sort((a,b)=>String(a.deliveryDate).localeCompare(String(b.deliveryDate)));
  main.innerHTML=`
    <div class="section-head"><h2>Delivery schedule</h2></div>
    <div class="list">${deliveries.length?deliveries.map(d=>`
      <button class="list-item" style="width:100%;text-align:left" onclick="viewDelivery('${d.id}')">
        <div><h3>${esc(d.customerName)}</h3><p>${esc(d.orderNumber)} · ${esc(d.vehicle||"Vehicle not set")}</p><p class="muted">${d.deliveryDate?dateText(d.deliveryDate):"No date"}</p><span class="badge ${statusClass(d.status)}">${esc(d.status)}</span></div>
        <strong>${esc(d.driver||"No driver")}</strong>
      </button>`).join(""):`<div class="empty">No deliveries scheduled.</div>`}</div>`;
}

async function viewDelivery(id){
  const delivery=await getOne("deliveries",id);
  if(!delivery)return navigate("deliveries");
  pageTitle.textContent="Delivery details";
  backBtn.classList.remove("hidden");
  main.innerHTML=`
    <div class="card">
      <div class="step-label">Delivery</div>
      <h2>${esc(delivery.customerName)}</h2>
      <p><strong>Order:</strong> ${esc(delivery.orderNumber)}</p>
      <p><strong>Date:</strong> ${delivery.deliveryDate?dateText(delivery.deliveryDate):"Not set"}</p>
      <p><strong>Vehicle:</strong> ${esc(delivery.vehicle||"—")}</p>
      <p><strong>Driver:</strong> ${esc(delivery.driver||"—")}</p>
      <p><strong>Notes:</strong> ${esc(delivery.notes||"—")}</p>
      <span class="badge ${statusClass(delivery.status)}">${esc(delivery.status)}</span>
    </div>
    <div class="card no-print" style="margin-top:12px">
      <label>Status<select id="deliveryStatus">${["Scheduled","Loaded","Out for Delivery","Delivered","Cancelled"].map(s=>`<option ${s===delivery.status?"selected":""}>${s}</option>`).join("")}</select></label>
      <label>Delivery date<input id="deliveryDateEdit" type="date" value="${esc(delivery.deliveryDate||"")}"></label>
      <label>Vehicle<select id="deliveryVehicle"><option ${delivery.vehicle==="Bakkie 1"?"selected":""}>Bakkie 1</option><option ${delivery.vehicle==="Bakkie 2"?"selected":""}>Bakkie 2</option><option ${delivery.vehicle==="Other"?"selected":""}>Other</option></select></label>
      <label>Driver<input id="deliveryDriver" value="${esc(delivery.driver||"")}"></label>
      <label>Notes<textarea id="deliveryNotes">${esc(delivery.notes||"")}</textarea></label>
      <button id="saveDelivery" class="primary">Save delivery</button>
    </div>`;
  document.getElementById("saveDelivery").onclick=async()=>{
    const previous=delivery.status;
    delivery.status=document.getElementById("deliveryStatus").value;
    delivery.deliveryDate=document.getElementById("deliveryDateEdit").value;
    delivery.vehicle=document.getElementById("deliveryVehicle").value;
    delivery.driver=document.getElementById("deliveryDriver").value;
    delivery.notes=document.getElementById("deliveryNotes").value;
    delivery.updatedAt=new Date().toISOString();
    await putOne("deliveries",delivery);
    if(delivery.status==="Delivered"&&previous!=="Delivered"){
      const order=await getOne("orders",delivery.orderId);
      if(order){order.status="Delivered";order.updatedAt=new Date().toISOString();await putOne("orders",order);}
    }
    notify("Delivery saved");
    viewDelivery(id);
  };
}

async function settingsPage(){
  const settings=(await getAll("settings"))[0]||{id:"app_settings",companyColours:[
    {name:"Charcoal",hex:"#4a4a4a"},
    {name:"White",hex:"#ffffff"},
    {name:"Sandstone",hex:"#c9b38f"},
    {name:"Terracotta",hex:"#a75d47"}
  ],
  companyName:"Vorster Unlimited Trading",
  companyPhone:"072 407 3086",
  companyEmail:"sales@v-unlimited.com",
  companyAddress:"FARM118, UNIT 426, RIETFONTEIN, MULDERSDRIFT, 1747",
  vatNumber:"4810233942",
  registrationNumber:"CC 2005/063515/23",
  quoteTerms:"Quotation valid until the date shown. Prices are subject to stock availability. Delivery dates are confirmed once the order is accepted. Goods remain the property of Vorster Unlimited Trading until paid in full."};
  main.innerHTML=`
    <div class="card">
      <h2>Company colour library</h2>
      <p class="muted">Create reusable colours for all products.</p>
      <div class="colour-entry">
        <input id="globalColourName" placeholder="Colour name">
        <input id="globalColourHex" type="color" value="#777777" style="width:58px;padding:4px">
        <button id="addGlobalColour" class="secondary" type="button">Add</button>
      </div>
      <div id="globalColours" class="colour-tiles"></div>
      <button id="saveGlobalColours" class="primary" style="margin-top:10px">Save colour library</button>
    </div>

    <div class="card" style="margin-top:12px">
      <h2>Quotation details</h2>
      <p class="muted">These details appear on professional quotations.</p>
      <label>Business name<input id="companyName" value="${esc(settings.companyName||"Vorster Unlimited Trading")}"></label>
      <label>Telephone<input id="companyPhone" value="${esc(settings.companyPhone||"072 407 3086")}"></label>
      <label>Email<input id="companyEmail" value="${esc(settings.companyEmail||"sales@v-unlimited.com")}"></label>
      <label>Business address<textarea id="companyAddress">${esc(settings.companyAddress||"FARM118, UNIT 426, RIETFONTEIN, MULDERSDRIFT, 1747")}</textarea></label>
      <div class="grid two">
        <label>VAT number<input id="vatNumber" value="${esc(settings.vatNumber||"4810233942")}"></label>
        <label>Registration<input id="registrationNumber" value="${esc(settings.registrationNumber||"CC 2005/063515/23")}"></label>
      </div>
      <label>Quotation terms<textarea id="quoteTerms">${esc(settings.quoteTerms||"Quotation valid until the date shown. Prices are subject to stock availability. Delivery dates are confirmed once the order is accepted. Goods remain the property of Vorster Unlimited Trading until paid in full.")}</textarea></label>
      <button id="saveQuoteSettings" class="primary">Save quotation details</button>
    </div>

    <div class="card" style="margin-top:12px">
      <h2>Backup and restore</h2>
      <p class="muted">Data is currently stored on this phone. Export a backup regularly.</p>
      <div class="actions">
        <button class="primary" onclick="exportBackup()">Export backup</button>
        <label class="secondary" style="display:inline-flex;align-items:center;cursor:pointer">Restore backup<input id="restoreInput" type="file" accept=".json" hidden></label>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h2>Application</h2>
      <p><strong>Version:</strong> 1.0 Alpha 7.2.1</p>
      <p><strong>Currency:</strong> South African Rand</p>
      <p><strong>VAT:</strong> 15%</p>
      <p class="muted">Phone-first local version. Cloud sync will be added later.</p>
    </div>`;

  let colours=[...(settings.companyColours||[])];
  const render=()=>{
    document.getElementById("globalColours").innerHTML=colours.length?colours.map((c,i)=>`
      <button type="button" class="colour-tile" data-i="${i}">
        <span class="swatch" style="--swatch:${esc(c.hex)}"></span>${esc(c.name)} ×
      </button>`).join(""):`<span class="muted">No colours saved.</span>`;
    document.querySelectorAll("#globalColours button").forEach(b=>b.onclick=()=>{colours.splice(Number(b.dataset.i),1);render();});
  };
  document.getElementById("addGlobalColour").onclick=()=>{
    const name=document.getElementById("globalColourName").value.trim();
    const hex=document.getElementById("globalColourHex").value;
    if(name&&!colours.some(c=>c.name.toLowerCase()===name.toLowerCase())) colours.push({name,hex});
    document.getElementById("globalColourName").value="";
    render();
  };
  document.getElementById("saveGlobalColours").onclick=async()=>{
    settings.companyColours=colours;
    settings.updatedAt=new Date().toISOString();
    await putOne("settings",settings);
    notify("Colour library saved");
  };
  document.getElementById("saveQuoteSettings").onclick=async()=>{
    settings.companyName=document.getElementById("companyName").value.trim();
    settings.companyPhone=document.getElementById("companyPhone").value.trim();
    settings.companyEmail=document.getElementById("companyEmail").value.trim();
    settings.companyAddress=document.getElementById("companyAddress").value.trim();
    settings.vatNumber=document.getElementById("vatNumber").value.trim();
    settings.registrationNumber=document.getElementById("registrationNumber").value.trim();
    settings.quoteTerms=document.getElementById("quoteTerms").value.trim();
    settings.companyColours=colours;
    settings.updatedAt=new Date().toISOString();
    await putOne("settings",settings);
    notify("Quotation details saved");
  };
  render();
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
