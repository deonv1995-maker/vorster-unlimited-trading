/* V8.9.2 — final Settings cleanup and manager print-centre entry. */
(function(){
  const previousSettingsPage=settingsPage;

  function cleanSettings(){
    const cards=[...main.querySelectorAll('.card')];
    const matching=cards.filter(card=>[...card.querySelectorAll('h1,h2,h3')].some(h=>/^Match imported records$/i.test((h.textContent||'').trim())));
    matching.slice(1).forEach(card=>card.remove());

    let section=document.getElementById('vuDailyWorkPackEntry');
    if(!section){
      section=document.createElement('section');
      section.id='vuDailyWorkPackEntry';
      section.className='card';
      section.style.marginTop='12px';
      section.innerHTML=`
        <div class="section-head">
          <div>
            <div class="step-label">Manager print centre</div>
            <h2>Daily PDF work sheets</h2>
            <p class="muted">Create the live daily work pack for Production, Finishing & Painting, and Delivery / Collection. The sheets use the current orders, raw stock, capacity, workflow and daily invoice target.</p>
          </div>
          <span class="badge">PDF</span>
        </div>
        <div class="actions">
          <button id="vuOpenDailyWorkPacks" class="primary" type="button">Open daily work sheets</button>
        </div>`;
      const importCard=[...main.querySelectorAll('.card')].find(el=>/Import business data/i.test(el.textContent||''));
      const backup=[...main.querySelectorAll('.card')].find(el=>/Backup and restore/i.test(el.textContent||''));
      if(importCard)importCard.insertAdjacentElement('beforebegin',section);
      else if(backup)backup.insertAdjacentElement('beforebegin',section);
      else main.appendChild(section);
    }

    const btn=document.getElementById('vuOpenDailyWorkPacks');
    if(btn)btn.onclick=()=>typeof openDailyWorkPacks==='function'?openDailyWorkPacks(new Date()):notify('Daily work sheets are unavailable. Refresh the app once while online.');
  }

  settingsPage=async function(...args){
    await previousSettingsPage(...args);
    cleanSettings();
    // Some legacy settings extensions append asynchronously; one final pass keeps the page deterministic.
    requestAnimationFrame(cleanSettings);
  };
})();