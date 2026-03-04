"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   MEMORY BROWSER — Searchable Agent Memory Logs
   Journal-style view of daily memory files with full-text search
   ══════════════════════════════════════════════════════════════════════════════ */

interface MemoryEntry {
  date: string;
  day: string;
  entries: { time: string; title: string; content: string; agent?: string }[];
}

/* Sample data — in production this would read from the workspace memory/ folder */
const MEMORY_LOGS: MemoryEntry[] = [
  {
    date: "2026-03-04", day: "Tuesday",
    entries: [
      { time: "01:00", title: "YOLO Build #32", content: "Overnight builder ran. Built Parallax Publish scheduling backend prototype. Status: partial — needs hosted DB migration.", agent: "NOVA" },
      { time: "07:15", title: "Morning Brief", content: "METTLE beta ready. Saint Andrew's onboarding pack complete. Command Center 3D Hangar deployed. Task Board + Calendar built.", agent: "Atlas" },
      { time: "11:30", title: "Command Center Build", content: "3D Hangar workspace added to /command-center/agents. Compact mobile fix deployed. THEMIS governance protocol saved.", agent: "Atlas" },
      { time: "14:00", title: "Task Board Deployed", content: "Kanban board live at /command-center/tasks. Backlog → In Progress → Review → Done. Pre-populated with current projects.", agent: "SHURI" },
      { time: "17:00", title: "Calendar Screen Built", content: "Cron schedule visualization at /command-center/calendar. 17 events mapped, color-coded by agent.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-03-03", day: "Monday",
    entries: [
      { time: "07:15", title: "Morning Brief", content: "Service worker cache issue identified and fixed. Self-destructing SW pattern deployed to ramiche-site.", agent: "Atlas" },
      { time: "10:00", title: "Service Worker Fix", content: "Banned service workers on all Parallax/METTLE apps. Replaced with self-destruct pattern + inline <head> script.", agent: "SHURI" },
      { time: "14:00", title: "Amir Mushich Arsenal", content: "50 Nano Banana Pro creative prompts cataloged for branding, products, mockups, apparel, typography.", agent: "INK" },
      { time: "16:00", title: "Repo Verification Rule", content: "HARD RULE added: verify correct repo via MEMORY.md before editing ANY product code.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-03-02", day: "Sunday",
    entries: [
      { time: "03:00", title: "Memory Maintenance", content: "Weekly MEMORY.md synthesis. Archived stale entries to memory-archive.md.", agent: "Atlas" },
      { time: "09:00", title: "YOLO Dashboard", content: "Built yolo-builds/dashboard.html — single-file dark dashboard with filtering and ambient particles.", agent: "NOVA" },
      { time: "13:00", title: "Parallax Publish Progress", content: "3 platforms LIVE: Twitter, Bluesky, LinkedIn. Instagram blocked on Facebook Developer Portal.", agent: "SHURI" },
    ],
  },
  {
    date: "2026-03-01", day: "Saturday",
    entries: [
      { time: "07:15", title: "Morning Brief", content: "Ramiche Studio client acquisition kit complete. Landing page, inquiry form, checkout, DM scripts, email sequences.", agent: "Atlas" },
      { time: "11:00", title: "Weekly Strategy", content: "Revenue priority: METTLE beta → Ramiche Studio first client → Parallax agent marketplace.", agent: "MERCURY" },
      { time: "15:00", title: "MEMORY.md Update", content: "Weekly synthesis completed. Living Experience Philosophy documented. UI/UX rules hardened.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-02-28", day: "Friday",
    entries: [
      { time: "08:00", title: "Context+ Installed", content: "MCP server for deep codebase analysis. AST parsing, semantic search, blast radius. Uses Ollama nomic-embed-text.", agent: "SHURI" },
      { time: "12:00", title: "Local AI Verdict", content: "Intel i5-8500 too slow for local LLM. Even 4B = 4.6 tok/s. All agents stay on cloud.", agent: "Atlas" },
      { time: "18:00", title: "Living Experience Philosophy", content: "Every screen = a place. Cardiac entrainment 72 BPM, biophilia, proprioception. Ambient particles mandatory.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-02-27", day: "Thursday",
    entries: [
      { time: "09:00", title: "Parallax Publish Launch", content: "Live at parallax-publish.vercel.app. Competitor to Upload-Post. Own platform, not a wrapper.", agent: "SHURI" },
      { time: "14:00", title: "Site Audit", content: "19 routes audited: 9 functional, 7 marketing-only, 2 partial, 1 fixed. Only /agents has real payment-to-delivery e2e.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-02-26", day: "Wednesday",
    entries: [
      { time: "10:00", title: "Agent Prompting Rules", content: "Hierarchical Memory + Tool Determinism implemented to prevent context collapse across agents.", agent: "Atlas" },
      { time: "15:00", title: "Galactik Antics Matrix", content: "Aetherion Phase 1: 10 architecture docs, 30+ tasks across 7 tracks. Blocked on Ramon for Shopify API + art.", agent: "AETHERION" },
    ],
  },
];

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
};

export default function MemoryBrowserPage() {
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  const agents = useMemo(() => {
    const set = new Set<string>();
    MEMORY_LOGS.forEach((d) => d.entries.forEach((e) => { if (e.agent) set.add(e.agent); }));
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return MEMORY_LOGS.map((day) => ({
      ...day,
      entries: day.entries.filter((e) => {
        const matchSearch = !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || (e.agent || "").toLowerCase().includes(q);
        const matchAgent = selectedAgent === "all" || e.agent === selectedAgent;
        return matchSearch && matchAgent;
      }),
    })).filter((day) => day.entries.length > 0);
  }, [search, selectedAgent]);

  const totalEntries = MEMORY_LOGS.reduce((s, d) => s + d.entries.length, 0);

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <ParticleField />

      {/* Header */}
      <div className="relative z-10 px-4 sm:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/command-center" className="text-xs text-white/40 hover:text-white/70 tracking-[0.2em] transition-colors">
              ← COMMAND CENTER
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">MEMORY</span>
              <span className="text-white/40 ml-2 text-lg font-light">BROWSER</span>
            </h1>
            <p className="text-white/30 text-xs tracking-[0.15em] mt-1">
              {totalEntries} ENTRIES · {MEMORY_LOGS.length} DAYS
            </p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memories..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs">
                ✕
              </button>
            )}
          </div>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-amber-500/50 transition-colors"
          >
            <option value="all">All Agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative z-10 px-4 sm:px-8 pb-12">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="text-4xl mb-3">∅</p>
            <p className="text-sm">No memories match your search</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filtered.map((day) => (
              <div key={day.date} className="relative">
                {/* Date header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-sm font-semibold tracking-[0.15em] text-amber-400/80">
                    {day.date}
                  </h2>
                  <span className="text-xs text-white/20">{day.day}</span>
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-xs text-white/20">{day.entries.length} entries</span>
                </div>

                {/* Entries */}
                <div className="ml-1 border-l border-white/5 pl-5 space-y-3">
                  {day.entries.map((entry, i) => {
                    const agentColor = AGENT_COLORS[entry.agent || ""] || "#6b7280";
                    return (
                      <div
                        key={i}
                        className="relative group bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/10 rounded-lg p-4 transition-all duration-200"
                      >
                        {/* Timeline dot */}
                        <div
                          className="absolute -left-[1.65rem] top-5 w-2.5 h-2.5 rounded-full border-2"
                          style={{ borderColor: agentColor, backgroundColor: `${agentColor}33` }}
                        />

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs text-white/30 font-mono">{entry.time}</span>
                              <h3 className="text-sm font-medium text-white/90">{entry.title}</h3>
                            </div>
                            <p className="text-xs text-white/50 leading-relaxed">{entry.content}</p>
                          </div>
                          {entry.agent && (
                            <span
                              className="shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border"
                              style={{ color: agentColor, borderColor: `${agentColor}40`, backgroundColor: `${agentColor}10` }}
                            >
                              {entry.agent}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
