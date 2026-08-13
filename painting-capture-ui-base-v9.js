/* V9.2.0 — Painting capture UI styles only. No business logic or global capture overrides. */
(function(){
'use strict';
if(document.getElementById('paintingOrderCaptureStyles'))return;
const s=document.createElement('style');
s.id='paintingOrderCaptureStyles';
s.textContent='.paint-order-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.paint-order-summary>div{padding:10px;border:1px solid var(--border);border-radius:14px;text-align:center}.paint-order-summary strong{display:block;font-size:1.1rem}.paint-order-line{padding:13px;margin:9px 0;border:1px solid var(--border);border-radius:15px;background:var(--surface-2)}.paint-order-line h3{margin:0 0 4px}.paint-order-meta{font-size:.85rem;color:var(--muted)}.paint-order-qty{display:grid;grid-template-columns:50px 1fr 50px;gap:8px;align-items:center;margin:10px 0}.paint-order-qty button{min-height:46px;font-size:1.3rem}.paint-order-qty input{text-align:center;font-size:1.05rem;font-weight:800}.paint-order-complete{border-color:#69a58a}';
document.head.appendChild(s);
window.VUPaintingCaptureUIBase={version:'9.2.0'};
})();