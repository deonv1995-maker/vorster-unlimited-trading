// Version 8.6.1 — classify imported/order lines that are not manufactured products.
// Keeps original order lines intact while excluding colour/service/one-off lines from raw stock and capacity planning.
(function(){
  const STORAGE_KEY='vu.orderLineClassifications.v1';
  const TYPES={product:'Product',colour:'Colour / finish code',service:'Service / workflow code',custom:'One-off / custom code',ignore:'Ignore / non-production'};
  const norm=v=>String(v||'').trim().toUpperCase();

  function load(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch(_){return {};}
  }
  function save(map){localStorage.setItem(STORAGE_KEY,JSON.stringify(map||{}));}
  function get(code){return load()[norm(code)]||null;}
  function set(code,type,note=''){
    const key=norm(code); if(!key)return;
    const map=load(); map[key]={type,note:String(note||''),updatedAt:new Date().toISOString()}; save(map);
    window.dispatchEvent(new CustomEvent('vu:order-line-classification-changed',{detail:{code:key,type}}));
  }
  function lineCode(line){return norm(line?.productCode||line?.code||line?.sku||'');}
  function classification(line){return get(lineCode(line));}
  function isNonProduction(line){const c=classification(line); return Boolean(c&&c.type&&c.type!=='product');}
  function isProduct(line){const c=classification(line); return !c||c.type==='product';}

  // Common workflow code explicitly defined by the business.
  if(!get('C+R')) set('C+R','service','Collect and replace');
  if(!get('CR')) set('CR','service','Collect and replace');

  window.VUOrderLineClassifications={TYPES,load,get,set,lineCode,classification,isNonProduction,isProduct};

  window.openOrderLineClassificationDialog=function(code,description=''){
    const key=norm(code); if(!key)return;
    const current=get(key)||{};
    const dlg=document.getElementById('dialog');
    if(!dlg)return;
    const escSafe=window.esc||((v)=>String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
    dlg.innerHTML=`<form method="dialog" class="dialog-card">
      <h2>Classify ${escSafe(key)}</h2>
      ${description?`<p class="muted">${escSafe(description)}</p>`:''}
      <p class="muted">This does not delete the line from the order. It only controls whether the line participates in raw stock and manufacturing calculations.</p>
      <label>Line type<select id="vuLineClassType">${Object.entries(TYPES).map(([value,label])=>`<option value="${value}" ${current.type===value?'selected':''}>${label}</option>`).join('')}</select></label>
      <label>Note<input id="vuLineClassNote" value="${escSafe(current.note||'')}"></label>
      <div class="actions"><button value="cancel">Cancel</button><button type="button" class="primary" id="vuSaveLineClass">Save classification</button></div>
    </form>`;
    dlg.showModal();
    document.getElementById('vuSaveLineClass').onclick=()=>{
      set(key,document.getElementById('vuLineClassType').value,document.getElementById('vuLineClassNote').value);
      dlg.close();
      if(typeof window.openOrderCompletionSchedule==='function') window.openOrderCompletionSchedule();
    };
  };
})();