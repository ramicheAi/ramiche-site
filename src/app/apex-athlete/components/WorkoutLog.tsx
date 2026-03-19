"use client";

import { useState, useEffect, useMemo } from "react";

/* ══════════════════════════════════════════════════════════════
   WORKOUT LOG — Practice logging for athletes
   Extracted from YOLO build: 2026-03-18-mettle-workout-log
   Features: Set types, RPE, focus areas, XP, streak, history,
   weekly stats, goals — all persisted to localStorage
   ══════════════════════════════════════════════════════════════ */

interface WorkoutEntry {
  id: number;
  date: string;
  yards: number;
  duration: number;
  rpe: number;
  types: string[];
  focus: string[];
  notes: string;
  xpEarned: number;
}

interface WorkoutState {
  logs: WorkoutEntry[];
  streak: number;
  bestStreak: number;
  totalXP: number;
}

const STORAGE_KEY = "mettle_workout_log";

const SET_TYPES = ["Warmup", "Main Set", "Kick", "Drill", "Sprint", "Pull", "IM", "Cooldown"];
const FOCUS_AREAS = ["Freestyle", "Backstroke", "Breast", "Fly", "Turns", "Starts", "Underwaters", "Endurance", "Speed", "Technique"];

const RPE_LABELS: Record<number, string> = {
  1: "Very Light", 2: "Light", 3: "Light-Moderate", 4: "Moderate-Light",
  5: "Moderate", 6: "Moderate-Hard", 7: "Hard", 8: "Very Hard",
  9: "Near Max", 10: "All Out",
};
const RPE_COLORS: Record<number, string> = {
  1: "#22C55E", 2: "#4ADE80", 3: "#86EFAC", 4: "#FDE68A",
  5: "#F5A623", 6: "#FB923C", 7: "#F97316", 8: "#EF4444",
  9: "#DC2626", 10: "#B91C1C",
};

function dateKey(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = dateKey(new Date());
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return days[dt.getDay()] + ", " + months[dt.getMonth()] + " " + d;
}

function loadState(): WorkoutState {
  if (typeof window === "undefined") return { logs: [], streak: 0, bestStreak: 0, totalXP: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { logs: [], streak: 0, bestStreak: 0, totalXP: 0 };
}

function calcStreak(logs: WorkoutEntry[]): { streak: number; bestStreak: number } {
  const dates = [...new Set(logs.map((l) => l.date))].sort().reverse();
  if (dates.length === 0) return { streak: 0, bestStreak: 0 };
  let streak = 0;
  const check = new Date();
  if (dates[0] !== dateKey(check)) {
    check.setDate(check.getDate() - 1);
    if (dates[0] !== dateKey(check)) return { streak: 0, bestStreak: 0 };
  }
  for (let i = 0; i < 365; i++) {
    if (dates.includes(dateKey(check))) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else break;
  }
  // Calculate best streak across all dates
  let best = 0;
  let current = 1;
  const sorted = [...dates].sort();
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) current++;
    else current = 1;
    if (current > best) best = current;
  }
  if (dates.length === 1) best = 1;
  return { streak, bestStreak: Math.max(best, streak) };
}

function calcXP(entry: Omit<WorkoutEntry, "id" | "date" | "xpEarned">, streak: number): number {
  let xp = 25;
  if (entry.rpe >= 8) xp += 10;
  if (entry.yards >= 5000) xp += 15;
  if (entry.types.length >= 4) xp += 5;
  if (streak >= 7) xp += 50;
  else if (streak >= 5) xp += 25;
  else if (streak >= 3) xp += 10;
  return xp;
}

type SubTab = "log" | "history" | "stats" | "goals";

interface WorkoutLogProps {
  athleteName?: string;
}

