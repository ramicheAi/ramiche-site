// Apex Athlete Service Worker — Push Notifications

self.addEventListener("push", (event) => {
  let data = { title: "Apex Athlete", body: "New notification", icon: "/agents/apex-icon-192.png" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/agents/apex-icon-192.png",
      badge: "/agents/apex-icon-192.png",
      tag: data.tag || "apex-default",
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

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
