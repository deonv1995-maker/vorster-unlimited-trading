/* V9.0.40 — deployment freshness guard. */
const VU_SW_BUILD='9.0.40';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const request=event.request;if(request.mode==='navigate'){event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>fetch(request)));return;}event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(request)));});
