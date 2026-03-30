"use client";

import React, { useState, useEffect } from "react";
import type { Athlete, SwimMeet } from "../types";

interface MeetDayStatsBarProps {
  meet: SwimMeet;
  roster: Athlete[];
}

export default function MeetDayStatsBar({ meet, roster: _roster }: MeetDayStatsBarProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Stats
  const totalEntries = meet.events.reduce((s, ev) => s + ev.entries.length, 0);
  const uniqueAthletes = new Set(meet.events.flatMap(ev => ev.entries.map(e => e.athleteId))).size;
  const resultsIn = meet.events.reduce((s, ev) => s + ev.entries.filter(e => e.finalTime).length, 0);
  const pbCount = meet.events.reduce((s, ev) => s + ev.entries.filter(e => {
    if (!e.finalTime || !e.seedTime) return false;
    const seedParts = e.seedTime.split(":").map(Number);
    const finalParts = e.finalTime.split(":").map(Number);
    const seedSec = seedParts.length === 2 ? seedParts[0] * 60 + seedParts[1] : seedParts[0];
    const finalSec = finalParts.length === 2 ? finalParts[0] * 60 + finalParts[1] : finalParts[0];
    return finalSec < seedSec;
  }).length, 0);

  // Countdown
  const meetDate = new Date(meet.date + "T08:00");
  const diff = meetDate.getTime() - now.getTime();
  const isToday = meet.date === now.toISOString().split("T")[0];
  const isPast = diff < 0;

  const formatCountdown = () => {
    if (isPast && !isToday) return "Completed";
    if (isToday) return "TODAY";
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  const clock = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const stats = [
    { label: "Athletes", value: uniqueAthletes, color: "#00f0ff" },
    { label: "Events", value: meet.events.length, color: "#a855f7" },
    { label: "Entries", value: totalEntries, color: "#f59e0b" },
    { label: "Results In", value: resultsIn, color: "#10b981" },
    { label: "PBs", value: pbCount, color: "#ef4444" },
  ];

  return (
    <div className="mb-4 rounded-xl border border-[#7c3aed]/20 bg-[#1a1330]/60 backdrop-blur-sm overflow-hidden">
      {/* Header strip with clock + countdown */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#7c3aed]/15 bg-[#3b0764]/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#d97706] flex items-center justify-center font-black text-white text-sm border border-[#d97706]/50">M</div>
          <div>
            <div className="text-xs font-bold text-white/80 uppercase tracking-wider">Meet Day Command Center</div>
            <div className="text-[10px] text-white/40 font-mono">{meet.course} · {meet.location || "TBD"}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black font-mono text-[#f59e0b] tabular-nums">{clock}</div>
          <div className={`text-xs font-bold ${isToday ? "text-emerald-400 animate-pulse" : isPast ? "text-white/40" : "text-[#00f0ff]"}`}>
            {formatCountdown()}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-0">
        {stats.map(s => (
          <div key={s.label} className="text-center py-3 border-r border-[#7c3aed]/10 last:border-r-0 hover:bg-white/[0.02] transition-colors">
            <div className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
