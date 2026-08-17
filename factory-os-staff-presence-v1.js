/* Factory OS 2.10.42 — low-data staff presence and Management status panel. */
(function(){
'use strict';
if(window.VUFactoryStaffPresence)return;
const KIND='FACTORY_STAFF_PRESENCE',SESSION_KEY='vu-shared-session',ROLE_KEY='vu-shared-factory-role';
const HEARTBEAT_MS=5*60*1000,ONLINE_MS=7*60*1000,STALE_MS=30*60*1000;
let heartbeatTimer=null,lastPublishedAt=0,lastSyncAt=null,renderTimer=null;
function role(){return localStorage.getItem(ROLE_KEY)||window.VUFactoryOS?.role?.()||'Unknown'}
function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function user(){return session()?.user||null}
function deviceId(){try{return window.VUDeviceId?.()||localStorage.getItem('vu-device-id')||'unknown-device'}catch{return 'unknown-device'}}
function recordId(){const u=user();if(!u?.id)return null;return `staff-presence::${u.id}::${deviceId()}`}
function route(){return document.body?.dataset?.route||window.VUFactoryRuntime?.roleWorkRoute?.()||'dashboard'}
function deviceLabel(){const r=role();return r==='Management'?'Management device':`${r} device`}
async function publish({force=false}={}){
 const u=user(),id=recordId();if(!u||!id||!window.putOne)return null;
 const now=Date.now();if(!force&&now-lastPublishedAt<HEARTBEAT_MS-5000)return null;lastPublishedAt=now;
 const iso=new Date(now).toISOString();
 const previous=await window.getOne?.('activities',id);
 const rec={
  ...(previous||{}),id,kind:KIND,userId:u.id,email:String(u.email||previous?.email||''),factoryRole:role(),deviceId:deviceId(),deviceLabel:deviceLabel(),
  lastSeenAt:iso,lastSyncAt:lastSyncAt||previous?.lastSyncAt||null,currentRoute:route(),online:true,updatedAt:iso,createdAt:previous?.createdAt||iso
 };
 await window.putOne('activities',rec);
 return rec;
}
async function rows(){return (await window.getAll?.('activities')||[]).filter(x=>x?.kind===KIND&&x?.lastSeenAt).sort((a,b)=>String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)))}
function statusOf(x,now=Date.now()){
 const age=now-new Date(x.lastSeenAt).getTime();
 if(age<=ONLINE_MS)return{label:'Online now',cls:'is-online'};
 if(age<=STALE_MS)return{label:'Recently online',cls:'is-recent'};
 return{label:'Offline',cls:'is-offline'};
}
function timeAgo(value){const t=new Date(value).getTime();if(!Number.isFinite(t))return'Unknown';const s=Math.max(0,Math.floor((Date.now()-t)/1000));if(s<60)return`${s}s ago`;const m=Math.floor(s/60);if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}
function safe(v){return window.esc?window.esc(v):String(v??'')}
async function panelMarkup(){
 const all=await rows(),now=Date.now(),online=all.filter(x=>statusOf(x,now).label==='Online now').length;
 const cards=all.length?all.map(x=>{const st=statusOf(x,now);return `<div class="fos-presence-row ${st.cls}"><span class="fos-presence-dot" aria-hidden="true"></span><div class="fos-presence-main"><strong>${safe(x.email||x.deviceLabel||'Staff device')}</strong><small>${safe(x.factoryRole||'Unknown role')} · ${safe(x.deviceLabel||'Device')}</small></div><div class="fos-presence-meta"><b>${safe(st.label)}</b><small>Seen ${safe(timeAgo(x.lastSeenAt))}${x.lastSyncAt?` · synced ${safe(timeAgo(x.lastSyncAt))}`:''}</small></div></div>`}).join(''):`<p class="muted">No staff devices have reported presence yet. They will appear here after opening Factory OS 2.10.42 or newer.</p>`;
 return `<section class="card" id="fosStaffPresencePanel"><div class="step-label">STAFF STATUS</div><div class="fos-presence-head"><div><h2>Connected staff</h2><p class="muted">Low-data presence from authorised Factory OS devices.</p></div><div class="fos-presence-count"><strong>${online}</strong><small>online now</small></div></div><div class="fos-presence-list">${cards}</div><p class="muted fos-presence-note">Online = activity within 7 minutes. This is operational presence, not GPS tracking.</p></section>`;
}
async function injectManagementPanel(){
 if(role()!=='Management')return;
 const main=window.main||document.getElementById('main');if(!main)return;
 const existing=document.getElementById('fosStaffPresencePanel');const html=await panelMarkup();
 if(existing){const tmp=document.createElement('div');tmp.innerHTML=html;existing.replaceWith(tmp.firstElementChild);return}
 const first=main.querySelector('section.card');if(first)first.insertAdjacentHTML('afterend',html);else main.insertAdjacentHTML('afterbegin',html);
}
function style(){if(document.getElementById('fosPresenceStyle'))return;const s=document.createElement('style');s.id='fosPresenceStyle';s.textContent='.fos-presence-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}.fos-presence-count{text-align:right}.fos-presence-count strong,.fos-presence-count small{display:block}.fos-presence-count strong{font-size:1.5rem}.fos-presence-count small{color:var(--muted);font-size:.74rem}.fos-presence-list{display:grid;gap:8px;margin-top:12px}.fos-presence-row{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:11px}.fos-presence-dot{width:10px;height:10px;border-radius:50%;background:#8b8b8b}.fos-presence-row.is-online .fos-presence-dot{background:#2f8f5b}.fos-presence-row.is-recent .fos-presence-dot{background:#c18a25}.fos-presence-main strong,.fos-presence-main small,.fos-presence-meta b,.fos-presence-meta small{display:block}.fos-presence-main small,.fos-presence-meta small{color:var(--muted);font-size:.72rem}.fos-presence-meta{text-align:right}.fos-presence-meta b{font-size:.78rem}.fos-presence-note{font-size:.72rem;margin-top:10px}@media(max-width:520px){.fos-presence-row{grid-template-columns:12px minmax(0,1fr)}.fos-presence-meta{grid-column:2;text-align:left}}';document.head.appendChild(s)}
function start(){
 style();
 clearInterval(heartbeatTimer);heartbeatTimer=setInterval(()=>{if(document.visibilityState==='visible')publish().catch(e=>console.warn('Presence heartbeat failed',e))},HEARTBEAT_MS);
 setTimeout(()=>publish({force:true}).catch(e=>console.warn('Initial presence heartbeat failed',e)),1200);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')publish().catch(()=>{})});
 window.addEventListener('online',()=>publish({force:true}).catch(()=>{}));
 window.addEventListener('vu:sync-status',e=>{const d=e.detail||{};if(d.lastSyncAt)lastSyncAt=d.lastSyncAt;if(role()==='Management'){clearTimeout(renderTimer);renderTimer=setTimeout(()=>injectManagementPanel().catch(()=>{}),300)}});
 const originalOpen=window.VUSharedAccess?.open;
 if(typeof originalOpen==='function')window.VUSharedAccess.open=async function(){await originalOpen.apply(this,arguments);if(role()==='Management')await injectManagementPanel()};
}
start();
window.VUFactoryStaffPresence={version:'2.10.42',publish,rows,statusOf,injectManagementPanel};
})();