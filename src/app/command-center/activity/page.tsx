"use client";

import { useState } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   ACTIVITY — Event Feed & History
   Recent actions, deployments, and system events
   ══════════════════════════════════════════════════════════════════════════════ */

interface ActivityEvent {
  type: "deploy" | "agent" | "build" | "commit" | "alert" | "milestone";
  title: string;
  detail: string;
  time: string;
  color: string;
}

const EVENTS: ActivityEvent[] = [
  { type: "deploy", title: "Command Center deployed", detail: "Visual fixes — thicker borders, brighter text, bolder fonts", time: "11:39 AM", color: "#22c55e" },
  { type: "build", title: "METTLE landing page fixed", detail: "Missing packages installed: @vercel/analytics, speed-insights, nodemailer", time: "10:30 AM", color: "#2563eb" },
  { type: "agent", title: "Agent routing verified", detail: "17 execution agents wired to local Qwen 3.5 — 7 stay on cloud", time: "7:02 AM", color: "#7c3aed" },
  { type: "milestone", title: "Qwen 3.5 downloaded", detail: "35B model (23GB) pulled to Mac — swap to 14B pending", time: "9:15 PM", color: "#d97706" },
  { type: "commit", title: "Agent page: interactive toggles", detail: "Edit mode with skill/tool checkboxes per agent", time: "9:00 PM", color: "#0891b2" },
  { type: "deploy", title: "PWA manifest added", detail: "Parallax + Publish ready for Home Screen with real logos", time: "8:45 PM", color: "#22c55e" },
  { type: "build", title: "Parallax Publish shipped", detail: "4 platforms live — Twitter, Bluesky, LinkedIn. Instagram pending", time: "6:30 PM", color: "#2563eb" },
  { type: "milestone", title: "Full site audit completed", detail: "19 routes checked — 7 marketing shells identified", time: "4:00 PM", color: "#d97706" },
  { type: "commit", title: "LinkedIn OAuth verified", detail: "End-to-end on mobile. Brand rules reinforced", time: "3:15 PM", color: "#0891b2" },
  { type: "alert", title: "Disk space critical", detail: "Mac at 278MB free — Gemma 3 deleted, freed 17GB", time: "9:00 PM", color: "#ef4444" },
  { type: "agent", title: "Social listening scan", detail: "OpenClaw in Fortune + TechCrunch. No direct Parallax mentions", time: "2:00 PM", color: "#7c3aed" },
  { type: "deploy", title: "Agent management page live", detail: "/command-center/agents — 19 agents with usage bars and config", time: "8:30 PM", color: "#22c55e" },
];

const typeIcons: Record<ActivityEvent["type"], string> = {
  deploy: "▲",
  agent: "◆",
  build: "■",
  commit: "●",
  alert: "⚠",
  milestone: "★",
};

export default function ActivityPage() {
  const [filter, setFilter] = useState<"all" | ActivityEvent["type"]>("all");

  const filtered = filter === "all" ? EVENTS : EVENTS.filter(e => e.type === filter);

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", color: "#0f172a", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "2px solid #e2e8f0", display: "flex", alignItems: "center", gap: "12px" }}>
        <Link href="/command-center" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>← BACK</Link>
        <span style={{ color: "#2563eb", fontSize: "18px" }}>●</span>
        <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.05em" }}>ACTIVITY</span>
        <span style={{ marginLeft: "auto", fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>{EVENTS.length} events</span>
      </div>

      {/* Filters */}
      <div style={{ padding: "12px 20px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {(["all", "deploy", "agent", "build", "commit", "milestone", "alert"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              border: filter === f ? "2px solid #0f172a" : "2px solid #e2e8f0",
              background: filter === f ? "#0f172a" : "white",
              color: filter === f ? "white" : "#475569",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ padding: "8px 20px 100px" }}>
        {filtered.map((event, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "14px",
              marginBottom: "16px",
              position: "relative",
            }}
          >
            {/* Timeline dot + line */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "24px" }}>
              <div style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: `${event.color}15`,
                border: `2px solid ${event.color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                color: event.color,
                fontWeight: 800,
                flexShrink: 0,
              }}>
                {typeIcons[event.type]}
              </div>
              {i < filtered.length - 1 && (
                <div style={{ width: "2px", flex: 1, background: "#e2e8f0", marginTop: "4px" }} />
              )}
            </div>

            {/* Content */}
            <div style={{
              background: "white",
              borderRadius: "10px",
              border: "2px solid #e2e8f0",
              padding: "12px 16px",
              flex: 1,
              borderLeft: `4px solid ${event.color}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>{event.title}</span>
                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>{event.time}</span>
              </div>
              <p style={{ fontSize: "13px", color: "#475569", fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{event.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
