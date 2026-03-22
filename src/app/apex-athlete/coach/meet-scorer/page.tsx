"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Flame, Snowflake, ArrowRight, Download, Printer } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   METTLE // Meet Scorer — Real-Time Swim Meet Scoring Engine
   4 formats, momentum analysis, win conditions, projections
   ═══════════════════════════════════════════════════════════ */

// ── Types ──
interface Result {
  swimmer: string;
  team: number;
  place: number;
  time: string;
}

interface MeetEvent {
  num: number;
  name: string;
  type: "individual" | "relay";
  results: Result[];
}

type ScoringFormat = "dual" | "dual5" | "champ" | "invitational" | "custom";

interface MeetState {
  teams: string[];
  events: MeetEvent[];
  format: ScoringFormat;
  relayMult: number;
  customScoring: number[];
  meetName: string;
}

// ── Constants ──
const SCORING_FORMATS: Record<string, number[]> = {
  dual: [6, 4, 3, 2, 1],
  dual5: [5, 3, 1],
  champ: [20, 17, 16, 15, 14, 13, 12, 11],
  invitational: [16, 13, 12, 11, 10, 9, 8, 7],
};

const TEAM_COLORS = ["#7c3aed", "#dc2626", "#3b82f6", "#22c55e", "#f59e0b"];

const TEMPLATES: Record<string, { events: Omit<MeetEvent, "results">[]; format: ScoringFormat }> = {
  dualHS: {
    format: "dual",
    events: [
      { num: 1, name: "200 Medley Relay", type: "relay" },
      { num: 2, name: "200 Freestyle", type: "individual" },
      { num: 3, name: "200 IM", type: "individual" },
      { num: 4, name: "50 Freestyle", type: "individual" },
      { num: 5, name: "100 Butterfly", type: "individual" },
      { num: 6, name: "100 Freestyle", type: "individual" },
      { num: 7, name: "500 Freestyle", type: "individual" },
      { num: 8, name: "200 Free Relay", type: "relay" },
      { num: 9, name: "100 Backstroke", type: "individual" },
      { num: 10, name: "100 Breaststroke", type: "individual" },
      { num: 11, name: "400 Free Relay", type: "relay" },
    ],
  },
  champHS: {
    format: "champ",
    events: [
      { num: 1, name: "200 Medley Relay", type: "relay" },
      { num: 2, name: "200 Freestyle", type: "individual" },
      { num: 3, name: "200 IM", type: "individual" },
      { num: 4, name: "50 Freestyle", type: "individual" },
      { num: 5, name: "1m Diving", type: "individual" },
      { num: 6, name: "100 Butterfly", type: "individual" },
      { num: 7, name: "100 Freestyle", type: "individual" },
      { num: 8, name: "500 Freestyle", type: "individual" },
      { num: 9, name: "200 Free Relay", type: "relay" },
      { num: 10, name: "100 Backstroke", type: "individual" },
      { num: 11, name: "100 Breaststroke", type: "individual" },
      { num: 12, name: "400 Free Relay", type: "relay" },
    ],
  },
  dualAge: {
    format: "dual",
    events: [
      { num: 1, name: "200 Medley Relay", type: "relay" },
      { num: 2, name: "100 IM", type: "individual" },
      { num: 3, name: "50 Freestyle", type: "individual" },
      { num: 4, name: "50 Backstroke", type: "individual" },
      { num: 5, name: "50 Butterfly", type: "individual" },
      { num: 6, name: "100 Freestyle", type: "individual" },
      { num: 7, name: "50 Breaststroke", type: "individual" },
      { num: 8, name: "100 Backstroke", type: "individual" },
      { num: 9, name: "100 Breaststroke", type: "individual" },
      { num: 10, name: "100 Butterfly", type: "individual" },
      { num: 11, name: "200 Freestyle", type: "individual" },
      { num: 12, name: "200 IM", type: "individual" },
      { num: 13, name: "500 Freestyle", type: "individual" },
      { num: 14, name: "200 Free Relay", type: "relay" },
      { num: 15, name: "200 Medley Relay", type: "relay" },
      { num: 16, name: "400 Free Relay", type: "relay" },
    ],
  },
  sprint: {
    format: "invitational",
    events: [
      { num: 1, name: "200 Free Relay", type: "relay" },
      { num: 2, name: "50 Freestyle", type: "individual" },
      { num: 3, name: "50 Backstroke", type: "individual" },
      { num: 4, name: "50 Butterfly", type: "individual" },
      { num: 5, name: "50 Breaststroke", type: "individual" },
      { num: 6, name: "100 Freestyle", type: "individual" },
      { num: 7, name: "100 IM", type: "individual" },
      { num: 8, name: "100 Backstroke", type: "individual" },
      { num: 9, name: "100 Butterfly", type: "individual" },
      { num: 10, name: "200 Medley Relay", type: "relay" },
    ],
  },
};

