"use client";

import React, { useState, useMemo, useCallback } from "react";
import type { Athlete } from "../types";

// ── Types ────────────────────────────────────────────────────

interface RelayConfig {
  legs: number;
  dist: number;
  strokes: string[];
}

const RELAY_EVENTS: Record<string, RelayConfig> = {
  "200 Free Relay":   { legs: 4, dist: 50,  strokes: ["Free", "Free", "Free", "Free"] },
  "200 Medley Relay": { legs: 4, dist: 50,  strokes: ["Back", "Breast", "Fly", "Free"] },
  "400 Free Relay":   { legs: 4, dist: 100, strokes: ["Free", "Free", "Free", "Free"] },
  "400 Medley Relay": { legs: 4, dist: 100, strokes: ["Back", "Breast", "Fly", "Free"] },
  "800 Free Relay":   { legs: 4, dist: 200, strokes: ["Free", "Free", "Free", "Free"] },
};

type Strategy = "fastest" | "backload" | "frontload" | "even";

interface Props {
  eventName: string;
  roster: Athlete[];
  course: "SCY" | "SCM" | "LCM";
  onAssign?: (slots: (Athlete | null)[]) => void;
}

// ── Helpers ──────────────────────────────────────────────────

function parseTimeToSeconds(t: string): number | null {
  if (!t) return null;
  const clean = t.replace(/[^0-9.:]/g, "");
  const parts = clean.split(/[:.]/);
  if (parts.length === 3) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]) + parseFloat(parts[2]) / 100;
  if (parts.length === 2) return parseFloat(parts[0]) + parseFloat(parts[1]) / 100;
  return null;
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
  return secs.toFixed(2);
}

function getBestTimeForStroke(athlete: Athlete, stroke: string, dist: number): number | null {
  if (!athlete.bestTimes) return null;
  // Map stroke names to bestTimes keys (e.g. "100 Free" → "100_Free")
  const strokeMap: Record<string, string[]> = {
    Free: ["Free", "Freestyle", "FR"],
    Back: ["Back", "Backstroke", "BK"],
    Breast: ["Breast", "Breaststroke", "BR"],
    Fly: ["Fly", "Butterfly", "FL"],
  };
  const aliases = strokeMap[stroke] || [stroke];
  for (const alias of aliases) {
    const key = `${dist} ${alias}`;
    if (athlete.bestTimes[key]) {
      const s = parseTimeToSeconds(athlete.bestTimes[key].time);
      if (s && s > 0) return s;
    }
    // Try underscore format
    const key2 = `${dist}_${alias}`;
    if (athlete.bestTimes[key2]) {
      const s = parseTimeToSeconds(athlete.bestTimes[key2].time);
      if (s && s > 0) return s;
    }
  }
  return null;
}

// ── Component ────────────────────────────────────────────────

