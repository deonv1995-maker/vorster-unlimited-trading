/* Factory OS role control — refactor branch only. */
(function(){
'use strict';if(window.VUManagerRoleControl)return;
const LEGACY_KEY='vu-digital-factory-device-role',FACTORY_KEY='vu-factory-os-role';
const ROLES=['Management','Office','Casting','Packing','Resin','Painting','Delivery'];
const PERMISSIONS={
 Management:{orders:'write',deliveries:'write',collections:'write',inventory:'write',production:'write',planning:'write',settings:'write'},
 Office:{orders:'write',deliveries:'read',collections:'read',inventory:'none',production:'read',planning:'read',settings:'none'},
 Casting:{orders:'read',deliveries:'none',collections:'none',inventory:'write',production:'write',planning:'read',settings:'none'},
 Packing:{orders:'read',deliveries:'none',collections:'none',inventory:'write',production:'write',planning:'read',settings:'none'},
 Resin:{orders:'read',deliveries:'none',collections:'none',inventory:'write',production:'write',planning:'read',settings:'none'},
 Painting:{orders:'read',deliveries:'none',collections:'none',inventory:'write',production:'write',planning:'read',settings:'none'},
 Delivery:{orders:'read',deliveries:'write',collections:'read',inventory:'read',production:'none',planning:'read',settings:'none'}
};
function currentRole(){const direct=localStorage.getItem(FACTORY_KEY);if(ROLES.includes(direct))return direct;const legacy=localStorage.getItem(LEGACY_KEY);if(legacy==='Manager')return'Management';if(ROLES.includes(legacy))return legacy;return'Management'}
function saveRole(value){if(!ROLES.includes(value))return;localStorage.setItem(FACTORY_KEY,value);localStorage.setItem(LEGACY_KEY,value==='Management'?'Manager':value)}
function permission(area){return PERMISSIONS[currentRole()]?.[area]||'none'}
function canRead(area){return permission(area)==='read'||permission(area)==='write'}
function canWrite(area){return permission(area)==='write'}
function openRole(){const d=document.getElementById('dialog');if(!d)return;d.innerHTML=`<div class="modal-form" style="padding:20px"><div class="dialog-head"><div><div class="eyebrow">FACTORY OS ROLE</div><h2>Choose this device role</h2></div><button class="close-btn" data-close>×</button></div><label>Role<select id="vuRolePick">${ROLES.map(r=>`<option ${r===currentRole()?'selected':''}>${r}</option>`).join('')}</select></label><button class="primary" data-save>Save and reload</button></div>`;d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('[data-save]').onclick=()=>{saveRole(document.getElementById('vuRolePick').value);location.reload()}}
function attach(){if(currentRole()!=='Management'||document.getElementById('vuDeviceRoleBtn'))return;const theme=document.getElementById('themeBtn'),top=theme?.parentElement;if(!top)return;const b=document.createElement('button');b.id='vuDeviceRoleBtn';b.className='theme-btn';b.type='button';b.title='Factory OS device role';b.setAttribute('aria-label','Factory OS device role');b.textContent='R';b.onclick=openRole;top.insertBefore(b,theme)}
setTimeout(attach,450);
window.VUManagerRoleControl={version:'10.1.0',roles:ROLES,permissions:PERMISSIONS,currentRole,saveRole,permission,canRead,canWrite,attach,openRole};
})();