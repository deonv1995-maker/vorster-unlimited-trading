/* V9.0.45 — transport adapter for reliable shared-data pulls.
   The legacy sync engine asks Supabase for up to 500 full JSON records at once.
   That can exceed the hosted database statement timeout when product payloads are large.
   This adapter intercepts only that legacy read and fulfils it through the authenticated
   vu_pull_records RPC in small cursor-based batches. Push/conflict/business logic remains
   owned by shared-data-v9.js. */
(function(){
'use strict';

const nativeFetch=window.fetch.bind(window);
const PAGE_SIZE=10;
let cache=null;
let cacheWorkspace='';
let cachePromise=null;

function requestUrl(input){
  if(typeof input==='string')return input;
  if(input instanceof URL)return input.href;
  return input?.url||'';
}

function isLegacySharedPull(url){
  try{
    const u=new URL(url,location.href);
    return u.pathname.endsWith('/rest/v1/vu_records') &&
      u.searchParams.get('limit')==='500' &&
      String(u.searchParams.get('select')||'').includes('payload');
  }catch{return false}
}

function workspaceFrom(url){
  const u=new URL(url,location.href);
  return String(u.searchParams.get('workspace_id')||'').replace(/^eq\./,'');
}

function offsetFrom(url){
  const u=new URL(url,location.href);
  return Math.max(0,Number(u.searchParams.get('offset')||0));
}

function headersFrom(input,init){
  const h=new Headers(input instanceof Request?input.headers:undefined);
  const extra=new Headers(init?.headers||undefined);
  extra.forEach((v,k)=>h.set(k,v));
  if(!h.has('Content-Type'))h.set('Content-Type','application/json');
  if(!h.has('Accept'))h.set('Accept','application/json');
  return h;
}

async function loadWorkspace(workspace,headers,baseUrl){
  const records=[];
  let afterUpdatedAt=null,afterStore=null,afterRecord=null;
  let safety=0;
  const rpcUrl=new URL('/rest/v1/rpc/vu_pull_records',baseUrl).href;

  while(true){
    if(++safety>10000)throw new Error('Shared-data pull safety limit reached');
    const response=await nativeFetch(rpcUrl,{
      method:'POST',
      headers,
      body:JSON.stringify({
        p_workspace:workspace,
        p_after_updated_at:afterUpdatedAt,
        p_after_store:afterStore,
        p_after_record:afterRecord,
        p_limit:PAGE_SIZE
      })
    });
    const text=await response.text();
    let rows=[];
    try{rows=text?JSON.parse(text):[]}catch{rows=[]}
    if(!response.ok){
      const message=rows?.message||rows?.details||rows?.hint||text||`Shared-data batch failed (${response.status})`;
      throw new Error(message);
    }
    if(!Array.isArray(rows))rows=[];
    records.push(...rows);
    if(rows.length<PAGE_SIZE)break;
    const last=rows[rows.length-1];
    afterUpdatedAt=last.updated_at;
    afterStore=last.store_name;
    afterRecord=last.record_id;
  }
  return records;
}

window.fetch=async function vuBatchedFetch(input,init){
  const url=requestUrl(input);
  if(!isLegacySharedPull(url))return nativeFetch(input,init);

  try{
    const workspace=workspaceFrom(url);
    const offset=offsetFrom(url);
    const headers=headersFrom(input,init);
    const baseUrl=new URL(url,location.href).origin;

    // A legacy offset=0 request starts a fresh snapshot. The following offset request
    // reuses the exact same snapshot so pagination stays deterministic.
    if(offset===0 || cacheWorkspace!==workspace || !cache){
      cacheWorkspace=workspace;
      cache=null;
      cachePromise=loadWorkspace(workspace,headers,baseUrl);
      cache=await cachePromise;
    }else if(cachePromise){
      cache=await cachePromise;
    }

    const rows=(cache||[]).slice(offset,offset+500);
    return new Response(JSON.stringify(rows),{
      status:200,
      headers:{'Content-Type':'application/json','X-VU-Batched-Pull':'1'}
    });
  }catch(error){
    console.error('Batched shared-data pull failed',error);
    return new Response(JSON.stringify({message:error?.message||String(error)}),{
      status:500,
      headers:{'Content-Type':'application/json','X-VU-Batched-Pull':'1'}
    });
  }
};

window.VU_SHARED_BATCHED_PULL={version:'9.0.45',pageSize:PAGE_SIZE};
})();
