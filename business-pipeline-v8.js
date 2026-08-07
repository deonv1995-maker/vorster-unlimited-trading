/* Version 8.3 business pipeline.
   One commercial document lifecycle:
   Quote -> Orders & Production -> Finishing & Painting -> Delivery.
   The same order record carries checklist state across factory stages. */
const VU_PIPELINE_VERSION='8.3.0';

const vuClosedFactoryStatuses=new Set(['draft','cancelled','completed','delivered','collected','invoiced']);
const vuQuoteClosedStatuses=new Set(['converted','declined','expired','cancelled']);
const vuText=v=>String(v||'').trim();
const vuLower=v=>vuText(v).toLowerCase();

function vuIsFactoryOrder(order){
  const status=vuLower(order.status);
  return !vuClosedFactoryStatuses.has(status)&&(order.lines||[]).some(line=>Number(line.qty||0)>0);
}
function vuIsFinishingOrder(order){
  return vuIsFactoryOrder(order)&&order.rawIssued===true&&order.finishingStatus!=='Completed'&&!['delivery','delivery-scheduled'].includes(order.workflowStage);
}
function vuIsDeliveryOrder(order){
  return vuIsFactoryOrder(order)&&(order.finishingStatus==='Completed'||['delivery','delivery-scheduled'].includes(order.workflowStage));
}
function vuQuoteAttention(quote){
  const status=vuLower(quote.status);
  const created=new Date(quote.createdAt||quote.date||Date.now());
  const age=Math.max(0,Math.floor((Date.now()-created.getTime())/86400000));
  if(status==='draft')return{level:'attention',label:'Needs sending',detail:'Quote has not been sent yet'};
  if(status==='sent'&&age>=3)return{level:'attention',label:'Follow up',detail:`Sent ${age} days ago — confirm customer received it`};
  if(status==='sent')return{level:'ok',label:'Sent',detail:'Waiting for customer response'};
  if(['received','viewed'].includes(status))return{level:'ok',label:'Received by customer',detail:'Customer has received the quote'};
  if(status==='accepted')return{level:'attention',label:'Accepted — convert',detail:'Ready to become a production order'};
  if(vuQuoteClosedStatuses.has(status))return{level:'closed',label:quote.status||'Closed',detail:'No action required'};
  return{level:'ok',label:quote.status||'Open',detail:'Open quote'};
}

function vuFinishingChecklist(order){
  const current=order.finishingChecklist&&typeof order.finishingChecklist==='object'?order.finishingChecklist:{};
  return{version:VU_PIPELINE_VERSION,startedAt:current.startedAt||null,updatedAt:current.updatedAt||null,lines:{...(current.lines||{})}};
}
function vuFinishLineKey(line,index){return String(line.id||line.lineId||`${line.productId||line.productCode||'product'}::${index}`)}
function vuFinishedQty(order,line,index){return Math.max(0,Number(vuFinishingChecklist(order).lines[vuFinishLineKey(line,index)]?.finishedQty||0))}

async function vuSaveFinishedQty(orderId,lineIndex,newQty){
  const order=await getOne('orders',orderId);if(!order)return;
  const line=(order.lines||[])[lineIndex];if(!line)return;
  const required=Math.max(0,Number(line.qty||0));
  const qty=Math.max(0,Math.min(required,Math.round(Number(newQty||0))));
  const checklist=vuFinishingChecklist(order);const now=new Date().toISOString();const key=vuFinishLineKey(line,lineIndex);
  checklist.startedAt=checklist.startedAt||now;checklist.updatedAt=now;
  checklist.lines[key]={...(checklist.lines[key]||{}),finishedQty:qty,updatedAt:now};
  await putOne('orders',{...order,finishingChecklist:checklist,workflowStage:'finishing',finishingStatus:'In Progress',finishingStartedAt:order.finishingStartedAt||now,updatedAt:now});
  notify(`${line.productCode||line.productName||'Item'}: ${qty} finished`);
  await finishingPaintingPage();
}
async function vuAddFinishedQty(orderId,lineIndex,delta){
  const order=await getOne('orders',orderId);if(!order)return;const line=(order.lines||[])[lineIndex];if(!line)return;
  await vuSaveFinishedQty(orderId,lineIndex,vuFinishedQty(order,line,lineIndex)+Number(delta||0));
}
async function vuCompleteFinishingLine(orderId,lineIndex){
  const order=await getOne('orders',orderId);if(!order)return;const line=(order.lines||[])[lineIndex];if(!line)return;
  await vuSaveFinishedQty(orderId,lineIndex,Number(line.qty||0));
}
async function vuMoveFinishedOrderToDelivery(orderId){
  const order=await getOne('orders',orderId);if(!order)return;
  const incomplete=(order.lines||[]).some((line,index)=>vuFinishedQty(order,line,index)<Number(line.qty||0));
  if(incomplete){alert('Finish every product line before moving this order to delivery planning.');return;}
  const now=new Date().toISOString();
  await putOne('orders',{...order,finishingStatus:'Completed',workflowStage:'delivery',finishingCompletedAt:order.finishingCompletedAt||now,updatedAt:now});
  notify('Finishing complete — order moved to delivery planning');
  await finishingPaintingPage();
}

