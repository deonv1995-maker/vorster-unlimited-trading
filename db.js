const DB_NAME="vorsterTradingV1";
const DB_VERSION=9;
const STORES=["products","customers","orders","settings","activities","productionJobs","deliveries","quotes","visits","inventoryBalances","inventoryTransactions","sageSync","sageMappings","importMappings","syncOutbox","syncMeta","syncConflicts"];
const VU_SYNCABLE_STORES=new Set(["products","customers","orders","activities","productionJobs","deliveries","quotes","visits","inventoryBalances","inventoryTransactions","sageMappings","importMappings"]);
window.VU_SYNCABLE_STORES=VU_SYNCABLE_STORES;
window.VUSyncSuspendDepth=window.VUSyncSuspendDepth||0;
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const name of STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function rawGetAll(store){const db=await openDB();return new Promise((resolve,reject)=>{const req=db.transaction(store,"readonly").objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
async function rawGetOne(store,id){const db=await openDB();return new Promise((resolve,reject)=>{const req=db.transaction(store,"readonly").objectStore(store).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function rawPutOne(store,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,"readwrite");tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error)})}
async function rawDeleteOne(store,id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,"readwrite");tx.objectStore(store).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
window.VUDbRawGetAll=rawGetAll;window.VUDbRawGetOne=rawGetOne;window.VUDbRawPut=rawPutOne;window.VUDbRawDelete=rawDeleteOne;
function vuDeviceId(){let id=localStorage.getItem('vu-sync-device-id');if(!id){id=(crypto?.randomUUID?.()||`device-${Date.now()}-${Math.random().toString(16).slice(2)}`);localStorage.setItem('vu-sync-device-id',id)}return id}window.VUDeviceId=vuDeviceId;
let mutationTimer=null;const mutationBatch=new Map();
function queueLocalMutation(store,recordId){const key=`${store}|${recordId}`;mutationBatch.set(key,{store,recordId:String(recordId)});if(mutationTimer)return;mutationTimer=setTimeout(()=>{mutationTimer=null;const changes=[...mutationBatch.values()];mutationBatch.clear();try{window.dispatchEvent(new CustomEvent('vu:local-mutation',{detail:{changes,count:changes.length,stores:[...new Set(changes.map(x=>x.store))]}}))}catch{}},120)}
window.VUQueueLocalMutation=queueLocalMutation;
async function enqueueSyncMutation(store,recordId,operation,payload){if(!VU_SYNCABLE_STORES.has(store)||window.VUSyncSuspendDepth>0||recordId===undefined||recordId===null)return;const key=`${store}|${recordId}`,meta=await rawGetOne('syncMeta',key),mutation={id:key,store,recordId:String(recordId),operation,payload:operation==='delete'?null:payload,baseRevision:Number(meta?.revision||0),createdAt:new Date().toISOString(),deviceId:vuDeviceId(),attempts:0};await rawPutOne('syncOutbox',mutation);queueLocalMutation(store,recordId)}
window.VUEnqueueSyncMutation=enqueueSyncMutation;
async function getAll(store){return rawGetAll(store)}async function getOne(store,id){return rawGetOne(store,id)}
async function putOne(store,value){const result=await rawPutOne(store,value);if(value&&value.id!==undefined)await enqueueSyncMutation(store,value.id,'put',value);return result}
async function deleteOne(store,id){await rawDeleteOne(store,id);await enqueueSyncMutation(store,id,'delete',null)}
async function clearStore(store){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,"readwrite");tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
