/* V9.0.65 — self-healing shared-data reconciliation.
   Verifies real local record presence against the shared workspace instead of trusting syncMeta alone.
   Runs only while the app is visible/online and never blocks startup. */
(function(){
'use strict';
const CFG_KEY='vu-shared-data-config';
const SESSION_KEY='vu-shared-data-session';
const PAGE_SIZE=25;
let running=false,timer=null;
const config=()=>{try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch{return{}}};
const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
const enabled=()=>{const c=config(),s=session();return !!(c.enabled&&c.projectUrl&&c.publishableKey&&c.workspaceId&&s?.access_token)};
async function saveMeta(store,id,revision,updatedAt,workspaceId){
  return VUDbRawPut('syncMeta',{id:`${store}|${id}`,store,recordId:String(id),revision:Number(revision||0),remoteUpdatedAt:updatedAt||null,workspaceId,updatedAt:new Date().toISOString()});
}
async function pullAll(){
  const c=config(),s=session();
  if(!enabled()||!navigator.onLine||document.visibilityState!=='visible')return{pulled:0};
  const base=String(c.projectUrl||'').replace(/\/$/,'');
  const headers={'apikey':String(c.publishableKey||''),'Authorization':`Bearer ${s.access_token}`,'Content-Type':'application/json','Accept':'application/json'};
  const url=`${base}/rest/v1/rpc/vu_pull_records`;
  let afterUpdatedAt=null,afterStore=null,afterRecord=null,pulled=0,safety=0;
  while(true){
    if(++safety>5000)throw new Error('Shared reconciliation safety limit reached');
    const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({p_workspace:c.workspaceId,p_after_updated_at:afterUpdatedAt,p_after_store:afterStore,p_after_record:afterRecord,p_limit:PAGE_SIZE})});
    const text=await res.text();let rows=[];try{rows=text?JSON.parse(text):[]}catch{}
    if(!res.ok)throw new Error(rows?.message||rows?.details||text||`Shared reconciliation failed (${res.status})`);
    if(!Array.isArray(rows))rows=[];
    for(const r of rows){
      if(!window.VU_SYNCABLE_STORES?.has(r.store_name))continue;
      const pending=await VUDbRawGetOne('syncOutbox',`${r.store_name}|${r.record_id}`);
      if(pending)continue;
      const local=await VUDbRawGetOne(r.store_name,r.record_id);
      const meta=await VUDbRawGetOne('syncMeta',`${r.store_name}|${r.record_id}`);
      const remoteRev=Number(r.revision||0),metaRev=Number(meta?.revision||0);
      const needsApply=r.deleted?!!local:(!local||metaRev<remoteRev);
      if(needsApply){
        if(r.deleted)await VUDbRawDelete(r.store_name,r.record_id);
        else if(r.payload)await VUDbRawPut(r.store_name,r.payload);
        pulled++;
      }
      if(metaRev<remoteRev||needsApply)await saveMeta(r.store_name,r.record_id,remoteRev,r.updated_at,c.workspaceId);
    }
    if(rows.length<PAGE_SIZE)break;
    const last=rows[rows.length-1];afterUpdatedAt=last.updated_at;afterStore=last.store_name;afterRecord=last.record_id;
  }
  if(pulled){
    localStorage.setItem('vu-shared-data-last-sync',new Date().toISOString());
    try{window.dispatchEvent(new CustomEvent('vu:shared-reconciled',{detail:{pulled}}))}catch{}
    const r=String(window.route||'');
    try{
      if(r==='dashboard'&&typeof window.dashboard==='function')await window.dashboard();
      else if(r==='products'&&typeof window.productsPage==='function')await window.productsPage();
      else if(r==='customers'&&typeof window.customersPage==='function')await window.customersPage();
      else if(r==='orders'&&typeof window.ordersPage==='function')await window.ordersPage();
      else if(r==='quotes'&&typeof window.quotesPage==='function')await window.quotesPage();
      else if(r==='production'&&typeof window.productionPage==='function')await window.productionPage();
    }catch(e){console.warn('Shared reconciliation page refresh',e)}
  }
  return{pulled};
}
async function reconcile(){if(running)return{busy:true};running=true;try{return await pullAll()}finally{running=false}}
function schedule(delay=1500){clearTimeout(timer);timer=setTimeout(()=>reconcile().catch(e=>console.warn('Shared reconciliation',e)),delay)}
window.addEventListener('online',()=>schedule(800));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(500)});
setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine&&enabled())reconcile().catch(e=>console.warn('Shared reconciliation interval',e))},15000);
if(enabled())schedule(2200);
window.VUSharedReconciliation={version:'9.0.65',reconcile};
})();
