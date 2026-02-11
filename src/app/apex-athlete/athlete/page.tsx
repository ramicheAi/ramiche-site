"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Athlete Portal (Enhanced)
   Personal dashboard: XP, level, streaks, quests, journal,
   Times/PRs, Race Prep, Coach Feedback, AM/PM indicator
   ══════════════════════════════════════════════════════════════ */

// ── game engine (mirrors coach) ─────────────────────────────
const LEVELS = [
  { name: "Rookie", xp: 0, icon: "◆", color: "#94a3b8" },
  { name: "Contender", xp: 300, icon: "◆", color: "#a78bfa" },
  { name: "Warrior", xp: 600, icon: "◆", color: "#60a5fa" },
  { name: "Elite", xp: 1000, icon: "◆", color: "#f59e0b" },
  { name: "Captain", xp: 1500, icon: "◆", color: "#f97316" },
  { name: "Legend", xp: 2500, icon: "◆", color: "#ef4444" },
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
  TIMES: "apex-athlete-times",
  FEEDBACK: "apex-athlete-feedback",
  RACE_PLANS: "apex-athlete-race-plans",
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
  mood: number;
}

interface TimeEntry {
  id: string;
  date: string;
  event: string; // e.g. "100"
  stroke: string; // e.g. "Freestyle"
  time: string; // M:SS.hh
  seconds: number;
  session: "am" | "pm";
  meet: boolean; // meet time vs practice time
  notes: string;
}

interface FeedbackEntry {
  id: string;
  date: string;
  from: string; // coach name
  type: "praise" | "tip" | "goal";
  message: string;
  read: boolean;
}

interface RacePlan {
  id: string;
  date: string;
  event: string;
  stroke: string;
  currentTime: string;
  goalTime: string;
  splits: { segment: string; time: string; pace: string; focus: string }[];
  tips: string[];
  improvement: string;
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
  { key: "attendance", label: "Attendance", color: "#60a5fa" },
  { key: "effort", label: "Effort", color: "#f59e0b" },
  { key: "improvement", label: "Improvement", color: "#34d399" },
  { key: "consistency", label: "Consistency", color: "#a855f7" },
  { key: "leadership", label: "Leadership", color: "#f97316" },
];

function calcAttributes(a: Athlete) {
  const attended = a.totalPractices || 1;
  const attendance = Math.min(100, Math.round((attended / Math.max(attended, a.weekTarget * 4)) * 100));
  // Effort = weighted combination of: total checkpoints completed across all sessions,
  // bonus reps earned, weight room extra sets, and streak consistency
  const totalCpDone = Object.values(a.checkpoints).filter(Boolean).length;
  const weightCpDone = Object.values(a.weightCheckpoints || {}).filter(Boolean).length;
  const meetCpDone = Object.values(a.meetCheckpoints || {}).filter(Boolean).length;
  const hasBonusRep = a.checkpoints["bonus-rep"] ? 1 : 0;
  const hasExtraSets = (a.weightCheckpoints || {})["w-extra-sets"] ? 1 : 0;
  const effortScore = totalCpDone + weightCpDone + meetCpDone + (hasBonusRep * 5) + (hasExtraSets * 5) + Math.min(a.streak, 14);
  const effort = Math.min(100, Math.round((effortScore / 35) * 100));
  const improvement = Math.min(100, Math.round((a.xp / 2500) * 100));
  const consistency = Math.min(100, Math.round((a.streak / 30) * 100));
  const questsDone = Object.values(a.quests).filter(v => v === "done").length;
  const leadership = Math.min(100, Math.round((questsDone / 5) * 100));
  return { attendance, effort, improvement, consistency, leadership };
}

// ── SVG Tab Icons ───────────────────────────────────────────
function StatsIcon({ active }: { active: boolean }) {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>);
}
function QuestsIcon({ active }: { active: boolean }) {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
}
function TimerIcon({ active }: { active: boolean }) {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#00f0ff" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M10 2h4"/></svg>);
}
function TargetIcon({ active }: { active: boolean }) {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#ef4444" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>);
}
function JournalIcon({ active }: { active: boolean }) {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>);
}
function MessageIcon({ active }: { active: boolean }) {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#f59e0b" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>);
}
function BoardIcon({ active }: { active: boolean }) {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>);
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
      {gridLevels.map(level => (
        <polygon key={level} points={points(r * level).map(p => p.join(",")).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      ))}
      {attrs.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)}
          stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
      })}
      <polygon points={dataPoints.map(p => p.join(",")).join(" ")}
        fill="rgba(168,85,247,0.15)" stroke="#a855f7" strokeWidth="1.5" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={attrs[i].color} />
      ))}
      {attrs.map((a, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const lx = cx + (r + 18) * Math.cos(angle);
        const ly = cy + (r + 18) * Math.sin(angle);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.4)" fontSize="7" fontWeight="600">
            {values[a.key] || 0}
          </text>
        );
      })}
    </svg>
  );
}

// ── Race strategy helpers ───────────────────────────────────
const EVENTS = ["50", "100", "200", "400", "500", "800", "1000", "1500", "1650"];
const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"];

