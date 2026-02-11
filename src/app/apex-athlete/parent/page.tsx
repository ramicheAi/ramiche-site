"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Parent Portal (Read-Only)
   Growth trends, milestones, achievements — no raw data
   COPPA-safe: coach manages all data, parents see trends only
   ══════════════════════════════════════════════════════════════ */

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
function fmtStreak(s: number) {
  if (s >= 60) return { label: "MYTHIC", color: "#ef4444" };
  if (s >= 30) return { label: "LEGENDARY", color: "#f59e0b" };
  if (s >= 14) return { label: "GOLD", color: "#eab308" };
  if (s >= 7) return { label: "SILVER", color: "#94a3b8" };
  if (s >= 3) return { label: "BRONZE", color: "#cd7f32" };
  return { label: "STARTER", color: "#475569" };
}

const K = { ROSTER: "apex-athlete-roster-v5", SNAPSHOTS: "apex-athlete-snapshots-v2" };

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

interface DailySnapshot {
  date: string; attendance: number; totalAthletes: number; totalXPAwarded: number;
  poolCheckins: number; weightCheckins: number; meetCheckins: number;
  questsCompleted: number; challengesCompleted: number;
  athleteXPs: Record<string, number>; athleteStreaks: Record<string, number>;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    try { return JSON.parse(v); } catch { return v as unknown as T; }
  } catch { return fallback; }
}

// Achievement badges
function getAchievements(a: Athlete) {
  const badges: { icon: string; label: string; desc: string; earned: boolean; color: string }[] = [
    { icon: "🌱", label: "First Steps", desc: "Completed first practice", earned: a.totalPractices >= 1, color: "#94a3b8" },
    { icon: "🔥", label: "On Fire", desc: "3-day streak", earned: a.streak >= 3, color: "#f59e0b" },
    { icon: "⚡", label: "Contender", desc: "Reached Contender level", earned: a.xp >= 300, color: "#a78bfa" },
    { icon: "💪", label: "Iron Will", desc: "10+ practices completed", earned: a.totalPractices >= 10, color: "#60a5fa" },
    { icon: "🎯", label: "Consistent", desc: "7-day streak", earned: a.streak >= 7, color: "#34d399" },
    { icon: "🏋️", label: "Gym Rat", desc: "3+ weight room sessions", earned: a.weightStreak >= 3, color: "#f97316" },
    { icon: "💎", label: "Elite", desc: "Reached Elite level", earned: a.xp >= 1000, color: "#f59e0b" },
    { icon: "🌟", label: "Quest Hero", desc: "Completed a side quest", earned: Object.values(a.quests || {}).includes("done"), color: "#a855f7" },
    { icon: "👑", label: "Legend", desc: "Reached Legend level", earned: a.xp >= 2500, color: "#ef4444" },
    { icon: "🏆", label: "Mythic Streak", desc: "60-day streak", earned: a.streak >= 60, color: "#ef4444" },
  ];
  return badges;
}

// Growth trend — simple XP per week estimate
function getGrowthTrend(a: Athlete, snapshots: DailySnapshot[]) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentSnaps = snapshots.filter(s => s.date >= weekAgo);
  const weekXP = recentSnaps.reduce((sum, s) => sum + (s.athleteXPs?.[a.id] || 0), 0);
  const avgDaily = recentSnaps.length > 0 ? Math.round(weekXP / recentSnaps.length) : 0;
  return { weekXP, avgDaily, totalDays: recentSnaps.length };
}

