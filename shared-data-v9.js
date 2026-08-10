/* V9.0.41 — authenticated local-first shared-data synchronization.
   Existing IndexedDB remains the immediate source of truth on-device.
   Cloud sync uses an outbox, optimistic revisions, conflict capture and explicit bootstrap.
*/
(function(){
'use strict';
const CFG_KEY='vu-shared-data-config';
const SESSION_KEY='vu-shared-data-session';
let syncTimer=null,syncRunning=false;
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const config=()=>{try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch{return{}}};
const saveConfig=c=>localStorage.setItem(CFG_KEY,JSON.stringify(c||{}));
const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
const saveSession=s=>s?localStorage.setItem(SESSION_KEY,JSON.stringify(s)):localStorage.removeItem(SESSION_KEY);
const apiBase=()=>String(config().projectUrl||'').replace(/\/$/,'');
const key=()=>String(config().publishableKey||'').trim();
const workspaceId=()=>String(config().workspaceId||'').trim();
const enabled=()=>!!(config().enabled&&apiBase()&&key()&&workspaceId()&&session()?.access_token);

async function authRequest(path,body){
  const r=await fetch(`${apiBase()}${path}`,{method:'POST',headers:{'apikey':key(),'Content-Type':'application/json'},body:JSON.stringify(body||{})});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.msg||data?.message||data?.error_description||`Authentication failed (${r.status})`);return data;
}
async function ensureSession(){
  let s=session();if(!s?.access_token)throw new Error('Sign in to shared data first');
  const expires=Number(s.expires_at||0);if(expires&&Date.now()/1000>expires-60&&s.refresh_token){
    const next=await authRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh_token});
    s={...next,expires_at:Math.floor(Date.now()/1000)+Number(next.expires_in||3600)};saveSession(s);
  }
  return s;
}
async function rest(path,options={}){
  const s=await ensureSession();const headers={'apikey':key(),'Authorization':`Bearer ${s.access_token}`,'Content-Type':'application/json','Accept':'application/json',...(options.headers||{})};
  const r=await fetch(`${apiBase()}/rest/v1/${path}`,{...options,headers});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(data?.message||data?.hint||data?.details||`Cloud request failed (${r.status})`);return data;
}
async function signUp(email,password){
  const d=await authRequest('/auth/v1/signup',{email:String(email).trim(),password:String(password)});
  if(d?.access_token)saveSession({...d,expires_at:Math.floor(Date.now()/1000)+Number(d.expires_in||3600)});return d;
}
async function signIn(email,password){
  const d=await authRequest('/auth/v1/token?grant_type=password',{email:String(email).trim(),password:String(password)});
  saveSession({...d,expires_at:Math.floor(Date.now()/1000)+Number(d.expires_in||3600)});return d;
}
function signOut(){saveSession(null);const c=config();saveConfig({...c,enabled:false});}
async function listWorkspaces(){return await rest('vu_workspaces?select=id,name,created_at&order=created_at.asc')||[]}
async function createWorkspace(name){const d=await rest('rpc/vu_create_workspace',{method:'POST',body:JSON.stringify({p_name:name||'Vorster Unlimited'})});const id=Array.isArray(d)?d[0]:d;const c=config();saveConfig({...c,workspaceId:String(id||'')});return id}
async function addMember(email){const id=workspaceId();if(!id)throw new Error('Select a workspace first');return rest('rpc/vu_add_member_by_email',{method:'POST',body:JSON.stringify({p_workspace:id,p_email:String(email).trim()})})}
async function pendingFor(store,id){return VUDbRawGetOne('syncOutbox',`${store}|${id}`)}
async function metaFor(store,id){return VUDbRawGetOne('syncMeta',`${store}|${id}`)}
async function saveMeta(store,id,revision,updatedAt){return VUDbRawPut('syncMeta',{id:`${store}|${id}`,store,recordId:String(id),revision:Number(revision||0),remoteUpdatedAt:updatedAt||null,workspaceId:workspaceId(),updatedAt:new Date().toISOString()})}
async function pushOne(m){
  const body={p_workspace:workspaceId(),p_store:m.store,p_record_id:String(m.recordId),p_payload:m.operation==='delete'?null:m.payload,p_deleted:m.operation==='delete',p_expected_revision:Number(m.baseRevision||0)};
  const d=await rest('rpc/vu_apply_record',{method:'POST',body:JSON.stringify(body)});const r=Array.isArray(d)?d[0]:d;
  if(!r)throw new Error('Cloud returned no sync result');
  if(r.conflict){
    await VUDbRawPut('syncConflicts',{id:m.id,store:m.store,recordId:String(m.recordId),localMutation:m,remote:{payload:r.payload,deleted:r.deleted,revision:Number(r.revision||0),updatedAt:r.updated_at},createdAt:new Date().toISOString(),workspaceId:workspaceId()});
    await VUDbRawPut('syncOutbox',{...m,attempts:Number(m.attempts||0)+1,lastError:'revision-conflict'});return{conflict:true};
  }
  await saveMeta(m.store,m.recordId,r.revision,r.updated_at);await VUDbRawDelete('syncOutbox',m.id);await VUDbRawDelete('syncConflicts',m.id).catch(()=>{});return{conflict:false};
}
async function pushOutbox(){
  const all=(await VUDbRawGetAll('syncOutbox')).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));let pushed=0,conflicts=0;
  for(const m of all){const r=await pushOne(m);if(r.conflict)conflicts++;else pushed++}
  return{pushed,conflicts};
}
async function pullRemote(){
  const wid=workspaceId();if(!wid)return{pulled:0};let offset=0,pulled=0;
  while(true){
    const rows=await rest(`vu_records?workspace_id=eq.${encodeURIComponent(wid)}&select=store_name,record_id,payload,deleted,revision,updated_at&order=updated_at.asc&limit=500&offset=${offset}`)||[];
    for(const r of rows){
      if(!window.VU_SYNCABLE_STORES?.has(r.store_name))continue;
      if(await pendingFor(r.store_name,r.record_id))continue;
      const meta=await metaFor(r.store_name,r.record_id);if(Number(meta?.revision||0)>=Number(r.revision||0))continue;
      window.VUSyncSuspendDepth++;
      try{if(r.deleted)await VUDbRawDelete(r.store_name,r.record_id);else if(r.payload)await VUDbRawPut(r.store_name,r.payload)}finally{window.VUSyncSuspendDepth--}
      await saveMeta(r.store_name,r.record_id,r.revision,r.updated_at);pulled++;
    }
    if(rows.length<500)break;offset+=rows.length;
  }
  return{pulled};
}
async function syncNow({quiet=false}={}){
  if(syncRunning)return{busy:true};if(!enabled())throw new Error('Shared data is not enabled yet');syncRunning=true;
  try{const pushed=await pushOutbox();const pulled=await pullRemote();localStorage.setItem('vu-shared-data-last-sync',new Date().toISOString());if(!quiet&&typeof notify==='function')notify(`Shared data synced · ${pushed.pushed} sent · ${pulled.pulled} received${pushed.conflicts?` · ${pushed.conflicts} conflict${pushed.conflicts===1?'':'s'}`:''}`);return{...pushed,...pulled}}finally{syncRunning=false;updateSyncBadge()}
}
async function cloudHasRecords(){const rows=await rest(`vu_records?workspace_id=eq.${encodeURIComponent(workspaceId())}&select=record_id&limit=1`);return !!rows?.length}
async function publishInitialDatabase(){
  if(!enabled())throw new Error('Connect and enable shared data first');if(await cloudHasRecords())throw new Error('The shared workspace already contains data. Initial publish is blocked to prevent an accidental overwrite.');
  let count=0;for(const store of window.VU_SYNCABLE_STORES||[]){for(const row of await VUDbRawGetAll(store)){if(row?.id===undefined)continue;await VUDbRawPut('syncOutbox',{id:`${store}|${row.id}`,store,recordId:String(row.id),operation:'put',payload:row,baseRevision:0,createdAt:new Date().toISOString(),deviceId:VUDeviceId(),attempts:0});count++}}
  const result=await syncNow({quiet:true});return{queued:count,...result};
}
async function conflictCount(){return (await VUDbRawGetAll('syncConflicts')).length}
async function resolveConflict(id,choice){
  const c=await VUDbRawGetOne('syncConflicts',id);if(!c)return;
  if(choice==='cloud'){
    window.VUSyncSuspendDepth++;try{if(c.remote.deleted)await VUDbRawDelete(c.store,c.recordId);else if(c.remote.payload)await VUDbRawPut(c.store,c.remote.payload)}finally{window.VUSyncSuspendDepth--}
    await saveMeta(c.store,c.recordId,c.remote.revision,c.remote.updatedAt);await VUDbRawDelete('syncOutbox',id);await VUDbRawDelete('syncConflicts',id);
  }else if(choice==='local'){
    const m=c.localMutation;await VUDbRawPut('syncOutbox',{...m,baseRevision:Number(c.remote.revision||0),attempts:0,lastError:null,createdAt:new Date().toISOString()});await VUDbRawDelete('syncConflicts',id);await syncNow({quiet:true});
  }
}
async function openConflictReview(){
  const rows=await VUDbRawGetAll('syncConflicts');openDialog(`<div class="dialog-head"><div><div class="step-label">Shared data</div><h2>Sync conflicts</h2></div><button class="close-btn" onclick="closeDialog()">×</button></div>${rows.length?rows.map(c=>`<section class="card"><strong>${safe(c.store)} · ${safe(c.recordId)}</strong><p class="muted">Another phone changed this record before this phone synced. Choose which version should win.</p><div class="actions"><button data-use-cloud="${safe(c.id)}">Use shared version</button><button class="primary" data-use-local="${safe(c.id)}">Keep this phone's version</button></div></section>`).join(''):'<div class="empty">No sync conflicts.</div>'}`);
  document.querySelectorAll('[data-use-cloud]').forEach(b=>b.onclick=async()=>{await resolveConflict(b.dataset.useCloud,'cloud');openConflictReview()});document.querySelectorAll('[data-use-local]').forEach(b=>b.onclick=async()=>{await resolveConflict(b.dataset.useLocal,'local');openConflictReview()});
}
function scheduleSync(){if(!enabled()||!navigator.onLine)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow({quiet:true}).catch(e=>console.warn('Background shared-data sync',e)),1200)}
window.addEventListener('vu:local-mutation',scheduleSync);window.addEventListener('online',scheduleSync);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleSync()});

