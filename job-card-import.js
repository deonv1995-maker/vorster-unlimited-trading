
let pendingJobCardImport=null;
const normaliseImportCode=value=>String(value||"").trim().toUpperCase();
const parseImportDate=value=>{
  const text=String(value||"").trim();
  const za=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(za)return `${za[3]}-${za[2]}-${za[1]}`;
  const parsed=new Date(text);
  return Number.isNaN(parsed.getTime())?new Date().toISOString().slice(0,10):parsed.toISOString().slice(0,10);
};
const readTextFile=file=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||""));
  reader.onerror=()=>reject(reader.error);
  reader.readAsText(file);
});

function validateJobCardImport(data){
  if(!Array.isArray(data)||!data.length)throw new Error("The import file does not contain any job cards.");
  data.forEach((card,index)=>{
    if(!card||!card.orderNumber)throw new Error(`Job card ${index+1} has no order number.`);
    if(!card.customerName)throw new Error(`${card.orderNumber} has no customer name.`);
    if(!Array.isArray(card.lines))throw new Error(`${card.orderNumber} has no line list.`);
  });
  return data;
}

async function openJobCardImport(){
  openDialog(`
    <div class="dialog-head"><div><h2>Import job cards</h2><p class="muted">Import the prepared Vorster job-card JSON file.</p></div><button class="close-btn" onclick="closeDialog()">×</button></div>
    <div class="card">
      <label>Select job-card import file
        <input id="jobCardImportFile" type="file" accept="application/json,.json">
      </label>
      <p class="muted">The app matches customers by account code or name and products by product code. Missing records are created as editable placeholders.</p>
    </div>
    <div id="jobCardImportPreview" style="margin-top:12px"></div>`);
  document.getElementById("jobCardImportFile").onchange=async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try{
      pendingJobCardImport=validateJobCardImport(JSON.parse(await readTextFile(file)));
      await renderJobCardImportPreview();
    }catch(error){
      pendingJobCardImport=null;
      document.getElementById("jobCardImportPreview").innerHTML=`<div class="card"><strong>Import failed</strong><p>${esc(error.message||error)}</p></div>`;
    }
  };
}

async function renderJobCardImportPreview(){
  const data=pendingJobCardImport||[];
  const [products,customers,orders]=await Promise.all([getAll("products"),getAll("customers"),getAll("orders")]);
  const productCodes=new Set(products.map(p=>normaliseImportCode(p.code)));
  const customerCodes=new Set(customers.filter(c=>c.accountCode).map(c=>normaliseImportCode(c.accountCode)));
  const customerNames=new Set(customers.map(c=>String(c.name||"").trim().toLowerCase()));
  const orderNumbers=new Set(orders.map(o=>normaliseImportCode(o.orderNumber)));
  const missingProducts=new Set();
  const missingCustomers=new Set();
  let productLines=0;
  let instructionLines=0;
  data.forEach(card=>{
    const code=normaliseImportCode(card.customerCode);
    const name=String(card.customerName||"").trim().toLowerCase();
    if(!(code&&customerCodes.has(code))&&!customerNames.has(name))missingCustomers.add(card.customerName);
    card.lines.forEach(line=>{
      if((line.kind||"product")==="product"){
        productLines++;
        if(!productCodes.has(normaliseImportCode(line.code)))missingProducts.add(line.code);
      }else instructionLines++;
    });
  });
  const existingOrders=data.filter(card=>orderNumbers.has(normaliseImportCode(card.orderNumber))).length;
  document.getElementById("jobCardImportPreview").innerHTML=`
    <div class="grid two">
      <div class="card stat"><span class="muted">Job cards</span><strong>${data.length}</strong></div>
      <div class="card stat"><span class="muted">Existing orders</span><strong>${existingOrders}</strong></div>
      <div class="card stat"><span class="muted">Product lines</span><strong>${productLines}</strong></div>
      <div class="card stat"><span class="muted">Instruction lines</span><strong>${instructionLines}</strong></div>
      <div class="card stat"><span class="muted">New customers</span><strong>${missingCustomers.size}</strong></div>
      <div class="card stat"><span class="muted">New products</span><strong>${missingProducts.size}</strong></div>
    </div>
    <div class="card" style="margin-top:12px">
      <h3>Safe matching rules</h3>
      <p>Existing job-card numbers are updated rather than duplicated. Existing products keep their images, stock, mould quantities and daily capacities.</p>
    </div>
    <div class="actions"><button class="primary" onclick="commitJobCardImport()">Import ${data.length} job cards</button><button class="secondary" onclick="closeDialog()">Cancel</button></div>`;
}

