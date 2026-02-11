"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Athlete Portal
   Personal dashboard: XP, level, streaks, quests, journal
   Reads from same localStorage as coach portal (read-only + journal writes)
   ══════════════════════════════════════════════════════════════ */

// ── game engine (mirrors coach) ─────────────────────────────
const LEVELS = [
  { name: "Rookie", xp: 0, icon: "🌱", color: "#94a3b8" },
  { name: "Contender", xp: 300, icon: "⚡", color: "#a78bfa" },
  { name: "Warrior", xp: 600, icon: "🔥", color: "#60a5fa" },
  { name: "Elite", xp: 1000, icon: "💎", color: "#f59e0b" },
  { name: "Captain", xp: 1500, icon: "⭐", color: "#f97316" },
  { name: "Legend", xp: 2500, icon: "👑", color: "#ef4444" },
] as const;

function getLevel(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) if (xp >= LEVELS[i].xp) return LEVELS[i];
  return LEVELS[0];
}
function getNextLevel(xp: number) {
  for (const lv of LEVELS) if (xp < lv.xp) return lv;
  return null;
}
function getLevelProgress(xp: number) {
  const cur = getLevel(xp), nxt = getNextLevel(xp);
  if (!nxt) return { percent: 100, remaining: 0 };
  const range = nxt.xp - cur.xp, prog = xp - cur.xp;
  return { percent: Math.min(100, Math.round((prog / range) * 100)), remaining: nxt.xp - xp };
}
function getStreakMult(s: number) {
  if (s >= 60) return 2.5; if (s >= 30) return 2.0; if (s >= 14) return 1.75;
  if (s >= 7) return 1.5; if (s >= 3) return 1.25; return 1.0;
}
function fmtStreak(s: number) {
  if (s >= 60) return { label: "MYTHIC", mult: "2.5x", tier: 5, color: "#ef4444" };
  if (s >= 30) return { label: "LEGENDARY", mult: "2.0x", tier: 4, color: "#f59e0b" };
  if (s >= 14) return { label: "GOLD", mult: "1.75x", tier: 3, color: "#eab308" };
  if (s >= 7) return { label: "SILVER", mult: "1.5x", tier: 2, color: "#94a3b8" };
  if (s >= 3) return { label: "BRONZE", mult: "1.25x", tier: 1, color: "#cd7f32" };
  return { label: "STARTER", mult: "1.0x", tier: 0, color: "#475569" };
}

// ── storage keys (same as coach) ────────────────────────────
const K = {
  ROSTER: "apex-athlete-roster-v5",
  JOURNAL: "apex-athlete-journal",
};

interface Athlete {
  id: string; name: string; age: number; gender: "M" | "F"; group: string;
  xp: number; streak: number; weightStreak: number; lastStreakDate: string; lastWeightStreakDate: string;
  totalPractices: number; weekSessions: number; weekWeightSessions: number; weekTarget: number;
  checkpoints: Record<string, boolean>;
  weightCheckpoints: Record<string, boolean>;
  meetCheckpoints: Record<string, boolean>;
  weightChallenges: Record<string, boolean>;
  quests: Record<string, "active" | "done" | "pending">;
  dailyXP: { date: string; pool: number; weight: number; meet: number };
}

interface JournalEntry {
  date: string;
  wentWell: string;
  workOn: string;
  goals: string;
  mood: number; // 1-5
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    try { return JSON.parse(v); } catch { return v as unknown as T; }
  } catch { return fallback; }
}
function save(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)); }

const QUEST_DEFS = [
  { id: "technique-lab", name: "Technique Lab", desc: "Film one stroke, review with coach", xp: 30, cat: "SKILL" },
  { id: "buddy-up", name: "Buddy Up", desc: "Help a teammate master one skill", xp: 20, cat: "LEADERSHIP" },
  { id: "recovery-ritual", name: "Recovery Ritual", desc: "Log 8+ hours sleep + nutrition (3 nights)", xp: 15, cat: "RECOVERY" },
  { id: "dryland-hero", name: "Dryland Hero", desc: "Complete extra dryland, log reps", xp: 25, cat: "STRENGTH" },
  { id: "mindset-journal", name: "Mindset Journal", desc: "Write what I did well, what I'll fix", xp: 10, cat: "MINDSET" },
];

