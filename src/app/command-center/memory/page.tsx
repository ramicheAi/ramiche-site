"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   JOURNAL LOG v4 — Color-Coded, Engaging, Organized
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

const AGENT_META: Record<string, { color: string; bg: string; emoji: string }> = {
  Atlas:       { color: "#F59E0B", bg: "#F59E0B18", emoji: "🧭" },
  SHURI:       { color: "#34D399", bg: "#34D39918", emoji: "⚡" },
  NOVA:        { color: "#A78BFA", bg: "#A78BFA18", emoji: "🌌" },
  INK:         { color: "#F472B6", bg: "#F472B618", emoji: "✍️" },
  MERCURY:     { color: "#22D3EE", bg: "#22D3EE18", emoji: "💰" },
  TRIAGE:      { color: "#60A5FA", bg: "#60A5FA18", emoji: "🔧" },
  AETHERION:   { color: "#818CF8", bg: "#818CF818", emoji: "🎨" },
  PROPHETS:    { color: "#FBBF24", bg: "#FBBF2418", emoji: "📜" },
  "DR STRANGE":{ color: "#F87171", bg: "#F8717118", emoji: "🔮" },
  SIMONS:      { color: "#FB923C", bg: "#FB923C18", emoji: "📊" },
  VEE:         { color: "#E879F9", bg: "#E879F918", emoji: "📣" },
  ECHO:        { color: "#2DD4BF", bg: "#2DD4BF18", emoji: "🔄" },
  HAVEN:       { color: "#94A3B8", bg: "#94A3B818", emoji: "🏠" },
  WIDOW:       { color: "#EF4444", bg: "#EF444418", emoji: "🕷️" },
  MICHAEL:     { color: "#4ADE80", bg: "#4ADE8018", emoji: "🏊" },
  SELAH:       { color: "#C084FC", bg: "#C084FC18", emoji: "🧠" },
  KIYOSAKI:    { color: "#FBBF24", bg: "#FBBF2418", emoji: "🏦" },
  TheMAESTRO:  { color: "#F59E0B", bg: "#F59E0B18", emoji: "🎵" },
  THEMIS:      { color: "#A3E635", bg: "#A3E63518", emoji: "⚖️" },
  PROXIMON:    { color: "#38BDF8", bg: "#38BDF818", emoji: "🏗️" },
};

function agentMeta(name?: string) {
  return AGENT_META[name || ""] || { color: "#6B7280", bg: "#6B728018", emoji: "●" };
}

