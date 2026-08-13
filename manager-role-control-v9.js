/* V9.4.4 — Manager device-role control only. */
(function(){
'use strict';if(window.VUManagerRoleControl)return;
const KEY='vu-digital-factory-device-role',ROLES=['Manager','Casting','Packing','Resin','Painting','Delivery'];
const role=()=>String(localStorage.getItem(KEY)||'Manager');
function openRole(){const d=document.getElementById('dialog');if(!d)return;d.innerHTML=`<div class="modal-form" style="padding:20px"><div class="dialog-head"><div><div class="eyebrow">DEVICE ROLE</div><h2>Choose this phone's role</h2></div><button class="close-btn" data-close>×</button></div><label>Role<select id="vuRolePick">${ROLES.map(r=>`<option ${r===role()?'selected':''}>${r}</option>`).join('')}</select></label><button class="primary" data-save>Save and reload</button></div>`;d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('[data-save]').onclick=()=>{localStorage.setItem(KEY,document.getElementById('vuRolePick').value);location.reload()}}
function attach(){if(role()!=='Manager'||document.getElementById('vuDeviceRoleBtn'))return;const theme=document.getElementById('themeBtn'),top=theme?.parentElement;if(!top)return;const b=document.createElement('button');b.id='vuDeviceRoleBtn';b.className='theme-btn';b.type='button';b.title='Device role';b.setAttribute('aria-label','Device role');b.textContent='R';b.onclick=openRole;top.insertBefore(b,theme)}
setTimeout(attach,450);window.VUManagerRoleControl={version:'9.4.4',attach,openRole};
})();