const CAT_COLORS: Record<string, string> = {
  SKILL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LEADERSHIP: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  RECOVERY: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  STRENGTH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  MINDSET: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const ATTRIBUTES = [
  { key: "attendance", label: "Attendance", icon: "📅", color: "#60a5fa" },
  { key: "effort", label: "Effort", icon: "💪", color: "#f59e0b" },
  { key: "improvement", label: "Improvement", icon: "📈", color: "#34d399" },
  { key: "consistency", label: "Consistency", icon: "🎯", color: "#a855f7" },
  { key: "leadership", label: "Leadership", icon: "🌟", color: "#f97316" },
];

function calcAttributes(a: Athlete) {
  const attended = a.totalPractices || 1;
  const attendance = Math.min(100, Math.round((attended / Math.max(attended, a.weekTarget * 4)) * 100));
  const cpDone = Object.values(a.checkpoints).filter(Boolean).length;
  const effort = Math.min(100, Math.round((cpDone / 13) * 100));
  const improvement = Math.min(100, Math.round((a.xp / 2500) * 100));
  const consistency = Math.min(100, Math.round((a.streak / 30) * 100));
  const questsDone = Object.values(a.quests).filter(v => v === "done").length;
  const leadership = Math.min(100, Math.round((questsDone / 5) * 100));
  return { attendance, effort, improvement, consistency, leadership };
}

// ── Radar chart (pure SVG) ──────────────────────────────────
function RadarChart({ values }: { values: Record<string, number> }) {
  const attrs = ATTRIBUTES;
  const cx = 100, cy = 100, r = 70;
  const n = attrs.length;

  const points = (radius: number) =>
    attrs.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const dataPoints = attrs.map((a, i) => {
    const val = (values[a.key] || 0) / 100;
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * val * Math.cos(angle), cy + r * val * Math.sin(angle)];
  });

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[260px] mx-auto">
      {/* grid */}
      {gridLevels.map(level => (
        <polygon key={level} points={points(r * level).map(p => p.join(",")).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      ))}
      {/* axes */}
      {attrs.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)}
          stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
      })}
      {/* data */}
      <polygon points={dataPoints.map(p => p.join(",")).join(" ")}
        fill="rgba(168,85,247,0.15)" stroke="#a855f7" strokeWidth="1.5" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={attrs[i].color} />
      ))}
      {/* labels */}
      {attrs.map((a, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const lx = cx + (r + 18) * Math.cos(angle);
        const ly = cy + (r + 18) * Math.sin(angle);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.4)" fontSize="7" fontWeight="600">
            {a.icon} {values[a.key] || 0}
          </text>
        );
      })}
    </svg>
  );
}

