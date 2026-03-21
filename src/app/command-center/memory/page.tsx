"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   JOURNAL LOG v3 — Ultra-Linear Layout
   Collapsible days, per-agent grouping, clean vertical timeline
   ══════════════════════════════════════════════════════════════════════════════ */

interface JournalEntry {
  time: string;
  title: string;
  content: string;
  agent?: string;
}

interface MemoryDay {
  date: string;
  day: string;
  entries: JournalEntry[];
}

const AGENT_COLORS: Record<string, string> = {
  Atlas: "#C9A84C",
  SHURI: "#34d399",
  NOVA: "#a78bfa",
  INK: "#f472b6",
  MERCURY: "#22d3ee",
  TRIAGE: "#60a5fa",
  AETHERION: "#818cf8",
  PROPHETS: "#fbbf24",
  "DR STRANGE": "#f87171",
  SIMONS: "#fb923c",
  VEE: "#e879f9",
  ECHO: "#2dd4bf",
  HAVEN: "#94a3b8",
  WIDOW: "#ef4444",
  MICHAEL: "#4ade80",
  SELAH: "#c084fc",
  KIYOSAKI: "#fbbf24",
  TheMAESTRO: "#f59e0b",
  THEMIS: "#a3e635",
  PROXIMON: "#38bdf8",
};

function agentColor(name?: string): string {
  return AGENT_COLORS[name || ""] || "#6b7280";
}

