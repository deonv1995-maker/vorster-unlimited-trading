/* Factory OS role control — refactor branch only. */
(function(){
'use strict';
if(window.VUManagerRoleControl)return;
const LEGACY_KEY='vu-digital-factory-device-role';
const FACTORY_KEY='vu-factory-os-role';
const ROLES=['Management','Office','Casting','Packing','Resin','Painting','Delivery'];
function currentRole(){
 const direct=localStorage.getItem(FACTORY_KEY);
 if(ROLES.includes(direct))return direct;
 const legacy=localStorage.getItem(LEGACY_KEY);
 if(legacy==='Manager')return 'Management';
 if(ROLES.includes(legacy))return legacy;
 return 'Management';
}
function saveRole(value){
 if(!ROLES.includes(value))return;
 localStorage.setItem(FACTORY_KEY,value);
 localStorage.setItem(LEGACY_KEY,value==='Management'?'Manager':value);
}
function openRole(){
 const dialog=document.getElementById('dialog');
 if(!dialog)return;
 const options=ROLES.map(r=>'<option '+(r===currentRole()?'selected':'')+'>'+r+'</option>').join('');
 dialog.innerHTML='<div class="modal-form" style="padding:20px"><div class="dialog-head"><div><div class="eyebrow">FACTORY OS ROLE</div><h2>Choose this device role</h2></div><button class="close-btn" data-close>×</button></div><label>Role<select id="vuRolePick">'+options+'</select></label><button class="primary" data-save>Save and reload</button></div>';
 dialog.showModal();
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelector('[data-save]').onclick=()=>{saveRole(document.getElementById('vuRolePick').value);location.reload()};
}
function attach(){
 if(currentRole()!=='Management'||document.getElementById('vuDeviceRoleBtn'))return;
 const theme=document.getElementById('themeBtn');
 const top=theme&&theme.parentElement;
 if(!top)return;
 const button=document.createElement('button');
 button.id='vuDeviceRoleBtn';
 button.className='theme-btn';
 button.type='button';
 button.title='Factory OS device role';
 button.setAttribute('aria-label','Factory OS device role');
 button.textContent='R';
 button.onclick=openRole;
 top.insertBefore(button,theme);
}
setTimeout(attach,450);
window.VUManagerRoleControl={version:'10.0.0',roles:ROLES,currentRole,saveRole,attach,openRole};
})();