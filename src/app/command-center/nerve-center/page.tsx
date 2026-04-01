"use client";

import Link from "next/link";

export default function NerveCenterPage() {
  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden", background: "#000000" }}>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "8px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <Link href="/command-center" style={{
          fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#737373", textDecoration: "none",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
        </Link>
        <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.15em" }}>NERVE CENTER v1</span>
      </div>
      <div style={{ paddingTop: 40, width: "100%", height: "100%", background: "#000000" }}>
        <iframe
          src="/yolo-builds/2026-03-17-nerve-center/index.html"
          style={{
            width: "100%",
            height: "calc(100% - 40px)",
            border: "none",
            background: "#000000",
          }}
          title="Nerve Center — Agent War Room"
        />
      </div>
    </div>
  );
}
