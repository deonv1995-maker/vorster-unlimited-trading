/* Factory OS 2.9.5 — finishing readiness authority.
   Finishing & Painting is the single operational writer for painted output.
   Order/product views consume readiness only and must not duplicate finishing capture. */
(function(){'use strict';if(window.VUFinishingReadinessAuthority)return;
function apply(root=document){
  root.querySelectorAll?.('.fos-mark-painted').forEach(el=>el.remove());
  root.querySelectorAll?.('.fos-stock-correction').forEach(el=>{
    const p=el.querySelector('p.muted');
    if(p)p.textContent='Use these fields only to correct a physical stock count or manufacturing limit. Painted readiness is recorded from Finishing & Painting.';
  });
  root.querySelectorAll?.('.fos-order-line-action').forEach(el=>{
    if(/Product readiness/i.test(el.textContent||''))el.textContent='View readiness & stock ›';
  });
  root.querySelectorAll?.('section.card > p.muted').forEach(el=>{
    if(/Tap a product to mark finishing output or correct stock\/capacity/i.test(el.textContent||''))el.textContent='Tap a product to view readiness or correct stock/capacity. Painted quantities are recorded once from Finishing & Painting and readiness updates automatically.';
  });
}
const observer=new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1)apply(node)});
function start(){apply(document);observer.observe(document.documentElement,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VUFinishingReadinessAuthority={version:'2.9.5',apply};})();