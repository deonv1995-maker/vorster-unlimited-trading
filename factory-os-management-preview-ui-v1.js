/* Management Preview UI — management-only entry into the same operational screens used by division devices. */
(function(){
'use strict';
if(window.VUManagementPreviewUI||!window.VUFactoryOSHome||!window.VUManagementPreview)return;
const original=window.VUFactoryOSHome.render.bind(window.VUFactoryOSHome);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const previewRoute=r=>r==='Casting'?'manufacturing-casting':r==='Packing'?'manufacturing-packing':r==='Resin'?'manufacturing-resin':r==='Painting'?'painting':'dashboard';
function managementPanel(){return `<section class="card fos-preview-control"><div class="step-label">MANAGEMENT QA</div><h2>Preview a division device</h2><p class="muted">See the same operational Factory OS screen the division leader will use. Preview mode is read-only and does not change your Management access.</p><div class="fos-preview-role-grid">${VUManagementPreview.ALLOWED.map(r=>`<button type="button" class="secondary" data-preview-role="${esc(r)}">${r==='Painting'?'Finishing & Painting':esc(r)}</button>`).join('')}</div></section>`}
function bindControls(){document.querySelectorAll('[data-preview-role]').forEach(b=>b.onclick=()=>{try{const role=VUManagementPreview.start(b.dataset.previewRole);window.navigate?.(previewRoute(role))}catch(e){alert(e?.message||String(e))}});VUManagementPreview.bindBanner()}
async function render(){await original();const active=VUManagementPreview.isActive(),actual=VUManagementPreview.actualRole();if(active){main.insertAdjacentHTML('afterbegin',VUManagementPreview.banner());VUManagementPreview.bindBanner()}else if(actual==='Management'){main.insertAdjacentHTML('afterbegin',managementPanel());bindControls()}}
window.VUFactoryOSHome.render=render;
const s=document.createElement('style');s.textContent='.fos-preview-control{margin-bottom:12px}.fos-preview-role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}@media(max-width:520px){.fos-preview-role-grid{grid-template-columns:1fr}}';document.head.appendChild(s);
window.VUManagementPreviewUI={version:'1.0.1',render,previewRoute};
})();