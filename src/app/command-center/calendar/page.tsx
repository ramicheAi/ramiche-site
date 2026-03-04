"use client";

import { useState } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   CALENDAR — Cron Schedule Visualization
   Monthly/weekly view of all scheduled agent tasks
   ══════════════════════════════════════════════════════════════════════════════ */

interface CronEvent {
  id: string;
  time: string;
  label: string;
  agent: string;
  accent: string;
  frequency: string;
  days?: string[];
}

const CRON_EVENTS: CronEvent[] = [
  { id: "1", time: "01:00", label: "YOLO Overnight Builder", agent: "NOVA", accent: "#a78bfa", frequency: "Daily" },
  { id: "2", time: "02:30", label: "Night Shift", agent: "TRIAGE", accent: "#60a5fa", frequency: "Daily" },
  { id: "3", time: "03:00", label: "Memory Maintenance", agent: "Atlas", accent: "#34d399", frequency: "Sun", days: ["Sun"] },
  { id: "4", time: "03:00", label: "Agent Self-Update (ClawHub)", agent: "Squad", accent: "#fbbf24", frequency: "Sun", days: ["Sun"] },
  { id: "5", time: "06:30", label: "AI Digest", agent: "SIMONS", accent: "#f472b6", frequency: "Daily" },
  { id: "6", time: "07:00", label: "Scripture", agent: "PROPHETS", accent: "#fbbf24", frequency: "Daily" },
  { id: "7", time: "07:00", label: "Competitor Watch", agent: "DR STRANGE", accent: "#f87171", frequency: "Mon", days: ["Mon"] },
  { id: "8", time: "07:15", label: "Morning Brief", agent: "Atlas", accent: "#34d399", frequency: "Daily" },
  { id: "9", time: "08:00", label: "Intel Scan Wave 1", agent: "Squad", accent: "#818cf8", frequency: "Daily" },
  { id: "10", time: "08:15", label: "Intel Scan Wave 2", agent: "Squad", accent: "#818cf8", frequency: "Daily" },
  { id: "11", time: "08:30", label: "Intel Scan Wave 3", agent: "Squad", accent: "#818cf8", frequency: "Daily" },
  { id: "12", time: "08:45", label: "Intel Scan Wave 4", agent: "Squad", accent: "#818cf8", frequency: "Daily" },
  { id: "13", time: "09:00", label: "Intel Scan Wave 5", agent: "Squad", accent: "#818cf8", frequency: "Daily" },
  { id: "14", time: "13:00", label: "Midday Check-in", agent: "Atlas", accent: "#34d399", frequency: "Daily" },
  { id: "15", time: "14:00", label: "Social Listening", agent: "ECHO", accent: "#fb923c", frequency: "Daily" },
  { id: "16", time: "18:00", label: "Weekly Strategy", agent: "Atlas", accent: "#34d399", frequency: "Fri", days: ["Fri"] },
  { id: "17", time: "22:00", label: "EOD Report", agent: "Atlas", accent: "#34d399", frequency: "Daily" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getEventsForDay(day: string): CronEvent[] {
  return CRON_EVENTS.filter((e) => {
    if (e.frequency === "Daily") return true;
    if (e.days && e.days.includes(day)) return true;
    return false;
  });
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

export default function CalendarPage() {
  const [view, setView] = useState<"week" | "list">("week");
  const today = new Date();
  const todayDay = DAYS[(today.getDay() + 6) % 7]; // Mon=0

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <ParticleField />

      {/* Header */}
      <div className="relative z-10 px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/command-center"
            className="text-white/50 hover:text-white transition text-sm"
          >
            &larr; Command Center
          </Link>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-purple-400">CRON</span> CALENDAR
            </h1>
            <p className="text-white/40 text-sm mt-1">
              {CRON_EVENTS.length} scheduled events &middot; {today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
            {(["week", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                  view === v
                    ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {v === "week" ? "Week" : "List"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 pb-12">
        {view === "week" ? (
          <WeekView todayDay={todayDay} />
        ) : (
          <ListView />
        )}
      </div>
    </div>
  );
}

/* ── WEEK VIEW ──────────────────────────────────────────── */
function WeekView({ todayDay }: { todayDay: string }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Day headers */}
        <div className="grid grid-cols-8 gap-px mb-1">
          <div className="p-2 text-xs text-white/30 font-mono">TIME</div>
          {DAYS.map((d) => (
            <div
              key={d}
              className={`p-2 text-center text-xs font-bold rounded-t-lg ${
                d === todayDay
                  ? "bg-purple-500/20 text-purple-300 border-b-2 border-purple-500"
                  : "text-white/50 bg-white/5"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Time grid */}
        {HOURS.filter((h) => {
          // Only show hours that have events (compact)
          return CRON_EVENTS.some((e) => parseInt(e.time.split(":")[0]) === h);
        }).map((hour) => (
          <div key={hour} className="grid grid-cols-8 gap-px">
            <div className="p-2 text-xs text-white/30 font-mono border-t border-white/5">
              {formatHour(hour)}
            </div>
            {DAYS.map((day) => {
              const events = getEventsForDay(day).filter(
                (e) => parseInt(e.time.split(":")[0]) === hour
              );
              return (
                <div
                  key={day}
                  className={`p-1 border-t border-white/5 min-h-[48px] ${
                    day === todayDay ? "bg-purple-500/5" : ""
                  }`}
                >
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="mb-1 px-2 py-1 rounded text-xs border cursor-default hover:scale-[1.02] transition-transform"
                      style={{
                        backgroundColor: `${ev.accent}15`,
                        borderColor: `${ev.accent}40`,
                        color: ev.accent,
                      }}
                    >
                      <div className="font-semibold truncate">{ev.label}</div>
                      <div className="opacity-60 text-[10px]">{ev.agent} &middot; {ev.time}</div>
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
function ListView() {
  const sorted = [...CRON_EVENTS].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-2 max-w-2xl">
      {sorted.map((ev) => (
        <div
          key={ev.id}
          className="flex items-center gap-4 p-3 rounded-xl border bg-white/[0.02] hover:bg-white/[0.05] transition"
          style={{ borderColor: `${ev.accent}30` }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold font-mono shrink-0"
            style={{ backgroundColor: `${ev.accent}20`, color: ev.accent }}
          >
            {ev.time}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{ev.label}</div>
            <div className="text-xs text-white/40">
              {ev.agent} &middot; {ev.frequency}
            </div>
          </div>
          <div
            className="text-xs px-2 py-0.5 rounded-full border shrink-0"
            style={{
              borderColor: `${ev.accent}40`,
              color: ev.accent,
              backgroundColor: `${ev.accent}10`,
            }}
          >
            {ev.frequency}
          </div>
        </div>
      ))}
    </div>
  );
}
