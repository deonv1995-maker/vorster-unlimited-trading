/* V9.0.93 — final Factory Pack fulfilment authority.
   Raw/finishing stay on the proven daily pack path. Dispatch is rebuilt from the same
   automatic fulfilment planner that owns the calendar, including hard fulfilment rules. */
(function(){
'use strict';
if(window.VUFactoryPackFulfilmentAuthority)return;
const base=window.VUDailyFactoryPack;
if(!base?.buildPack||!base?.printPack||!window.VUAutoFulfilmentPlanner?.build)return;
const n=v=>Math.max(0,Number(v||0));
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
async function customerMap(){const rows=await getAll('customers');return new Map(rows.map(c=>[String(c.id),c]));}
function addressOf(o,c){return String(o?.deliveryAddress||c?.deliveryAddress||c?.address||c?.location||'').trim();}
async function alignPack(date,force=false){
  const d=dk(date||new Date());
  const pack=await base.buildPack(d,force);
  const [plan,customers]=await Promise.all([window.VUAutoFulfilmentPlanner.build(),customerMap()]);
  const todays=(plan.assignments||[]).filter(a=>dk(a.date)===d);
  const delivery=[],collections=[];
  let pos=0;
  for(const a of todays){
    const o=a.order||{},p=a.progress||{},c=customers.get(String(o.customerId))||{};
    if(a.type==='Collection'){
      collections.push({orderId:o.id||'',orderNumber:o.orderNumber||'',customerName:o.customerName||c.name||'',requiredDate:a.commitment?.date||d,value:n(a.value||o.grandTotal),completionPercent:n(p.percent),source:a.source||'Algorithm planned',risk:a.risk||''});
      continue;
    }
    if(a.type!=='Delivery')continue;
    pos++;
    delivery.push({position:pos,orderId:o.id||'',orderNumber:o.orderNumber||'',customerName:o.customerName||c.name||'',eta:'',serviceStart:'',serviceEnd:'',address:addressOf(o,c),value:n(a.value||o.grandTotal),completionPercent:n(p.percent),rawPct:n(p.rawPct),source:a.source||'Algorithm planned',risk:a.risk||'',area:a.area||''});
  }
  const route=await getOne('productionJobs',`deliveryroute:${d}`);
  if(route?.kind==='deliveryRoutePlan'&&Array.isArray(route.stops)){
    const routeByOrder=new Map();
    for(const stop of route.stops){for(let i=0;i<(stop.orderIds||[]).length;i++)routeByOrder.set(String(stop.orderIds[i]),{stop,orderNumber:(stop.orderNumbers||[])[i]||''});}
    delivery.sort((a,b)=>{const ar=routeByOrder.get(String(a.orderId)),br=routeByOrder.get(String(b.orderId));return n(ar?.stop?.position||9999)-n(br?.stop?.position||9999)||a.position-b.position;});
    delivery.forEach((x,i)=>{const r=routeByOrder.get(String(x.orderId));x.position=i+1;if(!r)return;x.eta=r.stop.eta||'';x.serviceStart=r.stop.serviceStart||'';x.serviceEnd=r.stop.serviceEnd||'';x.address=r.stop.address||x.address;});
  }
  const now=new Date().toISOString();
  const aligned={...pack,algorithmFulfilmentVersion:String(window.VUAutoFulfilmentPlanner.version||''),algorithmFulfilmentGeneratedAt:plan.generatedAt||now,sections:{...(pack.sections||{}),delivery,collections},updatedAt:now};
  await putOne('productionJobs',aligned);
  return aligned;
}
async function printAligned(date,force=false){await alignPack(date,force);return base.printPack(dk(date||new Date()));}
async function openHub(date){
  const d=dk(date||new Date()),existing=await base.getPack(d),dialog=document.getElementById('dialog');
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:94vh;overflow:auto"><div class="dialog-head"><div><div class="eyebrow">DAILY FACTORY ROUTINE</div><h2>${safe(new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00')))}</h2><p class="muted">The printed pack uses the same optimiser and automatic fulfilment plan as the app calendar.</p></div><button class="close-btn" data-close>×</button></div><section class="card"><small>MORNING</small><h3>${existing?'Today\'s pack already issued':'Create today\'s official factory pack'}</h3><p class="muted">${existing?'Reprint the frozen plan, or rebuild intentionally if the physical instructions must change.':'Freezes Raw → Finishing/Painting → algorithm Delivery/Collection into one official pack.'}</p><button type="button" class="primary" style="width:100%;min-height:54px" data-morning>${existing?'Open / Print Today\'s Factory Pack':'Create & Print Today\'s Factory Pack'}</button>${existing?'<button type="button" class="ghost" style="width:100%;margin-top:8px" data-rebuild>Rebuild today\'s pack</button>':''}</section><section class="card"><small>END OF DAY</small><h3>Capture today’s paper results</h3><button type="button" class="secondary" style="width:100%;min-height:54px" data-evening>Capture Today’s Factory Results</button></section></div>`;
  dialog.showModal();const close=()=>{try{dialog.close()}catch{}};dialog.querySelector('[data-close]').onclick=close;
  dialog.querySelector('[data-morning]').onclick=async()=>{try{await printAligned(d,false);close()}catch(e){console.error(e);alert(e.message||'Could not create factory pack')}};
  dialog.querySelector('[data-evening]').onclick=async()=>{close();await base.endDay(d)};
  dialog.querySelector('[data-rebuild]')?.addEventListener('click',async()=>{if(!confirm('Rebuild today\'s official factory pack? This replaces the physical instructions already issued.'))return;try{await printAligned(d,true);close();notify?.('Today\'s factory pack rebuilt from the latest algorithm')}catch(e){console.error(e);alert(e.message||'Could not rebuild factory pack')}});
}
function rebindQuickButtons(){
  document.querySelectorAll('[data-factory-pack-quick]').forEach(host=>{const a=host.querySelector('[data-open-pack]'),b=host.querySelector('[data-capture-pack]');if(a)a.onclick=()=>openHub(new Date());if(b)b.onclick=()=>base.endDay(new Date());});
}
const dash=window.dashboard;if(typeof dash==='function'){window.dashboard=async function(...args){const r=await dash(...args);rebindQuickButtons();return r};try{dashboard=window.dashboard}catch{}}
const prod=window.productionPage;if(typeof prod==='function'){window.productionPage=async function(...args){const r=await prod(...args);rebindQuickButtons();return r};try{productionPage=window.productionPage}catch{}}
window.openDailyFactoryPack=openHub;
window.VUDailyFactoryPack={...base,version:'9.0.93',open:openHub,buildPack:alignPack,printPack:printAligned};
window.VUFactoryPackFulfilmentAuthority={version:'9.0.93',alignPack,printAligned};
})();
