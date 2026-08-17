/* Factory OS 2.10.11 — management-controlled staff provisioning without auth email. */
(function(){
'use strict';
if(window.VUFactoryStaffProvisioning)return;
const URL='https://ccdmwcxcpszqdzoetqkc.supabase.co';
const KEY='sb_publishable_PNO81WcLLMLjUSH7c955Tg_YwWpXHK4';
const ROLES=['Office','Casting','Packing','Resin','Painting','Delivery'];
const esc=v=>window.esc?window.esc(v):String(v??'');
async function provision(email,password,role){
  const sess=window.VUSharedAccess?.getSession?.();
  if(!sess?.access_token)throw new Error('Management sign-in required.');
  const r=await fetch(`${URL}/functions/v1/vu-provision-staff`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${sess.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,factory_role:role})});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(body?.error||`Could not create staff login (${r.status}).`);
  return body;
}
function decorate(){
  if(document.getElementById('fosSharedCreate')){
    const create=document.getElementById('fosSharedCreate');
    create.remove();
    const form=document.getElementById('fosSharedLogin');
    const note=form?.nextElementSibling;
    if(note)note.textContent='Staff accounts are created by Management. Enter the email and password Management gave you, then sign in.';
  }
  if(window.VUSharedAccess?.currentRole?.()!=='Management')return;
  if(document.getElementById('fosProvisionStaff'))return;
  const forms=[...document.querySelectorAll('.fos-shared-form')];
  const old=forms.find(f=>f.id==='fosAddMember');
  if(old)old.closest('section')?.remove();
  const connected=document.querySelector('.fos-shared-status')?.closest('section.card');
  if(!connected)return;
  const section=document.createElement('section');section.className='card';
  section.innerHTML=`<div class="step-label">STAFF DEVICE SETUP</div><h2>Create staff login</h2><p class="muted">Create the staff account here first. No confirmation email is sent. Then sign in on the leader's phone with these details.</p><form id="fosProvisionStaff" class="fos-shared-form"><label><span>Staff email</span><input id="fosProvisionEmail" type="email" autocomplete="off" required></label><label><span>Temporary password</span><input id="fosProvisionPassword" type="text" minlength="8" autocomplete="off" required></label><label><span>Division</span><select id="fosProvisionRole">${ROLES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><button class="primary" type="submit">Create / update staff login</button></form><p class="muted" id="fosProvisionHelp">Use a password of at least 8 characters. You can reuse this form later to reset that staff member's password or change their division.</p>`;
  connected.insertAdjacentElement('afterend',section);
  section.querySelector('form').onsubmit=async e=>{e.preventDefault();const btn=section.querySelector('button'),email=section.querySelector('#fosProvisionEmail').value.trim(),password=section.querySelector('#fosProvisionPassword').value,role=section.querySelector('#fosProvisionRole').value;btn.disabled=true;try{const out=await provision(email,password,role);window.notify?.(`${out.created?'Created':'Updated'} ${role} login`);section.querySelector('#fosProvisionHelp').innerHTML=`<b>${esc(email)}</b> is ready as <b>${esc(role)}</b>. On the staff phone, open Shared Access and sign in with this email and password.`;section.querySelector('#fosProvisionPassword').value=''}catch(err){alert(err?.message||String(err))}finally{btn.disabled=false}};
}
const obs=new MutationObserver(()=>queueMicrotask(decorate));obs.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('DOMContentLoaded',()=>setTimeout(decorate,0));
window.VUFactoryStaffProvisioning={version:'2.10.11',provision,decorate};
})();