async function commitJobCardImport(){
  const data=pendingJobCardImport;
  if(!data?.length)return;
  const now=new Date().toISOString();
  const [products,customers,orders]=await Promise.all([getAll("products"),getAll("customers"),getAll("orders")]);
  const productByCode=new Map(products.map(p=>[normaliseImportCode(p.code),p]));
  const customerByCode=new Map(customers.filter(c=>c.accountCode).map(c=>[normaliseImportCode(c.accountCode),c]));
  const customerByName=new Map(customers.map(c=>[String(c.name||"").trim().toLowerCase(),c]));
  const orderByNumber=new Map(orders.map(o=>[normaliseImportCode(o.orderNumber),o]));
  let createdProducts=0,createdCustomers=0,createdOrders=0,updatedOrders=0;

  for(const card of data){
    const customerCode=normaliseImportCode(card.customerCode);
    const customerName=String(card.customerName||"").trim();
    let customer=(customerCode&&customerByCode.get(customerCode))||customerByName.get(customerName.toLowerCase());
    if(!customer){
      customer={id:uid("cus"),name:customerName,accountCode:card.customerCode||"",contactPerson:"",phone:"",whatsapp:"",email:"",preference:"Delivery",notes:"Created from imported Sage job card. Complete missing customer details.",isActive:true,createdAt:now,updatedAt:now};
      await putOne("customers",customer);
      createdCustomers++;
      customerByName.set(customerName.toLowerCase(),customer);
      if(customerCode)customerByCode.set(customerCode,customer);
    }

    const orderLines=[];
    const instructions=[];
    for(const line of card.lines){
      const kind=line.kind||"product";
      if(kind!=="product"){
        instructions.push(`${line.code||"Instruction"}: ${line.name||""}`);
        continue;
      }
      const productCode=normaliseImportCode(line.code);
      let product=productByCode.get(productCode);
      if(!product){
        product={id:uid("prd"),code:line.code||"UNKNOWN",name:line.name||line.code||"Imported product",description:"Created from an imported job card. Complete the category, image, mould quantity and manufacturing capacity.",category:"Imported / Unclassified",price:Number(line.unitPrice||0),colours:[{name:line.colour||"Standard",hex:"#999999"}],image:"",mouldQuantity:0,dailyCapacity:0,isActive:true,createdAt:now,updatedAt:now};
        await putOne("products",product);
        productByCode.set(productCode,product);
        createdProducts++;
      }
      const colourName=line.colour||"Standard";
      let colour=(product.colours||[]).find(c=>String(c.name||"").toLowerCase()===colourName.toLowerCase());
      if(!colour){
        colour={name:colourName,hex:"#999999"};
        product={...product,colours:[...(product.colours||[]),colour],updatedAt:now};
        await putOne("products",product);
        productByCode.set(productCode,product);
      }
      orderLines.push({productId:product.id,productCode:product.code,productName:product.name,colour,qty:Number(line.qty||0),unitPrice:Number(line.unitPrice||0),allocatedQty:0,completedQty:0,sourceLineType:"product"});
    }

    const existing=orderByNumber.get(normaliseImportCode(card.orderNumber));
    const lineSubtotal=orderLines.reduce((sum,line)=>sum+line.qty*line.unitPrice,0);
    const grandTotal=Number(card.grandTotal||lineSubtotal);
    const importedNotes=[`Imported from job card ${card.orderNumber}.`,instructions.length?`Instructions: ${instructions.join(" | ")}`:""].filter(Boolean).join("\n");
    const order={
      ...(existing||{id:uid("ord"),createdAt:parseImportDate(card.date)}),
      orderNumber:card.orderNumber,
      customerId:customer.id,
      customerName:customer.name,
      lines:orderLines,
      status:existing?.status||"Confirmed",
      dueDate:parseImportDate(card.dueDate),
      subtotal:lineSubtotal,
      vat:Math.max(0,grandTotal-lineSubtotal),
      deliveryFee:0,
      grandTotal,
      notes:[existing?.notes,importedNotes].filter(Boolean).join("\n"),
      source:"Job Card Import",
      sourceReference:card.orderNumber,
      readOnly:false,
      updatedAt:now
    };
    await putOne("orders",order);
    orderByNumber.set(normaliseImportCode(card.orderNumber),order);
    if(existing)updatedOrders++;else createdOrders++;
  }

  pendingJobCardImport=null;
  closeDialog();
  alert(`Import complete\n\nNew customers: ${createdCustomers}\nNew products: ${createdProducts}\nNew orders: ${createdOrders}\nUpdated orders: ${updatedOrders}`);
  navigate("orders");
}

async function addJobCardImportPanel(){
  if(document.querySelector(".job-card-import-panel"))return;
  const panel=document.createElement("section");
  panel.className="card job-card-import-panel";
  panel.style.marginTop="12px";
  panel.innerHTML=`
    <div class="section-head"><div><h2>Import business data</h2><p class="muted">Start with your current Sage job cards.</p></div><span class="badge">Ready</span></div>
    <p>Import orders, automatically match existing products and customers, and create editable placeholders where records are missing.</p>
    <div class="actions"><button class="primary" onclick="openJobCardImport()">Import job cards</button></div>`;
  main.prepend(panel);
}

const settingsPageBeforeJobCardImport=settingsPage;
settingsPage=async function(...args){
  await settingsPageBeforeJobCardImport(...args);
  await addJobCardImportPanel();
};
window.openJobCardImport=openJobCardImport;
window.commitJobCardImport=commitJobCardImport;
