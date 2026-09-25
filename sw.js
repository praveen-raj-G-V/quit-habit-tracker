const C="quit-habit-v4",A=["./","./index.html","./app.js","./config.js","./manifest.webmanifest"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A)))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.mode==="navigate"){
    e.respondWith(fetch(e.request).catch(()=>caches.match("./index.html")));
    return
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))
});
