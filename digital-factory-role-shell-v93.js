/* V9.3.1 — Digital Factory phase 2 role workstation shell.
   Manager keeps the full app. Leader devices get one focused workstation with My Work Today,
   sync/offline status and role controls. No business data is hidden/deleted; this is a device-local UI shell. */
(function(){
'use strict';
if(window.VUDigitalFactoryRoleShell)return;
const ROLE_KEY='vu-digital-factory-device-role';
const LEADERS=new Set(['Casting','Packing','Resin','Painting','Delivery']);
const safe=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const role=()=>String(localStorage.getItem(ROLE_KEY)||'Manager');
const isLeader=()=>LEADERS.has(role());
let applying=false;

async function outboxCount(){try{return (await getAll('syncOutbox')).length}catch{return 0}}
async function conflictCount(){try{return (await getAll('syncConflicts')).length}catch{return 0}}
async function syncState(){
  const pending=await outboxCount(),conflicts=await conflictCount();
  if(!navigator.onLine)return {label:`Offline · ${pending} change${pending===1?'':'s'} waiting`,pending,conflicts,online:false};
  if(conflicts)return {label:`Online · ${conflicts} sync conflict${conflicts===1?'':'s'} need attention`,pending,conflicts,online:true};
  if(pending)return {label:`Online · ${pending} change${pending===1?'':'s'} waiting to sync`,pending,conflicts,online:true};
  return {label:'Online · all caught up',pending,conflicts,online:true};
}
function ensureStyles(){if(document.getElementById('dfRoleShellStyles'))return;const s=document.createElement('style');s.id='dfRoleShellStyles';s.textContent=`
body.df-leader-mode #calendarQuickBtn,body.df-leader-mode #mergeNativeBtn,body.df-leader-mode #installBtn,body.df-leader-mode .bottom-nav{display:none!important}
body.df-leader-mode #backBtn{display:none!important}.df-shell{padding:14px 14px calc(24px + env(safe-area-inset-bottom));max-width:760px;margin:0 auto}.df-shell-hero{border:1px solid var(--border);border-radius:20px;padding:18px;background:var(--surface);margin:8px 0 14px}.df-shell-role{display:inline-block;padding:6px 10px;border-radius:999px;background:var(--surface-2);font-weight:900;font-size:.8rem}.df-shell h2{margin:8px 0 5px}.df-shell-status{border:1px solid var(--border);border-radius:15px;padding:12px;margin:12px 0;background:var(--surface-2)}.df-shell-primary{width:100%;min-height:66px;font-size:1.08rem;font-weight:900;margin:10px 0}.df-shell-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.df-shell-actions button{min-height:50px}.df-shell-note{font-size:.86rem;color:var(--muted);line-height:1.5;margin-top:14px}
`;document.head.appendChild(s)}
function setChrome(leader){
  document.body.classList.toggle('df-leader-mode',leader);
  const title=document.getElementById('pageTitle');if(title)title.textContent=leader?`${role()} Workstation`:'Dashboard';
}
async function doSync(button){
  if(!navigator.onLine){notify?.('Offline · changes will sync automatically when connection returns');return}
  const sync=window.VUSharedData?.syncNow;
  if(typeof sync!=='function'){notify?.('Shared sync is still loading');return}
  const old=button?.textContent;if(button){button.disabled=true;button.textContent='Syncing…'}
  try{await sync({quiet:true});notify?.('Shared data synced')}catch(e){alert(e?.message||'Could not sync right now')}finally{if(button){button.disabled=false;button.textContent=old||'Sync now'}await renderLeaderHome()}
}
async function renderLeaderHome(){
  if(!isLeader()||applying)return false;
  const main=document.getElementById('main');if(!main)return false;
  applying=true;
  try{
    ensureStyles();setChrome(true);
    const r=role(),state=await syncState();
    const actionLabel=r==='Painting'?'Open Painting orders':r==='Delivery'?'Open physical dispatch':'Open My Work Today';
    const expl=r==='Painting'?'Capture actual painted quantities against the full customer order.':r==='Delivery'?'Capture exactly what was physically delivered or collected, including partial orders.':`Capture actual ${r.toLowerCase()} production directly. Targets follow the latest plan stored on this phone.`;
    main.innerHTML=`<div class="df-shell"><section class="df-shell-hero"><span class="df-shell-role">${safe(r)}</span><h2>My Work Today</h2><p class="muted">${safe(expl)}</p><div class="df-shell-status"><strong>${safe(state.label)}</strong>${state.pending?`<div class="muted">${state.pending} local change${state.pending===1?'':'s'} will be sent when sync succeeds.</div>`:''}${state.conflicts?`<div class="muted">${state.conflicts} conflict${state.conflicts===1?'':'s'} waiting for manager review.</div>`:''}</div><button class="primary df-shell-primary" id="dfShellOpen">${safe(actionLabel)}</button><div class="df-shell-actions"><button id="dfShellSync">Sync now</button><button id="dfShellRole">Change role</button></div><p class="df-shell-note">Work is saved on this device first. Losing internet does not erase the quantities already entered. Keep the app installed/opened on this phone so the latest plan is available offline.</p></section></div>`;
    document.getElementById('dfShellOpen').onclick=()=>window.VUDigitalFactory?.openMyWork?.();
    document.getElementById('dfShellRole').onclick=()=>window.VUDigitalFactory?.openRoleSetup?.();
    document.getElementById('dfShellSync').onclick=e=>doSync(e.currentTarget);
    return true;
  }finally{applying=false}
}
function restoreManager(){setChrome(false);try{window.VUNavigationAuthority?.navigate?.('dashboard')}catch{}}
async function apply(){if(isLeader())await renderLeaderHome();else restoreManager()}
const obs=new MutationObserver(()=>{if(isLeader()&&!applying&&document.getElementById('main')&&!document.querySelector('.df-shell'))setTimeout(renderLeaderHome,30)});obs.observe(document.body,{childList:true,subtree:true});
window.addEventListener('vu:device-role-changed',()=>setTimeout(apply,40));window.addEventListener('online',()=>setTimeout(renderLeaderHome,100));window.addEventListener('offline',()=>setTimeout(renderLeaderHome,100));window.addEventListener('vu:local-mutation',()=>setTimeout(renderLeaderHome,250));
setTimeout(apply,300);
window.VUDigitalFactoryRoleShell={version:'9.3.1',apply,renderLeaderHome,isLeader};
})();