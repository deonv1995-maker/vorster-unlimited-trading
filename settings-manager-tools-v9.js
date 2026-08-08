/* V8.9.3 — deterministic Settings manager tools cleanup.
   UI only: no business/order/stock data changes.
*/
(function(){
  const base=settingsPage;
  function cardHeading(card){return (card.querySelector('h2,h3')?.textContent||'').trim().toLowerCase();}
  function clean(){
    const cards=[...main.querySelectorAll('.card')];
    // Remove every legacy copy, then add exactly one canonical matching entry.
    cards.filter(c=>cardHeading(c)==='match imported records').forEach(c=>c.remove());
    document.getElementById('vuCanonicalMatching')?.remove();
    const matching=document.createElement('section');
    matching.id='vuCanonicalMatching';matching.className='card';matching.style.marginTop='12px';
    matching.innerHTML=`<div class="section-head"><div><div class="step-label">Import maintenance</div><h2>Match imported records</h2><p class="muted">Review imported product or customer links only when a record needs attention.</p></div></div><div class="actions"><button id="vuCanonicalMatchingBtn" class="secondary" type="button">Open matching</button></div>`;

    // Remove old work-sheet entries and create one obvious print-centre card.
    [...main.querySelectorAll('#vuDailyWorkPackEntry')].forEach(n=>n.remove());
    [...main.querySelectorAll('.card')].filter(c=>cardHeading(c)==='daily pdf work sheets').forEach(c=>c.remove());
    const work=document.createElement('section');work.id='vuDailyWorkPackEntry';work.className='card';work.style.marginTop='12px';
    work.innerHTML=`<div class="section-head"><div><div class="step-label">Manager print centre</div><h2>Daily PDF work sheets</h2><p class="muted">Prepare the target-driven work pack for Production, Finishing & Painting, and Delivery / Collection from the live factory plan.</p></div><span class="badge">PDF</span></div><div class="actions"><button id="vuOpenDailyWorkPacks" class="primary" type="button">Open daily work sheets</button></div>`;

    const importCard=[...main.querySelectorAll('.card')].find(c=>/Import business data/i.test(c.textContent||''));
    const backup=[...main.querySelectorAll('.card')].find(c=>/Backup and restore/i.test(c.textContent||''));
    if(importCard){importCard.insertAdjacentElement('afterend',matching);matching.insertAdjacentElement('afterend',work);}
    else if(backup){backup.insertAdjacentElement('beforebegin',matching);matching.insertAdjacentElement('afterend',work);}
    else{main.append(matching,work);}
    document.getElementById('vuCanonicalMatchingBtn').onclick=()=>openImportMatching();
    document.getElementById('vuOpenDailyWorkPacks').onclick=()=>openDailyWorkPacks(new Date());

    // Correct any stale visible application version copy on Settings.
    [...main.querySelectorAll('*')].filter(e=>e.children.length===0&&/Version:\s*1\.0 Alpha/i.test(e.textContent||'')).forEach(e=>e.textContent='Version: 8.9.3');
    const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent='V8.9.3';
  }
  settingsPage=async function(...args){await base(...args);clean();requestAnimationFrame(clean);};
  window.settingsPage=settingsPage;
})();