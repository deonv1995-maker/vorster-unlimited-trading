/* Factory OS v1 — Office order intake workspace. */
(function(){
'use strict';
if(window.VUOfficeIntake)return;
const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const date=v=>{try{return new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium'}).format(new Date(v))}catch{return String(v||'—')}};
async function open(){
 const role=window.VUFactoryOS?.role?.()||'Management';
 if(!['Management','Office'].includes(role)){alert('Order intake is not available for this device role.');return}
 const orders=(await getAll('orders')).filter(o=>String(o.source||'').toLowerCase().includes('sage')).sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
 if(window.pageTitle)pageTitle.textContent='Order Intake';
 if(window.backBtn){backBtn.classList.remove('hidden');backBtn.onclick=()=>window.VUFactoryOSHome?.render?.()}
 main.innerHTML=`<section class="vu-office-intake"><div class="card"><div class="section-head"><div><div class="eyebrow">OFFICE</div><h2>Import / update Sage job cards</h2><p class="muted">Use either Sage account PDF. Existing document numbers update the same order instead of creating a second job.</p></div></div><button class="primary" id="vuOfficeImportBtn">Import Sage PDF</button></div><section class="card" style="margin-top:12px"><div class="section-head"><div><h3>Recent Sage orders</h3><p class="muted">Latest imported or updated documents.</p></div><span class="badge">${orders.length}</span></div><div class="vu-office-list">${orders.slice(0,30).map(o=>`<button class="list-item" data-order-id="${safe(o.id)}" style="width:100%;text-align:left"><strong>${safe(o.orderNumber||'No number')} · ${safe(o.customerName||'Unknown customer')}</strong><p class="muted">${date(o.updatedAt||o.createdAt)} · ${(o.lines||[]).length} product line${(o.lines||[]).length===1?'':'s'} · ${safe(o.status||'Confirmed')}</p></button>`).join('')||'<div class="empty">No Sage orders imported yet.</div>'}</div></section></section>`;
 document.getElementById('vuOfficeImportBtn').onclick=()=>{if(typeof window.openJobCardImport==='function')return window.openJobCardImport();alert('Sage importer is unavailable on this build.')};
 document.querySelectorAll('[data-order-id]').forEach(b=>b.onclick=()=>{if(typeof window.viewOrder==='function')return window.viewOrder(b.dataset.orderId);if(typeof navigate==='function')return navigate('orders')});
}
window.VUOfficeIntake={version:'1.0.0',open};
})();