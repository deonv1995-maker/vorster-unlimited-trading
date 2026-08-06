
const SAGE_NON_PRODUCTION_CODES=new Set(["DB","G/DB","R/C/DB","DEL","C+R","0125","RED","PINK","ORANGE","GREEN1","C10","CW","RUST"]);
const normaliseSageCode=value=>String(value||"").trim().toUpperCase();
const sageSettingsId="sage-connection";

async function getSageSettings(){
  return (await getOne("sageSync",sageSettingsId))||{
    id:sageSettingsId,connectorUrl:"",companyId:"",companyName:"",enabled:false,lastSyncAt:"",lastStatus:"Not connected",lastError:""
  };
}
async function saveSageSettings(value){
  await putOne("sageSync",{...value,id:sageSettingsId,updatedAt:new Date().toISOString()});
}
function classifySageLine(line){
  const code=normaliseSageCode(line.productCode||line.code);
  if(code==="DEL")return"delivery";
  if(["DB","G/DB","R/C/DB","C+R","0125","RED","PINK","ORANGE","GREEN1","C10","CW","RUST"].includes(code))return"instruction";
  return"product";
}
async function matchSageProduct(line,products,mappings){
  const code=normaliseSageCode(line.productCode||line.code);
  const mapped=mappings.find(m=>normaliseSageCode(m.sageCode)===code);
  if(mapped){
    const product=products.find(p=>p.id===mapped.productId);
    if(product)return product;
  }
  return products.find(p=>normaliseSageCode(p.code)===code)||null;
}
async function importSageOrders(payload){
  const products=await getAll("products");
  const mappings=await getAll("sageMappings");
  const currentOrders=await getAll("orders");
  const sourceOrders=Array.isArray(payload)?payload:(payload.orders||payload.results||[]);
  let created=0,updated=0,unmatched=0;
  for(const source of sourceOrders){
    const sageId=String(source.id||source.ID||source.orderId||source.documentId||source.number||source.documentNumber);
    if(!sageId)continue;
    const rawLines=source.lines||source.documentLines||source.items||[];
    const lines=[];
    const instructions=[];
    for(const raw of rawLines){
      const type=classifySageLine(raw);
      const code=String(raw.productCode||raw.code||raw.selectionCode||"").trim();
      const description=String(raw.description||raw.name||raw.productName||"").trim();
      if(type!=="product"){
        instructions.push({type,code,description,qty:Number(raw.quantity||raw.qty||1)});
        continue;
      }
      const product=await matchSageProduct(raw,products,mappings);
      if(!product)unmatched++;
      lines.push({
        productId:product?.id||"",
        productCode:code,
        productName:product?.name||description||code,
        colour:{name:raw.colour||raw.color||"Standard",hex:"#bbbbbb"},
        qty:Number(raw.quantity||raw.qty||0),
        unitPrice:Number(raw.unitPrice||raw.price||raw.exclusivePrice||0),
        sageLineId:String(raw.id||raw.ID||""),
        sageMatched:Boolean(product),
        allocationQty:0,
        completedQty:0
      });
    }
    const existing=currentOrders.find(o=>String(o.sageId||"")===sageId);
    const now=new Date().toISOString();
    const record={
      ...(existing||{}),
      id:existing?.id||uid("ord"),
      sageId,
      source:"Sage",
      orderNumber:String(source.number||source.documentNumber||source.orderNumber||sageId),
      customerId:existing?.customerId||"",
      customerName:String(source.customerName||source.customer?.name||source.customer?.Name||"Sage customer"),
      customerCode:String(source.customerCode||source.customer?.code||""),
      createdAt:source.date||source.documentDate||existing?.createdAt||now,
      dueDate:source.dueDate||source.deliveryDate||existing?.dueDate||"",
      status:source.status||existing?.status||"Confirmed",
      lines,
      sageInstructions:instructions,
      subTotal:Number(source.totalExclusive||source.subTotal||0),
      vat:Number(source.totalTax||source.vat||0),
      grandTotal:Number(source.totalInclusive||source.grandTotal||source.total||0),
      sageUpdatedAt:source.updatedAt||now,
      updatedAt:now,
      readOnlySource:true
    };
    await putOne("orders",record);
    existing?updated++:created++;
  }
  return{created,updated,unmatched,total:sourceOrders.length};
}
async function runSageSync(){
  const settings=await getSageSettings();
  if(!settings.connectorUrl){notify("Add the secure Sage connector URL first");return;}
  const button=document.getElementById("sageSyncNow");
  if(button){button.disabled=true;button.textContent="Syncing…";}
  try{
    const base=settings.connectorUrl.replace(/\/$/,"");
    const response=await fetch(`${base}/api/sage/orders?companyId=${encodeURIComponent(settings.companyId||"")}`,{headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error(`Connector returned ${response.status}`);
    const payload=await response.json();
    const result=await importSageOrders(payload);
    await saveSageSettings({...settings,enabled:true,lastSyncAt:new Date().toISOString(),lastStatus:`${result.total} orders received`,lastError:""});
    notify(`Sage sync: ${result.created} new, ${result.updated} updated`);
    await sageSyncPage();
  }catch(error){
    await saveSageSettings({...settings,lastStatus:"Sync failed",lastError:String(error.message||error)});
    notify("Sage sync failed — check connector settings");
    await sageSyncPage();
  }
}
async function sageSyncPage(){
  const settings=await getSageSettings();
  const [orders,products,mappings]=await Promise.all([getAll("orders"),getAll("products"),getAll("sageMappings")]);
  const sageOrders=orders.filter(o=>o.source==="Sage");
  const unmatched=[];
  sageOrders.forEach(order=>(order.lines||[]).forEach(line=>{if(!line.sageMatched&&!unmatched.some(x=>normaliseSageCode(x.productCode)===normaliseSageCode(line.productCode)))unmatched.push(line);}));
  pageTitle.textContent="Sage Sync";
  backBtn.classList.remove("hidden");
  navState("settings");
  main.innerHTML=`
    <section class="card">
      <div class="section-head"><div><span class="step-label">Read-only integration</span><h2>Sage Accounting</h2></div><span class="badge ${settings.enabled?"confirmed":""}">${esc(settings.lastStatus)}</span></div>
      <p class="muted">Credentials stay in the secure connector. This phone stores only the connector address and company identifier.</p>
      <form id="sageConnectionForm">
        <label>Secure connector URL<input name="connectorUrl" type="url" placeholder="https://your-secure-connector.example" value="${esc(settings.connectorUrl)}"></label>
        <label>Sage company ID<input name="companyId" inputmode="numeric" value="${esc(settings.companyId)}"></label>
        <label>Company name<input name="companyName" value="${esc(settings.companyName)}" placeholder="Vorster Unlimited"></label>
        <button class="primary" type="submit">Save connection settings</button>
      </form>
      <div class="actions" style="margin-top:12px"><button id="sageSyncNow" class="secondary">Sync open orders now</button></div>
      <p class="muted">Last sync: ${settings.lastSyncAt?dateText(settings.lastSyncAt):"Never"}</p>
      ${settings.lastError?`<p class="customer-note"><strong>Last error:</strong> ${esc(settings.lastError)}</p>`:""}
    </section>
    <div class="grid two" style="margin-top:12px">
      <div class="card stat"><span class="muted">Sage orders</span><strong>${sageOrders.length}</strong></div>
      <div class="card stat"><span class="muted">Unmatched codes</span><strong>${unmatched.length}</strong></div>
    </div>
    <section class="card" style="margin-top:12px">
      <div class="section-head"><div><h2>Product matching</h2><p class="muted">Match Sage codes that do not exist in the app.</p></div></div>
      <div class="list">${unmatched.length?unmatched.map(line=>`
        <div class="list-item"><div><strong>${esc(line.productCode)}</strong><p>${esc(line.productName)}</p></div>
          <select class="sage-map-select" data-code="${esc(line.productCode)}"><option value="">Choose app product</option>${products.map(p=>`<option value="${p.id}">${esc(p.code)} · ${esc(p.name)}</option>`).join("")}</select>
        </div>`).join(""):`<div class="empty">All imported product codes are matched.</div>`}</div>
    </section>`;
  document.getElementById("sageConnectionForm").onsubmit=async event=>{
    event.preventDefault();const data=Object.fromEntries(new FormData(event.target));
    await saveSageSettings({...settings,...data});notify("Sage connection settings saved");await sageSyncPage();
  };
  document.getElementById("sageSyncNow").onclick=runSageSync;
  document.querySelectorAll(".sage-map-select").forEach(select=>select.onchange=async()=>{
    if(!select.value)return;
    const code=select.dataset.code;
    await putOne("sageMappings",{id:`sage-map-${normaliseSageCode(code)}`,sageCode:code,productId:select.value,updatedAt:new Date().toISOString()});
    for(const order of sageOrders){
      let changed=false;
      for(const line of (order.lines||[]))if(normaliseSageCode(line.productCode)===normaliseSageCode(code)){
        const product=products.find(p=>p.id===select.value);line.productId=product.id;line.productName=product.name;line.sageMatched=true;changed=true;
      }
      if(changed)await putOne("orders",order);
    }
    notify(`${code} matched`);await sageSyncPage();
  });
}

const originalSettingsPageForSage=settingsPage;
settingsPage=async function(){
  await originalSettingsPageForSage();
  if(document.getElementById("openSageSync"))return;
  const card=document.createElement("div");card.className="card";card.style.marginTop="12px";
  card.innerHTML=`<div class="section-head"><div><h2>Sage Accounting</h2><p class="muted">Import open orders through the secure read-only connector.</p></div><button id="openSageSync" class="secondary">Open Sage Sync</button></div>`;
  main.appendChild(card);document.getElementById("openSageSync").onclick=sageSyncPage;
};
window.sageSyncPage=sageSyncPage;
window.runSageSync=runSageSync;
