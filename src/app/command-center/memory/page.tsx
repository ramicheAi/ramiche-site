"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   MEMORY BROWSER — Live Agent Memory Logs from workspace/memory/*.md
   ══════════════════════════════════════════════════════════════════════════════ */

interface MemoryEntry {
  date: string;
  day: string;
  entries: { time: string; title: string; content: string; agent?: string }[];
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
};

export default function MemoryBrowserPage() {
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [memoryLogs, setMemoryLogs] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("");

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/memory?days=14");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.days && data.days.length > 0) {
        setMemoryLogs(data.days);
      }
      setLastSync(new Date().toLocaleTimeString());
    } catch {
      /* keep existing data on error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemory();
    const interval = setInterval(fetchMemory, 30_000);
    return () => clearInterval(interval);
  }, [fetchMemory]);

  const agents = useMemo(() => {
    const set = new Set<string>();
    memoryLogs.forEach((d) => d.entries.forEach((e) => { if (e.agent) set.add(e.agent); }));
    return Array.from(set).sort();
  }, [memoryLogs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return memoryLogs.map((day) => ({
      ...day,
      entries: day.entries.filter((e) => {
        const matchSearch = !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || (e.agent || "").toLowerCase().includes(q);
        const matchAgent = selectedAgent === "all" || e.agent === selectedAgent;
        return matchSearch && matchAgent;
      }),
    })).filter((day) => day.entries.length > 0);
  }, [search, selectedAgent, memoryLogs]);

  const totalEntries = memoryLogs.reduce((s, d) => s + d.entries.length, 0);

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
              {loading ? "LOADING..." : `${totalEntries} ENTRIES · ${memoryLogs.length} DAYS`}
              {lastSync && <span className="ml-2 text-green-500/50">● LIVE · {lastSync}</span>}
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
