/* V9.0.43 — safe completion of an interrupted first cloud publish.
   Never overwrites records already present in the workspace. It queues only
   local records whose store+record ID is absent from cloud, then uses the
   existing revision-aware sync engine to upload them. */
(function(){
'use strict';
const CFG_KEY='vu-shared-data-config';
const SESSION_KEY='vu-shared-data-session';
const config=()=>{try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch{return{}}};
const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
const apiBase=()=>String(config().projectUrl||'').replace(/\/$/,'');
const key=()=>String(config().publishableKey||'').trim();
const workspaceId=()=>String(config().workspaceId||'').trim();
async function cloudKeys(){
  const s=session();if(!s?.access_token)throw new Error('Sign in to shared data first');
  const wid=workspaceId();if(!wid)throw new Error('Choose the Vorster Unlimited workspace first');
  const keys=new Set();let offset=0;
  while(true){
    const r=await fetch(`${apiBase()}/rest/v1/vu_records?workspace_id=eq.${encodeURIComponent(wid)}&select=store_name,record_id&limit=500&offset=${offset}`,{headers:{apikey:key(),Authorization:`Bearer ${s.access_token}`,Accept:'application/json'}});
    const rows=await r.json().catch(()=>[]);if(!r.ok)throw new Error(rows?.message||`Could not read shared workspace (${r.status})`);
    for(const row of rows)keys.add(`${row.store_name}|${row.record_id}`);
    if(rows.length<500)break;offset+=rows.length;
  }
  return keys;
}
async function completeInitialPublish(){
  const c=config();if(!c.enabled)throw new Error('Enable automatic shared-data sync on this phone first');
  if(!window.VUSharedData?.syncNow)throw new Error('Shared-data engine is not loaded');
  const remote=await cloudKeys();let local=0,alreadyShared=0,queued=0;
  for(const store of window.VU_SYNCABLE_STORES||[]){
    const rows=await VUDbRawGetAll(store);
    for(const row of rows){
      if(row?.id===undefined||row?.id===null)continue;local++;
      const id=String(row.id),compound=`${store}|${id}`;
      if(remote.has(compound)){alreadyShared++;continue;}
      const existing=await VUDbRawGetOne('syncOutbox',compound);
      if(!existing){
        await VUDbRawPut('syncOutbox',{id:compound,store,recordId:id,operation:'put',payload:row,baseRevision:0,createdAt:new Date().toISOString(),deviceId:VUDeviceId(),attempts:0});
        queued++;
      }
    }
  }
  const result=await window.VUSharedData.syncNow({quiet:true});
  return{local,alreadyShared,queued,pushed:Number(result?.pushed||0),pulled:Number(result?.pulled||0),conflicts:Number(result?.conflicts||0)};
}
window.VUCompleteInitialPublish=completeInitialPublish;

const baseSettings=window.settingsPage;
if(typeof baseSettings==='function'){
  window.settingsPage=async function sharedBootstrapSettings(...args){
    await baseSettings(...args);
    const btn=document.getElementById('vuPublishInitial');if(!btn)return;
    btn.textContent='Complete initial master upload';
    const note=btn.closest('.card')?.querySelector('p.muted:last-child');
    if(note)note.textContent='Safe first-time completion: existing shared records are kept; only records missing from the cloud are uploaded. Conflicting edits are still held for review.';
    btn.onclick=async()=>{
      if(!confirm('Complete the initial master upload from THIS phone?\n\nExisting cloud records will NOT be overwritten. Only missing records will be added.'))return;
      btn.disabled=true;const old=btn.textContent;btn.textContent='Uploading missing records…';
      try{
        const r=await completeInitialPublish();
        alert(`Master upload completed.\n\nLocal records: ${r.local}\nAlready shared: ${r.alreadyShared}\nNewly queued: ${r.queued}\nSent now: ${r.pushed}${r.conflicts?`\nConflicts held for review: ${r.conflicts}`:''}`);
      }catch(e){alert(e.message||String(e))}finally{btn.disabled=false;btn.textContent=old}
    };
  };
  try{settingsPage=window.settingsPage}catch{}
}
})();
