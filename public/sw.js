// METTLE Service Worker — Push Notifications + Offline Cache
const CACHE_NAME = "mettle-v3";
const OFFLINE_URLS = [
  "/apex-athlete",
  "/apex-athlete/landing",
  "/apex-athlete/portal",
  "/apex-athlete/athlete",
  "/apex-athlete/parent",
  "/mettle-brand/v5/mettle-icon.svg",
  "/mettle-brand/v5/mettle-wordmark.svg",
  "/mettle-brand/v5/mettle-logo-full.svg",
];

// ── Install: pre-cache critical pages ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first with cache fallback ──
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only cache same-origin navigation and asset requests
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  // Skip API routes — always go to network
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for METTLE pages
        if (response.ok && url.pathname.startsWith("/apex-athlete")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback to main page for navigation requests
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
