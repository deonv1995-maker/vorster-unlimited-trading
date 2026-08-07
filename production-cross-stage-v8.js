/* Version 8.6.3 cross-stage production view.
   Every open order remains visible in Production, Finishing and Delivery as current or forecast work. */
const VU_CROSS_STAGE_VERSION='8.6.3';

function vuCrossStageEta(row){
  if(!row.etaKnown)return 'Capacity needed';
  return row.estimatedDate?dateText(`${row.estimatedDate}T12:00:00`):'Calculating';
}

function vuIncomingFinishingCard(row){
  const remaining=row.lines.reduce((sum,line)=>sum+Number(line.remainingToMake||0),0);
  return `<section class="card workflow-order vu-job-card forecast">
    <div class="workflow-order-head"><div><small>Incoming · Priority ${row.priority} · ${esc(row.order.orderNumber||'Order')}</small><h3>${esc(row.order.customerName||'Customer')}</h3></div><span class="workflow-badge">Predicted ${esc(vuCrossStageEta(row))}</span></div>
    <div class="workflow-line"><span>Current stage</span><strong>${esc(row.currentStage)}</strong></div>
    <div class="workflow-line"><span>Raw coverage</span><strong>${Math.round(row.coverage*100)}%</strong></div>
    <div class="workflow-line"><span>Still to manufacture</span><strong>${remaining}</strong></div>
    <p class="muted">This order is not physically in finishing yet. It remains visible here so the finishing workload can be planned ahead.</p>
  </section>`;
}

function vuDeliveryForecastCard(row){
  const ready=row.currentStage==='Delivery';
  return `<section class="card workflow-order vu-job-card ${ready?'':'forecast'}">
    <div class="workflow-order-head"><div><small>${ready?'Ready':'Forecast'} · Priority ${row.priority} · ${esc(row.order.orderNumber||'Order')}</small><h3>${esc(row.order.customerName||'Customer')}</h3></div><span class="workflow-badge">${ready?'Ready for '+esc(row.fulfilment):'ETA '+esc(vuCrossStageEta(row))}</span></div>
    <div class="workflow-line"><span>Fulfilment</span><strong>${esc(row.fulfilment)}</strong></div>
    <div class="workflow-line"><span>Area</span><strong>${esc(row.area)}</strong></div>
    <div class="workflow-line"><span>Current stage</span><strong>${esc(row.currentStage)}</strong></div>
    <div class="workflow-line"><span>Estimated ${row.fulfilment.toLowerCase()} date</span><strong>${esc(vuCrossStageEta(row))}</strong></div>
    <div class="workflow-line"><span>Order value</span><strong>${money(row.order.grandTotal||0)}</strong></div>
    ${ready?`<div class="workflow-actions"><button onclick="viewOrder('${row.order.id}')">Order details</button></div>`:'<p class="muted">Forecast only — this order remains upstream but is included in delivery planning.</p>'}
  </section>`;
}

function vuCalendarKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function vuMonthLabel(date){return new Intl.DateTimeFormat('en-ZA',{month:'long',year:'numeric'}).format(date);}
function vuCalendarMonthRows(rows,monthDate){
  const first=new Date(monthDate.getFullYear(),monthDate.getMonth(),1);
  const last=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0);
  const startOffset=(first.getDay()+6)%7; // Monday first
  const cells=[];
  for(let i=0;i<startOffset;i++)cells.push(null);
  for(let d=1;d<=last.getDate();d++)cells.push(new Date(monthDate.getFullYear(),monthDate.getMonth(),d));
  while(cells.length%7)cells.push(null);
  const byDate=new Map();
  rows.forEach(row=>{
    if(!row.estimatedDate)return;
    if(!byDate.has(row.estimatedDate))byDate.set(row.estimatedDate,[]);
    byDate.get(row.estimatedDate).push(row);
  });
  return {cells,byDate};
}

