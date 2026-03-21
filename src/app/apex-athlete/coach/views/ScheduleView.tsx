"use client";

import React, { useState } from "react";
import BgOrbs from "../components/BgOrbs";

/* ── types (mirrored from page.tsx) ─────────────────────────── */
type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS: Record<DayOfWeek, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

interface ScheduleSession {
  id: string;
  type: "pool" | "weight" | "dryland";
  label: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
}
interface DaySchedule { template: string; sessions: ScheduleSession[]; }
interface GroupSchedule { groupId: string; weekSchedule: Record<DayOfWeek, DaySchedule>; }

interface ScheduleViewProps {
  GameHUDHeader: React.ComponentType;
  schedules: GroupSchedule[];
  activeGroup: string;
  rosterGroups: readonly { id: string; name: string; color: string; icon: string }[];
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

const typeIcon: Record<string, string> = { pool: "🏊", weight: "🏋️", dryland: "🔥" };
const typeColor: Record<string, string> = { pool: "#00f0ff", weight: "#f59e0b", dryland: "#a855f7" };

export default function ScheduleView({ GameHUDHeader, schedules, activeGroup, rosterGroups }: ScheduleViewProps) {
  const [selectedGroup, setSelectedGroup] = useState(activeGroup);
  const todayIdx = new Date().getDay(); // 0=Sun
  const todayKey = DAYS[todayIdx === 0 ? 6 : todayIdx - 1];
  const gs = schedules.find(s => s.groupId === selectedGroup);
  const groupMeta = rosterGroups.find(g => g.id === selectedGroup);

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <GameHUDHeader />

        <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Practice Schedule</h2>
        <p className="text-white/30 text-xs mb-6 font-mono">{groupMeta?.icon} {groupMeta?.name || selectedGroup} — Weekly Training</p>

        {/* Group selector */}
        <div className="flex gap-2 flex-wrap mb-8">
          {rosterGroups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                selectedGroup === g.id
                  ? "border-[#00f0ff]/50 bg-[#00f0ff]/10 text-[#00f0ff]"
                  : "border-[#2d1b4e]/30 bg-[#2d1b4e]/10 text-white/40 hover:text-white/60"
              }`}
            >
              {g.icon} {g.name}
            </button>
          ))}
        </div>

        {/* Weekly schedule */}
        {!gs ? (
          <div className="text-center text-white/30 py-12 font-mono text-sm">No schedule data for this group.</div>
        ) : (
          <div className="space-y-3">
            {DAYS.map(day => {
              const d = gs.weekSchedule[day];
              const isToday = day === todayKey;
              const isRest = !d || d.sessions.length === 0;

              return (
                <div
                  key={day}
                  className={`rounded-xl border p-4 sm:p-5 transition-all ${
                    isToday
                      ? "border-[#00f0ff]/40 bg-[#00f0ff]/[0.03] shadow-[0_0_20px_rgba(0,240,255,0.06)]"
                      : "border-[#2d1b4e]/25 bg-[#06020f]/60"
                  }`}
                >
                  {/* Day header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-black uppercase tracking-wider ${
                      isToday ? "bg-[#00f0ff]/12 text-[#00f0ff] border border-[#00f0ff]/25" : "bg-[#2d1b4e]/20 text-white/40 border border-[#2d1b4e]/20"
                    }`}>
                      {day}
                    </div>
                    <div>
                      <span className="text-white font-bold text-sm">{DAY_LABELS[day]}</span>
                      {isToday && <span className="text-[#00f0ff] text-[10px] ml-2 font-mono font-bold">TODAY</span>}
                    </div>
                  </div>

                  {/* Sessions or rest */}
                  {isRest ? (
                    <div className="text-white/20 text-xs font-mono pl-[52px]">Rest Day</div>
                  ) : (
                    <div className="space-y-2 pl-[52px]">
                      {d.sessions.map(s => (
                        <div key={s.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{typeIcon[s.type] || "📋"}</span>
                            <span className="text-white/80 text-sm font-medium">{s.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono" style={{ color: typeColor[s.type] || "#fff" }}>
                              {fmt12(s.startTime)} – {fmt12(s.endTime)}
                            </span>
                            {s.location && <div className="text-white/25 text-[10px]">{s.location}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
