"use client";

import React from "react";
import BgOrbs from "../components/BgOrbs";
import type { Athlete, RosterGroup, SwimMeet, MeetEvent, MeetEventEntry, MeetBroadcast } from "../types";
import { scoreEvent, parseTime as scoringParseTime, type ScoringResult, type BestTime, type MeetResult } from "../../lib/meet-scoring";

// Re-export meet types for consumers that imported from here
export type { MeetEventEntry, MeetEvent, MeetBroadcast, SwimMeet };

// ── local Card (matches coach page Card) ─────────────────────
const Card = ({ children, className = "", glow = false, neon = false }: { children: React.ReactNode; className?: string; glow?: boolean; neon?: boolean }) => (
  <div style={{animation: 'glowBreathe 4s ease-in-out infinite'}} className={`game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] ${glow ? "neon-pulse" : ""} ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}>{children}</div>
);

// ── standard swim events ─────────────────────────────────────

const STANDARD_SWIM_EVENTS: { name: string; courses: ("SCY" | "SCM" | "LCM")[] }[] = [
  { name: "50 Free", courses: ["SCY", "SCM", "LCM"] },
  { name: "100 Free", courses: ["SCY", "SCM", "LCM"] },
  { name: "200 Free", courses: ["SCY", "SCM", "LCM"] },
  { name: "500 Free", courses: ["SCY"] },
  { name: "400 Free", courses: ["SCM", "LCM"] },
  { name: "1000 Free", courses: ["SCY"] },
  { name: "800 Free", courses: ["SCM", "LCM"] },
  { name: "1650 Free", courses: ["SCY"] },
  { name: "1500 Free", courses: ["SCM", "LCM"] },
  { name: "50 Back", courses: ["SCY", "SCM", "LCM"] },
  { name: "100 Back", courses: ["SCY", "SCM", "LCM"] },
  { name: "200 Back", courses: ["SCY", "SCM", "LCM"] },
  { name: "50 Breast", courses: ["SCY", "SCM", "LCM"] },
  { name: "100 Breast", courses: ["SCY", "SCM", "LCM"] },
  { name: "200 Breast", courses: ["SCY", "SCM", "LCM"] },
  { name: "50 Fly", courses: ["SCY", "SCM", "LCM"] },
  { name: "100 Fly", courses: ["SCY", "SCM", "LCM"] },
  { name: "200 Fly", courses: ["SCY", "SCM", "LCM"] },
  { name: "100 IM", courses: ["SCY", "SCM", "LCM"] },
  { name: "200 IM", courses: ["SCY", "SCM", "LCM"] },
  { name: "400 IM", courses: ["SCY", "SCM", "LCM"] },
  { name: "200 Free Relay", courses: ["SCY", "SCM", "LCM"] },
  { name: "400 Free Relay", courses: ["SCY", "SCM", "LCM"] },
  { name: "800 Free Relay", courses: ["SCY", "SCM", "LCM"] },
  { name: "200 Medley Relay", courses: ["SCY", "SCM", "LCM"] },
  { name: "400 Medley Relay", courses: ["SCY", "SCM", "LCM"] },
];

// ── props ────────────────────────────────────────────────────

export interface MeetsViewProps {
  GameHUDHeader: React.ComponentType;
  meets: SwimMeet[];
  setMeets: (m: SwimMeet[]) => void;
  saveMeetsToStorage: (m: SwimMeet[]) => void;
  roster: Athlete[];
  filteredRoster: Athlete[];
  ROSTER_GROUPS: readonly RosterGroup[];
  // form state
  newMeetName: string;
  setNewMeetName: (v: string) => void;
  newMeetDate: string;
  setNewMeetDate: (v: string) => void;
  newMeetLocation: string;
  setNewMeetLocation: (v: string) => void;
  newMeetCourse: "SCY" | "SCM" | "LCM";
  setNewMeetCourse: (v: "SCY" | "SCM" | "LCM") => void;
  newMeetDeadline: string;
  setNewMeetDeadline: (v: string) => void;
  editingMeetId: string | null;
  setEditingMeetId: (v: string | null) => void;
  meetEventPicker: string | null;
  setMeetEventPicker: (v: string | null) => void;
  broadcastMsg: string;
  setBroadcastMsg: (v: string) => void;
  onMeetScore?: (result: ScoringResult, meet: SwimMeet) => void;
}

// ── helpers ──────────────────────────────────────────────────

const LANE_ORDER_8 = [4, 5, 3, 6, 2, 7, 1, 8];
const LANE_ORDER_6 = [3, 4, 2, 5, 1, 6];

function parseTime(t: string): number | null {
  if (!t) return null;
  const parts = t.replace(/[^0-9.:]/g, "").split(/[:.]/);
  if (parts.length === 3) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]) + parseFloat(parts[2]) / 100;
  if (parts.length === 2) return parseFloat(parts[0]) + parseFloat(parts[1]) / 100;
  return null;
}

function calcImprovement(seed: string, final: string): number | undefined {
  const s = parseTime(seed), f = parseTime(final);
  if (s === null || f === null || s === 0) return undefined;
  return Math.round((s - f) * 100) / 100;
}

// ── component ────────────────────────────────────────────────

export default function MeetsView({
  GameHUDHeader,
  meets,
  setMeets,
  saveMeetsToStorage,
  roster,
  filteredRoster,
  ROSTER_GROUPS,
  newMeetName,
  setNewMeetName,
  newMeetDate,
  setNewMeetDate,
  newMeetLocation,
  setNewMeetLocation,
  newMeetCourse,
  setNewMeetCourse,
  newMeetDeadline,
  setNewMeetDeadline,
  editingMeetId,
  setEditingMeetId,
  meetEventPicker,
  setMeetEventPicker,
  broadcastMsg,
  setBroadcastMsg,
  onMeetScore,
}: MeetsViewProps) {
  const saveMeets = (m: SwimMeet[]) => { setMeets(m); saveMeetsToStorage(m); };

  const exportMeetResults = (meet: SwimMeet) => {
    const rows: string[] = ["Event,Athlete,Seed Time,Final Time,Place,Improvement,Splits,DQ,DQ Reason"];
    meet.events.forEach(ev => {
      ev.entries.forEach(entry => {
        const ath = roster.find(a => a.id === entry.athleteId);
        const imp = entry.finalTime ? calcImprovement(entry.seedTime, entry.finalTime) : undefined;
        rows.push([
          `"${ev.name}"`, `"${ath?.name || "Unknown"}"`, entry.seedTime || "",
          entry.finalTime || "", entry.place || "", imp !== undefined ? (imp > 0 ? `−${imp.toFixed(2)}` : imp < 0 ? `+${Math.abs(imp).toFixed(2)}` : "0.00") : "",
          `"${(entry.splits || []).join(" / ")}"`, entry.dq ? "Yes" : "", `"${entry.dqReason || ""}"`
        ].join(","));
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${meet.name.replace(/\s+/g, "_")}_results.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const createMeet = () => {
    if (!newMeetName || !newMeetDate) return;
    const m: SwimMeet = {
      id: `meet-${Date.now()}`, name: newMeetName, date: newMeetDate, location: newMeetLocation,
      course: newMeetCourse, rsvpDeadline: newMeetDeadline || newMeetDate,
      events: [], rsvps: {}, broadcasts: [], status: "upcoming",
    };
    saveMeets([...meets, m]);
    setNewMeetName(""); setNewMeetDate(""); setNewMeetLocation(""); setNewMeetDeadline("");
  };

  const deleteMeet = (id: string) => saveMeets(meets.filter(m => m.id !== id));

  const addEventToMeet = (meetId: string, eventName: string) => {
    saveMeets(meets.map(m => m.id === meetId ? { ...m, events: [...m.events, { id: `ev-${Date.now()}`, name: eventName, entries: [] }] } : m));
  };

  const removeEvent = (meetId: string, eventId: string) => {
    saveMeets(meets.map(m => m.id === meetId ? { ...m, events: m.events.filter(e => e.id !== eventId) } : m));
  };

  const toggleAthleteEntry = (meetId: string, eventId: string, athleteId: string) => {
    saveMeets(meets.map(m => {
      if (m.id !== meetId) return m;
      return { ...m, events: m.events.map(ev => {
        if (ev.id !== eventId) return ev;
        const exists = ev.entries.find(e => e.athleteId === athleteId);
        if (exists) return { ...ev, entries: ev.entries.filter(e => e.athleteId !== athleteId) };
        return { ...ev, entries: [...ev.entries, { athleteId, seedTime: "" }] };
      })};
    }));
  };

  const updateEntryField = (meetId: string, eventId: string, athleteId: string, field: keyof MeetEventEntry, value: string | number | boolean | string[]) => {
    saveMeets(meets.map(m => {
      if (m.id !== meetId) return m;
      return { ...m, events: m.events.map(ev => {
        if (ev.id !== eventId) return ev;
        return { ...ev, entries: ev.entries.map(e => e.athleteId !== athleteId ? e : { ...e, [field]: value }) };
      })};
    }));

    // Auto-score when finalTime is entered
    if (field === "finalTime" && typeof value === "string" && value.trim()) {
      const finalSeconds = scoringParseTime(value);
      if (finalSeconds > 0 && onMeetScore) {
        const meet = meets.find(m => m.id === meetId);
        const event = meet?.events.find(ev => ev.id === eventId);
        const entry = event?.entries.find(e => e.athleteId === athleteId);
        const athlete = roster.find(a => a.id === athleteId);
        if (meet && event && entry && athlete) {
          // Parse event name into distance + stroke (e.g. "100 Free" → "100", "Freestyle")
          const parts = event.name.split(" ");
          const dist = parts[0] || event.name;
          const stroke = parts.slice(1).join(" ") || event.name;
          const meetResult: MeetResult = {
            athleteId,
            event: dist,
            stroke,
            course: meet.course,
            seedTime: entry.seedTime || "",
            finalTime: value,
            finalSeconds,
            place: entry.place,
            splits: entry.splits,
            dq: entry.dq,
            isRelay: event.name.toLowerCase().includes("relay"),
          };
          const bestTimes: Record<string, BestTime> = {};
          if (athlete.bestTimes) {
            Object.entries(athlete.bestTimes).forEach(([k, v]) => {
              bestTimes[k] = { ...v, event: v.time, stroke: "", source: v.source };
            });
          }
          const result = scoreEvent(meetResult, bestTimes, meet.name, meet.date);
          if (result.totalXP > 0 || result.newBestTimes.length > 0) {
            onMeetScore(result, meet);
          }
        }
      }
    }
  };

  const setMeetStatus = (meetId: string, status: SwimMeet["status"]) => {
    saveMeets(meets.map(m => m.id === meetId ? { ...m, status } : m));
  };

  const autoSeedEvent = (meetId: string, eventId: string, lanes: number) => {
    saveMeets(meets.map(m => {
      if (m.id !== meetId) return m;
      return { ...m, events: m.events.map(ev => {
        if (ev.id !== eventId) return ev;
        const sorted = [...ev.entries].sort((a, b) => {
          const ta = parseTime(a.seedTime), tb = parseTime(b.seedTime);
          if (ta === null && tb === null) return 0;
          if (ta === null) return 1;
          if (tb === null) return -1;
          return ta - tb;
        });
        const laneOrder = lanes <= 6 ? LANE_ORDER_6 : LANE_ORDER_8;
        const numHeats = Math.ceil(sorted.length / lanes);
        const seeded = sorted.map((entry, i) => {
          const heatFromEnd = Math.floor(i / lanes);
          const heat = numHeats - heatFromEnd;
          const posInHeat = i % lanes;
          const lane = laneOrder[posInHeat] || posInHeat + 1;
          return { ...entry, heat, lane };
        });
        return { ...ev, entries: seeded, lanesPerHeat: lanes };
      })};
    }));
  };

  const sendMeetBroadcast = (meetId: string) => {
    if (!broadcastMsg.trim()) return;
    const bc: MeetBroadcast = { id: `bc-${Date.now()}`, message: broadcastMsg, timestamp: Date.now(), sentBy: "Coach" };
    saveMeets(meets.map(m => m.id === meetId ? { ...m, broadcasts: [...m.broadcasts, bc] } : m));
    setBroadcastMsg("");
  };

  const rsvpCounts = (m: SwimMeet) => {
    const vals = Object.values(m.rsvps);
    return { committed: vals.filter(v => v === "committed").length, declined: vals.filter(v => v === "declined").length, pending: filteredRoster.length - vals.length };
  };

  const editMeet = editingMeetId ? meets.find(m => m.id === editingMeetId) : null;

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <GameHUDHeader />
        <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Meet Entry</h2>
        <p className="text-[#00f0ff]/30 text-xs font-mono mb-6">Create meets · Add events · Enter athletes</p>

        {!editMeet ? (
          <>
            {/* Create new meet */}
            <Card className="p-5 mb-6" neon>
              <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">New Meet</h3>
              <div className="space-y-3">
                <input value={newMeetName} onChange={e => setNewMeetName(e.target.value)} placeholder="Meet name"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={newMeetDate} onChange={e => setNewMeetDate(e.target.value)}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
                  <select value={newMeetCourse} onChange={e => setNewMeetCourse(e.target.value as "SCY" | "SCM" | "LCM")}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f0ff]/40">
                    <option value="SCY">SCY</option><option value="SCM">SCM</option><option value="LCM">LCM</option>
                  </select>
                </div>
                <input value={newMeetLocation} onChange={e => setNewMeetLocation(e.target.value)} placeholder="Location"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-white/60 uppercase mb-1 block">RSVP Deadline</label>
                    <input type="date" value={newMeetDeadline} onChange={e => setNewMeetDeadline(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
                  </div>
                  <button onClick={createMeet} disabled={!newMeetName || !newMeetDate}
                    className="mt-4 game-btn px-6 py-2.5 text-sm font-bold bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 rounded-lg hover:bg-[#00f0ff]/20 disabled:opacity-30 transition-all">
                    Create
                  </button>
                </div>
              </div>
            </Card>

            {/* Meet list */}
            {meets.length === 0 ? (
              <div className="text-center py-12 text-white/50 text-sm">No meets created yet</div>
            ) : (
              <div className="space-y-3">
                {meets.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(m => {
                  const rc = rsvpCounts(m);
                  return (
                    <Card key={m.id} className="p-5" neon>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-white text-base">{m.name}</h4>
                          <p className="text-white/60 text-sm mt-0.5">{new Date(m.date + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {m.course} · {m.location || "TBD"}</p>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                          m.status === "upcoming" ? "bg-[#00f0ff]/10 text-[#00f0ff]" :
                          m.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                          "bg-white/5 text-white/60"
                        }`}>{m.status}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm mb-4">
                        <span className="text-emerald-400 font-medium">{rc.committed} in</span>
                        <span className="text-red-400 font-medium">{rc.declined} out</span>
                        <span className="text-white/60">{rc.pending} pending</span>
                        <span className="text-white/40">·</span>
                        <span className="text-[#a855f7] font-bold">{m.events.length} events</span>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setEditingMeetId(m.id)}
                          className="flex-1 game-btn py-3 text-sm font-bold text-[#00f0ff] border border-[#00f0ff]/20 rounded-lg hover:bg-[#00f0ff]/10 transition-all active:scale-[0.98]">
                          Manage
                        </button>
                        <button onClick={() => deleteMeet(m.id)}
                          className="game-btn py-3 px-5 text-sm font-bold text-red-400/50 border border-red-400/10 rounded-lg hover:bg-red-400/10 hover:text-red-400 transition-all active:scale-[0.98]">
                          ✕
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Edit meet — add events, enter athletes */
          <div>
            <button onClick={() => setEditingMeetId(null)} className="text-[#00f0ff]/50 text-xs font-mono mb-4 hover:text-[#00f0ff] transition-colors">
              ← Back to meets
            </button>
            <Card className="p-5 mb-4" neon>
              <h3 className="font-bold text-white text-lg mb-1">{editMeet.name}</h3>
              <div className="flex items-center justify-between mb-4">
                <p className="text-white/60 text-xs">{new Date(editMeet.date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {editMeet.course} · {editMeet.location || "TBD"}</p>
                {(editMeet.status === "active" || editMeet.status === "completed") && editMeet.events.some(ev => ev.entries.some(e => e.finalTime)) && (
                  <button onClick={() => exportMeetResults(editMeet)}
                    className="game-btn px-4 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/10 transition-all">
                    Export CSV
                  </button>
                )}
              </div>

              {/* Add events */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Events</h4>
                {editMeet.events.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {editMeet.events.map((ev, idx) => (
                      <div key={ev.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-sm font-mono text-[#00f0ff]/50 w-8 text-right shrink-0 font-bold">#{ev.eventNum || idx + 1}</span>
                            <div className="min-w-0">
                              <span className="text-base font-bold text-white block truncate">{ev.name}</span>
                              {ev.qualifyingTime && <span className="text-xs font-mono text-[#f59e0b]/70">QT: {ev.qualifyingTime}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm text-[#a855f7] font-bold">{ev.entries.length} entered</span>
                            <button onClick={() => removeEvent(editMeet.id, ev.id)} className="text-red-400/30 hover:text-red-400 text-sm p-1 transition-colors">✕</button>
                          </div>
                        </div>
                        {/* Group quick-entry buttons */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {ROSTER_GROUPS.filter(g => g.id !== "diving" && g.id !== "waterpolo").map(g => {
                            const groupAthletes = roster.filter(a => a.group === g.id);
                            const allEntered = groupAthletes.length > 0 && groupAthletes.every(a => ev.entries.some(e => e.athleteId === a.id));
                            return (
                              <button key={g.id} onClick={() => {
                                const ga = groupAthletes.filter(a => !ev.entries.some(e => e.athleteId === a.id));
                                if (ga.length > 0) ga.forEach(a => toggleAthleteEntry(editMeet.id, ev.id, a.id));
                              }}
                                className={`text-sm px-4 py-2 rounded-lg font-bold transition-all ${
                                  allEntered
                                    ? "bg-[#00f0ff]/15 text-[#00f0ff]/50 border border-[#00f0ff]/20"
                                    : "bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 hover:bg-[#a855f7]/20 active:scale-95"
                                }`}>
                                +{g.name}
                              </button>
                            );
                          })}
                        </div>
                        {/* Individual athlete buttons */}
                        <div className="flex flex-wrap gap-2">
                          {filteredRoster.map(a => {
                            const entered = ev.entries.some(e => e.athleteId === a.id);
                            return (
                              <button key={a.id} onClick={() => toggleAthleteEntry(editMeet.id, ev.id, a.id)}
                                className={`text-sm px-3 py-2 rounded-lg font-medium transition-all active:scale-95 ${
                                  entered
                                    ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold"
                                    : "bg-white/[0.03] text-white/50 border border-white/[0.06] hover:text-white/70"
                                }`}>
                                {a.name.split(" ")[0]}
                              </button>
                            );
                          })}
                        </div>
                        {/* Auto-seed & Heat sheet */}
                        {ev.entries.length >= 2 && (
                          <div className="mt-3 border-t border-white/[0.04] pt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <button onClick={() => autoSeedEvent(editMeet.id, ev.id, 8)}
                                className="text-xs px-3 py-1.5 rounded-lg font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95">
                                Seed 8-Lane
                              </button>
                              <button onClick={() => autoSeedEvent(editMeet.id, ev.id, 6)}
                                className="text-xs px-3 py-1.5 rounded-lg font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95">
                                Seed 6-Lane
                              </button>
                            </div>
                            {ev.entries.some(e => e.heat) && (() => {
                              const maxHeat = Math.max(...ev.entries.map(e => e.heat || 0));
                              return (
                                <div className="space-y-2">
                                  {Array.from({ length: maxHeat }, (_, i) => i + 1).map(h => {
                                    const heatEntries = ev.entries.filter(e => e.heat === h).sort((a, b) => (a.lane || 0) - (b.lane || 0));
                                    return (
                                      <div key={h} className="bg-white/[0.02] rounded-lg p-2">
                                        <div className="text-[10px] text-white/40 uppercase font-bold mb-1">Heat {h}{h === maxHeat ? " (Fast)" : ""}</div>
                                        <div className="grid grid-cols-2 gap-1">
                                          {heatEntries.map(e => {
                                            const ath = roster.find(a => a.id === e.athleteId);
                                            return (
                                              <div key={e.athleteId} className="flex items-center gap-2 text-xs">
                                                <span className="text-[#00f0ff]/50 font-mono w-5 text-right">L{e.lane}</span>
                                                <span className="text-white/80 truncate">{ath?.name || "?"}</span>
                                                <span className="text-white/40 font-mono ml-auto">{e.seedTime || "NT"}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {meetEventPicker === editMeet.id ? (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 max-h-64 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {STANDARD_SWIM_EVENTS.filter(e => e.courses.includes(editMeet.course)).map(e => (
                        <button key={e.name} onClick={() => { addEventToMeet(editMeet.id, e.name); }}
                          disabled={editMeet.events.some(ev => ev.name === e.name)}
                          className={`text-sm px-4 py-2.5 rounded-lg font-medium transition-all active:scale-95 ${
                            editMeet.events.some(ev => ev.name === e.name)
                              ? "bg-white/[0.02] text-white/30 cursor-not-allowed"
                              : "bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 hover:bg-[#a855f7]/20"
                          }`}>
                          {e.name}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setMeetEventPicker(null)} className="mt-3 text-white/50 text-sm hover:text-white/70 transition-colors">Done</button>
                  </div>
                ) : (
                  <button onClick={() => setMeetEventPicker(editMeet.id)}
                    className="game-btn w-full py-3 text-sm font-bold text-[#a855f7] border border-[#a855f7]/20 rounded-lg hover:bg-[#a855f7]/10 transition-all active:scale-[0.98]">
                    + Add Events
                  </button>
                )}
              </div>

              {/* RSVP summary */}
              {(() => { const rc = rsvpCounts(editMeet); return (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                    <div className="text-lg font-black text-emerald-400">{rc.committed}</div>
                    <div className="text-xs text-emerald-400/50 uppercase">Committed</div>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2 text-center">
                    <div className="text-lg font-black text-red-400">{rc.declined}</div>
                    <div className="text-xs text-red-400/50 uppercase">Declined</div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2 text-center">
                    <div className="text-lg font-black text-white/60">{rc.pending}</div>
                    <div className="text-xs text-white/50 uppercase">Pending</div>
                  </div>
                </div>
              ); })()}

              {/* Meet status toggle */}
              <div className="flex gap-2 mb-4">
                {(["upcoming", "active", "completed"] as const).map(s => (
                  <button key={s} onClick={() => setMeetStatus(editMeet.id, s)}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all active:scale-95 ${
                      editMeet.status === s
                        ? s === "upcoming" ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                          : s === "active" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30"
                        : "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/60"
                    }`}>{s}</button>
                ))}
              </div>

              {/* Results entry — shown when meet is active or completed */}
              {(editMeet.status === "active" || editMeet.status === "completed") && editMeet.events.length > 0 && (
                <div className="border-t border-white/[0.06] pt-4 mb-4">
                  <h4 className="text-xs font-bold text-[#a855f7]/60 uppercase tracking-wider mb-3">Results Entry</h4>
                  <div className="space-y-4">
                    {editMeet.events.map((ev, idx) => (
                      ev.entries.length > 0 && (
                        <div key={ev.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                          <h5 className="text-sm font-bold text-white mb-3">#{ev.eventNum || idx + 1} {ev.name}</h5>
                          <div className="space-y-2">
                            {ev.entries.map(entry => {
                              const ath = roster.find(a => a.id === entry.athleteId);
                              const imp = entry.finalTime ? calcImprovement(entry.seedTime, entry.finalTime) : undefined;
                              return (
                                <div key={entry.athleteId} className="bg-white/[0.02] rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-white">{ath?.name || "Unknown"}</span>
                                    {entry.dq && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">DQ</span>}
                                    {imp !== undefined && !entry.dq && (
                                      <span className={`text-xs font-mono font-bold ${imp > 0 ? "text-emerald-400" : imp < 0 ? "text-red-400" : "text-white/50"}`}>
                                        {imp > 0 ? `−${imp.toFixed(2)}` : imp < 0 ? `+${Math.abs(imp).toFixed(2)}` : "="}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-[10px] text-white/40 uppercase block mb-0.5">Seed</label>
                                      <input value={entry.seedTime} onChange={e => updateEntryField(editMeet.id, ev.id, entry.athleteId, "seedTime", e.target.value)}
                                        placeholder="0:00.00" className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-xs text-white/70 font-mono focus:outline-none focus:border-[#00f0ff]/30" style={{ fontSize: "16px" }} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-white/40 uppercase block mb-0.5">Final</label>
                                      <input value={entry.finalTime || ""} onChange={e => updateEntryField(editMeet.id, ev.id, entry.athleteId, "finalTime", e.target.value)}
                                        placeholder="0:00.00" className="w-full bg-white/[0.04] border border-[#a855f7]/20 rounded px-2 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-[#a855f7]/50" style={{ fontSize: "16px" }} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-white/40 uppercase block mb-0.5">Place</label>
                                      <input type="number" min="1" value={entry.place || ""} onChange={e => updateEntryField(editMeet.id, ev.id, entry.athleteId, "place", e.target.value ? parseInt(e.target.value) : 0)}
                                        placeholder="#" className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-xs text-white/70 font-mono focus:outline-none focus:border-[#00f0ff]/30" style={{ fontSize: "16px" }} />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2">
                                    <button onClick={() => updateEntryField(editMeet.id, ev.id, entry.athleteId, "dq", !entry.dq)}
                                      className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${entry.dq ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/50"}`}>
                                      DQ
                                    </button>
                                    {entry.dq && (
                                      <input value={entry.dqReason || ""} onChange={e => updateEntryField(editMeet.id, ev.id, entry.athleteId, "dqReason", e.target.value)}
                                        placeholder="Reason..." className="flex-1 bg-white/[0.04] border border-red-500/10 rounded px-2 py-1 text-xs text-white/60 focus:outline-none" style={{ fontSize: "16px" }} />
                                    )}
                                  </div>
                                  {/* Splits entry */}
                                  {entry.finalTime && !entry.dq && (
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] text-white/40 uppercase">Splits</label>
                                        <button onClick={() => {
                                          const current = entry.splits || [];
                                          updateEntryField(editMeet.id, ev.id, entry.athleteId, "splits", [...current, ""]);
                                        }} className="text-[10px] text-[#00f0ff]/60 hover:text-[#00f0ff] transition-colors">+ Add Split</button>
                                      </div>
                                      {(entry.splits || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                          {(entry.splits || []).map((sp, si) => (
                                            <div key={si} className="flex items-center gap-1">
                                              <span className="text-[9px] text-white/30 font-mono w-3">{si + 1}</span>
                                              <input value={sp} onChange={e => {
                                                const updated = [...(entry.splits || [])];
                                                updated[si] = e.target.value;
                                                updateEntryField(editMeet.id, ev.id, entry.athleteId, "splits", updated);
                                              }} placeholder="0:00.00"
                                                className="w-20 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-1 text-[11px] text-white/70 font-mono focus:outline-none focus:border-[#00f0ff]/30"
                                                style={{ fontSize: "16px" }} />
                                              <button onClick={() => {
                                                const updated = (entry.splits || []).filter((_, i) => i !== si);
                                                updateEntryField(editMeet.id, ev.id, entry.athleteId, "splits", updated);
                                              }} className="text-white/20 hover:text-red-400 text-xs transition-colors">&times;</button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Meet Summary Report — shown when meet is completed */}
              {editMeet.status === "completed" && (() => {
                const allEntries = editMeet.events.flatMap(ev => ev.entries.map(e => ({ ...e, event: ev.name })));
                const withResults = allEntries.filter(e => e.finalTime && !e.dq);
                const dqCount = allEntries.filter(e => e.dq).length;
                const improvements = withResults.map(e => ({ ...e, imp: calcImprovement(e.seedTime, e.finalTime!) })).filter(e => e.imp !== undefined);
                const bestDrops = improvements.filter(e => (e.imp ?? 0) > 0).sort((a, b) => (b.imp ?? 0) - (a.imp ?? 0)).slice(0, 5);
                const uniqueAthletes = new Set(allEntries.map(e => e.athleteId)).size;
                const prs = improvements.filter(e => (e.imp ?? 0) > 0).length;
                return (
                  <div className="border-t border-emerald-400/10 pt-4 mb-4">
                    <h4 className="text-xs font-bold text-emerald-400/60 uppercase tracking-wider mb-3">Meet Summary</h4>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-white">{uniqueAthletes}</div>
                        <div className="text-[10px] text-white/40 uppercase">Athletes</div>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-[#a855f7]">{editMeet.events.length}</div>
                        <div className="text-[10px] text-white/40 uppercase">Events</div>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-emerald-400">{prs}</div>
                        <div className="text-[10px] text-white/40 uppercase">PRs</div>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-red-400">{dqCount}</div>
                        <div className="text-[10px] text-white/40 uppercase">DQs</div>
                      </div>
                    </div>
                    {bestDrops.length > 0 && (
                      <div className="bg-white/[0.02] border border-emerald-400/10 rounded-xl p-4">
                        <h5 className="text-[10px] font-bold text-emerald-400/50 uppercase tracking-wider mb-2">Top Time Drops</h5>
                        <div className="space-y-1.5">
                          {bestDrops.map((d, i) => {
                            const ath = roster.find(a => a.id === d.athleteId);
                            return (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-xs text-white/70">{ath?.name || "Unknown"} — {d.event}</span>
                                <span className="text-xs font-mono font-bold text-emerald-400">−{(d.imp ?? 0).toFixed(2)}s</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Broadcast to parents about this meet */}
              <div className="border-t border-white/[0.06] pt-3">
                <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Message Parents</h4>
                <div className="flex gap-2">
                  <input value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Send update to all parents..."
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
                  <button onClick={() => sendMeetBroadcast(editMeet.id)} disabled={!broadcastMsg.trim()}
                    className="game-btn px-4 py-2 text-xs font-bold text-[#00f0ff] border border-[#00f0ff]/20 rounded-lg hover:bg-[#00f0ff]/10 disabled:opacity-30 transition-all">
                    Send
                  </button>
                </div>
                {editMeet.broadcasts.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                    {editMeet.broadcasts.slice().reverse().map(bc => (
                      <div key={bc.id} className="text-xs text-white/60 bg-white/[0.02] rounded p-2">
                        <span className="text-white/50">{bc.message}</span>
                        <span className="text-white/40 ml-2">{new Date(bc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
