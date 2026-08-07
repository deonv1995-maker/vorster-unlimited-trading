// Version 8.6.1 — classification-aware completion schedule wrapper.
// Filters classified non-production lines only for planning, without altering stored orders.
(function(){
  if(typeof window.buildOrderCompletionSchedule!=='function')return;
  const original=window.buildOrderCompletionSchedule;

  window.buildOrderCompletionSchedule=async function(){
    const classifier=window.VUOrderLineClassifications;
    if(!classifier)return original();
    const originalGetAll=window.getAll;
    if(typeof originalGetAll!=='function')return original();

    // Temporarily present planning with a filtered copy of orders. Stored order records remain untouched.
    window.getAll=async function(store){
      const rows=await originalGetAll(store);
      if(store!=='orders')return rows;
      return rows.map(order=>({
        ...order,
        lines:(order.lines||[]).filter(line=>classifier.isProduct(line))
      }));
    };
    try{return await original();}
    finally{window.getAll=originalGetAll;}
  };

  // Add actionable classification controls to schedule warnings for unlinked codes.
  const originalOpen=window.openOrderCompletionSchedule;
  if(typeof originalOpen==='function'){
    window.openOrderCompletionSchedule=async function(){
      await originalOpen();
      const warning=document.querySelector('.schedule-warning');
      if(!warning)return;
      const paragraphs=[...warning.querySelectorAll('p')];
      paragraphs.forEach(p=>{
        const match=(p.textContent||'').match(/⚠\s*([^\s]+)\s+is not linked to an app product/i);
        if(!match)return;
        const code=match[1];
        const button=document.createElement('button');
        button.type='button'; button.className='secondary'; button.style.marginLeft='8px';
        button.textContent='Classify line';
        button.onclick=()=>window.openOrderLineClassificationDialog(code);
        p.appendChild(button);
      });
    };
  }

  window.addEventListener('vu:order-line-classification-changed',()=>{
    if(typeof window.route!=='undefined' && (window.route==='orders'||document.title)){
      // Schedule is recalculated when opened/refreshed; no stored production quantities are mutated here.
    }
  });
})();