export default function MemoryBrowserPage() {
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [memoryLogs, setMemoryLogs] = useState<MemoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"timeline" | "agent">("timeline");

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/memory?days=30");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.days && data.days.length > 0) {
        setMemoryLogs(data.days);
        if (expandedDays.size === 0 && data.days.length > 0) {
          setExpandedDays(new Set([data.days[0].date]));
        }
      }
      setLastSync(new Date().toLocaleTimeString());
    } catch {
      /* keep existing data on error */
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMemory();
    const interval = setInterval(fetchMemory, 30_000);
    return () => clearInterval(interval);
  }, [fetchMemory]);

  /* ── Derived data ──────────────────────────────────────────────────────── */

  const agents = useMemo(() => {
    const set = new Set<string>();
    memoryLogs.forEach((d) =>
      d.entries.forEach((e) => {
        if (e.agent) set.add(e.agent);
      })
    );
    return Array.from(set).sort();
  }, [memoryLogs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return memoryLogs
      .map((day) => ({
        ...day,
        entries: day.entries.filter((e) => {
          const matchSearch =
            !q ||
            e.title.toLowerCase().includes(q) ||
            e.content.toLowerCase().includes(q) ||
            (e.agent || "").toLowerCase().includes(q);
          const matchAgent =
            selectedAgent === "all" || e.agent === selectedAgent;
          return matchSearch && matchAgent;
        }),
      }))
      .filter((day) => day.entries.length > 0);
  }, [search, selectedAgent, memoryLogs]);

  const totalEntries = memoryLogs.reduce((s, d) => s + d.entries.length, 0);

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleEntry = (key: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () =>
    setExpandedDays(new Set(filtered.map((d) => d.date)));
  const collapseAll = () => setExpandedDays(new Set());

  const groupByAgent = (entries: JournalEntry[]) => {
    const groups: Record<string, JournalEntry[]> = {};
    for (const e of entries) {
      const key = e.agent || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#08080c] text-white">
      {/* ─── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#08080c]/95 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/command-center"
                className="text-[10px] text-white/30 hover:text-white/60 tracking-[0.2em] transition-colors"
              >
                ← COMMAND CENTER
              </Link>
              <h1 className="text-lg font-semibold tracking-tight mt-0.5">
                <span className="text-amber-400">JOURNAL</span>
                <span className="text-white/25 ml-1.5 text-sm font-normal">
                  {loading
                    ? "..."
                    : `${totalEntries} entries · ${memoryLogs.length} days`}
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-1.5">
              {lastSync && (
                <span className="text-[9px] text-green-500/40 mr-2">
                  ● {lastSync}
                </span>
              )}
              <Pill
                active={viewMode === "timeline"}
                onClick={() => setViewMode("timeline")}
              >
                TIMELINE
              </Pill>
              <Pill
                active={viewMode === "agent"}
                onClick={() => setViewMode("agent")}
              >
                BY AGENT
              </Pill>
              <span className="w-px h-4 bg-white/10 mx-1" />
              <Pill onClick={expandAll}>ALL</Pill>
              <Pill onClick={collapseAll}>NONE</Pill>
            </div>
          </div>

          {/* Search + agent filter */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/60 focus:outline-none focus:border-amber-500/40 transition-colors"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* ─── Day list ────────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-white/20 text-sm">
            No entries found.
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((day) => {
              const open = expandedDays.has(day.date);
              const agentCounts: Record<string, number> = {};
              day.entries.forEach((e) => {
                const k = e.agent || "Unknown";
                agentCounts[k] = (agentCounts[k] || 0) + 1;
              });

              return (
                <section key={day.date}>
                  {/* Day header */}
                  <button
                    onClick={() => toggleDay(day.date)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-white/[0.03] transition-colors text-left group"
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-white/20 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>

                    <span className="text-sm font-medium text-white/80">
                      {day.date}
                    </span>
                    <span className="text-xs text-white/25">{day.day}</span>

                    {/* Agent dots */}
                    <div className="flex items-center gap-1 ml-auto">
                      {Object.entries(agentCounts)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 6)
                        .map(([agent, count]) => (
                          <span
                            key={agent}
                            className="flex items-center gap-0.5 text-[9px] tracking-wide opacity-50 group-hover:opacity-80 transition-opacity"
                            style={{ color: agentColor(agent) }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ backgroundColor: agentColor(agent) }}
                            />
                            {count}
                          </span>
                        ))}
                      <span className="text-[10px] text-white/15 ml-1">
                        {day.entries.length}
                      </span>
                    </div>
                  </button>

                  {/* Entries (collapsible) */}
                  {open && (
                    <div className="ml-5 pl-4 border-l border-white/[0.06] pb-3 pt-1">
                      {viewMode === "agent" ? (
                        /* ── Agent-grouped view ─────────────────── */
                        <div className="space-y-4">
                          {groupByAgent(day.entries).map(
                            ([agent, entries]) => (
                              <div key={agent}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      backgroundColor: agentColor(agent),
                                    }}
                                  />
                                  <span
                                    className="text-[10px] font-semibold tracking-wider"
                                    style={{ color: agentColor(agent) }}
                                  >
                                    {agent}
                                  </span>
                                  <span className="text-[10px] text-white/15">
                                    {entries.length}
                                  </span>
                                  <div className="flex-1 h-px bg-white/[0.04]" />
                                </div>
                                <div className="space-y-0.5 ml-4">
                                  {entries.map((entry, i) => {
                                    const k = `${day.date}-${agent}-${i}`;
                                    return (
                                      <EntryRow
                                        key={k}
                                        entry={entry}
                                        entryKey={k}
                                        expanded={expandedEntries.has(k)}
                                        onToggle={toggleEntry}
                                        showAgent={false}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        /* ── Timeline view ──────────────────────── */
                        <div className="space-y-0.5">
                          {day.entries.map((entry, i) => {
                            const k = `${day.date}-${i}`;
                            return (
                              <EntryRow
                                key={k}
                                entry={entry}
                                entryKey={k}
                                expanded={expandedEntries.has(k)}
                                onToggle={toggleEntry}
                                showAgent
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════════ */

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[9px] tracking-[0.1em] px-2 py-0.5 rounded transition-colors ${
        active
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          : "text-white/25 hover:text-white/50 border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

function EntryRow({
  entry,
  entryKey,
  expanded,
  onToggle,
  showAgent,
}: {
  entry: JournalEntry;
  entryKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  showAgent: boolean;
}) {
  const color = agentColor(entry.agent);
  const hasContent = entry.content.length > 0;

  return (
    <div
      className={`rounded px-2.5 py-1.5 transition-colors ${hasContent ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
      onClick={() => hasContent && onToggle(entryKey)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Time */}
        <span className="text-[10px] text-white/20 font-mono shrink-0 w-11 text-right">
          {entry.time}
        </span>

        {/* Agent dot */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Title */}
        <span className="text-xs text-white/70 truncate flex-1">
          {entry.title}
        </span>

        {/* Agent badge (timeline mode) */}
        {showAgent && entry.agent && (
          <span
            className="text-[8px] tracking-wider font-semibold shrink-0 px-1.5 py-px rounded"
            style={{
              color,
              backgroundColor: `${color}10`,
            }}
          >
            {entry.agent}
          </span>
        )}

        {/* Expand indicator */}
        {hasContent && (
          <svg
            className={`w-3 h-3 text-white/15 transition-transform duration-150 shrink-0 ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </div>

      {/* Expanded content */}
      {expanded && hasContent && (
        <div className="ml-[3.6rem] mt-1.5 mb-1 text-[11px] text-white/35 leading-relaxed whitespace-pre-wrap border-l-2 pl-3" style={{ borderColor: `${color}20` }}>
          {entry.content}
        </div>
      )}
    </div>
  );
}
