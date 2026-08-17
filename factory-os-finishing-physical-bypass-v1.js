/* Factory OS 2.10.20 — authoritative physical finishing capture when recorded Raw stock is behind. */
(function(){
'use strict';
if(window.VUFactoryFinishingPhysicalBypass)return;
const n=v=>Math.max(0,Math.round(Number(v||0)));
const colour=v=>String(v||'Standard').trim()||'Standard';
const key=x=>`${x.orderId}::${x.productId}::${colour(x.colour).toLowerCase()}`;
const canCapture=()=>{
  const preview=window.VUManagementPreview?.isActive?.();
  if(preview)return false;
  const role=window.VUManagementPreview?.actualRole?.()||window.VUFactoryOS?.role?.();
  return role==='Painting'||role==='Management';
};
const draft=new Map();
function qtyFor(x){return Math.min(n(x.toFinish),n(draft.get(key(x))))}
function setQty(x,value){const q=Math.min(n(x.toFinish),n(value));if(q)draft.set(key(x),q);else draft.delete(key(x));return q}
function selected(rows){return rows.reduce((s,x)=>s+qtyFor(x),0)}
function updateBar(rows){const total=selected(rows),count=document.getElementById('fosFinishSelectedCount'),btn=document.getElementById('fosFinishSaveAll');if(count)count.textContent=`${total} unit${total===1?'':'s'} selected`;if(btn)btn.disabled=!total||!canCapture();}
function syncRow(x,rows){const k=CSS.escape(key(x)),q=qtyFor(x);document.querySelectorAll(`[data-finish-key="${k}"]`).forEach(el=>{const input=el.querySelector('[data-finish-qty]');if(input)input.value=String(q);el.classList.toggle('has-qty',q>0)});updateBar(rows)}
async function enhance(){
  if(!canCapture())return;
  const ws=window.VUFactoryFinishingWorkspace;if(!ws?.build)return;
  const rows=await ws.build(),byKey=new Map(rows.map(x=>[key(x),x]));
  for(const x of rows){
    const k=key(x),el=document.querySelector(`[data-finish-key="${CSS.escape(k)}"]`);if(!el)continue;
    const max=n(x.toFinish),raw=n(x.readyToFinish),short=Math.max(0,max-raw),input=el.querySelector('[data-finish-qty]'),minus=el.querySelector('[data-finish-minus]'),plus=el.querySelector('[data-finish-plus]'),all=el.querySelector('[data-finish-max]'),info=el.querySelector('.fos-finish-info small');
    if(info)info.textContent=short?`${raw} Raw recorded · ${short} stock count behind · physical capture allowed`:`${raw} Raw recorded`;
    el.querySelector('.fos-finish-stepper')?.classList.remove('is-disabled');
    if(input){input.disabled=false;input.max=String(max);input.value=String(qtyFor(x));input.oninput=e=>{e.stopPropagation();syncRow(x,rows);setQty(x,input.value);syncRow(x,rows)};}
    if(minus){minus.disabled=false;minus.onclick=e=>{e.stopPropagation();setQty(x,qtyFor(x)-1);syncRow(x,rows)};}
    if(plus){plus.disabled=false;plus.onclick=e=>{e.stopPropagation();setQty(x,qtyFor(x)+1);syncRow(x,rows)};}
    if(all){all.disabled=false;all.textContent=`All ${max}`;all.onclick=e=>{e.stopPropagation();setQty(x,max);syncRow(x,rows)};}
  }
  const save=document.getElementById('fosFinishSaveAll');
  if(save){
    save.onclick=async()=>{
      const chosen=rows.filter(x=>qtyFor(x)>0);if(!chosen.length)return;
      save.disabled=true;let saved=0,corrected=0;
      try{
        for(const x of chosen){
          const q=qtyFor(x);if(!q)continue;
          const rawBefore=await window.VUFactoryFinishing.balance(x.productId,'Raw');
          corrected+=Math.max(0,q-n(rawBefore));
          await window.VUFactoryFinishing.convert(x,q,'Physical finishing capture · Raw stock bypass');
          saved+=q;draft.delete(key(x));
        }
        if(window.VUSharedAccess?.membership?.()&&navigator.onLine){try{await VUSharedAccess.sync({reason:'physical-finishing-bypass-save'})}catch(e){console.warn('Finishing save sync will retry.',e)}}
        window.notify(`${saved} painted unit${saved===1?'':'s'} saved${corrected?` · ${corrected} Raw stock unit${corrected===1?'':'s'} reconciled`:''}`);
        await window.VUFactoryFinishingWorkspace.open();
      }catch(e){window.alert(`${saved?`${saved} unit${saved===1?'':'s'} saved before an error. `:''}${e?.message||String(e)}`);await window.VUFactoryFinishingWorkspace.open();}
    };
  }
  updateBar(rows);
}
function install(){const ws=window.VUFactoryFinishingWorkspace;if(!ws||ws.__physicalBypassPatched)return false;ws.__physicalBypassPatched=true;const base=ws.open.bind(ws);ws.open=async function(...args){await base(...args);await enhance();};return true;}
if(!install())setTimeout(install,0);
window.VUFactoryFinishingPhysicalBypass={version:'2.10.20',install,enhance};
})();