function vuRenderDeliveryCalendar(rows,monthDate,selectedDate){
  const body=document.getElementById('vuCrossStageBody');
  const {cells,byDate}=vuCalendarMonthRows(rows,monthDate);
  const knownRows=rows.filter(row=>row.estimatedDate);
  const unknownRows=rows.filter(row=>!row.estimatedDate);
  const monthRows=knownRows.filter(row=>{const d=new Date(`${row.estimatedDate}T12:00:00`);return d.getFullYear()===monthDate.getFullYear()&&d.getMonth()===monthDate.getMonth();});
  const monthValue=monthRows.reduce((sum,row)=>sum+Number(row.order.grandTotal||0),0);
  const today=vuCalendarKey(new Date());
  const chosen=selectedDate||today;
  const chosenRows=byDate.get(chosen)||[];

  body.innerHTML=`
    <section class="card vu-delivery-calendar-head">
      <div><div class="step-label">Delivery & collection forecast</div><h2>${esc(vuMonthLabel(monthDate))}</h2><p class="muted">${monthRows.length} forecast order${monthRows.length===1?'':'s'} · ${money(monthValue)} planned value</p></div>
      <div class="vu-calendar-nav"><button id="vuPrevMonth" aria-label="Previous month">←</button><button id="vuTodayMonth">Today</button><button id="vuNextMonth" aria-label="Next month">→</button></div>
    </section>
    <section class="card vu-delivery-calendar">
      <div class="vu-calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`<div>${day}</div>`).join('')}</div>
      <div class="vu-calendar-grid">${cells.map(date=>{
        if(!date)return '<div class="vu-calendar-cell empty-cell"></div>';
        const key=vuCalendarKey(date),dayRows=byDate.get(key)||[];
        const value=dayRows.reduce((sum,row)=>sum+Number(row.order.grandTotal||0),0);
        const areas=[...new Set(dayRows.map(row=>row.area).filter(Boolean))];
        return `<button class="vu-calendar-cell ${key===today?'today':''} ${key===chosen?'selected':''}" data-vu-date="${key}">
          <span class="vu-calendar-day">${date.getDate()}</span>
          ${dayRows.length?`<span class="vu-calendar-count">${dayRows.length}</span><small>${money(value)}</small>${areas.length?`<em>${esc(areas.slice(0,2).join(' · '))}</em>`:''}`:''}
        </button>`;
      }).join('')}</div>
    </section>
    <section class="card"><h2>${chosenRows.length?dateText(`${chosen}T12:00:00`):'Select a day'}</h2><p class="muted">${chosenRows.length?`${chosenRows.length} order${chosenRows.length===1?'':'s'} planned for this date.`:'Tap a calendar day to see the planned deliveries and collections.'}</p></section>
    ${chosenRows.map(vuDeliveryForecastCard).join('')}
    ${unknownRows.length?`<section class="card"><h2>Dates still unknown</h2><p class="muted">${unknownRows.length} order${unknownRows.length===1?'':'s'} cannot yet receive a reliable date because production information is incomplete.</p></section>${unknownRows.map(vuDeliveryForecastCard).join('')}`:''}`;

  document.getElementById('vuPrevMonth').onclick=()=>vuRenderDeliveryCalendar(rows,new Date(monthDate.getFullYear(),monthDate.getMonth()-1,1),null);
  document.getElementById('vuNextMonth').onclick=()=>vuRenderDeliveryCalendar(rows,new Date(monthDate.getFullYear(),monthDate.getMonth()+1,1),null);
  document.getElementById('vuTodayMonth').onclick=()=>vuRenderDeliveryCalendar(rows,new Date(),today);
  document.querySelectorAll('[data-vu-date]').forEach(button=>button.onclick=()=>vuRenderDeliveryCalendar(rows,monthDate,button.dataset.vuDate));
}

