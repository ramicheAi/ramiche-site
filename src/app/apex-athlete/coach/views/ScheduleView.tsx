"use client";

import React, { useState, useCallback } from "react";
import BgOrbs from "../components/BgOrbs";

type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const DAYS_OF_WEEK: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS: Record<DayOfWeek, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

type SessionType = "pool" | "weight" | "dryland";

interface ScheduleSession {
  id: string;
  type: SessionType;
  label: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
}

interface DaySchedule {
  template: string;
  sessions: ScheduleSession[];
}

interface GroupSchedule {
  groupId: string;
  weekSchedule: Record<DayOfWeek, DaySchedule>;
}

interface ScheduleTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface ScheduleViewProps {
  GameHUDHeader: React.ComponentType;
  schedules: GroupSchedule[];
  saveSchedules: (s: GroupSchedule[]) => void;
  selectedGroup: string;
  templates: ScheduleTemplate[];
}

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const SESSION_COLORS: Record<SessionType, string> = {
  pool: "#00f0ff",
  weight: "#f59e0b",
  dryland: "#a855f7",
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateShort(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function formatDateFull(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function ScheduleView({ GameHUDHeader, schedules, saveSchedules, selectedGroup, templates }: ScheduleViewProps) {
  const [editingSession, setEditingSession] = useState<{ day: DayOfWeek; sessionId: string } | null>(null);
  const [editForm, setEditForm] = useState<Partial<ScheduleSession>>({});
  const [weekOffset, setWeekOffset] = useState(0);

  const groupSchedule = schedules.find(s => s.groupId === selectedGroup);
  const today = new Date();
  const todayIdx = today.getDay();
  const todayKey = DAYS_OF_WEEK[todayIdx === 0 ? 6 : todayIdx - 1];

  const currentMonday = getMonday(today);
  const viewMonday = new Date(currentMonday);
  viewMonday.setDate(viewMonday.getDate() + weekOffset * 7);

  const weekDates: Record<DayOfWeek, Date> = {} as Record<DayOfWeek, Date>;
  DAYS_OF_WEEK.forEach((day, i) => {
    const d = new Date(viewMonday);
    d.setDate(d.getDate() + i);
    weekDates[day] = d;
  });

  const updateSession = useCallback((day: DayOfWeek, sessionId: string, updates: Partial<ScheduleSession>) => {
    if (!groupSchedule) return;
    const newSchedules = schedules.map(gs => {
      if (gs.groupId !== selectedGroup) return gs;
      const newWeek = { ...gs.weekSchedule };
      const dayData = newWeek[day];
      newWeek[day] = {
        ...dayData,
        sessions: dayData.sessions.map(s => s.id === sessionId ? { ...s, ...updates } : s),
      };
      return { ...gs, weekSchedule: newWeek };
    });
    saveSchedules(newSchedules);
  }, [groupSchedule, schedules, selectedGroup, saveSchedules]);

  const addSession = useCallback((day: DayOfWeek) => {
    if (!groupSchedule) return;
    const newSession: ScheduleSession = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "pool",
      label: "New Session",
      startTime: "15:30",
      endTime: "17:30",
      location: "Main Pool",
      notes: "",
    };
    const newSchedules = schedules.map(gs => {
      if (gs.groupId !== selectedGroup) return gs;
      const newWeek = { ...gs.weekSchedule };
      const dayData = newWeek[day];
      newWeek[day] = { ...dayData, sessions: [...dayData.sessions, newSession] };
      return { ...gs, weekSchedule: newWeek };
    });
    saveSchedules(newSchedules);
    setEditingSession({ day, sessionId: newSession.id });
    setEditForm(newSession);
  }, [groupSchedule, schedules, selectedGroup, saveSchedules]);

  const removeSession = useCallback((day: DayOfWeek, sessionId: string) => {
    if (!groupSchedule) return;
    const newSchedules = schedules.map(gs => {
      if (gs.groupId !== selectedGroup) return gs;
      const newWeek = { ...gs.weekSchedule };
      const dayData = newWeek[day];
      newWeek[day] = { ...dayData, sessions: dayData.sessions.filter(s => s.id !== sessionId) };
      return { ...gs, weekSchedule: newWeek };
    });
    saveSchedules(newSchedules);
    if (editingSession?.sessionId === sessionId) setEditingSession(null);
  }, [groupSchedule, schedules, selectedGroup, saveSchedules, editingSession]);

  const startEdit = (day: DayOfWeek, session: ScheduleSession) => {
    setEditingSession({ day, sessionId: session.id });
    setEditForm({ ...session });
  };

  const saveEdit = () => {
    if (!editingSession || !editForm) return;
    updateSession(editingSession.day, editingSession.sessionId, editForm);
    setEditingSession(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    setEditingSession(null);
    setEditForm({});
  };

  if (!groupSchedule) {
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
          <GameHUDHeader />
          <div className="text-center py-20 text-white/40 font-mono">No schedule data for this group.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <GameHUDHeader />
        <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Practice Schedule</h2>
        <p className="text-[#00f0ff]/25 text-xs mb-4 font-mono">Weekly training calendar</p>

        {/* Week Navigator */}
        <div className="flex items-center justify-between mb-8 gap-2 flex-wrap">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="px-4 py-2 text-xs font-bold font-mono uppercase text-[#00f0ff] border-2 border-[#00f0ff]/30 rounded-xl hover:shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:bg-[#00f0ff]/10 transition-all"
          >
            ← Prev Week
          </button>
          <div className="text-center font-mono">
            <div className="text-white/90 text-sm font-bold tracking-wide">
              Week of {formatDateFull(viewMonday)}
            </div>
            {weekOffset !== 0 && (
              <div className="text-white/30 text-[10px] mt-0.5">
                {weekOffset > 0 ? `+${weekOffset}` : weekOffset} week{Math.abs(weekOffset) !== 1 ? "s" : ""} from now
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="px-4 py-2 text-xs font-bold font-mono uppercase text-[#a855f7] border-2 border-[#a855f7]/30 rounded-xl hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:bg-[#a855f7]/10 transition-all"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="px-4 py-2 text-xs font-bold font-mono uppercase text-[#00f0ff] border-2 border-[#00f0ff]/30 rounded-xl hover:shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:bg-[#00f0ff]/10 transition-all"
            >
              Next Week →
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {DAYS_OF_WEEK.map(day => {
            const dayData = groupSchedule.weekSchedule[day];
            const isToday = weekOffset === 0 && day === todayKey;
            const template = templates.find(t => t.id === dayData.template);
            const isRestDay = dayData.sessions.length === 0;
            const dayDate = weekDates[day];

            if (isRestDay) {
              return (
                <div key={day} className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border-2 border-[#2d1b4e]/20 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xs font-black uppercase tracking-wider ${isToday ? "bg-[#00f0ff]/15 text-[#00f0ff] border-2 border-[#00f0ff]/30" : "bg-[#2d1b4e]/30 text-white/50 border-2 border-[#2d1b4e]/30"}`}>
                        {day}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">{DAY_LABELS[day]} <span className="text-white/40 font-mono text-xs">{formatDateShort(dayDate)}</span>{isToday && <span className="text-[#00f0ff] text-xs ml-2 font-mono">TODAY</span>}</div>
                        <div className="text-white/30 text-sm font-mono">Rest Day</div>
                      </div>
                    </div>
                    <button onClick={() => addSession(day)} className="px-3 py-1.5 text-xs font-bold font-mono text-[#00f0ff]/60 border border-[#00f0ff]/20 rounded-lg hover:bg-[#00f0ff]/10 transition-all">+ ADD</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={day} className={`game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border-2 p-5 transition-all ${isToday ? "border-[#00f0ff]/40 shadow-[0_0_25px_rgba(0,240,255,0.1)]" : "border-[#2d1b4e]/40"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xs font-black uppercase tracking-wider ${isToday ? "bg-[#00f0ff]/15 text-[#00f0ff] border-2 border-[#00f0ff]/30" : "bg-[#2d1b4e]/30 text-white/50 border-2 border-[#2d1b4e]/30"}`}>
                      {day}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">
                        {DAY_LABELS[day]} <span className="text-white/40 font-mono text-xs">{formatDateShort(dayDate)}</span>
                        {isToday && <span className="text-[#00f0ff] text-xs ml-2 font-mono">TODAY</span>}
                      </div>
                      {template && (
                        <div className="text-xs font-mono mt-0.5" style={{ color: template.color + "aa" }}>
                          {template.icon} {template.name} — {template.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => addSession(day)} className="px-3 py-1.5 text-xs font-bold font-mono text-[#00f0ff]/60 border border-[#00f0ff]/20 rounded-lg hover:bg-[#00f0ff]/10 transition-all">+ ADD</button>
                </div>

                <div className="space-y-2 ml-[4.5rem]">
                  {dayData.sessions.map(session => {
                    const isEditing = editingSession?.day === day && editingSession?.sessionId === session.id;
                    const color = SESSION_COLORS[session.type] || "#00f0ff";

                    if (isEditing) {
                      return (
                        <div key={session.id} className="p-4 rounded-xl border-2 border-[#a855f7]/40 bg-[#0e0e18]/80">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Label</label>
                              <input value={editForm.label || ""} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-[#06020f] border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#a855f7]/40" />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Type</label>
                              <select value={editForm.type || "pool"} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as SessionType }))}
                                className="w-full mt-1 px-3 py-2 bg-[#06020f] border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#a855f7]/40">
                                <option value="pool">Pool</option>
                                <option value="weight">Weight Room</option>
                                <option value="dryland">Dryland</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Start</label>
                              <input type="time" value={editForm.startTime || ""} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-[#06020f] border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#a855f7]/40" />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">End</label>
                              <input type="time" value={editForm.endTime || ""} onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-[#06020f] border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#a855f7]/40" />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Location</label>
                              <input value={editForm.location || ""} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-[#06020f] border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#a855f7]/40" />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Notes</label>
                              <input value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-[#06020f] border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#a855f7]/40" />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => removeSession(day, session.id)} className="px-3 py-1.5 text-xs font-bold font-mono text-red-400/80 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-all">DELETE</button>
                            <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-bold font-mono text-white/60 border border-white/10 rounded-lg hover:bg-white/5 transition-all">CANCEL</button>
                            <button onClick={saveEdit} className="px-4 py-1.5 text-xs font-bold font-mono text-[#00f0ff] border border-[#00f0ff]/30 rounded-lg hover:bg-[#00f0ff]/10 transition-all">SAVE</button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={session.id} onClick={() => startEdit(day, session)}
                        className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-8 rounded-full" style={{ background: color }} />
                          <div>
                            <div className="text-white/90 text-sm font-semibold">{session.label}</div>
                            <div className="text-white/40 text-xs font-mono">{formatTime12(session.startTime)} – {formatTime12(session.endTime)} · {session.location}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color }}>{session.type}</span>
                          {session.notes && <span className="text-white/30 text-xs hidden sm:inline">{session.notes}</span>}
                          <span className="text-white/20 text-xs opacity-0 group-hover:opacity-100 transition-opacity font-mono">EDIT</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