export default function WorkoutLog({ athleteName }: WorkoutLogProps) {
  const [state, setState] = useState<WorkoutState>({ logs: [], streak: 0, bestStreak: 0, totalXP: 0 });
  const [subTab, setSubTab] = useState<SubTab>("log");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [yards, setYards] = useState("");
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState(5);
  const [notes, setNotes] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastXP, setToastXP] = useState(0);
  const [toastBonuses, setToastBonuses] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  function save(newState: WorkoutState) {
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }

  function handleSubmit() {
    const y = parseInt(yards) || 0;
    const d = parseInt(duration) || 0;
    if (y === 0 && d === 0) return;

    const entry = { yards: y, duration: d, rpe, types: selectedTypes, focus: selectedFocus, notes };
    const xp = calcXP(entry, state.streak);
    const newLog: WorkoutEntry = { ...entry, id: Date.now(), date: dateKey(new Date()), xpEarned: xp };
    const newLogs = [...state.logs, newLog];
    const { streak, bestStreak } = calcStreak(newLogs);
    const newState: WorkoutState = { logs: newLogs, streak, bestStreak: Math.max(state.bestStreak, bestStreak), totalXP: state.totalXP + xp };
    save(newState);

    // Show toast
    const bonuses: string[] = [];
    if (rpe >= 8) bonuses.push("+10 Hard Effort");
    if (y >= 5000) bonuses.push("+15 Big Volume");
    if (selectedTypes.length >= 4) bonuses.push("+5 Variety");
    if (streak >= 3) bonuses.push(`+${streak >= 7 ? 50 : streak >= 5 ? 25 : 10} Streak`);
    setToastXP(xp);
    setToastBonuses(bonuses);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);

    // Reset form
    setYards(""); setDuration(""); setRpe(5); setNotes(""); setSelectedTypes([]); setSelectedFocus([]);
  }

  function handleDelete(id: number) {
    const idx = state.logs.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const removed = state.logs[idx];
    const newLogs = state.logs.filter((l) => l.id !== id);
    const { streak, bestStreak } = calcStreak(newLogs);
    save({ logs: newLogs, streak, bestStreak, totalXP: Math.max(0, state.totalXP - removed.xpEarned) });
    setDeleteTarget(null);
  }

  const previewXP = useMemo(() => {
    const y = parseInt(yards) || 0;
    return calcXP({ yards: y, duration: parseInt(duration) || 0, rpe, types: selectedTypes, focus: selectedFocus, notes }, state.streak);
  }, [yards, duration, rpe, selectedTypes, selectedFocus, notes, state.streak]);

  // Weekly stats
  const weekData = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let maxY = 1;
    const days = labels.map((label, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = dateKey(d);
      const dayYards = state.logs.filter((l) => l.date === key).reduce((s, l) => s + l.yards, 0);
      if (dayYards > maxY) maxY = dayYards;
      return { label, yards: dayYards, isToday: i === dayOfWeek };
    });
    return { days, maxYards: maxY, weekTotal: days.reduce((s, d) => s + d.yards, 0) };
  }, [state.logs]);

  const focusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    state.logs.forEach((l) => l.focus.forEach((f) => { counts[f] = (counts[f] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [state.logs]);

  const avgRPE = useMemo(() => {
    const valid = state.logs.filter((l) => l.rpe > 0);
    return valid.length > 0 ? (valid.reduce((s, l) => s + l.rpe, 0) / valid.length).toFixed(1) : "—";
  }, [state.logs]);

  const weekYards = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    return state.logs.filter((l) => {
      const [y, m, d] = l.date.split("-").map(Number);
      return new Date(y, m - 1, d) >= weekStart;
    }).reduce((s, l) => s + l.yards, 0);
  }, [state.logs]);

  const subtabs: { key: SubTab; label: string }[] = [
    { key: "log", label: "Log" },
    { key: "history", label: "History" },
    { key: "stats", label: "Stats" },
    { key: "goals", label: "Goals" },
  ];

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="rounded-2xl border-2 border-[#6C2BD9]/30 bg-gradient-to-br from-[#6C2BD9]/20 to-[#4A1FA0]/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-extrabold tracking-wider text-white">
            WORKOUT <span className="text-[#F5A623]">LOG</span>
          </h2>
          {athleteName && <span className="text-xs font-semibold bg-white/10 rounded-full px-3 py-1">{athleteName}</span>}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-lg">🔥</span>
          <span className="text-[#F5A623] font-bold text-base">{state.streak}</span>
          <span className="text-white/60">day streak</span>
          <span className="ml-auto bg-[#F5A623]/20 border border-[#F5A623] rounded-xl px-3 py-0.5 text-xs text-[#F5A623] font-semibold">
            {state.totalXP.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="grid grid-cols-4 gap-2">
        {subtabs.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              subTab === t.key
                ? "bg-[#F5A623]/20 text-[#F5A623] border-2 border-[#F5A623]/40"
                : "text-white/40 hover:text-white/60 bg-white/[0.04] border border-white/[0.06]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LOG TAB ── */}
      {subTab === "log" && (
        <div className="rounded-2xl border-2 border-white/[0.06] bg-[#161625] p-5 space-y-5">
          {/* Date */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1 block">Date</label>
            <div className="text-sm font-semibold bg-[#1E1E30] border border-white/[0.06] rounded-xl px-3 py-2.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>

          {/* Set Types */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Set Types</label>
            <div className="flex flex-wrap gap-2">
              {SET_TYPES.map((t) => (
                <button key={t} onClick={() => setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                    selectedTypes.includes(t)
                      ? "border-[#6C2BD9] bg-[#6C2BD9]/20 text-white"
                      : "border-white/[0.06] bg-[#1E1E30] text-white/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Volume */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Volume</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input type="number" value={yards} onChange={(e) => setYards(e.target.value)} placeholder="0"
                  className="w-full bg-[#1E1E30] border-2 border-white/[0.06] rounded-xl px-3 py-3 text-center text-lg font-bold text-white focus:border-[#6C2BD9] outline-none"
                />
                <p className="text-[10px] text-white/30 text-center mt-1">yards</p>
              </div>
              <div>
                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="0"
                  className="w-full bg-[#1E1E30] border-2 border-white/[0.06] rounded-xl px-3 py-3 text-center text-lg font-bold text-white focus:border-[#6C2BD9] outline-none"
                />
                <p className="text-[10px] text-white/30 text-center mt-1">minutes</p>
              </div>
            </div>
          </div>

          {/* RPE */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Effort (RPE)</label>
            <div className="text-center">
              <div className="text-5xl font-extrabold" style={{ color: RPE_COLORS[rpe] }}>{rpe}</div>
              <div className="text-sm font-semibold text-white/60 mb-3">{RPE_LABELS[rpe]}</div>
              <input type="range" min="1" max="10" value={rpe} onChange={(e) => setRpe(parseInt(e.target.value))}
                className="w-full accent-[#6C2BD9]"
              />
            </div>
          </div>

          {/* Focus Areas */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Focus Areas</label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREAS.map((f) => (
                <button key={f} onClick={() => setSelectedFocus((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    selectedFocus.includes(f)
                      ? "border-[#1E90FF] bg-[#1E90FF]/15 text-[#1E90FF]"
                      : "border-white/[0.06] bg-[#1E1E30] text-white/40"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel?"
              className="w-full bg-[#1E1E30] border-2 border-white/[0.06] rounded-xl px-3 py-3 text-sm text-white focus:border-[#6C2BD9] outline-none resize-y min-h-[80px]"
            />
          </div>

          {/* Submit */}
          <button onClick={handleSubmit}
            className="w-full py-4 bg-gradient-to-r from-[#6C2BD9] to-[#E63946] rounded-xl text-white font-bold tracking-wide text-base hover:shadow-[0_4px_20px_rgba(108,43,217,0.4)] active:scale-[0.97] transition-all"
          >
            LOG WORKOUT → +{previewXP} XP
          </button>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {subTab === "history" && (
        <div className="space-y-3">
          {state.logs.length === 0 ? (
            <div className="text-center py-10 text-white/40">
              <div className="text-5xl mb-3">📝</div>
              <p className="text-sm">No workouts yet. Log your first one!</p>
            </div>
          ) : (
            [...state.logs].sort((a, b) => b.id - a.id).map((l) => (
              <div key={l.id} className="rounded-2xl border-2 border-white/[0.06] bg-[#161625] p-4 hover:border-[#6C2BD9]/40 transition-all"
                onContextMenu={(e) => { e.preventDefault(); setDeleteTarget(l.id); }}
              >
                <div className="text-xs text-white/40 font-semibold">{formatDate(l.date)}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xl font-extrabold">
                    {l.yards.toLocaleString()} <span className="text-xs text-white/40 font-normal">yds</span>
                    {" · "}{l.duration} <span className="text-xs text-white/40 font-normal">min</span>
                  </div>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm"
                    style={{ background: RPE_COLORS[l.rpe] + "20", color: RPE_COLORS[l.rpe] }}
                  >
                    {l.rpe}
                  </div>
                </div>
                {l.types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {l.types.map((t) => (
                      <span key={t} className="bg-[#6C2BD9]/20 text-[#6C2BD9] px-2 py-0.5 rounded-lg text-[10px] font-semibold">{t}</span>
                    ))}
                  </div>
                )}
                {l.focus.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {l.focus.map((f) => (
                      <span key={f} className="bg-white/[0.04] text-white/40 px-2 py-0.5 rounded-lg text-[10px]">{f}</span>
                    ))}
                  </div>
                )}
                {l.notes && <p className="text-xs text-white/40 mt-2 italic leading-relaxed">&ldquo;{l.notes}&rdquo;</p>}
                <div className="text-xs text-[#F5A623] font-bold mt-1.5">+{l.xpEarned} XP</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── STATS TAB ── */}
      {subTab === "stats" && (
        <div className="space-y-4">
          {/* Weekly chart */}
          <div className="rounded-2xl border-2 border-white/[0.06] bg-[#161625] p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">This Week</h3>
            <div className="flex items-end justify-between h-[140px] gap-1">
              {weekData.days.map((d) => {
                const pct = d.yards > 0 ? Math.max(3, (d.yards / weekData.maxYards) * 100) : 3;
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div className="text-[9px] text-white/30 mb-1">
                      {d.yards > 0 ? (d.yards / 1000).toFixed(1) + "k" : ""}
                    </div>
                    <div className="w-full max-w-[36px] rounded-t-md"
                      style={{
                        height: `${pct}%`,
                        background: d.isToday
                          ? "linear-gradient(180deg, #F5A623, #E63946)"
                          : "linear-gradient(180deg, #6C2BD9, #1E90FF)",
                      }}
                    />
                    <div className={`text-[10px] font-semibold mt-1.5 ${d.isToday ? "text-[#F5A623]" : "text-white/30"}`}>
                      {d.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: weekData.weekTotal > 0 ? (weekData.weekTotal / 1000).toFixed(1) + "k" : "0", label: "This Week (yds)" },
              { val: avgRPE, label: "Avg RPE" },
              { val: String(state.logs.length), label: "Total Logs" },
              { val: String(state.bestStreak), label: "Best Streak" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-[#1E1E30] p-3 text-center">
                <div className="text-2xl font-extrabold">{s.val}</div>
                <div className="text-[10px] text-white/30 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Top focus */}
          <div className="rounded-2xl border-2 border-white/[0.06] bg-[#161625] p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Top Focus Areas</h3>
            {focusCounts.length > 0 ? (
              <div className="space-y-2">
                {focusCounts.map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="w-20 text-xs font-semibold">{name}</span>
                    <div className="flex-1 h-1.5 bg-[#1E1E30] rounded-full overflow-hidden">
                      <div className="h-full bg-[#1E90FF] rounded-full" style={{ width: `${(count / focusCounts[0][1]) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-white/30">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/30 text-center py-4">Log workouts to see your focus breakdown</p>
            )}
          </div>
        </div>
      )}

      {/* ── GOALS TAB ── */}
      {subTab === "goals" && (
        <div className="space-y-3">
          {[
            { title: "Weekly Volume: 20,000 yds", target: 20000, current: weekYards, color: "#6C2BD9", xp: 100 },
            { title: "5-Day Streak", target: 5, current: state.streak, color: "#E63946", xp: 75 },
            { title: "Log 20 Workouts", target: 20, current: state.logs.length, color: "#1E90FF", xp: 200 },
            { title: "RPE 8+ Workout", target: 1, current: state.logs.filter((l) => l.rpe >= 8).length > 0 ? 1 : 0, color: "#F5A623", xp: 30 },
            { title: "Hit 500 Total XP", target: 500, current: state.totalXP, color: "#22C55E", xp: 50 },
          ].map((g) => {
            const pct = Math.min(100, (g.current / g.target) * 100);
            const done = pct >= 100;
            return (
              <div key={g.title} className="rounded-2xl border-2 border-white/[0.06] bg-[#161625] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">{g.title}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    done ? "border-[#F5A623] bg-[#F5A623]/15 text-[#F5A623]" : "border-[#22C55E] bg-[#22C55E]/15 text-[#22C55E]"
                  }`}>
                    {done ? "Complete!" : Math.round(pct) + "%"}
                  </span>
                </div>
                <div className="h-2 bg-[#1E1E30] rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                </div>
                <div className="flex justify-between text-[10px] text-white/30">
                  <span>{g.current.toLocaleString()} / {g.target.toLocaleString()}</span>
                  <span className="text-[#F5A623] font-semibold">+{g.xp} XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* XP Toast */}
      {showToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-[#161625] border-[3px] border-[#F5A623] rounded-2xl px-12 py-8 text-center animate-bounce">
            <div className="text-5xl font-extrabold text-[#F5A623]">+{toastXP} XP</div>
            <div className="text-sm text-white/40 mt-1">Workout Logged!</div>
            {toastBonuses.length > 0 && (
              <div className="text-xs text-[#22C55E] font-semibold mt-2">{toastBonuses.join(" · ")}</div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget !== null && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed bottom-0 left-0 right-0 bg-[#161625] border-t-2 border-[#E63946] rounded-t-2xl p-6 z-50">
            <h3 className="text-base font-bold">Delete this workout?</h3>
            <p className="text-xs text-white/40 mt-1 mb-4">This action cannot be undone. XP will be removed.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="py-3 bg-[#1E1E30] text-white rounded-xl font-bold text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)}
                className="py-3 bg-[#E63946] text-white rounded-xl font-bold text-sm">Delete</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
