/* Factory OS 2.8.5-recovery — read-only all-orders visibility layer. */
(function(){
'use strict';
if(window.VUFactoryOrderRecovery)return;
const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
const n=v=>Math.max(0,Number(v||0));
let rows=[];
function lineQty(l){return n(l?.qty||l?.quantity||l?.orderedQty)}
function lineDelivered(l){return n(l?.deliveredQty||l?.dispatchedQty)}
function lineRemaining(l){return Math.max(0,lineQty(l)-lineDelivered(l))}
function searchText(o){return norm([o.orderNumber,o.customerName,o.customerCode,o.accountCode,o.sageCustomerCode,o.status,o.source,o.fulfilmentType,o.preference].filter(Boolean).join(' '))}
function showOrder(id){const o=rows.find(x=>String(x.id)===String(id));if(!o)return;const lines=o.lines||[];const body=lines.length?lines.map((l,i)=>`<div style="padding:10px 0;border-bottom:1px solid var(--line)"><strong>${safe(l.productCode||l.code||'No code')} · ${safe(l.productName||l.description||l.name||'Product')}</strong><div class="muted">${safe(l?.colour?.name||l.colourName||l.colour||'Standard')} · Ordered ${lineQty(l)} · Delivered ${lineDelivered(l)} · Outstanding ${lineRemaining(l)}</div></div>`).join(''):'<p class="muted">No product lines stored on this order.</p>';
 if(window.openDialog)window.openDialog(`<div class="dialog-head"><div><div class="step-label">READ-ONLY ORDER RECOVERY</div><h2>${safe(o.orderNumber||'Order')} · ${safe(o.customerName||'Unknown customer')}</h2><p class="muted">Source: ${safe(o.source||'Not recorded')} · Status: ${safe(o.status||'Not recorded')}</p></div><button class="close-btn" id="vuRecoveryClose" type="button">×</button></div><section class="card"><p class="muted">This recovery view does not edit, import, delete or resave the order.</p>${body}</section>`);else return;
 document.getElementById('vuRecoveryClose')?.addEventListener('click',()=>window.closeDialog?.());
}
function render(q=''){
 const host=document.getElementById('vuRecoveryOrders');if(!host)return;
 const query=norm(q),visible=query?rows.filter(x=>searchText(x).includes(query)):rows;
 document.getElementById('vuRecoveryCount').textContent=String(visible.length);
 host.innerHTML=visible.map(o=>`<button class="list-item" type="button" data-recovery-order="${safe(o.id)}" style="width:100%;text-align:left"><strong>${safe(o.orderNumber||'No number')} · ${safe(o.customerName||'Unknown customer')}</strong><p class="muted">${safe(o.status||'No status')} · ${safe(o.source||'No source')} · ${(o.lines||[]).length} line${(o.lines||[]).length===1?'':'s'}</p></button>`).join('')||'<div class="empty">No stored orders are visible on this device.</div>';
 host.querySelectorAll('[data-recovery-order]').forEach(b=>b.onclick=()=>showOrder(b.dataset.recoveryOrder));
}
async function open(){
 const role=window.VUFactoryOS?.role?.()||'Management';if(!['Management','Office'].includes(role))return window.VUOfficeIntakeOriginalOpen?.();
 rows=(await window.getAll('orders')).slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
 if(window.pageTitle)window.pageTitle.textContent='Orders';const back=document.getElementById('backBtn');if(back){back.classList.remove('hidden');back.onclick=()=>window.navigate?.('dashboard')}
 window.main.innerHTML=`<section class="vu-office-intake"><div class="card"><div class="eyebrow">RECOVERY MODE</div><h2>All stored orders</h2><p class="muted">This page shows every order stored on this device, including orders whose source is not marked Sage. It is read-only while we verify the data.</p></div><section class="card" style="margin-top:12px"><div class="section-head"><div><h3>Stored orders</h3><p class="muted">Search by order number, customer or source.</p></div><span class="badge" id="vuRecoveryCount">${rows.length}</span></div><div class="vu-office-search"><input id="vuRecoverySearch" type="search" placeholder="Search all stored orders…" autocomplete="off"><button class="secondary" id="vuRecoveryClear" type="button">Clear</button></div><div id="vuRecoveryOrders"></div></section></section>`;
 const search=document.getElementById('vuRecoverySearch');search.oninput=()=>render(search.value);document.getElementById('vuRecoveryClear').onclick=()=>{search.value='';render();search.focus()};render();
}
const original=window.VUOfficeIntake?.open?.bind(window.VUOfficeIntake);window.VUOfficeIntakeOriginalOpen=original;
if(window.VUOfficeIntake)window.VUOfficeIntake.open=open;if(window.VUFactoryOfficeIntake)window.VUFactoryOfficeIntake.open=open;
window.VUFactoryOrderRecovery={version:'2.8.5-recovery',open,render};
})();