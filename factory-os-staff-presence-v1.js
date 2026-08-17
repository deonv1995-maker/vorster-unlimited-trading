/* Factory OS 2.10.44 — Management-only staff email-to-division register. */
(function(){
'use strict';
if(window.VUFactoryStaffPresence)return;
const KIND='FACTORY_STAFF_PRESENCE',SESSION_KEY='vu-shared-session',ROLE_KEY='vu-shared-factory-role';
function role(){return localStorage.getItem(ROLE_KEY)||window.VUFactoryOS?.role?.()||'Unknown'}
function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function user(){return session()?.user||null}
function deviceId(){try{return window.VUDeviceId?.()||localStorage.getItem('vu-device-id')||'unknown-device'}catch{return 'unknown-device'}}
function recordId(){const u=user();if(!u?.id)return null;return `staff-presence::${u.id}::${deviceId()}`}
function safe(v){return window.esc?window.esc(v):String(v??'')}
async function publish(){
 const u=user(),id=recordId();if(!u||!id||!window.putOne)return null;
 const now=new Date().toISOString(),previous=await window.getOne?.('activities',id);
 const rec={...(previous||{}),id,kind:KIND,userId:u.id,email:String(u.email||previous?.email||''),factoryRole:role(),deviceId:deviceId(),updatedAt:now,createdAt:previous?.createdAt||now};
 await window.putOne('activities',rec);return rec;
}
async function rows(){
 const all=(await window.getAll?.('activities')||[]).filter(x=>x?.kind===KIND&&x?.email);
 const byEmail=new Map();
 for(const x of all.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))){
  const email=String(x.email||'').trim().toLowerCase();if(!email||byEmail.has(email))continue;byEmail.set(email,x);
 }
 return [...byEmail.values()].sort((a,b)=>String(a.factoryRole||'').localeCompare(String(b.factoryRole||''))||String(a.email||'').localeCompare(String(b.email||'')));
}
async function panelMarkup(){
 const all=(await rows()).filter(x=>x.factoryRole!=='Management');
 const body=all.length?all.map(x=>`<div class="fos-staff-map-row"><strong>${safe(x.email)}</strong><span>${safe(x.factoryRole||'Unassigned')}</span></div>`).join(''):`<p class="muted">No staff logins have reported their assigned division yet.</p>`;
 return `<section class="card" id="fosStaffPresencePanel"><div class="step-label">STAFF LOGINS</div><h2>Email & division</h2><p class="muted">Shows which staff email is assigned to which Factory OS division.</p><div class="fos-staff-map-list">${body}</div></section>`;
}
async function injectManagementPanel(){
 if(role()!=='Management')return;
 const main=window.main||document.getElementById('main');if(!main)return;
 const existing=document.getElementById('fosStaffPresencePanel'),html=await panelMarkup();
 if(existing){const tmp=document.createElement('div');tmp.innerHTML=html;existing.replaceWith(tmp.firstElementChild);return}
 const first=main.querySelector('section.card');if(first)first.insertAdjacentHTML('afterend',html);else main.insertAdjacentHTML('afterbegin',html);
}
function style(){if(document.getElementById('fosPresenceStyle'))return;const s=document.createElement('style');s.id='fosPresenceStyle';s.textContent='.fos-staff-map-list{display:grid;gap:8px;margin-top:12px}.fos-staff-map-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:12px}.fos-staff-map-row span{font-weight:800;color:var(--accent)}@media(max-width:520px){.fos-staff-map-row{grid-template-columns:1fr}.fos-staff-map-row span{justify-self:start}}';document.head.appendChild(s)}
function start(){
 style();setTimeout(()=>publish().catch(()=>{}),1200);
 const originalOpen=window.VUSharedAccess?.open;
 if(typeof originalOpen==='function')window.VUSharedAccess.open=async function(){await originalOpen.apply(this,arguments);if(role()==='Management')await injectManagementPanel()};
 window.addEventListener('vu:sync-status',()=>{if(role()==='Management')setTimeout(()=>injectManagementPanel().catch(()=>{}),250)});
}
start();
window.VUFactoryStaffPresence={version:'2.10.44',publish,rows,injectManagementPanel};
})();