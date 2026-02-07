"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Saint Andrew's Aquatics — Platinum Group
   Clean UI · React + Tailwind · localStorage
   ══════════════════════════════════════════════════════════════ */

// ── game engine ──────────────────────────────────────────────

const LEVELS = [
  { name: "Sprinter", xp: 0, icon: "⚡", color: "#94a3b8" },
  { name: "Pacer", xp: 300, icon: "🏃", color: "#a78bfa" },
  { name: "Miler", xp: 600, icon: "🌊", color: "#60a5fa" },
  { name: "Finisher", xp: 1000, icon: "🔥", color: "#f59e0b" },
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
function getWeightStreakMult(s: number) {
  if (s >= 7) return 1.5; if (s >= 3) return 1.25; return 1.0;
}
function fmtStreak(s: number) {
  if (s >= 60) return { label: "MYTHIC", mult: "2.5x", tier: 5 };
  if (s >= 30) return { label: "LEGENDARY", mult: "2.0x", tier: 4 };
  if (s >= 14) return { label: "GOLD", mult: "1.75x", tier: 3 };
  if (s >= 7) return { label: "SILVER", mult: "1.5x", tier: 2 };
  if (s >= 3) return { label: "BRONZE", mult: "1.25x", tier: 1 };
  return { label: "STARTER", mult: "1.0x", tier: 0 };
}
function fmtWStreak(s: number) {
  if (s >= 7) return { label: "IRON", mult: "1.5x", tier: 2 };
  if (s >= 3) return { label: "STEEL", mult: "1.25x", tier: 1 };
  return { label: "START", mult: "1.0x", tier: 0 };
}

const DAILY_XP_CAP = 150;
const today = () => new Date().toISOString().slice(0, 10);

// ── checkpoint & quest definitions ───────────────────────────

const POOL_CPS = [
  { id: "on-deck-early", name: "On Deck Early", xp: 10, desc: "Arrived 5+ min before start" },
  { id: "gear-ready", name: "Gear Ready", xp: 5, desc: "Cap, goggles, suit — ready on deck" },
  { id: "on-time-ready", name: "On Time + Ready", xp: 10, desc: "In the water when coach says go" },
  { id: "warmup-complete", name: "Warm-Up Complete", xp: 15, desc: "Full warm-up, every rep, proper form" },
  { id: "practice-complete", name: "Practice Complete", xp: 25, desc: "Through final rep + cool-down" },
  { id: "bonus-rep", name: "Bonus Rep", xp: 20, desc: "Extra rep beyond the set" },
  { id: "listened-first", name: "Listened First Time", xp: 10, desc: "No repeated instructions needed" },
  { id: "helped-teammate", name: "Helped a Teammate", xp: 15, desc: "Encouraged or assisted another swimmer" },
  { id: "asked-question", name: "Asked a Question", xp: 10, desc: "Engaged with coaching" },
  { id: "positive-attitude", name: "Positive Attitude", xp: 10, desc: "Upbeat energy, no complaints" },
  { id: "cool-down-complete", name: "Cool Down Complete", xp: 5, desc: "Proper cool-down finished" },
  { id: "lane-lines", name: "Help with Lane Lines", xp: 15, desc: "Helped set up or switch lane lines (LC ↔ SC)" },
  { id: "no-skipped-reps", name: "No Skipped Reps", xp: 10, desc: "Completed every single rep — zero shortcuts" },
];

const WEIGHT_CPS = [
  { id: "w-showed-up", name: "Showed Up", xp: 10, desc: "Present at 5:30pm, ready to lift" },
  { id: "w-full-workout", name: "Full Workout", xp: 20, desc: "Completed every exercise" },
  { id: "w-extra-sets", name: "Extra Sets", xp: 15, desc: "Did additional sets beyond the program" },
];

const MEET_CPS = [
  { id: "m-pr", name: "Personal Record", xp: 50, desc: "Set a new PR in any event" },
  { id: "m-best-time", name: "Best Time", xp: 30, desc: "Season-best or meet-best time" },
  { id: "m-sportsmanship", name: "Sportsmanship", xp: 20, desc: "Cheered teammates, showed respect" },
];

const WEIGHT_CHALLENGES = [
  { id: "iron-week", name: "Iron Week", desc: "Complete all 5 weight sessions this week", xp: 100 },
  { id: "pr-hunter", name: "PR Hunter", desc: "Hit a personal record on any lift", xp: 50 },
  { id: "full-stack", name: "Full Stack", desc: "Complete every exercise on the day's program", xp: 30 },
  { id: "spotter-award", name: "Spotter Award", desc: "Coach nominates — helped a teammate", xp: 20 },
];

const QUEST_DEFS = [
  { id: "technique-lab", name: "Technique Lab", desc: "Film one stroke, review with coach", xp: 30, cat: "SKILL" },
  { id: "buddy-up", name: "Buddy Up", desc: "Help a teammate master one skill", xp: 20, cat: "LEADERSHIP" },
  { id: "recovery-ritual", name: "Recovery Ritual", desc: "Log 8+ hours sleep + nutrition (3 nights)", xp: 15, cat: "RECOVERY" },
  { id: "dryland-hero", name: "Dryland Hero", desc: "Complete extra dryland, log reps", xp: 25, cat: "STRENGTH" },
  { id: "mindset-journal", name: "Mindset Journal", desc: "Write what I did well, what I'll fix", xp: 10, cat: "MINDSET" },
];

const CAT_COLORS: Record<string, string> = {
  SKILL: "bg-blue-500/20 text-blue-400",
  LEADERSHIP: "bg-purple-500/20 text-purple-400",
  RECOVERY: "bg-emerald-500/20 text-emerald-400",
  STRENGTH: "bg-orange-500/20 text-orange-400",
  MINDSET: "bg-pink-500/20 text-pink-400",
};

// ── types ────────────────────────────────────────────────────

interface DailyXP { date: string; pool: number; weight: number; meet: number; }

interface Athlete {
  id: string; name: string; age: number; gender: "M" | "F";
  xp: number; streak: number; weightStreak: number;
  totalPractices: number; weekSessions: number; weekWeightSessions: number; weekTarget: number;
  checkpoints: Record<string, boolean>;
  weightCheckpoints: Record<string, boolean>;
  meetCheckpoints: Record<string, boolean>;
  weightChallenges: Record<string, boolean>;
  quests: Record<string, "active" | "done" | "pending">;
  dailyXP: DailyXP;
}

interface AuditEntry {
  timestamp: number; coach: string; athleteId: string; athleteName: string;
  action: string; xpDelta: number;
}

interface TeamChallenge {
  id: string; name: string; description: string; target: number; current: number; reward: number;
}

interface DailySnapshot {
  date: string; attendance: number; totalAthletes: number; totalXPAwarded: number;
  poolCheckins: number; weightCheckins: number; meetCheckins: number;
  questsCompleted: number; challengesCompleted: number;
  athleteXPs: Record<string, number>; athleteStreaks: Record<string, number>;
}

interface TeamCulture {
  teamName: string; mission: string; seasonalGoal: string;
  goalTarget: number; goalCurrent: number; weeklyQuote: string;
}

// ── initial roster ───────────────────────────────────────────

const INITIAL_ROSTER: { name: string; age: number; gender: "M" | "F" }[] = [
  { name: "William Domokos-Murphy", age: 17, gender: "M" },
  { name: "Enrico Guizardi", age: 15, gender: "M" },
  { name: "Jorge Aguila", age: 17, gender: "M" },
  { name: "Jared Berke", age: 17, gender: "M" },
  { name: "Andrew Bouche", age: 17, gender: "M" },
  { name: "Conner Brinley", age: 18, gender: "M" },
  { name: "Bradley DiPaolo", age: 16, gender: "M" },
  { name: "William Gillis", age: 18, gender: "M" },
  { name: "William McAndrews", age: 14, gender: "M" },
  { name: "Matthias Orlandini", age: 16, gender: "M" },
  { name: "Matthew Prieres", age: 16, gender: "M" },
  { name: "Luke Reid", age: 14, gender: "M" },
  { name: "Surfiel Santiago", age: 18, gender: "M" },
  { name: "Simon Sheinfeld", age: 16, gender: "M" },
  { name: "Cash Vinas", age: 17, gender: "M" },
  { name: "Nerea Gutierrez", age: 17, gender: "F" },
  { name: "Mayah Chouloute", age: 16, gender: "F" },
  { name: "Sophia Gamboa-Pereira", age: 14, gender: "F" },
  { name: "Gabia Gelumbickas", age: 17, gender: "F" },
  { name: "Alejandra Gil-Restrepo", age: 17, gender: "F" },
  { name: "Christina Gumbinger", age: 18, gender: "F" },
  { name: "Alera Hurwitz", age: 16, gender: "F" },
  { name: "Lilly Karas", age: 15, gender: "F" },
  { name: "Sienna Kourjakian", age: 15, gender: "F" },
  { name: "Alexandra Lucchese", age: 14, gender: "F" },
  { name: "Cielo Moya", age: 14, gender: "F" },
  { name: "Ariana Moya Vargas", age: 17, gender: "F" },
  { name: "Jette Neubauer", age: 16, gender: "F" },
  { name: "Christina Paschal", age: 17, gender: "F" },
  { name: "Erin Reid", age: 16, gender: "F" },
  { name: "Athena Rilo", age: 15, gender: "F" },
  { name: "Cecilie von Klaeden", age: 17, gender: "F" },
  { name: "Grace Weeks", age: 14, gender: "F" },
];

function makeAthlete(r: { name: string; age: number; gender: "M" | "F" }): Athlete {
  return {
    id: r.name.toLowerCase().replace(/\s+/g, "-"),
    name: r.name, age: r.age, gender: r.gender,
    xp: 0, streak: 0, weightStreak: 0,
    totalPractices: 0, weekSessions: 0, weekWeightSessions: 0, weekTarget: 5,
    checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {},
    weightChallenges: {}, quests: {},
    dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 },
  };
}

