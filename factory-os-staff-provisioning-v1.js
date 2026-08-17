/* Factory OS 2.10.45 — management-controlled staff provisioning with email-to-division register. */
(function(){
'use strict';
if(window.VUFactoryStaffProvisioning)return;
const URL='https://ccdmwcxcpszqdzoetqkc.supabase.co';
const KEY='sb_publishable_PNO81WcLLMLjUSH7c955Tg_YwWpXHK4';
const ROLES=['Office','Casting','Packing','Resin','Painting','Delivery'];
const esc=v=>window.esc?window.esc(v):String(v??'');
function errorMessage(value,fallback='Could not create staff login.'){
  if(value==null||value==='')return fallback;
  if(typeof value==='string')return value;
  if(value instanceof Error)return value.message||fallback;
  if(typeof value==='object'){
    const m=value.message||value.error_description||value.details||value.hint||value.code;
    if(m)return String(m);
    try{return JSON.stringify(value)}catch{return fallback}
  }
  return String(value);
}
async function saveAssignment(email,role){
  if(!window.putOne)return;
  const normalized=String(email||'').trim().toLowerCase(),now=new Date().toISOString();
  if(!normalized)return;
  await window.putOne('activities',{id:`staff-assignment::${normalized}`,kind:'FACTORY_STAFF_ASSIGNMENT',email:normalized,factoryRole:role,updatedAt:now,createdAt:now});
  try{await window.VUSharedAccess?.sync?.({reason:'staff-assignment-updated'})}catch{}
}
async function provision(email,password,role){
  const sess=window.VUSharedAccess?.getSession?.();
  if(!sess?.access_token)throw new Error('Management sign-in required.');
  const r=await fetch(`${URL}/functions/v1/vu-provision-staff`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${sess.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,factory_role:role})});
  const body=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(errorMessage(body?.error||body,`Could not create staff login (${r.status}).`));
  if(!body?.ok)throw new Error(errorMessage(body,'Staff login was not confirmed by the server.'));
  await saveAssignment(email,role);
  return body;
}
function decorate(){
  if(document.getElementById('fosSharedCreate')){
    const create=document.getElementById('fosSharedCreate');create.remove();
    const form=document.getElementById('fosSharedLogin'),note=form?.nextElementSibling;
    if(note)note.textContent='Staff accounts are created by Management. Enter the email and password Management gave you, then sign in.';
  }
  if(window.VUSharedAccess?.currentRole?.()!=='Management')return;
  if(document.getElementById('fosProvisionStaff'))return;
  const old=[...document.querySelectorAll('.fos-shared-form')].find(f=>f.id==='fosAddMember');if(old)old.closest('section')?.remove();
  const connected=document.querySelector('.fos-shared-status')?.closest('section.card');if(!connected)return;
  const section=document.createElement('section');section.className='card';
  section.innerHTML=`<div class="step-label">STAFF DEVICE SETUP</div><h2>Create staff login</h2><form id="fosProvisionStaff" class="fos-shared-form"><label><span>Staff email</span><input id="fosProvisionEmail" type="email" autocomplete="off" required></label><label><span>Temporary password</span><input id="fosProvisionPassword" type="text" minlength="8" autocomplete="off" required></label><label><span>Division</span><select id="fosProvisionRole">${ROLES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><button class="primary" type="submit">Create / update staff login</button></form><p class="muted" id="fosProvisionHelp">The email and assigned division will appear in the staff list above.</p>`;
  connected.insertAdjacentElement('afterend',section);
  section.querySelector('form').onsubmit=async e=>{e.preventDefault();const btn=section.querySelector('button'),email=section.querySelector('#fosProvisionEmail').value.trim(),password=section.querySelector('#fosProvisionPassword').value,role=section.querySelector('#fosProvisionRole').value;btn.disabled=true;try{const out=await provision(email,password,role);window.notify?.(`${out.created?'Created':'Updated'} ${role} login`);section.querySelector('#fosProvisionHelp').innerHTML=`<b>${esc(email)}</b> is assigned to <b>${esc(role)}</b>.`;section.querySelector('#fosProvisionPassword').value='';await window.VUFactoryStaffPresence?.injectManagementPanel?.()}catch(err){alert(errorMessage(err))}finally{btn.disabled=false}};
}
const obs=new MutationObserver(()=>queueMicrotask(decorate));obs.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('DOMContentLoaded',()=>setTimeout(decorate,0));
window.VUFactoryStaffProvisioning={version:'2.10.45',provision,saveAssignment,decorate,errorMessage};
})();
