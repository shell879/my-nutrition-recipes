// ──────────────────────────────────────────────────────────────
// ShellDesignz PWA Service Worker
// ──────────────────────────────────────────────────────────────
//
// This service worker makes the app usable offline by caching the
// "app shell" (HTML, CSS, JS, images). It uses two strategies:
//
//   1. Cache-first  → static assets (CSS, JS, images, HTML)
//      Serves from cache instantly; only hits the network if the
//      file isn't cached at all. Fast, but means the user sees the
//      last-cached version until the cache version is bumped.
//
//   2. Network-first → JSON data files (.json)
//      Tries the network first so users always see fresh data.
//      Falls back to cache only if the network fails (offline).
//
//   3. Bypass        → /api/* routes and Access-protected pages
//      The service worker does NOT intercept these. The browser
//      handles them directly so Cloudflare Access can redirect
//      to the login page without CORS errors.
//
// ──────────────────────────────────────────────────────────────

// Bump this version number every time you change this file.
// When the browser sees a new version, it installs the new SW,
// activates it, and deletes all caches from the old version.
// Without this, users would be stuck on the old cached files.
const CACHE_NAME = "shelldesignz-v18";

// ──────────────────────────────────────────────────────────────
// Pre-cache list
// ──────────────────────────────────────────────────────────────
// These files are fetched and cached during the install event
// so the app works offline on first load.
//
// IMPORTANT: Do NOT include Access-protected pages here.
// Pages behind Cloudflare Access (/admin, /Christmas, /callahannutrition,
// /mynutrition/, /mynutritionadmin/) redirect to the Access login page, which
// is on a different domain (cloudflareaccess.com). If the service
// worker tries to cache that redirect, it gets a CORS error and
// the entire install fails — breaking ALL pages, not just the
// protected ones. Access-protected pages are loaded live by the
// browser after the user logs in.
//
// JSON data files are intentionally excluded from pre-caching.
// They use a network-first strategy in the fetch handler below
// so users always get fresh data when online.
const ASSETS = [
  "/",                              // Home page
  "/styles.css",                    // Global styles
  "/app.js",                        // Main app logic
  "/manifest.json",                 // PWA manifest
  "/icon-192.png",                  // PWA icon (small)
  "/icon-512.png",                  // PWA icon (large)
];

// ──────────────────────────────────────────────────────────────
// Install event — pre-cache the app shell
// ──────────────────────────────────────────────────────────────
// Fires when the browser first registers this service worker
// (or when the CACHE_NAME changes). We open the cache and store
// all files in ASSETS. If any file fails to fetch, the entire
// install fails and the old service worker stays active.
//
// skipWaiting() tells the new service worker to activate
// immediately without waiting for all tabs to close.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ──────────────────────────────────────────────────────────────
// Activate event — clean up old caches
// ──────────────────────────────────────────────────────────────
// Fires after install completes. We delete every cache that
// doesn't match the current CACHE_NAME. This frees up storage
// and ensures users aren't serving stale files from an old
// service worker version.
//
// clients.claim() makes the new service worker take control of
// all open tabs immediately, rather than waiting for a refresh.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ──────────────────────────────────────────────────────────────
// Fetch event — intercept network requests
// ──────────────────────────────────────────────────────────────
// Every request the app makes goes through here. We decide
// whether to serve from cache, hit the network, or let the
// browser handle it directly.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ── 1. API routes: bypass entirely ────────────────────────
  // /api/* requests go straight to the Worker (data-api).
  // The service worker does NOT cache or intercept these.
  // The Worker handles its own caching via Cache-Control headers.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // ── 2. Access-protected routes: bypass entirely ───────────
  // These paths are protected by Cloudflare Access. If the
  // service worker intercepts them, it follows the redirect to
  // the Access login page (on cloudflareaccess.com), which
  // triggers a CORS error and breaks the page. By returning
  // without calling respondWith(), the browser handles these
  // requests directly — Access can redirect to login normally.
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/Christmas") ||
    url.pathname.startsWith("/callahannutrition") ||
    url.pathname === "/mynutrition" ||
    url.pathname.startsWith("/mynutrition/") ||
    url.pathname.startsWith("/mynutritionadmin")
  ) {
    return;
  }

  // ── 3. JSON data files: network-first ─────────────────────
  // Data files (like /data.json, /christmas.json) change when
  // users update records. We always try the network first so
  // users see fresh data. If the network fails (offline), we
  // fall back to whatever is in the cache.
  //
  // This fixes the issue where one user updates a record via
  // /admin and another PWA user doesn't see the update because
  // the service worker was serving the old cached JSON file.
  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Network succeeded — cache the fresh copy for offline use
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, clone)
            );
          }
          return response;
        })
        .catch(() => {
          // Network failed (offline) — serve from cache if available
          return caches.match(event.request);
        })
    );
    return;
  }

  // ── 4. Static assets: cache-first ─────────────────────────
  // For HTML, CSS, JS, and images, serve from cache instantly
  // (fast load). Only hit the network if the file isn't cached
  // at all. When we do fetch from network, we cache the response
  // for next time.
  //
  // This is the right strategy for the "app shell" — the files
  // that make up the app's UI don't change often, so serving
  // from cache makes the app feel instant.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // Cache new responses for next time
          if (response.ok && event.request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, clone)
            );
          }
          return response;
        }).catch(() => cached)
      );
    })
  );
});
