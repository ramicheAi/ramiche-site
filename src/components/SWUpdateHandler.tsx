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

    // On every page load, check for SW updates
    navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
      if (reg) reg.update();
    });

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
