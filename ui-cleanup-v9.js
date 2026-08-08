/* V8.9.4 — deterministic UI cleanup only. Business data and workflow calculations are untouched. */
(function(){
  const base=window.settingsPage;
  if(typeof base!=='function')return;
  const heading=card=>(card?.querySelector('h1,h2,h3')?.textContent||'').trim().toLowerCase();

  function matchingCard(){const card=document.createElement('section');card.id='vuSingleImportMatching';card.className='card';card.style.marginTop='12px';card.innerHTML=`<div class="section-head"><div><div class="step-label">Import maintenance</div><h2>Match imported records</h2><p class="muted">Only use this when an imported product or customer needs to be linked to an existing record.</p></div></div><div class="actions"><button id="vuSingleMatchingButton" class="secondary" type="button">Open matching</button></div>`;return card;}
  function workCard(){const card=document.createElement('section');card.id='vuManagerPrintCentre';card.className='card';card.style.marginTop='12px';card.innerHTML=`<div class="section-head"><div><div class="step-label">Factory management</div><h2>Daily work sheets</h2><p class="muted">Print or save the live daily Production, Finishing & Painting, and Delivery / Collection work pack.</p></div><span class="badge">PDF</span></div><div class="actions"><button id="vuManagerWorkSheets" class="primary" type="button">Open daily work sheets</button></div>`;return card;}

  function clean(){
    // Remove all known/legacy copies first, including copies that never received the old helper class.
    [...main.querySelectorAll('.card')].forEach(card=>{const h=heading(card);if(h==='match imported records'||h==='daily pdf work sheets'||h==='daily work sheets'||['vuCanonicalMatching','vuDailyWorkPackEntry','vuSingleImportMatching','vuManagerPrintCentre','vuImportMatchingEntry'].includes(card.id))card.remove();});
    const imported=[...main.querySelectorAll('.card')].find(c=>heading(c)==='import business data');
    const backup=[...main.querySelectorAll('.card')].find(c=>heading(c)==='backup and restore');
    const match=matchingCard(),work=workCard();
    if(imported){imported.insertAdjacentElement('afterend',match);match.insertAdjacentElement('afterend',work);}else if(backup){backup.insertAdjacentElement('beforebegin',match);match.insertAdjacentElement('afterend',work);}else main.append(match,work);
    document.getElementById('vuSingleMatchingButton').onclick=()=>typeof window.openImportMatching==='function'?window.openImportMatching():notify('Import matching is still loading.');
    document.getElementById('vuManagerWorkSheets').onclick=()=>typeof window.openDailyWorkPacks==='function'?window.openDailyWorkPacks(new Date()):notify('Daily work sheets are still loading.');
    const runtime=document.getElementById('runtimeBuild');if(runtime)runtime.textContent='V8.9.4';
    [...main.querySelectorAll('*')].filter(e=>e.children.length===0&&/^Version:\s*/i.test((e.textContent||'').trim())).forEach(e=>e.textContent='Version: 8.9.4');
  }

  window.settingsPage=async function(...args){await base(...args);clean();requestAnimationFrame(clean);setTimeout(clean,60);};
})();