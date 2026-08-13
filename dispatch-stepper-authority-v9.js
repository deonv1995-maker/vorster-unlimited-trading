/* V9.1.11 — dispatch quantity steppers matching Painting capture. */
(function(){
'use strict';
if(window.VUDispatchStepperAuthority)return;
function n(v){return Math.max(0,Number(v||0))}
function enhance(){
  document.querySelectorAll('[data-dispatch-line]').forEach(card=>{
    if(card.dataset.stepperReady==='1')return;
    const input=card.querySelector('[data-qty]');if(!input)return;
    card.dataset.stepperReady='1';
    const max=Math.max(0,n(input.max));
    const wrap=document.createElement('div');wrap.className='paint-order-qty';wrap.style.cssText='display:grid;grid-template-columns:84px 1fr 84px;gap:12px;align-items:center;margin-top:8px';
    const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.style.minHeight='64px';minus.style.fontSize='30px';
    const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.style.minHeight='64px';plus.style.fontSize='30px';
    input.style.minHeight='64px';input.style.textAlign='center';input.style.fontSize='24px';input.parentNode.insertBefore(wrap,input);wrap.append(minus,input,plus);
    const set=v=>{input.value=Math.max(0,Math.min(max,Math.round(n(v))));input.dispatchEvent(new Event('input',{bubbles:true}))};
    minus.onclick=()=>set(n(input.value)-1);plus.onclick=()=>set(n(input.value)+1);input.onchange=()=>set(input.value);
  });
}
const obs=new MutationObserver(()=>setTimeout(enhance,20));obs.observe(document.body,{childList:true,subtree:true});setTimeout(enhance,100);
window.VUDispatchStepperAuthority={version:'9.1.11',enhance};
})();