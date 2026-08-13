/* V9.3.5 — Manager exception impact and resolution UI. */
(function(){
'use strict';
if(window.VUDigitalFactoryManagerExceptions)return;
const ROLE_KEY='vu-digital-factory-device-role';
const safe=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const role=()=>String(localStorage.getItem(ROLE_KEY)||'Manager');
let rendering=false;
function styles(){if(document.getElementById('dfManagerExceptionsStyles'))return;const s=document.createElement('style');s.id='dfManagerExceptionsStyles';s.textContent=`
.df-ex-card{border:1px solid #b87966;border-radius:17px;padding:14px;margin:12px 0;background:var(--surface-2)}.df-ex-card.good{border-color:#69a58a}.df-ex-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.df-ex-count{font-size:1.35rem;font-weight:900}.df-ex-row{border:1px solid var(--border);border-radius:14px;padding:12px;margin:10px 0;background:var(--surface)}.df-ex-orders{display:grid;gap:6px;margin-top:8px}.df-ex-order{padding:8px;border-radius:10px;background:var(--surface-2);font-size:.86rem}.df-ex-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.df-ex-actions button{flex:1;min-width:130px}
`;document.head.appendChild(s)}
async function openExceptions(){
  const api=window.VUDigitalFactoryExceptions;if(!api)return alert('Exception handling is still loading.');
  const imp=await api.impact(),optimizer=await window.VUBusinessOutcomeOptimizer?.build?.(),ranked=new Map((optimizer?.ranked||[]).map(r=>[String(r.orderId),r])),dialog=document.getElementById('dialog');
  const html=imp.problems.map(p=>{
    const orders=(p.orders||[]).map(o=>{const r=ranked.get(String(o.orderId)),protectedCommitment=!!r?.commitmentHard&&Number(r?.commitmentDays??999)<=3;return `<div class="df-ex-order"><b>${safe(o.orderNumber||'Order')} · ${safe(o.customerName||'')}</b><br>${protectedCommitment?'<strong>Customer commitment protected</strong> · ':''}${r?.factoryBlocked&&!protectedCommitment?'Temporarily routed behind available work':'Still active in priority plan'}</div>`}).join('');
    return `<section class="df-ex-row"><small>${safe(p.division)}</small><h3>${safe(p.productCode||'')} · ${safe(p.productName||'')}</h3><p><b>⚠ ${safe(p.problemType)}</b>${p.note?` · ${safe(p.note)}`:''}</p><p class="muted">Actual ${Number(p.actualQty||0)} / target ${Number(p.targetQty||0)} · affects ${(p.orders||[]).length} order${(p.orders||[]).length===1?'':'s'}</p><div class="df-ex-orders">${orders||'<div class="df-ex-order">No currently planned order is directly linked to this blocked product.</div>'}</div><div class="df-ex-actions"><button class="primary" data-resolve="${safe(p.id)}">Resolve problem</button></div></section>`
  }).join('');
  dialog.innerHTML=`<div class="modal-form" style="padding:18px;max-height:94vh;overflow:auto"><div class="dialog-head"><div><div class="eyebrow">DIGITAL FACTORY · EXCEPTIONS</div><h2>Blocked work & affected orders</h2><p class="muted">Required quantities are never deleted. The optimiser favours available work while blocked work remains visible.</p></div><button class="close-btn" data-close>×</button></div>${html||'<div class="card">No active factory blocks. The optimiser is using the normal priority plan.</div>'}</div>`;
  dialog.showModal();const close=()=>{try{dialog.close()}catch{};dialog.innerHTML=''};dialog.querySelector('[data-close]').onclick=close;
  dialog.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Resolving…';await api.resolve(b.dataset.resolve,true);try{window.VUOrderProgress?.invalidate?.();await window.VUBusinessOutcomeOptimizer?.build?.()}catch{}notify?.('Factory problem resolved · normal priority restored');close();refresh()});
}
async function render(){
  if(role()!=='Manager'||rendering)return false;const main=document.getElementById('main');if(!main||document.getElementById('dfManagerExceptionCard'))return false;const api=window.VUDigitalFactoryExceptions;if(!api)return false;
  rendering=true;try{styles();const imp=await api.impact(),card=document.createElement('section');card.id='dfManagerExceptionCard';card.className=`df-ex-card ${imp.problems.length?'':'good'}`;card.innerHTML=`<div class="df-ex-head"><div><div class="eyebrow">AUTOMATIC EXCEPTION HANDLING</div><h2>${imp.problems.length?'Factory blocks active':'No active factory blocks'}</h2><p class="muted">${imp.problems.length?`${imp.blockedOrders.length} order${imp.blockedOrders.length===1?'':'s'} affected · optimiser is routing available work around non-protected blocks.`:'Normal optimiser priority is active.'}</p></div><div class="df-ex-count">${imp.problems.length}</div></div><button type="button" ${imp.problems.length?'class="primary"':''} data-open-ex>${imp.problems.length?'Review affected orders':'View exceptions'}</button>`;
    const live=document.getElementById('dfManagerLiveDashboard');if(live?.parentNode)live.insertAdjacentElement('afterend',card);else main.prepend(card);card.querySelector('[data-open-ex]').onclick=openExceptions;return true
  }finally{rendering=false}
}
function refresh(){document.getElementById('dfManagerExceptionCard')?.remove();setTimeout(()=>render().catch(console.warn),100)}
const obs=new MutationObserver(()=>{if(role()==='Manager'&&!document.getElementById('dfManagerExceptionCard'))setTimeout(()=>render().catch(()=>{}),180)});obs.observe(document.body,{childList:true,subtree:true});
window.addEventListener('vu:local-mutation',()=>setTimeout(refresh,300));window.addEventListener('vu:digital-exception-changed',refresh);window.addEventListener('vu:device-role-changed',refresh);window.addEventListener('online',refresh);setTimeout(()=>render().catch(console.warn),420);
window.VUDigitalFactoryManagerExceptions={version:'9.3.5',render,openExceptions,refresh};
})();