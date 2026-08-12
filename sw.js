/* V9.0.95 — safe freshness guard. No forced navigation of open clients. */
const VU_SW_BUILD='9.0.95';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.map(key=>caches.delete(key)));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients){try{client.postMessage({type:'VU_BUILD_ACTIVE',build:VU_SW_BUILD})}catch{}}
})());});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(request)));
    return;
  }
  event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(request)));
});