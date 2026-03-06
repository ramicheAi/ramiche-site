// Minimal no-op service worker — does nothing, caches nothing
// Exists only to satisfy PWA requirements without causing reload loops
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// No fetch handler — let the browser handle all requests normally
