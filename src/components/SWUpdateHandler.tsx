"use client";

import { useEffect } from "react";

export default function SWUpdateHandler() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Listen for SW_UPDATED message — reload when new SW takes control
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Nuclear cache clear on every page load:
    // 1. Delete ALL caches
    // 2. Unregister ALL service workers
    // 3. Re-register fresh SW
    (async () => {
      try {
        // Clear all caches
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));

        // Unregister all existing SWs
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));

        // Re-register fresh SW
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      } catch {
        // Silent fail — SW not critical for app function
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
