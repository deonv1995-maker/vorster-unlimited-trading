/* Version 9.0.7 — reliable manual order line adjustments with operational sync. */
(function(){
'use strict';
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const now=()=>new Date().toISOString();
const CLOSED=new Set(['delivered','collected','completed','cancelled','invoiced']);

function colourName(line){return line?.colour?.name||line?.colourName||'Standard'}
function lineKey(line){return `${line.productId||line.productCode||''}|${norm(colourName(line))}`}
function calculateTotals(order){
  const subtotal=(order.lines||[]).reduce((s,l)=>s+n(l.qty)*n(l.unitPrice),0);
  const delivery=n(order.delivery??order.deliveryFee);
  const vatRate=Number(order.vatRate||15);
  const vat=(subtotal+delivery)*(vatRate/100);
  return{subtotal,delivery,vat,grandTotal:subtotal+delivery+vat};
}
async function syncOperationalSnapshots(order){
  const [jobs,deliveries]=await Promise.all([getAll('productionJobs'),getAll('deliveries')]);
  for(const job of jobs.filter(j=>j.orderId===order.id&&!['completed','cancelled'].includes(norm(j.status)))){
    await putOne('productionJobs',{...job,lines:structuredClone(order.lines||[]),updatedAt:now(),orderLineSyncAt:now()});
  }
  for(const delivery of deliveries.filter(d=>d.orderId===order.id&&!['delivered','cancelled'].includes(norm(d.status)))){
    await putOne('deliveries',{...delivery,orderLineSyncAt:now(),updatedAt:now()});
  }
}
async function persistOrder(order){
  const t=calculateTotals(order);
  const saved={...order,delivery:t.delivery,subtotal:t.subtotal,vat:t.vat,grandTotal:t.grandTotal,updatedAt:now()};
  await putOne('orders',saved);
  const verify=await getOne('orders',saved.id);
  if(!verify||JSON.stringify(verify.lines||[])!==JSON.stringify(saved.lines||[]))throw new Error('The updated product lines did not persist correctly.');
  await syncOperationalSnapshots(saved);
  return saved;
}

async function openOrderLineAdjuster(orderId){
  const [order,products]=await Promise.all([getOne('orders',orderId),getAll('products')]);
  if(!order)return;
  if(CLOSED.has(norm(order.status))){alert('This order is closed and cannot be changed.');return;}
  const active=products.filter(p=>p.isActive!==false);
  openDialog(`<div class="dialog-head"><div><h2>Adjust order items</h2><p class="muted">${safe(order.orderNumber||'Order')} · ${safe(order.customerName||'')}</p></div><button class="close-btn" onclick="closeDialog()">×</button></div><div class="card"><input id="vuLineSearch" class="search" placeholder="Search code or product"><div id="vuLineProducts" class="list" style="margin-top:8px"></div></div>`);
  const render=(q='')=>{
    const needle=norm(q),shown=active.filter(p=>norm(`${p.code} ${p.name}`).includes(needle)).slice(0,40);
    document.getElementById('vuLineProducts').innerHTML=shown.map(p=>`<button class="list-item" style="width:100%;text-align:left" data-product="${p.id}"><div><strong>${safe(p.code)} · ${safe(p.name)}</strong><p class="muted">${typeof money==='function'?money(p.price):p.price} ex VAT</p></div><span>＋</span></button>`).join('')||'<div class="empty">No matching products.</div>';
    document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>chooseProduct(b.dataset.product));
  };
  const chooseProduct=productId=>{
    const p=active.find(x=>x.id===productId);if(!p)return;
    const colours=(p.colours||[]).length?p.colours:[{name:'Standard',hex:'#bbbbbb'}];
    openDialog(`<div class="dialog-head"><div><h2>${safe(p.code)} · ${safe(p.name)}</h2><p class="muted">Add to ${safe(order.orderNumber||'order')}</p></div><button class="close-btn" onclick="closeDialog()">×</button></div><form id="vuAddOrderLine"><label>Colour<select name="colour">${colours.map((c,i)=>`<option value="${i}">${safe(c.name)}</option>`).join('')}</select></label><label>Quantity<input name="qty" type="number" min="1" step="1" value="1" required></label><button class="primary" type="submit">Add product to order</button></form>`);
    document.getElementById('vuAddOrderLine').onsubmit=async e=>{
      e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const colour=colours[Number(d.colour)]||colours[0],qty=Math.max(1,Math.round(n(d.qty)));
      const latest=await getOne('orders',orderId);latest.lines=Array.isArray(latest.lines)?latest.lines:[];
      const candidate={productId:p.id,productCode:p.code,productName:p.name,colour:{name:colour.name||'Standard',hex:colour.hex||'#bbbbbb'},qty,unitPrice:n(p.price),allocatedQty:0,completedQty:0,sourceLineType:'product',manualAddition:true,manualAddedAt:now()};
      const existing=latest.lines.find(l=>lineKey(l)===lineKey(candidate));
      if(existing){existing.qty=n(existing.qty)+qty;existing.manualAddition=true;existing.manualAddedAt=now();}
      else latest.lines.push(candidate);
      try{const saved=await persistOrder(latest);closeDialog();notify(`${p.code} added to order`);viewOrder(saved.id);}catch(err){alert(`Order update failed\n\n${err.message||err}`)}
    };
  };
  document.getElementById('vuLineSearch').oninput=e=>render(e.target.value);render();
}
window.openOrderLineAdjuster=openOrderLineAdjuster;

const previousViewOrder=window.viewOrder;
if(typeof previousViewOrder==='function'){
  window.viewOrder=async function(id){
    await previousViewOrder(id);
    try{
      const order=await getOne('orders',id);if(!order||CLOSED.has(norm(order.status)))return;
      if(document.getElementById('vuOrderLineAdjust'))return;
      const host=document.createElement('div');host.id='vuOrderLineAdjust';host.className='card no-print';host.style.marginTop='12px';
      host.innerHTML=`<div class="section-head"><div><h3>Order items</h3><p class="muted">Add customer changes directly to this order. Saved lines are verified and synced to any open production job.</p></div></div><div class="actions"><button class="primary" onclick="openOrderLineAdjuster('${order.id}')">Add product to order</button></div>`;
      main.appendChild(host);
    }catch(e){console.warn('Order line adjuster',e)}
  };
}
})();