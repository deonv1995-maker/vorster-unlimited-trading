/* Version 8.7.0 — manager-generated daily work packs.
   Uses the existing production schedule + pipeline forecast as the only planning sources.
   Printing uses the browser print dialog so Android can Print or Save as PDF without a new PDF dependency. */
(function(){
  const VERSION='8.7.0';
  const escHtml=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const n=v=>Math.max(0,Number(v||0));
  const moneySafe=v=>typeof money==='function'?money(v):`R ${Number(v||0).toFixed(2)}`;
  const dateKey=value=>{
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
    const d=new Date(value||Date.now());
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const displayDate=value=>new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${dateKey(value)}T12:00:00`));
  const isProductLine=line=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(line);
  const lineColour=line=>line?.colour?.name||line?.colourName||'Standard';
  const lineCode=line=>line?.productCode||line?.code||'';
  const lineName=line=>line?.productName||line?.name||'';
  const addressFor=(order,customer)=>order?.deliveryAddressSnapshot||order?.deliveryAddress||customer?.primaryDeliveryAddress||customer?.deliveryAddress||customer?.address||'';
  const contactFor=(order,customer)=>order?.deliveryContact||customer?.contactPerson||'';
  const phoneFor=(order,customer)=>order?.deliveryPhone||customer?.phone||customer?.whatsapp||'';

  function addWorkingDays(value,days){
    const d=new Date(value||Date.now());
    let left=Math.max(0,Math.ceil(Number(days||0)));
    while(left>0){d.setDate(d.getDate()+1);if(![0,6].includes(d.getDay()))left--;}
    return d;
  }

  async function buildDailyPackData(selectedDate){
    const key=dateKey(selectedDate);
    const [schedule,forecast,deliveries,orders,customers]=await Promise.all([
      typeof buildOrderCompletionSchedule==='function'?buildOrderCompletionSchedule():Promise.resolve({days:[],orders:[]}),
      typeof buildPipelineForecast==='function'?buildPipelineForecast():Promise.resolve({rows:[]}),
      getAll('deliveries'),getAll('orders'),getAll('customers')
    ]);
    const customerById=new Map(customers.map(c=>[c.id,c]));
    const orderById=new Map(orders.map(o=>[o.id,o]));
    const orderByNumber=new Map(orders.map(o=>[String(o.orderNumber||'').toUpperCase(),o]));

    const scheduleDay=(schedule.days||[]).find(day=>day.date===key);
    const productionByOrder=new Map();
    for(const item of (scheduleDay?.items||[])){
      const order=orderById.get(item.orderId)||orderByNumber.get(String(item.orderNumber||'').toUpperCase());
      const id=order?.id||item.orderId||item.orderNumber;
      if(!productionByOrder.has(id))productionByOrder.set(id,{order,orderNumber:item.orderNumber,customerName:item.customerName,items:[]});
      productionByOrder.get(id).items.push(item);
    }
    const production=[...productionByOrder.values()];

    const today=dateKey(new Date());
    const finishing=[];
    for(const row of (forecast.rows||[])){
      let include=false;
      let label='Current finishing';
      if(row.currentStage==='Finishing & Painting')include=true;
      else if(row.currentStage==='Production'&&row.etaKnown&&row.productionDays!==null){
        const readyKey=dateKey(addWorkingDays(new Date(`${today}T08:00:00`),row.productionDays||0));
        if(readyKey===key){include=true;label='Incoming forecast';}
      }
      if(include)finishing.push({...row,workPackLabel:label});
    }

    const deliveryMap=new Map();
    for(const row of (forecast.rows||[])){
      if(row.estimatedDate!==key)continue;
      deliveryMap.set(row.order.id,{order:row.order,customer:row.customer||customerById.get(row.order.customerId),fulfilment:row.fulfilment||'Delivery',area:row.area||'',stage:row.currentStage,forecast:true});
    }
    for(const delivery of deliveries.filter(d=>dateKey(d.deliveryDate)===key&&!['Delivered','Cancelled'].includes(d.status))){
      const order=orderById.get(delivery.orderId)||orderByNumber.get(String(delivery.orderNumber||'').toUpperCase());
      if(!order)continue;
      deliveryMap.set(order.id,{order,customer:customerById.get(order.customerId),fulfilment:order.fulfilmentType||order.preference||'Delivery',area:order.deliveryArea||order.area||'',stage:'Scheduled',deliveryRecord:delivery,forecast:false});
    }
    const delivery=[...deliveryMap.values()].sort((a,b)=>String(a.area||'').localeCompare(String(b.area||''))||String(a.order.customerName||'').localeCompare(String(b.order.customerName||'')));

    return{date:key,schedule,forecast,production,finishing,delivery};
  }

  function checkbox(){return '<span class="print-check"></span>';}
  function productLinesHtml(lines,mode){
    const productLines=(lines||[]).filter(line=>n(line.qty)>0&&isProductLine(line));
    if(!productLines.length)return '<p class="print-muted">No product lines.</p>';
    return `<table class="print-table"><thead><tr><th></th><th>Code / item</th><th>Colour</th><th class="num">Qty</th>${mode==='finishing'?'<th class="num">Done</th>':''}</tr></thead><tbody>${productLines.map(line=>`<tr><td>${checkbox()}</td><td><strong>${escHtml(lineCode(line))}</strong><br><span>${escHtml(lineName(line))}</span></td><td>${escHtml(lineColour(line))}</td><td class="num">${n(line.qty)}</td>${mode==='finishing'?'<td class="write-box"></td>':''}</tr>`).join('')}</tbody></table>`;
  }

  function productionSection(data){
    const total=(data.production||[]).reduce((sum,job)=>sum+job.items.reduce((s,i)=>s+n(i.quantity),0),0);
    return `<section class="print-sheet"><header class="print-head"><div><h1>Production Worksheet</h1><p>${escHtml(displayDate(data.date))}</p></div><div class="print-kpi"><strong>${total}</strong><span>units planned</span></div></header>
      <div class="print-note">Tick each line as the planned quantity is produced. Write actual quantity if it differs from plan.</div>
      ${(data.production||[]).map((job,index)=>`<article class="print-job"><div class="print-job-head"><div><small>Job ${index+1}</small><h2>${escHtml(job.orderNumber||job.order?.orderNumber||'Order')} · ${escHtml(job.customerName||job.order?.customerName||'Customer')}</h2></div><div>Completed ${checkbox()}</div></div>
        <table class="print-table"><thead><tr><th></th><th>Code / item</th><th>Finish</th><th class="num">Plan</th><th class="num">Actual</th><th class="num">Capacity/day</th></tr></thead><tbody>${job.items.map(item=>`<tr><td>${checkbox()}</td><td><strong>${escHtml(item.productCode)}</strong><br>${escHtml(item.productName)}</td><td>${escHtml(item.colourName||'Standard')}</td><td class="num">${n(item.quantity)}</td><td class="write-box"></td><td class="num">${n(item.dailyCapacity)}</td></tr>`).join('')}</tbody></table>
        <div class="print-sign">Notes: <span></span></div></article>`).join('')||'<div class="print-empty">No manufacturing is scheduled for this day.</div>'}
      <footer class="print-footer">Production supervisor: ____________________ &nbsp;&nbsp; Completed: __________</footer></section>`;
  }

  function finishingSection(data){
    return `<section class="print-sheet"><header class="print-head"><div><h1>Finishing & Painting Worksheet</h1><p>${escHtml(displayDate(data.date))}</p></div><div class="print-kpi"><strong>${data.finishing.length}</strong><span>orders</span></div></header>
      <div class="print-note">Work order-by-order. Tick each product after finishing/painting is complete. Colour remains an instruction; raw stock is not colour-specific.</div>
      ${data.finishing.map((row,index)=>`<article class="print-job"><div class="print-job-head"><div><small>${escHtml(row.workPackLabel)} · Priority ${row.priority||index+1}</small><h2>${escHtml(row.order.orderNumber||'Order')} · ${escHtml(row.order.customerName||'Customer')}</h2></div><div>Order done ${checkbox()}</div></div>
        ${productLinesHtml(row.order.lines,'finishing')}
        <div class="print-sign">Finishing notes / colour confirmation: <span></span></div></article>`).join('')||'<div class="print-empty">No finishing work is planned for this day.</div>'}
      <footer class="print-footer">Finishing supervisor: ____________________ &nbsp;&nbsp; Completed: __________</footer></section>`;
  }

  function deliverySection(data){
    const value=data.delivery.reduce((sum,row)=>sum+n(row.order.grandTotal),0);
    return `<section class="print-sheet"><header class="print-head"><div><h1>Delivery & Collection Schedule</h1><p>${escHtml(displayDate(data.date))}</p></div><div class="print-kpi"><strong>${data.delivery.length}</strong><span>stops · ${escHtml(moneySafe(value))}</span></div></header>
      <div class="print-note">Load and check every product before departure. Delivery addresses come from the order snapshot first, then the saved customer record.</div>
      ${data.delivery.map((row,index)=>{const order=row.order,customer=row.customer||{};const fulfil=/collect/i.test(row.fulfilment||'')?'Collection':'Delivery';return `<article class="print-job"><div class="print-job-head"><div><small>Stop ${index+1} · ${escHtml(fulfil)} · ${escHtml(row.area||'Area not set')}</small><h2>${escHtml(order.orderNumber||'Order')} · ${escHtml(order.customerName||customer.name||'Customer')}</h2></div><div>${checkbox()} Done</div></div>
        <div class="print-address"><strong>${escHtml(addressFor(order,customer)|| (fulfil==='Collection'?'Customer collection':'Address not captured'))}</strong>${contactFor(order,customer)?`<br>${escHtml(contactFor(order,customer))}`:''}${phoneFor(order,customer)?` · ${escHtml(phoneFor(order,customer))}`:''}</div>
        ${productLinesHtml(order.lines,'delivery')}
        <div class="print-delivery-meta"><span>Order value: <strong>${escHtml(moneySafe(order.grandTotal||0))}</strong></span><span>Driver: ____________________</span></div>
        <div class="print-sign">Customer signature / POD: <span></span></div></article>`;}).join('')||'<div class="print-empty">No deliveries or collections are planned for this day.</div>'}
      <footer class="print-footer">Vehicle: ____________________ &nbsp;&nbsp; Driver: ____________________ &nbsp;&nbsp; Departed: __________</footer></section>`;
  }

  function printableDocument(title,body){
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title><style>
      @page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:11px;background:#fff}.print-sheet{page-break-after:always}.print-sheet:last-child{page-break-after:auto}.print-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}.print-head h1{font-size:22px;margin:0 0 4px}.print-head p{margin:0}.print-kpi{text-align:right}.print-kpi strong{display:block;font-size:20px}.print-kpi span{font-size:10px}.print-note{border:1px solid #999;padding:7px;margin:0 0 10px;background:#f5f5f5}.print-job{border:1.5px solid #333;padding:8px;margin:0 0 10px;break-inside:avoid}.print-job-head{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #bbb;padding-bottom:6px;margin-bottom:6px}.print-job-head h2{font-size:14px;margin:2px 0}.print-job-head small{font-size:9px}.print-table{width:100%;border-collapse:collapse;margin-top:5px}.print-table th,.print-table td{border:1px solid #aaa;padding:5px;text-align:left;vertical-align:middle}.print-table th{background:#eee}.print-table .num{text-align:center;width:60px}.print-check{display:inline-block;width:14px;height:14px;border:1.5px solid #111;vertical-align:middle}.write-box{min-width:48px;height:25px}.print-sign{display:flex;gap:5px;margin-top:8px;min-height:24px;align-items:flex-end}.print-sign span{flex:1;border-bottom:1px solid #555;height:20px}.print-address{padding:5px 0 7px}.print-delivery-meta{display:flex;justify-content:space-between;margin-top:7px}.print-footer{border-top:1px solid #111;padding-top:8px;margin-top:12px}.print-muted{color:#555}.print-empty{border:1px dashed #999;padding:18px;text-align:center}.print-toolbar{position:sticky;top:0;background:white;border-bottom:1px solid #ccc;padding:8px;text-align:center;margin-bottom:8px}.print-toolbar button{font-size:16px;padding:10px 18px}.screen-only{display:block}@media print{.screen-only{display:none}.print-toolbar{display:none}body{font-size:10px}.print-job{break-inside:avoid}}
    </style></head><body><div class="print-toolbar screen-only"><button onclick="window.print()">Print / Save PDF</button></div>${body}</body></html>`;
  }

  function openPrintDocument(title,html){
    const w=window.open('','_blank');
    if(!w){alert('Your browser blocked the print window. Allow pop-ups for this site and try again.');return;}
    w.document.open();w.document.write(printableDocument(title,html));w.document.close();
    setTimeout(()=>{try{w.focus();w.print();}catch(_){ }},350);
  }

  async function openDailyWorkPacks(selectedDate){
    const key=dateKey(selectedDate||new Date());
    const data=await buildDailyPackData(key);
    pageTitle.textContent='Daily Work Packs';backBtn.classList.remove('hidden');navState('');
    main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Manager print centre</div><h2>Daily factory pack</h2><p class="muted">Generate the paper worksheets for each team from the live production pipeline.</p></div></div>
      <label>Work date<input id="vuWorkPackDate" type="date" value="${key}"></label><div class="actions"><button id="vuRefreshWorkPack" class="secondary">Load date</button><button id="vuPrintAllPacks" class="primary">Print all / Save one PDF</button></div></section>
      <div class="grid two vu-pack-summary"><div class="card stat"><span class="muted">Production jobs</span><strong>${data.production.length}</strong><small>${data.production.reduce((s,j)=>s+j.items.reduce((x,i)=>x+n(i.quantity),0),0)} units</small></div><div class="card stat"><span class="muted">Finishing jobs</span><strong>${data.finishing.length}</strong></div><div class="card stat"><span class="muted">Delivery / collection</span><strong>${data.delivery.length}</strong></div><div class="card stat"><span class="muted">Planned invoice value</span><strong>${moneySafe(data.delivery.reduce((s,r)=>s+n(r.order.grandTotal),0))}</strong></div></div>
      <section class="card vu-pack-card"><h2>1. Production</h2><p class="muted">Daily quantities by job and product, with planned/actual columns and check boxes.</p><button class="primary" id="vuPrintProduction">Print Production worksheet</button></section>
      <section class="card vu-pack-card"><h2>2. Finishing & Painting</h2><p class="muted">Order-by-order finishing checklist with product colour instructions.</p><button class="primary" id="vuPrintFinishing">Print Finishing worksheet</button></section>
      <section class="card vu-pack-card"><h2>3. Delivery & Collection</h2><p class="muted">Driver sheet with stops, addresses, contact details, loading checklist and POD/signature space.</p><button class="primary" id="vuPrintDelivery">Print Driver schedule</button></section>`;
    document.getElementById('vuRefreshWorkPack').onclick=()=>openDailyWorkPacks(document.getElementById('vuWorkPackDate').value);
    document.getElementById('vuPrintProduction').onclick=()=>openPrintDocument(`Production ${key}`,productionSection(data));
    document.getElementById('vuPrintFinishing').onclick=()=>openPrintDocument(`Finishing ${key}`,finishingSection(data));
    document.getElementById('vuPrintDelivery').onclick=()=>openPrintDocument(`Deliveries ${key}`,deliverySection(data));
    document.getElementById('vuPrintAllPacks').onclick=()=>openPrintDocument(`Vorster Daily Factory Pack ${key}`,productionSection(data)+finishingSection(data)+deliverySection(data));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const baseDashboard=window.dashboard;
  if(typeof baseDashboard==='function'){
    window.dashboard=async function(){
      await baseDashboard();
      if(document.getElementById('vuDailyWorkPackCard'))return;
      const card=document.createElement('section');card.id='vuDailyWorkPackCard';card.className='card';
      card.innerHTML=`<div class="section-head"><div><div class="step-label">Daily handover</div><h2>Factory work packs</h2><p class="muted">Print today's Production, Finishing and Driver worksheets.</p></div><span class="badge">PDF / Print</span></div><button class="primary" id="vuOpenDailyWorkPacks">Open daily work packs</button>`;
      main.prepend(card);document.getElementById('vuOpenDailyWorkPacks').onclick=()=>openDailyWorkPacks(new Date());
    };
  }

  const baseProductionPage=window.productionPage;
  if(typeof baseProductionPage==='function'){
    window.productionPage=async function(){
      await baseProductionPage();
      if(document.getElementById('vuProductionPackBtn'))return;
      const first=main.querySelector('.card');if(!first)return;
      const btn=document.createElement('button');btn.id='vuProductionPackBtn';btn.className='secondary';btn.textContent='Print daily work packs';btn.onclick=()=>openDailyWorkPacks(new Date());first.appendChild(btn);
    };
  }

  window.buildDailyPackData=buildDailyPackData;
  window.openDailyWorkPacks=openDailyWorkPacks;
  window.VU_DAILY_WORK_PACK_VERSION=VERSION;
})();