/* V9.0.77 — final non-business-data mobile stability layer. */
(function(){
'use strict';
if(document.getElementById('vuStabilityStyles'))return;
const s=document.createElement('style');s.id='vuStabilityStyles';s.textContent=`
html,body{max-width:100%;overflow-x:hidden}
dialog{max-width:min(720px,calc(100vw - 12px));width:min(720px,calc(100vw - 12px));max-height:96dvh;padding:0;overscroll-behavior:contain}
dialog .modal-form,dialog .dialog-inner{max-width:100%;box-sizing:border-box;overscroll-behavior:contain}
.route-settings{display:grid;grid-template-columns:1fr 1fr;gap:8px}.route-settings label{margin:0}
.route-actions{display:flex;gap:8px;flex-wrap:wrap}.route-actions button{flex:1;min-width:145px}
.route-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.route-summary>div{padding:10px;border:1px solid var(--border);border-radius:14px;text-align:center}
.route-stop{padding:12px;margin:8px 0;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}.route-stop small{display:block;color:var(--muted);line-height:1.4}.route-warning{border-color:#b88468}
@media(max-width:520px){.route-settings{grid-template-columns:1fr}.route-summary{grid-template-columns:1fr 1fr 1fr}.route-actions button{min-width:100%}}
`;
document.head.appendChild(s);
})();