export default function ParentPortal() {
  const [mounted, setMounted] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [searchResults, setSearchResults] = useState<Athlete[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const handlePin = () => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("apex-athlete-pin") || "1234" : "1234";
    if (pinInput === stored) { setUnlocked(true); setPinError(false); }
    else { setPinError(true); setTimeout(() => setPinError(false), 1500); }
  };

  useEffect(() => {
    if (!mounted) return;
    setRoster(load<Athlete[]>(K.ROSTER, []));
    setSnapshots(load<DailySnapshot[]>(K.SNAPSHOTS, []));
  }, [mounted]);

  useEffect(() => {
    if (nameInput.length < 2) { setSearchResults([]); return; }
    const q = nameInput.toLowerCase();
    setSearchResults(roster.filter(a => a.name.toLowerCase().includes(q)).slice(0, 8));
  }, [nameInput, roster]);

  const selectAthlete = (a: Athlete) => { setAthlete(a); setNameInput(""); setSearchResults([]); };

  const level = athlete ? getLevel(athlete.xp) : LEVELS[0];
  const nextLevel = athlete ? getNextLevel(athlete.xp) : LEVELS[1];
  const progress = athlete ? getLevelProgress(athlete.xp) : { percent: 0, remaining: 300 };
  const streak = athlete ? fmtStreak(athlete.streak) : fmtStreak(0);
  const achievements = useMemo(() => athlete ? getAchievements(athlete) : [], [athlete]);
  const growth = useMemo(() => athlete ? getGrowthTrend(athlete, snapshots) : null, [athlete, snapshots]);
  const earnedCount = achievements.filter(a => a.earned).length;

  if (!mounted) return (
    <div className="min-h-screen bg-[#06020f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#f59e0b]/30 border-t-[#f59e0b] rounded-full animate-spin" />
    </div>
  );

  // ── PIN screen ───────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#06020f] relative overflow-hidden flex flex-col items-center justify-center px-5">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.08)_0%,transparent_70%)]" />
        </div>
        <div className="relative z-10 w-full max-w-xs text-center">
          <svg className="w-16 h-16 mx-auto mb-4" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="26" stroke="#f59e0b" strokeWidth="2" fill="rgba(245,158,11,0.06)"/>
            <circle cx="32" cy="26" r="8" stroke="#f59e0b" strokeWidth="1.8" fill="rgba(245,158,11,0.1)"/>
            <path d="M20 48c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" fill="rgba(245,158,11,0.05)"/>
            <path d="M44 18l4-4M20 18l-4-4" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <h1 className="text-2xl font-black text-white mb-2">Parent Portal</h1>
          <p className="text-white/30 text-sm mb-6">Enter PIN to view your swimmer&apos;s growth</p>
          <input type="password" inputMode="numeric" maxLength={6} value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={e => e.key === "Enter" && handlePin()}
            className={`w-full px-5 py-4 bg-[#0a0518] border rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder:text-white/15 focus:outline-none transition-all ${pinError ? "border-red-500/60 animate-pulse" : "border-[#f59e0b]/20 focus:border-[#f59e0b]/50"}`}
            placeholder="····" autoFocus />
          <button onClick={handlePin}
            className="w-full mt-4 py-3 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b] font-bold hover:bg-[#f59e0b]/30 transition-all">
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

  // ── Name lookup ───────────────────────────────────────────
  if (!athlete) {
    return (
      <div className="min-h-screen bg-[#06020f] relative overflow-hidden flex flex-col items-center justify-center px-5">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.08)_0%,transparent_70%)]" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-8">
            <svg className="w-14 h-14 mx-auto mb-4" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="26" stroke="#f59e0b" strokeWidth="2" fill="rgba(245,158,11,0.06)"/>
              <circle cx="32" cy="26" r="8" stroke="#f59e0b" strokeWidth="1.8" fill="rgba(245,158,11,0.1)"/>
              <path d="M20 48c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" fill="rgba(245,158,11,0.05)"/>
            </svg>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Parent Portal</h1>
            <p className="text-white/30 text-sm">Find your swimmer to see their growth</p>
          </div>
          <div className="relative">
            <input
              type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="Type your swimmer's name..."
              className="w-full px-5 py-4 bg-[#0a0518] border border-[#f59e0b]/20 rounded-xl text-white text-lg placeholder:text-white/20 focus:outline-none focus:border-[#f59e0b]/50 transition-all"
              autoFocus
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0518] border border-[#f59e0b]/20 rounded-xl overflow-hidden z-50">
                {searchResults.map(a => {
                  const lv = getLevel(a.xp);
                  return (
                    <button key={a.id} onClick={() => selectAthlete(a)}
                      className="w-full px-5 py-3 text-left hover:bg-[#f59e0b]/10 transition-colors flex items-center justify-between border-b border-white/5 last:border-0">
                      <span className="text-white font-semibold">{a.name}</span>
                      <span className="text-xs" style={{ color: lv.color }}>{lv.icon} {lv.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* COPPA notice */}
          <div className="mt-6 p-4 rounded-xl bg-[#0a0518]/60 border border-[#00f0ff]/10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🔒</span>
              <span className="text-white/50 text-xs font-bold">COPPA Safe</span>
            </div>
            <p className="text-white/20 text-[10px]">This portal shows growth trends and achievements only. All athlete data is managed by the coach. No personal information is collected.</p>
          </div>

          <div className="text-center mt-6">
            <Link href="/apex-athlete/portal" className="text-white/20 text-sm hover:text-white/40 transition-colors">
              ← Back to Portal Selector
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Parent Dashboard (read-only) ─────────────────────────
  return (
    <div className="min-h-screen bg-[#06020f] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.08)_0%,transparent_70%)]" />
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

        {/* Level Progress — big, encouraging */}
        <div className="mb-6 p-5 rounded-2xl bg-[#0a0518]/80 border border-[#f59e0b]/10 text-center">
          <div className="text-4xl mb-2">{level.icon}</div>
          <div className="text-2xl font-black text-white mb-1">{level.name}</div>
          {nextLevel ? (
            <p className="text-white/30 text-xs mb-3">
              {progress.remaining} XP until <span style={{ color: nextLevel.color }}>{nextLevel.icon} {nextLevel.name}</span>
            </p>
          ) : (
            <p className="text-[#ef4444] text-xs font-bold mb-3">Maximum Level Reached!</p>
          )}
          <div className="h-3 bg-white/5 rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress.percent}%`, background: `linear-gradient(90deg, ${level.color}, ${nextLevel?.color || level.color})` }} />
          </div>
          <div className="text-white/20 text-[10px] mt-2 font-mono">{athlete.xp} XP TOTAL</div>
        </div>

        {/* Highlights Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-3xl font-black text-white">{athlete.streak}</div>
            <div className="text-[10px] font-mono tracking-wider" style={{ color: streak.color }}>{streak.label}</div>
            <div className="text-white/20 text-[10px]">day streak</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-3xl font-black text-white">{athlete.totalPractices}</div>
            <div className="text-white/30 text-[10px] font-mono tracking-wider">PRACTICES</div>
            <div className="text-white/20 text-[10px]">total</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-3xl font-black text-white">{earnedCount}</div>
            <div className="text-[#f59e0b]/60 text-[10px] font-mono tracking-wider">BADGES</div>
            <div className="text-white/20 text-[10px]">earned</div>
          </div>
        </div>

        {/* Weekly Growth Trend */}
        {growth && (
          <div className="mb-6 p-4 rounded-xl bg-[#0a0518]/80 border border-emerald-500/10">
            <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">THIS WEEK&apos;S GROWTH</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xl font-bold text-emerald-400">{growth.weekXP}</div>
                <div className="text-white/25 text-[10px]">XP earned this week</div>
              </div>
              <div>
                <div className="text-xl font-bold text-[#60a5fa]">{athlete.weekSessions}/{athlete.weekTarget}</div>
                <div className="text-white/25 text-[10px]">sessions this week</div>
              </div>
            </div>
            {growth.avgDaily > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 text-center">
                <span className="text-white/20 text-xs">Averaging </span>
                <span className="text-emerald-400 text-sm font-bold">{growth.avgDaily} XP/day</span>
              </div>
            )}
          </div>
        )}

        {/* Achievement Badges */}
        <div className="mb-6 p-4 rounded-xl bg-[#0a0518]/80 border border-[#f59e0b]/10">
          <h3 className="text-white/50 text-xs font-mono tracking-wider mb-4">ACHIEVEMENTS</h3>
          <div className="grid grid-cols-5 gap-3">
            {achievements.map((badge, i) => (
              <div key={i} className={`text-center transition-all ${badge.earned ? "" : "opacity-20 grayscale"}`}>
                <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg mb-1 ${badge.earned ? "bg-white/10" : "bg-white/5"}`}
                  style={badge.earned ? { boxShadow: `0 0 12px ${badge.color}40` } : {}}>
                  {badge.icon}
                </div>
                <div className="text-[9px] text-white/40 leading-tight">{badge.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Encouragement Section */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#f59e0b]/5 to-[#a855f7]/5 border border-[#f59e0b]/10">
          <h3 className="text-white/50 text-xs font-mono tracking-wider mb-2">HIGHLIGHTS</h3>
          <div className="space-y-2">
            {athlete.streak >= 7 && (
              <p className="text-white/40 text-sm">Your swimmer has maintained a <span className="text-[#f59e0b] font-bold">{athlete.streak}-day streak</span> — that&apos;s incredible consistency!</p>
            )}
            {athlete.streak >= 3 && athlete.streak < 7 && (
              <p className="text-white/40 text-sm">Building momentum with a <span className="text-[#f59e0b] font-bold">{athlete.streak}-day streak</span>. Keep encouraging them!</p>
            )}
            {athlete.totalPractices >= 10 && (
              <p className="text-white/40 text-sm"><span className="text-[#60a5fa] font-bold">{athlete.totalPractices} practices</span> logged — showing real dedication to the sport.</p>
            )}
            {Object.values(athlete.quests || {}).includes("done") && (
              <p className="text-white/40 text-sm">Completed side quests — going above and beyond regular practice!</p>
            )}
            {athlete.xp < 100 && athlete.totalPractices < 5 && (
              <p className="text-white/40 text-sm">Just getting started! Every practice builds the foundation. Your support matters.</p>
            )}
            {athlete.weightStreak >= 3 && (
              <p className="text-white/40 text-sm">Active in the weight room with a <span className="text-[#f97316] font-bold">{athlete.weightStreak}-session streak</span> — building strength alongside swimming.</p>
            )}
          </div>
        </div>

        {/* COPPA Footer */}
        <div className="mt-8 p-3 rounded-lg bg-[#0a0518]/40 border border-[#00f0ff]/5 flex items-center gap-2">
          <span className="text-sm">🔒</span>
          <p className="text-white/15 text-[10px]">
            Parent Portal is read-only. Growth trends and achievements only — no raw checkpoint data, no personal information.
            All data is managed by the coaching staff.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-white/[0.06] text-[10px] space-y-1">
          <p>Apex Athlete — Parent Portal</p>
          <p>Enough to feel invested, not enough to backseat coach</p>
        </div>
      </div>
    </div>
  );
}
