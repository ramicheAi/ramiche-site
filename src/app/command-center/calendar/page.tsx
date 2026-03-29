"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   CALENDAR — Live Cron Schedule Visualization
   Wired to real cron data from /api/command-center/calendar
   ══════════════════════════════════════════════════════════════════════════════ */

interface CronEvent {
  id: string;
  time: string;
  label: string;
  agent: string;
  accent: string;
  frequency: string;
  days?: string[];
  enabled: boolean;
  schedule?: string;
  description?: string;
  lastRun?: string | null;
  lastResult?: string | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function getEventsForDay(events: CronEvent[], day: string): CronEvent[] {
  return events.filter((e) => {
    if (!e.enabled) return false;
    if (e.frequency === "Daily") return true;
    if (e.days && e.days.includes(day)) return true;
    return false;
  });
}

export default function CalendarPage() {
  const [view, setView] = useState<"week" | "list">("week");
  const [events, setEvents] = useState<CronEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("loading");
  const [stats, setStats] = useState({ total: 0, enabled: 0, disabled: 0 });
  const today = new Date();
  const todayDay = DAYS[(today.getDay() + 6) % 7];

  const fetchCrons = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/calendar", { cache: "no-store" });
      if (!res.ok) {
        setEvents([]);
        setSource("error");
        setStats({ total: 0, enabled: 0, disabled: 0 });
        return;
      }
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
      setSource(typeof data.source === "string" ? data.source : "empty");
      setStats({
        total: typeof data.total === "number" ? data.total : 0,
        enabled: typeof data.enabled === "number" ? data.enabled : 0,
        disabled: typeof data.disabled === "number" ? data.disabled : 0,
      });
    } catch {
      setEvents([]);
      setSource("error");
      setStats({ total: 0, enabled: 0, disabled: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCrons();
    const interval = setInterval(fetchCrons, 30_000);
    return () => clearInterval(interval);
  }, [fetchCrons]);

  const enabledEvents = events.filter(e => e.enabled);
  const disabledEvents = events.filter(e => !e.enabled);

  return (
    <div className="relative min-h-screen" style={{ background: "#000000", color: "#e5e5e5" }}>
      <ParticleField />

      <div className="relative z-10 px-6 pt-8 pb-4">
        <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, textShadow: "0 0 40px rgba(168,85,247,0.3)" }}>
              <span style={{ color: "#a855f7" }}>CRON</span> CALENDAR
            </h1>
            <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
              {loading ? "Loading cron data..." : `${stats.enabled} active · ${stats.disabled} disabled · ${stats.total} total`}
              {(source === "live" || source === "firestore") && (
                <span style={{ marginLeft: 8, color: "rgba(34,197,94,0.6)" }}>
                  ● {source === "firestore" ? "FIRESTORE" : "LIVE"}
                </span>
              )}
              {source === "empty" && <span style={{ marginLeft: 8, color: "#f59e0b" }}>No cron data found</span>}
              {source === "error" && <span style={{ marginLeft: 8, color: "#f87171" }}>Load failed</span>}
              <span style={{ marginLeft: 8 }}>{today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/command-center/settings?tab=crons"
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(201,168,76,0.85)",
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(201,168,76,0.25)",
                background: "rgba(201,168,76,0.06)",
              }}
            >
              Settings · Crons →
            </Link>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4 }}>
            {(["week", "list"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                border: view === v ? "2px solid rgba(168,85,247,0.3)" : "2px solid transparent",
                background: view === v ? "rgba(168,85,247,0.12)" : "transparent",
                color: view === v ? "#a855f7" : "rgba(255,255,255,0.35)",
                cursor: "pointer", transition: "all 0.2s"
              }}>
                {v === "week" ? "WEEK" : "LIST"}
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-6 pb-12">
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#525252" }}>Loading cron schedule...</div>
        ) : events.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F552;</div>
            <p style={{ color: "#525252", fontSize: 14 }}>No cron jobs found</p>
            <p style={{ color: "#404040", fontSize: 11, maxWidth: 440, margin: "10px auto 0", lineHeight: 1.55 }}>
              {source === "error" && "The calendar API did not return data. Check deployment logs."}
              {source === "empty" &&
                "No jobs.json on this host and no Firestore snapshot. Sync with POST /api/command-center/firestore-sync from your Mac, or set OPENCLAW_WORKSPACE."}
              {source === "live" && "jobs.json exists but the list is empty."}
            </p>
            <Link href="/command-center/settings?tab=crons" style={{ display: "inline-block", marginTop: 16, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(201,168,76,0.9)", textDecoration: "none" }}>
              Open Crons in Settings →
            </Link>
          </div>
        ) : view === "week" ? (
          <WeekView events={enabledEvents} todayDay={todayDay} />
        ) : (
          <ListView events={events} />
        )}

        {/* Disabled Crons Summary */}
        {disabledEvents.length > 0 && view === "list" && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 12, fontWeight: 800, color: "#525252", letterSpacing: "0.15em", marginBottom: 12, textTransform: "uppercase" }}>
              Disabled ({disabledEvents.length})
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {disabledEvents.map((ev) => (
                <div key={ev.id} style={{ padding: "6px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", fontSize: 10, color: "#525252", textDecoration: "line-through" }}>
                  {ev.label} ({ev.agent})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── WEEK VIEW ──────────────────────────────────────────── */
function WeekView({ events, todayDay }: { events: CronEvent[]; todayDay: string }) {
  const activeHours = HOURS.filter((h) =>
    events.some((e) => parseInt(e.time.split(":")[0]) === h)
  );

  if (activeHours.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "#525252" }}>No scheduled events this week</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 700 }}>
        <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 1, marginBottom: 2 }}>
          <div style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>TIME</div>
          {DAYS.map((d) => (
            <div key={d} style={{
              padding: 8, textAlign: "center", fontSize: 11, fontWeight: 700, borderRadius: "8px 8px 0 0",
              background: d === todayDay ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
              color: d === todayDay ? "#a855f7" : "rgba(255,255,255,0.4)",
              borderBottom: d === todayDay ? "2px solid #a855f7" : "2px solid transparent"
            }}>
              {d}
            </div>
          ))}
        </div>

        {activeHours.map((hour) => (
          <div key={hour} style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 1 }}>
            <div style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              {formatHour(hour)}
            </div>
            {DAYS.map((day) => {
              const dayEvents = getEventsForDay(events, day).filter(
                (e) => parseInt(e.time.split(":")[0]) === hour
              );
              return (
                <div key={day} style={{
                  padding: 4, borderTop: "1px solid rgba(255,255,255,0.04)", minHeight: 48,
                  background: day === todayDay ? "rgba(168,85,247,0.03)" : "transparent"
                }}>
                  {dayEvents.map((ev) => (
                    <div key={ev.id} title={ev.description || ev.label} style={{
                      marginBottom: 4, padding: "4px 8px", borderRadius: 6, fontSize: 10,
                      border: `1px solid ${ev.accent}40`, background: `${ev.accent}12`, color: ev.accent,
                      cursor: "default", transition: "transform 0.15s"
                    }}>
                      <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.label}</div>
                      <div style={{ opacity: 0.6, fontSize: 9 }}>{ev.agent} · {ev.time}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── LIST VIEW ──────────────────────────────────────────── */
function ListView({ events }: { events: CronEvent[] }) {
  const sorted = [...events].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.time.localeCompare(b.time);
  });

  return (
    <div style={{ maxWidth: 800 }}>
      {sorted.filter(e => e.enabled).map((ev) => (
        <div key={ev.id} style={{
          display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", marginBottom: 8,
          borderRadius: 12, border: `2px solid ${ev.accent}20`, background: "rgba(0,0,0,0.95)",
          transition: "all 0.2s"
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, fontFamily: "monospace", flexShrink: 0,
            background: `${ev.accent}15`, color: ev.accent, border: `1px solid ${ev.accent}30`
          }}>
            {ev.time}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.label}</div>
            <div style={{ fontSize: 11, color: "#737373", marginTop: 2 }}>
              {ev.agent} · {ev.frequency}
              {ev.schedule && <span style={{ marginLeft: 6, fontSize: 9, fontFamily: "monospace", color: "#525252" }}>[{ev.schedule}]</span>}
            </div>
            {ev.description && <div style={{ fontSize: 10, color: "#404040", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.description}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700,
              border: `1px solid ${ev.accent}30`, color: ev.accent, background: `${ev.accent}08`
            }}>
              {ev.frequency}
            </div>
            {ev.lastResult && (
              <div style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 4,
                background: ev.lastResult === "ok" || ev.lastResult === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                color: ev.lastResult === "ok" || ev.lastResult === "success" ? "#22c55e" : "#ef4444"
              }}>
                {ev.lastResult}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
