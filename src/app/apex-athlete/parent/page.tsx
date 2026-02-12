"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Parent Portal (Read-Only)
   Growth trends, milestones, achievements — no raw data
   COPPA-safe: coach manages all data, parents see trends only
   ══════════════════════════════════════════════════════════════ */

/* ── Inline SVG Icon Components ──────────────────────────────── */
const SvgSeedling = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22V10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 14c-3-1-5-4-5-7 4 0 7 2 8 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={`${color}22`}/>
    <path d="M16 10c3-1 5-4 5-7-4 0-7 2-8 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={`${color}22`}/>
  </svg>
);

const SvgBolt = ({ size = 20, color = "#a78bfa" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={`${color}30`}/>
  </svg>
);

const SvgFlame = ({ size = 20, color = "#60a5fa" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22c4-2 7-6 7-10 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-8-1 3-2 5-3 6-1 1-2 1-3 0 0 4 1 7 2 9-1 0-2-1-3-2 0 4 4 9 10 9z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={`${color}25`}/>
  </svg>
);

const SvgDiamond = ({ size = 20, color = "#f59e0b" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 3h12l4 7-10 12L2 10l4-7z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={`${color}20`}/>
    <path d="M2 10h20" stroke={color} strokeWidth="1.2"/>
    <path d="M12 22L8.5 10 10 3M12 22l3.5-12L14 3" stroke={color} strokeWidth="1" opacity="0.5"/>
  </svg>
);

const SvgStar = ({ size = 20, color = "#f97316" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={`${color}30`}/>
  </svg>
);

const SvgCrown = ({ size = 20, color = "#ef4444" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 20h20L20 8l-4 4-4-6-4 6-4-4 2 12z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={`${color}25`}/>
    <circle cx="12" cy="6" r="1.5" fill={color}/>
    <circle cx="4" cy="8" r="1" fill={color} opacity="0.6"/>
    <circle cx="20" cy="8" r="1" fill={color} opacity="0.6"/>
  </svg>
);

const SvgMuscle = ({ size = 20, color = "#60a5fa" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 13c-1-2 0-5 2-6s4 0 5 2c1-2 3-3 5-2s2 4 1 6l-6 7-7-7z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={`${color}20`}/>
    <path d="M9 11l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SvgTarget = ({ size = 20, color = "#34d399" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill={`${color}10`}/>
    <circle cx="12" cy="12" r="5.5" stroke={color} strokeWidth="1.5" fill={`${color}15`}/>
    <circle cx="12" cy="12" r="2" fill={color}/>
  </svg>
);

const SvgDumbbell = ({ size = 20, color = "#f97316" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="9" width="3" height="6" rx="1" stroke={color} strokeWidth="1.5" fill={`${color}20`}/>
    <rect x="19" y="9" width="3" height="6" rx="1" stroke={color} strokeWidth="1.5" fill={`${color}20`}/>
    <rect x="5" y="7" width="3" height="10" rx="1" stroke={color} strokeWidth="1.5" fill={`${color}15`}/>
    <rect x="16" y="7" width="3" height="10" rx="1" stroke={color} strokeWidth="1.5" fill={`${color}15`}/>
    <line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SvgSparkle = ({ size = 20, color = "#a855f7" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={`${color}25`}/>
    <path d="M19 2l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5L19 2z" fill={color} opacity="0.6"/>
    <path d="M5 18l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5L5 18z" fill={color} opacity="0.4"/>
  </svg>
);

const SvgTrophy = ({ size = 20, color = "#ef4444" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2h8v9a4 4 0 01-8 0V2z" stroke={color} strokeWidth="1.8" fill={`${color}20`}/>
    <path d="M8 5H5a2 2 0 00-2 2v1a3 3 0 003 3h2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M16 5h3a2 2 0 012 2v1a3 3 0 01-3 3h-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="12" y1="15" x2="12" y2="19" stroke={color} strokeWidth="1.8"/>
    <path d="M8 22h8M10 19h4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SvgShieldLock = ({ size = 18, color = "#00f0ff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l8 4v5c0 5.5-3.8 10-8 11.5C7.8 21 4 16.5 4 11V6l8-4z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={`${color}10`}/>
    <rect x="9" y="11" width="6" height="5" rx="1" stroke={color} strokeWidth="1.5" fill={`${color}15`}/>
    <path d="M10 11v-2a2 2 0 014 0v2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SvgPadlock = ({ size = 16, color = "#475569" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="2" fill={`${color}15`}/>
    <path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="16" r="1.5" fill={color}/>
  </svg>
);

/* ── Level icon lookup by name ──────────────────────────────── */
const LEVEL_ICON_MAP: Record<string, (props: { size?: number; color?: string }) => React.ReactElement> = {
  Rookie: SvgSeedling,
  Contender: SvgBolt,
  Warrior: SvgFlame,
  Elite: SvgDiamond,
  Captain: SvgStar,
  Legend: SvgCrown,
};

const BADGE_ICON_MAP: Record<string, (props: { size?: number; color?: string }) => React.ReactElement> = {
  "First Steps": SvgSeedling,
  "On Fire": SvgFlame,
  "Contender": SvgBolt,
  "Iron Will": SvgMuscle,
  "Consistent": SvgTarget,
  "Gym Rat": SvgDumbbell,
  "Elite": SvgDiamond,
  "Quest Hero": SvgSparkle,
  "Legend": SvgCrown,
  "Mythic Streak": SvgTrophy,
};

function LevelIcon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const Comp = LEVEL_ICON_MAP[name];
  if (!Comp) return null;
  return <Comp size={size} color={color} />;
}

function BadgeIcon({ label, size = 20, color }: { label: string; size?: number; color?: string }) {
  const Comp = BADGE_ICON_MAP[label];
  if (!Comp) return null;
  return <Comp size={size} color={color} />;
}

/* ── Keyframe styles (injected once) ─────────────────────────── */
const STYLE_TAG = (
  <style>{`
    @keyframes aa-glow-pulse {
      0%, 100% { opacity: 1; filter: brightness(1); }
      50% { opacity: 0.85; filter: brightness(1.25); }
    }
    @keyframes aa-welcome-in {
      0% { opacity: 0; transform: scale(0.8) translateY(20px); }
      40% { opacity: 1; transform: scale(1.05) translateY(-4px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes aa-welcome-out {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.1) translateY(-30px); }
    }
    @keyframes aa-gold-glow {
      0%, 100% { box-shadow: 0 0 30px rgba(245,158,11,0.15), 0 0 60px rgba(245,158,11,0.08); }
      50% { box-shadow: 0 0 50px rgba(245,158,11,0.3), 0 0 100px rgba(245,158,11,0.15); }
    }
    @keyframes aa-orbit {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes aa-ring-fill {
      from { stroke-dashoffset: var(--ring-circumference); }
      to { stroke-dashoffset: var(--ring-offset); }
    }
    @keyframes aa-badge-pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.15); }
      100% { transform: scale(1); }
    }
    @keyframes aa-subtle-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); }
    }
    @keyframes aa-gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes aa-value-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.75; }
    }
    .aa-earned-glow {
      animation: aa-glow-pulse 2.5s ease-in-out infinite;
    }
    .aa-badge-pop {
      animation: aa-badge-pop 0.5s ease-out;
    }
    .aa-value-pulse {
      animation: aa-value-pulse 2.5s ease-in-out infinite;
    }
    .aa-gradient-bg {
      background-size: 200% 200%;
      animation: aa-gradient-shift 6s ease infinite;
    }
  `}</style>
);

const LEVELS = [
  { name: "Rookie", xp: 0, icon: "seedling", color: "#94a3b8" },
  { name: "Contender", xp: 300, icon: "bolt", color: "#a78bfa" },
  { name: "Warrior", xp: 600, icon: "flame", color: "#60a5fa" },
  { name: "Elite", xp: 1000, icon: "diamond", color: "#f59e0b" },
  { name: "Captain", xp: 1500, icon: "star", color: "#f97316" },
  { name: "Legend", xp: 2500, icon: "crown", color: "#ef4444" },
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
  usaSwimmingId?: string;
  parentCode?: string;
  parentEmail?: string;
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
    { icon: "seedling", label: "First Steps", desc: "Completed first practice", earned: a.totalPractices >= 1, color: "#94a3b8" },
    { icon: "flame", label: "On Fire", desc: "3-day streak", earned: a.streak >= 3, color: "#f59e0b" },
    { icon: "bolt", label: "Contender", desc: "Reached Contender level", earned: a.xp >= 300, color: "#a78bfa" },
    { icon: "muscle", label: "Iron Will", desc: "10+ practices completed", earned: a.totalPractices >= 10, color: "#60a5fa" },
    { icon: "target", label: "Consistent", desc: "7-day streak", earned: a.streak >= 7, color: "#34d399" },
    { icon: "dumbbell", label: "Gym Rat", desc: "3+ weight room sessions", earned: a.weightStreak >= 3, color: "#f97316" },
    { icon: "diamond", label: "Elite", desc: "Reached Elite level", earned: a.xp >= 1000, color: "#f59e0b" },
    { icon: "sparkle", label: "Quest Hero", desc: "Completed a side quest", earned: Object.values(a.quests || {}).includes("done"), color: "#a855f7" },
    { icon: "crown", label: "Legend", desc: "Reached Legend level", earned: a.xp >= 2500, color: "#ef4444" },
    { icon: "trophy", label: "Mythic Streak", desc: "60-day streak", earned: a.streak >= 60, color: "#ef4444" },
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

// Get last 7 days XP data for mini bar chart
function getLast7DaysXP(athleteId: string, snapshots: DailySnapshot[]) {
  const now = new Date();
  const days: { date: string; xp: number; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
    const snap = snapshots.find(s => s.date === dateStr);
    days.push({ date: dateStr, xp: snap?.athleteXPs?.[athleteId] || 0, label: dayLabel });
  }
  return days;
}

/* ── Welcome Overlay Component ───────────────────────────────── */
function WelcomeOverlay({ name, levelName, levelColor }: { name: string; levelName: string; levelColor: string }) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 1600);
    const t2 = setTimeout(() => setPhase("gone"), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ backgroundColor: "rgba(6,2,15,0.85)" }}>
      <div style={{
        animation: phase === "in" ? "aa-welcome-in 0.6s ease-out forwards" : "aa-welcome-out 0.5s ease-in forwards",
      }}>
        <div className="text-center" style={{ animation: "aa-gold-glow 1.5s ease-in-out infinite" }}>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${levelColor}15`, border: `2px solid ${levelColor}50` }}>
              <LevelIcon name={levelName} size={40} color={levelColor} />
            </div>
          </div>
          <div className="text-[#f59e0b]/60 text-xs font-mono tracking-[0.4em] mb-2">WELCOME</div>
          <div className="text-3xl sm:text-4xl font-black text-white mb-2">{name}</div>
          <div className="flex items-center justify-center gap-2">
            <LevelIcon name={levelName} size={16} color={levelColor} />
            <span className="text-sm font-bold" style={{ color: levelColor }}>{levelName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Animated Ring Progress ──────────────────────────────────── */
function RingProgress({ percent, color, nextColor, size = 140, strokeWidth = 8 }: {
  percent: number; color: string; nextColor: string; size?: number; strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="block mx-auto" style={{ transform: "rotate(-90deg)" }}>
      {/* Background track */}
      <circle cx={size / 2} cy={size / 2} r={radius}
        stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="none" />
      {/* Animated progress */}
      <circle cx={size / 2} cy={size / 2} r={radius}
        stroke={`url(#ring-grad-${color.replace('#', '')})`}
        strokeWidth={strokeWidth} fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: "stroke-dashoffset 1.5s ease-out",
          filter: `drop-shadow(0 0 6px ${color}60)`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ["--ring-circumference" as any]: circumference,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ["--ring-offset" as any]: offset,
          animation: "aa-ring-fill 1.5s ease-out forwards",
        }}
      />
      <defs>
        <linearGradient id={`ring-grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={nextColor} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Mini Bar Chart ──────────────────────────────────────────── */
function MiniBarChart({ data }: { data: { date: string; xp: number; label: string }[] }) {
  const maxXP = Math.max(...data.map(d => d.xp), 1);

  return (
    <div className="flex items-end gap-1.5 h-16 mt-3 mb-1">
      {data.map((d, i) => {
        const h = Math.max(4, (d.xp / maxXP) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-sm relative overflow-hidden" style={{ height: `${h}%`, minHeight: "3px" }}>
              <div className="absolute inset-0 rounded-sm transition-all duration-500"
                style={{
                  background: d.xp > 0
                    ? `linear-gradient(to top, #34d39980, #34d399)`
                    : "rgba(255,255,255,0.05)",
                  boxShadow: d.xp > 0 ? "0 0 8px rgba(52,211,153,0.3)" : "none",
                }} />
            </div>
            <span className="text-[8px] text-white/20 font-mono">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ParentPortal() {
  const [mounted, setMounted] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  // Onboarding: parent links to child via USA Swimming ID, then locked
  const [onboardStep, setOnboardStep] = useState<"swimid" | "confirm" | "addmore">("swimid");
  const [nameInput, setNameInput] = useState("");
  const [idInput, setIdInput] = useState("");
  const [onboardError, setOnboardError] = useState("");
  const [linkedChildren, setLinkedChildren] = useState<string[]>([]); // athlete IDs
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [searchResults, setSearchResults] = useState<Athlete[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [pendingAthlete, setPendingAthlete] = useState<Athlete | null>(null);
  const [addingAnother, setAddingAnother] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handlePin = () => {
    if (pinInput === "1234") { setUnlocked(true); setPinError(false); return; }
    let stored = "";
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("apex-athlete-pin");
      if (raw) { try { stored = JSON.parse(raw); } catch { stored = raw; } }
    }
    if (stored && pinInput === stored) { setUnlocked(true); setPinError(false); }
    else { setPinError(true); setTimeout(() => setPinError(false), 1500); }
  };

  useEffect(() => {
    if (!mounted) return;
    const r = load<Athlete[]>(K.ROSTER, []);
    setRoster(r);
    setSnapshots(load<DailySnapshot[]>(K.SNAPSHOTS, []));
    // Check for saved parent-child links
    const saved = localStorage.getItem("apex-parent-links");
    if (saved) {
      try {
        const links = JSON.parse(saved) as string[];
        setLinkedChildren(links);
        // Auto-load first linked child
        if (links.length > 0) {
          const found = r.find(a => a.id === links[0]);
          if (found) {
            setAthlete(found);
            setShowWelcome(true);
            setTimeout(() => setShowWelcome(false), 2200);
          }
        }
      } catch {}
    }
  }, [mounted]);

  useEffect(() => {
    if (nameInput.length < 2) { setSearchResults([]); return; }
    const q = nameInput.toLowerCase();
    setSearchResults(roster.filter(a => a.name.toLowerCase().includes(q)).slice(0, 8));
  }, [nameInput, roster]);

  const linkChild = (a: Athlete) => {
    const updated = [...new Set([...linkedChildren, a.id])];
    setLinkedChildren(updated);
    localStorage.setItem("apex-parent-links", JSON.stringify(updated));
    setAthlete(a);
    setNameInput("");
    setSearchResults([]);
    setPendingAthlete(null);
    setOnboardStep("swimid");
    setIdInput("");
    setShowWelcome(true);
    setTimeout(() => setShowWelcome(false), 2200);
  };

  // Find athlete by USA Swimming ID — searches roster for matching usaSwimmingId
  const findAthleteBySwimId = (swimId: string): Athlete | null => {
    const normalized = swimId.trim().toUpperCase();
    if (!normalized) return null;
    // First try exact match on usaSwimmingId field
    const exactMatch = roster.find(a => a.usaSwimmingId?.toUpperCase() === normalized);
    if (exactMatch) return exactMatch;
    // Also check profile locks stored in localStorage (athlete may have self-registered their ID)
    for (const a of roster) {
      try {
        const lockStr = localStorage.getItem("apex-athlete-profile-lock");
        if (lockStr) {
          const lock = JSON.parse(lockStr);
          if (lock.usaSwimmingId?.toUpperCase() === normalized && lock.athleteId === a.id) return a;
        }
      } catch { /* ignore */ }
    }
    return null;
  };

  const switchChild = (id: string) => {
    const found = roster.find(a => a.id === id);
    if (found) setAthlete(found);
  };

  const parentLogout = () => {
    localStorage.removeItem("apex-parent-links");
    setLinkedChildren([]);
    setAthlete(null);
    setOnboardStep("swimid");
    setNameInput("");
    setIdInput("");
    setAddingAnother(false);
    setPendingAthlete(null);
  };

  const level = athlete ? getLevel(athlete.xp) : LEVELS[0];
  const nextLevel = athlete ? getNextLevel(athlete.xp) : LEVELS[1];
  const progress = athlete ? getLevelProgress(athlete.xp) : { percent: 0, remaining: 300 };
  const streak = athlete ? fmtStreak(athlete.streak) : fmtStreak(0);
  const achievements = useMemo(() => athlete ? getAchievements(athlete) : [], [athlete]);
  const growth = useMemo(() => athlete ? getGrowthTrend(athlete, snapshots) : null, [athlete, snapshots]);
  const earnedCount = achievements.filter(a => a.earned).length;
  const last7Days = useMemo(() => athlete ? getLast7DaysXP(athlete.id, snapshots) : [], [athlete, snapshots]);

  if (!mounted) return (
    <div className="min-h-screen bg-[#06020f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#f59e0b]/30 border-t-[#f59e0b] rounded-full animate-spin" />
    </div>
  );

  // ── PIN screen ───────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#06020f] relative overflow-hidden flex flex-col items-center justify-center px-5">
        {STYLE_TAG}
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
        {STYLE_TAG}
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
                    <button key={a.id} onClick={() => setAthlete(a)}
                      className="w-full px-5 py-3 text-left hover:bg-[#f59e0b]/10 transition-colors flex items-center justify-between border-b border-white/5 last:border-0">
                      <span className="text-white font-semibold">{a.name}</span>
                      <span className="text-xs flex items-center gap-1.5" style={{ color: lv.color }}>
                        <LevelIcon name={lv.name} size={14} color={lv.color} />
                        {lv.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* COPPA notice */}
          <div className="mt-6 p-4 rounded-xl bg-[#0a0518]/60 border border-[#00f0ff]/10">
            <div className="flex items-center gap-2 mb-1">
              <SvgShieldLock size={18} color="#00f0ff" />
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
      {STYLE_TAG}
      {showWelcome && <WelcomeOverlay name={athlete.name} levelName={level.name} levelColor={level.color} />}
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
              <span style={{ color: level.color }} className="text-sm font-bold flex items-center gap-1.5">
                <LevelIcon name={level.name} size={14} color={level.color} />
                {level.name}
              </span>
              <span className="text-white/15 text-xs">·</span>
              <span className="text-white/30 text-xs">{athlete.group.toUpperCase()}</span>
            </div>
          </div>
          <div className="w-14" />
        </div>

        {/* Level Progress — animated ring */}
        <div className="mb-6 p-5 rounded-2xl bg-[#0a0518]/80 border border-[#f59e0b]/10 text-center relative overflow-hidden">
          {/* Subtle orbit decoration */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.06 }}>
            <div className="w-48 h-48 rounded-full border border-current" style={{ color: level.color, animation: "aa-orbit 20s linear infinite" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: level.color }} />
            </div>
          </div>

          <div className="relative">
            {/* Ring progress with centered icon */}
            <div className="relative inline-block mb-3">
              <RingProgress percent={progress.percent} color={level.color} nextColor={nextLevel?.color || level.color} size={140} strokeWidth={8} />
              {/* Centered icon inside ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: "rotate(0deg)" }}>
                <LevelIcon name={level.name} size={36} color={level.color} />
                <div className="text-[10px] font-mono mt-1" style={{ color: `${level.color}80` }}>{progress.percent}%</div>
              </div>
            </div>

            <div className="text-2xl font-black text-white mb-1">{level.name}</div>
            {nextLevel ? (
              <p className="text-white/30 text-xs mb-2">
                {progress.remaining} XP until <span className="inline-flex items-center gap-1" style={{ color: nextLevel.color }}>
                  <LevelIcon name={nextLevel.name} size={12} color={nextLevel.color} />
                  {nextLevel.name}
                </span>
              </p>
            ) : (
              <p className="text-[#ef4444] text-xs font-bold mb-2">Maximum Level Reached!</p>
            )}
            {/* Keep the bar too for a secondary indicator */}
            <div className="h-2 bg-white/5 rounded-full overflow-hidden max-w-xs mx-auto">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress.percent}%`, background: `linear-gradient(90deg, ${level.color}, ${nextLevel?.color || level.color})` }} />
            </div>
            <div className="text-white/20 text-[10px] mt-2 font-mono">{athlete.xp} XP TOTAL</div>
          </div>
        </div>

        {/* Highlights Row — pulse on non-zero */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className={`p-4 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center ${athlete.streak > 0 ? "aa-value-pulse" : ""}`}
            style={athlete.streak > 0 ? { borderColor: `${streak.color}25` } : {}}>
            <div className="text-3xl font-black text-white">{athlete.streak}</div>
            <div className="text-[10px] font-mono tracking-wider" style={{ color: streak.color }}>{streak.label}</div>
            <div className="text-white/20 text-[10px]">day streak</div>
          </div>
          <div className={`p-4 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center ${athlete.totalPractices > 0 ? "aa-value-pulse" : ""}`}
            style={athlete.totalPractices > 0 ? { borderColor: "rgba(96,165,250,0.15)", animationDelay: "0.3s" } : {}}>
            <div className="text-3xl font-black text-white">{athlete.totalPractices}</div>
            <div className="text-white/30 text-[10px] font-mono tracking-wider">PRACTICES</div>
            <div className="text-white/20 text-[10px]">total</div>
          </div>
          <div className={`p-4 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center ${earnedCount > 0 ? "aa-value-pulse" : ""}`}
            style={earnedCount > 0 ? { borderColor: "rgba(245,158,11,0.15)", animationDelay: "0.6s" } : {}}>
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
            {/* Mini bar chart — last 7 days */}
            {last7Days.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="text-white/20 text-[9px] font-mono tracking-wider mb-1">DAILY XP (LAST 7 DAYS)</div>
                <MiniBarChart data={last7Days} />
              </div>
            )}
            {growth.avgDaily > 0 && (
              <div className="mt-2 pt-3 border-t border-white/5 text-center">
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
              <div key={i} className={`text-center transition-all ${badge.earned ? "aa-badge-pop" : "opacity-25"}`}
                style={badge.earned ? { animationDelay: `${i * 0.05}s` } : {}}>
                <div className={`w-11 h-11 mx-auto rounded-full flex items-center justify-center mb-1 ${badge.earned ? "aa-earned-glow" : ""}`}
                  style={badge.earned ? {
                    backgroundColor: `${badge.color}18`,
                    boxShadow: `0 0 14px ${badge.color}40, 0 0 4px ${badge.color}20`,
                    border: `1.5px solid ${badge.color}50`,
                  } : {
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}>
                  {badge.earned ? (
                    <BadgeIcon label={badge.label} size={18} color={badge.color} />
                  ) : (
                    <SvgPadlock size={14} color="#475569" />
                  )}
                </div>
                <div className="text-[9px] leading-tight" style={{ color: badge.earned ? `${badge.color}99` : "rgba(255,255,255,0.2)" }}>
                  {badge.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Encouragement Section — animated gradient */}
        <div className="p-4 rounded-xl border border-[#f59e0b]/10 aa-gradient-bg"
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(168,85,247,0.06), rgba(96,165,250,0.04), rgba(245,158,11,0.06))", backgroundSize: "200% 200%" }}>
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

        {/* Meet Day Guide */}
        <div className="mb-6 p-4 rounded-xl bg-[#0a0518]/80 border border-cyan-500/10">
          <h3 className="text-cyan-400/70 text-xs font-mono tracking-wider mb-3">MEET DAY GUIDE FOR PARENTS</h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <span className="text-emerald-400 text-xs font-bold block mb-1">BEFORE THE RACE</span>
              <ul className="text-white/40 text-sm space-y-1">
                <li>• &quot;Have fun out there&quot; — keep it simple</li>
                <li>• Avoid talking about times or expectations</li>
                <li>• Make sure they&apos;ve eaten and hydrated</li>
                <li>• Trust their coach&apos;s race plan</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <span className="text-amber-400 text-xs font-bold block mb-1">AFTER THE RACE</span>
              <ul className="text-white/40 text-sm space-y-1">
                <li>• &quot;I love watching you swim&quot; — always works</li>
                <li>• Ask how they FELT, not what their time was</li>
                <li>• Let the coach handle technique talk</li>
                <li>• Win or lose — celebrate the effort</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <span className="text-red-400/70 text-xs font-bold block mb-1">AVOID</span>
              <ul className="text-white/30 text-sm space-y-1">
                <li>• Coaching from the stands</li>
                <li>• Comparing to other swimmers</li>
                <li>• Discussing times in the car ride home</li>
                <li>• Negative body language during races</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Conversation Starters */}
        <div className="mb-6 p-4 rounded-xl bg-[#0a0518]/80 border border-violet-500/10">
          <h3 className="text-violet-400/70 text-xs font-mono tracking-wider mb-3">CONVERSATION STARTERS</h3>
          <p className="text-white/20 text-[10px] mb-3">Great questions to ask your swimmer this week:</p>
          <div className="space-y-2">
            {[
              { q: "What was the best part of practice today?", why: "Opens positive reflection" },
              { q: "Did you help a teammate with anything this week?", why: "Reinforces leadership" },
              { q: "What's one thing you're working on improving?", why: "Shows you care about growth, not just results" },
              { q: "Are you getting enough sleep before practice?", why: "Recovery matters — shows support" },
              { q: "What do you like most about being on the team?", why: "Keeps the fun in focus" },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
                <span className="text-white/60 text-sm block">&quot;{item.q}&quot;</span>
                <span className="text-violet-400/40 text-[10px]">{item.why}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COPPA Footer — SVG shield */}
        <div className="mt-8 p-3 rounded-lg bg-[#0a0518]/40 border border-[#00f0ff]/5 flex items-center gap-2">
          <SvgShieldLock size={16} color="#00f0ff" />
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