function parseTime(t: string): number | null {
  const parts = t.replace(/[^0-9:.]/g, "").split(/[:.]/).map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 100;
  if (parts.length === 1 && parts[0] > 0) return parts[0];
  return null;
}
function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, "0")}` : `${s.toFixed(2)}`;
}

// ── Main component ──────────────────────────────────────────
type TabKey = "dashboard" | "times" | "raceprep" | "quests" | "journal" | "feedback" | "leaderboard" | "wellness";

export default function AthletePortal() {
  const [mounted, setMounted] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  // Onboarding: athlete registers once with name + ID, then locked to their profile
  const [onboardStep, setOnboardStep] = useState<"name" | "confirm">("name");
  const [nameInput, setNameInput] = useState("");
  const [idInput, setIdInput] = useState(""); // USA Swimming ID or team-assigned number
  const [onboardError, setOnboardError] = useState("");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalDraft, setJournalDraft] = useState<JournalEntry>({ date: "", wentWell: "", workOn: "", goals: "", mood: 3 });
  // Wellness state
  const [wellnessCheckin, setWellnessCheckin] = useState<{energy:number;sleep:number;mood:number;nutrition:number;confidence:number}>({energy:3,sleep:3,mood:3,nutrition:3,confidence:3});
  const [breathPhase, setBreathPhase] = useState<"idle"|"inhale"|"hold"|"exhale">("idle");
  const [breathCount, setBreathCount] = useState(0);
  const [breathTimer, setBreathTimer] = useState(0);
  const [activeMeditation, setActiveMeditation] = useState<string|null>(null);
  const [searchResults, setSearchResults] = useState<Athlete[]>([]);
  // Auto-detect AM/PM from schedule (same logic as coach portal)
  const [sessionTime, setSessionTime] = useState<"am" | "pm">(() => {
    if (typeof window === "undefined") return "pm";
    try {
      const schedules = JSON.parse(localStorage.getItem("apex-athlete-schedules-v1") || "[]");
      const now = new Date();
      const dayMap: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
      const dayKey = dayMap[now.getDay()];
      const nowMins = now.getHours() * 60 + now.getMinutes();
      for (const gs of schedules) {
        const day = gs.weekSchedule?.[dayKey];
        if (!day?.sessions?.length) continue;
        for (const sess of day.sessions) {
          const [sh, sm] = sess.startTime.split(":").map(Number);
          const [eh, em] = sess.endTime.split(":").map(Number);
          if (nowMins >= sh * 60 + sm - 30 && nowMins <= eh * 60 + em) return sh < 12 ? "am" as const : "pm" as const;
        }
      }
    } catch {}
    return new Date().getHours() < 12 ? "am" as const : "pm" as const;
  });

  // Times state
  const [times, setTimes] = useState<TimeEntry[]>([]);
  const [newTime, setNewTime] = useState({ event: "100", stroke: "Freestyle", time: "", meet: false, notes: "" });

  // Race prep state — auto-fills current time from PR when event/stroke changes
  const [racePlans, setRacePlans] = useState<RacePlan[]>([]);
  const [rpEvent, setRpEvent] = useState("100");
  const [rpStroke, setRpStroke] = useState("Freestyle");
  const [rpCurrent, setRpCurrent] = useState("");
  const [rpGoal, setRpGoal] = useState("");
  const [rpAutoFilled, setRpAutoFilled] = useState(false);
  const [rpResult, setRpResult] = useState<RacePlan | null>(null);

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);

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
    // Check for saved profile lock — if athlete already onboarded, auto-load their profile
    const saved = localStorage.getItem("apex-athlete-profile-lock");
    if (saved) {
      try {
        const lock = JSON.parse(saved) as { athleteId: string; name: string };
        const found = r.find(a => a.id === lock.athleteId);
        if (found) loadAthleteData(found);
      } catch {}
    }
  }, [mounted]);

  // Name search — only used during onboarding, matches name + shows for confirmation
  useEffect(() => {
    if (nameInput.length < 2) { setSearchResults([]); return; }
    const q = nameInput.toLowerCase();
    setSearchResults(roster.filter(a => a.name.toLowerCase().includes(q)).slice(0, 8));
  }, [nameInput, roster]);

  const loadAthleteData = (a: Athlete) => {
    setAthlete(a);
    setNameInput("");
    setSearchResults([]);
    setJournal(load<JournalEntry[]>(`${K.JOURNAL}-${a.id}`, []));
    setTimes(load<TimeEntry[]>(`${K.TIMES}-${a.id}`, []));
    setFeedback(load<FeedbackEntry[]>(`${K.FEEDBACK}-${a.id}`, []));
    setRacePlans(load<RacePlan[]>(`${K.RACE_PLANS}-${a.id}`, []));
  };

  const completeOnboarding = (a: Athlete) => {
    // Save profile lock — this device is now locked to this athlete
    localStorage.setItem("apex-athlete-profile-lock", JSON.stringify({ athleteId: a.id, name: a.name }));
    loadAthleteData(a);
  };

  const logout = () => {
    localStorage.removeItem("apex-athlete-profile-lock");
    setAthlete(null);
    setOnboardStep("name");
    setNameInput("");
    setIdInput("");
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

  // Save a new time entry
  const saveTime = () => {
    if (!athlete || !newTime.time) return;
    const seconds = parseTime(newTime.time);
    if (!seconds) return;
    const entry: TimeEntry = {
      id: `t-${Date.now()}`,
      date: todayStr,
      event: newTime.event,
      stroke: newTime.stroke,
      time: newTime.time,
      seconds,
      session: sessionTime,
      meet: newTime.meet,
      notes: newTime.notes,
    };
    const updated = [entry, ...times];
    setTimes(updated);
    save(`${K.TIMES}-${athlete.id}`, updated);
    setNewTime({ event: "100", stroke: "Freestyle", time: "", meet: false, notes: "" });
  };

  // Get personal records (best time per event+stroke combo)
  const personalRecords = useMemo(() => {
    const prMap = new Map<string, TimeEntry>();
    times.forEach(t => {
      const key = `${t.event}-${t.stroke}`;
      const existing = prMap.get(key);
      if (!existing || t.seconds < existing.seconds) prMap.set(key, t);
    });
    return Array.from(prMap.values()).sort((a, b) => {
      const eventDiff = parseInt(a.event) - parseInt(b.event);
      return eventDiff !== 0 ? eventDiff : a.stroke.localeCompare(b.stroke);
    });
  }, [times]);

  // Generate race strategy
  const generateRacePrep = () => {
    const current = parseTime(rpCurrent);
    const goal = parseTime(rpGoal);
    if (!current || !goal || goal >= current) return;

    const dist = parseInt(rpEvent);
    const splitCount = dist <= 100 ? 2 : dist <= 200 ? 4 : dist <= 400 ? 4 : Math.min(8, Math.ceil(dist / 100));
    const segLen = dist / splitCount;
    const improvement = ((current - goal) / current * 100).toFixed(1);
    const timeDrop = current - goal;

    const pacePatterns: Record<string, number[]> = {
      "50": [0.48, 0.52], "100": [0.48, 0.52],
      "200": [0.24, 0.25, 0.25, 0.26], "400": [0.24, 0.25, 0.26, 0.25],
    };
    const pattern = pacePatterns[rpEvent] || Array(splitCount).fill(1 / splitCount);
    const focuses = [
      "Explosive start — fast off the block, tight streamline",
      "Build speed — long strokes, high elbow catch",
      "Hold pace — breathing pattern locked, core engaged",
      "Maintain rhythm — efficient turns, minimize drag",
      "Negative split — push through, strong kick",
      "Final push — all-out effort, head down, race the wall",
      "Strong finish — accelerate into the wall, no glide",
      "Close it out — empty the tank, touch strong",
    ];

    const splits: { segment: string; time: string; pace: string; focus: string }[] = [];
    for (let i = 0; i < splitCount; i++) {
      const splitTime = goal * pattern[i % pattern.length];
      splits.push({
        segment: `${Math.round(segLen * i)}m – ${Math.round(segLen * (i + 1))}m`,
        time: fmtTime(splitTime),
        pace: `${(splitTime / segLen * 100).toFixed(1)}s/100m`,
        focus: focuses[i % focuses.length],
      });
    }

    const tips = [
      `Drop ${timeDrop.toFixed(2)}s from your ${rpEvent}m ${rpStroke} — that's ${improvement}% faster`,
      dist >= 200 ? "Negative split strategy: go out controlled, finish strong" : "Fast start, maintain through the back half",
      rpStroke === "Freestyle" ? "Focus on stroke rate consistency — count strokes per length" :
        rpStroke === "Butterfly" ? "Two strong kicks per stroke — especially off the walls" :
        rpStroke === "Backstroke" ? "Tight backstroke flags count — nail the turns" :
        rpStroke === "Breaststroke" ? "Maximize underwater pullout distance off each wall" :
        "Transition speed between strokes — especially fly-to-back",
      "Underwater breakouts are free speed — hold streamline past the flags",
      "Visualize the race: see yourself hitting each split, finishing strong",
    ];

    const plan: RacePlan = {
      id: `rp-${Date.now()}`, date: todayStr,
      event: rpEvent, stroke: rpStroke,
      currentTime: rpCurrent, goalTime: rpGoal,
      splits, tips, improvement,
    };

    setRpResult(plan);
    if (athlete) {
      const updated = [plan, ...racePlans.slice(0, 9)];
      setRacePlans(updated);
      save(`${K.RACE_PLANS}-${athlete.id}`, updated);
    }
  };

  // Auto-fill race prep "current time" from PR when event/stroke changes
  useEffect(() => {
    if (!athlete || times.length === 0) return;
    const pr = times.filter(t => t.event === rpEvent && t.stroke === rpStroke).sort((a, b) => a.seconds - b.seconds)[0];
    if (pr && !rpAutoFilled) { setRpCurrent(pr.time); setRpAutoFilled(true); }
  }, [rpEvent, rpStroke, times, athlete, rpAutoFilled]);
  // Reset auto-fill flag when event/stroke changes
  useEffect(() => { setRpAutoFilled(false); }, [rpEvent, rpStroke]);

  // Leaderboard (top 10, gender-based, with athlete rank)
  const { leaderboard, athleteRank, athleteInTop10 } = useMemo(() => {
    if (!athlete) return { leaderboard: [] as Athlete[], athleteRank: 0, athleteInTop10: true };
    const genderFiltered = roster
      .filter(a => a.gender === athlete.gender && a.group === athlete.group)
      .sort((a, b) => b.xp - a.xp);
    const rank = genderFiltered.findIndex(a => a.id === athlete.id) + 1;
    const top10 = genderFiltered.slice(0, 10);
    const inTop10 = top10.some(a => a.id === athlete.id);
    return { leaderboard: top10, athleteRank: rank, athleteInTop10: inTop10 };
  }, [athlete, roster]);

  // Unread feedback count
  const unreadCount = feedback.filter(f => !f.read).length;

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

  // ── Onboarding: athlete registers once, then locked to their profile ──
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
            </svg>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Welcome, Athlete</h1>
            <p className="text-white/30 text-sm">{onboardStep === "name" ? "Find your profile to get started" : "Confirm your identity"}</p>
          </div>

          {onboardStep === "name" && (
            <div>
              <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2 block">Your Name</label>
              <div className="relative">
                <input type="text" value={nameInput} onChange={e => { setNameInput(e.target.value); setOnboardError(""); }}
                  placeholder="Start typing your name..."
                  className="w-full px-5 py-4 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl text-white text-lg placeholder:text-white/20 focus:outline-none focus:border-[#a855f7]/50 transition-all"
                  autoFocus />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl overflow-hidden z-50">
                    {searchResults.map(a => {
                      const lv = getLevel(a.xp);
                      return (
                        <button key={a.id} onClick={() => { setNameInput(a.name); setSearchResults([]); setOnboardStep("confirm"); }}
                          className="w-full px-5 py-3 text-left hover:bg-[#a855f7]/10 transition-colors flex items-center justify-between border-b border-white/5 last:border-0">
                          <div>
                            <span className="text-white font-semibold">{a.name}</span>
                            <span className="text-white/20 text-xs ml-2">{a.group.toUpperCase()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: lv.color }}>{lv.icon} {lv.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {onboardError && <p className="text-red-400 text-xs mt-3">{onboardError}</p>}
              <p className="text-white/15 text-xs mt-4 text-center">Select your name from the list. If you don&apos;t see yourself, ask your coach to add you.</p>
            </div>
          )}

          {onboardStep === "confirm" && (
            <div>
              {(() => {
                const match = roster.find(a => a.name === nameInput);
                if (!match) return <p className="text-red-400 text-sm">Athlete not found. Go back and try again.</p>;
                const lv = getLevel(match.xp);
                return (
                  <div className="space-y-4">
                    <div className="bg-[#0a0518] border border-[#a855f7]/20 rounded-xl p-5 text-center">
                      <p className="text-white font-bold text-xl mb-1">{match.name}</p>
                      <p className="text-white/30 text-sm mb-3">{match.group.toUpperCase()} · Age {match.age}</p>
                      <span className="text-sm font-bold" style={{ color: lv.color }}>{lv.icon} {lv.name} · {match.xp} XP</span>
                    </div>
                    <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2 block">Athlete ID / USA Swimming #</label>
                    <input type="text" value={idInput} onChange={e => { setIdInput(e.target.value); setOnboardError(""); }}
                      placeholder="Enter your athlete ID..."
                      className="w-full px-5 py-4 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl text-white text-lg placeholder:text-white/20 focus:outline-none focus:border-[#a855f7]/50 transition-all text-center tracking-wider"
                      autoFocus />
                    {onboardError && <p className="text-red-400 text-xs mt-2">{onboardError}</p>}
                    <button onClick={() => {
                      if (!idInput.trim()) { setOnboardError("Enter your athlete ID to verify your identity"); return; }
                      // For now, accept any non-empty ID (coach will assign real IDs later via Firebase)
                      // Save the ID with the profile lock for future verification
                      localStorage.setItem("apex-athlete-profile-lock", JSON.stringify({ athleteId: match.id, name: match.name, swimId: idInput.trim() }));
                      completeOnboarding(match);
                    }}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white font-bold text-lg hover:brightness-110 transition-all">
                      Confirm &amp; Enter
                    </button>
                    <button onClick={() => { setOnboardStep("name"); setNameInput(""); setIdInput(""); }}
                      className="w-full py-2 text-white/30 text-sm hover:text-white/50 transition-colors">
                      ← That&apos;s not me
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="text-center mt-8">
            <Link href="/apex-athlete/portal" className="text-white/20 text-sm hover:text-white/40 transition-colors">← Back to Portal Selector</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Tab definitions ─────────────────────────────────────
  const TABS: { key: TabKey; label: string; icon: (active: boolean) => React.ReactNode; badge?: number }[] = [
    { key: "dashboard", label: "Stats", icon: (a) => <StatsIcon active={a} /> },
    { key: "times", label: "Times", icon: (a) => <TimerIcon active={a} /> },
    { key: "raceprep", label: "Race", icon: (a) => <TargetIcon active={a} /> },
    { key: "quests", label: "Quests", icon: (a) => <QuestsIcon active={a} /> },
    { key: "journal", label: "Log", icon: (a) => <JournalIcon active={a} /> },
    { key: "feedback", label: "Coach", icon: (a) => <MessageIcon active={a} />, badge: unreadCount },
    { key: "leaderboard", label: "Board", icon: (a) => <BoardIcon active={a} /> },
    { key: "wellness", label: "Mind", icon: (a) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a?"#a855f7":"currentColor"} strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> },
  ];

  // ── Main dashboard ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#06020f] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header + AM/PM indicator */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={logout} className="text-white/30 hover:text-white/60 text-sm transition-colors">Sign Out</button>
          <div className="text-center">
            <h2 className="text-white font-bold text-lg">{athlete.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span style={{ color: level.color }} className="text-sm font-bold">{level.icon} {level.name}</span>
              <span className="text-white/15 text-xs">·</span>
              <span className="text-white/30 text-xs">{athlete.group.toUpperCase()}</span>
            </div>
          </div>
          {/* AM/PM Toggle */}
          <button onClick={() => setSessionTime(sessionTime === "am" ? "pm" : "am")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider transition-all duration-200 active:scale-95 ${
              sessionTime === "am"
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
            }`}>
            {sessionTime === "am" ? "☀ AM" : "☽ PM"}
          </button>
        </div>

        {/* XP Bar */}
        <div className="mb-4 p-3 rounded-xl bg-[#0a0518]/80 border border-[#a855f7]/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/40 text-xs font-mono">XP: {athlete.xp}</span>
            {nextLevel ? (
              <span className="text-xs" style={{ color: nextLevel.color }}>{nextLevel.icon} {nextLevel.name} in {progress.remaining} XP</span>
            ) : (
              <span className="text-[#ef4444] text-xs font-bold">MAX LEVEL</span>
            )}
          </div>
          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress.percent}%`, background: `linear-gradient(90deg, ${level.color}, ${nextLevel?.color || level.color})` }} />
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2.5 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-xl font-black text-white">{athlete.streak}</div>
            <div className="text-[9px] font-mono tracking-wider" style={{ color: streak.color }}>{streak.label}</div>
            <div className="text-white/15 text-[9px]">{streak.mult}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-xl font-black text-white">{athlete.totalPractices}</div>
            <div className="text-white/25 text-[9px] font-mono tracking-wider">PRACTICES</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-xl font-black text-white">{athlete.weekSessions}/{athlete.weekTarget}</div>
            <div className="text-white/25 text-[9px] font-mono tracking-wider">THIS WEEK</div>
          </div>
        </div>

        {/* Tab Navigation — scrollable on mobile */}
        <div className="flex gap-0.5 mb-5 bg-[#0a0518]/50 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-2 text-[10px] font-bold rounded-lg transition-all relative ${
                tab === t.key ? "bg-[#a855f7]/20 text-[#a855f7]" : "text-white/30 hover:text-white/50"
              }`}>
              {t.icon(tab === t.key)}
              <span>{t.label}</span>
              {t.badge && t.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ef4444] rounded-full text-white text-[8px] font-black flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════ DASHBOARD TAB ══════════════ */}
        {tab === "dashboard" && attrs && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#a855f7]/10">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3 text-center">ATTRIBUTE RADAR</h3>
              <RadarChart values={attrs} />
              <div className="grid grid-cols-5 gap-1 mt-3">
                {ATTRIBUTES.map(a => (
                  <div key={a.key} className="text-center">
                    <div className="text-[10px] text-white/30">{a.label}</div>
                    <div className="text-xs font-bold" style={{ color: a.color }}>{attrs[a.key as keyof typeof attrs]}</div>
                  </div>
                ))}
              </div>
            </div>

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

        {/* ══════════════ TIMES / PR TAB ══════════════ */}
        {tab === "times" && (
          <div className="space-y-4">
            {/* Log new time */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#00f0ff]/10">
              <h3 className="text-[#00f0ff] text-xs font-mono tracking-wider mb-3 flex items-center gap-2">
                <TimerIcon active={true} /> LOG A TIME
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <select value={newTime.event} onChange={e => setNewTime(p => ({ ...p, event: e.target.value }))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30">
                  {EVENTS.map(e => <option key={e} value={e}>{e}m</option>)}
                </select>
                <select value={newTime.stroke} onChange={e => setNewTime(p => ({ ...p, stroke: e.target.value }))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30">
                  {STROKES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input type="text" placeholder="Time (M:SS.hh)" value={newTime.time}
                  onChange={e => setNewTime(p => ({ ...p, time: e.target.value }))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#00f0ff]/30" />
                <button onClick={() => setNewTime(p => ({ ...p, meet: !p.meet }))}
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold border transition-all ${
                    newTime.meet ? "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30" : "bg-white/5 text-white/30 border-white/10"
                  }`}>
                  {newTime.meet ? "MEET TIME" : "PRACTICE"}
                </button>
              </div>
              <input type="text" placeholder="Notes (optional)" value={newTime.notes}
                onChange={e => setNewTime(p => ({ ...p, notes: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#00f0ff]/30 mb-3" />
              <button onClick={saveTime} disabled={!newTime.time}
                className="w-full py-2.5 rounded-lg bg-[#00f0ff]/15 border border-[#00f0ff]/25 text-[#00f0ff] text-sm font-bold disabled:opacity-30 hover:bg-[#00f0ff]/25 transition-all">
                Save Time
              </button>
            </div>

            {/* Personal Records */}
            {personalRecords.length > 0 && (
              <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#f59e0b]/10">
                <h3 className="text-[#f59e0b] text-xs font-mono tracking-wider mb-3">PERSONAL RECORDS</h3>
                <div className="space-y-2">
                  {personalRecords.map(pr => (
                    <div key={`${pr.event}-${pr.stroke}`} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <div>
                        <span className="text-white text-sm font-bold">{pr.event}m {pr.stroke}</span>
                        {pr.meet && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] font-bold">MEET</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-[#00f0ff] font-mono font-bold">{pr.time}</span>
                        <span className="text-white/20 text-[10px] block">{pr.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent times */}
            {times.length > 0 && (
              <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5">
                <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">RECENT TIMES</h3>
                <div className="space-y-1.5">
                  {times.slice(0, 10).map(t => {
                    const isPR = personalRecords.some(pr => pr.id === t.id);
                    return (
                      <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg ${isPR ? "bg-[#f59e0b]/5 border border-[#f59e0b]/15" : "bg-white/[0.01]"}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-white/60 text-xs">{t.event}m {t.stroke}</span>
                          {isPR && <span className="text-[7px] px-1 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] font-black">PR</span>}
                          {t.meet && <span className="text-[7px] px-1 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] font-bold">MEET</span>}
                          <span className="text-white/15 text-[9px]">{t.session.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono text-sm">{t.time}</span>
                          <span className="text-white/15 text-[9px]">{t.date}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {times.length === 0 && (
              <div className="text-center py-10 text-white/15 text-sm">
                No times logged yet. Add your first time above.
              </div>
            )}
          </div>
        )}

        {/* ══════════════ RACE PREP TAB ══════════════ */}
        {tab === "raceprep" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#ef4444]/10">
              <h3 className="text-[#ef4444] text-xs font-mono tracking-wider mb-3 flex items-center gap-2">
                <TargetIcon active={true} /> RACE STRATEGY BUILDER
              </h3>
              <p className="text-white/20 text-[10px] mb-4">Plan your race. Visualize every split. Race with confidence.</p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <select value={rpEvent} onChange={e => setRpEvent(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ef4444]/30">
                  {EVENTS.map(e => <option key={e} value={e}>{e}m</option>)}
                </select>
                <select value={rpStroke} onChange={e => setRpStroke(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#ef4444]/30">
                  {STROKES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-white/25 text-[9px] font-mono block mb-1">CURRENT BEST</label>
                  <input type="text" placeholder="1:05.30" value={rpCurrent}
                    onChange={e => setRpCurrent(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#ef4444]/30" />
                </div>
                <div>
                  <label className="text-white/25 text-[9px] font-mono block mb-1">GOAL TIME</label>
                  <input type="text" placeholder="1:02.00" value={rpGoal}
                    onChange={e => setRpGoal(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#ef4444]/30" />
                </div>
              </div>
              <button onClick={generateRacePrep} disabled={!rpCurrent || !rpGoal}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#ef4444]/20 to-[#f59e0b]/20 border border-[#ef4444]/25 text-white text-sm font-bold disabled:opacity-30 hover:border-[#ef4444]/40 transition-all">
                GENERATE RACE PLAN
              </button>
            </div>

            {/* Race plan result */}
            {rpResult && (
              <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#00f0ff]/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#00f0ff] text-xs font-mono tracking-wider">RACE MAP — {rpResult.event}m {rpResult.stroke}</h3>
                  <span className="text-emerald-400 text-xs font-bold">-{rpResult.improvement}%</span>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15 mb-4">
                  <div className="text-emerald-400 text-sm font-bold">{rpResult.currentTime} → {rpResult.goalTime}</div>
                  <div className="text-white/30 text-[10px]">You&apos;ve got this. Visualize every split.</div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {rpResult.splits.map((sp, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 items-center py-2 px-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
                      <span className="text-[#00f0ff] font-mono font-bold">{sp.segment}</span>
                      <span className="text-white font-bold">{sp.time}</span>
                      <span className="text-white/30 font-mono">{sp.pace}</span>
                      <span className="text-white/40 text-[10px]">{sp.focus}</span>
                    </div>
                  ))}
                </div>

                <h4 className="text-[#f59e0b] text-[10px] font-mono tracking-wider mb-2">RACE TIPS</h4>
                <div className="space-y-2">
                  {rpResult.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-[#f59e0b] font-bold shrink-0">{i + 1}.</span>
                      <span className="text-white/50">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past race plans */}
            {racePlans.length > 0 && !rpResult && (
              <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5">
                <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">SAVED RACE PLANS</h3>
                <div className="space-y-2">
                  {racePlans.slice(0, 5).map(rp => (
                    <button key={rp.id} onClick={() => setRpResult(rp)}
                      className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/5 text-left hover:border-[#ef4444]/20 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-bold">{rp.event}m {rp.stroke}</span>
                        <span className="text-white/20 text-[10px]">{rp.date}</span>
                      </div>
                      <div className="text-white/30 text-xs mt-1">{rp.currentTime} → {rp.goalTime} ({rp.improvement}% drop)</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ QUESTS TAB ══════════════ */}
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
                        {status === "done" ? "COMPLETE" : status === "active" ? "ACTIVE" : "LOCKED"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-white/15 text-[10px] text-center mt-4">Quests are assigned and approved by your coach</p>
          </div>
        )}

        {/* ══════════════ JOURNAL TAB ══════════════ */}
        {tab === "journal" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#a855f7]/10">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">TODAY&apos;S REFLECTION</h3>
              <div className="flex items-center gap-1 mb-4 justify-center">
                {[1, 2, 3, 4, 5].map(m => (
                  <button key={m} onClick={() => setJournalDraft(d => ({ ...d, mood: m }))}
                    className={`w-10 h-10 rounded-lg border text-lg transition-all ${
                      journalDraft.mood === m ? "border-[#a855f7]/40 bg-[#a855f7]/10 scale-110" : "border-white/5 opacity-30"
                    }`}>
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

        {/* ══════════════ COACH FEEDBACK TAB ══════════════ */}
        {tab === "feedback" && (
          <div className="space-y-4">
            <h3 className="text-[#f59e0b] text-xs font-mono tracking-wider mb-2 flex items-center gap-2">
              <MessageIcon active={true} /> COACH FEEDBACK
            </h3>

            {feedback.length === 0 ? (
              <div className="text-center py-10">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-white/20 text-sm">No feedback yet</p>
                <p className="text-white/10 text-[10px] mt-1">Your coach will send feedback after practices and meets</p>
              </div>
            ) : (
              <div className="space-y-2">
                {feedback.map(f => {
                  const typeColors = {
                    praise: { bg: "bg-emerald-500/5", border: "border-emerald-500/15", label: "PRAISE", labelColor: "text-emerald-400", icon: "★" },
                    tip: { bg: "bg-[#00f0ff]/5", border: "border-[#00f0ff]/15", label: "TIP", labelColor: "text-[#00f0ff]", icon: "→" },
                    goal: { bg: "bg-[#f59e0b]/5", border: "border-[#f59e0b]/15", label: "GOAL", labelColor: "text-[#f59e0b]", icon: "◎" },
                  };
                  const style = typeColors[f.type];
                  return (
                    <div key={f.id} className={`p-3.5 rounded-xl ${style.bg} border ${style.border} ${!f.read ? "ring-1 ring-[#a855f7]/20" : ""}`}
                      onClick={() => {
                        if (!f.read && athlete) {
                          const updated = feedback.map(fb => fb.id === f.id ? { ...fb, read: true } : fb);
                          setFeedback(updated);
                          save(`${K.FEEDBACK}-${athlete.id}`, updated);
                        }
                      }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${style.labelColor}`}>{style.icon}</span>
                          <span className={`text-[9px] font-mono font-bold tracking-wider ${style.labelColor}`}>{style.label}</span>
                          {!f.read && <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />}
                        </div>
                        <span className="text-white/15 text-[9px]">{f.date}</span>
                      </div>
                      <p className="text-white/60 text-sm">{f.message}</p>
                      <p className="text-white/20 text-[9px] mt-1.5">— {f.from}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ LEADERBOARD TAB ══════════════ */}
        {tab === "leaderboard" && (
          <div className="space-y-2">
            <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">TOP 10 — {athlete.gender === "F" ? "GIRLS" : "BOYS"}</h3>
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
                      {a.name} {isMe && <span className="text-[#a855f7] text-[10px] ml-1 px-1.5 py-0.5 rounded bg-[#a855f7]/15 border border-[#a855f7]/25">YOU</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span style={{ color: lv.color }} className="text-xs">{lv.icon}</span>
                    <span className="text-white/40 text-xs font-mono">{a.xp} XP</span>
                    {a.streak >= 3 && <span className="text-[10px] text-[#ef4444]">{a.streak}d</span>}
                  </div>
                </div>
              );
            })}
            {!athleteInTop10 && athlete && (() => {
              const lv = getLevel(athlete.xp);
              return (
                <>
                  <div className="text-center text-white/15 text-xs font-mono py-1">...</div>
                  <div className="flex items-center gap-3 p-3 rounded-xl border transition-all bg-[#a855f7]/10 border-[#a855f7]/20">
                    <div className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-black bg-white/5 text-white/20">
                      {athleteRank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate block text-white">
                        {athlete.name} <span className="text-[#a855f7] text-[10px] ml-1 px-1.5 py-0.5 rounded bg-[#a855f7]/15 border border-[#a855f7]/25">YOU</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{ color: lv.color }} className="text-xs">{lv.icon}</span>
                      <span className="text-white/40 text-xs font-mono">{athlete.xp} XP</span>
                      {athlete.streak >= 3 && <span className="text-[10px] text-[#ef4444]">{athlete.streak}d</span>}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ══════════════ WELLNESS TAB ══════════════ */}
        {tab === "wellness" && (
          <div className="space-y-4">
            {/* Pre/Post Check-In */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-emerald-500/10">
              <h3 className="text-emerald-400/70 text-xs font-mono tracking-wider mb-3">PRE-PRACTICE CHECK-IN</h3>
              <div className="space-y-3">
                {[
                  { key: "energy" as const, label: "ENERGY", emoji: ["😴","😐","🙂","💪","🔥"] },
                  { key: "sleep" as const, label: "SLEEP", emoji: ["😵","😴","😊","😌","🌟"] },
                  { key: "mood" as const, label: "MOOD", emoji: ["😞","😐","🙂","😄","🤩"] },
                  { key: "nutrition" as const, label: "NUTRITION", emoji: ["🚫","😬","🍎","💚","🏆"] },
                  { key: "confidence" as const, label: "CONFIDENCE", emoji: ["😰","😟","😊","😤","🫡"] },
                ].map(metric => (
                  <div key={metric.key}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white/40 text-[10px] font-mono tracking-wider">{metric.label}</span>
                      <span className="text-lg">{metric.emoji[wellnessCheckin[metric.key] - 1]}</span>
                    </div>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(v => (
                        <button key={v} onClick={() => setWellnessCheckin(prev => ({...prev, [metric.key]: v}))}
                          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                            wellnessCheckin[metric.key] >= v
                              ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                              : "bg-white/5 text-white/20 border border-white/5"
                          }`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {(() => {
                  const avg = Object.values(wellnessCheckin).reduce((a,b) => a+b, 0) / 5;
                  const readiness = Math.round(avg * 20);
                  return (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                      <span className="text-white/40 text-[10px] font-mono tracking-wider">READINESS SCORE</span>
                      <div className={`text-3xl font-black mt-1 ${readiness >= 80 ? "text-emerald-400" : readiness >= 60 ? "text-amber-400" : "text-red-400"}`}>
                        {readiness}%
                      </div>
                      <span className="text-white/25 text-[10px]">
                        {readiness >= 80 ? "LOCKED IN — go all out today" : readiness >= 60 ? "SOLID — focus on technique" : "LOW BATTERY — listen to your body"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Breathwork Timer */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-cyan-500/10">
              <h3 className="text-cyan-400/70 text-xs font-mono tracking-wider mb-3">BOX BREATHING</h3>
              <p className="text-white/25 text-[10px] mb-3">4 seconds in · 4 hold · 4 out · 4 hold. Calms your nervous system before races.</p>
              <div className="flex flex-col items-center">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center border-2 transition-all duration-1000 ${
                  breathPhase === "idle" ? "border-white/10" :
                  breathPhase === "inhale" ? "border-cyan-400 scale-110 bg-cyan-500/10" :
                  breathPhase === "hold" ? "border-amber-400 bg-amber-500/5" :
                  "border-indigo-400 scale-90 bg-indigo-500/10"
                }`}>
                  <div className="text-center">
                    <div className="text-2xl font-black text-white">{breathPhase === "idle" ? "—" : breathTimer}</div>
                    <div className={`text-[10px] font-mono tracking-wider mt-1 ${
                      breathPhase === "idle" ? "text-white/30" :
                      breathPhase === "inhale" ? "text-cyan-400" :
                      breathPhase === "hold" ? "text-amber-400" :
                      "text-indigo-400"
                    }`}>
                      {breathPhase === "idle" ? "TAP TO START" : breathPhase.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  {breathPhase === "idle" ? (
                    <button onClick={() => {
                      setBreathPhase("inhale");
                      setBreathTimer(4);
                      setBreathCount(0);
                      let phase: "inhale"|"hold"|"exhale" = "inhale";
                      let holdNum = 0;
                      let t = 4;
                      const iv = setInterval(() => {
                        t--;
                        if (t <= 0) {
                          if (phase === "inhale") { phase = "hold"; holdNum = 1; t = 4; }
                          else if (phase === "hold" && holdNum === 1) { phase = "exhale"; t = 4; }
                          else if (phase === "exhale") { phase = "hold"; holdNum = 2; t = 4; }
                          else { phase = "inhale"; holdNum = 0; t = 4; setBreathCount(c => c + 1); }
                          setBreathPhase(phase === "hold" ? "hold" : phase);
                        }
                        setBreathTimer(t);
                      }, 1000);
                      (window as unknown as Record<string,unknown>).__breathIv = iv;
                    }}
                      className="px-6 py-2.5 bg-cyan-500/20 text-cyan-300 rounded-xl text-xs font-bold border border-cyan-500/30 active:scale-95">
                      START BREATHING
                    </button>
                  ) : (
                    <button onClick={() => {
                      clearInterval((window as unknown as Record<string,unknown>).__breathIv as number);
                      setBreathPhase("idle");
                    }}
                      className="px-6 py-2.5 bg-red-500/20 text-red-300 rounded-xl text-xs font-bold border border-red-500/30 active:scale-95">
                      STOP
                    </button>
                  )}
                </div>
                {breathCount > 0 && <span className="text-white/20 text-[10px] mt-2">{breathCount} cycles completed</span>}
              </div>
            </div>

            {/* Meditation Library */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-violet-500/10">
              <h3 className="text-violet-400/70 text-xs font-mono tracking-wider mb-3">GUIDED MEDITATIONS</h3>
              <div className="space-y-2">
                {[
                  { id: "pre-race", title: "Pre-Race Focus", duration: "3 min", desc: "Clear your mind. Visualize your race. Lock in.", icon: "🎯", steps: ["Close your eyes. Take 3 deep breaths.", "Picture the pool. Feel the blocks under your feet.", "Visualize your start — explosive, clean, powerful.", "See each stroke — smooth, strong, confident.", "You are ready. You trained for this. Trust yourself.", "Open your eyes. You got this."] },
                  { id: "post-race", title: "Post-Race Reset", duration: "3 min", desc: "Process the race. Let go. Move forward.", icon: "🌊", steps: ["Close your eyes. Breathe slowly.", "Replay the race — no judgment, just observation.", "Notice what went well. Acknowledge it.", "Notice what didn't. Accept it.", "Inhale — I gave my best today.", "Exhale — I release what I can't control.", "Open your eyes. Every race teaches you something."] },
                  { id: "anxiety", title: "Anxiety Reframe", duration: "2 min", desc: "Turn nervous energy into fuel.", icon: "⚡", steps: ["Name the feeling. It's not fear — it's excitement.", "Your body is preparing to perform.", "Butterflies mean you CARE.", "Channel this energy into focus.", "You've been here before. You know what to do.", "Breathe. Trust. Compete."] },
                  { id: "confidence", title: "Confidence Builder", duration: "3 min", desc: "Remember who you are.", icon: "🔥", steps: ["Think of your best race ever. FEEL that moment.", "You ARE that athlete. That strength is always in you.", "Think of a hard practice you crushed. You're tough.", "Think of a time you came back from a setback. You're resilient.", "Say it: I am strong. I am prepared. I am dangerous.", "Carry this into the water."] },
                  { id: "sleep", title: "Sleep Wind-Down", duration: "5 min", desc: "Shut it down. Rest hard. Recover harder.", icon: "🌙", steps: ["Lie down. Close your eyes.", "Starting at your toes — release all tension.", "Move up: calves... quads... core... relax everything.", "Your arms are heavy. Your shoulders drop.", "Your face softens. Jaw unclenches.", "You did the work today. Tomorrow you'll be stronger.", "Drift off. Your body is healing. Trust the process."] },
                  { id: "team", title: "Pre-Meet Team Talk", duration: "2 min", desc: "We rise together.", icon: "🤝", steps: ["Look around. This is your team.", "Every one of you put in the work to get here.", "We swim for each other today.", "When it gets hard, remember — your team is watching.", "We leave nothing in the tank.", "Hands in. Let's go."] },
                ].map(med => (
                  <div key={med.id}>
                    <button onClick={() => setActiveMeditation(activeMeditation === med.id ? null : med.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        activeMeditation === med.id ? "bg-violet-500/10 border-violet-500/20" : "bg-white/[0.02] border-white/5 hover:border-white/10"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{med.icon}</span>
                          <div>
                            <span className="text-white/80 text-sm font-semibold block">{med.title}</span>
                            <span className="text-white/25 text-[10px]">{med.desc}</span>
                          </div>
                        </div>
                        <span className="text-white/20 text-[10px] font-mono">{med.duration}</span>
                      </div>
                    </button>
                    {activeMeditation === med.id && (
                      <div className="mt-2 ml-4 space-y-2 animate-[fadeIn_0.3s_ease-out]">
                        {med.steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-violet-500/5">
                            <span className="text-violet-400/40 text-xs font-mono w-4 shrink-0">{i + 1}</span>
                            <span className="text-white/50 text-sm leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-10 text-white/[0.06] text-[10px] space-y-1">
          <p>Apex Athlete — Athlete Portal</p>
          <p>Every rep counts · Every streak matters · Keep leveling up</p>
        </div>
      </div>

      {/* CSS for no-scrollbar */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