function vuFinishingLineHtml(order,line,index){
  const required=Math.max(0,Number(line.qty||0));const done=vuFinishedQty(order,line,index);const remaining=Math.max(0,required-done);const complete=remaining===0;
  const colour=line?.colour?.name||line.colourName||'Standard';
  return `<div class="vu-check-line ${complete?'done':''}">
    <button class="vu-check-box" onclick="vuCompleteFinishingLine('${order.id}',${index})">${complete?'✓':'○'}</button>
    <div class="vu-check-main"><strong>${esc(line.productCode||line.productName||'Product')}</strong><small>${esc(colour)} · ${required} required · ${done} finished · ${remaining} remaining</small></div>
    <div class="vu-check-controls"><button onclick="vuAddFinishedQty('${order.id}',${index},-1)" ${done<=0?'disabled':''}>−</button><strong>${done}</strong><button onclick="vuAddFinishedQty('${order.id}',${index},1)" ${remaining<=0?'disabled':''}>+</button></div>
  </div>`;
}
function vuFinishingCard(order,priority){
  const lines=order.lines||[];const doneCount=lines.filter((line,index)=>vuFinishedQty(order,line,index)>=Number(line.qty||0)).length;const complete=doneCount===lines.length;const progress=lines.length?Math.round(doneCount/lines.length*100):100;
  return `<section class="card workflow-order vu-job-card"><div class="workflow-order-head"><div><small>Finishing job ${priority} · ${esc(order.orderNumber||'Order')}</small><h3>${esc(order.customerName||'Customer')}</h3></div><span class="workflow-badge">${complete?'Ready for delivery':'Finishing & painting'}</span></div><div class="vu-progress"><div style="width:${progress}%"></div></div><small>${doneCount} of ${lines.length} product lines finished · ${progress}%</small><div class="vu-checklist">${lines.map((line,index)=>vuFinishingLineHtml(order,line,index)).join('')}</div><div class="workflow-actions">${complete?`<button class="primary" onclick="vuMoveFinishedOrderToDelivery('${order.id}')">Finishing complete → Delivery</button>`:''}<button onclick="viewOrder('${order.id}')">Order details</button></div></section>`;
}

async function finishingPaintingPage(){
  const orders=(await getAll('orders')).filter(vuIsFinishingOrder);
  orders.sort((a,b)=>new Date(a.finishingStartedAt||a.updatedAt||a.createdAt)-new Date(b.finishingStartedAt||b.updatedAt||b.createdAt));
  pageTitle.textContent='Finishing & Painting';backBtn.classList.add('hidden');navState('');
  main.innerHTML=`<section class="card"><div class="section-head"><div><div class="step-label">Stage 2</div><h2>${orders.length} finishing job${orders.length===1?'':'s'}</h2><p class="muted">The same order checklist continues here. Tick each product as painting and finishing is completed.</p></div></div></section>${orders.map((order,index)=>vuFinishingCard(order,index+1)).join('')||'<section class="card"><p>No orders are waiting for finishing and painting.</p></section>'}`;
  window.scrollTo({top:0,behavior:'smooth'});
}

async function vuPipelineDashboard(){
  await vuPipelineDashboardBase();
  const [orders,quotes]=await Promise.all([getAll('orders'),getAll('quotes')]);
  const production=orders.filter(order=>vuIsFactoryOrder(order)&&!order.rawIssued);
  const finishing=orders.filter(vuIsFinishingOrder);
  const delivery=orders.filter(vuIsDeliveryOrder);
  const openQuotes=quotes.filter(q=>!vuQuoteClosedStatuses.has(vuLower(q.status)));
  const quoteAttention=openQuotes.filter(q=>vuQuoteAttention(q).level==='attention').length;

  const cards=[...main.querySelectorAll('.card')];
  const findCard=label=>cards.find(card=>new RegExp(`(^|\\s)${label}(\\s|$)`,'i').test(card.textContent||''));
  const ordersCard=findCard('Orders');const productionCard=findCard('Production');const deliveryCard=findCard('Deliveries');const quotesCard=findCard('Quotes');
  if(ordersCard){ordersCard.innerHTML=`<span style="font-size:32px">▤</span><h2>Orders & Production</h2><p>${production.length} active production job${production.length===1?'':'s'}</p>`;ordersCard.onclick=()=>navigate('production');ordersCard.style.cursor='pointer';}
  if(productionCard){productionCard.innerHTML=`<span style="font-size:32px">🎨</span><h2>Finishing & Painting</h2><p>${finishing.length} waiting</p>`;productionCard.onclick=finishingPaintingPage;productionCard.style.cursor='pointer';}
  if(deliveryCard){deliveryCard.innerHTML=`<span style="font-size:32px">🚚</span><h2>Deliveries</h2><p>${delivery.length} ready / scheduled</p>`;deliveryCard.onclick=()=>navigate('deliveries');deliveryCard.style.cursor='pointer';}
  if(quotesCard){quotesCard.querySelector('p')?.remove();quotesCard.insertAdjacentHTML('beforeend',`<p>${openQuotes.length} open · ${quoteAttention} need attention</p>`);}
}
const vuPipelineDashboardBase=dashboard;
dashboard=vuPipelineDashboard;