/* ── Category detection for color-coding entries ──────────────────────────── */
function entryCategory(title: string): { label: string; color: string; bg: string } {
  const t = title.toLowerCase();
  if (t.includes("deploy") || t.includes("push") || t.includes("commit"))
    return { label: "DEPLOY", color: "#4ADE80", bg: "#4ADE8015" };
  if (t.includes("bug") || t.includes("fix") || t.includes("error") || t.includes("fail"))
    return { label: "FIX", color: "#F87171", bg: "#F8717115" };
  if (t.includes("build") || t.includes("refactor") || t.includes("rewrite"))
    return { label: "BUILD", color: "#60A5FA", bg: "#60A5FA15" };
  if (t.includes("rule") || t.includes("directive") || t.includes("log") || t.includes("journal"))
    return { label: "RULE", color: "#FBBF24", bg: "#FBBF2415" };
  if (t.includes("ui") || t.includes("design") || t.includes("style") || t.includes("visual"))
    return { label: "UI", color: "#E879F9", bg: "#E879F915" };
  if (t.includes("tunnel") || t.includes("infra") || t.includes("server") || t.includes("launch"))
    return { label: "INFRA", color: "#38BDF8", bg: "#38BDF815" };
  if (t.includes("spawn") || t.includes("agent") || t.includes("delegate"))
    return { label: "AGENT", color: "#A78BFA", bg: "#A78BFA15" };
  if (t.includes("schedule") || t.includes("meet") || t.includes("roster"))
    return { label: "METTLE", color: "#C9A84C", bg: "#C9A84C15" };
  return { label: "LOG", color: "#6B7280", bg: "#6B728015" };
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

  /* ── Derived ─────────────────────────────────────────────────────────────── */

  const agents = useMemo(() => {
    const set = new Set<string>();
    memoryLogs.forEach((d) =>
      d.entries.forEach((e) => { if (e.agent) set.add(e.agent); })
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
          const matchAgent = selectedAgent === "all" || e.agent === selectedAgent;
          return matchSearch && matchAgent;
        }),
      }))
      .filter((day) => day.entries.length > 0);
  }, [search, selectedAgent, memoryLogs]);

  const totalEntries = memoryLogs.reduce((s, d) => s + d.entries.length, 0);

  /* ── Actions ─────────────────────────────────────────────────────────────── */

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const toggleEntry = (key: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpandedDays(new Set(filtered.map((d) => d.date)));
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

  /* ── Render ──────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#060609] text-white">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#060609]/95 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/command-center"
                className="text-[10px] text-white/30 hover:text-white/60 tracking-[0.2em] transition-colors uppercase"
              >
                ← Command Center
              </Link>
              <h1 className="text-xl font-bold tracking-tight mt-1 flex items-center gap-2">
                <span className="text-amber-400">JOURNAL</span>
                {!loading && (
                  <span className="text-[11px] font-normal text-white/25 ml-1">
                    {totalEntries} entries across {memoryLogs.length} days
                  </span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {lastSync && (
                <span className="text-[9px] text-emerald-500/60 font-mono mr-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE {lastSync}
                </span>
              )}
              <ViewToggle active={viewMode === "timeline"} onClick={() => setViewMode("timeline")}>
                TIMELINE
              </ViewToggle>
              <ViewToggle active={viewMode === "agent"} onClick={() => setViewMode("agent")}>
                BY AGENT
              </ViewToggle>
              <span className="w-px h-5 bg-white/10 mx-1" />
              <MiniBtn onClick={expandAll}>↕ ALL</MiniBtn>
              <MiniBtn onClick={collapseAll}>— NONE</MiniBtn>
            </div>
          </div>

          {/* Search + Agent filter */}
          <div className="flex gap-2 mt-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries, agents, topics..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.06] transition-all"
              />
            </div>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/60 focus:outline-none focus:border-amber-500/40 transition-colors min-w-[120px]"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a} value={a}>
                  {agentMeta(a).emoji} {a}
                </option>
              ))}
            </select>
          </div>

          {/* Agent chips — quick filter */}
          {agents.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <AgentChip
                name="All"
                color="#F59E0B"
                active={selectedAgent === "all"}
                onClick={() => setSelectedAgent("all")}
                count={totalEntries}
              />
              {agents.map((a) => {
                const meta = agentMeta(a);
                const count = memoryLogs.reduce(
                  (s, d) => s + d.entries.filter((e) => e.agent === a).length, 0
                );
                return (
                  <AgentChip
                    key={a}
                    name={a}
                    color={meta.color}
                    emoji={meta.emoji}
                    active={selectedAgent === a}
                    onClick={() => setSelectedAgent(selectedAgent === a ? "all" : a)}
                    count={count}
                  />
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* ─── Day list ──────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-white/20 text-sm">
            No entries found.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((day, dayIdx) => {
              const open = expandedDays.has(day.date);
              const isToday = dayIdx === 0;
              const agentCounts: Record<string, number> = {};
              day.entries.forEach((e) => {
                const k = e.agent || "Unknown";
                agentCounts[k] = (agentCounts[k] || 0) + 1;
              });

              return (
                <section key={day.date} className={`rounded-xl border transition-all ${
                  open
                    ? isToday
                      ? "border-amber-500/20 bg-amber-500/[0.02]"
                      : "border-white/[0.08] bg-white/[0.015]"
                    : "border-white/[0.04] hover:border-white/[0.08]"
                }`}>
                  {/* Day header */}
                  <button
                    onClick={() => toggleDay(day.date)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left group"
                  >
                    {/* Chevron */}
                    <svg
                      className={`w-4 h-4 text-white/20 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>

                    {/* Date */}
                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="text-[9px] font-bold tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                          TODAY
                        </span>
                      )}
                      <span className={`text-sm font-semibold ${isToday ? "text-amber-400" : "text-white/80"}`}>
                        {day.date}
                      </span>
                      <span className="text-xs text-white/30 font-medium">{day.day}</span>
                    </div>

                    {/* Agent dots + count */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      {Object.entries(agentCounts)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 8)
                        .map(([agent]) => (
                          <span
                            key={agent}
                            className="w-2 h-2 rounded-full ring-1 ring-black/40 transition-transform group-hover:scale-125"
                            style={{ backgroundColor: agentMeta(agent).color }}
                            title={`${agent}: ${agentCounts[agent]} entries`}
                          />
                        ))}
                      <span className="text-[11px] font-mono text-white/25 ml-1.5 tabular-nums">
                        {day.entries.length}
                      </span>
                    </div>
                  </button>

                  {/* Entries (collapsible) */}
                  {open && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="border-t border-white/[0.06] pt-3">
                        {viewMode === "agent" ? (
                          <div className="space-y-5">
                            {groupByAgent(day.entries).map(([agent, entries]) => {
                              const meta = agentMeta(agent);
                              return (
                                <div key={agent}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm">{meta.emoji}</span>
                                    <span
                                      className="text-[11px] font-bold tracking-wider"
                                      style={{ color: meta.color }}
                                    >
                                      {agent}
                                    </span>
                                    <span className="text-[10px] text-white/20 font-mono">
                                      {entries.length} entries
                                    </span>
                                    <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${meta.color}20, transparent)` }} />
                                  </div>
                                  <div className="space-y-1 ml-6">
                                    {entries.map((entry, i) => {
                                      const k = `${day.date}-${agent}-${i}`;
                                      return (
                                        <EntryCard
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
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {day.entries.map((entry, i) => {
                              const k = `${day.date}-${i}`;
                              return (
                                <EntryCard
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

function ViewToggle({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[9px] tracking-[0.12em] font-semibold px-3 py-1 rounded-md transition-all ${
        active
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
          : "text-white/25 hover:text-white/50 border border-transparent hover:border-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[9px] tracking-[0.08em] text-white/25 hover:text-white/50 px-2 py-1 rounded transition-colors hover:bg-white/[0.04]"
    >
      {children}
    </button>
  );
}

function AgentChip({
  name,
  color,
  emoji,
  active,
  onClick,
  count,
}: {
  name: string;
  color: string;
  emoji?: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full transition-all ${
        active
          ? "ring-1 shadow-sm"
          : "opacity-50 hover:opacity-80"
      }`}
      style={{
        color,
        backgroundColor: active ? `${color}18` : "transparent",
        borderColor: active ? `${color}40` : "transparent",
        boxShadow: active ? `0 0 12px ${color}15, inset 0 0 0 1px ${color}40` : "none",
      }}
    >
      {emoji && <span className="text-[10px]">{emoji}</span>}
      <span>{name}</span>
      <span className="text-[9px] opacity-60 font-mono">{count}</span>
    </button>
  );
}

function EntryCard({
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
  const meta = agentMeta(entry.agent);
  const cat = entryCategory(entry.title);
  const hasContent = entry.content.length > 0;

  return (
    <div
      className={`rounded-lg transition-all ${
        hasContent ? "cursor-pointer" : ""
      } ${
        expanded
          ? "bg-white/[0.04] border border-white/[0.08]"
          : "hover:bg-white/[0.02] border border-transparent"
      }`}
      onClick={() => hasContent && onToggle(entryKey)}
    >
      <div className="flex items-center gap-2.5 px-3 py-2 min-w-0">
        {/* Time */}
        <span className="text-[10px] text-white/25 font-mono shrink-0 w-12 text-right tabular-nums">
          {entry.time}
        </span>

        {/* Category badge */}
        <span
          className="text-[8px] font-bold tracking-wider shrink-0 px-1.5 py-0.5 rounded"
          style={{ color: cat.color, backgroundColor: cat.bg }}
        >
          {cat.label}
        </span>

        {/* Agent colored line */}
        <span
          className="w-0.5 h-4 rounded-full shrink-0"
          style={{ backgroundColor: meta.color }}
        />

        {/* Title */}
        <span className="text-[12px] text-white/70 truncate flex-1 leading-tight">
          {entry.title}
        </span>

        {/* Agent badge */}
        {showAgent && entry.agent && (
          <span
            className="text-[9px] font-bold tracking-wider shrink-0 px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ color: meta.color, backgroundColor: meta.bg }}
          >
            <span className="text-[9px]">{meta.emoji}</span>
            {entry.agent}
          </span>
        )}

        {/* Expand chevron */}
        {hasContent && (
          <svg
            className={`w-3 h-3 text-white/15 transition-transform duration-200 shrink-0 ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>

      {/* Expanded content */}
      {expanded && hasContent && (
        <div
          className="mx-3 mb-3 mt-0 px-4 py-3 rounded-md text-[11px] text-white/40 leading-relaxed whitespace-pre-wrap border-l-2"
          style={{ borderColor: meta.color, backgroundColor: `${meta.color}08` }}
        >
          {entry.content}
        </div>
      )}
    </div>
  );
}
