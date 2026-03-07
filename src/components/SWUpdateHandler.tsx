"use client";

import { useEffect } from "react";

export default function SWUpdateHandler() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Nuclear: unregister ALL service workers and clear ALL caches on every page load.
    // We do NOT re-register any SW. No caching, period.
    (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
      } catch {
        // Silent fail
      }
    })();
  }, []);

  return null;
}
