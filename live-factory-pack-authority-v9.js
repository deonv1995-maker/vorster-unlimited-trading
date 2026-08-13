/* V9.1.10 — live Factory Pack authority.
   Factory paperwork is recalculated from the latest production, Painting, stock, order and fulfilment data every time it is opened/printed.
   No morning freeze: the saved pack is a current snapshot, not a permanent issued instruction set. */
(function(){
'use strict';
if(window.VULiveFactoryPackAuthority)return;
const prior=window.VUDailyFactoryPack;
if(!prior?.buildPack||!prior?.printPack)return;
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
const liveBuild=async date=>prior.buildPack(dk(date||new Date()),true);
const livePrint=async date=>prior.printPack(dk(date||new Date()),true);
async function openHub(date){
  const d=dk(date||new Date()),dialog=document.getElementById('dialog');
  if(!dialog)return;
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:94vh;overflow:auto"><div class="dialog-head"><div><div class="eyebrow">LIVE FACTORY PLAN</div><h2>${safe(new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00')))}</h2><p class="muted">The factory paperwork recalculates from the latest app information every time you open or print it. Production, Painting, stock corrections, order updates and dispatch changes are included.</p></div><button class="close-btn" data-close>×</button></div><section class="card"><h3>Current Factory Pack</h3><p class="muted">Open/print the newest instructions. Older saved paperwork is not treated as authoritative after new information is captured.</p><button type="button" class="primary" style="width:100%;min-height:54px" data-current>Recalculate & Print Current Factory Pack</button></section><section class="card"><h3>Capture physical results</h3><p class="muted">Read production, Painting and physical dispatch back into the app. The next print will immediately reflect those results.</p><button type="button" class="secondary" style="width:100%;min-height:54px" data-evening>Capture Factory Results</button></section></div>`;
  dialog.showModal();const close=()=>{try{dialog.close()}catch{}};dialog.querySelector('[data-close]').onclick=close;
  dialog.querySelector('[data-current]').onclick=async()=>{const b=dialog.querySelector('[data-current]'),old=b.textContent;b.disabled=true;b.textContent='Recalculating…';try{await livePrint(d);close()}catch(e){console.error('Live Factory Pack',e);alert(e?.message||'Could not recalculate factory pack');b.disabled=false;b.textContent=old}};
  dialog.querySelector('[data-evening]').onclick=async()=>{close();await prior.endDay?.(d)};
}
function rebind(){
  document.querySelectorAll('[data-factory-pack-quick]').forEach(host=>{const a=host.querySelector('[data-open-pack]'),b=host.querySelector('[data-capture-pack]');if(a){a.textContent='Current Factory Pack';a.onclick=()=>openHub(new Date())}if(b)b.onclick=()=>prior.endDay?.(new Date())});
}
const obs=new MutationObserver(()=>setTimeout(rebind,50));obs.observe(document.body,{childList:true,subtree:true});setTimeout(rebind,250);
window.openDailyFactoryPack=openHub;
window.VUDailyFactoryPack={...prior,version:'9.1.10',open:openHub,buildPack:liveBuild,printPack:livePrint,live:true};
window.VULiveFactoryPackAuthority={version:'9.1.10',open:openHub,buildPack:liveBuild,printPack:livePrint};
})();