// ── storage ──────────────────────────────────────────────────

const K = {
  ROSTER: "apex-athlete-roster-v3",
  PIN: "apex-athlete-pin",
  AUDIT: "apex-athlete-audit-v2",
  CHALLENGES: "apex-athlete-challenges-v2",
  SNAPSHOTS: "apex-athlete-snapshots-v2",
  CULTURE: "apex-athlete-culture-v1",
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    try { return JSON.parse(v); } catch { return v as unknown as T; }
  } catch { return fallback; }
}
function save(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)); }

const DEFAULT_CHALLENGES: TeamChallenge[] = [
  { id: "tc-attendance", name: "Full House", description: "90% team attendance this week", target: 90, current: 0, reward: 50 },
  { id: "tc-xp-target", name: "XP Surge", description: "Team earns 2000 XP in a single week", target: 2000, current: 0, reward: 75 },
];

const DEFAULT_CULTURE: TeamCulture = {
  teamName: "Saint Andrew's Aquatics — Platinum",
  mission: "Excellence Through Consistency",
  seasonalGoal: "90% attendance this month",
  goalTarget: 90, goalCurrent: 0,
  weeklyQuote: "Champions do extra. — Unknown",
};

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function ApexAthletePage() {
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [coachPin, setCoachPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"pool" | "weight" | "meet">("pool");
  const [leaderTab, setLeaderTab] = useState<"all" | "M" | "F">("all");
  const [view, setView] = useState<"coach" | "parent" | "audit" | "analytics">("coach");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [teamChallenges, setTeamChallenges] = useState<TeamChallenge[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [culture, setCulture] = useState<TeamCulture>(DEFAULT_CULTURE);
  const [editingCulture, setEditingCulture] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [timelineAthleteId, setTimelineAthleteId] = useState<string | null>(null);
  const [comparePeriod, setComparePeriod] = useState<"week" | "month">("week");
  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newAthleteAge, setNewAthleteAge] = useState("");
  const [newAthleteGender, setNewAthleteGender] = useState<"M" | "F">("M");
  const [mounted, setMounted] = useState(false);
  const [levelUpName, setLevelUpName] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<string>("");
  const [xpFloats, setXpFloats] = useState<{ id: string; xp: number; x: number; y: number }[]>([]);
  const floatCounter = useRef(0);

  // ── mount & load ─────────────────────────────────────────
  useEffect(() => {
    const pin = load<string>(K.PIN, "");
    if (!pin) { setCoachPin("1234"); save(K.PIN, "1234"); } else { setCoachPin(pin); }
    let r = load<Athlete[]>(K.ROSTER, []);
    if (r.length === 0) { r = INITIAL_ROSTER.map(makeAthlete); save(K.ROSTER, r); }
    r = r.map(a => {
      if (!a.dailyXP) return { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } };
      if (a.dailyXP.date !== today()) return { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } };
      return a;
    });
    setRoster(r);
    setAuditLog(load<AuditEntry[]>(K.AUDIT, []));
    setTeamChallenges(load<TeamChallenge[]>(K.CHALLENGES, DEFAULT_CHALLENGES));
    setSnapshots(load<DailySnapshot[]>(K.SNAPSHOTS, []));
    setCulture(load<TeamCulture>(K.CULTURE, DEFAULT_CULTURE));
    setMounted(true);
  }, []);

  // ── auto-snapshot ────────────────────────────────────────
  useEffect(() => {
    if (!mounted || roster.length === 0) return;
    const snap = () => {
      const d = today();
      const att = roster.filter(a => Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean) || Object.values(a.meetCheckpoints).some(Boolean)).length;
      const s: DailySnapshot = {
        date: d, attendance: att, totalAthletes: roster.length,
        totalXPAwarded: roster.reduce((s, a) => s + (a.dailyXP.date === d ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0),
        poolCheckins: roster.reduce((s, a) => s + Object.values(a.checkpoints).filter(Boolean).length, 0),
        weightCheckins: roster.reduce((s, a) => s + Object.values(a.weightCheckpoints).filter(Boolean).length, 0),
        meetCheckins: roster.reduce((s, a) => s + Object.values(a.meetCheckpoints).filter(Boolean).length, 0),
        questsCompleted: roster.reduce((s, a) => s + Object.values(a.quests).filter(q => q === "done").length, 0),
        challengesCompleted: teamChallenges.filter(c => c.current >= c.target).length,
        athleteXPs: Object.fromEntries(roster.map(a => [a.id, a.xp])),
        athleteStreaks: Object.fromEntries(roster.map(a => [a.id, a.streak])),
      };
      setSnapshots(prev => { const n = [...prev.filter(x => x.date !== d), s]; save(K.SNAPSHOTS, n); return n; });
    };
    snap();
    const iv = setInterval(snap, 30000);
    return () => clearInterval(iv);
  }, [mounted, roster, teamChallenges]);

  // ── persist helpers ──────────────────────────────────────
  const saveRoster = useCallback((r: Athlete[]) => { setRoster(r); save(K.ROSTER, r); }, []);
  const saveCulture = useCallback((c: TeamCulture) => { setCulture(c); save(K.CULTURE, c); }, []);

  const addAudit = useCallback((athleteId: string, athleteName: string, action: string, xpDelta: number) => {
    const entry: AuditEntry = { timestamp: Date.now(), coach: "Coach", athleteId, athleteName, action, xpDelta };
    setAuditLog(prev => { const n = [entry, ...prev].slice(0, 2000); save(K.AUDIT, n); return n; });
  }, []);

  const checkLevelUp = useCallback((oldXP: number, newXP: number, name: string) => {
    const oldLv = getLevel(oldXP);
    const newLv = getLevel(newXP);
    if (newLv.name !== oldLv.name) {
      setLevelUpName(name);
      setLevelUpLevel(newLv.name);
      setTimeout(() => { setLevelUpName(null); }, 3000);
    }
  }, []);

  const spawnXpFloat = useCallback((xp: number, e?: React.MouseEvent) => {
    if (xp <= 0) return;
    const id = `f-${floatCounter.current++}`;
    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY : window.innerHeight / 2;
    setXpFloats(prev => [...prev, { id, xp, x, y }]);
    setTimeout(() => setXpFloats(prev => prev.filter(f => f.id !== id)), 1100);
  }, []);

  // ── XP award (cap-aware) ─────────────────────────────────
  const awardXP = useCallback((athlete: Athlete, xpBase: number, category: "pool" | "weight" | "meet"): { newAthlete: Athlete; awarded: number } => {
    let a = { ...athlete, dailyXP: { ...athlete.dailyXP } };
    if (a.dailyXP.date !== today()) a.dailyXP = { date: today(), pool: 0, weight: 0, meet: 0 };
    const used = a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet;
    const room = Math.max(0, DAILY_XP_CAP - used);
    const mult = category === "weight" ? getWeightStreakMult(a.weightStreak) : getStreakMult(a.streak);
    const raw = Math.round(xpBase * mult);
    const awarded = Math.min(raw, room);
    if (awarded <= 0) return { newAthlete: a, awarded: 0 };
    const oldXP = a.xp;
    a.xp += awarded;
    a.dailyXP[category] += awarded;
    checkLevelUp(oldXP, a.xp, a.name);
    return { newAthlete: a, awarded };
  }, [checkLevelUp]);

  // ── checkpoint toggle ────────────────────────────────────
  const toggleCheckpoint = useCallback((athleteId: string, cpId: string, cpXP: number, category: "pool" | "weight" | "meet", e?: React.MouseEvent) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const a = { ...prev[idx] };
      const cpMap = category === "pool" ? "checkpoints" : category === "weight" ? "weightCheckpoints" : "meetCheckpoints";
      const cps = { ...a[cpMap] };
      if (cps[cpId]) {
        cps[cpId] = false; a[cpMap] = cps;
        addAudit(a.id, a.name, `Unchecked: ${cpId}`, 0);
        const r = [...prev]; r[idx] = a; save(K.ROSTER, r); return r;
      }
      cps[cpId] = true; a[cpMap] = cps;
      const { newAthlete, awarded } = awardXP(a, cpXP, category);
      const final = { ...newAthlete, [cpMap]: cps };
      addAudit(final.id, final.name, `Checked: ${cpId}`, awarded);
      if (e) spawnXpFloat(awarded, e);
      const r = [...prev]; r[idx] = final; save(K.ROSTER, r); return r;
    });
  }, [awardXP, addAudit, spawnXpFloat]);

  // ── weight challenge toggle ──────────────────────────────
  const toggleWeightChallenge = useCallback((athleteId: string, chId: string, chXP: number, e?: React.MouseEvent) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      let a = { ...prev[idx], weightChallenges: { ...prev[idx].weightChallenges } };
      if (a.weightChallenges[chId]) {
        a.weightChallenges[chId] = false;
        addAudit(a.id, a.name, `Unchallenged: ${chId}`, 0);
      } else {
        a.weightChallenges[chId] = true;
        const { newAthlete, awarded } = awardXP(a, chXP, "weight");
        a = { ...newAthlete, weightChallenges: a.weightChallenges };
        addAudit(a.id, a.name, `Challenge: ${chId}`, awarded);
        if (e) spawnXpFloat(awarded, e);
      }
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); return r;
    });
  }, [awardXP, addAudit, spawnXpFloat]);

  // ── quest cycle ──────────────────────────────────────────
  const cycleQuest = useCallback((athleteId: string, qId: string, qXP: number, e?: React.MouseEvent) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      let a = { ...prev[idx], quests: { ...prev[idx].quests } };
      const cur = a.quests[qId] || "pending";
      const next: "active" | "done" | "pending" = cur === "pending" ? "active" : cur === "active" ? "done" : "pending";
      a.quests[qId] = next;
      let awarded = 0;
      if (next === "done") {
        const res = awardXP(a, qXP, "pool");
        a = { ...res.newAthlete, quests: a.quests };
        awarded = res.awarded;
        if (e) spawnXpFloat(awarded, e);
      }
      addAudit(a.id, a.name, `Quest ${qId}: ${next}`, awarded);
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); return r;
    });
  }, [awardXP, addAudit, spawnXpFloat]);

  // ── combo detection ──────────────────────────────────────
  const checkCombos = useCallback((athlete: Athlete) => {
    const hasPool = Object.values(athlete.checkpoints).some(Boolean);
    const hasWeight = Object.values(athlete.weightCheckpoints).some(Boolean);
    const combos: string[] = [];
    if (hasPool && hasWeight) combos.push("Double Day (+25xp bonus)");
    if (hasPool && hasWeight && athlete.checkpoints["bonus-rep"] && athlete.weightCheckpoints["w-extra-sets"])
      combos.push("Triple Threat (+50xp bonus)");
    return combos;
  }, []);

  // ── coach tools ──────────────────────────────────────────
  const bulkMarkPresent = useCallback(() => {
    setRoster(prev => {
      const r = prev.map(a => {
        const cp = { ...a.checkpoints, "on-time-ready": true };
        const { newAthlete, awarded } = awardXP({ ...a, checkpoints: cp }, 10, "pool");
        addAudit(newAthlete.id, newAthlete.name, "Bulk: On Time + Ready", awarded);
        return { ...newAthlete, checkpoints: cp, totalPractices: a.totalPractices + 1, weekSessions: a.weekSessions + 1, streak: a.streak + 1 };
      });
      save(K.ROSTER, r); return r;
    });
  }, [awardXP, addAudit]);

  const undoLast = useCallback(() => {
    setAuditLog(prev => {
      if (!prev.length) return prev;
      const last = prev[0];
      // Actually revert XP from the athlete
      if (last.xpDelta > 0) {
        setRoster(rPrev => {
          const idx = rPrev.findIndex(a => a.id === last.athleteId);
          if (idx < 0) return rPrev;
          const a = { ...rPrev[idx] };
          a.xp = Math.max(0, a.xp - last.xpDelta);
          // Revert daily XP tracking
          if (a.dailyXP.date === today()) {
            a.dailyXP = { ...a.dailyXP, pool: Math.max(0, a.dailyXP.pool - last.xpDelta) };
          }
          const r = [...rPrev]; r[idx] = a; save(K.ROSTER, r); return r;
        });
      }
      const n = prev.slice(1); save(K.AUDIT, n); return n;
    });
  }, []);

  const resetDay = useCallback(() => {
    saveRoster(roster.map(a => ({ ...a, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster]);

  const resetWeek = useCallback(() => {
    saveRoster(roster.map(a => ({ ...a, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, weightChallenges: {}, weekSessions: 0, weekWeightSessions: 0, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster]);

  const resetMonth = useCallback(() => {
    saveRoster(roster.map(a => ({ ...a, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, weightChallenges: {}, quests: {}, weekSessions: 0, weekWeightSessions: 0, streak: 0, weightStreak: 0, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster]);

  const addAthleteAction = useCallback(() => {
    if (!newAthleteName.trim() || !newAthleteAge) return;
    const a = makeAthlete({ name: newAthleteName.trim(), age: parseInt(newAthleteAge), gender: newAthleteGender });
    saveRoster([...roster, a]);
    setNewAthleteName(""); setNewAthleteAge(""); setAddAthleteOpen(false);
    addAudit(a.id, a.name, "Added to roster", 0);
  }, [newAthleteName, newAthleteAge, newAthleteGender, roster, saveRoster, addAudit]);

  const removeAthlete = useCallback((id: string) => {
    const a = roster.find(x => x.id === id);
    if (!a) return;
    saveRoster(roster.filter(x => x.id !== id));
    addAudit(id, a.name, "Removed from roster", 0);
  }, [roster, saveRoster, addAudit]);

  const exportCSV = useCallback(() => {
    const header = "Name,Age,Gender,XP,Level,Streak,WeightStreak,TotalPractices\n";
    const rows = roster.map(a => `${a.name},${a.age},${a.gender},${a.xp},${getLevel(a.xp).name},${a.streak},${a.weightStreak},${a.totalPractices}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `apex-athlete-${today()}.csv`;
    link.click(); URL.revokeObjectURL(url);
  }, [roster]);

  // ── computed ─────────────────────────────────────────────
  const sorted = useMemo(() => {
    const f = leaderTab === "all" ? roster : roster.filter(a => a.gender === leaderTab);
    return [...f].sort((a, b) => b.xp - a.xp);
  }, [roster, leaderTab]);

  const mvpMale = useMemo(() => roster.filter(a => a.gender === "M").sort((a, b) => b.xp - a.xp)[0] || null, [roster]);
  const mvpFemale = useMemo(() => roster.filter(a => a.gender === "F").sort((a, b) => b.xp - a.xp)[0] || null, [roster]);

  const mostImproved = useMemo(() => {
    if (snapshots.length < 2) return null;
    const ago = new Date(); ago.setDate(ago.getDate() - 30);
    const old = snapshots.find(s => new Date(s.date) <= ago) || snapshots[0];
    let best = 0, bestId = "";
    for (const a of roster) { const g = a.xp - (old.athleteXPs?.[a.id] || 0); if (g > best) { best = g; bestId = a.id; } }
    return roster.find(a => a.id === bestId) || null;
  }, [roster, snapshots]);

  const getPersonalGrowth = useCallback((athlete: Athlete) => {
    const ago = new Date(); ago.setDate(ago.getDate() - 30);
    const old = snapshots.find(s => new Date(s.date) <= ago) || snapshots[0];
    if (!old) return null;
    return { xpGain: athlete.xp - (old.athleteXPs?.[athlete.id] || 0), streakDelta: athlete.streak - (old.athleteStreaks?.[athlete.id] || 0) };
  }, [snapshots]);

  // ── seasonal goal auto-track ─────────────────────────────
  useEffect(() => {
    if (!mounted || !roster.length) return;
    const pct = Math.round((roster.filter(a => Object.values(a.checkpoints).some(Boolean)).length / roster.length) * 100);
    if (pct !== culture.goalCurrent) { const u = { ...culture, goalCurrent: pct }; setCulture(u); save(K.CULTURE, u); }
  }, [mounted, roster, culture]);

  // ── analytics helpers ────────────────────────────────────
  const calendarData = useMemo(() => Object.fromEntries(snapshots.map(s => [s.date, s])), [snapshots]);
  const periodComparison = useMemo(() => {
    const now = new Date();
    const range = (a: number, b: number) => {
      const s = new Date(now); s.setDate(s.getDate() - a);
      const e = new Date(now); e.setDate(e.getDate() - b);
      return snapshots.filter(x => { const d = new Date(x.date); return d >= s && d <= e; });
    };
    return comparePeriod === "week"
      ? { current: range(6, 0), previous: range(13, 7), currentLabel: "This Week", previousLabel: "Last Week" }
      : { current: range(29, 0), previous: range(59, 30), currentLabel: "This Month", previousLabel: "Last Month" };
  }, [snapshots, comparePeriod]);
  const avgXP = (s: DailySnapshot[]) => s.length ? Math.round(s.reduce((t, x) => t + x.totalXPAwarded, 0) / s.length) : 0;
  const avgAtt = (s: DailySnapshot[]) => s.length ? Math.round(s.reduce((t, x) => t + (x.totalAthletes ? (x.attendance / x.totalAthletes) * 100 : 0), 0) / s.length) : 0;

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */

  // ── reusable card component — sci-fi game panel ─────────────
  const Card = ({ children, className = "", glow = false, neon = false }: { children: React.ReactNode; className?: string; glow?: boolean; neon?: boolean }) => (
    <div className={`game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] ${glow ? "neon-pulse" : ""} ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}>{children}</div>
  );

  // ── floating XP numbers ──────────────────────────────────
  const XpFloats = () => (
    <div className="fixed inset-0 pointer-events-none z-[200]">
      {xpFloats.map(f => (
        <div key={f.id} className="xp-float absolute text-[#f59e0b] font-black text-lg" style={{ left: f.x, top: f.y }}>
          +{f.xp} XP
        </div>
      ))}
    </div>
  );

  // ── level-up overlay with sparkles ──────────────────────
  const SPARKLE_DIRS = [
    { sx: "-60px", sy: "-70px" }, { sx: "65px", sy: "-60px" },
    { sx: "-50px", sy: "55px" }, { sx: "55px", sy: "60px" },
    { sx: "-80px", sy: "0px" }, { sx: "80px", sy: "-10px" },
    { sx: "0px", sy: "-80px" }, { sx: "10px", sy: "75px" },
  ];
  const LevelUpOverlay = () => {
    if (!levelUpName) return null;
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLevelUpName(null)} />
        <div className="relative level-up-enter text-center">
          {/* sparkle particles */}
          {SPARKLE_DIRS.map((d, i) => (
            <div key={i} className="sparkle absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-[#f59e0b]"
              style={{ "--sx": d.sx, "--sy": d.sy, animationDelay: `${i * 0.05}s` } as React.CSSProperties} />
          ))}
          <div className="relative bg-[#0c0618]/95 border border-[#f59e0b]/25 rounded-2xl p-10 shadow-[0_0_60px_rgba(245,158,11,0.15),0_0_120px_rgba(107,33,168,0.1)]">
            <div className="text-5xl mb-3">⚡</div>
            <div className="text-[#f59e0b] text-xs tracking-[0.3em] uppercase font-bold mb-2">Level Up!</div>
            <div className="text-white text-2xl font-black mb-1">{levelUpName}</div>
            <div className="bg-gradient-to-r from-[#a855f7] to-[#f59e0b] bg-clip-text text-transparent text-lg font-bold">{levelUpLevel}</div>
          </div>
        </div>
      </div>
    );
  };

  // ── loading ──────────────────────────────────────────────
  // ── ambient background — sci-fi nebula + star field ─────
  const BgOrbs = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Deep space base */}
      <div className="absolute inset-0 bg-[#06020f]" />
      {/* Data grid overlay */}
      <div className="absolute inset-0 data-grid-bg opacity-30" />
      {/* Nebula layers */}
      <div className="nebula-1 absolute -top-[20%] left-[20%] w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.08)_0%,rgba(107,33,168,0.12)_30%,transparent_60%)]" />
      <div className="nebula-2 absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.1)_0%,rgba(0,240,255,0.04)_40%,transparent_60%)]" />
      <div className="nebula-3 absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(232,121,249,0.06)_0%,transparent_55%)]" />
      <div className="nebula-drift absolute top-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.05)_0%,transparent_55%)]" />
      {/* Scan line */}
      <div className="scan-line absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff]/20 to-transparent" />
    </div>
  );

  if (!mounted) return (
    <div className="min-h-screen bg-[#06020f] flex items-center justify-center relative">
      <BgOrbs />
      <div className="text-center relative z-10">
        <div className="text-3xl mb-2">🏊</div>
        <div className="neon-text-cyan text-sm font-mono tracking-wider opacity-60">INITIALIZING...</div>
      </div>
    </div>
  );

  // ── PIN gate ─────────────────────────────────────────────
  const tryUnlock = () => { if (pinInput === coachPin) { setUnlocked(true); setPinError(false); } else setPinError(true); };
  const resetPin = () => { setCoachPin("1234"); save(K.PIN, "1234"); setPinInput(""); setPinError(false); };

  if (!unlocked && view === "coach") {
    return (
      <div className="min-h-screen bg-[#06020f] flex items-center justify-center p-6 relative overflow-hidden">
        <BgOrbs />
        <div className="text-center max-w-xs w-full relative z-10">
          {/* HUD access terminal */}
          <div className="game-panel game-panel-border relative bg-[#06020f]/90 p-10 mb-6">
            <div className="hud-corner-tl hud-corner-br absolute inset-0 pointer-events-none" />
            <div className="text-5xl mb-4 drop-shadow-[0_0_30px_rgba(0,240,255,0.5)]">🏊</div>
            <div className="neon-text-cyan text-[10px] tracking-[0.5em] uppercase mb-2 font-bold opacity-60">Swim Training System</div>
            <h1 className="text-4xl font-black mb-2 tracking-tighter neon-text-cyan animated-gradient-text" style={{color: '#00f0ff', textShadow: '0 0 30px rgba(0,240,255,0.5), 0 0 60px rgba(168,85,247,0.3)'}}>Apex Athlete</h1>
            <div className="text-[#a855f7]/30 text-[10px] tracking-[0.3em] uppercase font-mono mb-8">// COACH ACCESS TERMINAL</div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="relative">
              <input
                type="password" maxLength={4} value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(false); }}
                onKeyDown={e => { if (e.key === "Enter") tryUnlock(); }}
                placeholder="_ _ _ _"
                className={`w-full text-center text-2xl tracking-[0.5em] py-4 bg-[#06020f]/80 backdrop-blur-xl border-2 text-[#00f0ff] placeholder:text-[#00f0ff]/15 focus:outline-none transition-all font-mono game-panel-sm ${pinError ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]" : "border-[#00f0ff]/20 focus:border-[#00f0ff]/50 focus:shadow-[0_0_30px_rgba(0,240,255,0.2)]"}`}
              />
            </div>
            {pinError && <p className="text-red-400 text-xs -mt-2 font-mono">ACCESS DENIED. Default: 1234.</p>}
            <button onClick={tryUnlock}
              className="game-btn w-full py-4 bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_30px_rgba(0,240,255,0.3)] transition-all active:scale-[0.97] min-h-[52px]">
              Authenticate
            </button>
            <button onClick={() => setView("parent")}
              className="text-[#00f0ff]/20 text-xs hover:text-[#00f0ff]/50 transition-colors mt-2 min-h-[44px] font-mono tracking-wider uppercase">
              Parent / Read-Only Access
            </button>
            {pinError && (
              <button onClick={resetPin} className="text-white/15 text-[10px] hover:text-white/30 transition-colors font-mono">
                RESET PIN → 1234
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── shared game HUD header (used by ALL views) ─────────
  const GameHUDHeader = () => {
    const presentCount = roster.filter(a => Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)).length;
    const xpToday = roster.reduce((s, a) => s + (a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0);
    return (
      <div className="w-full relative mb-6">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff]/60 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#00f0ff]/[0.03] to-transparent pointer-events-none" />

        <div className="pt-8 pb-2">
          {/* Title + Nav */}
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-[9px] tracking-[0.6em] uppercase font-bold text-[#00f0ff]/30 font-mono mb-1">{'<'} swim.training.system {'/'+'>'}</div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.04em] leading-[0.85]" style={{
                background: 'linear-gradient(135deg, #00f0ff 0%, #a855f7 40%, #00f0ff 60%, #e879f9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 4s ease-in-out infinite',
                filter: 'drop-shadow(0 0 30px rgba(0,240,255,0.3))'
              }}>
                APEX ATHLETE
              </h1>
            </div>
            {/* Game HUD nav tabs */}
            <div className="flex">
              {(["coach", "parent", "audit", "analytics"] as const).map((v, i) => {
                const icons = { coach: "◆", parent: "◇", audit: "▣", analytics: "◈" };
                const active = view === v;
                return (
                  <button key={v} onClick={() => setView(v)}
                    className={`relative px-4 sm:px-5 py-3 text-[10px] font-bold font-mono tracking-[0.25em] uppercase transition-all duration-300 ${
                      active
                        ? "text-[#00f0ff] bg-[#00f0ff]/[0.08]"
                        : "text-white/15 hover:text-[#00f0ff]/60 hover:bg-[#00f0ff]/[0.03]"
                    }`}
                    style={{
                      borderTop: active ? '2px solid rgba(0,240,255,0.6)' : '2px solid rgba(0,240,255,0.08)',
                      borderBottom: active ? 'none' : '1px solid rgba(0,240,255,0.05)',
                      boxShadow: active ? '0 -4px 20px rgba(0,240,255,0.15), inset 0 1px 15px rgba(0,240,255,0.05)' : 'none'
                    }}>
                    <span className={`mr-1.5 ${active ? "text-[#f59e0b]" : ""}`}>{icons[v]}</span>{v}
                    {active && <div className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-[#00f0ff]/40" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team identity bar */}
          <div className="game-panel game-panel-border relative bg-[#06020f]/60 backdrop-blur-xl px-6 py-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 game-panel-sm bg-gradient-to-br from-[#f59e0b]/20 to-[#6b21a8]/20 border border-[#f59e0b]/30 flex items-center justify-center">
                <span className="text-[#f59e0b] text-lg font-black">SA</span>
              </div>
              <div className="flex-1">
                <h2 className="text-white/90 font-bold text-sm tracking-wide">{culture.teamName}</h2>
                <p className="text-[#f59e0b]/50 text-[11px] italic font-mono">{culture.mission}</p>
              </div>
              {view === "coach" && (
                <button onClick={() => { if (editingCulture) saveCulture(culture); setEditingCulture(!editingCulture); }}
                  className="game-btn px-3 py-1.5 text-[9px] font-mono tracking-wider uppercase text-white/20 border border-white/[0.06] hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20 transition-all">
                  {editingCulture ? "SAVE" : "EDIT"}
                </button>
              )}
            </div>
          </div>

          {/* Season goal progress */}
          <div className="flex items-center gap-4 px-2 mb-2">
            <span className="text-[#00f0ff]/20 text-[9px] font-mono uppercase tracking-wider shrink-0">{culture.seasonalGoal}</span>
            <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden xp-bar-segments">
              <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${Math.min(100, (culture.goalCurrent / culture.goalTarget) * 100)}%` }} />
            </div>
            <span className="text-[#f59e0b]/50 text-[9px] font-bold font-mono shrink-0">{culture.goalCurrent}%<span className="text-white/10">/{culture.goalTarget}%</span></span>
          </div>
        </div>

        {/* Live HUD data strip */}
        <div className="relative border-y border-[#00f0ff]/10 bg-[#06020f]/90 backdrop-blur-xl">
          <div className="absolute inset-0 data-grid-bg opacity-30 pointer-events-none" />
          <div className="flex items-center gap-6 py-3 relative z-10 scan-sweep px-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${presentCount > 0 ? "bg-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.6)]" : "bg-white/10"}`} />
              <span className="neon-text-cyan text-sm font-bold font-mono">{presentCount}<span className="text-white/15 font-normal">/{roster.length}</span></span>
              <span className="text-[#00f0ff]/30 text-[10px] font-mono uppercase">present</span>
            </div>
            <div className="w-px h-4 bg-[#00f0ff]/10" />
            <div className="flex items-center gap-2">
              <span className="neon-text-gold text-sm font-bold font-mono">{xpToday}</span>
              <span className="text-[#f59e0b]/30 text-[10px] font-mono uppercase">XP today</span>
            </div>
            <div className="w-px h-4 bg-[#00f0ff]/10" />
            <span className="text-[#00f0ff]/40 text-xs font-mono">{sessionMode === "pool" ? "🏊 POOL" : sessionMode === "weight" ? "🏋️ WEIGHT" : "🏁 MEET"}</span>
            {culture.weeklyQuote && (
              <>
                <div className="w-px h-4 bg-[#00f0ff]/10" />
                <span className="text-[#a855f7]/30 text-[10px] italic truncate max-w-[200px] font-mono">&ldquo;{culture.weeklyQuote}&rdquo;</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── culture header ──────────────────────────────────────
  const CultureHeader = () => (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-lg">{culture.teamName}</h2>
          {editingCulture ? (
            <input value={culture.mission} onChange={e => setCulture({ ...culture, mission: e.target.value })}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1 text-[#f59e0b] text-sm mt-1 w-full focus:outline-none" />
          ) : (
            <p className="text-[#f59e0b] text-sm mt-1">{culture.mission}</p>
          )}
        </div>
        {view === "coach" && (
          <button onClick={() => { if (editingCulture) saveCulture(culture); setEditingCulture(!editingCulture); }}
            className="text-white/25 text-xs hover:text-white/50 px-3 py-1.5 rounded-lg border border-white/[0.06] transition-colors min-h-[36px]">
            {editingCulture ? "Save" : "Edit"}
          </button>
        )}
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-white/40">
            {editingCulture ? (
              <input value={culture.seasonalGoal} onChange={e => setCulture({ ...culture, seasonalGoal: e.target.value })}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-0.5 text-white/50 w-52 focus:outline-none" />
            ) : culture.seasonalGoal}
          </span>
          <span className="text-[#f59e0b] font-bold">{culture.goalCurrent}%<span className="text-white/20">/{culture.goalTarget}%</span></span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${Math.min(100, (culture.goalCurrent / culture.goalTarget) * 100)}%` }} />
        </div>
      </div>
      <div className="border-t border-white/[0.04] pt-3">
        {editingCulture ? (
          <input value={culture.weeklyQuote} onChange={e => setCulture({ ...culture, weeklyQuote: e.target.value })}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white/30 text-sm italic w-full focus:outline-none" />
        ) : (
          <p className="text-white/20 text-sm italic text-center">&ldquo;{culture.weeklyQuote}&rdquo;</p>
        )}
      </div>
      {editingCulture && (
        <div className="mt-3 flex gap-3 text-xs items-center">
          <label className="text-white/30">Goal %: <input type="number" value={culture.goalTarget}
            onChange={e => setCulture({ ...culture, goalTarget: parseInt(e.target.value) || 0 })}
            className="ml-1 w-16 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-white/50 focus:outline-none" /></label>
        </div>
      )}
    </Card>
  );

  // ── expanded athlete detail ─────────────────────────────
  const AthleteExpanded = ({ athlete }: { athlete: Athlete }) => {
    const lv = getLevel(athlete.xp);
    const prog = getLevelProgress(athlete.xp);
    const nxt = getNextLevel(athlete.xp);
    const sk = fmtStreak(athlete.streak);
    const wsk = fmtWStreak(athlete.weightStreak);
    const combos = checkCombos(athlete);
    const growth = getPersonalGrowth(athlete);
    const dxp = athlete.dailyXP.date === today() ? athlete.dailyXP : { pool: 0, weight: 0, meet: 0 };
    const dailyUsed = dxp.pool + dxp.weight + dxp.meet;
    const cps = sessionMode === "pool" ? POOL_CPS : sessionMode === "weight" ? WEIGHT_CPS : MEET_CPS;
    const cpMap = sessionMode === "pool" ? athlete.checkpoints : sessionMode === "weight" ? athlete.weightCheckpoints : athlete.meetCheckpoints;

    return (
      <div className="expand-in mt-5 space-y-6" onClick={e => e.stopPropagation()}>
        {/* Profile card */}
        <Card className="p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center text-lg font-black text-white shrink-0"
              style={{ border: `3px solid ${lv.color}50`, boxShadow: `0 0 20px ${lv.color}20` }}>
              {athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-lg">{athlete.name}</div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-white/25 text-xs">{athlete.age}y · {athlete.gender}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>
                  {lv.icon} {lv.name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">
                  {sk.label} · {sk.mult}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-white/30 font-bold">{athlete.xp} XP</span>
                  <span className="text-white/20">{nxt ? `${prog.remaining} to ${nxt.name}` : "MAX LEVEL"}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full xp-shimmer transition-all duration-500" style={{ width: `${prog.percent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Sessions", val: athlete.totalPractices },
            { label: "XP Earned", val: athlete.xp },
            { label: "Streak", val: `${athlete.streak}d` },
            { label: "Multiplier", val: sk.mult },
          ].map(s => (
            <Card key={s.label} className="py-4 px-3 text-center">
              <div className="text-white font-black text-lg">{s.val}</div>
              <div className="text-white/20 text-[10px] uppercase tracking-wider font-medium mt-0.5">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Daily cap */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/30">Daily XP:</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${dailyUsed >= DAILY_XP_CAP ? "bg-red-500" : "bg-[#6b21a8]"}`} style={{ width: `${(dailyUsed / DAILY_XP_CAP) * 100}%` }} />
          </div>
          <span className={`text-xs font-bold ${dailyUsed >= DAILY_XP_CAP ? "text-red-400" : "text-white/30"}`}>{dailyUsed}/{DAILY_XP_CAP}</span>
        </div>

        {/* Streaks */}
        <div className="flex gap-3">
          <Card className="flex-1 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white/30 text-[10px] uppercase tracking-wider">Pool Streak</div>
              <div className="text-white font-bold">{athlete.streak}d <span className="text-[#a855f7] text-xs">{sk.label}</span></div>
            </div>
            <span className="text-[#a855f7] font-bold text-sm">{sk.mult}</span>
          </Card>
          <Card className="flex-1 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white/30 text-[10px] uppercase tracking-wider">Weight Streak</div>
              <div className="text-white font-bold">{athlete.weightStreak}d <span className="text-[#f59e0b] text-xs">{wsk.label}</span></div>
            </div>
            <span className="text-[#f59e0b] font-bold text-sm">{wsk.mult}</span>
          </Card>
        </div>

        {/* Daily check-in */}
        <div>
          <h4 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">
            {sessionMode === "pool" ? "Pool Check-In" : sessionMode === "weight" ? "Weight Room" : "Meet Day"}
          </h4>
          <Card className="divide-y divide-white/[0.04]">
            {cps.map(cp => {
              const checked = cpMap[cp.id];
              return (
                <button key={cp.id}
                  onClick={(e) => toggleCheckpoint(athlete.id, cp.id, cp.xp, sessionMode, e)}
                  disabled={dailyUsed >= DAILY_XP_CAP && !checked}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-all min-h-[56px] ${
                    checked ? "bg-[#6b21a8]/15 check-flash shadow-[inset_0_0_30px_rgba(107,33,168,0.08)]" : dailyUsed >= DAILY_XP_CAP ? "opacity-30 cursor-not-allowed" : "hover:bg-white/[0.03] cursor-pointer"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    checked ? "border-[#7c3aed] bg-gradient-to-br from-[#7c3aed] to-[#6b21a8] shadow-[0_0_8px_rgba(124,58,237,0.4)]" : "border-white/15"
                  }`}>
                    {checked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{cp.name}</div>
                    <div className="text-white/20 text-[11px]">{cp.desc}</div>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${checked ? "text-[#f59e0b]" : "text-white/20"}`}>+{cp.xp} xp</span>
                </button>
              );
            })}
          </Card>
        </div>

        {/* Weight challenges */}
        {sessionMode === "weight" && (
          <div>
            <h4 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">Weight Challenges</h4>
            <Card className="divide-y divide-white/[0.04]">
              {WEIGHT_CHALLENGES.map(ch => {
                const done = athlete.weightChallenges[ch.id];
                return (
                  <button key={ch.id} onClick={(e) => toggleWeightChallenge(athlete.id, ch.id, ch.xp, e)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors min-h-[56px] ${
                      done ? "bg-[#f59e0b]/5" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      done ? "border-[#f59e0b] bg-[#f59e0b]" : "border-white/15"
                    }`}>
                      {done && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{ch.name}</div>
                      <div className="text-white/20 text-[11px]">{ch.desc}</div>
                    </div>
                    <span className={`text-xs font-bold ${done ? "text-[#f59e0b]" : "text-white/20"}`}>+{ch.xp} xp</span>
                  </button>
                );
              })}
            </Card>
          </div>
        )}

        {/* Side quests */}
        <div>
          <h4 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">Side Quests</h4>
          <Card className="divide-y divide-white/[0.04]">
            {QUEST_DEFS.map(q => {
              const st = athlete.quests[q.id] || "pending";
              return (
                <button key={q.id} onClick={(e) => cycleQuest(athlete.id, q.id, q.xp, e)}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors min-h-[56px] ${
                    st === "done" ? "bg-emerald-500/5" : st === "active" ? "bg-[#6b21a8]/5" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-md shrink-0 uppercase tracking-wider ${CAT_COLORS[q.cat] || "bg-white/10 text-white/40"}`}>
                    {q.cat}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{q.name}</div>
                    <div className="text-white/20 text-[11px]">{q.desc}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold ${
                      st === "done" ? "text-emerald-400" : st === "active" ? "text-[#a855f7]" : "text-white/15"
                    }`}>
                      {st === "done" ? "DONE" : st === "active" ? "ACTIVE" : "START"}
                    </span>
                    <div className="text-white/20 text-[10px]">+{q.xp} xp</div>
                  </div>
                </button>
              );
            })}
          </Card>
        </div>

        {/* Combos */}
        {combos.length > 0 && (
          <div className="space-y-2">
            {combos.map(c => (
              <div key={c} className="px-4 py-3 rounded-xl bg-[#f59e0b]/5 border border-[#f59e0b]/10 text-[#f59e0b] text-sm font-bold">
                {c}
              </div>
            ))}
          </div>
        )}

        {/* Personal growth */}
        {growth && (
          <Card className="p-6">
            <h4 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">You vs Last Month</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-black ${growth.xpGain > 0 ? "text-emerald-400" : growth.xpGain < 0 ? "text-red-400" : "text-white/20"}`}>
                  {growth.xpGain > 0 ? "+" : ""}{growth.xpGain}
                </div>
                <div className="text-white/20 text-[10px] uppercase mt-1">XP Gained</div>
              </div>
              <div>
                <div className={`text-2xl font-black ${growth.streakDelta > 0 ? "text-emerald-400" : growth.streakDelta < 0 ? "text-red-400" : "text-white/20"}`}>
                  {growth.streakDelta > 0 ? "+" : ""}{growth.streakDelta}d
                </div>
                <div className="text-white/20 text-[10px] uppercase mt-1">Streak</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">{athlete.totalPractices}</div>
                <div className="text-white/20 text-[10px] uppercase mt-1">Total Sessions</div>
              </div>
            </div>
          </Card>
        )}

        {view === "coach" && (
          <button onClick={() => removeAthlete(athlete.id)} className="text-red-400/30 text-[10px] hover:text-red-400 transition-colors min-h-[36px] px-1">
            Remove Athlete
          </button>
        )}
      </div>
    );
  };

  // ── PARENT VIEW ──────────────────────────────────────────
  if (view === "parent") {
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs /><XpFloats /><LevelUpOverlay />
        <div className="max-w-[1400px] mx-auto relative z-10 px-5 sm:px-8">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Parent View</h2>
          <p className="text-[#00f0ff]/25 text-xs mb-8 font-mono">Read-only — athlete progress & growth</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roster.sort((a, b) => a.name.localeCompare(b.name)).map(a => {
              const lv = getLevel(a.xp); const prog = getLevelProgress(a.xp); const growth = getPersonalGrowth(a);
              return (
                <Card key={a.id} className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#6b21a8]/20 border border-[#6b21a8]/15 flex items-center justify-center text-xs font-bold text-white">
                      {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium text-sm truncate">{a.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold" style={{ color: lv.color }}>{lv.icon} {lv.name}</span>
                        <span className="text-white/15 text-[10px]">{a.xp} XP</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-2">
                    <div className="h-full rounded-full xp-shimmer transition-all" style={{ width: `${prog.percent}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-white/25">
                    <span>Streak: {a.streak}d</span><span>Practices: {a.totalPractices}</span>
                  </div>
                  {growth && growth.xpGain !== 0 && (
                    <div className={`mt-2 text-[10px] font-medium ${growth.xpGain > 0 ? "text-emerald-400/60" : "text-red-400/60"}`}>
                      {growth.xpGain > 0 ? "+" : ""}{growth.xpGain} XP vs last month
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          <p className="text-white/10 text-[10px] text-center mt-12">Coach manages all data. Parental consent required. Contact coach for data export.</p>
        </div>
      </div>
    );
  }

  // ── AUDIT VIEW ───────────────────────────────────────────
  if (view === "audit") {
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="max-w-[1400px] mx-auto relative z-10 px-5 sm:px-8">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-6">Audit Log</h2>
          <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl p-2 max-h-[70vh] overflow-y-auto shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
            {!auditLog.length && <p className="text-white/20 text-sm p-6 font-mono">No actions recorded yet.</p>}
            {auditLog.slice(0, 200).map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-5 text-sm hover:bg-[#00f0ff]/[0.03] transition-colors border-b border-[#00f0ff]/5 last:border-0">
                <span className="text-[#00f0ff]/25 text-[10px] w-36 shrink-0 font-mono">{new Date(e.timestamp).toLocaleString()}</span>
                <span className="text-white/50 flex-1 truncate font-mono">{e.athleteName}: {e.action}</span>
                {e.xpDelta > 0 && <span className="neon-text-gold font-bold text-sm font-mono">+{e.xpDelta}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ANALYTICS VIEW ───────────────────────────────────────
  if (view === "analytics") {
    const selSnap = selectedDay ? calendarData[selectedDay] : null;
    const tlAthlete = timelineAthleteId ? roster.find(a => a.id === timelineAthleteId) : null;
    const p = periodComparison;
    const top5 = [...roster].sort((a, b) => b.xp - a.xp).slice(0, 5);
    const longestStreak = [...roster].sort((a, b) => b.streak - a.streak)[0];

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="max-w-[1400px] mx-auto relative z-10 px-5 sm:px-8">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-8">Coach Analytics</h2>

          {/* Calendar */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Engagement Calendar</h3>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 30 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - 29 + i);
                const ds = d.toISOString().slice(0, 10);
                const snap = calendarData[ds];
                const intensity = snap ? Math.min(1, snap.totalXPAwarded / 500) : 0;
                const isSel = selectedDay === ds;
                return (
                  <button key={ds} onClick={() => setSelectedDay(isSel ? null : ds)}
                    className={`w-9 h-9 rounded-lg text-[10px] font-medium transition-all ${
                      isSel ? "ring-2 ring-[#f59e0b]/40 text-white" : "text-white/30 hover:bg-white/[0.04]"
                    }`}
                    style={{ background: intensity > 0 ? `rgba(107,33,168,${0.1 + intensity * 0.5})` : "rgba(255,255,255,0.02)" }}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            {selSnap && (
              <Card className="mt-4 p-4 text-sm">
                <div className="font-bold text-white mb-2">{selectedDay}</div>
                <div className="grid grid-cols-3 gap-3 text-white/40">
                  <span>Attendance: {selSnap.attendance}/{selSnap.totalAthletes}</span>
                  <span>XP Earned: {selSnap.totalXPAwarded}</span>
                  <span>Pool: {selSnap.poolCheckins} | Wt: {selSnap.weightCheckins}</span>
                </div>
              </Card>
            )}
          </Card>

          {/* Timeline */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Athlete Timeline</h3>
            <select value={timelineAthleteId || ""} onChange={e => setTimelineAthleteId(e.target.value || null)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white text-sm mb-4 w-full max-w-sm focus:outline-none min-h-[44px]">
              <option value="">Select athlete...</option>
              {roster.sort((a, b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {tlAthlete && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-white font-bold">{tlAthlete.name}</span>
                  <span className="text-[#f59e0b] text-sm">{getLevel(tlAthlete.xp).icon} {tlAthlete.xp} XP</span>
                </div>
                <div className="flex items-end gap-1.5 h-24">
                  {snapshots.slice(-14).map((s, i) => {
                    const xp = s.athleteXPs?.[tlAthlete.id] || 0;
                    const max = Math.max(...snapshots.slice(-14).map(ss => ss.athleteXPs?.[tlAthlete.id] || 0), 1);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-[#6b21a8] transition-all" style={{ height: `${(xp / max) * 100}%`, minHeight: "2px" }} />
                        <span className="text-[9px] text-white/15 font-mono">{new Date(s.date).getDate()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Period comparison */}
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold">Period Comparison</h3>
              <select value={comparePeriod} onChange={e => setComparePeriod(e.target.value as "week" | "month")}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none min-h-[32px]">
                <option value="week">Week</option><option value="month">Month</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[{ label: p.currentLabel, data: p.current }, { label: p.previousLabel, data: p.previous }].map(col => (
                <Card key={col.label} className="p-4">
                  <div className="text-white/25 text-[10px] uppercase tracking-wider font-medium mb-3">{col.label}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-white/35">Avg XP/day</span><span className="text-white font-bold">{avgXP(col.data)}</span></div>
                    <div className="flex justify-between"><span className="text-white/35">Avg Attendance</span><span className="text-white font-bold">{avgAtt(col.data)}%</span></div>
                    <div className="flex justify-between"><span className="text-white/35">Days tracked</span><span className="text-white font-bold">{col.data.length}</span></div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Report card */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Monthly Report Card</h3>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div><div className="text-3xl font-black text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div><div className="text-white/20 text-[10px] uppercase mt-1">Attendance</div></div>
              <div><div className="text-3xl font-black text-[#a855f7]">{avgXP(snapshots.slice(-30))}</div><div className="text-white/20 text-[10px] uppercase mt-1">Avg XP/Day</div></div>
              <div><div className="text-3xl font-black text-white">{longestStreak?.streak || 0}d</div><div className="text-white/20 text-[10px] uppercase mt-1">Longest Streak</div></div>
            </div>
            <div className="mb-4">
              <div className="text-white/25 text-[10px] uppercase tracking-wider mb-2">Top 5</div>
              {top5.map((a, i) => (
                <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-white/40"><span className="text-[#f59e0b] font-bold mr-2">{i + 1}.</span>{a.name}</span>
                  <span className="text-[#f59e0b] font-bold">{a.xp} XP</span>
                </div>
              ))}
            </div>
            {mostImproved && (
              <div className="text-center pt-4 border-t border-white/[0.04]">
                <span className="text-emerald-400 text-sm font-medium">Most Improved: {mostImproved.name}</span>
              </div>
            )}
          </Card>

          <button onClick={exportCSV}
            className="px-5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-medium hover:bg-white/[0.06] transition-colors min-h-[44px]">
            Export CSV
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     COACH MAIN VIEW — LEADERBOARD-FIRST LAYOUT
     ════════════════════════════════════════════════════════════ */

  const present = roster.filter(a => Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)).length;
  const totalXpToday = roster.reduce((s, a) => s + (a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0);

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <XpFloats /><LevelUpOverlay />

      <div className="relative z-10 w-full px-5 sm:px-8">
        <div className="max-w-[1400px] mx-auto">
          <GameHUDHeader />

        {/* ══════════════════════════════════════════════════════
           LEADERBOARD — THE HERO SECTION
           ══════════════════════════════════════════════════════ */}
        <div className="py-6">
            {/* Section header with tabs */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight neon-text-cyan">Leaderboard</h2>
                <div className="flex gap-1 bg-[#06020f]/60 p-1 border border-[#00f0ff]/15 game-panel-sm">
                  {(["all", "M", "F"] as const).map(t => (
                    <button key={t} onClick={() => setLeaderTab(t)}
                      className={`game-btn px-4 py-2 text-xs font-bold transition-all min-h-[32px] font-mono tracking-wider ${
                        leaderTab === t ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 shadow-[0_0_16px_rgba(0,240,255,0.3)]" : "text-white/25 hover:text-[#00f0ff]/50 border border-transparent"
                      }`}>
                      {t === "all" ? "ALL" : t === "M" ? "MALE" : "FEMALE"}
                    </button>
                  ))}
                </div>
              </div>
              {/* MVP badges */}
              <div className="hidden sm:flex gap-2">
                {mvpMale && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#f59e0b]/10 to-transparent border border-[#f59e0b]/15">
                    <span className="text-[9px] font-bold text-[#f59e0b] tracking-wider">♂ MVP</span>
                    <span className="text-white text-xs font-medium">{mvpMale.name.split(" ")[0]}</span>
                  </div>
                )}
                {mvpFemale && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#e879f9]/10 to-transparent border border-[#e879f9]/15">
                    <span className="text-[9px] font-bold text-[#e879f9] tracking-wider">♀ MVP</span>
                    <span className="text-white text-xs font-medium">{mvpFemale.name.split(" ")[0]}</span>
                  </div>
                )}
                {mostImproved && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/15">
                    <span className="text-[9px] font-bold text-emerald-400 tracking-wider">RISING</span>
                    <span className="text-white text-xs font-medium">{mostImproved.name.split(" ")[0]}</span>
                  </div>
                )}
              </div>
            </div>

            {/* PODIUM — Top 3 — Hero Game UI */}
            {sorted.length >= 3 && (
              <div className="relative mb-10">
                {/* Podium glow backdrop */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_60%,rgba(245,158,11,0.08),transparent)] pointer-events-none" />
                <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-[800px] mx-auto items-end">
                  {[1, 0, 2].map(rank => {
                    const a = sorted[rank];
                    const lv = getLevel(a.xp);
                    const avatarSizes = ["w-20 h-20 sm:w-24 sm:h-24 text-xl sm:text-2xl", "w-16 h-16 sm:w-18 sm:h-18 text-base sm:text-lg", "w-16 h-16 sm:w-18 sm:h-18 text-base sm:text-lg"];
                    const medals = ["🥇", "🥈", "🥉"];
                    const ringColors = ["border-[#f59e0b]", "border-[#c0c0d2]/50", "border-[#cd7f32]/60"];
                    const glowColors = [
                      "shadow-[0_0_50px_rgba(245,158,11,0.3),0_0_100px_rgba(245,158,11,0.1)]",
                      "shadow-[0_0_30px_rgba(192,192,210,0.15)]",
                      "shadow-[0_0_30px_rgba(205,127,50,0.15)]",
                    ];
                    const cardBgs = [
                      "bg-gradient-to-b from-[#f59e0b]/10 via-[#06020f]/80 to-[#06020f] neon-pulse-gold",
                      "bg-gradient-to-b from-[#00f0ff]/5 via-[#06020f]/80 to-[#06020f] neon-pulse",
                      "bg-gradient-to-b from-[#cd7f32]/8 via-[#06020f]/80 to-[#06020f]",
                    ];
                    const heights = ["min-h-[280px] sm:min-h-[320px]", "min-h-[240px] sm:min-h-[270px]", "min-h-[240px] sm:min-h-[270px]"];
                    return (
                      <div key={a.id} className={`game-panel game-panel-border relative p-4 sm:p-6 text-center border border-[#00f0ff]/15 backdrop-blur-2xl ${cardBgs[rank]} ${heights[rank]} flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.03] group`}>
                        {rank === 0 && <div className="absolute inset-0 gold-shimmer pointer-events-none" />}
                        <div className={`text-3xl sm:text-4xl mb-3 ${rank === 0 ? "podium-pulse" : ""} drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]`}>{medals[rank]}</div>
                        <div className={`${avatarSizes[rank]} mx-auto ${rank === 0 ? "hex-avatar" : "rounded-full"} flex items-center justify-center font-black text-white mb-3 border-[3px] ${ringColors[rank]} ring-pulse transition-all duration-300 group-hover:scale-110`}
                          style={{ background: `radial-gradient(circle at 30% 30%, ${lv.color}35, ${lv.color}10)`, "--ring-glow": rank === 0 ? "rgba(245,158,11,0.4)" : rank === 1 ? "rgba(0,240,255,0.3)" : "rgba(205,127,50,0.3)" } as React.CSSProperties}>
                          {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className={`text-base sm:text-lg font-black truncate w-full ${rank === 0 ? "neon-text-gold" : "text-white"}`}>{a.name.split(" ")[0]}</div>
                        <div className="text-[#00f0ff]/20 text-[11px] truncate w-full font-mono">{a.name.split(" ").slice(1).join(" ")}</div>
                        <div className="rank-badge text-[11px] font-bold mt-3 px-4 py-1.5 inline-flex items-center gap-1.5 font-mono" style={{ color: lv.color, background: `${lv.color}18`, boxShadow: `0 0 15px ${lv.color}15` }}>
                          {lv.icon} {lv.name}
                        </div>
                        <div className="neon-text-gold text-2xl sm:text-3xl font-black mt-3 tracking-tight font-mono">
                          {a.xp}<span className="text-xs text-[#f59e0b]/30 ml-1">XP</span>
                        </div>
                        {a.streak > 0 && (
                          <div className="text-white/20 text-[10px] mt-1 font-bold">🔥 {a.streak}d streak</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full ranked list — all athletes 1-N */}
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="text-[#00f0ff]/40 text-[11px] uppercase tracking-[0.2em] font-bold font-mono">// Full Rankings</h3>
              <span className="text-[#00f0ff]/20 text-[10px] font-mono">{sorted.length} athletes</span>
            </div>
            <div className="game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-2xl overflow-hidden shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
              {sorted.map((a, i) => {
                const lv = getLevel(a.xp);
                const sk = fmtStreak(a.streak);
                const rank = i + 1;
                const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                return (
                  <div key={a.id} className={`flex items-center gap-4 py-4 px-6 transition-all duration-200 hover:bg-white/[0.04] hover:shadow-[inset_0_0_30px_rgba(107,33,168,0.05)] group ${rank <= 3 ? "bg-white/[0.02]" : ""} ${i < sorted.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                    <span className={`w-8 text-center text-sm font-black transition-colors ${rank <= 3 ? "text-[#f59e0b]" : "text-white/10 group-hover:text-white/25"}`}>
                      {medalEmoji || rank}
                    </span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white/70 shrink-0 transition-all duration-200 group-hover:scale-110"
                      style={{ background: `radial-gradient(circle, ${lv.color}20, ${lv.color}08)`, border: `2px solid ${lv.color}${rank <= 3 ? "60" : "30"}`, boxShadow: `0 0 12px ${lv.color}${rank <= 3 ? "20" : "10"}` }}>
                      {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className={`text-sm font-semibold flex-1 truncate group-hover:text-white transition-colors ${rank <= 3 ? "text-white" : "text-white/80"}`}>{a.name}</span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1 transition-all" style={{ color: lv.color, background: `${lv.color}12`, boxShadow: `0 0 8px ${lv.color}08` }}>{lv.icon} {lv.name}</span>
                    {a.streak > 0 && <span className="text-white/20 text-[10px] hidden sm:inline font-bold">🔥 {a.streak}d</span>}
                    <span className="text-[#f59e0b] text-sm font-black w-16 text-right drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">{a.xp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
           COACH TOOLS + ROSTER CHECK-IN
           ══════════════════════════════════════════════════════ */}
        <div className="w-full px-5 sm:px-8 py-6">
          <div className="max-w-[1400px] mx-auto">
            {/* Session mode + tools */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex gap-2">
                {(["pool", "weight", "meet"] as const).map(m => {
                  const icons = { pool: "🏊", weight: "🏋️", meet: "🏁" };
                  const labels = { pool: "Pool", weight: "Weight Room", meet: "Meet Day" };
                  return (
                    <button key={m} onClick={() => setSessionMode(m)}
                      className={`game-btn px-6 py-3.5 text-sm font-bold transition-all duration-200 min-h-[52px] font-mono tracking-wider uppercase ${
                        sessionMode === m
                          ? "bg-[#00f0ff]/15 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_40px_rgba(0,240,255,0.3),inset_0_0_20px_rgba(0,240,255,0.05)] scale-[1.02]"
                          : "bg-[#06020f]/60 text-white/30 hover:text-[#00f0ff]/60 border border-[#00f0ff]/10 hover:border-[#00f0ff]/25 hover:shadow-[0_0_25px_rgba(0,240,255,0.1)] hover:scale-[1.01]"
                      }`}>
                      <span className="mr-1.5">{icons[m]}</span>{labels[m]}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={bulkMarkPresent} className="game-btn px-4 py-2.5 bg-[#00f0ff]/10 text-[#00f0ff]/80 text-sm font-mono tracking-wider border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all active:scale-[0.97] min-h-[44px]">
                  ✅ BULK
                </button>
                <button onClick={undoLast} className="game-btn px-3 py-2.5 bg-[#06020f]/60 text-[#00f0ff]/30 text-sm font-mono border border-[#00f0ff]/10 hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/25 transition-all active:scale-[0.97] min-h-[44px]">↩ UNDO</button>
                <button onClick={resetDay} className="game-btn px-3 py-2.5 bg-[#06020f]/60 text-[#a855f7]/30 text-sm font-mono border border-[#a855f7]/10 hover:text-[#e879f9]/60 hover:border-[#e879f9]/25 transition-all active:scale-[0.97] min-h-[44px]">🔄 DAY</button>
                <button onClick={resetWeek} className="game-btn px-3 py-2.5 bg-[#06020f]/60 text-[#a855f7]/30 text-sm font-mono border border-[#a855f7]/10 hover:text-[#e879f9]/60 hover:border-[#e879f9]/25 transition-all active:scale-[0.97] min-h-[44px]">🔄 WEEK</button>
                <button onClick={resetMonth} className="game-btn px-3 py-2.5 bg-[#06020f]/60 text-[#f59e0b]/30 text-sm font-mono border border-[#f59e0b]/10 hover:text-[#f59e0b]/60 hover:border-[#f59e0b]/25 transition-all active:scale-[0.97] min-h-[44px]">🏆 MONTH</button>
                <button onClick={exportCSV} className="game-btn px-3 py-2.5 bg-[#06020f]/60 text-[#00f0ff]/30 text-sm font-mono border border-[#00f0ff]/10 hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/25 transition-all active:scale-[0.97] min-h-[44px]">📊 CSV</button>
              </div>
            </div>

            {/* Add athlete */}
            <div className="mb-6">
              <button onClick={() => setAddAthleteOpen(!addAthleteOpen)}
                className="text-white/20 text-xs hover:text-white/40 transition-colors min-h-[36px]">
                {addAthleteOpen ? "Cancel" : "+ Add Athlete"}
              </button>
              {addAthleteOpen && (
                <div className="flex gap-3 mt-3 items-center flex-wrap">
                  <input value={newAthleteName} onChange={e => setNewAthleteName(e.target.value)} placeholder="Name"
                    className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm w-52 focus:outline-none focus:border-[#6b21a8]/40 min-h-[44px]" />
                  <input value={newAthleteAge} onChange={e => setNewAthleteAge(e.target.value.replace(/\D/g, ""))} placeholder="Age"
                    className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm w-20 focus:outline-none min-h-[44px]" />
                  <select value={newAthleteGender} onChange={e => setNewAthleteGender(e.target.value as "M" | "F")}
                    className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none min-h-[44px]">
                    <option value="M">M</option><option value="F">F</option>
                  </select>
                  <button onClick={addAthleteAction}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#7c3aed] to-[#6b21a8] text-white text-sm font-bold min-h-[44px] hover:shadow-[0_0_20px_rgba(107,33,168,0.3)] transition-all">
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* ── ATHLETE ROSTER ─────────────────────────────── */}
            <h3 className="text-[#00f0ff]/30 text-[11px] uppercase tracking-[0.2em] font-bold mb-4 font-mono">// Roster Check-In</h3>
            <div className="space-y-2 mb-10">
              {roster.sort((a, b) => a.name.localeCompare(b.name)).map(a => {
                const lv = getLevel(a.xp);
                const prog = getLevelProgress(a.xp);
                const sk = fmtStreak(a.streak);
                const isExp = expandedId === a.id;
                const hasCk = Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean);
                const dailyUsed = a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0;

                return (
                  <div key={a.id} className={`relative overflow-hidden transition-all duration-200 game-card ${isExp ? "ambient-pulse" : ""}`}>
                    <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: `linear-gradient(180deg, ${hasCk ? "#00f0ff" : lv.color}${hasCk ? "80" : "25"}, transparent)`, boxShadow: hasCk ? `0 0 8px ${lv.color}40` : "none" }} />
                    <div className={`game-panel-sm bg-[#06020f]/70 backdrop-blur-xl border transition-all duration-200 ${
                      isExp ? "border-[#00f0ff]/30 shadow-[0_0_30px_rgba(0,240,255,0.1)]" : hasCk ? "border-[#00f0ff]/15 shadow-[0_0_15px_rgba(0,240,255,0.05)]" : "border-[#00f0ff]/8"
                    } hover:border-[#00f0ff]/25`}>
                      <div
                        className="flex items-center gap-4 p-4 sm:p-5 cursor-pointer hover:bg-white/[0.02] transition-all duration-200 rounded-2xl group"
                        onClick={() => setExpandedId(isExp ? null : a.id)}
                      >
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 transition-all duration-300 group-hover:scale-110"
                          style={{ background: `radial-gradient(circle at 30% 30%, ${lv.color}30, ${lv.color}08)`, border: `2.5px solid ${lv.color}${hasCk ? "90" : "35"}`, boxShadow: hasCk ? `0 0 25px ${lv.color}25, 0 0 50px ${lv.color}08` : `0 0 10px ${lv.color}10` }}
                        >
                          {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{a.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>{lv.icon} {lv.name}</span>
                            {a.streak > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]/70">🔥 {a.streak}d · {sk.mult}</span>}
                            {hasCk && <span className="text-emerald-400/60 text-[10px] font-bold">✓ checked in</span>}
                          </div>
                        </div>
                        <div className="w-32 shrink-0 text-right">
                          <div className="text-white font-black text-base drop-shadow-[0_0_8px_rgba(245,158,11,0.15)]">{a.xp}<span className="text-white/15 text-[10px] ml-1">XP</span></div>
                          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden mt-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]">
                            <div className="h-full rounded-full xp-shimmer" style={{ width: `${prog.percent}%` }} />
                          </div>
                          {dailyUsed > 0 && <div className="text-[10px] text-[#f59e0b]/60 font-bold mt-1.5">+{dailyUsed} today</div>}
                        </div>
                      </div>
                      {isExp && <div className="px-4 sm:px-5 pb-5"><AthleteExpanded athlete={a} /></div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── TEAM CHALLENGES ──────────────────────────────── */}
            <div className="mb-10">
              <h3 className="text-[#00f0ff]/30 text-[11px] uppercase tracking-[0.2em] font-bold mb-4 font-mono">// Team Challenges</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teamChallenges.map(tc => {
                  const pct = Math.min(100, (tc.current / tc.target) * 100);
                  const done = tc.current >= tc.target;
                  return (
                    <div key={tc.id} className={`game-panel game-panel-border bg-[#06020f]/70 backdrop-blur-xl border p-5 transition-all ${done ? "border-[#f59e0b]/30 neon-pulse-gold" : "border-[#00f0ff]/10"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-sm">{tc.name}</span>
                        <span className={`text-sm font-bold ${done ? "text-[#f59e0b]" : "text-white/25"}`}>{tc.current}%<span className="text-white/10">/{tc.target}%</span></span>
                      </div>
                      <p className="text-white/15 text-[11px] mb-3">{tc.description} · <span className="text-[#f59e0b]/60">+{tc.reward} XP</span></p>
                      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${done ? "bg-gradient-to-r from-[#f59e0b] to-[#fbbf24]" : "bg-gradient-to-r from-[#6b21a8] to-[#7c3aed]"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Privacy footer */}
        <div className="text-center text-white/[0.05] text-[10px] py-10 space-y-1">
          <p>Apex Athlete — Saint Andrew&apos;s Aquatics — Platinum</p>
          <p>Coach manages all data. Parental consent required.</p>
        </div>
      </div>
    </div>
  );
}
