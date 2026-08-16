/* Factory OS Management Preview — management-only read-only role simulation. */
(function(){
'use strict';
if(window.VUManagementPreview)return;
const KEY='vu-management-preview-role';
const ALLOWED=['Office','Casting','Packing','Resin','Painting','Delivery'];
function actualRole(){return window.VUSharedAccess?.currentRole?.()||localStorage.getItem('vu-factory-os-role')||'Management'}
function role(){const v=sessionStorage.getItem(KEY);return actualRole()==='Management'&&ALLOWED.includes(v)?v:null}
function isActive(){return !!role()}
function start(next){if(actualRole()!=='Management')throw new Error('Management access required.');if(!ALLOWED.includes(next))throw new Error('Unknown preview role.');sessionStorage.setItem(KEY,next);window.dispatchEvent(new CustomEvent('vu:preview-change',{detail:{role:next,active:true}}));return next}
function stop(){sessionStorage.removeItem(KEY);window.dispatchEvent(new CustomEvent('vu:preview-change',{detail:{role:null,active:false}}))}
function assertWritable(){if(isActive())throw new Error(`Management Preview is read-only. Exit ${role()} preview before saving changes.`)}
function banner(){const r=role();if(!r)return'';return `<div class="fos-preview-banner"><div><strong>MANAGEMENT PREVIEW · ${String(r).replace(/[&<>\"']/g,'')}</strong><small>Read-only · Your real role remains Management</small></div><button type="button" id="fosExitPreview">Exit preview</button></div>`}
function bindBanner(){const b=document.getElementById('fosExitPreview');if(b)b.onclick=()=>{stop();window.navigate?.('dashboard')}}
function style(){if(document.getElementById('fosPreviewStyle'))return;const s=document.createElement('style');s.id='fosPreviewStyle';s.textContent='.fos-preview-banner{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;margin:0 0 12px;border:2px solid currentColor;border-radius:12px;background:var(--panel);color:var(--text)}.fos-preview-banner strong,.fos-preview-banner small{display:block}.fos-preview-banner small{color:var(--muted);margin-top:2px}.fos-preview-banner button{border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);padding:9px 11px;font-weight:700}';document.head.appendChild(s)}
style();
window.VUManagementPreview={version:'1.0.0',ALLOWED,actualRole,role,isActive,start,stop,assertWritable,banner,bindBanner};
})();