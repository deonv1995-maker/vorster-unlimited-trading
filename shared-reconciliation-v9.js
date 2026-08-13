/* V9.4.3 — quiet shared-data reconciliation.
   Reconciles on startup/reconnect/resume only. Remote raw writes do not trigger foreground page redraws. */
(function(){
'use strict';
const CFG_KEY='vu-shared-data-config',SESSION_KEY='vu-shared-data-session',PAGE_SIZE=25;
let running=false,timer=null;
const config=()=>{try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch{return{}}};
const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
const enabled=()=>{const c=config(),s=session();return !!(c.enabled&&c.projectUrl&&c.publishableKey&&c.workspaceId&&s?.access_token)};
function canonical(value){if(value===undefined)return undefined;if(value===null||typeof value!=='object')return Number.isNaN(value)?null:value;if(Array.isArray(value))return value.map(v=>v===undefined?null:canonical(v));const out={};for(const key of Object.keys(value).sort()){const next=canonical(value[key]);if(next!==undefined)out[key]=next}return out}
const stable=v=>{try{return JSON.stringify(canonical(v??null))}catch{return String(v)}};
async function saveMeta(store,id,revision,updatedAt,workspaceId){return VUDbRawPut('syncMeta',{id:`${store}|${id}`,store,recordId:String(id),revision:Number(revision||0),remoteUpdatedAt:updatedAt||null,workspaceId,updatedAt:new Date().toISOString()})}
async function pullAll(){
  const c=config(),s=session();if(!enabled()||!navigator.onLine||document.visibilityState!=='visible')return{pulled:0,skippedPending:0};
  try{if(window.VUSharedData?.syncNow)await window.VUSharedData.syncNow({quiet:true})}catch(e){console.warn('Pre-reconciliation sync',e)}
  const base=String(c.projectUrl||'').replace(/\/$/,''),headers={'apikey':String(c.publishableKey||''),'Authorization':`Bearer ${s.access_token}`,'Content-Type':'application/json','Accept':'application/json'},url=`${base}/rest/v1/rpc/vu_pull_records`;
  let afterUpdatedAt=null,afterStore=null,afterRecord=null,pulled=0,skippedPending=0,safety=0;
  while(true){
    if(++safety>5000)throw new Error('Shared reconciliation safety limit reached');
    const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({p_workspace:c.workspaceId,p_after_updated_at:afterUpdatedAt,p_after_store:afterStore,p_after_record:afterRecord,p_limit:PAGE_SIZE})});
    const text=await res.text();let rows=[];try{rows=text?JSON.parse(text):[]}catch{}if(!res.ok)throw new Error(rows?.message||rows?.details||text||`Shared reconciliation failed (${res.status})`);if(!Array.isArray(rows))rows=[];
    for(const r of rows){
      if(!window.VU_SYNCABLE_STORES?.has(r.store_name))continue;
      const pending=await VUDbRawGetOne('syncOutbox',`${r.store_name}|${r.record_id}`);if(pending){skippedPending++;continue}
      const local=await VUDbRawGetOne(r.store_name,r.record_id),meta=await VUDbRawGetOne('syncMeta',`${r.store_name}|${r.record_id}`),remoteRev=Number(r.revision||0),metaRev=Number(meta?.revision||0),payloadDiff=!r.deleted&&stable(local)!==stable(r.payload),needsApply=r.deleted?!!local:(!local||metaRev<remoteRev||payloadDiff);
      if(needsApply){if(r.deleted)await VUDbRawDelete(r.store_name,r.record_id);else if(r.payload)await VUDbRawPut(r.store_name,r.payload);pulled++}
      if(metaRev!==remoteRev||needsApply)await saveMeta(r.store_name,r.record_id,remoteRev,r.updated_at,c.workspaceId);
    }
    if(rows.length<PAGE_SIZE)break;const last=rows[rows.length-1];afterUpdatedAt=last.updated_at;afterStore=last.store_name;afterRecord=last.record_id;
  }
  localStorage.setItem('vu-shared-data-last-reconcile',JSON.stringify({at:new Date().toISOString(),pulled,skippedPending}));if(pulled)localStorage.setItem('vu-shared-data-last-sync',new Date().toISOString());return{pulled,skippedPending};
}
async function reconcile(){if(running)return{busy:true};running=true;try{return await pullAll()}finally{running=false}}
function schedule(delay=1000){clearTimeout(timer);timer=setTimeout(()=>reconcile().catch(e=>console.warn('Shared reconciliation',e)),delay)}
window.addEventListener('online',()=>schedule(900));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(700)});
if(enabled())schedule(2500);
window.VUSharedReconciliation={version:'9.4.3',reconcile,stable};
})();