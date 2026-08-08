/* V8.9.1 — Settings polish and manager print-centre entry. */
(function(){
  const previousSettingsPage=settingsPage;
  settingsPage=async function(...args){
    await previousSettingsPage(...args);
    if(document.getElementById('vuDailyWorkPackEntry'))return;
    const section=document.createElement('section');
    section.id='vuDailyWorkPackEntry';
    section.className='card';
    section.style.marginTop='12px';
    section.innerHTML=`
      <div class="section-head">
        <div>
          <div class="step-label">Manager print centre</div>
          <h2>Daily work sheets</h2>
          <p class="muted">Prepare the target-driven Production, Finishing & Painting, and Delivery / Collection sheets for any working day.</p>
        </div>
        <span class="badge">PDF</span>
      </div>
      <div class="actions">
        <button id="vuOpenDailyWorkPacks" class="primary" type="button">Open daily work sheets</button>
      </div>`;
    const backup=[...main.querySelectorAll('.card')].find(el=>/Backup and restore/i.test(el.textContent||''));
    if(backup)backup.insertAdjacentElement('beforebegin',section);else main.appendChild(section);
    document.getElementById('vuOpenDailyWorkPacks').onclick=()=>{
      if(typeof openDailyWorkPacks==='function')openDailyWorkPacks(new Date());
      else notify('Daily work sheets are still loading. Try again in a moment.');
    };
  };
})();
