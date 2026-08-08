/* V8.9.2 — non-destructive UI cleanup.
   Keeps business logic unchanged. Removes duplicate Settings entries and groups manager tools clearly.
*/
(function(){
  const base=settingsPage;
  settingsPage=async function(...args){
    await base(...args);

    // Older matching layers can each inject the same card. Keep exactly one.
    const matching=[...main.querySelectorAll('.import-matching-panel')];
    matching.slice(1).forEach(node=>node.remove());
    const firstMatching=matching[0];
    if(firstMatching){
      firstMatching.id='vuImportMatchingEntry';
      const heading=firstMatching.querySelector('h2');
      const copy=firstMatching.querySelector('p.muted');
      if(heading)heading.textContent='Match imported records';
      if(copy)copy.textContent='Review imported product and customer links only when an imported record needs attention.';
    }

    // Make the daily PDF work sheets a first-class manager tool rather than hiding them near backup.
    let work=document.getElementById('vuDailyWorkPackEntry');
    if(!work){
      work=document.createElement('section');
      work.id='vuDailyWorkPackEntry';
      work.className='card';
      work.innerHTML=`<div class="section-head"><div><div class="step-label">Manager print centre</div><h2>Daily PDF work sheets</h2><p class="muted">Print or save the target-driven Production, Finishing & Painting, and Delivery / Collection work sheets.</p></div><span class="badge">PDF</span></div><div class="actions"><button id="vuOpenDailyWorkPacks" class="primary" type="button">Open daily work sheets</button></div>`;
    }
    const importCard=[...main.querySelectorAll('.card')].find(el=>/Import business data/i.test(el.textContent||''));
    if(importCard)importCard.insertAdjacentElement('beforebegin',work);
    else main.prepend(work);
    const open=document.getElementById('vuOpenDailyWorkPacks');
    if(open)open.onclick=()=>typeof openDailyWorkPacks==='function'?openDailyWorkPacks(new Date()):notify('Daily work sheets are still loading. Try again in a moment.');

    // Put import matching directly after the import tool when both are present.
    const matchingCard=document.getElementById('vuImportMatchingEntry');
    const currentImport=[...main.querySelectorAll('.card')].find(el=>/Import business data/i.test(el.textContent||''));
    if(matchingCard&&currentImport)currentImport.insertAdjacentElement('afterend',matchingCard);

    // Remove accidental repeated headings/cards with the exact same manager action.
    const seen=new Set();
    [...main.querySelectorAll('.card')].forEach(card=>{
      const h=(card.querySelector('h2')?.textContent||'').trim().toLowerCase();
      const button=(card.querySelector('button')?.textContent||'').trim().toLowerCase();
      const sig=h+'|'+button;
      if(sig==='match imported records|open matching'){
        if(seen.has(sig))card.remove();else seen.add(sig);
      }
    });
  };
  window.settingsPage=settingsPage;
})();