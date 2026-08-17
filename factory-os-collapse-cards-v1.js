/* Factory OS 2.10.15 — all collapsible cards and dashboard groups start closed. */
(function(){
'use strict';
if(window.VUCollapsedCards)return;
const seen=new WeakSet();
const SELECTOR='details.card, details.fos-finish-order, details.fos-dispatch-order, details.factory-os-category';
function apply(root=document){
  const nodes=[];
  if(root?.matches?.(SELECTOR))nodes.push(root);
  root?.querySelectorAll?.(SELECTOR).forEach(x=>nodes.push(x));
  for(const d of nodes){if(seen.has(d))continue;seen.add(d);d.open=false;}
}
function start(){
  apply(document);
  const main=document.getElementById('main');
  if(main)new MutationObserver(ms=>{for(const m of ms)for(const node of m.addedNodes)if(node.nodeType===1)apply(node)}).observe(main,{childList:true,subtree:true});
  const rb=document.getElementById('runtimeBuild');if(rb)rb.textContent='FACTORY-OS-2.10.15';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VUCollapsedCards={version:'2.10.15',apply};
})();