/* Add quote attention labels without replacing the existing quote editor/list behaviour. */
const vuQuotesPageBase=quotesPage;
quotesPage=async function quotesPipelinePage(){
  await vuQuotesPageBase();
  const quotes=await getAll('quotes');
  for(const quote of quotes){
    const marker=[...main.querySelectorAll('*')].find(el=>el.children.length===0&&(el.textContent||'').includes(quote.quoteNumber||'__none__'));
    const card=marker?.closest('.card,.list-item');if(!card||card.querySelector('.vu-quote-attention'))continue;
    const attention=vuQuoteAttention(quote);card.insertAdjacentHTML('beforeend',`<div class="vu-quote-attention ${attention.level}"><strong>${esc(attention.label)}</strong><small>${esc(attention.detail)}</small></div>`);
  }
};

/* Sage document classification. Job-card imports already enter Orders by design. */
function vuSageDocumentKind(source){
  const raw=vuLower(source.documentType||source.type||source.documentKind||source.kind||source.category||source.statusType);
  if(raw.includes('quote')||raw.includes('quotation')||raw.includes('estimate'))return'quote';
  return'order';
}
async function vuImportSageDocuments(payload){
  const sourceDocs=Array.isArray(payload)?payload:(payload.orders||payload.documents||payload.results||[]);
  const orderDocs=sourceDocs.filter(doc=>vuSageDocumentKind(doc)!=='quote');
  const quoteDocs=sourceDocs.filter(doc=>vuSageDocumentKind(doc)==='quote');
  const result=await vuOriginalImportSageOrders(orderDocs);
  const products=await getAll('products');const mappings=await getAll('sageMappings');const existingQuotes=await getAll('quotes');
  let quotesCreated=0,quotesUpdated=0;
  for(const source of quoteDocs){
    const sageId=String(source.id||source.ID||source.quoteId||source.documentId||source.number||source.documentNumber||'');if(!sageId)continue;
    const lines=[];for(const raw of (source.lines||source.documentLines||source.items||[])){
      if(classifySageLine(raw)!=='product')continue;const product=await matchSageProduct(raw,products,mappings);
      lines.push({productId:product?.id||'',productCode:String(raw.productCode||raw.code||''),productName:product?.name||String(raw.description||raw.name||raw.productName||''),colour:{name:raw.colour||raw.color||'Standard',hex:'#bbbbbb'},qty:Number(raw.quantity||raw.qty||0),unitPrice:Number(raw.unitPrice||raw.price||raw.exclusivePrice||0)});
    }
    const existing=existingQuotes.find(q=>String(q.sageId||'')===sageId);const now=new Date().toISOString();const status=source.status||existing?.status||'Sent';
    const quote={...(existing||{}),id:existing?.id||uid('quo'),sageId,source:'Sage Quote',quoteNumber:String(source.number||source.documentNumber||source.quoteNumber||sageId),customerId:existing?.customerId||'',customerName:String(source.customerName||source.customer?.name||'Sage customer'),createdAt:source.date||source.documentDate||existing?.createdAt||now,validUntil:source.validUntil||source.expiryDate||existing?.validUntil||'',status,lines,subTotal:Number(source.totalExclusive||source.subTotal||0),vat:Number(source.totalTax||source.vat||0),grandTotal:Number(source.totalInclusive||source.grandTotal||source.total||0),updatedAt:now,readOnlySource:true};
    await putOne('quotes',quote);existing?quotesUpdated++:quotesCreated++;
  }
  return{...result,total:sourceDocs.length,quotesCreated,quotesUpdated};
}
const vuOriginalImportSageOrders=importSageOrders;
importSageOrders=vuImportSageDocuments;

window.finishingPaintingPage=finishingPaintingPage;
window.vuSaveFinishedQty=vuSaveFinishedQty;window.vuAddFinishedQty=vuAddFinishedQty;window.vuCompleteFinishingLine=vuCompleteFinishingLine;window.vuMoveFinishedOrderToDelivery=vuMoveFinishedOrderToDelivery;
