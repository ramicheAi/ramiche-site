"use client";

import React from "react";
import BgOrbs from "../components/BgOrbs";

const Card = ({ children, className = "", neon = false }: { children: React.ReactNode; className?: string; neon?: boolean }) => (
  <div style={{animation: 'glowBreathe 4s ease-in-out infinite'}} className={`game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}>{children}</div>
);

interface ScheduleViewProps {
  GameHUDHeader: React.ComponentType;
}

const practiceSchedule = [
  { day: "Monday", time: "3:30 PM – 5:30 PM", type: "Pool", focus: "Technique & Drills" },
  { day: "Tuesday", time: "3:30 PM – 5:30 PM", type: "Pool", focus: "Endurance Sets" },
  { day: "Wednesday", time: "3:30 PM – 5:30 PM", type: "Dryland", focus: "Strength & Conditioning" },
  { day: "Thursday", time: "3:30 PM – 5:30 PM", type: "Pool", focus: "Sprint & Race Prep" },
  { day: "Friday", time: "3:30 PM – 5:30 PM", type: "Pool", focus: "Mixed / Fun Sets" },
  { day: "Saturday", time: "8:00 AM – 10:00 AM", type: "Pool", focus: "Competition Simulation" },
];

export default function ScheduleView({ GameHUDHeader }: ScheduleViewProps) {
  const todayDay = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <GameHUDHeader />
        <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Practice Schedule</h2>
        <p className="text-[#00f0ff]/25 text-xs mb-8 font-mono">Weekly training calendar</p>
        <div className="space-y-3">
          {practiceSchedule.map(s => {
            const isToday = s.day === todayDay;
            return (
              <div key={s.day} className={`game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border p-5 transition-all ${isToday ? "border-[#00f0ff]/40 shadow-[0_0_25px_rgba(0,240,255,0.1)]" : "border-[#2d1b4e]/40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black uppercase tracking-wider ${isToday ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30" : "bg-[#2d1b4e]/30 text-white/50 border border-[#2d1b4e]/30"}`}>
                      {s.day.slice(0, 3)}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{s.day}{isToday && <span className="text-[#00f0ff] text-xs ml-2 font-mono">TODAY</span>}</div>
                      <div className="text-white/40 text-xs font-mono">{s.time}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold uppercase tracking-wider ${s.type === "Pool" ? "text-[#00f0ff]/70" : "text-[#f59e0b]/70"}`}>{s.type}</div>
                    <div className="text-white/50 text-xs">{s.focus}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {!practiceSchedule.some(s => s.day === "Sunday") && (
            <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border border-[#2d1b4e]/20 p-5 text-center">
              <span className="text-white/30 text-sm font-mono">Sunday — Rest Day</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
