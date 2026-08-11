/* V9.0.76 — time-window delivery logistics planner.
   Builds a proposed route from genuinely delivery-ready orders using cached customer coordinates,
   customer opening/closing windows, stop service time, road travel durations and a latest depot return.
   Geocoding is user-triggered and cached; routing uses OSRM with a straight-line fallback. */
(function(){
'use strict';
if(window.VUDeliveryLogisticsPlanner)return;
const CLOSED=new Set(['draft','cancelled','delivered','collected','completed','invoiced','declined']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dateKey=v=>{const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(v,days)=>{const d=new Date(v||Date.now());d.setDate(d.getDate()+days);while([0,6].includes(d.getDay()))d.setDate(d.getDate()+1);return d};
const minutes=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?(Number(m[1])*60+Number(m[2])):null};
const clock=m=>{m=Math.round(m);return `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`};
const routeSettings=()=>({
  depotAddress:localStorage.getItem('vu-route-depot-address')||'FARM118, UNIT 426, RIETFONTEIN, MULDERSDRIFT, 1747, South Africa',
  depart:localStorage.getItem('vu-route-depart')||'07:00',
  returnBy:localStorage.getItem('vu-route-return')||'16:30',
  defaultOpen:localStorage.getItem('vu-route-open')||'08:00',
  defaultClose:localStorage.getItem('vu-route-close')||'17:00',
  serviceMinutes:Number(localStorage.getItem('vu-route-service')||20),
  trafficFactor:Number(localStorage.getItem('vu-route-traffic-factor')||1.18)
});
function addressOf(customer,order){return String(order?.deliveryAddress||customer?.deliveryAddress||customer?.address||customer?.location||customer?.physicalAddress||customer?.streetAddress||'').trim()}
function latOf(c){return Number(c?.deliveryLatitude??c?.latitude??c?.lat)}
function lonOf(c){return Number(c?.deliveryLongitude??c?.longitude??c?.lng??c?.lon)}
function hasCoords(c){return Number.isFinite(latOf(c))&&Number.isFinite(lonOf(c))}
function ready(o){const wf=norm(o?.workflowStage),ps=norm(o?.paintingStatus);return !CLOSED.has(norm(o?.status))&&(wf==='delivery'||wf==='delivery-scheduled'||ps==='completed')}
function hoursOf(c,settings){return {open:c?.deliveryOpenTime||c?.openTime||settings.defaultOpen,close:c?.deliveryCloseTime||c?.closeTime||settings.defaultClose,service:Number(c?.deliveryServiceMinutes||settings.serviceMinutes)}}
function rad(x){return x*Math.PI/180}
function hav(a,b){const R=6371,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
async function geocodeAddress(address){
  const cacheKey='vu-geocode:'+address.toLowerCase();try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.lat&&cached?.lon)return cached}catch{}
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=za&q=${encodeURIComponent(address)}`;
  const r=await fetch(url,{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error(`Address lookup failed (${r.status})`);const rows=await r.json();if(!rows?.length)throw new Error(`Address not found: ${address}`);
  const out={lat:Number(rows[0].lat),lon:Number(rows[0].lon),displayName:rows[0].display_name,address};localStorage.setItem(cacheKey,JSON.stringify(out));return out;
}
async function ensureDepot(settings){
  try{const c=JSON.parse(localStorage.getItem('vu-route-depot-coords')||'null');if(c?.lat&&c?.lon&&c.address===settings.depotAddress)return c}catch{}
  const c=await geocodeAddress(settings.depotAddress);localStorage.setItem('vu-route-depot-coords',JSON.stringify(c));return c;
}
async function locateCustomer(customer,order){
  if(hasCoords(customer))return {lat:latOf(customer),lon:lonOf(customer)};
  const address=addressOf(customer,order);if(!address)throw new Error(`${customer?.name||order?.customerName||'Customer'} has no delivery address`);
  const c=await geocodeAddress(address),now=new Date().toISOString();
  await putOne('customers',{...customer,deliveryLatitude:c.lat,deliveryLongitude:c.lon,geocodedDeliveryAddress:address,geocodedAt:now,updatedAt:now});
  return c;
}
async function roadMatrix(points,trafficFactor){
  const coords=points.map(p=>`${p.lon},${p.lat}`).join(';');
  try{
    const r=await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`);if(!r.ok)throw new Error('Routing service unavailable');const j=await r.json();if(j.code!=='Ok'||!j.durations)throw new Error(j.message||'Routing matrix failed');
    return {dur:j.durations.map(row=>row.map(v=>v==null?Infinity:(v/60)*trafficFactor)),dist:(j.distances||[]).map(row=>row.map(v=>v==null?Infinity:v/1000)),source:'OSRM road routing'};
  }catch(e){
    console.warn('OSRM fallback',e);const dur=[],dist=[];for(let i=0;i<points.length;i++){dur[i]=[];dist[i]=[];for(let j=0;j<points.length;j++){const km=hav(points[i],points[j])*1.28;dist[i][j]=km;dur[i][j]=(km/45)*60*trafficFactor}}
    return {dur,dist,source:'Estimated road time fallback'};
  }
}
function optimize(stops,matrix,settings){
  const depart=minutes(settings.depart),returnBy=minutes(settings.returnBy);let now=depart,current=0,totalKm=0;const left=new Set(stops.map((_,i)=>i+1)),route=[],excluded=[];
  while(left.size){let best=null;
    for(const idx of left){const s=stops[idx-1],travel=matrix.dur[current][idx],arrival=now+travel,open=minutes(s.open),close=minutes(s.close),start=Math.max(arrival,open),leave=start+s.service,back=matrix.dur[idx][0];const feasible=Number.isFinite(travel)&&Number.isFinite(back)&&start<=close&&leave+back<=returnBy;if(!feasible)continue;const score=(start-now)+(travel*.15)+(s.dueSoon?-20:0);if(!best||score<best.score)best={idx,s,travel,arrival,start,leave,back,score}}
    if(!best)break;left.delete(best.idx);totalKm+=matrix.dist[current][best.idx]||0;route.push({...best.s,travelMinutes:best.travel,arrivalMinutes:best.arrival,startMinutes:best.start,leaveMinutes:best.leave,waitMinutes:Math.max(0,best.start-best.arrival)});now=best.leave;current=best.idx;
  }
  totalKm+=matrix.dist[current]?.[0]||0;const returnMinutes=now+(matrix.dur[current]?.[0]||0);
  for(const idx of left){const s=stops[idx-1],arrival=now+(matrix.dur[current]?.[idx]||Infinity),reason=arrival>minutes(s.close)?'Would arrive after customer closing time':'Would make the vehicle return too late';excluded.push({...s,reason})}
  return {route,excluded,totalKm,departMinutes:depart,returnMinutes,returnByMinutes:returnBy};
}
async function buildPlan(date,locateMissing=false){
  const settings=routeSettings(),d=dateKey(date||addDays(new Date(),1)),[orders,customers]=await Promise.all([getAll('orders'),getAll('customers')]),byId=new Map(customers.map(c=>[String(c.id),c]));
  const readyOrders=orders.filter(ready);const groups=new Map();
  for(const o of readyOrders){const c=byId.get(String(o.customerId))||{id:o.customerId,name:o.customerName};const key=String(c?.id||o.customerName||o.id);if(!groups.has(key))groups.set(key,{customer:c,orders:[],value:0});const g=groups.get(key);g.orders.push(o);g.value+=Number(o.grandTotal||0)}
  const depot=await ensureDepot(settings),stops=[],missing=[];
  for(const g of groups.values()){
    let c=g.customer,coords=hasCoords(c)?{lat:latOf(c),lon:lonOf(c)}:null;
    if(!coords&&locateMissing){try{coords=await locateCustomer(c,g.orders[0]);c=await getOne('customers',c.id)||c;await new Promise(r=>setTimeout(r,1100))}catch(e){missing.push({group:g,reason:e.message});continue}}
    if(!coords){missing.push({group:g,reason:'Location not resolved yet'});continue}
    const h=hoursOf(c,settings);stops.push({customer:c,orders:g.orders,value:g.value,lat:coords.lat,lon:coords.lon,open:h.open,close:h.close,service:h.service,dueSoon:g.orders.some(o=>o.dueDate&&o.dueDate<=d),address:addressOf(c,g.orders[0])})
  }
  if(!stops.length)return {date:d,settings,depot,route:[],excluded:[],missing,totalKm:0,source:'No route',readyOrders};
  const matrix=await roadMatrix([{lat:depot.lat,lon:depot.lon},...stops.map(s=>({lat:s.lat,lon:s.lon}))],settings.trafficFactor),opt=optimize(stops,matrix,settings);
  return {...opt,date:d,settings,depot,missing,source:matrix.source,readyOrders};
}
function mapsUrl(plan){const pts=plan.route.map(s=>`${s.lat},${s.lon}`);if(!pts.length)return'';const origin=`${plan.depot.lat},${plan.depot.lon}`,destination=origin,waypoints=pts.join('|');return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`}
function ensureStyles(){if(document.getElementById('deliveryLogisticsStyles'))return;const s=document.createElement('style');s.id='deliveryLogisticsStyles';s.textContent=`.route-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.route-summary>div{padding:10px;border:1px solid var(--border);border-radius:14px;text-align:center}.route-stop{padding:12px;margin:8px 0;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}.route-stop h3{margin:2px 0}.route-stop small{display:block;color:var(--muted);line-height:1.35}.route-warning{border-color:#b88468}.route-settings{display:grid;grid-template-columns:1fr 1fr;gap:8px}.route-settings label{margin:0}.route-actions{display:flex;gap:8px;flex-wrap:wrap}.route-actions button{flex:1;min-width:150px}`;document.head.appendChild(s)}
async function openPlanner(){
  ensureStyles();const settings=routeSettings(),dialog=document.getElementById('dialog'),tomorrow=dateKey(addDays(new Date(),1));
  dialog.innerHTML=`<div class="modal-form" style="padding:20px;max-height:94vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:12px"><div><div class="eyebrow">DELIVERY LOGISTICS</div><h2 style="margin:4px 0">Tomorrow's proposed route</h2><p class="muted">Plans only delivery-ready orders. Travel time, opening hours, unloading time and factory return deadline all count.</p></div><button class="icon-btn" data-close>×</button></div><label>Route date<input id="routePlanDate" type="date" value="${tomorrow}"></label><div class="route-settings"><label>Depart factory<input id="routeDepart" type="time" value="${safe(settings.depart)}"></label><label>Return by<input id="routeReturn" type="time" value="${safe(settings.returnBy)}"></label><label>Default customer opens<input id="routeOpen" type="time" value="${safe(settings.defaultOpen)}"></label><label>Default customer closes<input id="routeClose" type="time" value="${safe(settings.defaultClose)}"></label><label>Default unload minutes<input id="routeService" type="number" min="5" step="5" value="${settings.serviceMinutes}"></label><label>Traffic allowance<input id="routeTraffic" type="number" min="1" max="2" step="0.05" value="${settings.trafficFactor}"></label></div><label>Factory / depot address<input id="routeDepotAddress" value="${safe(settings.depotAddress)}"></label><div class="route-actions"><button id="routeLocate" type="button">Locate missing customer addresses</button><button id="routeBuild" class="primary" type="button">Build proposed route</button></div><div id="routePlanBody" class="card" style="margin-top:12px"><small class="muted">Build the route to see tomorrow's feasible stops.</small></div><small class="muted" style="display:block;margin-top:10px">Address lookup: © OpenStreetMap contributors (Nominatim). Road routing: OSRM/OpenStreetMap. Customer coordinates are cached after lookup.</small></div>`;dialog.showModal();const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;
  const saveSettings=()=>{localStorage.setItem('vu-route-depot-address',document.getElementById('routeDepotAddress').value.trim());localStorage.setItem('vu-route-depart',document.getElementById('routeDepart').value);localStorage.setItem('vu-route-return',document.getElementById('routeReturn').value);localStorage.setItem('vu-route-open',document.getElementById('routeOpen').value);localStorage.setItem('vu-route-close',document.getElementById('routeClose').value);localStorage.setItem('vu-route-service',document.getElementById('routeService').value);localStorage.setItem('vu-route-traffic-factor',document.getElementById('routeTraffic').value)};
  const render=plan=>{const host=document.getElementById('routePlanBody'),routeValue=plan.route.reduce((s,x)=>s+x.value,0),url=mapsUrl(plan);host.innerHTML=`<div class="route-summary"><div><small>Stops</small><strong>${plan.route.length}</strong></div><div><small>Route</small><strong>${Math.round(plan.totalKm)} km</strong></div><div><small>Return</small><strong>${plan.route.length?clock(plan.returnMinutes):'—'}</strong></div></div><small class="muted">${safe(plan.source)} · Planned value ${typeof money==='function'?money(routeValue):routeValue}</small>${plan.route.map((s,i)=>`<div class="route-stop"><small>Stop ${i+1} · drive ${Math.round(s.travelMinutes)} min${s.waitMinutes?` · wait ${Math.round(s.waitMinutes)} min`:''}</small><h3>${safe(s.customer?.name||s.orders[0]?.customerName||'Customer')}</h3><small>ETA ${clock(s.arrivalMinutes)} · service ${clock(s.startMinutes)}–${clock(s.leaveMinutes)} · customer ${safe(s.open)}–${safe(s.close)}</small><small>${safe(s.orders.map(o=>o.orderNumber||'Order').join(' · '))}</small></div>`).join('')}${plan.excluded.length?`<h3>Ready but does not fit</h3>${plan.excluded.map(s=>`<div class="route-stop route-warning"><b>${safe(s.customer?.name||'Customer')}</b><small>${safe(s.reason)}</small></div>`).join('')}`:''}${plan.missing.length?`<h3>Location needed</h3>${plan.missing.map(x=>`<div class="route-stop route-warning"><b>${safe(x.group.customer?.name||x.group.orders[0]?.customerName||'Customer')}</b><small>${safe(x.reason)}</small></div>`).join('')}`:''}<div class="route-actions">${url?`<button type="button" id="routeOpenMaps">Open route in Google Maps</button>`:''}<button type="button" id="routeSaveProposal">Save proposed route</button></div>`;if(url)document.getElementById('routeOpenMaps').onclick=()=>window.open(url,'_blank');document.getElementById('routeSaveProposal').onclick=async()=>{const id=`deliveryroute:${plan.date}`,existing=await getOne('productionJobs',id),now=new Date().toISOString();await putOne('productionJobs',{...(existing||{}),id,kind:'deliveryRoutePlan',workDate:plan.date,status:'Proposed',departureTime:plan.settings.depart,returnBy:plan.settings.returnBy,estimatedReturn:plan.route.length?clock(plan.returnMinutes):'',distanceKm:plan.totalKm,stops:plan.route.map((s,i)=>({position:i+1,customerId:s.customer?.id||'',customerName:s.customer?.name||s.orders[0]?.customerName||'',orderIds:s.orders.map(o=>o.id),orderNumbers:s.orders.map(o=>o.orderNumber),eta:clock(s.arrivalMinutes),serviceStart:clock(s.startMinutes),serviceEnd:clock(s.leaveMinutes),open:s.open,close:s.close,latitude:s.lat,longitude:s.lon,address:s.address,value:s.value})),excluded:plan.excluded.map(s=>({customerId:s.customer?.id||'',customerName:s.customer?.name||'',reason:s.reason})),createdAt:existing?.createdAt||now,updatedAt:now});notify?.('Proposed delivery route saved');};};
  const build=async locate=>{saveSettings();const host=document.getElementById('routePlanBody');host.innerHTML='<small class="muted">Calculating locations and travel times…</small>';try{const plan=await buildPlan(document.getElementById('routePlanDate').value,locate);render(plan)}catch(e){console.error(e);host.innerHTML=`<div class="route-warning">${safe(e.message||'Could not build route')}</div>`}};
  document.getElementById('routeBuild').onclick=()=>build(false);document.getElementById('routeLocate').onclick=()=>build(true);
}
function addButton(){const host=document.getElementById('divisionDailyWorkLauncher')||document.getElementById('main');if(!host||host.querySelector('[data-delivery-logistics]'))return;const b=document.createElement('button');b.type='button';b.dataset.deliveryLogistics='1';b.className='primary';b.style.cssText='width:100%;margin-top:10px;min-height:50px;font-weight:800';b.textContent="Plan tomorrow's route by time & location";b.onclick=openPlanner;host.appendChild(b)}
const base=window.productionPage;if(typeof base==='function'){window.productionPage=async function deliveryLogisticsPage(...args){const r=await base(...args);addButton();return r};try{productionPage=window.productionPage}catch{}}
window.openDeliveryLogisticsPlanner=openPlanner;window.VUDeliveryLogisticsPlanner={version:'9.0.76',open:openPlanner,buildPlan,ready};
})();