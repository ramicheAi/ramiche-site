// METTLE Service Worker — Push Notifications + Offline Cache
// Cache version uses deploy timestamp — forces full refresh on every deploy
// sw.js is served with no-cache headers so browsers always fetch the latest copy
const CACHE_VERSION = "1740960000000";
const CACHE_NAME = `mettle-${CACHE_VERSION}`;
const OFFLINE_URLS = [
  "/apex-athlete",
  "/apex-athlete/landing",
  "/mettle-brand/v5/mettle-icon.svg",
  "/mettle-brand/v5/mettle-wordmark.svg",
  "/mettle-brand/v5/mettle-logo-full.svg",
];

// ── Install: pre-cache critical pages, skip waiting immediately ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: delete ALL old caches, claim clients, notify all tabs to reload ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
     .then(() => self.clients.matchAll({ type: "window" }))
     .then((windowClients) => {
       windowClients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
     })
  );
});

// ── Message handler: force skip waiting from app ──
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ── Fetch: network-first, cache fallback for offline only ──
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  // Skip API routes and Next.js internals — always network
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache navigation requests (HTML pages), not JS/CSS chunks
        if (response.ok && event.request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache (offline fallback)
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match("/apex-athlete");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});

// ── Push Notifications ──
self.addEventListener("push", (event) => {
  let data = { title: "METTLE", body: "New notification", icon: "/mettle-brand/v5/mettle-icon.svg" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/mettle-brand/v5/mettle-icon.svg",
      badge: "/mettle-brand/v5/mettle-icon.svg",
      tag: data.tag || "mettle-default",
      data: data.url || "/apex-athlete",
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data || "/apex-athlete";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/apex-athlete") && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
