/* Version 8.9.0 — unified Sage PDF/JSON job-card importer.
   One module owns parsing, preview, customer upsert, order upsert, verification and customer repair.
*/
(function(){
  let pendingCards=null;
  const PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const txt=v=>String(v??'').replace(/\u00a0/g,' ').trim();
  const code=v=>txt(v).toUpperCase();
  const nameKey=v=>txt(v).toLowerCase().replace(/\s+/g,' ');
  const moneyNumber=v=>Number(String(v??'0').replace(/R/gi,'').replace(/\s/g,'').replace(/,/g,''))||0;
  const parseDate=v=>{const s=txt(v);const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;const d=new Date(s);return Number.isNaN(d.getTime())?new Date().toISOString().slice(0,10):d.toISOString().slice(0,10);};
  const colourCodes={'DB':'Dry brush','G/DB':'Grey dry brush','R/C/DB':'Rust cream dry brush','STANDARD':'Standard','0125':'Mixed colours','C10':'Silver wing','RUST':'Rust','R/DB':'Rust dry brush','CHAR':'Charkha wash'};
  const serviceCodes=new Set(['C+R','CR','DEL']);

  function customerMeta(card){
    const address=txt(card.customerAddress||card.deliveryAddress||card.address);
    const deliveryAddress=txt(card.deliveryAddress||card.customerAddress||card.address);
    const vatNumber=txt(card.customerVatNumber||card.vatNumber||card.vatNo);
    const contactPerson=txt(card.contactPerson||card.customerContact||card.contactName||card.buyer);
    const phone=txt(card.phone||card.telephone||card.tel||card.customerPhone);
    const whatsapp=txt(card.whatsapp)||phone;
    const email=txt(card.email||card.customerEmail);
    const area=txt(card.deliveryArea||card.area||card.suburb||card.city);
    const instructionText=[...(Array.isArray(card.instructions)?card.instructions:[]),card.deliveryInstruction,card.deliveryInstructions].filter(Boolean).join(' | ');
    const raw=txt(card.fulfilmentType||card.deliveryType||card.preference||instructionText);
    const preference=/collect/i.test(raw)?'Collection':(/deliver/i.test(raw)?'Delivery':'');
    return{address,deliveryAddress,vatNumber,contactPerson,phone,whatsapp,email,area,preference};
  }

  async function ensurePdfJs(){
    if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib;}
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=PDFJS_URL;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load the PDF reader.'));document.head.appendChild(s);});
    if(!window.pdfjsLib)throw new Error('PDF reader did not initialise.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib;
  }
  function itemsToLines(items){
    const rows=[];
    for(const item of items){const value=txt(item.str);if(!value)continue;const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);let row=rows.find(r=>Math.abs(r.y-y)<=2.4);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,value});}
    rows.sort((a,b)=>b.y-a.y);return rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.value).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  }
  async function extractPdfPages(file){
    const lib=await ensurePdfJs(),pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,pages=[];
    for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent();pages.push({fileName:file.name,pageNo:n,lines:itemsToLines(content.items)});}return pages;
  }
  function orderNo(lines){for(const l of lines){const m=l.match(/\b(?:NUMBER|Number)\s*:\s*(QU\d{5,})\b/i)||l.match(/\b(QU\d{5,})\b/i);if(m)return code(m[1]);}return '';}
  function dateField(lines,label){const rx=new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})`,'i');for(const l of lines){const m=l.match(rx);if(m)return m[1];}return '';}
  function customerIdentity(lines){
    const rejects=/^(?:NUMBER|REFERENCE|DATE|DUE DATE|SALES REP|VAT NO|CUSTOMER VAT NO|PAGE|DESCRIPTION|TOTAL|SUB TOTAL|GRAND TOTAL|BALANCE DUE)/i;
    for(let i=0;i<lines.length;i++){const l=lines[i],m=l.match(/^(.*?)\s*:\s*([A-Z]{2,}[A-Z0-9]{2,})\s*$/i);if(!m||rejects.test(l))continue;const name=txt(m[1]).replace(/^DK\s+POTS\s+ONE\s+CC\s+/i,'').trim();if(name&&!/^(?:FROM|TO)$/i.test(name))return{name,code:code(m[2]),index:i};}
    const joined=lines.join(' '),m=joined.match(/DK\s+POTS\s+ONE\s+CC\s+(.+?)\s*:\s*([A-Z]{2,}[A-Z0-9]{2,})\b/i);return m?{name:txt(m[1]),code:code(m[2]),index:0}:{name:'',code:'',index:-1};
  }
  function customerVat(lines){const j=lines.join(' ');return txt(j.match(/CUSTOMER\s+VAT\s+NO\s*:\s*([0-9]+)/i)?.[1]||'');}
  function contactData(lines){const j=lines.join(' ');const phone=txt(j.match(/\bTEL\s*[:.]?\s*([0-9 ()+\-]{7,})/i)?.[1]||'');const buyer=txt(j.match(/\bBUYER\s*[.:]?\s*(.+?)(?=\s+Description\b|\s+FAX\b|$)/i)?.[1]||'').replace(/\s{2,}.*/,'').trim();return{phone,buyer};}
  function cleanAddressLine(line){
    let s=txt(line).replace(/^Our Account Details:\s*/i,'').replace(/^ABSA\s+\d{2,4}\s+\d{2,4}\s*/i,'').replace(/^ACC\s+NUMBER\s+\d+\s*/i,'').trim();if(!s)return '';
    if(/^(?:JOBCARD|FROM|TO|DK POTS ONE CC|PHYSICAL ADDRESS|NUMBER|REFERENCE|DATE|DUE DATE|SALES REP|OVERALL DISCOUNT|DISCOUNT|PAGE|VAT NO|CUSTOMER VAT NO|Description|Quantity|Excl\.|Notes|Total|Sub Total|Grand Total|BALANCE DUE)/i.test(s))return '';
    if(/(?:Please use your company code|as ref when making a payment|deonvorster@dkpots\.com|Deon Vorster|Vorster 0\d|\bTEL\b|\bFAX\b|\bBUYER\b)/i.test(s))return '';
    if(/^(?:COLLECTION|DELIVERY|PAY\s+\d+|10% DELIVERY FEE)/i.test(s))return '';return s;
  }
  function addressFrom(lines,identity){
    if(identity.index<0)return '';const end=lines.findIndex((l,i)=>i>identity.index&&/^Description\b/i.test(l)),stop=end>identity.index?end:Math.min(lines.length,identity.index+18),parts=[];
    for(let i=identity.index+1;i<stop;i++){if(/\bDUE DATE\s*:/i.test(lines[i])||/\bDISCOUNT\s*:/i.test(lines[i]))continue;const v=cleanAddressLine(lines[i]);if(v&&!v.toUpperCase().includes(identity.name.toUpperCase())&&v!==identity.code&&!parts.some(x=>x.toLowerCase()===v.toLowerCase()))parts.push(v);}return parts.slice(0,5).join(', ');
  }
  function preference(lines){const j=lines.join(' ');return /\bCOLLECTION\b/i.test(j)?'Collection':(/\bDELIVERY\b/i.test(j)?'Delivery':'');}
  function pageTotal(lines){const vals=[];for(const l of lines){const m=l.match(/\b(?:Grand Total|Total Due)\s*:\s*R\s*([\d,.]+)/i);if(m)vals.push(moneyNumber(m[1]));}return vals.at(-1)||0;}
  function productRows(lines){
    const start=lines.findIndex(l=>/^Description\b/i.test(l));if(start<0)return[];const sec=[];for(let i=start+1;i<lines.length;i++){if(/^(?:Notes:|Total Discount:|Total Exclusive:|Total VAT:|Sub Total:|Grand Total:|Total Due:|BALANCE DUE)/i.test(lines[i]))break;sec.push(lines[i]);}
    const rows=[];let pending='';const rowStart=/^[A-Z0-9][A-Z0-9/+\-.]*\s*-\s*/i,hasPrice=/\s\d+(?:[.,]\d+)?\s+R\s*[\d,.]+/i;
    for(const l of sec){if(rowStart.test(l)){if(pending)rows.push(pending);pending=l;if(hasPrice.test(pending)){rows.push(pending);pending='';}}else if(pending){pending+=' '+l;if(hasPrice.test(pending)){rows.push(pending);pending='';}}}if(pending)rows.push(pending);
    return rows.map(r=>{const m=r.match(/^([^\s]+)\s*-\s*(.*?)\s+(\d+(?:[.,]\d+)?)\s+R\s*([\d,.]+)/i);return m?{code:code(m[1]),name:txt(m[2]),qty:Number(String(m[3]).replace(',','.'))||0,unitPrice:moneyNumber(m[4])}:null;}).filter(Boolean);
  }
  function parsePage(page){
    const identity=customerIdentity(page.lines),no=orderNo(page.lines),contact=contactData(page.lines);if(!no)return null;
    return{orderNumber:no,pageNo:page.pageNo,date:dateField(page.lines,'DATE')||dateField(page.lines,'Date'),dueDate:dateField(page.lines,'DUE DATE')||dateField(page.lines,'Due Date'),customerName:identity.name,customerCode:identity.code,customerVatNumber:customerVat(page.lines),customerAddress:addressFrom(page.lines,identity),deliveryAddress:addressFrom(page.lines,identity),contactPerson:contact.buyer,phone:contact.phone,fulfilmentType:preference(page.lines),rows:productRows(page.lines),pageTotal:pageTotal(page.lines)};
  }
  function mergePages(pages){
    const groups=new Map();for(const p of pages.filter(Boolean)){if(!groups.has(p.orderNumber))groups.set(p.orderNumber,[]);groups.get(p.orderNumber).push(p);}const cards=[];
    for(const [orderNumber,group] of groups){group.sort((a,b)=>a.pageNo-b.pageNo);const first=group.find(p=>p.customerName)||group[0],lines=[],instructions=[];let currentColour='Standard',deliveryFee=0;
      for(const p of group)for(const row of p.rows){const isInstruction=serviceCodes.has(row.code)||colourCodes[row.code]||/DELIVERY FEE|COLLECT AND REPLACE|COLOURS?|DRY BRUSH|SILVER WING|MIXED COLOURS/i.test(row.name);if(isInstruction){instructions.push(`${row.code}: ${row.name}`);if(row.code==='DEL')deliveryFee+=row.qty*row.unitPrice;if(colourCodes[row.code])currentColour=colourCodes[row.code];continue;}lines.push({kind:'product',code:row.code,name:row.name,qty:row.qty,unitPrice:row.unitPrice,colour:currentColour});}
      cards.push({orderNumber,date:first.date||'',dueDate:first.dueDate||'',customerName:first.customerName||'',customerCode:first.customerCode||'',customerVatNumber:first.customerVatNumber||group.find(p=>p.customerVatNumber)?.customerVatNumber||'',customerAddress:first.customerAddress||group.find(p=>p.customerAddress)?.customerAddress||'',deliveryAddress:first.deliveryAddress||group.find(p=>p.deliveryAddress)?.deliveryAddress||'',contactPerson:first.contactPerson||group.find(p=>p.contactPerson)?.contactPerson||'',phone:first.phone||group.find(p=>p.phone)?.phone||'',fulfilmentType:first.fulfilmentType||group.find(p=>p.fulfilmentType)?.fulfilmentType||'',grandTotal:group.reduce((s,p)=>s+Number(p.pageTotal||0),0),deliveryFee,lines,instructions:[...new Set(instructions)],sourceFormat:'Sage PDF'});
    }return cards;
  }
  async function parsePdfFiles(files){const pages=[];for(const f of files)pages.push(...await extractPdfPages(f));return mergePages(pages.map(parsePage));}

  function validate(cards){if(!Array.isArray(cards)||!cards.length)throw new Error('No job cards found.');for(const c of cards){if(!c.orderNumber)throw new Error('A job card has no order number.');if(!c.customerName)throw new Error(`${c.orderNumber}: customer name could not be read.`);if(!Array.isArray(c.lines))throw new Error(`${c.orderNumber}: no product list.`);}return cards;}
  async function readText(file){return await file.text();}

  function mergeCustomer(customer,card,now){
    const m=customerMeta(card),c={...customer};if(txt(card.customerCode))c.accountCode=txt(card.customerCode);if(m.vatNumber)c.vatNumber=m.vatNumber;if(m.contactPerson)c.contactPerson=m.contactPerson;if(m.phone)c.phone=m.phone;if(m.whatsapp)c.whatsapp=m.whatsapp;if(m.email)c.email=m.email;if(m.address)c.address=m.address;if(m.deliveryAddress){c.deliveryAddress=m.deliveryAddress;c.primaryDeliveryAddress=m.deliveryAddress;}if(m.area){c.deliveryArea=m.area;c.area=m.area;}if(m.preference)c.preference=m.preference;c.updatedAt=now;
    if(m.deliveryAddress){const locations=(Array.isArray(c.deliveryLocations)?c.deliveryLocations:[]).map(x=>typeof x==='string'?{label:'Delivery location',address:x}:x).filter(x=>txt(x?.address));const k=nameKey(m.deliveryAddress);if(!locations.some(x=>nameKey(x.address)===k))locations.push({label:m.area||'Delivery location',address:m.deliveryAddress,area:m.area||'',source:'Job Card Import',firstSeenAt:now});c.deliveryLocations=locations;}return c;
  }

  async function importCards(){
    const data=pendingCards;if(!data?.length)return;const now=new Date().toISOString();const [products,customers,orders]=await Promise.all([getAll('products'),getAll('customers'),getAll('orders')]);
    const productByCode=new Map(products.map(p=>[code(p.code),p])),customerByCode=new Map(customers.filter(c=>c.accountCode).map(c=>[code(c.accountCode),c])),customerByName=new Map(customers.map(c=>[nameKey(c.name),c])),orderByNumber=new Map(orders.map(o=>[code(o.orderNumber),o]));let createdCustomers=0,updatedCustomers=0,createdProducts=0,createdOrders=0,updatedOrders=0;
    for(const card of data){const meta=customerMeta(card),customerCode=code(card.customerCode),customerName=txt(card.customerName);let customer=(customerCode&&customerByCode.get(customerCode))||customerByName.get(nameKey(customerName)),existed=Boolean(customer);if(!customer){customer={id:uid('cus'),name:customerName,accountCode:txt(card.customerCode),vatNumber:'',contactPerson:'',phone:'',whatsapp:'',email:'',address:'',deliveryAddress:'',primaryDeliveryAddress:'',deliveryArea:'',area:'',preference:'Delivery',notes:'Imported from Sage job card.',isActive:true,createdAt:now,updatedAt:now};createdCustomers++;}
      customer=mergeCustomer(customer,card,now);await putOne('customers',customer);const persisted=await getOne('customers',customer.id);if(!persisted)throw new Error(`${card.orderNumber}: customer did not save.`);for(const [label,expected,actual] of [['VAT',meta.vatNumber,persisted.vatNumber],['contact',meta.contactPerson,persisted.contactPerson],['telephone',meta.phone,persisted.phone],['address',meta.address,persisted.address]])if(expected&&!txt(actual))throw new Error(`${card.orderNumber}: ${label} was extracted but did not persist.`);customer=persisted;if(existed)updatedCustomers++;customerByName.set(nameKey(customer.name),customer);if(customerCode)customerByCode.set(customerCode,customer);
      const existing=orderByNumber.get(code(card.orderNumber));let orderLines=existing?.lines||[];if(!existing){orderLines=[];for(const line of card.lines){if((line.kind||'product')!=='product')continue;let product=productByCode.get(code(line.code));if(!product){product={id:uid('prd'),code:line.code,name:line.name||line.code,description:'Created from imported job card. Complete product setup.',category:'Imported / Unclassified',price:Number(line.unitPrice||0),colours:[{name:line.colour||'Standard',hex:'#999999'}],image:'',mouldQuantity:0,dailyCapacity:0,isActive:true,createdAt:now,updatedAt:now};await putOne('products',product);productByCode.set(code(line.code),product);createdProducts++;}let colour=(product.colours||[]).find(c=>nameKey(c.name)===nameKey(line.colour||'Standard'));if(!colour)colour={name:line.colour||'Standard',hex:'#999999'};orderLines.push({productId:product.id,productCode:product.code,productName:product.name,colour,qty:Number(line.qty||0),unitPrice:Number(line.unitPrice||0),allocatedQty:0,completedQty:0,sourceLineType:'product'});}}
      const snap={accountCode:txt(card.customerCode||customer.accountCode),name:customerName,vatNumber:txt(meta.vatNumber||customer.vatNumber),contactPerson:txt(meta.contactPerson||customer.contactPerson),phone:txt(meta.phone||customer.phone),whatsapp:txt(meta.whatsapp||customer.whatsapp),email:txt(meta.email||customer.email),address:txt(meta.address||customer.address),deliveryAddress:txt(meta.deliveryAddress||customer.deliveryAddress||customer.address),deliveryArea:txt(meta.area||customer.deliveryArea||customer.area),preference:txt(meta.preference||customer.preference||'Delivery'),source:card.sourceFormat||'Job Card Import',capturedAt:now};
      const subtotal=existing?Number(existing.subtotal||0):orderLines.reduce((s,l)=>s+Number(l.qty||0)*Number(l.unitPrice||0),0),grandTotal=Number(card.grandTotal??existing?.grandTotal??subtotal);const order={...(existing||{id:uid('ord'),createdAt:parseDate(card.date)}),orderNumber:card.orderNumber,customerId:customer.id,customerName:customer.name,customerSnapshot:snap,customerVatNumber:snap.vatNumber,customerAddress:snap.address,customerContactPerson:snap.contactPerson,customerPhone:snap.phone,lines:orderLines,status:existing?.status||'Confirmed',dueDate:parseDate(card.dueDate),subtotal:existing?existing.subtotal:subtotal,vat:existing?existing.vat:Math.max(0,grandTotal-subtotal),deliveryFee:Number(card.deliveryFee??existing?.deliveryFee??0),grandTotal,reference:card.reference||existing?.reference||'',deliveryAddressSnapshot:snap.deliveryAddress,deliveryAddress:snap.deliveryAddress,deliveryArea:snap.deliveryArea||existing?.deliveryArea||'',area:snap.deliveryArea||existing?.area||'',deliveryContact:snap.contactPerson,deliveryPhone:snap.phone,fulfilmentType:snap.preference,preference:snap.preference,notes:existing?.notes||`Imported from job card ${card.orderNumber}.`,source:card.sourceFormat||'Job Card Import',sourceReference:card.orderNumber,customerDataImportedAt:now,readOnly:false,updatedAt:now};await putOne('orders',order);const savedOrder=await getOne('orders',order.id);if(!savedOrder?.customerSnapshot)throw new Error(`${card.orderNumber}: customer snapshot did not save.`);orderByNumber.set(code(card.orderNumber),savedOrder);if(existing)updatedOrders++;else createdOrders++;}
    pendingCards=null;closeDialog();alert(`Import verified\n\nNew customers: ${createdCustomers}\nCustomers updated: ${updatedCustomers}\nNew products: ${createdProducts}\nNew orders: ${createdOrders}\nExisting orders refreshed: ${updatedOrders}`);navigate('customers');
  }

  async function repairCustomer(customerId){
    const [customer,orders]=await Promise.all([getOne('customers',customerId),getAll('orders')]);if(!customer)return null;const linked=orders.filter(o=>o.customerId===customerId&&o.customerSnapshot).sort((a,b)=>String(b.customerDataImportedAt||b.updatedAt||'').localeCompare(String(a.customerDataImportedAt||a.updatedAt||'')));if(!linked.length)return customer;const s=linked[0].customerSnapshot,u={...customer};const fill=(f,v)=>{if(!txt(u[f])&&txt(v))u[f]=v;};fill('accountCode',s.accountCode);fill('vatNumber',s.vatNumber);fill('contactPerson',s.contactPerson);fill('phone',s.phone);fill('whatsapp',s.whatsapp||s.phone);fill('email',s.email);fill('address',s.address);fill('deliveryAddress',s.deliveryAddress);fill('primaryDeliveryAddress',s.deliveryAddress);fill('deliveryArea',s.deliveryArea);fill('area',s.deliveryArea);fill('preference',s.preference);if(JSON.stringify(u)!==JSON.stringify(customer)){u.updatedAt=new Date().toISOString();await putOne('customers',u);return u;}return customer;
  }

  async function renderPreview(){
    const [products,customers,orders]=await Promise.all([getAll('products'),getAll('customers'),getAll('orders')]),productCodes=new Set(products.map(p=>code(p.code))),orderNumbers=new Set(orders.map(o=>code(o.orderNumber)));let productLines=0;const missing=new Set();for(const c of pendingCards){for(const l of c.lines){productLines++;if(!productCodes.has(code(l.code)))missing.add(l.code);}}
    const detailCards=pendingCards.slice(0,6).map(c=>{const m=customerMeta(c);return `<div class="list-item" style="display:block"><strong>${esc(c.orderNumber)} · ${esc(c.customerName)}</strong><p class="muted">Code: ${esc(c.customerCode||'—')} · VAT: ${esc(m.vatNumber||'—')}</p><p class="muted">Contact: ${esc(m.contactPerson||'—')} · Tel: ${esc(m.phone||'—')}</p><p class="muted">Address: ${esc(m.address||'—')}</p></div>`;}).join('');
    document.getElementById('jobCardImportPreview').innerHTML=`<div class="grid two"><div class="card stat"><span class="muted">Job cards</span><strong>${pendingCards.length}</strong></div><div class="card stat"><span class="muted">Existing orders</span><strong>${pendingCards.filter(c=>orderNumbers.has(code(c.orderNumber))).length}</strong></div><div class="card stat"><span class="muted">Product lines</span><strong>${productLines}</strong></div><div class="card stat"><span class="muted">New products</span><strong>${missing.size}</strong></div></div><div class="card" style="margin-top:12px"><h3>Extracted customer information</h3>${detailCards}${pendingCards.length>6?`<p class="muted">Showing first 6 of ${pendingCards.length} job cards.</p>`:''}</div><div class="actions"><button class="primary" id="vuImportConfirm">Import / update ${pendingCards.length} job cards</button><button class="secondary" onclick="closeDialog()">Cancel</button></div>`;document.getElementById('vuImportConfirm').onclick=()=>importCards().catch(e=>alert(`Import stopped\n\n${e.message||e}`));
  }

  async function openImporter(){
    openDialog(`<div class="dialog-head"><div><h2>Import Sage job cards</h2><p class="muted">Import Sage PDFs directly or use JSON backup files.</p></div><button class="close-btn" onclick="closeDialog()">×</button></div><div class="card"><label>Select Sage PDF or JSON file(s)<input id="vuJobCardFiles" type="file" accept="application/pdf,.pdf,application/json,.json" multiple></label><p class="muted">The preview below shows the exact customer information extracted before anything is saved.</p></div><div id="vuImportStatus" class="card hidden" style="margin-top:12px"></div><div id="jobCardImportPreview" style="margin-top:12px"></div>`);
    document.getElementById('vuJobCardFiles').onchange=async e=>{const files=[...(e.target.files||[])];if(!files.length)return;const status=document.getElementById('vuImportStatus');try{status.classList.remove('hidden');status.innerHTML='<strong>Reading files…</strong>';let cards=[];const pdfs=files.filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf'),jsons=files.filter(f=>/\.json$/i.test(f.name)||f.type==='application/json');if(pdfs.length)cards.push(...await parsePdfFiles(pdfs));for(const f of jsons){const parsed=JSON.parse(await readText(f));cards.push(...validate(parsed));}const byOrder=new Map();for(const c of cards)byOrder.set(code(c.orderNumber),c);pendingCards=validate([...byOrder.values()]);status.innerHTML=`<strong>${pendingCards.length} job cards read</strong><p class="muted">Check the extracted customer details below before importing.</p>`;await renderPreview();}catch(err){pendingCards=null;status.classList.remove('hidden');status.innerHTML=`<strong>Import file could not be read</strong><p>${esc(err.message||err)}</p>`;document.getElementById('jobCardImportPreview').innerHTML='';}};
  }

  const baseSettings=settingsPage;settingsPage=async function(...args){await baseSettings(...args);if(document.querySelector('.job-card-import-panel-v9'))return;const panel=document.createElement('section');panel.className='card job-card-import-panel-v9';panel.style.marginTop='12px';panel.innerHTML='<div class="section-head"><div><h2>Import business data</h2><p class="muted">Import or refresh Sage job cards directly from PDF.</p></div><span class="badge">PDF Ready</span></div><div class="actions"><button class="primary" id="vuOpenImporter">Import job cards</button></div>';main.prepend(panel);document.getElementById('vuOpenImporter').onclick=openImporter;};

  const baseForm=showCustomerForm;showCustomerForm=async function(id=''){if(id)await repairCustomer(id);return baseForm(id);};
  const baseView=viewCustomer;viewCustomer=async function(id){if(id)await repairCustomer(id);return baseView(id);};
  window.openJobCardImport=openImporter;window.commitJobCardImport=importCards;window.parseSagePdfFiles=parsePdfFiles;window.repairCustomerFromOrders=repairCustomer;
})();