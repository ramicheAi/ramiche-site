"use client";

import { useEffect, useRef } from "react";

export default function NexusPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Load the Nexus Experiment Lab as embedded HTML
    fetch("/api/command-center/yolo-builds/preview/2026-03-18-proximon-nexus-experiment-lab/index.html")
      .then((r) => r.text())
      .then((html) => {
        if (cancelled) return;
        const host = containerRef.current;
        if (!host) return;
        // React Strict Mode in dev runs effects twice; reuse the existing
        // shadow root instead of throwing "Shadow root cannot be created on a
        // host which already hosts a shadow tree".
        const shadow =
          host.shadowRoot ?? host.attachShadow({ mode: "open" });
        shadow.innerHTML = html
          .replace(/<!DOCTYPE html>/i, "")
          .replace(/<\/?html[^>]*>/gi, "")
          .replace(/<\/?head[^>]*>/gi, "")
          .replace(/<\/?body[^>]*>/gi, "")
          .replace(/<meta[^>]*>/gi, "")
          .replace(/<title[^>]*>.*?<\/title>/gi, "");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100vh",
        overflow: "auto",
        background: "#050508",
      }}
    />
  );
}
