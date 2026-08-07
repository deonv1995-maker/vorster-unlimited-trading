// Version 8.6.2 — classification-aware completion schedule.
// Keeps stored orders intact; classified non-products are excluded from production planning.
(function(){
  if(typeof window.buildOrderCompletionSchedule!=='function')return;
  const originalBuild=window.buildOrderCompletionSchedule;
  const originalOpen=window.openOrderCompletionSchedule;

  window.buildOrderCompletionSchedule=async function(){
    const classifier=window.VUOrderLineClassifications;
    if(!classifier)return originalBuild();
    const originalGetAll=window.getAll;
    if(typeof originalGetAll!=='function')return originalBuild();
    window.getAll=async function(store){
      const rows=await originalGetAll(store);
      if(store!=='orders')return rows;
      return rows.map(order=>({...order,lines:(order.lines||[]).filter(line=>classifier.isProduct(line))}));
    };
    try{return await originalBuild();}
    finally{window.getAll=originalGetAll;}
  };

  function addClassificationControls(){
    const warning=document.querySelector('.schedule-warning');
    if(!warning)return;
    [...warning.querySelectorAll('p')].forEach(p=>{
      if(p.querySelector('.vu-classify-line'))return;
      const text=p.textContent||'';
      // Handles both "is not linked" and "outstanding demand but no capacity" warnings.
      const match=text.match(/⚠?\s*([^\s]+)\s+(?:is not linked to an app product|has outstanding demand but no daily manufacturing capacity)/i);
      if(!match)return;
      const code=match[1].trim();
      const button=document.createElement('button');
      button.type='button';
      button.className='secondary vu-classify-line';
      button.textContent='Classify line';
      button.style.cssText='display:block;margin-top:10px;min-height:44px';
      button.onclick=()=>window.openOrderLineClassificationDialog(code,text.replace(/^⚠\s*/,''));
      p.appendChild(button);
    });
  }

  if(typeof originalOpen==='function'){
    window.openOrderCompletionSchedule=async function(){
      await originalOpen();
      addClassificationControls();
    };
  }

  window.addEventListener('vu:order-line-classification-changed',()=>{
    if(document.querySelector('.schedule-warning')&&typeof window.openOrderCompletionSchedule==='function'){
      window.openOrderCompletionSchedule();
    }
  });
})();