/* V8.9.2 — Settings cleanup and manager print-centre entry. */
(function(){
  const previousSettingsPage=settingsPage;
  settingsPage=async function(...args){
    await previousSettingsPage(...args);

    // Older matching wrappers can render the same entry more than once.
    // Keep the first functional entry and remove visual duplicates only.
    const matchingPanels=[...main.querySelectorAll('.import-matching-panel')];
    matchingPanels.slice(1).forEach(el=>el.remove());
    const matchingCards=[...main.querySelectorAll('.card')].filter(el=>/^\s*Match imported records\b/i.test(el.textContent||''));
    if(matchingCards.length>1)matchingCards.slice(1).forEach(el=>el.remove());

    // Daily work sheets are a manager operation, so expose them clearly in Settings.
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
            <p class="muted">Print the live target-driven work pack for Production, Finishing & Painting, and Delivery / Collection.</p>
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
    if(btn)btn.onclick=()=>{
      if(typeof openDailyWorkPacks==='function')openDailyWorkPacks(new Date());
      else notify('Daily work sheets are still loading. Try again in a moment.');
    };
  };
})();
