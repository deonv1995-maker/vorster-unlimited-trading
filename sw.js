const CACHE="vorster-trading-v1-alpha7-6-0";
const ASSETS=["./","index.html","styles.css","inventory.css","db.js","app.js","inventory.js","production-capacity.js","sage-sync.js","job-card-import.js","manifest.webmanifest","vorster-logo.jpg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
