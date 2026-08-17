/* Factory OS 2.10.14 — collapsible operational cards start closed. */
(function(){
'use strict';
if(window.VUCollapsedCards)return;
const seen=new WeakSet();
function apply(root=document){
  const nodes=[];
  if(root?.matches?.('details.card, details.fos-finish-order, details.fos-dispatch-order'))nodes.push(root);
  root?.querySelectorAll?.('details.card, details.fos-finish-order, details.fos-dispatch-order').forEach(x=>nodes.push(x));
  for(const d of nodes){if(seen.has(d))continue;seen.add(d);d.open=false;}
}
function start(){apply(document);const main=document.getElementById('main');if(main)new MutationObserver(ms=>{for(const m of ms)for(const node of m.addedNodes)if(node.nodeType===1)apply(node)}).observe(main,{childList:true,subtree:true});const rb=document.getElementById('runtimeBuild');if(rb)rb.textContent='FACTORY-OS-2.10.14';}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VUCollapsedCards={version:'2.10.14',apply};
})();
