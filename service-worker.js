// ShellDesignz PWA Service Worker
const CACHE_NAME = "shelldesignz-v2";

const ASSETS = [
  "/",
  "/Christmas/",
  "/Christmas/index.html",
  "/Christmas/christmas.css",
  "/Christmas/christmas.js",
  "/admin/",
  "/admin/index.html",
  "/admin.css",
  "/admin.js",
  "/callahannutrition/",
  "/callahannutrition/index.html",
  "/styles.css",
  "/app.js",
  "/data.json",
  "/christmas.json",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install — cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first for assets, network-first for API
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls always go to network (don't cache)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Everything else: cache first, fall back to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache new responses for next time
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
