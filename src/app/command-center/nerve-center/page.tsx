"use client";

import { useEffect, useRef } from "react";

export default function NerveCenterPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/yolo-builds/2026-03-17-proximon-nerve-centre/index.html")
      .then((r) => r.text())
      .then((html) => {
        if (!containerRef.current) return;
        const shadow = containerRef.current.attachShadow({ mode: "open" });
        shadow.innerHTML = html
          .replace(/<!DOCTYPE html>/i, "")
          .replace(/<\/?html[^>]*>/gi, "")
          .replace(/<\/?head[^>]*>/gi, "")
          .replace(/<\/?body[^>]*>/gi, "")
          .replace(/<meta[^>]*>/gi, "")
          .replace(/<title[^>]*>.*?<\/title>/gi, "");
      });
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100vh",
        overflow: "auto",
        background: "#0a0a0f",
      }}
    />
  );
}
