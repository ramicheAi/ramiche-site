"use client";

import React from "react";

interface HeatEntry {
  athleteId: string;
  athleteName: string;
  heat: number;
  lane: number;
  seedTime?: string;
  finalTime?: string;
  improvement?: number;
  place?: number;
  status?: "ready" | "warmup" | "racing" | "done";
}

interface HeatLaneGridProps {
  entries: HeatEntry[];
  maxHeats: number;
  lanesPerHeat?: number;
  eventName?: string;
  showResults?: boolean;
}

const statusColors: Record<string, { bg: string; glow: string; label: string }> = {
  ready: { bg: "bg-emerald-400", glow: "shadow-[0_0_8px_rgba(52,211,153,0.6)]", label: "Ready" },
  warmup: { bg: "bg-amber-400 animate-pulse", glow: "shadow-[0_0_8px_rgba(251,191,36,0.6)]", label: "Warm-up" },
  racing: { bg: "bg-red-500 animate-pulse", glow: "shadow-[0_0_8px_rgba(239,68,68,0.6)]", label: "Racing" },
  done: { bg: "bg-white/30", glow: "", label: "Done" },
};

export default function HeatLaneGrid({ entries, maxHeats, lanesPerHeat = 8, eventName, showResults }: HeatLaneGridProps) {
  if (maxHeats === 0) return null;

  return (
    <div className="space-y-3 mt-3">
      {eventName && (
        <div className="text-xs text-[#00f0ff]/60 uppercase font-bold tracking-wider">{eventName} — Heat Sheet</div>
      )}
      {Array.from({ length: maxHeats }, (_, i) => i + 1).map(h => {
        const heatEntries = entries
          .filter(e => e.heat === h)
          .sort((a, b) => a.lane - b.lane);

        return (
          <div key={h} className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                Heat {h}{h === maxHeats ? " (Fast)" : ""}
              </div>
              <div className="text-[10px] text-white/30">
                {heatEntries.length}/{lanesPerHeat} lanes
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {heatEntries.map(e => {
                const st = statusColors[e.status || "ready"];
                return (
                  <div key={e.athleteId} className="flex items-center gap-2 bg-purple-500/5 rounded-lg px-3 py-2 border border-white/[0.04] hover:border-[#00f0ff]/20 transition-all">
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st.bg} ${st.glow}`} title={st.label} />
                    {/* Lane number */}
                    <span className="text-[#00f0ff]/50 font-mono text-xs w-5 text-right flex-shrink-0">L{e.lane}</span>
                    {/* Athlete name */}
                    <span className="text-white/80 text-xs truncate flex-1">{e.athleteName}</span>
                    {/* Times */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-white/40 font-mono text-[11px]">{e.seedTime || "NT"}</span>
                      {showResults && e.finalTime && (
                        <>
                          <span className="text-white/20">→</span>
                          <span className={`font-mono text-[11px] font-bold ${e.improvement && e.improvement > 0 ? "text-emerald-400" : "text-white/70"}`}>
                            {e.finalTime}
                          </span>
                          {e.improvement !== undefined && e.improvement > 0 && (
                            <span className="text-emerald-400/70 text-[10px]">-{e.improvement.toFixed(2)}</span>
                          )}
                        </>
                      )}
                      {showResults && e.place && e.place <= 3 && (
                        <span className="text-[10px]">{["🥇", "🥈", "🥉"][e.place - 1]}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
