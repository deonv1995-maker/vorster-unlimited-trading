/* V9.0.22 — stable minimal service worker.
   No cache deletion, unregister loop, forced navigation, or background data work. */
self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});
