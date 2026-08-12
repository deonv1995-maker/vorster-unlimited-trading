/* V9.1.00 — Delivery & Collection worksheet read-in.
   Reads the frozen daily Factory Pack, captures actual dispatch results, closes orders/deliveries,
   consumes order-reserved painted finished stock exactly once, and preserves not-completed exceptions. */
(function(){
'use strict';
if(window.VUDailyDispatchCapture)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const safe=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const resultId=(date,orderId)=>`dispatchresult:${dk(date)}:${orderId}`;
const isRaw=b=>norm(b?.colourName)==='raw stock'||String(b?.id||'').endsWith('::raw');
async function packFor(date){return getOne('productionJobs',`factorypack:${dk(date)}`)}
async function priorFor(date,orderId){return getOne('productionJobs',resultId(date,orderId))}
async function findBalance(line){const all=await getAll('inventoryBalances'),code=norm(line.productCode),colour=norm(line.colourName||'Standard');return all.find(b=>!isRaw(b)&&code&&norm(b.productCode)===code&&norm(b.colourName||'Standard')===colour)||all.find(b=>!isRaw(b)&&String(b.productId||'')===String(line.productId||'')&&norm(b.colourName||'Standard')===colour)||null}
async function consumeReservedFinished(order,dispatchResult,now){
  if(dispatchResult?.stockFinalizedAt)return dispatchResult;
  const jobs=await getAll('productionJobs');
  const lines=jobs.filter(j=>j?.kind==='orderPaintingLine'&&String(j.orderId||'')===String(order.id));
  let consumed=0;
  for(const line of lines){
    const qty=n(line.reservedFinishedQty||line.finishedStockAppliedQty||line.completedQty);
    if(!qty)continue;
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
  return {...dispatchResult,stockFinalizedAt:now,finishedUnitsDispatched:consumed,updatedAt:now};
}
async function saveRow(pack,row,result,note){
  const now=new Date().toISOString(),done=result==='Delivered'||result==='Collected';
  let rec=await priorFor(pack.workDate,row.orderId);
  rec={...(rec||{}),id:resultId(pack.workDate,row.orderId),kind:'factoryDispatchResult',workDate:pack.workDate,orderId:row.orderId,orderNumber:row.orderNumber||'',customerName:row.customerName||'',fulfilmentType:row.type,result,note,createdAt:rec?.createdAt||now,updatedAt:now};
  if(done&&!rec.stockFinalizedAt){const order=await getOne('orders',row.orderId);if(order){rec=await consumeReservedFinished(order,rec,now);await putOne('orders',{...order,status:result,workflowStage:'delivery',deliveryDate:result==='Delivered'?(order.deliveryDate||pack.workDate):order.deliveryDate,deliveredAt:result==='Delivered'?(order.deliveredAt||now):order.deliveredAt,collectedAt:result==='Collected'?(order.collectedAt||now):order.collectedAt,updatedAt:now});const deliveries=await getAll('deliveries');for(const d of deliveries.filter(x=>String(x.orderId)===String(row.orderId))){await putOne('deliveries',{...d,status:result==='Delivered'?'Delivered':result==='Collected'?'Collected':d.status,deliveryDate:d.deliveryDate||pack.workDate,deliveredAt:result==='Delivered'?(d.deliveredAt||now):d.deliveredAt,collectedAt:result==='Collected'?(d.collectedAt||now):d.collectedAt,updatedAt:now});}}}
  await putOne('productionJobs',rec);return rec;
}
async function open(date){
  const d=dk(date||new Date()),pack=await packFor(d);if(!pack){alert(`No frozen Factory Pack found for ${d}. Create the Morning Factory Pack first.`);return;}
  const rows=[...(pack.sections?.delivery||[]).map(x=>({...x,type:'Delivery'})),...(pack.sections?.collections||[]).map(x=>({...x,type:'Collection'}))];
  const prior=new Map();for(const r of rows){const p=await priorFor(d,r.orderId);if(p)prior.set(String(r.orderId),p)}
  const dialog=document.getElementById('dialog');if(!dialog)return;
  dialog.innerHTML=`<div class="modal-form daily-dispatch-capture"><div class="dialog-head"><div><div class="eyebrow">DELIVERY WORKSHEET READ-IN</div><h2>Delivery & Collection · ${safe(d)}</h2><p class="muted">Only orders from the frozen worksheet for this date are shown.</p></div><button class="close-btn" data-close>×</button></div>${rows.length?rows.map((x,i)=>{const p=prior.get(String(x.orderId)),done=p?.result||'Not completed';return `<section class="card" data-row data-i="${i}"><div class="section-head"><div><strong>${x.type==='Delivery'&&x.position?`Stop ${n(x.position)} · `:''}${safe(x.orderNumber)} · ${safe(x.customerName)}</strong><div class="muted">${safe(x.type)}${x.address?` · ${safe(x.address)}`:''}</div></div>${p?.stockFinalizedAt?'<span class="badge">Already posted</span>':''}</div><label>Actual result<select data-result><option ${done==='Not completed'?'selected':''}>Not completed</option><option ${done==='Delivered'?'selected':''}>Delivered</option><option ${done==='Collected'?'selected':''}>Collected</option></select></label><label>Notes / POD / reason<textarea data-note placeholder="Optional notes, POD number or reason not completed">${safe(p?.note||'')}</textarea></label></section>`}).join(''):'<div class="card">No Delivery or Collection orders were issued on this worksheet.</div>'}<div class="actions"><button type="button" data-close2>Cancel</button><button class="primary" type="button" data-save ${rows.length?'':'disabled'}>Save day results</button></div></div>`;
  dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-close2]').onclick=()=>dialog.close();
  const saveBtn=dialog.querySelector('[data-save]');if(saveBtn)saveBtn.onclick=async()=>{saveBtn.disabled=true;const old=saveBtn.textContent;saveBtn.textContent='Saving…';try{for(const el of dialog.querySelectorAll('[data-row]')){const row=rows[Number(el.dataset.i)],result=el.querySelector('[data-result]').value,note=el.querySelector('[data-note]').value.trim();await saveRow(pack,row,result,note)}notify?.('Delivery & Collection results saved');dialog.close();try{window.VUNavigationAuthority?.refreshCurrent?.()}catch{}}catch(e){console.error('Daily dispatch capture',e);alert(e?.message||'Could not save delivery results.');saveBtn.disabled=false;saveBtn.textContent=old;}};
}
function installAccess(){
  const main=document.getElementById('main');if(!main||document.getElementById('dailyDispatchCaptureCard'))return;
  const text=String(document.getElementById('pageTitle')?.textContent||'').toLowerCase();if(!/dashboard|production|deliver/.test(text))return;
  const card=document.createElement('section');card.id='dailyDispatchCaptureCard';card.className='card';card.innerHTML='<div class="section-head"><div><div class="eyebrow">END OF DAY</div><h2>Read in Delivery & Collection</h2><p class="muted">Capture what was actually delivered or collected from today\'s frozen worksheet.</p></div></div><button type="button" class="primary" data-open-dispatch>Read in today\'s worksheet</button>';
  const btn=card.querySelector('[data-open-dispatch]');btn.onclick=()=>open(new Date());main.prepend(card);
}
const obs=new MutationObserver(()=>setTimeout(installAccess,50));obs.observe(document.body,{childList:true,subtree:true});setTimeout(installAccess,250);
window.openDailyDispatchCapture=open;
window.VUDailyDispatchCapture={version:'9.1.00',open,saveRow};
})();