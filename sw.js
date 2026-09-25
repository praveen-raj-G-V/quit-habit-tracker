const C = "quit-habit-v4";

const A = [
  "./",
  "./index.html",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", e =>
  e.waitUntil(
    caches.open(C).then(cache => cache.addAll(A))
  )
);

self.addEventListener("activate", e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== C)
          .map(key => caches.delete(key))
      )
    )
  )
);

self.addEventListener("fetch", e =>
  e.respondWith(
    caches.match(e.request).then(response =>
      response || fetch(e.request)
    )
  )
);