function updateSyncBadge(){const badge=document.getElementById('vuSharedDataStatus');if(!badge)return;const c=config(),s=session();badge.textContent=!c.projectUrl?'Not configured':!s?.access_token?'Sign-in required':!c.workspaceId?'Choose workspace':c.enabled?'Connected':'Ready to enable'}
async function appendSharedDataCard(){
  if(document.getElementById('vuSharedDataCard'))return;const c=config(),s=session(),conflicts=await conflictCount();const card=document.createElement('section');card.id='vuSharedDataCard';card.className='card';card.innerHTML=`<div class="section-head"><div><div class="step-label">Multi-phone data</div><h2>Shared data</h2><p class="muted">Local-first cloud synchronization for products, customers, orders, stock and factory workflow data.</p></div><span class="badge" id="vuSharedDataStatus"></span></div>
  <label>Supabase project URL<input id="vuCloudUrl" value="${safe(c.projectUrl||'')}" placeholder="https://xxxx.supabase.co"></label>
  <label>Publishable / anon key<input id="vuCloudKey" value="${safe(c.publishableKey||'')}" placeholder="Project publishable key"></label>
  <div class="actions"><button id="vuSaveCloudConfig">Save connection</button></div>
  <hr><label>Email<input id="vuCloudEmail" type="email" autocomplete="username" placeholder="you@example.com"></label><label>Password<input id="vuCloudPassword" type="password" autocomplete="current-password" placeholder="Password"></label>
  <div class="actions"><button id="vuCloudSignIn" class="primary">Sign in</button><button id="vuCloudSignUp">Create account</button>${s?.access_token?'<button id="vuCloudSignOut">Sign out</button>':''}</div>
  <hr><label>Workspace<select id="vuWorkspaceSelect"><option value="">${s?.access_token?'Load workspaces':'Sign in first'}</option></select></label><div class="actions"><button id="vuRefreshWorkspaces">Refresh workspaces</button><button id="vuCreateWorkspace">Create Vorster workspace</button></div>
  <label>Add another user by email<input id="vuMemberEmail" type="email" placeholder="wife@example.com"></label><button id="vuAddMember">Add member</button>
  <hr><label class="check"><input id="vuSyncEnabled" type="checkbox" ${c.enabled?'checked':''}> Enable automatic shared-data sync on this phone</label>
  <div class="actions"><button id="vuSyncNow" class="primary">Sync now</button><button id="vuPublishInitial">Publish this phone as initial database</button><button id="vuReviewConflicts">Review conflicts (${conflicts})</button></div>
  <p class="muted">Initial publish is only allowed while the cloud workspace is empty. Conflicting edits are held for review rather than silently overwritten.</p>`;main.append(card);updateSyncBadge();
  const saveConn=()=>{const n={...config(),projectUrl:document.getElementById('vuCloudUrl').value.trim(),publishableKey:document.getElementById('vuCloudKey').value.trim()};saveConfig(n);updateSyncBadge();notify?.('Shared-data connection saved')};
  document.getElementById('vuSaveCloudConfig').onclick=saveConn;
  document.getElementById('vuCloudSignIn').onclick=async()=>{try{saveConn();await signIn(document.getElementById('vuCloudEmail').value,document.getElementById('vuCloudPassword').value);notify?.('Signed in');await loadWorkspaces()}catch(e){alert(e.message)}};
  document.getElementById('vuCloudSignUp').onclick=async()=>{try{saveConn();const d=await signUp(document.getElementById('vuCloudEmail').value,document.getElementById('vuCloudPassword').value);alert(d?.access_token?'Account created and signed in.':'Account created. Check your email if confirmation is enabled, then sign in.');if(d?.access_token)await loadWorkspaces()}catch(e){alert(e.message)}};
  document.getElementById('vuCloudSignOut')&&(document.getElementById('vuCloudSignOut').onclick=()=>{signOut();settingsPage()});
  async function loadWorkspaces(){try{const rows=await listWorkspaces(),sel=document.getElementById('vuWorkspaceSelect');sel.innerHTML='<option value="">Choose workspace</option>'+rows.map(w=>`<option value="${safe(w.id)}" ${w.id===config().workspaceId?'selected':''}>${safe(w.name)}</option>`).join('');updateSyncBadge()}catch(e){console.warn(e)}}
  document.getElementById('vuRefreshWorkspaces').onclick=loadWorkspaces;document.getElementById('vuWorkspaceSelect').onchange=e=>{saveConfig({...config(),workspaceId:e.target.value});updateSyncBadge()};
  document.getElementById('vuCreateWorkspace').onclick=async()=>{try{const id=await createWorkspace('Vorster Unlimited');notify?.('Shared workspace created');await loadWorkspaces();document.getElementById('vuWorkspaceSelect').value=id}catch(e){alert(e.message)}};
  document.getElementById('vuAddMember').onclick=async()=>{try{await addMember(document.getElementById('vuMemberEmail').value);notify?.('Workspace member added')}catch(e){alert(e.message)}};
  document.getElementById('vuSyncEnabled').onchange=e=>{saveConfig({...config(),enabled:e.target.checked});updateSyncBadge();if(e.target.checked)scheduleSync()};
  document.getElementById('vuSyncNow').onclick=async()=>{try{await syncNow()}catch(e){alert(e.message)}};
  document.getElementById('vuPublishInitial').onclick=async()=>{if(!confirm('Publish all current business data from THIS phone as the initial shared database?\n\nOnly continue if this phone contains the master/current data.'))return;try{const r=await publishInitialDatabase();alert(`Initial shared database published. ${r.queued} records prepared; ${r.pushed} sent.`)}catch(e){alert(e.message)}};
  document.getElementById('vuReviewConflicts').onclick=openConflictReview;if(s?.access_token)loadWorkspaces();
}
const baseSettings=window.settingsPage;
if(typeof baseSettings==='function'){window.settingsPage=async function sharedDataSettings(...args){await baseSettings(...args);await appendSharedDataCard()};try{settingsPage=window.settingsPage}catch{}}

window.VUSharedData={config,signIn,signUp,signOut,listWorkspaces,createWorkspace,addMember,syncNow,publishInitialDatabase,openConflictReview,enabled};
if(enabled())setTimeout(()=>syncNow({quiet:true}).catch(e=>console.warn('Initial shared-data sync',e)),1800);
})();
