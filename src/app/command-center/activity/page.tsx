"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   ACTIVITY — Event Feed & History
   Live: GET /api/command-center/activity (git log + memory). Poll every 30s.
   ══════════════════════════════════════════════════════════════════════════════ */

interface ActivityEvent {
  type: "deploy" | "agent" | "build" | "commit" | "alert" | "milestone";
  title: string;
  detail: string;
  time: string;
  color: string;
}

const TYPE_COLORS: Record<ActivityEvent["type"], string> = {
  deploy: "#22c55e",
  build: "#2563eb",
  agent: "#7c3aed",
  commit: "#0891b2",
  alert: "#ef4444",
  milestone: "#d97706",
};

const FALLBACK_EVENTS: ActivityEvent[] = [
  { type: "deploy", title: "Command Center deployed", detail: "Visual fixes — thicker borders, brighter text, bolder fonts", time: "11:39 AM", color: "#22c55e" },
  { type: "build", title: "METTLE landing page fixed", detail: "Missing packages installed: @vercel/analytics, speed-insights, nodemailer", time: "10:30 AM", color: "#2563eb" },
  { type: "agent", title: "Agent routing verified", detail: "17 execution agents wired to local Qwen 3.5 — 7 stay on cloud", time: "7:02 AM", color: "#7c3aed" },
];

interface ApiEvent {
  hash: string;
  date: string;
  author: string;
  message: string;
  type: string;
}

function coerceType(t: string): ActivityEvent["type"] {
  const x = t.toLowerCase();
  if (x === "deploy" || x === "agent" || x === "build" || x === "commit" || x === "alert" || x === "milestone") {
    return x;
  }
  return "commit";
}

function mapApiEvent(e: ApiEvent): ActivityEvent {
  const type = coerceType(e.type);
  const time = (() => {
    try {
      return new Date(e.date).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return e.date;
    }
  })();
  return {
    type,
    title: e.message || "(no message)",
    detail: `${e.author} · ${e.hash}`,
    time,
    color: TYPE_COLORS[type],
  };
}

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
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch("/api/command-center/activity?limit=80", { cache: "no-store" });
        const data = (await r.json()) as { events?: ApiEvent[]; source?: string };
        const raw = Array.isArray(data.events) ? data.events : [];
        if (cancelled) return;
        if (raw.length > 0) {
          setEvents(raw.map(mapApiEvent));
          setSource(data.source ?? "api");
          setUsedFallback(false);
        } else {
          setEvents(FALLBACK_EVENTS);
          setSource("empty");
          setUsedFallback(true);
        }
      } catch {
        if (!cancelled) {
          setEvents(FALLBACK_EVENTS);
          setSource("error");
          setUsedFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const filtered = filter === "all" ? events : events.filter(e => e.type === filter);

  const sourceLabel =
    source === "git-log"
      ? "Git + memory"
      : source === "static"
        ? "Embedded snapshot"
        : source === "empty"
          ? "No events"
          : source === "error"
            ? "Offline"
            : source === "api"
              ? "Live"
              : source;

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", color: "#0f172a", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "2px solid #e2e8f0", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <Link href="/command-center" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>← BACK</Link>
        <span style={{ color: "#2563eb", fontSize: "18px" }}>●</span>
        <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.05em" }}>ACTIVITY</span>
        <span style={{ marginLeft: "auto", fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
          {loading ? "…" : `${filtered.length} events`}
          {sourceLabel && (
            <span style={{ marginLeft: 10, opacity: 0.85 }}>
              · {sourceLabel}
              {usedFallback ? " (fallback)" : ""}
            </span>
          )}
        </span>
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
        {loading && events.length === 0 && (
          <p style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600 }}>Loading activity…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p style={{ fontSize: "13px", color: "#64748b" }}>No events match this filter.</p>
        )}
        {filtered.map((event, i) => (
          <div
            key={`${event.time}-${event.title}-${i}`}
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