productionPage=async function productionCrossStageV863(){
  const [plan,forecast]=await Promise.all([buildOptimizedOrderJobs(),buildPipelineForecast()]);
  pageTitle.textContent='Production';backBtn.classList.add('hidden');

  const byOrder=new Map(plan.jobs.map(job=>[job.order.id,job]));
  const productionRows=forecast.rows.filter(row=>row.currentStage==='Production'||row.currentStage==='Finishing & Painting');
  const currentFinishing=forecast.rows.filter(row=>row.currentStage==='Finishing & Painting');
  const incomingFinishing=forecast.rows.filter(row=>row.currentStage==='Production');
  const deliveryRows=forecast.rows;
  const readyDelivery=deliveryRows.filter(row=>row.currentStage==='Delivery').length;

  main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Factory workflow & forecast</div><h2>${forecast.rows.length} open order${forecast.rows.length===1?'':'s'}</h2><p class="muted">The same orders stay visible through all three stages. The highlighted stage is where the physical work is now; later stages show forecast workload and ETA.</p></div></div><label>Daily invoice target<input id="vuInvoiceTarget" type="number" min="0" step="100" value="${plan.target}"></label><button id="vuSaveInvoiceTarget" class="primary">Save target & recalculate queue</button></section>
  <div class="workflow-summary"><div><small>Production</small><strong>${productionRows.length}</strong></div><div><small>Finishing forecast</small><strong>${forecast.rows.length}</strong></div><div><small>Delivery forecast</small><strong>${forecast.rows.length}</strong></div><div><small>Ready for delivery</small><strong>${readyDelivery}</strong></div></div>
  <div class="workflow-tabs"><button class="workflow-tab active" data-vu-cross="production">Production checklist</button><button class="workflow-tab" data-vu-cross="finishing">Finishing & Painting</button><button class="workflow-tab" data-vu-cross="delivery">Delivery calendar</button></div><div id="vuCrossStageBody"></div>`;

  document.getElementById('vuSaveInvoiceTarget').onclick=()=>{vuSetDailyInvoiceTarget(document.getElementById('vuInvoiceTarget').value);productionPage();};

  const render=tab=>{
    document.querySelectorAll('.workflow-tab').forEach(button=>button.classList.toggle('active',button.dataset.vuCross===tab));
    const body=document.getElementById('vuCrossStageBody');
    if(tab==='production'){
      body.innerHTML=productionRows.map(row=>{const job=byOrder.get(row.order.id);if(job&&!job.order.rawIssued)return vuChecklistJobCard(job);return `<section class="card workflow-order"><small>${esc(row.order.orderNumber||'Order')}</small><h3>${esc(row.order.customerName||'Customer')}</h3><p class="muted">Production complete. This order has advanced to ${esc(row.currentStage)} and remains here for overall job visibility.</p></section>`;}).join('')||'<section class="card"><p>No open production work.</p></section>';
      return;
    }
    if(tab==='finishing'){
      body.innerHTML=`<section class="card"><h2>Current finishing jobs</h2><p class="muted">${currentFinishing.length} physically in finishing · ${incomingFinishing.length} incoming from production</p></section>${currentFinishing.map((row,index)=>vuFinishingCard(row.order,index+1)).join('')||'<section class="card"><p>No orders physically in finishing yet.</p></section>'}<section class="card"><h2>Incoming finishing workload</h2><p class="muted">These orders are still in production but are already part of the finishing target.</p></section>${incomingFinishing.map(vuIncomingFinishingCard).join('')||'<section class="card"><p>No incoming production orders.</p></section>'}`;
      return;
    }
    const dated=deliveryRows.filter(row=>row.estimatedDate).map(row=>row.estimatedDate).sort();
    const start=dated.length?new Date(`${dated[0]}T12:00:00`):new Date();
    vuRenderDeliveryCalendar(deliveryRows,start,dated[0]||vuCalendarKey(new Date()));
  };

  document.querySelectorAll('.workflow-tab').forEach(button=>button.onclick=()=>render(button.dataset.vuCross));
  render('production');window.scrollTo({top:0,behavior:'smooth'});
};
