/* V9.0.73 — deployment freshness guard and installed-client takeover. */
const VU_SW_BUILD='9.0.73';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.map(key=>caches.delete(key)));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await Promise.all(clients.map(async client=>{
    try{
      const url=new URL(client.url);
      url.searchParams.set('vu_build',VU_SW_BUILD);
      await client.navigate(url.href);
    }catch{}
  }));
})());});
self.addEventListener('fetch',event=>{const request=event.request;if(request.mode==='navigate'){event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>fetch(request)));return;}event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(request)));});
