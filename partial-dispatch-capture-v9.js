/* V9.1.10 — quantity-based Delivery & Collection read-in.
   Select an order, choose Delivery or Collection, and capture exactly which painted quantities physically left.
   Partial dispatch keeps the commercial order open; only full cumulative dispatch closes it. */
(function(){
'use strict';
if(window.VUPartialDispatchCapture&&String(window.VUPartialDispatchCapture.version||'')==='9.1.10')return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const safe=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const yesterday=()=>{const d=new Date();d.setDate(d.getDate()-1);return dk(d)};
const key=(pid,code,colour)=>`${String(pid||'')||norm(code)}|${norm(colour||'Standard')}`;
const isRaw=b=>norm(b?.colourName)==='raw stock'||String(b?.id||'').endsWith('::raw');
const closed=new Set(['cancelled','delivered','collected','completed','invoiced','declined']);
const priorDispatch=window.VUDailyDispatchCapture;
const baseSourceFor=priorDispatch&&typeof priorDispatch.sourceFor==='function'?priorDispatch.sourceFor.bind(priorDispatch):null;
function fulfilment(o){return /collect/i.test(String(o?.fulfilmentType||o?.preference||''))?'Collection':'Delivery'}
async function findBalance(line){const all=await getAll('inventoryBalances'),code=norm(line.productCode),colour=norm(line.colourName||'Standard');return all.find(b=>!isRaw(b)&&code&&norm(b.productCode)===code&&norm(b.colourName||'Standard')===colour)||all.find(b=>!isRaw(b)&&String(b.productId||'')===String(line.productId||'')&&norm(b.colourName||'Standard')===colour)||null}
function requiredMap(order){const map=new Map();for(const l of(order?.lines||[])){const qty=n(l.qty);if(!qty)continue;const c=l?.colour?.name||l?.colourName||'Standard',k=key(l.productId,l.productCode,c);map.set(k,(map.get(k)||0)+qty)}return map}
async function sourceFor(date){
  const d=dk(date||new Date()),base=baseSourceFor?await baseSourceFor(d):{workDate:d,source:'Live data',rows:[]};
  const [orders,jobs]=await Promise.all([getAll('orders'),getAll('productionJobs')]);
  const rows=[...(base.rows||[])],seen=new Set(rows.map(r=>String(r.orderId||'')));
  const paint=jobs.filter(j=>j?.kind==='orderPaintingLine'&&Math.max(0,n(j.completedQty)-n(j.dispatchedFinishedQty))>0);
  for(const order of orders){
    if(closed.has(norm(order.status))||seen.has(String(order.id)))continue;
    if(!paint.some(j=>String(j.orderId||'')===String(order.id)))continue;
    rows.push({orderId:order.id,orderNumber:order.orderNumber||'',customerName:order.customerName||'',type:fulfilment(order),position:0,address:order.deliveryAddress||'',source:'Painted stock available for partial dispatch'});seen.add(String(order.id));
  }
  return{...base,workDate:d,rows};
}
async function savePartial(workDate,row,quantities,note,actualType){
  const now=new Date().toISOString(),order=await getOne('orders',row.orderId);if(!order)throw new Error('Order was not found.');
  const dispatchType=actualType==='Collection'?'Collection':'Delivery';
  const jobs=await getAll('productionJobs'),paint=jobs.filter(j=>j?.kind==='orderPaintingLine'&&String(j.orderId||'')===String(order.id));
  const req=requiredMap(order),posted=[];
  for(const line of paint){
    const k=key(line.productId,line.productCode,line.colourName),qty=n(quantities[k]);if(!qty)continue;
    const available=Math.max(0,n(line.completedQty)-n(line.dispatchedFinishedQty));if(qty>available)throw new Error(`${line.productCode||'Product'} only has ${available} painted units available to dispatch.`);
    const bal=await findBalance(line);if(!bal)throw new Error(`${line.productCode||'Product'} painted stock balance could not be found.`);
    const before=n(bal.quantity),take=Math.min(qty,before);if(take<qty)throw new Error(`${line.productCode||'Product'} has only ${before} finished units in stock. Check the Painting capture first.`);
    const after=before-take,beforeReserved=n(bal.reservedQuantity),afterReserved=Math.max(0,beforeReserved-qty);
    await putOne('inventoryBalances',{...bal,quantity:after,reservedQuantity:Math.min(after,afterReserved),updatedAt:now});
    await putOne('inventoryTransactions',{id:typeof uid==='function'?uid('inv'):`inv_${Date.now()}_${Math.random().toString(36).slice(2)}`,productId:bal.productId||line.productId||'',productCode:line.productCode||bal.productCode||'',productName:line.productName||bal.productName||'',colourName:line.colourName||bal.colourName||'Standard',type:'ORDER_PARTIAL_DISPATCHED',previousQuantity:before,quantityChange:-qty,newQuantity:after,reference:order.orderNumber||order.id,note:`${dispatchType} quantity captured for ${workDate}${note?` · ${note}`:''}`,createdAt:now});
    const newDispatched=n(line.dispatchedFinishedQty)+qty,newReserved=Math.max(0,n(line.completedQty)-newDispatched);
    await putOne('productionJobs',{...line,dispatchedFinishedQty:newDispatched,reservedFinishedQty:newReserved,dispatchedAt:now,lastDispatchDate:workDate,updatedAt:now});
    const reservations=jobs.filter(j=>j?.kind==='paintedStockReservation'&&String(j.orderId||'')===String(order.id)&&norm(j.productCode)===norm(line.productCode)&&norm(j.colourName||'Standard')===norm(line.colourName||'Standard'));
    for(const r of reservations)await putOne('productionJobs',{...r,status:newReserved>0?'Reserved':'Released',quantity:newReserved,releasedAt:newReserved>0?r.releasedAt:now,updatedAt:now});
    posted.push({productId:line.productId||'',productCode:line.productCode||'',productName:line.productName||'',colourName:line.colourName||'Standard',quantity:qty});
  }
  if(!posted.length)throw new Error('Enter at least one quantity that was physically delivered or collected.');
  const refreshed=(await getAll('productionJobs')).filter(j=>j?.kind==='orderPaintingLine'&&String(j.orderId||'')===String(order.id));
  const dispatched=new Map();for(const j of refreshed){const k=key(j.productId,j.productCode,j.colourName);dispatched.set(k,(dispatched.get(k)||0)+n(j.dispatchedFinishedQty))}
  const complete=[...req.entries()].every(([k,q])=>n(dispatched.get(k))>=q),result=complete?(dispatchType==='Collection'?'Collected':'Delivered'):(dispatchType==='Collection'?'Partially collected':'Partially delivered');
  const id=`dispatchresult:${workDate}:${order.id}`,old=await getOne('productionJobs',id);
  await putOne('productionJobs',{...(old||{}),id,kind:'factoryDispatchResult',workDate,orderId:order.id,orderNumber:order.orderNumber||'',customerName:order.customerName||'',fulfilmentType:dispatchType,result,note,items:[...(old?.items||[]),...posted],partial:!complete,createdAt:old?.createdAt||now,updatedAt:now});
  const patch={...order,lastDispatchDate:workDate,lastDispatchType:dispatchType,partialDispatch:!complete,updatedAt:now};
  if(complete){patch.status=result;patch.workflowStage='delivery';if(result==='Delivered')patch.deliveredAt=order.deliveredAt||now;else patch.collectedAt=order.collectedAt||now}
  await putOne('orders',patch);
  try{window.VUOrderProgress?.invalidate?.();if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs();await window.VUBusinessOutcomeOptimizer?.build?.()}catch(e){console.warn('Planner recalc after partial dispatch',e)}
  return{complete,result,posted,dispatchType};
}
async function open(date,preselectedOrderId=''){
  const dialog=document.getElementById('dialog');if(!dialog)return;
  const start=dk(date||yesterday());
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:94vh;overflow:auto"><div class="dialog-head"><div><div class="eyebrow">DELIVERY & COLLECTION</div><h2>Read in physical dispatch</h2><p class="muted">Select an order and capture exactly what physically left. Partial dispatch does not close the order.</p></div><button class="close-btn" data-close>×</button></div><label>Dispatch date<input id="partialDispatchDate" type="date" value="${safe(start)}"></label><div class="actions"><button type="button" data-yesterday>Yesterday</button><button type="button" data-today>Today</button></div><label>Order<select id="partialDispatchOrder"><option value="">Loading orders…</option></select></label><div id="partialDispatchBody"><div class="card"><small class="muted">Select an order.</small></div></div></div>`;
  dialog.showModal();const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;
  const dateEl=document.getElementById('partialDispatchDate'),sel=document.getElementById('partialDispatchOrder'),host=document.getElementById('partialDispatchBody');
  async function loadOrders(){const source=await sourceFor(dateEl.value),rows=source.rows||[];sel.innerHTML='<option value="">Select order</option>'+rows.map(r=>`<option value="${safe(r.orderId)}" ${String(r.orderId)===String(preselectedOrderId)?'selected':''}>${safe(r.orderNumber||'Order')} · ${safe(r.customerName||'Customer')}</option>`).join('');sel.dataset.source=source.source||'';if(preselectedOrderId)await render();}
  async function render(){const source=await sourceFor(dateEl.value),row=(source.rows||[]).find(r=>String(r.orderId)===String(sel.value));if(!row){host.innerHTML='<div class="card"><small class="muted">Select an order.</small></div>';return}const order=await getOne('orders',row.orderId),jobs=(await getAll('productionJobs')).filter(j=>j?.kind==='orderPaintingLine'&&String(j.orderId||'')===String(row.orderId)),req=requiredMap(order),defaultType=row.type==='Collection'?'Collection':'Delivery';const lines=jobs.map(j=>{const k=key(j.productId,j.productCode,j.colourName),available=Math.max(0,n(j.completedQty)-n(j.dispatchedFinishedQty)),required=n(req.get(k));return `<section class="card" data-dispatch-line data-key="${safe(k)}"><h3>${safe(j.productCode||'')} · ${safe(j.productName||'')}</h3><p class="muted">${safe(j.colourName||'Standard')} · Order ${required} · Painted ${n(j.completedQty)} · Already dispatched ${n(j.dispatchedFinishedQty)} · <b>${available} available now</b></p><label>Qty physically sent<input type="number" min="0" max="${available}" step="1" inputmode="numeric" value="0" data-qty></label></section>`}).join('');host.innerHTML=`<section class="card"><small>${safe(source.source||'Live data')}</small><h3>${safe(row.orderNumber||'Order')} · ${safe(row.customerName||'Customer')}</h3><label>What happened?<select id="partialDispatchType"><option ${defaultType==='Delivery'?'selected':''}>Delivery</option><option ${defaultType==='Collection'?'selected':''}>Collection</option></select></label><p class="muted">Enter only the painted items that physically left. If the full order has not left yet, the order remains open and this is saved as a partial delivery/collection.</p></section>${lines||'<div class="card">No painted stock is currently recorded for this order. Capture Painting first.</div>'}<label>Notes / POD / reason<textarea id="partialDispatchNote" placeholder="Optional POD, delivery note or explanation"></textarea></label><button type="button" class="primary" id="partialDispatchSave" ${lines?'':'disabled'}>Save physical dispatch</button>`;const btn=document.getElementById('partialDispatchSave');if(btn)btn.onclick=async()=>{const q={};host.querySelectorAll('[data-dispatch-line]').forEach(el=>q[el.dataset.key]=n(el.querySelector('[data-qty]').value));const old=btn.textContent;btn.disabled=true;btn.textContent='Saving…';try{const actualType=document.getElementById('partialDispatchType').value,res=await savePartial(dateEl.value,row,q,document.getElementById('partialDispatchNote').value.trim(),actualType);notify?.(`${row.orderNumber||'Order'} · ${res.result}`);close();try{window.VUNavigationAuthority?.refreshCurrent?.()}catch{}}catch(e){console.error('Partial dispatch save',e);alert(e?.message||'Could not save dispatch.');btn.disabled=false;btn.textContent=old}}}
  sel.onchange=render;dateEl.onchange=loadOrders;dialog.querySelector('[data-yesterday]').onclick=()=>{dateEl.value=yesterday();loadOrders()};dialog.querySelector('[data-today]').onclick=()=>{dateEl.value=dk(new Date());loadOrders()};await loadOrders();
}
function rebind(){document.querySelectorAll('[data-open-dispatch]').forEach(b=>{b.textContent='Read in physical dispatch';b.onclick=()=>open(yesterday())})}
const obs=new MutationObserver(()=>setTimeout(rebind,50));obs.observe(document.body,{childList:true,subtree:true});setTimeout(rebind,250);
window.openDailyDispatchCapture=open;
window.VUDailyDispatchCapture={...(priorDispatch||{}),version:'9.1.10',open,sourceFor,savePartial};
window.VUPartialDispatchCapture={version:'9.1.10',open,sourceFor,savePartial};
})();