// ── Main component ──────────────────────────────────────────
export default function AthletePortal() {
  const [mounted, setMounted] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [tab, setTab] = useState<"dashboard" | "quests" | "journal" | "leaderboard">("dashboard");
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalDraft, setJournalDraft] = useState<JournalEntry>({ date: "", wentWell: "", workOn: "", goals: "", mood: 3 });
  const [searchResults, setSearchResults] = useState<Athlete[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const handlePin = () => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("apex-athlete-pin") || "1234" : "1234";
    if (pinInput === stored) { setUnlocked(true); setPinError(false); }
    else { setPinError(true); setTimeout(() => setPinError(false), 1500); }
  };

  useEffect(() => {
    if (!mounted) return;
    const r = load<Athlete[]>(K.ROSTER, []);
    setRoster(r);
    const j = load<JournalEntry[]>(K.JOURNAL, []);
    setJournal(j);
  }, [mounted]);

  // Name search
  useEffect(() => {
    if (nameInput.length < 2) { setSearchResults([]); return; }
    const q = nameInput.toLowerCase();
    setSearchResults(roster.filter(a => a.name.toLowerCase().includes(q)).slice(0, 8));
  }, [nameInput, roster]);

  const selectAthlete = (a: Athlete) => {
    setAthlete(a);
    setNameInput("");
    setSearchResults([]);
    const j = load<JournalEntry[]>(`${K.JOURNAL}-${a.id}`, []);
    setJournal(j);
  };

  const attrs = useMemo(() => athlete ? calcAttributes(athlete) : null, [athlete]);
  const level = athlete ? getLevel(athlete.xp) : LEVELS[0];
  const nextLevel = athlete ? getNextLevel(athlete.xp) : LEVELS[1];
  const progress = athlete ? getLevelProgress(athlete.xp) : { percent: 0, remaining: 300 };
  const streak = athlete ? fmtStreak(athlete.streak) : fmtStreak(0);
  const streakMult = athlete ? getStreakMult(athlete.streak) : 1;

  const todayStr = new Date().toISOString().slice(0, 10);

  const saveJournalEntry = () => {
    if (!athlete) return;
    const entry: JournalEntry = { ...journalDraft, date: todayStr };
    const updated = [entry, ...journal.filter(j => j.date !== todayStr)];
    setJournal(updated);
    save(`${K.JOURNAL}-${athlete.id}`, updated);
    setJournalDraft({ date: "", wentWell: "", workOn: "", goals: "", mood: 3 });
  };

  // Leaderboard (top 10 by XP in same group)
  const leaderboard = useMemo(() => {
    if (!athlete) return [];
    return roster
      .filter(a => a.group === athlete.group)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10);
  }, [athlete, roster]);

  if (!mounted) return (
    <div className="min-h-screen bg-[#06020f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#a855f7]/30 border-t-[#a855f7] rounded-full animate-spin" />
    </div>
  );

  // ── PIN screen ───────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#06020f] relative overflow-hidden flex flex-col items-center justify-center px-5">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.08)_0%,transparent_70%)]" />
        </div>
        <div className="relative z-10 w-full max-w-xs text-center">
          <svg className="w-16 h-16 mx-auto mb-4" viewBox="0 0 64 64" fill="none">
            <rect x="12" y="28" width="40" height="28" rx="4" stroke="#a855f7" strokeWidth="2.5" fill="rgba(168,85,247,0.08)"/>
            <path d="M24 28V20a8 8 0 1116 0v8" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="32" cy="42" r="3" fill="#a855f7"/>
          </svg>
          <h1 className="text-2xl font-black text-white mb-2">Athlete Portal</h1>
          <p className="text-white/30 text-sm mb-6">Enter PIN to access your dashboard</p>
          <input type="password" inputMode="numeric" maxLength={6} value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={e => e.key === "Enter" && handlePin()}
            className={`w-full px-5 py-4 bg-[#0a0518] border rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder:text-white/15 focus:outline-none transition-all ${pinError ? "border-red-500/60 animate-pulse" : "border-[#a855f7]/20 focus:border-[#a855f7]/50"}`}
            placeholder="····" autoFocus />
          <button onClick={handlePin}
            className="w-full mt-4 py-3 rounded-xl bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#a855f7] font-bold hover:bg-[#a855f7]/30 transition-all">
            Unlock
          </button>
          {pinError && <p className="text-red-400 text-xs mt-3">Incorrect PIN</p>}
          <Link href="/apex-athlete/portal" className="text-white/20 text-sm hover:text-white/40 transition-colors block mt-6">
            ← Back to Portal Selector
          </Link>
        </div>
      </div>
    );
  }

  // ── Name login screen ─────────────────────────────────────
  if (!athlete) {
    return (
      <div className="min-h-screen bg-[#06020f] relative overflow-hidden flex flex-col items-center justify-center px-5">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.08)_0%,transparent_70%)]" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-8">
            <svg className="w-14 h-14 mx-auto mb-4" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="20" r="10" stroke="#a855f7" strokeWidth="2" fill="rgba(168,85,247,0.1)"/>
              <path d="M16 52c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" fill="rgba(168,85,247,0.05)"/>
              <path d="M28 34l4 6 4-6" stroke="#e879f9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Athlete Portal</h1>
            <p className="text-white/30 text-sm">Type your name to see your dashboard</p>
          </div>
          <div className="relative">
            <input
              type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="Start typing your name..."
              className="w-full px-5 py-4 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl text-white text-lg placeholder:text-white/20 focus:outline-none focus:border-[#a855f7]/50 transition-all"
              autoFocus
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl overflow-hidden z-50">
                {searchResults.map(a => {
                  const lv = getLevel(a.xp);
                  return (
                    <button key={a.id} onClick={() => selectAthlete(a)}
                      className="w-full px-5 py-3 text-left hover:bg-[#a855f7]/10 transition-colors flex items-center justify-between border-b border-white/5 last:border-0">
                      <div>
                        <span className="text-white font-semibold">{a.name}</span>
                        <span className="text-white/20 text-xs ml-2">{a.group.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: lv.color }}>{lv.icon} {lv.name}</span>
                        <span className="text-white/20 text-xs">{a.xp} XP</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="text-center mt-8">
            <Link href="/apex-athlete/portal" className="text-white/20 text-sm hover:text-white/40 transition-colors">
              ← Back to Portal Selector
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main dashboard ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#06020f] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setAthlete(null)} className="text-white/30 hover:text-white/60 text-sm transition-colors">← Switch</button>
          <div className="text-center">
            <h2 className="text-white font-bold text-lg">{athlete.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span style={{ color: level.color }} className="text-sm font-bold">{level.icon} {level.name}</span>
              <span className="text-white/15 text-xs">·</span>
              <span className="text-white/30 text-xs">{athlete.group.toUpperCase()}</span>
            </div>
          </div>
          <div className="w-14" />
        </div>

        {/* XP Bar */}
        <div className="mb-6 p-4 rounded-xl bg-[#0a0518]/80 border border-[#a855f7]/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/40 text-xs font-mono">XP: {athlete.xp}</span>
            {nextLevel ? (
              <span className="text-xs" style={{ color: nextLevel.color }}>{nextLevel.icon} {nextLevel.name} in {progress.remaining} XP</span>
            ) : (
              <span className="text-[#ef4444] text-xs font-bold">MAX LEVEL 👑</span>
            )}
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress.percent}%`, background: `linear-gradient(90deg, ${level.color}, ${nextLevel?.color || level.color})` }} />
          </div>
        </div>

        {/* Streak + Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-2xl font-black text-white">{athlete.streak}</div>
            <div className="text-[10px] font-mono tracking-wider" style={{ color: streak.color }}>{streak.label} 🔥</div>
            <div className="text-white/20 text-[10px] mt-0.5">{streak.mult} multiplier</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-2xl font-black text-white">{athlete.totalPractices}</div>
            <div className="text-white/30 text-[10px] font-mono tracking-wider">PRACTICES</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-2xl font-black text-white">{athlete.weekSessions}/{athlete.weekTarget}</div>
            <div className="text-white/30 text-[10px] font-mono tracking-wider">THIS WEEK</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-[#0a0518]/50 p-1 rounded-xl border border-white/5">
          {(["dashboard", "quests", "journal", "leaderboard"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tab === t ? "bg-[#a855f7]/20 text-[#a855f7]" : "text-white/30 hover:text-white/50"}`}>
              {t === "dashboard" ? "⬡ Stats" : t === "quests" ? "◈ Quests" : t === "journal" ? "◉ Journal" : "△ Board"}
            </button>
          ))}
        </div>

        {/* ── Dashboard Tab ─────────────────────────────── */}
        {tab === "dashboard" && attrs && (
          <div className="space-y-5">
            {/* Attribute Radar */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#a855f7]/10">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3 text-center">ATTRIBUTE RADAR</h3>
              <RadarChart values={attrs} />
              <div className="grid grid-cols-5 gap-1 mt-3">
                {ATTRIBUTES.map(a => (
                  <div key={a.key} className="text-center">
                    <div className="text-xs">{a.icon}</div>
                    <div className="text-[10px] text-white/30">{a.label}</div>
                    <div className="text-xs font-bold" style={{ color: a.color }}>{attrs[a.key as keyof typeof attrs]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's XP Breakdown */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">TODAY&apos;S XP</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-[#60a5fa]">{athlete.dailyXP?.pool || 0}</div>
                  <div className="text-[10px] text-white/30">Pool</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-[#f59e0b]">{athlete.dailyXP?.weight || 0}</div>
                  <div className="text-[10px] text-white/30">Weight</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-[#ef4444]">{athlete.dailyXP?.meet || 0}</div>
                  <div className="text-[10px] text-white/30">Meet</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 text-center">
                <span className="text-white/20 text-xs">Streak multiplier: </span>
                <span className="text-[#a855f7] text-sm font-bold">{streakMult}x</span>
              </div>
            </div>

            {/* Weight Room */}
            {athlete.weightStreak > 0 && (
              <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#f59e0b]/10">
                <h3 className="text-white/50 text-xs font-mono tracking-wider mb-2">WEIGHT ROOM STREAK</h3>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-[#f59e0b]">{athlete.weightStreak}</span>
                  <span className="text-white/30 text-xs">sessions · {athlete.weekWeightSessions} this week</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Quests Tab ──────────────────────────────── */}
        {tab === "quests" && (
          <div className="space-y-3">
            <h3 className="text-white/50 text-xs font-mono tracking-wider mb-2">SIDE QUESTS</h3>
            {QUEST_DEFS.map(q => {
              const status = athlete.quests?.[q.id] || "pending";
              return (
                <div key={q.id} className={`p-4 rounded-xl border transition-all ${status === "done" ? "bg-emerald-500/5 border-emerald-500/20" : status === "active" ? "bg-[#a855f7]/5 border-[#a855f7]/20" : "bg-[#0a0518]/80 border-white/5"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">{q.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CAT_COLORS[q.cat] || ""}`}>{q.cat}</span>
                      </div>
                      <p className="text-white/25 text-xs">{q.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[#f59e0b] text-sm font-bold">+{q.xp}</div>
                      <div className={`text-[10px] font-mono ${status === "done" ? "text-emerald-400" : status === "active" ? "text-[#a855f7]" : "text-white/20"}`}>
                        {status === "done" ? "✅ DONE" : status === "active" ? "⏳ ACTIVE" : "LOCKED"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-white/15 text-[10px] text-center mt-4">Quests are assigned and approved by your coach</p>
          </div>
        )}

        {/* ── Journal Tab ─────────────────────────────── */}
        {tab === "journal" && (
          <div className="space-y-4">
            {/* New entry form */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#a855f7]/10">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">TODAY&apos;S REFLECTION</h3>
              {/* Mood */}
              <div className="flex items-center gap-1 mb-4 justify-center">
                {[1, 2, 3, 4, 5].map(m => (
                  <button key={m} onClick={() => setJournalDraft(d => ({ ...d, mood: m }))}
                    className={`text-2xl transition-all ${journalDraft.mood >= m ? "opacity-100 scale-110" : "opacity-20"}`}>
                    {m <= 2 ? "😤" : m === 3 ? "😐" : m === 4 ? "😊" : "🔥"}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-white/30 text-[10px] font-mono block mb-1">WHAT WENT WELL</label>
                  <textarea value={journalDraft.wentWell} onChange={e => setJournalDraft(d => ({ ...d, wentWell: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#a855f7]/30 resize-none"
                    rows={2} placeholder="I nailed my flip turns today..." />
                </div>
                <div>
                  <label className="text-white/30 text-[10px] font-mono block mb-1">WHAT I&apos;LL WORK ON</label>
                  <textarea value={journalDraft.workOn} onChange={e => setJournalDraft(d => ({ ...d, workOn: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#a855f7]/30 resize-none"
                    rows={2} placeholder="Need to focus on breathing pattern..." />
                </div>
                <div>
                  <label className="text-white/30 text-[10px] font-mono block mb-1">MY GOALS</label>
                  <textarea value={journalDraft.goals} onChange={e => setJournalDraft(d => ({ ...d, goals: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#a855f7]/30 resize-none"
                    rows={2} placeholder="Drop 2 seconds on my 100 free..." />
                </div>
                <button onClick={saveJournalEntry}
                  disabled={!journalDraft.wentWell && !journalDraft.workOn && !journalDraft.goals}
                  className="w-full py-2.5 rounded-lg bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#a855f7] text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#a855f7]/30 transition-all">
                  Save Reflection
                </button>
              </div>
            </div>

            {/* Past entries */}
            {journal.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-white/30 text-xs font-mono">PAST ENTRIES</h3>
                {journal.slice(0, 7).map((j, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[#0a0518]/50 border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/40 text-[10px] font-mono">{j.date}</span>
                      <span className="text-sm">{j.mood <= 2 ? "😤" : j.mood === 3 ? "😐" : j.mood === 4 ? "😊" : "🔥"}</span>
                    </div>
                    {j.wentWell && <p className="text-white/30 text-xs"><span className="text-emerald-400/60">✓</span> {j.wentWell}</p>}
                    {j.workOn && <p className="text-white/30 text-xs"><span className="text-[#f59e0b]/60">→</span> {j.workOn}</p>}
                    {j.goals && <p className="text-white/30 text-xs"><span className="text-[#a855f7]/60">★</span> {j.goals}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Leaderboard Tab ─────────────────────────── */}
        {tab === "leaderboard" && (
          <div className="space-y-2">
            <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">{athlete.group.toUpperCase()} LEADERBOARD</h3>
            {leaderboard.map((a, i) => {
              const lv = getLevel(a.xp);
              const isMe = a.id === athlete.id;
              return (
                <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe ? "bg-[#a855f7]/10 border-[#a855f7]/20" : "bg-[#0a0518]/50 border-white/5"}`}>
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black ${i === 0 ? "bg-[#f59e0b]/20 text-[#f59e0b]" : i === 1 ? "bg-white/10 text-white/50" : i === 2 ? "bg-[#cd7f32]/20 text-[#cd7f32]" : "bg-white/5 text-white/20"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold truncate block ${isMe ? "text-white" : "text-white/60"}`}>
                      {a.name} {isMe && <span className="text-[#a855f7] text-[10px]">YOU</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span style={{ color: lv.color }} className="text-xs">{lv.icon}</span>
                    <span className="text-white/40 text-xs font-mono">{a.xp} XP</span>
                    {a.streak >= 3 && <span className="text-[10px]">🔥{a.streak}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-10 text-white/[0.06] text-[10px] space-y-1">
          <p>Apex Athlete — Athlete Portal</p>
          <p>Every rep counts · Every streak matters · Keep leveling up</p>
        </div>
      </div>
    </div>
  );
}
