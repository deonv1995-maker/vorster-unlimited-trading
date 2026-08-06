self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    try{
      const keys=await caches.keys();
      await Promise.all(keys.map(key=>caches.delete(key)));
      await self.registration.unregister();
      const clients=await self.clients.matchAll({type:'window'});
      clients.forEach(client=>client.navigate(client.url));
    }catch(error){
      console.warn('Service worker retirement failed',error);
    }
  })());
});

self.addEventListener('fetch',()=>{});
