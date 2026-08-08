/* V8.9.4 — Settings manager tools cleanup.
   UI only: one matching entry, one daily PDF print centre, no business-data migration.
*/
(function(){
  const base=settingsPage;
  const heading=card=>(card.querySelector('h2,h3')?.textContent||'').trim().toLowerCase();
  const hasHeading=(card,text)=>heading(card)===text.toLowerCase();

  function removeManagerDuplicates(){
    const cards=[...main.querySelectorAll('.card')];
    cards.filter(c=>hasHeading(c,'Match imported records')).forEach(c=>c.remove());
    cards.filter(c=>hasHeading(c,'Daily PDF work sheets')||hasHeading(c,'Daily work sheets')||hasHeading(c,'Daily factory pack')).forEach(c=>c.remove());
    document.getElementById('vuManagerTools')?.remove();
  }

  function buildManagerTools(){
    const section=document.createElement('section');
    section.id='vuManagerTools';
    section.className='card';
    section.style.marginTop='12px';
    section.innerHTML=`
      <div class="section-head">
        <div><div class="step-label">Manager tools</div><h2>Factory & import tools</h2><p class="muted">Daily operating tools kept together in one place.</p></div>
      </div>
      <div class="list" style="margin-top:10px">
        <button id="vuOpenDailyWorkPacks" class="list-item" type="button" style="width:100%;text-align:left">
          <div><strong>Daily PDF work sheets</strong><p class="muted">Production, Finishing & Painting, and Delivery / Collection work packs from the live plan and daily target.</p></div><span class="badge">PDF</span>
        </button>
        <button id="vuCanonicalMatchingBtn" class="list-item" type="button" style="width:100%;text-align:left;margin-top:8px">
          <div><strong>Match imported records</strong><p class="muted">Review imported product or customer links only when something needs attention.</p></div><span aria-hidden="true">›</span>
        </button>
      </div>`;
    return section;
  }

  function clean(){
    removeManagerDuplicates();
    const tools=buildManagerTools();
    const importCard=[...main.querySelectorAll('.card')].find(c=>/Import business data/i.test(c.textContent||''));
    const backup=[...main.querySelectorAll('.card')].find(c=>/Backup and restore/i.test(c.textContent||''));
    if(importCard)importCard.insertAdjacentElement('afterend',tools);
    else if(backup)backup.insertAdjacentElement('beforebegin',tools);
    else main.append(tools);

    document.getElementById('vuCanonicalMatchingBtn').onclick=()=>openImportMatching();
    document.getElementById('vuOpenDailyWorkPacks').onclick=()=>openDailyWorkPacks(new Date());

    [...main.querySelectorAll('*')]
      .filter(e=>e.children.length===0&&/Version:\s*(?:1\.0 Alpha|8\.\d+)/i.test(e.textContent||''))
      .forEach(e=>e.textContent='Version: 8.9.4');
    const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent='V8.9.4';
  }

  settingsPage=async function(...args){
    await base(...args);
    clean();
  };
  window.settingsPage=settingsPage;
})();