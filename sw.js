const CACHE="vorster-trading-v2-foundation-1-0-0";
const ASSETS=["./","index.html","styles.css","inventory.css","completion-schedule.css","job-card-matching.css","v2-core.css","db.js","app.js","inventory.js","production-capacity.js","sage-sync.js","job-card-import.js","job-card-matching.js","job-card-matching-fix.js","job-card-connection-review.js","product-aliases.js","product-aliases-fix.js","merge-products.js","completion-schedule.js","v2-core.js","app-update.js","manifest.webmanifest","vorster-logo.jpg"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(request.mode==="navigate"||url.pathname.endsWith("/index.html")){
    event.respondWith(fetch(request,{cache:"no-store"})
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
        return response;
      })
      .catch(()=>caches.match(request).then(response=>response||caches.match("index.html"))));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>{
    const network=fetch(request,{cache:"no-cache"}).then(response=>{
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
      }
      return response;
    }).catch(()=>cached);
    return cached||network;
  }));
});
