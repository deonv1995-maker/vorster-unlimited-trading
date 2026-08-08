/* V8.9.5 — canonical Settings manager tools.
   Removes every legacy duplicate matching/work-sheet entry and renders one clean manager section.
*/
(function(){
  const base=settingsPage;
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();

  function isLegacyToolCard(card){
    const t=norm(card.textContent);
    return t.includes('match imported records')||t.includes('daily pdf work sheets')||t.includes('daily work sheets')||t.includes('daily factory pack');
  }

  function removeLegacyTools(){
    document.getElementById('vuManagerTools')?.remove();
    [...main.querySelectorAll('.card')].filter(isLegacyToolCard).forEach(card=>card.remove());
  }

  async function matchingCount(){
    try{
      const [p,c]=await Promise.all([
        typeof importedProductCandidates==='function'?importedProductCandidates():[],
        typeof importedCustomerCandidates==='function'?importedCustomerCandidates():[]
      ]);
      return (p?.length||0)+(c?.length||0);
    }catch(e){console.warn('Matching count unavailable',e);return 0;}
  }

  async function buildManagerTools(){
    const count=await matchingCount();
    const section=document.createElement('section');
    section.id='vuManagerTools';
    section.className='card';
    section.style.marginTop='12px';
    section.innerHTML=`
      <div class="section-head"><div><div class="step-label">Manager tools</div><h2>Factory & import tools</h2><p class="muted">The operating tools used for imports and the daily factory hand-out.</p></div></div>
      <div class="list" style="margin-top:10px">
        <button id="vuOpenDailyWorkPacks" class="list-item" type="button" style="width:100%;text-align:left">
          <div><strong>Daily PDF work sheets</strong><p class="muted">Choose a work date, then print Production, Finishing & Painting and Delivery / Collection separately or as one daily factory pack.</p></div><span class="badge">PDF</span>
        </button>
        <button id="vuCanonicalMatchingBtn" class="list-item" type="button" style="width:100%;text-align:left;margin-top:8px">
          <div><strong>Match imported records</strong><p class="muted">Review imported product and customer links that still need attention.</p></div><span class="badge">${count}</span>
        </button>
      </div>`;
    return section;
  }

  async function clean(){
    removeLegacyTools();
    const tools=await buildManagerTools();
    const importCard=[...main.querySelectorAll('.card')].find(c=>norm(c.textContent).includes('import business data'));
    const backup=[...main.querySelectorAll('.card')].find(c=>norm(c.textContent).includes('backup and restore'));
    if(importCard)importCard.insertAdjacentElement('afterend',tools);
    else if(backup)backup.insertAdjacentElement('beforebegin',tools);
    else main.append(tools);
    document.getElementById('vuCanonicalMatchingBtn').onclick=()=>openImportMatching();
    document.getElementById('vuOpenDailyWorkPacks').onclick=()=>openDailyWorkPacks(new Date());
    const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent='V8.9.5';
  }

  settingsPage=async function(...args){await base(...args);await clean();};
  window.settingsPage=settingsPage;
})();