const placeSuffix = (p: number) => (p === 1 ? "st" : p === 2 ? "nd" : p === 3 ? "rd" : "th");

// ── Storage ──
const STORAGE_KEY = "mettle-meet-scorer";
function loadFromStorage(): MeetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function MeetScorerPage() {
  const router = useRouter();
  const [state, setState] = useState<MeetState>(() => {
    const saved = loadFromStorage();
    return saved || {
      teams: ["Home", "Visitor"],
      events: [],
      format: "dual" as ScoringFormat,
      relayMult: 2,
      customScoring: [],
      meetName: "Dual Meet",
    };
  });
  const [activeTab, setActiveTab] = useState<"scoring" | "summary" | "analysis">("scoring");
  const [newEvent, setNewEvent] = useState({ num: 1, name: "", type: "individual" as "individual" | "relay" });

  // Persist state
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // Scoring points for current format
  const scoring = useMemo(() => {
    if (state.format === "custom") return state.customScoring;
    return SCORING_FORMATS[state.format] || SCORING_FORMATS.dual;
  }, [state.format, state.customScoring]);

  // Calculate all scores
  const { scores, eventScores } = useMemo(() => {
    const scores = state.teams.map(() => 0);
    const eventScores: number[][] = [];
    state.events.forEach((ev) => {
      const es = state.teams.map(() => 0);
      const mult = ev.type === "relay" ? state.relayMult : 1;
      ev.results.forEach((r) => {
        const idx = r.place - 1;
        if (idx >= 0 && idx < scoring.length) {
          const pts = scoring[idx] * mult;
          scores[r.team] += pts;
          es[r.team] += pts;
        }
      });
      eventScores.push(es);
    });
    return { scores, eventScores };
  }, [state.events, state.teams, scoring, state.relayMult]);

  const maxScore = Math.max(...scores, 1);

  // Helpers
  const updateState = useCallback((partial: Partial<MeetState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const addTeam = () => {
    if (state.teams.length >= 5) return;
    updateState({ teams: [...state.teams, `Team ${state.teams.length + 1}`] });
  };

  const removeTeam = (idx: number) => {
    const newTeams = state.teams.filter((_, i) => i !== idx);
    const newEvents = state.events.map((ev) => ({
      ...ev,
      results: ev.results
        .filter((r) => r.team !== idx)
        .map((r) => ({ ...r, team: r.team > idx ? r.team - 1 : r.team })),
    }));
    updateState({ teams: newTeams, events: newEvents });
  };

  const addEvent = () => {
    const num = newEvent.num || state.events.length + 1;
    const name = newEvent.name.trim() || `Event ${num}`;
    const evts = [...state.events, { num, name, type: newEvent.type, results: [] }].sort((a, b) => a.num - b.num);
    updateState({ events: evts });
    setNewEvent({ num: num + 1, name: "", type: "individual" });
  };

  const removeEvent = (idx: number) => {
    updateState({ events: state.events.filter((_, i) => i !== idx) });
  };

  const addResult = (eventIdx: number, swimmer: string, team: number, place: number, time: string) => {
    if (!swimmer || isNaN(place)) return;
    const events = [...state.events];
    events[eventIdx] = {
      ...events[eventIdx],
      results: [...events[eventIdx].results, { swimmer, team, place, time }].sort((a, b) => a.place - b.place),
    };
    updateState({ events });
  };

  const removeResult = (eIdx: number, rIdx: number) => {
    const events = [...state.events];
    events[eIdx] = { ...events[eIdx], results: events[eIdx].results.filter((_, i) => i !== rIdx) };
    updateState({ events });
  };

  const loadTemplate = (key: string) => {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    updateState({
      events: tpl.events.map((e) => ({ ...e, results: [] })),
      format: tpl.format,
    });
    setNewEvent((prev) => ({ ...prev, num: tpl.events.length + 1 }));
  };

  const exportText = () => {
    let txt = `${state.meetName}\nFormat: ${state.format.toUpperCase()}\n${"=".repeat(50)}\n\nFINAL SCORES\n`;
    state.teams.forEach((t, i) => (txt += `  ${t}: ${scores[i]} pts\n`));
    txt += `\nEVENT RESULTS\n${"─".repeat(50)}\n`;
    state.events.forEach((ev) => {
      const mult = ev.type === "relay" ? state.relayMult : 1;
      txt += `\nEvent ${ev.num}: ${ev.name}${ev.type === "relay" ? " (Relay)" : ""}\n`;
      ev.results.forEach((r) => {
        const p = r.place - 1 >= 0 && r.place - 1 < scoring.length ? scoring[r.place - 1] * mult : 0;
        txt += `  ${r.place}. ${r.swimmer} (${state.teams[r.team]}) ${r.time || ""} — ${p} pts\n`;
      });
    });
    txt += `\n— Generated by METTLE Meet Scorer`;
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meet-scores-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  };

  const exportCSV = () => {
    let csv = "Event#,Event Name,Type,Place,Swimmer,Team,Time,Points\n";
    state.events.forEach((ev) => {
      const mult = ev.type === "relay" ? state.relayMult : 1;
      ev.results.forEach((r) => {
        const p = r.place - 1 >= 0 && r.place - 1 < scoring.length ? scoring[r.place - 1] * mult : 0;
        csv += `${ev.num},"${ev.name}",${ev.type},${r.place},"${r.swimmer}","${state.teams[r.team]}","${r.time || ""}",${p}\n`;
      });
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meet-scores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border-b-2 border-purple-600 px-6 py-5 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-extrabold tracking-widest"><span className="text-purple-500">METTLE</span> {'//'} Meet Scorer</h1>
        <span className="ml-auto text-slate-500 text-sm">Real-Time Swim Meet Scoring Engine</span>
      </div>

      <div className="max-w-[1200px] mx-auto p-5">
        {/* Setup Panel */}
        <div className="bg-[#12121e] border-2 border-[#2a2a40] rounded-xl p-5 mb-5 print:hidden">
          <h2 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-4">Meet Setup</h2>
          <div className="flex gap-3 flex-wrap items-end mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Meet Name</label>
              <input
                value={state.meetName}
                onChange={(e) => updateState({ meetName: e.target.value })}
                className="bg-[#1a1a2e] border border-[#2a2a40] rounded-md px-3 py-2 text-sm text-slate-200 focus:border-purple-500 outline-none w-48"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Scoring Format</label>
              <select
                value={state.format}
                onChange={(e) => updateState({ format: e.target.value as ScoringFormat })}
                className="bg-[#1a1a2e] border border-[#2a2a40] rounded-md px-3 py-2 text-sm text-slate-200 focus:border-purple-500 outline-none"
              >
                <option value="dual">Dual Meet (6-4-3-2-1)</option>
                <option value="dual5">Dual Meet 5-Lane (5-3-1)</option>
                <option value="champ">Championship (20-17-16-15-14-13-12-11)</option>
                <option value="invitational">Invitational (16-13-12-11-10-9-8-7)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {state.format === "custom" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Custom Points</label>
                <input
                  placeholder="6,4,3,2,1"
                  onChange={(e) => updateState({ customScoring: e.target.value.split(",").map(Number).filter((n) => n > 0) })}
                  className="bg-[#1a1a2e] border border-[#2a2a40] rounded-md px-3 py-2 text-sm text-slate-200 focus:border-purple-500 outline-none w-40"
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Relay Multiplier</label>
              <select
                value={state.relayMult}
                onChange={(e) => updateState({ relayMult: parseFloat(e.target.value) })}
                className="bg-[#1a1a2e] border border-[#2a2a40] rounded-md px-3 py-2 text-sm text-slate-200 focus:border-purple-500 outline-none"
              >
                <option value={2}>2x (Standard)</option>
                <option value={1}>1x (No multiplier)</option>
                <option value={1.5}>1.5x</option>
              </select>
            </div>
          </div>

          {/* Team Inputs */}
          <div className="flex gap-3 flex-wrap items-end mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Teams</label>
              <div className="flex gap-2 flex-wrap">
                {state.teams.map((t, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: TEAM_COLORS[i % 5] }} />
                    <input
                      value={t}
                      onChange={(e) => {
                        const teams = [...state.teams];
                        teams[i] = e.target.value;
                        updateState({ teams });
                      }}
                      className="bg-[#1a1a2e] border border-[#2a2a40] rounded-md px-2 py-1.5 text-sm text-slate-200 w-28 focus:border-purple-500 outline-none"
                    />
                    {state.teams.length > 2 && (
                      <button onClick={() => removeTeam(i)} className="text-red-500 hover:text-red-400 text-xs font-bold border border-red-600 rounded px-1">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={addTeam} className="border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-[#0a0a12] rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider">+ Add Team</button>
          </div>

          {/* Templates */}
          <h2 className="text-sm font-bold text-purple-500 uppercase tracking-wider mt-4 mb-3">Quick Templates</h2>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "dualHS", label: "HS Dual Meet (11 events)" },
              { key: "champHS", label: "HS Championship (12 events)" },
              { key: "dualAge", label: "Age Group Dual (16 events)" },
              { key: "sprint", label: "Sprint Invitational (10 events)" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => loadTemplate(t.key)}
                className="bg-[#1a1a2e] border border-[#2a2a40] hover:border-purple-500 hover:text-purple-400 rounded-md px-3 py-1.5 text-xs text-slate-200 transition"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-5 border-b-2 border-[#2a2a40] print:hidden">
          {(["scoring", "summary", "analysis"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 font-bold text-xs uppercase tracking-widest border-b-2 -mb-[2px] transition ${
                activeTab === tab ? "text-purple-500 border-purple-500" : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              {tab === "scoring" ? "Live Scoring" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── LIVE SCORING TAB ── */}
        {activeTab === "scoring" && (
          <>
            {/* Score Cards */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {state.teams.map((t, i) => {
                const isLead = scores[i] === Math.max(...scores) && scores[i] > 0;
                return (
                  <div key={i} className={`bg-[#12121e] border-2 rounded-xl p-4 ${isLead ? "border-amber-500" : "border-[#2a2a40]"}`}>
                    <h3 className="text-base font-bold flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ background: TEAM_COLORS[i % 5] }} />
                      {t}{isLead && " 👑"}
                    </h3>
                    <div className={`text-4xl font-black tabular-nums ${isLead ? "text-amber-500" : ""}`}>{scores[i]}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Total Points</div>
                    <div className="h-1.5 rounded-full mt-2 transition-all" style={{ width: `${(scores[i] / maxScore) * 100}%`, background: TEAM_COLORS[i % 5] }} />
                  </div>
                );
              })}
            </div>

            {/* Add Event */}
            <div className="bg-[#12121e] border-2 border-[#2a2a40] rounded-xl p-4 mb-4 print:hidden">
              <h2 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-3">Add Event</h2>
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase">Event #</label>
                  <input type="number" value={newEvent.num} onChange={(e) => setNewEvent((p) => ({ ...p, num: parseInt(e.target.value) || 1 }))} className="bg-[#1a1a2e] border border-[#2a2a40] rounded-md px-2 py-1.5 text-sm text-slate-200 w-16 focus:border-purple-500 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase">Event Name</label>
                  <input value={newEvent.name} onChange={(e) => setNewEvent((p) => ({ ...p, name: e.target.value }))} placeholder="200 Free" className="bg-[#1a1a2e] border border-[#2a2a40] rounded-md px-2 py-1.5 text-sm text-slate-200 w-44 focus:border-purple-500 outline-none" onKeyDown={(e) => e.key === "Enter" && addEvent()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase">Type</label>
                  <select value={newEvent.type} onChange={(e) => setNewEvent((p) => ({ ...p, type: e.target.value as "individual" | "relay" }))} className="bg-[#1a1a2e] border border-[#2a2a40] rounded-md px-2 py-1.5 text-sm text-slate-200 focus:border-purple-500 outline-none">
                    <option value="individual">Individual</option>
                    <option value="relay">Relay</option>
                  </select>
                </div>
                <button onClick={addEvent} className="bg-purple-600 hover:bg-purple-700 text-white border-2 border-purple-600 rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider"><Plus size={14} className="inline -mt-0.5" /> Add</button>
              </div>
            </div>

            {/* Events List */}
            {state.events.length === 0 ? (
              <div className="text-center text-slate-500 py-10">No events yet. Add events above or use a quick template.</div>
            ) : (
              state.events.map((ev, eIdx) => (
                <EventCard
                  key={`${ev.num}-${eIdx}`}
                  event={ev}
                  eIdx={eIdx}
                  teams={state.teams}
                  scoring={scoring}
                  relayMult={state.relayMult}
                  onAddResult={addResult}
                  onRemoveResult={removeResult}
                  onRemoveEvent={removeEvent}
                />
              ))
            )}
          </>
        )}

        {/* ── SUMMARY TAB ── */}
        {activeTab === "summary" && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {state.teams.map((t, i) => {
                const isLead = scores[i] === Math.max(...scores) && scores[i] > 0;
                const eventWins = eventScores.filter((es) => es[i] === Math.max(...es) && es[i] > 0).length;
                return (
                  <div key={i} className={`bg-[#12121e] border-2 rounded-xl p-4 ${isLead ? "border-amber-500" : "border-[#2a2a40]"}`}>
                    <h3 className="text-base font-bold flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ background: TEAM_COLORS[i % 5] }} />{t}
                    </h3>
                    <div className={`text-4xl font-black tabular-nums ${isLead ? "text-amber-500" : ""}`}>{scores[i]}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Total Points</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#1a1a2e] border border-[#2a2a40] rounded-lg p-2 text-center">
                        <div className="text-xl font-extrabold tabular-nums">{eventWins}</div>
                        <div className="text-[9px] text-slate-500 uppercase mt-0.5">Event Wins</div>
                      </div>
                      <div className="bg-[#1a1a2e] border border-[#2a2a40] rounded-lg p-2 text-center">
                        <div className="text-xl font-extrabold tabular-nums">{scores[i] > 0 ? (scores[i] / state.events.length).toFixed(1) : "0"}</div>
                        <div className="text-[9px] text-slate-500 uppercase mt-0.5">Pts/Event</div>
                      </div>
                      <div className="bg-[#1a1a2e] border border-[#2a2a40] rounded-lg p-2 text-center">
                        <div className="text-xl font-extrabold tabular-nums">{maxScore > 0 ? `${((scores[i] / maxScore) * 100).toFixed(0)}%` : "—"}</div>
                        <div className="text-[9px] text-slate-500 uppercase mt-0.5">Score %</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Event-by-Event Table */}
            {state.events.length > 0 && (
              <div className="bg-[#12121e] border-2 border-[#2a2a40] rounded-xl p-4 mb-4">
                <h2 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-3">Event-by-Event Breakdown</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-2 text-[10px] text-slate-500 uppercase border-b-2 border-[#2a2a40]">#</th>
                        <th className="text-left px-2 py-2 text-[10px] text-slate-500 uppercase border-b-2 border-[#2a2a40]">Event</th>
                        {state.teams.map((tm, ti) => (
                          <th key={ti} className="text-left px-2 py-2 text-[10px] text-slate-500 uppercase border-b-2 border-[#2a2a40]">
                            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: TEAM_COLORS[ti % 5] }} />{tm}
                          </th>
                        ))}
                        <th className="text-left px-2 py-2 text-[10px] text-slate-500 uppercase border-b-2 border-[#2a2a40]">Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const running = state.teams.map(() => 0);
                        return state.events.map((ev, eIdx) => {
                          const es = eventScores[eIdx];
                          state.teams.forEach((_, ti) => (running[ti] += es[ti]));
                          const maxES = Math.max(...es);
                          const winner = maxES > 0 ? state.teams[es.indexOf(maxES)] : "—";
                          return (
                            <tr key={eIdx} className="hover:bg-purple-500/5">
                              <td className="px-2 py-1.5 text-sm border-b border-[#2a2a40]">{ev.num}</td>
                              <td className="px-2 py-1.5 text-sm border-b border-[#2a2a40]">{ev.name}{ev.type === "relay" ? " ®" : ""}</td>
                              {state.teams.map((_, ti) => (
                                <td key={ti} className="px-2 py-1.5 text-sm border-b border-[#2a2a40]" style={{ fontWeight: es[ti] === maxES && maxES > 0 ? 700 : 400, color: es[ti] === maxES && maxES > 0 ? TEAM_COLORS[ti % 5] : undefined }}>
                                  {es[ti]} <span className="text-slate-500 text-[10px]">({running[ti]})</span>
                                </td>
                              ))}
                              <td className="px-2 py-1.5 text-sm font-bold border-b border-[#2a2a40]">{winner}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Export */}
            <div className="flex gap-2 justify-end print:hidden">
              <button onClick={exportText} className="border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-[#0a0a12] rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider"><Download size={14} className="inline -mt-0.5 mr-1" />Text</button>
              <button onClick={exportCSV} className="border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-[#0a0a12] rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider"><Download size={14} className="inline -mt-0.5 mr-1" />CSV</button>
            </div>
          </>
        )}

        {/* ── ANALYSIS TAB ── */}
        {activeTab === "analysis" && (
          <AnalysisView teams={state.teams} events={state.events} scores={scores} eventScores={eventScores} scoring={scoring} />
        )}
      </div>

      {/* Print Button */}
      <button onClick={() => window.print()} className="fixed bottom-5 right-5 z-50 bg-purple-600 hover:bg-purple-700 text-white border-2 border-purple-600 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider print:hidden">
        <Printer size={14} className="inline -mt-0.5 mr-1" />Print
      </button>
    </div>
  );
}

/* ── Event Card Component ── */
function EventCard({
  event, eIdx, teams, scoring, relayMult, onAddResult, onRemoveResult, onRemoveEvent,
}: {
  event: MeetEvent; eIdx: number; teams: string[]; scoring: number[]; relayMult: number;
  onAddResult: (eIdx: number, swimmer: string, team: number, place: number, time: string) => void;
  onRemoveResult: (eIdx: number, rIdx: number) => void;
  onRemoveEvent: (idx: number) => void;
}) {
  const [swimmer, setSwimmer] = useState("");
  const [team, setTeam] = useState(0);
  const [place, setPlace] = useState(event.results.length + 1);
  const [time, setTime] = useState("");
  const mult = event.type === "relay" ? relayMult : 1;

  const handleAdd = () => {
    onAddResult(eIdx, swimmer, team, place, time);
    setSwimmer("");
    setTime("");
    setPlace(event.results.length + 2);
  };

  return (
    <div className="bg-[#12121e] border-2 border-[#2a2a40] rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between border-b-2 border-purple-600 pb-3 mb-2">
        <h3 className="text-sm font-bold text-purple-500">
          Event {event.num}: {event.name}{" "}
          {event.type === "relay" && <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-500 border border-amber-500 ml-1">Relay ×{mult}</span>}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">{event.results.length} result{event.results.length !== 1 ? "s" : ""}</span>
          <button onClick={() => onRemoveEvent(eIdx)} className="text-red-500 hover:text-red-400 text-xs font-bold border border-red-600 rounded px-2 py-0.5 print:hidden">Remove</button>
        </div>
      </div>

      {event.results.length > 0 && (
        <table className="w-full border-collapse mb-2">
          <thead>
            <tr>
              {["Place", "Swimmer", "Team", "Time", "Points", ""].map((h) => (
                <th key={h} className="text-left px-2 py-1.5 text-[10px] text-slate-500 uppercase border-b-2 border-[#2a2a40]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {event.results.map((r, rIdx) => {
              const pts = r.place - 1 >= 0 && r.place - 1 < scoring.length ? scoring[r.place - 1] * mult : 0;
              return (
                <tr key={rIdx} className="hover:bg-purple-500/5">
                  <td className={`px-2 py-1 text-sm border-b border-[#2a2a40] font-bold ${r.place === 1 ? "text-amber-500" : r.place === 2 ? "text-slate-400" : r.place === 3 ? "text-amber-700" : ""}`}>
                    {r.place}{placeSuffix(r.place)}
                  </td>
                  <td className="px-2 py-1 text-sm border-b border-[#2a2a40]">{r.swimmer}</td>
                  <td className="px-2 py-1 text-sm border-b border-[#2a2a40]">
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: TEAM_COLORS[r.team % 5] }} />
                    {teams[r.team] || "?"}
                  </td>
                  <td className="px-2 py-1 text-sm border-b border-[#2a2a40]">{r.time || "—"}</td>
                  <td className="px-2 py-1 text-sm border-b border-[#2a2a40] font-bold" style={{ color: TEAM_COLORS[r.team % 5] }}>{pts}</td>
                  <td className="px-2 py-1 text-sm border-b border-[#2a2a40] print:hidden">
                    <button onClick={() => onRemoveResult(eIdx, rIdx)} className="text-red-500 hover:text-red-400 text-xs">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Inline Add Result Form */}
      <div className="bg-[#1a1a2e] border-2 border-dashed border-[#2a2a40] rounded-lg p-3 print:hidden">
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] text-slate-500 uppercase">Swimmer</label>
            <input value={swimmer} onChange={(e) => setSwimmer(e.target.value)} placeholder="Name" onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="bg-[#0a0a12] border border-[#2a2a40] rounded px-2 py-1 text-xs text-slate-200 w-32 focus:border-purple-500 outline-none" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] text-slate-500 uppercase">Team</label>
            <select value={team} onChange={(e) => setTeam(parseInt(e.target.value))} className="bg-[#0a0a12] border border-[#2a2a40] rounded px-2 py-1 text-xs text-slate-200 focus:border-purple-500 outline-none">
              {teams.map((t, ti) => <option key={ti} value={ti}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] text-slate-500 uppercase">Place</label>
            <input type="number" value={place} onChange={(e) => setPlace(parseInt(e.target.value) || 1)} min={1} className="bg-[#0a0a12] border border-[#2a2a40] rounded px-2 py-1 text-xs text-slate-200 w-14 focus:border-purple-500 outline-none" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] text-slate-500 uppercase">Time</label>
            <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="1:52.34" onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="bg-[#0a0a12] border border-[#2a2a40] rounded px-2 py-1 text-xs text-slate-200 w-24 focus:border-purple-500 outline-none" />
          </div>
          <button onClick={handleAdd} className="bg-purple-600 hover:bg-purple-700 text-white rounded px-3 py-1 text-xs font-bold uppercase">Add</button>
        </div>
      </div>
    </div>
  );
}

/* ── Analysis View Component ── */
function AnalysisView({ teams, events, scores, eventScores, scoring }: {
  teams: string[]; events: MeetEvent[]; scores: number[]; eventScores: number[][]; scoring: number[];
}) {
  // Running score progression
  const running = useMemo(() => {
    const r: number[][] = teams.map(() => []);
    const cum = teams.map(() => 0);
    events.forEach((_, eIdx) => {
      teams.forEach((_, ti) => {
        cum[ti] += eventScores[eIdx][ti];
        r[ti].push(cum[ti]);
      });
    });
    return r;
  }, [teams, events, eventScores]);

  const maxRun = Math.max(...running.map((r) => Math.max(...r)), 1);

  // Momentum
  const momentum = useMemo(() => {
    return teams.map((t, ti) => {
      let streakW = 0, streakL = 0, bestStretch = 0, curStretch = 0;
      eventScores.forEach((es) => {
        const mx = Math.max(...es);
        if (es[ti] === mx && mx > 0) { streakW++; curStretch++; bestStretch = Math.max(bestStretch, curStretch); streakL = 0; }
        else { streakL++; curStretch = 0; }
      });
      return { name: t, streakW, streakL, bestStretch, label: streakW > streakL ? "Hot" : streakL > streakW ? "Cold" : "Neutral" };
    });
  }, [teams, eventScores]);

  if (events.length < 2) return <div className="text-center text-slate-500 py-10">Need at least 2 scored events for analysis.</div>;

  // Win conditions
  const sorted = [...teams.map((t, i) => ({ name: t, score: scores[i], idx: i }))].sort((a, b) => b.score - a.score);
  const unscoredEvents = events.filter((e) => e.results.length === 0).length;
  const maxPtsPerEvent = scoring[0] || 0;

  return (
    <>
      {/* Running Score Progression */}
      <div className="bg-[#12121e] border-2 border-[#2a2a40] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-3">Running Score Progression</h2>
        <div className="flex gap-3 flex-wrap mb-3">
          {teams.map((t, i) => (
            <span key={i} className="text-xs" style={{ color: TEAM_COLORS[i % 5] }}>● {t}: {running[i][running[i].length - 1]} pts</span>
          ))}
        </div>
        <div className="flex gap-0.5 items-end h-24 bg-[#1a1a2e] rounded-lg p-2">
          {events.map((ev, eIdx) => (
            <div key={eIdx} className="flex-1 flex flex-col gap-px items-center justify-end h-full">
              {teams.map((_, ti) => (
                <div
                  key={ti}
                  className="rounded-t-sm"
                  style={{
                    width: `${Math.max(100 / teams.length - 5, 8)}%`,
                    height: `${(running[ti][eIdx] / maxRun) * 80}px`,
                    background: TEAM_COLORS[ti % 5],
                    opacity: 0.85,
                  }}
                />
              ))}
              <div className="text-[8px] text-slate-500 mt-0.5">E{ev.num}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Momentum */}
      <div className="bg-[#12121e] border-2 border-[#2a2a40] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-3">Momentum Analysis</h2>
        {momentum.map((m, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-[#2a2a40] last:border-0">
            <span className="w-3 h-3 rounded-full" style={{ background: TEAM_COLORS[i % 5] }} />
            <strong className="text-sm">{m.name}</strong>
            <span className="text-sm">{m.label === "Hot" ? <Flame size={16} className="inline text-orange-500" /> : m.label === "Cold" ? <Snowflake size={16} className="inline text-blue-400" /> : <ArrowRight size={16} className="inline text-slate-400" />} {m.label}</span>
            <span className="text-slate-500 text-xs">Best streak: {m.bestStretch} events</span>
          </div>
        ))}
      </div>

      {/* Projection */}
      {unscoredEvents > 0 && events.some((e) => e.results.length > 0) && (
        <div className="bg-[#12121e] border-2 border-[#2a2a40] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-3">Projection ({unscoredEvents} Events Remaining)</h2>
          {teams.map((t, i) => {
            const scored = events.filter((e) => e.results.length > 0).length;
            const avg = scored > 0 ? scores[i] / scored : 0;
            const projected = scores[i] + avg * unscoredEvents;
            return (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#2a2a40] last:border-0">
                <span className="w-3 h-3 rounded-full" style={{ background: TEAM_COLORS[i % 5] }} />
                <strong className="text-sm">{t}</strong>
                <span className="text-sm">Current: {scores[i]} → Projected: <strong>{projected.toFixed(0)}</strong></span>
                <span className="text-slate-500 text-xs">({avg.toFixed(1)} avg/event × {unscoredEvents} remaining)</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Win Conditions */}
      {sorted.length >= 2 && sorted[0].score > 0 && (
        <div className="bg-[#12121e] border-2 border-[#2a2a40] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-3">Win Conditions</h2>
          <div className="bg-[#1a1a2e] rounded-lg p-3">
            <div className="font-bold mb-1">{sorted[0].name} leads by {sorted[0].score - sorted[1].score} points</div>
            {unscoredEvents > 0 ? (
              <div className={sorted[0].score - sorted[1].score <= maxPtsPerEvent * unscoredEvents ? "text-amber-500" : "text-green-500"}>
                {sorted[0].score - sorted[1].score <= maxPtsPerEvent * unscoredEvents
                  ? `⚡ ${sorted[1].name} can still overtake with ${unscoredEvents} events remaining`
                  : `✅ ${sorted[0].name} has clinched — ${sorted[1].name} cannot catch up`}
              </div>
            ) : (
              <div className="text-green-500">✅ Meet complete — {sorted[0].name} wins {sorted[0].score}-{sorted[1].score}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
