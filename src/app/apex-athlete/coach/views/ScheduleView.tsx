"use client";

import React, { useState } from "react";
import BgOrbs from "../components/BgOrbs";

/* ── types ─────────────────────────────────────────────────── */
type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const DAYS: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_SHORT: Record<DayOfWeek, string> = { Sun: "SU", Mon: "MO", Tue: "TU", Wed: "WE", Thu: "TH", Fri: "FR", Sat: "SA" };

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
  return `${h12}:${m.toString().padStart(2, "0")}${suffix}`;
}

const typeBadge: Record<string, { icon: string; bg: string; text: string }> = {
  pool:    { icon: "🏊", bg: "bg-cyan-500/10", text: "text-cyan-400" },
  weight:  { icon: "🏋️", bg: "bg-amber-500/10", text: "text-amber-400" },
  dryland: { icon: "🔥", bg: "bg-purple-500/10", text: "text-purple-400" },
};

export default function ScheduleView({ GameHUDHeader, schedules, activeGroup, rosterGroups }: ScheduleViewProps) {
  const [selectedGroup, setSelectedGroup] = useState(activeGroup);
  const now = new Date();
  const todayIdx = now.getDay(); // 0=Sun
  const todayKey = DAYS[todayIdx];
  const gs = schedules.find(s => s.groupId === selectedGroup);
  const groupMeta = rosterGroups.find(g => g.id === selectedGroup);

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 pb-12">
        <GameHUDHeader />

        {/* Title */}
        <div className="mb-6">
          <h2 className="text-xl font-black tracking-tight text-white">Weekly Schedule</h2>
          <p className="text-white/30 text-xs mt-0.5">{groupMeta?.icon} {groupMeta?.name ?? selectedGroup}</p>
        </div>

        {/* Group pills */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {rosterGroups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all ${
                selectedGroup === g.id
                  ? "bg-white text-[#06020f]"
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
              }`}
            >
              {g.icon} {g.name}
            </button>
          ))}
        </div>

        {/* Day strip — quick glance at which days have sessions */}
        <div className="flex gap-1 mb-6">
          {DAYS.map(day => {
            const d = gs?.weekSchedule[day];
            const hasSession = d && d.sessions.length > 0;
            const isToday = day === todayKey;
            return (
              <div
                key={day}
                className={`flex-1 text-center py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  isToday
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : hasSession
                      ? "bg-white/5 text-white/50"
                      : "bg-transparent text-white/15"
                }`}
              >
                {DAY_SHORT[day]}
                {hasSession && <div className={`w-1 h-1 rounded-full mx-auto mt-1 ${isToday ? "bg-cyan-400" : "bg-white/30"}`} />}
              </div>
            );
          })}
        </div>

        {/* Schedule cards */}
        {!gs ? (
          <div className="text-center text-white/20 py-16 text-sm">No schedule for this group.</div>
        ) : (
          <div className="space-y-2">
            {DAYS.map(day => {
              const d = gs.weekSchedule[day];
              const isToday = day === todayKey;
              const isRest = !d || d.sessions.length === 0;

              return (
                <div
                  key={day}
                  className={`rounded-xl border px-4 py-3 transition-all ${
                    isToday
                      ? "border-cyan-500/30 bg-cyan-500/[0.04]"
                      : isRest
                        ? "border-white/[0.04] bg-white/[0.01]"
                        : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-black w-7 ${isToday ? "text-cyan-400" : "text-white/30"}`}>
                        {DAY_SHORT[day]}
                      </span>
                      {isRest ? (
                        <span className="text-white/15 text-xs">Rest</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {d.sessions.map(s => {
                            const badge = typeBadge[s.type] ?? typeBadge.pool;
                            return (
                              <div key={s.id} className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text} font-medium`}>
                                  {badge.icon} {s.label}
                                </span>
                                <span className="text-white/40 text-[11px] font-mono">
                                  {fmt12(s.startTime)}–{fmt12(s.endTime)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {isToday && !isRest && (
                      <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">NOW</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