export default function RelayLineupBuilder({ eventName, roster, course: _course, onAssign }: Props) {
  const config = RELAY_EVENTS[eventName];
  const [slots, setSlots] = useState<(Athlete | null)[]>([null, null, null, null]);
  const [strategy, setStrategy] = useState<Strategy>("fastest");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"M" | "F" | "X">("X");

  const selectedIds = useMemo(() => new Set(slots.filter(Boolean).map(s => s!.id)), [slots]);

  const filteredRoster = useMemo(() => {
    if (!config) return [];
    return roster
      .filter(a => {
        if (genderFilter !== "X" && a.gender !== genderFilter) return false;
        if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (selectedIds.has(a.id)) return false;
        return true;
      })
      .sort((a, b) => {
        const tA = getBestTimeForStroke(a, config.strokes[0], config.dist) ?? 9999;
        const tB = getBestTimeForStroke(b, config.strokes[0], config.dist) ?? 9999;
        return tA - tB;
      });
  }, [roster, config, genderFilter, search, selectedIds]);

  const addToSlot = useCallback((athlete: Athlete) => {
    setSlots(prev => {
      const idx = prev.indexOf(null);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = athlete;
      onAssign?.(next);
      return next;
    });
  }, [onAssign]);

  const removeFromSlot = useCallback((idx: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[idx] = null;
      onAssign?.(next);
      return next;
    });
  }, [onAssign]);

  const clearAll = useCallback(() => {
    const empty = [null, null, null, null] as (Athlete | null)[];
    setSlots(empty);
    onAssign?.(empty);
  }, [onAssign]);

  const autoOptimize = useCallback(() => {
    if (!config) return;
    const pool = roster.filter(a => genderFilter === "X" || a.gender === genderFilter);

    if (config.strokes.every(s => s === "Free")) {
      // Free relay: pick 4 fastest
      const sorted = [...pool].sort((a, b) => {
        const tA = getBestTimeForStroke(a, "Free", config.dist) ?? 9999;
        const tB = getBestTimeForStroke(b, "Free", config.dist) ?? 9999;
        return tA - tB;
      });
      let top4 = sorted.slice(0, 4);

      if (strategy === "backload") {
        top4 = [...top4].reverse();
      } else if (strategy === "even") {
        top4 = [top4[0], top4[2], top4[3], top4[1]];
      }
      // "fastest" and "frontload" keep natural order (fastest first)

      const next = [...top4, null, null, null, null].slice(0, 4) as (Athlete | null)[];
      setSlots(next);
      onAssign?.(next);
    } else {
      // Medley: best swimmer per stroke
      const used = new Set<string>();
      const result: (Athlete | null)[] = [null, null, null, null];
      const scores: { leg: number; athlete: Athlete; time: number }[] = [];

      for (let leg = 0; leg < 4; leg++) {
        for (const a of pool) {
          const t = getBestTimeForStroke(a, config.strokes[leg], config.dist);
          if (t) scores.push({ leg, athlete: a, time: t });
        }
      }
      scores.sort((a, b) => a.time - b.time);

      for (const entry of scores) {
        if (result[entry.leg] !== null) continue;
        if (used.has(entry.athlete.id)) continue;
        result[entry.leg] = entry.athlete;
        used.add(entry.athlete.id);
        if (result.every(s => s)) break;
      }
      setSlots(result);
      onAssign?.(result);
    }
  }, [config, roster, genderFilter, strategy, onAssign]);

  // ── Projected time ─────────────────────────────────────────
  const legTimes = useMemo(() => {
    if (!config) return [];
    return slots.map((s, i) => {
      if (!s) return 0;
      return getBestTimeForStroke(s, config.strokes[i], config.dist) ?? 0;
    });
  }, [slots, config]);

  const totalTime = useMemo(() => legTimes.reduce((a, b) => a + b, 0), [legTimes]);
  const filledCount = slots.filter(Boolean).length;
  const maxLegTime = Math.max(...legTimes.filter(t => t > 0), 1);

  // ── Coaching insight ───────────────────────────────────────
  const insight = useMemo(() => {
    const times = legTimes.filter(t => t > 0);
    if (times.length < 4) return "Fill all 4 legs for full analysis.";

    const avg = totalTime / 4;
    const fastest = Math.min(...times);
    const slowest = Math.max(...times);
    const spread = slowest - fastest;
    const firstHalf = times[0] + times[1];
    const secondHalf = times[2] + times[3];
    const diff = secondHalf - firstHalf;

    let msg = "";
    if (spread < avg * 0.04) {
      msg = `Excellent balance — only ${spread.toFixed(2)}s spread. No single leg is a liability. `;
    } else if (spread > avg * 0.12) {
      msg = `Wide spread of ${spread.toFixed(2)}s. Consider swapping the slowest leg. `;
    }

    if (diff < -2) {
      msg += `Front-loaded by ${Math.abs(diff).toFixed(2)}s — strong start, great for building early lead.`;
    } else if (diff > 2) {
      msg += `Back-loaded by ${diff.toFixed(2)}s — strong finish strategy, effective when chasing.`;
    } else {
      msg += `Even pacing — ${Math.abs(diff).toFixed(2)}s differential. Textbook relay distribution.`;
    }
    return msg;
  }, [legTimes, totalTime]);

  if (!config) {
    return <div className="text-white/40 text-sm py-4">No relay config for &ldquo;{eventName}&rdquo;</div>;
  }

  const ORDER_LABELS = ["1st (Dive Start)", "2nd (Exchange)", "3rd (Exchange)", "4th (Anchor)"];
  const STRAT_LABELS: { key: Strategy; label: string }[] = [
    { key: "fastest", label: "Fastest Total" },
    { key: "backload", label: "Strong Finish" },
    { key: "frontload", label: "Fast Start" },
    { key: "even", label: "Even Splits" },
  ];
  const LEG_COLORS = ["from-purple-600 to-purple-800", "from-blue-500 to-blue-700", "from-green-500 to-green-700", "from-amber-500 to-amber-700"];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={genderFilter} onChange={e => setGenderFilter(e.target.value as "M" | "F" | "X")}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00f0ff]/40">
          <option value="X">All</option>
          <option value="M">Boys</option>
          <option value="F">Girls</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search swimmers..."
          className="flex-1 min-w-[140px] bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00f0ff]/40" />
        <button onClick={autoOptimize}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all">
          ⚡ Auto-Optimize
        </button>
        <button onClick={clearAll}
          className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all">
          ✕ Clear
        </button>
      </div>

      {/* Strategy buttons */}
      <div className="flex gap-2">
        {STRAT_LABELS.map(s => (
          <button key={s.key} onClick={() => setStrategy(s.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all ${
              strategy === s.key
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:border-purple-500/40"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Roster panel */}
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-sm font-bold text-white/80">🏊 Roster</span>
            <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-full">{filteredRoster.length}</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
            {filteredRoster.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">No swimmers match filters</div>
            ) : (
              filteredRoster.map(a => {
                const bestTime = getBestTimeForStroke(a, config.strokes[0], config.dist);
                return (
                  <button key={a.id} onClick={() => addToSlot(a)}
                    className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 flex items-center justify-between hover:border-purple-500/40 hover:translate-x-1 transition-all">
                    <div>
                      <div className="text-sm font-bold text-white/90">{a.name}</div>
                      <div className="text-xs text-white/40">{a.gender === "M" ? "Boys" : "Girls"} · {a.group}</div>
                    </div>
                    <div className="font-mono text-sm font-bold text-amber-400">
                      {bestTime ? formatTime(bestTime) : "--"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Slots panel */}
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-sm font-bold text-white/80">🔥 Relay Lineup</span>
            <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-full">{filledCount}/4</span>
          </div>
          <div className="p-3 space-y-2">
            {slots.map((slot, i) => {
              const legLabel = config.strokes.every(s => s === "Free") ? `Leg ${i + 1}` : config.strokes[i];
              const legTime = legTimes[i];
              return (
                <div key={i} className={`relative rounded-lg p-3 min-h-[64px] border-2 transition-all ${
                  slot ? "border-green-500/40 bg-white/[0.03]" : "border-dashed border-white/[0.1] bg-white/[0.01]"
                }`}>
                  <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                    <span className="uppercase tracking-wider font-bold">{legLabel}</span>
                    <span>{ORDER_LABELS[i]}</span>
                  </div>
                  {slot ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white/90">{slot.name}</span>
                        <span className="text-xs text-white/40 ml-2">{slot.group}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-amber-400">{legTime > 0 ? formatTime(legTime) : "--"}</span>
                        <button onClick={() => removeFromSlot(i)}
                          className="w-6 h-6 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center hover:bg-red-500">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-white/20 text-center">Click a swimmer to assign</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      {filledCount > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-black text-amber-400">
              {filledCount === 4 && totalTime > 0 ? formatTime(totalTime) : "—:——.——"}
            </span>
            <span className="text-sm text-white/40">projected total</span>
          </div>

          {/* Split bars */}
          <div className="space-y-2">
            {slots.map((slot, i) => {
              const pct = legTimes[i] > 0 ? (legTimes[i] / maxLegTime) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-12 text-right text-xs text-white/40">Leg {i + 1}</span>
                  <div className="flex-1 h-7 bg-white/[0.04] rounded-md overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${LEG_COLORS[i]} rounded-md flex items-center px-2 text-xs font-bold transition-all duration-400`}
                      style={{ width: `${pct}%` }}>
                      {slot?.name || ""}
                    </div>
                  </div>
                  <span className="w-16 font-mono text-xs font-bold text-white/60">
                    {legTimes[i] > 0 ? formatTime(legTimes[i]) : "--"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Coaching insight */}
          <div className="bg-white/[0.03] border-l-4 border-purple-500 rounded-r-lg p-3">
            <div className="text-xs font-bold text-purple-400 mb-1">💡 Coaching Insight</div>
            <p className="text-xs text-white/50 leading-relaxed">{insight}</p>
          </div>
        </div>
      )}
    </div>
  );
}
