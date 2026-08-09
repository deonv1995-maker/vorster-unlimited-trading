/* V9.0.11 — one visible build version everywhere in the app. */
(function(){
  const BUILD='V9.0.11';
  window.VU_BUILD=BUILD;
  const legacy=/\b(?:1\.0\s+Alpha\s+7\.\d+\.\d+|2\.0\s+Version\s+8\.\d+\.\d+|V?8\.\d+\.\d+|V?9\.0\.\d+)\b/g;
  function replaceTextNode(node){
    if(!node||node.nodeType!==Node.TEXT_NODE)return;
    const next=(node.nodeValue||'').replace(legacy,BUILD);
    if(next!==node.nodeValue)node.nodeValue=next;
  }
  function sweep(root=document.body){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE)return replaceTextNode(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let n;while((n=walker.nextNode()))replaceTextNode(n);
    const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent=BUILD;
  }
  const observer=new MutationObserver(records=>{
    for(const r of records){
      if(r.type==='characterData')replaceTextNode(r.target);
      for(const n of r.addedNodes||[])sweep(n);
    }
    const runtime=document.getElementById('runtimeBuild');if(runtime&&runtime.textContent!==BUILD)runtime.textContent=BUILD;
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  sweep();
})();