/* Factory OS v1 — lightweight role-aware home module. */
(function(){
'use strict';
if(window.VUFactoryOSHome)return;
const escHtml=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const tiles={
 Management:[['Manufacturing','Casting, Packing and Resin','manufacturing'],['Finishing & Painting','Job colours and completion','painting'],['Orders','Active jobs and Sage imports','orders'],['Deliveries','Two-vehicle daily planning','deliveries'],['Collections','Collection readiness','collections'],['Stock','Inventory and adjustments','stock'],['Planning','Targets, capacity and risks','planning']],
 Office:[['Import / Update Orders','Import Sage job cards and revisions','order-intake'],['Order Status','Customer and job progress','orders'],['Delivery Schedule','Read delivery plans','deliveries'],['Collection Schedule','Read collection readiness','collections']],
 Casting:[['Today’s Casting','Casting requirements','division'],['Casting Stock','Record output and adjustments','stock']],
 Packing:[['Today’s Packing','Packing requirements','division'],['Packing Stock','Record output and adjustments','stock']],
 Resin:[['Today’s Resin','Resin requirements and dependencies','division'],['Resin Stock','Record output and adjustments','stock']],
 Painting:[['Finishing & Painting','Colours from confirmed jobs','division'],['Finished Stock','Record completed quantities','stock']],
 Delivery:[['Today’s Deliveries','Vehicle loads and stops','deliveries'],['Collections','Collection readiness','collections']]
};
function formatRand(n){try{return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(Number(n||0))}catch{return 'R '+Math.round(Number(n||0))}}
async function render(){
 if(!window.VUFactoryOS||!window.main)return;
 const role=VUFactoryOS.role();
 const snap=await VUFactoryOS.snapshot();
 const cfg=snap.settings;
 const list=tiles[role]||tiles.Management;
 main.innerHTML=`<section class="vu-fos"><div class="vu-fos-head"><div><small>VORSTER FACTORY OS</small><h2>${escHtml(role)}</h2><p>${navigator.onLine?'Online':'Offline mode'}</p></div><div class="vu-fos-stat"><strong>${snap.activeOrders.length}</strong><span>active jobs</span></div></div>${role==='Management'?`<div class="vu-fos-metrics"><div><span>Outstanding order value</span><strong>${formatRand(snap.outstandingOrderValue)}</strong></div><div><span>Daily minimum</span><strong>${formatRand(cfg.dailyDispatchMinimum)}</strong></div><div><span>Profit target</span><strong>${formatRand(cfg.dailyProfitTarget)}</strong></div><div><span>Vehicles</span><strong>${Number(cfg.vehicleCount||2)}</strong></div></div>`:''}<div class="vu-fos-grid">${list.map(([t,d,a])=>`<button class="vu-fos-tile" data-fos-action="${escHtml(a)}"><strong>${escHtml(t)}</strong><span>${escHtml(d)}</span></button>`).join('')}</div></section>`;
 bind(role);
}
function bind(role){document.querySelectorAll('[data-fos-action]').forEach(btn=>btn.onclick=()=>open(btn.dataset.fosAction,role));}
function open(action,role){
 if(action==='orders'&&typeof navigate==='function')return navigate('orders');
 if(action==='deliveries'&&typeof navigate==='function')return navigate('deliveries');
 if(action==='order-intake'){
  if(typeof window.openJobCardImport==='function')return window.openJobCardImport();
  if(window.VUJobCardImport&&typeof window.VUJobCardImport.open==='function')return window.VUJobCardImport.open();
  alert('Sage job-card import is not connected to this screen yet.');return;
 }
 if(action==='division'&&window.VUStrictDivisionWorksheets?.openPicker)return window.VUStrictDivisionWorksheets.openPicker(role);
 alert('This Factory OS section is next in the build sequence.');
}
function injectStyle(){if(document.getElementById('vuFactoryOSHomeStyle'))return;const s=document.createElement('style');s.id='vuFactoryOSHomeStyle';s.textContent='.vu-fos{padding:16px;max-width:1100px;margin:auto}.vu-fos-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:16px}.vu-fos-head small{letter-spacing:.12em;opacity:.65}.vu-fos-head h2{margin:.2rem 0;font-size:1.8rem}.vu-fos-head p{margin:0;opacity:.65}.vu-fos-stat,.vu-fos-metrics>div,.vu-fos-tile{border:1px solid rgba(120,150,140,.25);border-radius:16px;background:rgba(120,150,140,.07)}.vu-fos-stat{padding:12px 14px;min-width:88px}.vu-fos-stat strong{display:block;font-size:1.5rem}.vu-fos-stat span,.vu-fos-metrics span,.vu-fos-tile span{display:block;opacity:.68;font-size:.84rem}.vu-fos-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px}.vu-fos-metrics>div{padding:12px}.vu-fos-metrics strong{display:block;margin-top:4px}.vu-fos-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.vu-fos-tile{text-align:left;color:inherit;padding:18px;min-height:105px}.vu-fos-tile strong{display:block;font-size:1.03rem;margin-bottom:6px}@media(max-width:620px){.vu-fos-grid{grid-template-columns:1fr}.vu-fos-metrics{grid-template-columns:1fr 1fr}}';document.head.appendChild(s)}
injectStyle();window.VUFactoryOSHome={version:'1.0.0',render};
})();