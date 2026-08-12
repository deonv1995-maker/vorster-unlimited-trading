/* V9.1.02 — order-based Delivery & Collection read-in.
   Prefers the frozen Factory Pack for the date; if none exists, falls back to the live automatic fulfilment plan.
   Completing an order closes it and consumes that order's reserved painted finished stock exactly once. */
(function(){
'use strict';
if(window.VUDailyDispatchCapture&&window.VUDailyDispatchCapture.version==='9.1.02')return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const safe=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const resultId=(date,orderId)=>`dispatchresult:${dk(date)}:${orderId}`;
const isRaw=b=>norm(b?.colourName)==='raw stock'||String(b?.id||'').endsWith('::raw');
async function packFor(date){return getOne('productionJobs',`factorypack:${dk(date)}`)}
async function priorFor(date,orderId){return getOne('productionJobs',resultId(date,orderId))}
async function findBalance(line){const all=await getAll('inventoryBalances'),code=norm(line.productCode),colour=norm(line.colourName||'Standard');return all.find(b=>!isRaw(b)&&code&&norm(b.productCode)===code&&norm(b.colourName||'Standard')===colour)||all.find(b=>!isRaw(b)&&String(b.productId||'')===String(line.productId||'')&&norm(b.colourName||'Standard')===colour)||null}
async function sourceFor(date){
  const d=dk(date||new Date()),pack=await packFor(d);
  if(pack){
    const rows=[...(pack.sections?.delivery||[]).map(x=>({...x,type:'Delivery'})),...(pack.sections?.collections||[]).map(x=>({...x,type:'Collection'}))];
    return{workDate:d,source:'Frozen Factory Pack',pack,rows};
  }
  if(window.VUAutoFulfilmentPlanner?.build){
    const plan=await window.VUAutoFulfilmentPlanner.build();
    const rows=(plan.assignments||[]).filter(a=>dk(a.date)===d).map((a,i)=>({
      type:a.type||'Delivery',orderId:a.order?.id||'',orderNumber:a.order?.orderNumber||'',customerName:a.order?.customerName||'',position:a.type==='Delivery'?i+1:0,address:a.order?.deliveryAddress||'',completionPercent:n(a.progress?.percent),source:a.source||'Algorithm planned',rawPct:n(a.rawPct),risk:a.risk||''
    })).filter(x=>x.orderId);
    return{workDate:d,source:'Live algorithm plan',pack:{workDate:d},rows};
  }
  return{workDate:d,source:'No plan available',pack:{workDate:d},rows:[]};
}
async function consumeReservedFinished(order,dispatchResult,now){
  if(dispatchResult?.stockFinalizedAt)return dispatchResult;
  const jobs=await getAll('productionJobs');
  const lines=jobs.filter(j=>j?.kind==='orderPaintingLine'&&String(j.orderId||'')===String(order.id));
  let consumed=0;
  for(const line of lines){
    const qty=n(line.reservedFinishedQty||line.finishedStockAppliedQty||line.completedQty);if(!qty)continue;
    const bal=await findBalance(line);
    if(bal){
      const before=Number(bal.quantity||0),beforeReserved=n(bal.reservedQuantity),take=Math.min(qty,Math.max(0,before));
      const after=Math.max(0,before-take),afterReserved=Math.max(0,beforeReserved-Math.min(qty,beforeReserved));
      await putOne('inventoryBalances',{...bal,quantity:after,reservedQuantity:Math.min(after,afterReserved),updatedAt:now});
      if(take)await putOne('inventoryTransactions',{id:typeof uid==='function'?uid('inv'):`inv_${Date.now()}_${Math.random().toString(36).slice(2)}`,productId:bal.productId||line.productId||'',productCode:line.productCode||bal.productCode||'',productName:line.productName||bal.productName||'',colourName:line.colourName||bal.colourName||'Standard',type:'ORDER_DISPATCHED',previousQuantity:before,quantityChange:-take,newQuantity:after,reference:order.orderNumber||order.id,note:`${dispatchResult.fulfilmentType} completed · reserved painted stock dispatched`,createdAt:now});
      consumed+=take;
    }
    await putOne('productionJobs',{...line,reservedFinishedQty:0,dispatchedFinishedQty:n(line.dispatchedFinishedQty)+qty,dispatchedAt:now,updatedAt:now});
    const reservations=jobs.filter(j=>j?.kind==='paintedStockReservation'&&String(j.orderId||'')===String(order.id)&&norm(j.productCode)===norm(line.productCode)&&norm(j.colourName||'Standard')===norm(line.colourName||'Standard'));
    for(const r of reservations)await putOne('productionJobs',{...r,status:'Released',quantity:0,releasedAt:now,updatedAt:now});
  }
  return{...dispatchResult,stockFinalizedAt:now,finishedUnitsDispatched:consumed,updatedAt:now};
}
async function saveRow(source,row,result,note){
  const now=new Date().toISOString(),done=result==='Delivered'||result==='Collected';
  let rec=await priorFor(source.workDate,row.orderId);
  rec={...(rec||{}),id:resultId(source.workDate,row.orderId),kind:'factoryDispatchResult',workDate:source.workDate,orderId:row.orderId,orderNumber:row.orderNumber||'',customerName:row.customerName||'',fulfilmentType:row.type,result,note,planningSource:source.source,createdAt:rec?.createdAt||now,updatedAt:now};
  if(done&&!rec.stockFinalizedAt){
    const order=await getOne('orders',row.orderId);
    if(order){
      rec=await consumeReservedFinished(order,rec,now);
      await putOne('orders',{...order,status:result,workflowStage:'delivery',deliveryDate:result==='Delivered'?(order.deliveryDate||source.workDate):order.deliveryDate,deliveredAt:result==='Delivered'?(order.deliveredAt||now):order.deliveredAt,collectedAt:result==='Collected'?(order.collectedAt||now):order.collectedAt,updatedAt:now});
      const deliveries=await getAll('deliveries');
      for(const d of deliveries.filter(x=>String(x.orderId)===String(row.orderId)))await putOne('deliveries',{...d,status:result==='Delivered'?'Delivered':result==='Collected'?'Collected':d.status,deliveryDate:d.deliveryDate||source.workDate,deliveredAt:result==='Delivered'?(d.deliveredAt||now):d.deliveredAt,collectedAt:result==='Collected'?(d.collectedAt||now):d.collectedAt,updatedAt:now});
    }
  }
  await putOne('productionJobs',rec);return rec;
}
async function open(date,preselectedOrderId=''){
  const source=await sourceFor(date||new Date()),rows=source.rows||[],dialog=document.getElementById('dialog');if(!dialog)return;
  const opts=rows.map(r=>`<option value="${safe(r.orderId)}" ${String(r.orderId)===String(preselectedOrderId)?'selected':''}>${safe(r.orderNumber||'Order')} · ${safe(r.customerName||'Customer')} · ${safe(r.type)}</option>`).join('');
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:94vh;overflow:auto"><div class="dialog-head"><div><div class="eyebrow">DELIVERY & COLLECTION</div><h2>Read in dispatch by order</h2><p class="muted">${safe(source.workDate)} · ${safe(source.source)}</p></div><button class="close-btn" data-close>×</button></div><label>Order<select id="dispatchOrderSelect"><option value="">Select order</option>${opts}</select></label><div id="dispatchOrderBody">${rows.length?'<div class="card"><small class="muted">Select an order.</small></div>':'<div class="card"><b>No dispatch orders are planned for this date.</b><p class="muted">The screen now works without a Morning Factory Pack, but there are no Delivery/Collection assignments on the live plan for this date.</p></div>'}</div></div>`;
  dialog.showModal();const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;const select=document.getElementById('dispatchOrderSelect');
  const render=async()=>{
    const row=rows.find(x=>String(x.orderId)===String(select.value)),host=document.getElementById('dispatchOrderBody');if(!row){host.innerHTML='<div class="card"><small class="muted">Select an order.</small></div>';return}
    const prior=await priorFor(source.workDate,row.orderId),current=prior?.result||'Not completed';
    host.innerHTML=`<section class="card"><small>${safe(row.type)}${row.position?` · Stop ${n(row.position)}`:''}</small><h3>${safe(row.orderNumber||'Order')} · ${safe(row.customerName||'Customer')}</h3>${row.address?`<p class="muted">${safe(row.address)}</p>`:''}${row.source?`<p class="muted">Plan: ${safe(row.source)}${row.risk?` · ${safe(row.risk)}`:''}</p>`:''}${prior?.stockFinalizedAt?'<p><span class="badge">Already posted</span></p>':''}<label>Actual result<select id="dispatchOrderResult"><option ${current==='Not completed'?'selected':''}>Not completed</option><option ${current==='Delivered'?'selected':''}>Delivered</option><option ${current==='Collected'?'selected':''}>Collected</option></select></label><label>Notes / POD / reason<textarea id="dispatchOrderNote" placeholder="Optional notes, POD number or reason not completed">${safe(prior?.note||'')}</textarea></label><div class="actions" style="position:sticky;bottom:0;background:var(--surface);padding-top:12px"><button type="button" class="primary" id="dispatchOrderSave">Save this order</button></div></section>`;
    document.getElementById('dispatchOrderSave').onclick=async()=>{const btn=document.getElementById('dispatchOrderSave'),old=btn.textContent;btn.disabled=true;btn.textContent='Saving…';try{const result=document.getElementById('dispatchOrderResult').value,note=document.getElementById('dispatchOrderNote').value.trim();await saveRow(source,row,result,note);notify?.(`${row.orderNumber||'Order'} ${result.toLowerCase()} saved`);close();try{window.VUNavigationAuthority?.refreshCurrent?.()}catch{}}catch(e){console.error('Order dispatch capture',e);alert(e?.message||'Could not save dispatch result.');btn.disabled=false;btn.textContent=old;}};
  };
  select.onchange=render;if(preselectedOrderId)await render();
}
function installAccess(){const main=document.getElementById('main');if(!main||document.getElementById('dailyDispatchCaptureCard'))return;const text=String(document.getElementById('pageTitle')?.textContent||'').toLowerCase();if(!/dashboard|production|deliver/.test(text))return;const card=document.createElement('section');card.id='dailyDispatchCaptureCard';card.className='card';card.innerHTML='<div class="section-head"><div><div class="eyebrow">DELIVERY & COLLECTION</div><h2>Read in dispatch by order</h2><p class="muted">Select one order from today\'s Delivery/Collection plan, capture its result and save it.</p></div></div><button type="button" class="primary" data-open-dispatch>Select order</button>';card.querySelector('[data-open-dispatch]').onclick=()=>open(new Date());main.prepend(card)}
const obs=new MutationObserver(()=>setTimeout(installAccess,50));obs.observe(document.body,{childList:true,subtree:true});setTimeout(installAccess,250);
window.openDailyDispatchCapture=open;window.VUDailyDispatchCapture={version:'9.1.02',open,saveRow,sourceFor};
})();