
const DB_NAME="vorsterTradingV1";
const DB_VERSION=7;
const STORES=["products","customers","orders","settings","activities","productionJobs","deliveries","quotes","visits","inventoryBalances","inventoryTransactions","sageSync","sageMappings"];

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      for(const name of STORES){
        if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:"id"});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function getAll(store){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(store,"readonly").objectStore(store).getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>reject(req.error);
  });
}
async function getOne(store,id){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(store,"readonly").objectStore(store).get(id);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function putOne(store,value){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete=()=>resolve(value);
    tx.onerror=()=>reject(tx.error);
  });
}
async function deleteOne(store,id){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
async function clearStore(store){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
