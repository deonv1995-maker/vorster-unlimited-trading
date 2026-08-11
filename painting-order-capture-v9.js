/* V9.0.75 — order-based painted stock capture.
   Painting is cumulative and order-specific. Select an open order, enter painted quantities for
   each product/colour requirement, and the order's painting completion drives delivery readiness. */
(function(){
'use strict';
if(window.VUPaintingOrderCapture)return;
const CLOSED=new Set(['cancelled','completed','delivered','collected','invoiced','declined']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dateKey=v=>{const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item';
const colour=l=>l?.colour?.name||l?.colourName||'Standard';
const isProduct=l=>!window.VUOrderLineClassifications||window.VUOrderLineClassifications.isProduct(l);
function lineId(orderId,row){return `orderpaint:${slug(orderId)}:${slug(row.productId||row.productCode)}:${slug(row.colourName)}`}
function groupedLines(order){
  const map=new Map();
  for(const l of(order?.lines||[])){
    if(!isProduct(l)||n(l.qty)<=0)continue;
    const c=colour(l),key=`${String(l.productId||l.productCode||'')}|${norm(c)}`;
    if(!map.has(key))map.set(key,{productId:l.productId||'',productCode:l.productCode||l.code||'',productName:l.productName||l.name||'',colourName:c,targetQty:0});
    map.get(key).targetQty+=n(l.qty);
  }
  return [...map.values()];
}
function ensureStyles(){
  if(document.getElementById('paintingOrderCaptureStyles'))return;
  const s=document.createElement('style');s.id='paintingOrderCaptureStyles';s.textContent=`
    .paint-order-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.paint-order-summary>div{padding:10px;border:1px solid var(--border);border-radius:14px;text-align:center}.paint-order-summary strong{display:block;font-size:1.1rem}
    .paint-order-line{padding:13px;margin:9px 0;border:1px solid var(--border);border-radius:15px;background:var(--surface-2)}.paint-order-line h3{margin:0 0 4px}.paint-order-meta{font-size:.85rem;color:var(--muted)}
    .paint-order-qty{display:grid;grid-template-columns:50px 1fr 50px;gap:8px;align-items:center;margin:10px 0}.paint-order-qty button{min-height:46px;font-size:1.3rem}.paint-order-qty input{text-align:center;font-size:1.05rem;font-weight:800}.paint-order-complete{border-color:#69a58a}
  `;document.head.appendChild(s);
}
async function openCapture(preselectedOrderId=''){
  ensureStyles();
  const orders=(await getAll('orders')).filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>isProduct(l)&&n(l.qty)>0)).sort((a,b)=>String(a.dueDate||'9999-12-31').localeCompare(String(b.dueDate||'9999-12-31'))||String(a.orderNumber||'').localeCompare(String(b.orderNumber||'')));
  const dialog=document.getElementById('dialog');
  const opts=orders.map(o=>`<option value="${safe(o.id)}" ${String(o.id)===String(preselectedOrderId)?'selected':''}>${safe(o.orderNumber||'Order')} · ${safe(o.customerName||'Customer')}</option>`).join('');
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:94vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:12px"><div><div class="eyebrow">FINISHING & PAINTING</div><h2 style="margin:4px 0">Read in painted stock</h2><p class="muted">Select an order, then enter the total quantity already painted for each required product and colour. Partial quantities remain in Painting; 100% moves the order to delivery-ready.</p></div><button type="button" class="icon-btn" data-close>×</button></div><label>Order<select id="paintOrderSelect"><option value="">Select order</option>${opts}</select></label><div id="paintOrderBody"><div class="card"><small class="muted">Select an order to capture painted stock.</small></div></div></div>`;
  dialog.showModal();
  const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;
  const select=document.getElementById('paintOrderSelect');
  const render=async()=>{
    const order=orders.find(o=>String(o.id)===String(select.value)),host=document.getElementById('paintOrderBody');if(!order){host.innerHTML='<div class="card"><small class="muted">Select an order to capture painted stock.</small></div>';return}
    const rows=groupedLines(order),jobs=await getAll('productionJobs'),byId=new Map(jobs.filter(j=>j?.kind==='orderPaintingLine'&&String(j.orderId)===String(order.id)).map(j=>[String(j.id),j]));
    let total=0,done=0;
    const html=rows.map((row,i)=>{const id=lineId(order.id,row),job=byId.get(id),painted=Math.min(n(job?.completedQty),n(row.targetQty)),pct=row.targetQty?Math.round(painted/row.targetQty*100):0;total+=n(row.targetQty);done+=painted;return `<section class="paint-order-line ${painted>=row.targetQty&&row.targetQty?'paint-order-complete':''}" data-paint-order-line data-index="${i}" data-id="${safe(id)}" data-target="${n(row.targetQty)}"><h3>${safe(row.productCode)} · ${safe(row.productName)}</h3><div class="paint-order-meta">${safe(row.colourName)} · Required <b>${n(row.targetQty)}</b> · Painted <b>${painted} (${pct}%)</b></div><label>Total painted quantity<div class="paint-order-qty"><button type="button" data-minus>−</button><input type="number" min="0" max="${n(row.targetQty)}" step="1" inputmode="numeric" value="${painted}" data-painted><button type="button" data-plus>+</button></div></label><label>Note<textarea data-note placeholder="Optional note or problem">${safe(job?.note||'')}</textarea></label><button type="button" data-complete>Mark line complete</button></section>`}).join('');
    const pct=total?Math.round(done/total*100):0;
    host.innerHTML=`<section class="card"><small>${safe(order.orderNumber||'Order')}</small><h3>${safe(order.customerName||'Customer')}</h3><div class="paint-order-summary"><div><small>Required</small><strong>${total}</strong></div><div><small>Painted</small><strong id="paintOrderDone">${done}</strong></div><div><small>Complete</small><strong id="paintOrderPct">${pct}%</strong></div></div></section>${html}<div class="actions" style="position:sticky;bottom:0;background:var(--surface);padding:12px 0"><button type="button" class="primary" id="paintOrderSave">Save painted stock to order</button></div>`;
    const refresh=()=>{let d=0;host.querySelectorAll('[data-paint-order-line]').forEach(el=>d+=Math.min(n(el.querySelector('[data-painted]').value),n(el.dataset.target)));const p=total?Math.round(d/total*100):0;document.getElementById('paintOrderDone').textContent=d;document.getElementById('paintOrderPct').textContent=`${p}%`};
    host.querySelectorAll('[data-paint-order-line]').forEach(el=>{const inp=el.querySelector('[data-painted]'),target=n(el.dataset.target),set=v=>{inp.value=Math.max(0,Math.min(target,Math.round(n(v))));refresh()};el.querySelector('[data-minus]').onclick=()=>set(n(inp.value)-1);el.querySelector('[data-plus]').onclick=()=>set(n(inp.value)+1);el.querySelector('[data-complete]').onclick=()=>set(target);inp.oninput=()=>set(inp.value)});
    document.getElementById('paintOrderSave').onclick=async()=>{
      const now=new Date().toISOString(),today=dateKey(now),captureItems=[];let required=0,paintedTotal=0;
      for(const el of host.querySelectorAll('[data-paint-order-line]')){
        const row=rows[Number(el.dataset.index)],target=n(row.targetQty),completedQty=Math.min(n(el.querySelector('[data-painted]').value),target),id=el.dataset.id,existing=await getOne('productionJobs',id),previous=n(existing?.completedQty),delta=completedQty-previous;
        required+=target;paintedTotal+=completedQty;
        await putOne('productionJobs',{...(existing||{}),id,kind:'orderPaintingLine',orderId:order.id,orderNumber:order.orderNumber||'',customerName:order.customerName||'',productId:row.productId,productCode:row.productCode,productName:row.productName,colourName:row.colourName,targetQty:target,completedQty,paintingPercent:target?Math.round(completedQty/target*100):0,status:completedQty>=target&&target?'Completed':completedQty>0?'In progress':'Not started',note:el.querySelector('[data-note]').value.trim(),lastCapturedDate:today,createdAt:existing?.createdAt||now,updatedAt:now});
        if(delta!==0)captureItems.push({productId:row.productId,productCode:row.productCode,productName:row.productName,colourName:row.colourName,previousQty:previous,newQty:completedQty,quantityChange:delta,targetQty:target});
      }
      const percent=required?Math.round(paintedTotal/required*100):0,complete=required>0&&paintedTotal>=required;
      await putOne('orders',{...order,workflowStage:complete?'delivery':'painting',finishingStatus:complete?'Completed':(paintedTotal>0?'In Progress':order.finishingStatus),paintingStatus:complete?'Completed':(paintedTotal>0?'In Progress':'Not started'),paintingPercent:percent,paintedQty:paintedTotal,paintingRequiredQty:required,paintingStartedAt:paintedTotal>0?(order.paintingStartedAt||now):order.paintingStartedAt,paintingCompletedAt:complete?(order.paintingCompletedAt||now):null,updatedAt:now});
      if(captureItems.length){const captureId=typeof uid==='function'?uid('paintset'):`paintset_${Date.now()}`;await putOne('productionJobs',{id:captureId,kind:'paintingCaptureSet',workDate:today,orderId:order.id,orderNumber:order.orderNumber||'',customerName:order.customerName||'',items:captureItems,totalPainted:paintedTotal,paintingPercent:percent,createdAt:now,updatedAt:now})}
      try{if(typeof buildOptimizedOrderJobs==='function')await buildOptimizedOrderJobs()}catch(e){console.warn('Planner recalc after painting capture',e)}
      notify?.(complete?`${order.orderNumber||'Order'} painting complete · ready for delivery`:`${order.orderNumber||'Order'} painting saved · ${percent}% complete`);close();if(window.VUNavigationAuthority?.current?.()==='production'&&typeof window.productionPage==='function')await window.productionPage();
    };
  };
  select.onchange=render;if(preselectedOrderId)await render();
}
function bindButton(){
  const host=document.getElementById('divisionDailyWorkLauncher');if(!host)return;
  const painting=host.querySelector('[data-division-work="Painting"]');if(painting){painting.textContent='Painting by order';painting.onclick=()=>openCapture()}
  let extra=host.querySelector('[data-painted-order-capture]');if(!extra){extra=document.createElement('button');extra.type='button';extra.dataset.paintedOrderCapture='1';extra.className='secondary';extra.style.cssText='width:100%;margin-top:10px;min-height:48px;font-weight:800';extra.textContent='Read in painted stock by order';extra.onclick=()=>openCapture();host.appendChild(extra)}
}
const base=window.productionPage;if(typeof base==='function'){window.productionPage=async function paintingOrderCapturePage(...args){const result=await base(...args);bindButton();return result};try{productionPage=window.productionPage}catch{}}
window.openPaintingOrderCapture=openCapture;window.VUPaintingOrderCapture={version:'9.0.75',open:openCapture,groupedLines,lineId};
})();