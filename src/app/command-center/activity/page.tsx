"use client";

import { useState, useEffect } from "react";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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
  deploy: "var(--c-green)",
  build: "var(--c-sky)",
  agent: "var(--c-purple)",
  commit: "var(--c-cyan)",
  alert: "var(--c-red)",
  milestone: "var(--c-amber)",
};

const FALLBACK_EVENTS: ActivityEvent[] = [
  { type: "deploy", title: "Command Center deployed", detail: "Visual fixes — thicker borders, brighter text, bolder fonts", time: "11:39 AM", color: "var(--c-green)" },
  { type: "build", title: "METTLE landing page fixed", detail: "Missing packages installed: @vercel/analytics, speed-insights, nodemailer", time: "10:30 AM", color: "var(--c-sky)" },
  { type: "agent", title: "Agent routing verified", detail: "17 execution agents wired to local Qwen 3.5 — 7 stay on cloud", time: "7:02 AM", color: "var(--c-purple)" },
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
    <InstrumentPage
      id="activity"
      title="Activity"
      section="Operations"
      icon="nerve"
      accent="var(--c-purple)"
      actions={
        <span style={{ fontSize: 12, color: "var(--t-mid)", fontWeight: 600 }} className="mono">
          {loading ? "…" : `${filtered.length} events`}
          {sourceLabel && (
            <span style={{ marginLeft: 10, opacity: 0.85 }}>
              · {sourceLabel}
              {usedFallback ? " (fallback)" : ""}
            </span>
          )}
        </span>
      }
    >
      {/* Filters */}
      <div style={{ padding: "0 0 16px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {(["all", "deploy", "agent", "build", "commit", "milestone", "alert"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 12px",
              borderRadius: "var(--r-sm)",
              border: filter === f ? "2px solid var(--accent)" : "2px solid var(--line)",
              background: filter === f ? "var(--accent)" : "transparent",
              color: filter === f ? "var(--ink-0)" : "var(--t-mid)",
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
      <Panel title="Event Stream" icon="nerve">
        {loading && events.length === 0 && (
          <p style={{ fontSize: "13px", color: "var(--t-mid)", fontWeight: 600 }}>Loading activity…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p style={{ fontSize: "13px", color: "var(--t-mid)" }}>No events match this filter.</p>
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
                background: `color-mix(in srgb, ${event.color} 15%, transparent)`,
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
                <div style={{ width: "2px", flex: 1, background: "var(--line)", marginTop: "4px" }} />
              )}
            </div>

            {/* Content */}
            <div style={{
              background: "var(--ink-2)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              padding: "12px 16px",
              flex: 1,
              borderLeft: `4px solid ${event.color}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--t-hi)" }}>{event.title}</span>
                <span style={{ fontSize: "11px", color: "var(--t-mid)", fontWeight: 600 }} className="mono">{event.time}</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--t-mid)", fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{event.detail}</p>
            </div>
          </div>
        ))}
      </Panel>
    </InstrumentPage>
  );
}
