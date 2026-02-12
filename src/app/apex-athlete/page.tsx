"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  syncSave,
  syncSaveRoster,
  syncSaveConfig,
  syncSaveSchedule,
  syncSaveAudit,
  syncSaveSnapshot,
  syncSaveFeedback,
  syncLoad,
  syncLoadRoster,
  syncLoadConfig,
  syncListenRoster,
  syncListenConfig,
  syncPushAllToFirebase,
  firebaseConnected,
} from "@/lib/apex-sync";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Saint Andrew's Aquatics
   Clean UI · React + Tailwind · localStorage + Firebase
   ══════════════════════════════════════════════════════════════ */

// ── game engine ──────────────────────────────────────────────

const LEVELS = [
  { name: "Rookie", xp: 0, icon: "◆", color: "#94a3b8" },
  { name: "Contender", xp: 300, icon: "◇", color: "#a78bfa" },
  { name: "Warrior", xp: 600, icon: "◈", color: "#60a5fa" },
  { name: "Elite", xp: 1000, icon: "⬡", color: "#f59e0b" },
  { name: "Captain", xp: 1500, icon: "⬢", color: "#f97316" },
  { name: "Legend", xp: 2500, icon: "✦", color: "#ef4444" },
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
  id: string; name: string; age: number; gender: "M" | "F"; group: string;
  xp: number; streak: number; weightStreak: number; lastStreakDate: string; lastWeightStreakDate: string;
  totalPractices: number; weekSessions: number; weekWeightSessions: number; weekTarget: number;
  checkpoints: Record<string, boolean>;
  weightCheckpoints: Record<string, boolean>;
  meetCheckpoints: Record<string, boolean>;
  weightChallenges: Record<string, boolean>;
  quests: Record<string, "active" | "done" | "pending">;
  dailyXP: DailyXP;
  // v6 fields — athlete + parent linking
  usaSwimmingId?: string;
  parentCode?: string; // 6-char code parents use to access their child's portal
  parentEmail?: string;
  sport?: "swimming" | "diving" | "waterpolo";
}

// ── Coach Access types ────────────────────────────────────────
interface CoachAccess {
  id: string;
  name: string;
  pin: string;
  role: "head" | "assistant" | "guest";
  groups: string[]; // which groups this coach can access
  createdAt: number;
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

// ── SELAH Wellness types ────────────────────────────────────
interface MentalReadiness {
  date: string; focus: number; energy: number; confidence: number; motivation: number;
}
interface BreathworkSession {
  date: string; completedAt: number; rounds: number;
}
interface JournalEntry {
  date: string; wentWell: string; challenging: string; improve: string; completedAt: number;
}
interface RecoveryLog {
  date: string; sleepQuality: number; sorenessLevel: number; hydrationGlasses: number;
}
interface WellnessData {
  mentalReadiness: MentalReadiness[];
  breathworkSessions: BreathworkSession[];
  journalEntries: JournalEntry[];
  recoveryLogs: RecoveryLog[];
}

// ── schedule types ──────────────────────────────────────────

type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const DAYS_OF_WEEK: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type SessionType = "pool" | "weight" | "dryland";

interface ScheduleSession {
  id: string;
  type: SessionType;
  label: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  location: string;
  notes: string;
}

interface DaySchedule {
  template: string; // template id
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

const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  { id: "sprint-day", name: "Sprint Day", icon: "⚡", color: "#f59e0b", description: "Short-distance speed work, starts & turns" },
  { id: "endurance-day", name: "Endurance Day", icon: "≈", color: "#60a5fa", description: "Distance sets, threshold training, pacing" },
  { id: "drill-day", name: "Drill Day", icon: "⚙", color: "#a855f7", description: "Technique drills, stroke correction, form focus" },
  { id: "technique-day", name: "Technique Day", icon: "◎", color: "#34d399", description: "Video review, underwater work, refinement" },
  { id: "meet-day", name: "Meet Day", icon: "▶", color: "#ef4444", description: "Competition day — warm-up, race, cool-down" },
  { id: "rest-day", name: "Rest Day", icon: "·", color: "#475569", description: "Recovery — no scheduled sessions" },
];

// Convert 24h "HH:MM" to 12h "h:MM AM/PM"
function fmt12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function makeDefaultSession(type: SessionType, groupId: string): ScheduleSession {
  const defaults: Record<SessionType, { label: string; start: string; end: string; location: string }> = {
    pool: { label: "Pool Practice", start: "15:30", end: "17:30", location: "Main Pool" },
    weight: { label: "Weight Room", start: "17:30", end: "18:30", location: "Weight Room" },
    dryland: { label: "Dryland", start: "15:00", end: "15:30", location: "Pool Deck" },
  };
  const d = defaults[type];
  // Platinum gets later weight room time
  if (type === "weight" && groupId === "platinum") {
    return { id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, label: d.label, startTime: "17:30", endTime: "18:30", location: d.location, notes: "" };
  }
  return { id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, label: d.label, startTime: d.start, endTime: d.end, location: d.location, notes: "" };
}

// ── REAL SCHEDULES (from GoMotion, week of Jan 25-31 2026) ──
function _s(type: SessionType, label: string, start: string, end: string, location = "Main Pool", notes = ""): ScheduleSession {
  return { id: `s-${Math.random().toString(36).slice(2, 8)}`, type, label, startTime: start, endTime: end, location, notes };
}
const _rest = (): DaySchedule => ({ template: "rest-day", sessions: [] });

const REAL_SCHEDULES: Record<string, GroupSchedule> = {
  // ── PLATINUM (from PDF + Ramon corrections) ──
  // Mon: AM 5:30-7:00 Aerobic endurance, PM 3:30-5:00 Split groups, Weight 5:30-6:30
  // Tue: PM 4:00-6:00 200-pace day (all together)
  // Wed: AM 5:30-7:00 Boys power/Girls IM, PM 3:30-5:00 Recovery, Weight 5:30-6:30
  // Thu: PM 4:00-6:00 Sprint/Mid-Distance split
  // Fri: AM 5:30-7:00 Girls power/Boys IM, Weight 5:30-6:30
  // Sat: 7:00-9:30 Lactic acid threshold / race pace
  platinum: { groupId: "platinum", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [
      _s("pool", "AM — Aerobic Endurance", "05:30", "07:00", "Main Pool", "Aerobic endurance focus"),
      _s("pool", "PM — Sprint / Mid-Distance Split", "15:30", "17:00", "Main Pool", "Sprint Group: aerobic + anaerobic + kicking / Mid-Distance: separate"),
      _s("weight", "Weight Room", "17:30", "18:30", "Weight Room", ""),
    ]},
    Tue: { template: "technique-day", sessions: [
      _s("pool", "PM — 200-Pace Day (All Groups)", "16:00", "18:00", "Main Pool", "All groups together — 200-pace day for strokes other than freestyle"),
    ]},
    Wed: { template: "drill-day", sessions: [
      _s("pool", "AM — Boys: Power & Speed / Girls: IM", "05:30", "07:00", "Main Pool", "Boys: power racks, parachutes, paddles, fins, stretch cords / Girls: Individual Medley"),
      _s("pool", "PM — Recovery Practice", "15:30", "17:00", "Main Pool", "Drills, loosening up, starts, turns, and small details"),
      _s("weight", "Weight Room", "17:30", "18:30", "Weight Room", ""),
    ]},
    Thu: { template: "sprint-day", sessions: [
      _s("pool", "PM — Sprint / Mid-Distance Split", "16:00", "18:00", "Main Pool", "Sprint: high-intensity speed work, drills, kicking, technique / Mid-Distance: heavy aerobic + slight anaerobic"),
    ]},
    Fri: { template: "sprint-day", sessions: [
      _s("pool", "AM — Girls: Power & Speed / Boys: IM", "05:30", "07:00", "Main Pool", "Girls: power racks, parachutes, paddles, fins, stretch cords / Boys: Individual Medley"),
      _s("weight", "Weight Room", "17:30", "18:30", "Weight Room", ""),
    ]},
    Sat: { template: "meet-day", sessions: [
      _s("pool", "Lactic Acid Threshold — Race Pace", "07:00", "09:30", "Main Pool", "Series of races from the blocks at race speed and pace. End of week test set!"),
    ]},
  }},
  // ── GOLD: Mon-Fri 5:30-7:30 PM, Sat 7:00-9:30 AM ──
  gold: { groupId: "gold", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [_s("pool", "Gold Practice", "17:30", "19:30")] },
    Tue: { template: "technique-day", sessions: [_s("pool", "Gold Practice", "17:30", "19:30")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Gold Practice", "17:30", "19:30")] },
    Thu: { template: "sprint-day", sessions: [_s("pool", "Gold Practice", "17:30", "19:30")] },
    Fri: { template: "endurance-day", sessions: [_s("pool", "Gold Practice", "17:30", "19:30")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Gold Saturday", "07:00", "09:30")] },
  }},
  // ── SILVER: Mon-Fri 6:00-7:30 PM, Sat 8:50-11:00 AM ──
  silver: { groupId: "silver", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [_s("pool", "Silver Practice", "18:00", "19:30")] },
    Tue: { template: "technique-day", sessions: [_s("pool", "Silver Practice", "18:00", "19:30")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Silver Practice", "18:00", "19:30")] },
    Thu: { template: "sprint-day", sessions: [_s("pool", "Silver Practice", "18:00", "19:30")] },
    Fri: { template: "endurance-day", sessions: [_s("pool", "Silver Practice", "18:00", "19:30")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Silver Saturday", "08:50", "11:00")] },
  }},
  // ── BRONZE 1: Mon/Wed/Fri 5:00-6:00 PM, Tue/Thu 3:30-4:30 PM, Sat 11:00 AM-12:00 PM ──
  bronze1: { groupId: "bronze1", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [_s("pool", "Bronze 1 Practice", "17:00", "18:00")] },
    Tue: { template: "technique-day", sessions: [_s("pool", "Bronze 1 Practice", "15:30", "16:30")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Bronze 1 Practice", "17:00", "18:00")] },
    Thu: { template: "sprint-day", sessions: [_s("pool", "Bronze 1 Practice", "15:30", "16:30")] },
    Fri: { template: "endurance-day", sessions: [_s("pool", "Bronze 1 Practice", "17:00", "18:00")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Bronze 1 Saturday", "11:00", "12:00")] },
  }},
  // ── BRONZE 2: Tue/Thu/Fri 5:00-6:00 PM, Sat 11:00 AM-12:00 PM ──
  bronze2: { groupId: "bronze2", weekSchedule: {
    Sun: _rest(),
    Mon: _rest(),
    Tue: { template: "technique-day", sessions: [_s("pool", "Bronze 2 Practice", "17:00", "18:00")] },
    Wed: _rest(),
    Thu: { template: "sprint-day", sessions: [_s("pool", "Bronze 2 Practice", "17:00", "18:00")] },
    Fri: { template: "endurance-day", sessions: [_s("pool", "Bronze 2 Practice", "17:00", "18:00")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Bronze 2 Saturday", "11:00", "12:00")] },
  }},
  // ── DIVING: Mon/Wed/Fri 3:30-5:00 PM, Sat 10:00-11:00 AM ──
  diving: { groupId: "diving", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "drill-day", sessions: [_s("pool", "Diving Practice", "15:30", "17:00")] },
    Tue: _rest(),
    Wed: { template: "drill-day", sessions: [_s("pool", "Diving Practice", "15:30", "17:00")] },
    Thu: _rest(),
    Fri: { template: "drill-day", sessions: [_s("pool", "Diving Practice", "15:30", "17:00")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Diving Saturday", "10:00", "11:00")] },
  }},
  // ── WATER POLO: Mon-Thu 6:00-7:00 PM ──
  waterpolo: { groupId: "waterpolo", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "sprint-day", sessions: [_s("pool", "Water Polo Practice", "18:00", "19:00")] },
    Tue: { template: "endurance-day", sessions: [_s("pool", "Water Polo Practice", "18:00", "19:00")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Water Polo Practice", "18:00", "19:00")] },
    Thu: { template: "technique-day", sessions: [_s("pool", "Water Polo Practice", "18:00", "19:00")] },
    Fri: _rest(),
    Sat: _rest(),
  }},
};

function makeDefaultGroupSchedule(groupId: string): GroupSchedule {
  return REAL_SCHEDULES[groupId] ?? {
    groupId,
    weekSchedule: { Mon: _rest(), Tue: _rest(), Wed: _rest(), Thu: _rest(), Fri: _rest(), Sat: _rest(), Sun: _rest() },
  };
}

// ── initial roster ───────────────────────────────────────────

// ── ROSTER GROUPS ────────────────────────────────────────────
const ROSTER_GROUPS = [
  { id: "platinum", name: "Platinum", sport: "swimming", color: "#c0c0ff", icon: "◆" },
  { id: "gold", name: "Gold", sport: "swimming", color: "#f59e0b", icon: "●" },
  { id: "silver", name: "Silver", sport: "swimming", color: "#94a3b8", icon: "○" },
  { id: "bronze1", name: "Bronze 1", sport: "swimming", color: "#cd7f32", icon: "◆" },
  { id: "bronze2", name: "Bronze 2", sport: "swimming", color: "#cd7f32", icon: "◆" },
  { id: "diving", name: "Diving", sport: "diving", color: "#38bdf8", icon: "▽" },
  { id: "waterpolo", name: "Water Polo", sport: "waterpolo", color: "#f97316", icon: "◇" },
] as const;

type GroupId = typeof ROSTER_GROUPS[number]["id"];

// ── SPORT-SPECIFIC CHECKPOINTS ──────────────────────────────
const DIVING_CPS = [
  { id: "d-approach", name: "Approach & Hurdle", xp: 15, desc: "Clean approach and consistent hurdle" },
  { id: "d-takeoff", name: "Takeoff", xp: 15, desc: "Proper takeoff position and power" },
  { id: "d-technique", name: "Technique & Form", xp: 20, desc: "Body position, tuck/pike execution" },
  { id: "d-entry", name: "Entry", xp: 15, desc: "Clean entry with minimal splash" },
  { id: "d-rip-entry", name: "Rip Entry", xp: 25, desc: "Near-perfect rip entry — barely a splash" },
  { id: "d-new-dive", name: "New Dive Attempted", xp: 20, desc: "Tried a dive not in comfort zone" },
  { id: "d-list-complete", name: "Dive List Complete", xp: 25, desc: "Completed full dive list for the day" },
];

const WATERPOLO_CPS = [
  { id: "wp-treading", name: "Treading Endurance", xp: 15, desc: "Strong eggbeater throughout practice" },
  { id: "wp-passing", name: "Passing Accuracy", xp: 15, desc: "Crisp passes, low turnovers" },
  { id: "wp-shooting", name: "Shooting Drill", xp: 20, desc: "Completed shooting drills with focus" },
  { id: "wp-defense", name: "Defensive Effort", xp: 15, desc: "Active pressing, body position, steals" },
  { id: "wp-game-iq", name: "Game IQ", xp: 20, desc: "Smart decisions, reads the play" },
  { id: "wp-counterattack", name: "Counterattack Hustle", xp: 15, desc: "Sprint transitions, fast break effort" },
  { id: "wp-6on5", name: "6-on-5 Execution", xp: 20, desc: "Proper movement and shooting in man-up" },
];

function getCPsForSport(sport: string) {
  if (sport === "diving") return DIVING_CPS;
  if (sport === "waterpolo") return WATERPOLO_CPS;
  return POOL_CPS;
}

// ── INITIAL ROSTERS BY GROUP ────────────────────────────────
type RosterEntry = { name: string; age: number; gender: "M" | "F"; group: GroupId };

const INITIAL_ROSTER: RosterEntry[] = [
  // ── PLATINUM (33) ──
  { name: "William Domokos-Murphy", age: 17, gender: "M", group: "platinum" },
  { name: "Enrico Guizardi", age: 15, gender: "M", group: "platinum" },
  { name: "Jorge Aguila", age: 17, gender: "M", group: "platinum" },
  { name: "Jared Berke", age: 17, gender: "M", group: "platinum" },
  { name: "Andrew Bouche", age: 17, gender: "M", group: "platinum" },
  { name: "Conner Brinley", age: 18, gender: "M", group: "platinum" },
  { name: "Bradley DiPaolo", age: 16, gender: "M", group: "platinum" },
  { name: "William Gillis", age: 18, gender: "M", group: "platinum" },
  { name: "William McAndrews", age: 14, gender: "M", group: "platinum" },
  { name: "Matthias Orlandini", age: 16, gender: "M", group: "platinum" },
  { name: "Matthew Prieres", age: 16, gender: "M", group: "platinum" },
  { name: "Luke Reid", age: 14, gender: "M", group: "platinum" },
  { name: "Surfiel Santiago", age: 18, gender: "M", group: "platinum" },
  { name: "Simon Sheinfeld", age: 16, gender: "M", group: "platinum" },
  { name: "Cash Vinas", age: 17, gender: "M", group: "platinum" },
  { name: "Nerea Gutierrez", age: 17, gender: "F", group: "platinum" },
  { name: "Mayah Chouloute", age: 16, gender: "F", group: "platinum" },
  { name: "Sophia Gamboa-Pereira", age: 14, gender: "F", group: "platinum" },
  { name: "Gabia Gelumbickas", age: 17, gender: "F", group: "platinum" },
  { name: "Alejandra Gil-Restrepo", age: 17, gender: "F", group: "platinum" },
  { name: "Christina Gumbinger", age: 18, gender: "F", group: "platinum" },
  { name: "Alera Hurwitz", age: 16, gender: "F", group: "platinum" },
  { name: "Lilly Karas", age: 15, gender: "F", group: "platinum" },
  { name: "Sienna Kourjakian", age: 15, gender: "F", group: "platinum" },
  { name: "Alexandra Lucchese", age: 14, gender: "F", group: "platinum" },
  { name: "Cielo Moya", age: 14, gender: "F", group: "platinum" },
  { name: "Ariana Moya Vargas", age: 17, gender: "F", group: "platinum" },
  { name: "Jette Neubauer", age: 16, gender: "F", group: "platinum" },
  { name: "Christina Paschal", age: 17, gender: "F", group: "platinum" },
  { name: "Erin Reid", age: 16, gender: "F", group: "platinum" },
  { name: "Athena Rilo", age: 15, gender: "F", group: "platinum" },
  { name: "Cecilie von Klaeden", age: 17, gender: "F", group: "platinum" },
  { name: "Grace Weeks", age: 14, gender: "F", group: "platinum" },
  // ── GOLD (22) ──
  { name: "Amelia Baral", age: 13, gender: "F", group: "gold" },
  { name: "Jackson Baral", age: 12, gender: "M", group: "gold" },
  { name: "Lorenz Fahnenschmidt", age: 12, gender: "M", group: "gold" },
  { name: "Daniel Gil-Restrepo", age: 14, gender: "M", group: "gold" },
  { name: "Benjamin Gober", age: 15, gender: "M", group: "gold" },
  { name: "Joaquin Gomez-Llendo", age: 13, gender: "M", group: "gold" },
  { name: "Kayla Jorge", age: 15, gender: "F", group: "gold" },
  { name: "Sakshi Kaur", age: 12, gender: "F", group: "gold" },
  { name: "Peter Lehmann", age: 16, gender: "M", group: "gold" },
  { name: "Brooklyn Lewis", age: 13, gender: "F", group: "gold" },
  { name: "Maria Monozova", age: 14, gender: "F", group: "gold" },
  { name: "Ari Nelson", age: 15, gender: "M", group: "gold" },
  { name: "Aliyana Ordunez", age: 14, gender: "F", group: "gold" },
  { name: "Mathaus Polli", age: 13, gender: "M", group: "gold" },
  { name: "Eli Rudikoff", age: 15, gender: "M", group: "gold" },
  { name: "Daniel Sigda", age: 13, gender: "M", group: "gold" },
  { name: "Julieta Siok", age: 13, gender: "F", group: "gold" },
  { name: "Alexandra Thomson", age: 13, gender: "F", group: "gold" },
  { name: "Ava Umstattd", age: 14, gender: "F", group: "gold" },
  { name: "Camile Waber", age: 15, gender: "F", group: "gold" },
  { name: "Tyler Wright", age: 12, gender: "M", group: "gold" },
  { name: "Oleh Zinerko", age: 13, gender: "M", group: "gold" },
  // ── SILVER (~48) ──
  { name: "Henry Andrews", age: 10, gender: "M", group: "silver" },
  { name: "Maxim Anisimov", age: 12, gender: "M", group: "silver" },
  { name: "Whitney Avella", age: 10, gender: "F", group: "silver" },
  { name: "James Averian", age: 11, gender: "M", group: "silver" },
  { name: "Fletcher Baral", age: 10, gender: "M", group: "silver" },
  { name: "Mila Bidva", age: 10, gender: "F", group: "silver" },
  { name: "Alec Chen", age: 13, gender: "M", group: "silver" },
  { name: "Alessandro Cubas", age: 14, gender: "M", group: "silver" },
  { name: "Tomas Fabo", age: 11, gender: "M", group: "silver" },
  { name: "Danny Fang", age: 13, gender: "M", group: "silver" },
  { name: "Jackson Gallo", age: 13, gender: "M", group: "silver" },
  { name: "Melana Gnesin", age: 11, gender: "F", group: "silver" },
  { name: "Jeffrey Hill", age: 10, gender: "M", group: "silver" },
  { name: "Penn Hofeld", age: 10, gender: "M", group: "silver" },
  { name: "Marko Ivanovskyy", age: 13, gender: "M", group: "silver" },
  { name: "Savva Kan", age: 14, gender: "M", group: "silver" },
  { name: "Nina Kosta", age: 11, gender: "F", group: "silver" },
  { name: "Sara Kourjakian", age: 10, gender: "F", group: "silver" },
  { name: "Elanna Krslovic", age: 10, gender: "F", group: "silver" },
  { name: "Roman Kuleshov", age: 9, gender: "M", group: "silver" },
  { name: "Mark Kuleshov", age: 11, gender: "M", group: "silver" },
  { name: "Hlib Kyryliuk", age: 13, gender: "M", group: "silver" },
  { name: "Konrad Laszczak", age: 12, gender: "M", group: "silver" },
  { name: "Matthew Lehmann", age: 12, gender: "M", group: "silver" },
  { name: "Ates Maranezli", age: 12, gender: "M", group: "silver" },
  { name: "Vincent McAndrews", age: 10, gender: "M", group: "silver" },
  { name: "Antonio Micalizzi", age: 15, gender: "M", group: "silver" },
  { name: "Julie Miksik", age: 11, gender: "F", group: "silver" },
  { name: "Nikolai Morozov", age: 11, gender: "M", group: "silver" },
  { name: "Stella Nessen", age: 10, gender: "F", group: "silver" },
  { name: "Samantha Panetta", age: 12, gender: "F", group: "silver" },
  { name: "Harper Parrott", age: 11, gender: "F", group: "silver" },
  { name: "Hadya Refaat", age: 12, gender: "F", group: "silver" },
  { name: "Luke Rodgers", age: 16, gender: "M", group: "silver" },
  { name: "Eli Rutkovsky", age: 10, gender: "M", group: "silver" },
  { name: "Caio Samora", age: 12, gender: "M", group: "silver" },
  { name: "Lucas Siems", age: 15, gender: "M", group: "silver" },
  { name: "Luigi Silveira", age: 12, gender: "M", group: "silver" },
  { name: "Lila Sinclair", age: 11, gender: "F", group: "silver" },
  { name: "Shay Swan", age: 14, gender: "M", group: "silver" },
  { name: "Tyler Szmiga", age: 14, gender: "M", group: "silver" },
  { name: "Arnas Thompson", age: 10, gender: "M", group: "silver" },
  { name: "Morgan Thomson", age: 11, gender: "F", group: "silver" },
  { name: "Liam Torres", age: 13, gender: "M", group: "silver" },
  { name: "Liam van Arkel", age: 14, gender: "M", group: "silver" },
  { name: "Olivia Warner", age: 10, gender: "F", group: "silver" },
  { name: "Everett Weeks", age: 12, gender: "M", group: "silver" },
  // ── BRONZE 1 (~38) ──
  { name: "Arthur Alikhanyan", age: 12, gender: "M", group: "bronze1" },
  { name: "Robert Bekh", age: 9, gender: "M", group: "bronze1" },
  { name: "Mark Bekh", age: 6, gender: "M", group: "bronze1" },
  { name: "Kali Bidva", age: 7, gender: "F", group: "bronze1" },
  { name: "Alexandra Bohlman", age: 10, gender: "F", group: "bronze1" },
  { name: "Vivian Cartelli", age: 8, gender: "F", group: "bronze1" },
  { name: "Emilia Castaneda", age: 9, gender: "F", group: "bronze1" },
  { name: "Shawn Cohen", age: 11, gender: "M", group: "bronze1" },
  { name: "Edwin Diaz", age: 11, gender: "M", group: "bronze1" },
  { name: "Mark Egorov", age: 11, gender: "M", group: "bronze1" },
  { name: "Fabiano Feu Rosa", age: 6, gender: "M", group: "bronze1" },
  { name: "Daniel Fralou", age: 7, gender: "M", group: "bronze1" },
  { name: "Aron Garber", age: 7, gender: "M", group: "bronze1" },
  { name: "Shane Hogenson", age: 7, gender: "M", group: "bronze1" },
  { name: "Andrei Kanashin", age: 7, gender: "M", group: "bronze1" },
  { name: "Vanya Klachko", age: 8, gender: "M", group: "bronze1" },
  { name: "Yana Klachko", age: 10, gender: "F", group: "bronze1" },
  { name: "Kaia Kohn", age: 9, gender: "F", group: "bronze1" },
  { name: "Aimee Laham Boulos", age: 8, gender: "F", group: "bronze1" },
  { name: "Mateo Libreros", age: 9, gender: "M", group: "bronze1" },
  { name: "Ivans Loscenkovs", age: 12, gender: "M", group: "bronze1" },
  { name: "Ella Lurie", age: 8, gender: "F", group: "bronze1" },
  { name: "Zora Nerette", age: 9, gender: "F", group: "bronze1" },
  { name: "Nikolay Nichiporenko", age: 11, gender: "M", group: "bronze1" },
  { name: "Amelia O'Malley Mastropieri", age: 8, gender: "F", group: "bronze1" },
  { name: "Emerson Panetta", age: 9, gender: "M", group: "bronze1" },
  { name: "Ariela Pilewski", age: 8, gender: "F", group: "bronze1" },
  { name: "Anastasia Pylypenko", age: 9, gender: "F", group: "bronze1" },
  { name: "Isabella Ramirez", age: 7, gender: "F", group: "bronze1" },
  { name: "Ilgin Sabah", age: 12, gender: "M", group: "bronze1" },
  { name: "Bahdan Sak", age: 12, gender: "M", group: "bronze1" },
  { name: "Emma Schechter", age: 9, gender: "F", group: "bronze1" },
  { name: "Luna Stroud", age: 7, gender: "F", group: "bronze1" },
  { name: "Talia Weinbaum", age: 7, gender: "F", group: "bronze1" },
  { name: "Austin Wilson", age: 8, gender: "M", group: "bronze1" },
  { name: "Olivia Ynigo-Imme", age: 9, gender: "F", group: "bronze1" },
  { name: "Cameron Ziegenfuss", age: 8, gender: "M", group: "bronze1" },
  // ── BRONZE 2 (~26) ──
  { name: "Mohamed AboShanab", age: 10, gender: "M", group: "bronze2" },
  { name: "Allegra Arrendale", age: 9, gender: "F", group: "bronze2" },
  { name: "Nathaniel Borodin", age: 12, gender: "M", group: "bronze2" },
  { name: "Zean Chen", age: 13, gender: "M", group: "bronze2" },
  { name: "Cora Chodash", age: 10, gender: "F", group: "bronze2" },
  { name: "Diego Corrales", age: 9, gender: "M", group: "bronze2" },
  { name: "Alessandra Davis", age: 9, gender: "F", group: "bronze2" },
  { name: "Jaxson Dehnert", age: 8, gender: "M", group: "bronze2" },
  { name: "Emma Dorsey", age: 11, gender: "F", group: "bronze2" },
  { name: "Valentina Esteban", age: 10, gender: "F", group: "bronze2" },
  { name: "Pablo Galan", age: 12, gender: "M", group: "bronze2" },
  { name: "Ashton Gaspin", age: 10, gender: "M", group: "bronze2" },
  { name: "Adrian-Nickolay Georgiev", age: 10, gender: "M", group: "bronze2" },
  { name: "Miles Heller", age: 12, gender: "M", group: "bronze2" },
  { name: "Ace Hill", age: 7, gender: "M", group: "bronze2" },
  { name: "Ela Kasikci", age: 13, gender: "F", group: "bronze2" },
  { name: "Boban Kirk", age: 10, gender: "M", group: "bronze2" },
  { name: "Alexa Kish", age: 11, gender: "F", group: "bronze2" },
  { name: "Alexandra Maskow", age: 12, gender: "F", group: "bronze2" },
  { name: "Andrew Mateo", age: 11, gender: "M", group: "bronze2" },
  { name: "Alan Mateo", age: 8, gender: "M", group: "bronze2" },
  { name: "Borislav Petrov", age: 13, gender: "M", group: "bronze2" },
  { name: "Callen Previll", age: 12, gender: "M", group: "bronze2" },
  { name: "Joseph Rams", age: 12, gender: "M", group: "bronze2" },
  { name: "Noah Rasmussen", age: 10, gender: "M", group: "bronze2" },
  { name: "Olivia Rekosiewicz", age: 12, gender: "F", group: "bronze2" },
  // ── DIVING (6) ──
  { name: "Cecilia Brems", age: 14, gender: "F", group: "diving" },
  { name: "Millie Cochrane", age: 16, gender: "F", group: "diving" },
  { name: "Chase Korn", age: 13, gender: "M", group: "diving" },
  { name: "Sofia Kourjakian", age: 13, gender: "F", group: "diving" },
  { name: "Harper Mull", age: 15, gender: "F", group: "diving" },
  { name: "Justin Zeller", age: 9, gender: "M", group: "diving" },
  // ── WATER POLO (~57) ──
  { name: "Georgios Androutsopoulos", age: 14, gender: "M", group: "waterpolo" },
  { name: "James Beatty", age: 16, gender: "M", group: "waterpolo" },
  { name: "George Beatty", age: 13, gender: "M", group: "waterpolo" },
  { name: "Elan Beker", age: 15, gender: "M", group: "waterpolo" },
  { name: "Aiden Breit", age: 13, gender: "M", group: "waterpolo" },
  { name: "Grace Brinley", age: 16, gender: "F", group: "waterpolo" },
  { name: "Dimitri Buslayev", age: 11, gender: "M", group: "waterpolo" },
  { name: "Xavier Dicoi", age: 12, gender: "M", group: "waterpolo" },
  { name: "Pedro Drumond Galati", age: 14, gender: "M", group: "waterpolo" },
  { name: "Jack Durocher", age: 13, gender: "M", group: "waterpolo" },
  { name: "Christopher Durocher", age: 10, gender: "M", group: "waterpolo" },
  { name: "Aram Egiazarian", age: 12, gender: "M", group: "waterpolo" },
  { name: "Leo Falkin", age: 14, gender: "M", group: "waterpolo" },
  { name: "Jordan Friesel", age: 14, gender: "M", group: "waterpolo" },
  { name: "Edward Gaukroger", age: 13, gender: "M", group: "waterpolo" },
  { name: "Andrew Glanfield", age: 12, gender: "M", group: "waterpolo" },
  { name: "Robert Gryekhov", age: 11, gender: "M", group: "waterpolo" },
  { name: "Leonardo Guglielmino", age: 17, gender: "M", group: "waterpolo" },
  { name: "Blake Hazard", age: 14, gender: "M", group: "waterpolo" },
  { name: "Nathanael Hazard", age: 17, gender: "M", group: "waterpolo" },
  { name: "Tsimafei Ionau", age: 14, gender: "M", group: "waterpolo" },
  { name: "Noah Kanen", age: 17, gender: "M", group: "waterpolo" },
  { name: "Jonah Kanen", age: 14, gender: "M", group: "waterpolo" },
  { name: "David Koksalan", age: 19, gender: "M", group: "waterpolo" },
  { name: "Quinn Kovacs", age: 12, gender: "M", group: "waterpolo" },
  { name: "Albert Kozlovskyy", age: 11, gender: "M", group: "waterpolo" },
  { name: "Sydney Larsen", age: 15, gender: "F", group: "waterpolo" },
  { name: "Savannah Larsen", age: 12, gender: "F", group: "waterpolo" },
  { name: "Lucas Mango", age: 12, gender: "M", group: "waterpolo" },
  { name: "Enzo Morabito", age: 14, gender: "M", group: "waterpolo" },
  { name: "Robert Mozols", age: 13, gender: "M", group: "waterpolo" },
  { name: "Stephen Mrachek", age: 14, gender: "M", group: "waterpolo" },
  { name: "Gustavo Munford", age: 13, gender: "M", group: "waterpolo" },
  { name: "Leonardo Munford", age: 11, gender: "M", group: "waterpolo" },
  { name: "Matthew Nichols", age: 11, gender: "M", group: "waterpolo" },
  { name: "Christian Nichols", age: 17, gender: "M", group: "waterpolo" },
  { name: "Arsen Pally", age: 18, gender: "M", group: "waterpolo" },
  { name: "Benjamin Persad", age: 16, gender: "M", group: "waterpolo" },
  { name: "Brandon Persad", age: 16, gender: "M", group: "waterpolo" },
  { name: "Alonso Reyes", age: 13, gender: "M", group: "waterpolo" },
  { name: "Bianca Ritz", age: 15, gender: "F", group: "waterpolo" },
  { name: "Santiago Rocha", age: 16, gender: "M", group: "waterpolo" },
  { name: "Trixia Rodriguez", age: 9, gender: "F", group: "waterpolo" },
  { name: "Arantza Rodriguez", age: 14, gender: "F", group: "waterpolo" },
  { name: "Damjan Roncevic", age: 17, gender: "M", group: "waterpolo" },
  { name: "Benjamin Ruytenbeek", age: 14, gender: "M", group: "waterpolo" },
  { name: "Zachary Ruytenbeek", age: 12, gender: "M", group: "waterpolo" },
  { name: "Isabella Schubow", age: 17, gender: "F", group: "waterpolo" },
  { name: "Dylan Shapins", age: 17, gender: "M", group: "waterpolo" },
  { name: "Lainsley Stegall", age: 17, gender: "F", group: "waterpolo" },
  { name: "Charles Surla", age: 15, gender: "M", group: "waterpolo" },
  { name: "Asher Taplinger", age: 11, gender: "M", group: "waterpolo" },
  { name: "Ayla Taplinger", age: 13, gender: "F", group: "waterpolo" },
  { name: "David Van Voorhis", age: 12, gender: "M", group: "waterpolo" },
  { name: "Ithay Yampolsky", age: 15, gender: "M", group: "waterpolo" },
  { name: "Iddo Yampolsky", age: 11, gender: "M", group: "waterpolo" },
];

function makeAthlete(r: { name: string; age: number; gender: "M" | "F"; group?: string }): Athlete {
  return {
    id: r.name.toLowerCase().replace(/\s+/g, "-"),
    name: r.name, age: r.age, gender: r.gender, group: r.group ?? "Varsity",
    xp: 0, streak: 0, weightStreak: 0, lastStreakDate: "", lastWeightStreakDate: "",
    totalPractices: 0, weekSessions: 0, weekWeightSessions: 0, weekTarget: 5,
    checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {},
    weightChallenges: {}, quests: {},
    dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 },
    usaSwimmingId: "",
    parentCode: generateParentCode(),
    parentEmail: "",
    sport: "swimming",
  };
}

function generateParentCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── storage ──────────────────────────────────────────────────

interface CoachProfile {
  name: string;
  pin: string;
  groups: string[]; // which groups this coach can access ("all" or specific group ids)
  role: "head" | "assistant";
}

const K = {
  ROSTER: "apex-athlete-roster-v5",
  PIN: "apex-athlete-pin",
  COACHES: "apex-athlete-coaches-v1",
  AUDIT: "apex-athlete-audit-v2",
  CHALLENGES: "apex-athlete-challenges-v2",
  SNAPSHOTS: "apex-athlete-snapshots-v2",
  CULTURE: "apex-athlete-culture-v2",
  GROUP: "apex-athlete-selected-group",
  SCHEDULES: "apex-athlete-schedules-v2",
  WELLNESS: "apex-athlete-wellness-v1",
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    try { return JSON.parse(v); } catch { return v as unknown as T; }
  } catch { return fallback; }
}
function save(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
  // Firebase sync mapping
  const fbMap: Record<string, string> = {
    [K.PIN]: "config/pin",
    [K.COACHES]: "config/coaches",
    [K.CULTURE]: "config/culture",
    [K.CHALLENGES]: "config/challenges",
    [K.GROUP]: "config/selected-group",
    [K.WELLNESS]: "config/wellness",
  };
  if (fbMap[key]) {
    syncSave(key, val, fbMap[key]);
  }
}

const DEFAULT_CHALLENGES: TeamChallenge[] = [
  { id: "tc-attendance", name: "Full House", description: "90% team attendance this week", target: 90, current: 0, reward: 50 },
  { id: "tc-xp-target", name: "XP Surge", description: "Team earns 2000 XP in a single week", target: 2000, current: 0, reward: 75 },
];

const DEFAULT_CULTURE: TeamCulture = {
  teamName: "Saint Andrew's Aquatics",
  mission: "Unlocking the greatness already inside every athlete — through the power of play.",
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
  const [sessionTime, setSessionTime] = useState<"am" | "pm">(new Date().getHours() < 12 ? "am" : "pm");
  const [autoSession, setAutoSession] = useState(true); // auto-detect from schedule
  const [leaderTab, setLeaderTab] = useState<"all" | "M" | "F">("all");
  const [view, setView] = useState<"coach" | "parent" | "audit" | "analytics" | "schedule" | "wellness" | "strategy">("coach");
  const [activeCoach, setActiveCoach] = useState<string>("Coach");

  // ── Race Strategy state ───────────────────────────────────
  const [stratAthleteId, setStratAthleteId] = useState<string>("");
  const [stratEvent, setStratEvent] = useState("100");
  const [stratStroke, setStratStroke] = useState("Freestyle");
  const [stratCurrentTime, setStratCurrentTime] = useState("");
  const [stratGoalTime, setStratGoalTime] = useState("");
  const [stratPlan, setStratPlan] = useState<null | {
    splits: { segment: string; time: string; pace: string; focus: string }[];
    tips: string[];
    xpReward: number;
    improvement: string;
  }>(null);
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
  const [newAthleteUSAId, setNewAthleteUSAId] = useState("");
  const [newAthleteParentEmail, setNewAthleteParentEmail] = useState("");
  const [editingAthleteProfile, setEditingAthleteProfile] = useState<string | null>(null);
  const [coachInviteOpen, setCoachInviteOpen] = useState(false);
  const [coaches, setCoaches] = useState<CoachAccess[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupId>("platinum");
  const [mounted, setMounted] = useState(false);
  const [levelUpName, setLevelUpName] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<string>("");
  const [xpFloats, setXpFloats] = useState<{ id: string; xp: number; x: number; y: number }[]>([]);
  const floatCounter = useRef(0);
  const [feedbackAthleteId, setFeedbackAthleteId] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"praise" | "tip" | "goal">("praise");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // ── Multi-coach management state (must be before any early returns) ──
  const [manageCoaches, setManageCoaches] = useState(false);
  const [newCoachName, setNewCoachName] = useState("");
  const [newCoachPin, setNewCoachPin] = useState("");
  const [newCoachRole, setNewCoachRole] = useState<"head" | "assistant" | "guest">("assistant");

  const saveCoaches = useCallback((c: CoachAccess[]) => { setCoaches(c); save(K.COACHES, c); }, []);
  const addCoach = useCallback(() => {
    if (!newCoachName.trim() || !newCoachPin.trim() || newCoachPin.length < 4) return;
    const c: CoachAccess = { id: `coach-${Date.now()}`, name: newCoachName.trim(), pin: newCoachPin, groups: ["all"], role: newCoachRole, createdAt: Date.now() };
    saveCoaches([...coaches, c]);
    setNewCoachName(""); setNewCoachPin(""); setNewCoachRole("assistant");
  }, [newCoachName, newCoachPin, newCoachRole, coaches, saveCoaches]);
  const removeCoach = useCallback((idx: number) => {
    if (coaches[idx]?.role === "head" && coaches.filter(c => c.role === "head").length <= 1) return;
    saveCoaches(coaches.filter((_, i) => i !== idx));
  }, [coaches, saveCoaches]);

  const sendFeedback = (athleteId: string) => {
    if (!feedbackMsg.trim()) return;
    const fbKey = `apex-athlete-feedback-${athleteId}`;
    const existing = (() => { try { return JSON.parse(localStorage.getItem(fbKey) || "[]"); } catch { return []; } })();
    const entry = {
      id: `fb-${Date.now()}`,
      date: today(),
      from: activeCoach || "Coach",
      type: feedbackType,
      message: feedbackMsg.trim(),
      read: false,
    };
    const updated = [entry, ...existing];
    localStorage.setItem(fbKey, JSON.stringify(updated));
    syncSaveFeedback(fbKey, athleteId, updated);
    setFeedbackMsg("");
    setFeedbackAthleteId(null);
  };

  // ── schedule state ──────────────────────────────────────
  const [schedules, setSchedules] = useState<GroupSchedule[]>([]);
  const [scheduleGroup, setScheduleGroup] = useState<GroupId>("platinum");
  const [editingSession, setEditingSession] = useState<{ day: DayOfWeek; sessionIdx: number } | null>(null);
  const [scheduleEditMode, setScheduleEditMode] = useState(false);
  const [calendarView, setCalendarView] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // ── mount & load ─────────────────────────────────────────
  useEffect(() => {
    const pin = load<string>(K.PIN, "");
    if (!pin) { setCoachPin("1234"); save(K.PIN, "1234"); } else { setCoachPin(pin); }
    // Load selected group
    const savedGroup = load<GroupId>(K.GROUP, "platinum");
    setSelectedGroup(savedGroup);
    let r = load<Athlete[]>(K.ROSTER, []);
    // Migrate from older roster versions — carry forward existing data
    if (r.length === 0) {
      const oldKeys = ["apex-athlete-roster-v4", "apex-athlete-roster-v3", "apex-athlete-roster-v2", "apex-athlete-roster-v1", "apex-athlete-roster"];
      for (const ok of oldKeys) {
        const old = load<Athlete[]>(ok, []);
        if (old.length > 0) {
          // Old data is Platinum only — tag them and merge with new groups
          const migrated = old.map(a => ({ ...a, group: a.group || "platinum" }));
          const newGroups = INITIAL_ROSTER.filter(e => e.group !== "platinum").map(makeAthlete);
          r = [...migrated, ...newGroups];
          save(K.ROSTER, r);
          break;
        }
      }
    }
    if (r.length === 0) { r = INITIAL_ROSTER.map(makeAthlete); save(K.ROSTER, r); }
    // If roster exists but is smaller than full roster, add missing athletes
    if (r.length > 0 && r.length < INITIAL_ROSTER.length) {
      const existingIds = new Set(r.map(a => a.id));
      const missing = INITIAL_ROSTER.filter(e => !existingIds.has(e.name.toLowerCase().replace(/\s+/g, "-"))).map(makeAthlete);
      if (missing.length > 0) { r = [...r, ...missing]; save(K.ROSTER, r); }
    }
    r = r.map(a => {
      // Ensure new fields exist for legacy data
      if (!a.lastStreakDate) a = { ...a, lastStreakDate: "" };
      if (!a.lastWeightStreakDate) a = { ...a, lastWeightStreakDate: "" };
      if (!a.group) a = { ...a, group: "platinum" };
      // Reset daily XP if new day
      if (!a.dailyXP) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } };
      else if (a.dailyXP.date !== today()) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } };
      // Auto-break streaks if last check-in was more than 1 day ago
      if (a.lastStreakDate && a.streak > 0) {
        const last = new Date(a.lastStreakDate); const now = new Date(today());
        const diffDays = Math.floor((now.getTime() - last.getTime()) / 86400000);
        if (diffDays > 1) a = { ...a, streak: 0 };
      }
      if (a.lastWeightStreakDate && a.weightStreak > 0) {
        const last = new Date(a.lastWeightStreakDate); const now = new Date(today());
        const diffDays = Math.floor((now.getTime() - last.getTime()) / 86400000);
        if (diffDays > 1) a = { ...a, weightStreak: 0 };
      }
      // Migrate: ensure parent code + sport fields exist
      if (!a.parentCode) a = { ...a, parentCode: generateParentCode() };
      if (!a.sport) a = { ...a, sport: "swimming" as const };
      return a;
    });
    save(K.ROSTER, r);
    setRoster(r);
    setAuditLog(load<AuditEntry[]>(K.AUDIT, []));
    setTeamChallenges(load<TeamChallenge[]>(K.CHALLENGES, DEFAULT_CHALLENGES));
    setSnapshots(load<DailySnapshot[]>(K.SNAPSHOTS, []));
    setCulture(load<TeamCulture>(K.CULTURE, DEFAULT_CULTURE));
    // Load schedules
    let scheds = load<GroupSchedule[]>(K.SCHEDULES, []);
    if (scheds.length === 0) {
      scheds = ROSTER_GROUPS.map(g => makeDefaultGroupSchedule(g.id));
      save(K.SCHEDULES, scheds);
    } else {
      // Ensure all groups have schedules
      const existingIds = new Set(scheds.map(s => s.groupId));
      const missing = ROSTER_GROUPS.filter(g => !existingIds.has(g.id)).map(g => makeDefaultGroupSchedule(g.id));
      if (missing.length > 0) { scheds = [...scheds, ...missing]; save(K.SCHEDULES, scheds); }
    }
    setSchedules(scheds);
    setCoaches(load<CoachAccess[]>(K.COACHES, []));
    setMounted(true);
  }, []);

  // ── auto-detect AM/PM + session mode from schedule ─────
  useEffect(() => {
    if (!mounted || !autoSession || schedules.length === 0) return;
    const detect = () => {
      const now = new Date();
      const dayMap: Record<number, DayOfWeek> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
      const dayKey = dayMap[now.getDay()];
      const groupSched = schedules.find(s => s.groupId === selectedGroup);
      if (!groupSched) return;
      const daySched = groupSched.weekSchedule[dayKey];
      if (!daySched || daySched.sessions.length === 0) return;
      const nowMins = now.getHours() * 60 + now.getMinutes();
      // Find the closest session (current or upcoming within 30 min)
      let best: ScheduleSession | null = null;
      let bestDist = Infinity;
      for (const sess of daySched.sessions) {
        const [sh, sm] = sess.startTime.split(":").map(Number);
        const [eh, em] = sess.endTime.split(":").map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        // Currently in session or within 30 min before start
        if (nowMins >= startMins - 30 && nowMins <= endMins) {
          const dist = Math.abs(nowMins - startMins);
          if (dist < bestDist) { best = sess; bestDist = dist; }
        }
      }
      // If no active session, pick the next upcoming one
      if (!best) {
        for (const sess of daySched.sessions) {
          const [sh, sm] = sess.startTime.split(":").map(Number);
          const startMins = sh * 60 + sm;
          if (startMins > nowMins) {
            const dist = startMins - nowMins;
            if (dist < bestDist) { best = sess; bestDist = dist; }
          }
        }
      }
      if (best) {
        const [sh] = best.startTime.split(":").map(Number);
        setSessionTime(sh < 12 ? "am" : "pm");
        if (best.type === "pool" || best.type === "dryland") setSessionMode("pool");
        else if (best.type === "weight") setSessionMode("weight");
      } else {
        // No sessions today or all passed — default by time
        setSessionTime(now.getHours() < 12 ? "am" : "pm");
      }
    };
    detect();
    const iv = setInterval(detect, 60000); // re-check every minute
    return () => clearInterval(iv);
  }, [mounted, autoSession, schedules, selectedGroup]);

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
      setSnapshots(prev => {
        const n = [...prev.filter(x => x.date !== d), s];
        save(K.SNAPSHOTS, n);
        syncSaveSnapshot(d, s as unknown as Record<string, unknown>);
        return n;
      });
    };
    snap();
    const iv = setInterval(snap, 30000);
    return () => clearInterval(iv);
  }, [mounted, roster, teamChallenges]);

  // ── persist helpers ──────────────────────────────────────
  const saveRoster = useCallback((r: Athlete[]) => {
    setRoster(r); save(K.ROSTER, r);
    syncSaveRoster(K.ROSTER, selectedGroup, r);
  }, [selectedGroup]);
  const saveCulture = useCallback((c: TeamCulture) => {
    setCulture(c); save(K.CULTURE, c);
    syncSaveConfig(K.CULTURE, "culture", c as unknown as Record<string, unknown>);
  }, []);
  const saveSchedules = useCallback((s: GroupSchedule[]) => {
    setSchedules(s); save(K.SCHEDULES, s);
    const current = s.find(sc => sc.groupId === selectedGroup);
    if (current) syncSaveSchedule(K.SCHEDULES, selectedGroup, current);
  }, [selectedGroup]);

  const addAudit = useCallback((athleteId: string, athleteName: string, action: string, xpDelta: number) => {
    const sessionLabel = `[${sessionTime.toUpperCase()}]`;
    const entry: AuditEntry = { timestamp: Date.now(), coach: activeCoach, athleteId, athleteName, action: `${sessionLabel} ${action}`, xpDelta };
    setAuditLog(prev => {
      const n = [entry, ...prev].slice(0, 2000);
      save(K.AUDIT, n);
      syncSaveAudit(K.AUDIT, today(), n.filter(e => new Date(e.timestamp).toISOString().slice(0, 10) === today()));
      return n;
    });
  }, [activeCoach, sessionTime]);

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
        // Revert XP when unchecking
        const mult = category === "weight" ? getWeightStreakMult(a.weightStreak) : getStreakMult(a.streak);
        const awarded = Math.round(cpXP * mult);
        a.xp = Math.max(0, a.xp - awarded);
        if (a.dailyXP.date === today()) {
          a.dailyXP = { ...a.dailyXP, [category]: Math.max(0, a.dailyXP[category] - awarded) };
        }
        addAudit(a.id, a.name, `Unchecked: ${cpId}`, -awarded);
        const r = [...prev]; r[idx] = a; save(K.ROSTER, r); return r;
      }
      cps[cpId] = true; a[cpMap] = cps;
      const { newAthlete, awarded } = awardXP(a, cpXP, category);
      let final = { ...newAthlete, [cpMap]: cps };
      // Increment streak once per day on Practice Complete (pool) or Showed Up (weight)
      if (category === "pool" && cpId === "practice-complete" && final.lastStreakDate !== today()) {
        final = { ...final, streak: final.streak + 1, lastStreakDate: today(), totalPractices: final.totalPractices + 1, weekSessions: final.weekSessions + 1 };
      }
      if (category === "weight" && cpId === "showed-up" && final.lastWeightStreakDate !== today()) {
        final = { ...final, weightStreak: final.weightStreak + 1, lastWeightStreakDate: today(), weekWeightSessions: final.weekWeightSessions + 1 };
      }
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
        const mult = getWeightStreakMult(a.weightStreak);
        const reverted = Math.round(chXP * mult);
        a.xp = Math.max(0, a.xp - reverted);
        if (a.dailyXP.date === today()) {
          a.dailyXP = { ...a.dailyXP, weight: Math.max(0, a.dailyXP.weight - reverted) };
        }
        addAudit(a.id, a.name, `Unchallenged: ${chId}`, -reverted);
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

  const denyQuest = useCallback((athleteId: string, qId: string) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const a = { ...prev[idx], quests: { ...prev[idx].quests } };
      a.quests[qId] = "pending";
      addAudit(a.id, a.name, `Quest denied: ${qId}`, 0);
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); return r;
    });
  }, [addAudit]);

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
    const gDef = ROSTER_GROUPS.find(g => g.id === selectedGroup) || ROSTER_GROUPS[0];
    const sportCPs = getCPsForSport(gDef.sport);
    const firstCP = sportCPs[0];
    setRoster(prev => {
      const r = prev.map(a => {
        if (a.group !== selectedGroup) return a; // only affect current group
        const cp = { ...a.checkpoints, [firstCP.id]: true };
        const { newAthlete, awarded } = awardXP({ ...a, checkpoints: cp }, firstCP.xp, "pool");
        addAudit(newAthlete.id, newAthlete.name, `Bulk: ${firstCP.name}`, awarded);
        const streakAlreadyCounted = a.lastStreakDate === today();
        return { ...newAthlete, checkpoints: cp, totalPractices: streakAlreadyCounted ? a.totalPractices : a.totalPractices + 1, weekSessions: streakAlreadyCounted ? a.weekSessions : a.weekSessions + 1, streak: streakAlreadyCounted ? a.streak : a.streak + 1, lastStreakDate: today() };
      });
      save(K.ROSTER, r); return r;
    });
  }, [awardXP, addAudit, selectedGroup]);

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
    saveRoster(roster.map(a => a.group !== selectedGroup ? a : ({ ...a, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster, selectedGroup]);

  const resetWeek = useCallback(() => {
    saveRoster(roster.map(a => a.group !== selectedGroup ? a : ({ ...a, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, weightChallenges: {}, weekSessions: 0, weekWeightSessions: 0, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster, selectedGroup]);

  const resetMonth = useCallback(() => {
    saveRoster(roster.map(a => a.group !== selectedGroup ? a : ({ ...a, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, weightChallenges: {}, quests: {}, weekSessions: 0, weekWeightSessions: 0, streak: 0, weightStreak: 0, lastStreakDate: "", lastWeightStreakDate: "", dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster, selectedGroup]);

  // ── group switching ─────────────────────────────────────
  const switchGroup = useCallback((g: GroupId) => { setSelectedGroup(g); save(K.GROUP, g); setExpandedId(null); }, []);
  const currentGroupDef = ROSTER_GROUPS.find(g => g.id === selectedGroup) || ROSTER_GROUPS[0];

  const addAthleteAction = useCallback(() => {
    if (!newAthleteName.trim() || !newAthleteAge) return;
    const a = makeAthlete({ name: newAthleteName.trim(), age: parseInt(newAthleteAge), gender: newAthleteGender, group: selectedGroup });
    if (newAthleteUSAId.trim()) a.usaSwimmingId = newAthleteUSAId.trim();
    if (newAthleteParentEmail.trim()) a.parentEmail = newAthleteParentEmail.trim();
    saveRoster([...roster, a]);
    setNewAthleteName(""); setNewAthleteAge(""); setNewAthleteUSAId(""); setNewAthleteParentEmail(""); setAddAthleteOpen(false);
    addAudit(a.id, a.name, `Added to ${currentGroupDef.name}`, 0);
  }, [newAthleteName, newAthleteAge, newAthleteGender, newAthleteUSAId, newAthleteParentEmail, roster, saveRoster, addAudit, selectedGroup, currentGroupDef]);

  const updateAthleteProfile = useCallback((athleteId: string, updates: Partial<Pick<Athlete, "usaSwimmingId" | "parentEmail" | "parentCode">>) => {
    setRoster(prev => {
      const next = prev.map(a => a.id === athleteId ? { ...a, ...updates } : a);
      save(K.ROSTER, next);
      return next;
    });
  }, []);

  const addCoachAccess = useCallback((name: string, pin: string, role: "head" | "assistant" | "guest", groups: string[]) => {
    const c: CoachAccess = { id: `coach-${Date.now()}`, name, pin, role, groups, createdAt: Date.now() };
    setCoaches(prev => { const next = [...prev, c]; save(K.COACHES, next); return next; });
  }, []);

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

  const currentSport = currentGroupDef.sport;
  const currentCPs = getCPsForSport(currentSport);
  const filteredRoster = useMemo(() => roster.filter(a => a.group === selectedGroup), [roster, selectedGroup]);

  // ── computed ─────────────────────────────────────────────
  const sorted = useMemo(() => {
    const f = leaderTab === "all" ? filteredRoster : filteredRoster.filter(a => a.gender === leaderTab);
    return [...f].sort((a, b) => b.xp - a.xp);
  }, [filteredRoster, leaderTab]);

  const mvpMale = useMemo(() => filteredRoster.filter(a => a.gender === "M").sort((a, b) => b.xp - a.xp)[0] || null, [filteredRoster]);
  const mvpFemale = useMemo(() => filteredRoster.filter(a => a.gender === "F").sort((a, b) => b.xp - a.xp)[0] || null, [filteredRoster]);

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

  // ── ADVANCED ANALYTICS ──────────────────────────────────

  // Attrition Risk Score (0-100, higher = more at risk)
  const getAttritionRisk = useCallback((athlete: Athlete) => {
    let risk = 0;
    // Low attendance = high risk
    const recentSnaps = snapshots.slice(-14);
    const daysPresent = recentSnaps.filter(s => s.athleteXPs?.[athlete.id] && s.athleteXPs[athlete.id] > (snapshots.find(x => x.date === recentSnaps[0]?.date)?.athleteXPs?.[athlete.id] || 0)).length;
    const attendanceRate = recentSnaps.length > 0 ? daysPresent / Math.max(recentSnaps.length, 1) : 0;
    if (attendanceRate < 0.3) risk += 40;
    else if (attendanceRate < 0.5) risk += 25;
    else if (attendanceRate < 0.7) risk += 10;
    // Broken streak = risk
    if (athlete.streak === 0 && athlete.totalPractices > 3) risk += 20;
    // Low XP growth = risk
    const ago14 = snapshots.slice(-14)[0];
    const xpGrowth = ago14 ? athlete.xp - (ago14.athleteXPs?.[athlete.id] || 0) : athlete.xp;
    if (xpGrowth <= 0) risk += 20;
    else if (xpGrowth < 50) risk += 10;
    // No quests engaged = disengagement
    const activeQuests = Object.values(athlete.quests).filter(q => q === "active" || q === "done").length;
    if (activeQuests === 0 && athlete.totalPractices > 5) risk += 15;
    // Low teammate interaction
    const helpCount = auditLog.filter(e => e.athleteId === athlete.id && e.action.includes("Helped")).length;
    if (helpCount === 0 && athlete.totalPractices > 3) risk += 5;
    return Math.min(100, risk);
  }, [snapshots, auditLog]);

  // Culture Score (0-100) — team-wide health metric
  const cultureScore = useMemo(() => {
    if (!roster.length) return 0;
    const today7 = snapshots.slice(-7);
    // Attendance component (0-30)
    const avgAttendance = today7.length > 0
      ? today7.reduce((s, x) => s + (x.totalAthletes ? (x.attendance / x.totalAthletes) : 0), 0) / today7.length
      : 0;
    const attScore = Math.round(avgAttendance * 30);
    // Teammate help frequency (0-25)
    const helpActions = auditLog.filter(e => e.action.includes("Helped") || e.action.includes("Buddy")).length;
    const helpScore = Math.min(25, Math.round((helpActions / Math.max(roster.length, 1)) * 25));
    // Positive attitude nominations (0-20)
    const positiveActions = auditLog.filter(e => e.action.includes("Positive")).length;
    const positiveScore = Math.min(20, Math.round((positiveActions / Math.max(roster.length, 1)) * 20));
    // Quest engagement (0-15)
    const questEngagement = roster.reduce((s, a) => s + Object.values(a.quests).filter(q => q !== "pending").length, 0);
    const questScore = Math.min(15, Math.round((questEngagement / (roster.length * QUEST_DEFS.length)) * 15));
    // Streak health (0-10)
    const avgStreak = roster.reduce((s, a) => s + a.streak, 0) / roster.length;
    const streakScore = Math.min(10, Math.round(avgStreak / 3));
    return Math.min(100, attScore + helpScore + positiveScore + questScore + streakScore);
  }, [roster, snapshots, auditLog]);

  // Peak Performance Windows — which days earn the most XP per athlete
  const peakWindows = useMemo(() => {
    const dayMap: Record<string, number[]> = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const snap of snapshots) {
      const d = new Date(snap.date);
      const name = dayNames[d.getDay()];
      dayMap[name].push(snap.totalXPAwarded);
    }
    return Object.entries(dayMap).map(([day, xps]) => ({
      day,
      avgXP: xps.length ? Math.round(xps.reduce((a, b) => a + b, 0) / xps.length) : 0,
      sessions: xps.length,
    })).sort((a, b) => b.avgXP - a.avgXP);
  }, [snapshots]);

  // Athletes at risk (sorted by risk descending)
  const atRiskAthletes = useMemo(() => {
    return roster
      .map(a => ({ ...a, risk: getAttritionRisk(a) }))
      .filter(a => a.risk > 20)
      .sort((a, b) => b.risk - a.risk);
  }, [roster, getAttritionRisk]);

  // Engagement trend — is the team trending up or down?
  const engagementTrend = useMemo(() => {
    const recent7 = snapshots.slice(-7);
    const prev7 = snapshots.slice(-14, -7);
    if (!recent7.length || !prev7.length) return { direction: "neutral" as const, delta: 0 };
    const recentAvg = recent7.reduce((s, x) => s + x.totalXPAwarded, 0) / recent7.length;
    const prevAvg = prev7.reduce((s, x) => s + x.totalXPAwarded, 0) / prev7.length;
    const delta = Math.round(((recentAvg - prevAvg) / Math.max(prevAvg, 1)) * 100);
    return { direction: delta > 5 ? "up" as const : delta < -5 ? "down" as const : "neutral" as const, delta };
  }, [snapshots]);

  // Coach efficiency — which checkpoints are most/least awarded
  const checkpointEfficiency = useMemo(() => {
    const counts: Record<string, number> = {};
    const groupRoster = roster.filter(a => a.group === selectedGroup);
    for (const a of groupRoster) {
      for (const [k, v] of Object.entries(a.checkpoints)) if (v) counts[k] = (counts[k] || 0) + 1;
    }
    return [...currentCPs].map(cp => ({ ...cp, count: counts[cp.id] || 0, rate: groupRoster.length ? Math.round(((counts[cp.id] || 0) / groupRoster.length) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [roster, selectedGroup, currentCPs]);

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
            <div className="text-5xl mb-3"><svg width="48" height="48" viewBox="0 0 24 24" fill="#f59e0b" style={{filter:'drop-shadow(0 0 12px rgba(245,158,11,0.6))'}}><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg></div>
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
        <div className="text-3xl mb-2"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.5" style={{filter:'drop-shadow(0 0 8px rgba(0,240,255,0.5))'}}><path d="M2 20c2-1 4-2 6-2s4 1 6 2 4 1 6 0" strokeLinecap="round"/><path d="M2 16c2-1 4-2 6-2s4 1 6 2 4 1 6 0" strokeLinecap="round"/><circle cx="12" cy="7" r="3"/><path d="M9 10l-2 6h2l1-3 2 3 2-3 1 3h2l-2-6"/></svg></div>
        <div className="neon-text-cyan text-sm font-mono tracking-wider opacity-60">INITIALIZING...</div>
      </div>
    </div>
  );

  // ── PIN gate ─────────────────────────────────────────────
  const tryUnlock = () => {
    const match = coaches.find(c => c.pin === pinInput);
    if (match) { setUnlocked(true); setPinError(false); setActiveCoach(match.name); try { sessionStorage.setItem("apex-coach-auth", "1"); localStorage.setItem("apex-coach-auth", Date.now().toString()); } catch {} }
    else if (pinInput === coachPin) { setUnlocked(true); setPinError(false); setActiveCoach("Head Coach"); try { sessionStorage.setItem("apex-coach-auth", "1"); localStorage.setItem("apex-coach-auth", Date.now().toString()); } catch {} }
    else setPinError(true);
  };
  const resetPin = () => { setCoachPin("1234"); save(K.PIN, "1234"); setPinInput(""); setPinError(false); };

  if (!unlocked && (view === "coach" || view === "schedule")) {
    return (
      <div className="min-h-screen bg-[#06020f] flex items-center justify-center p-6 relative overflow-hidden">
        <BgOrbs />
        <div className="text-center max-w-xs w-full relative z-10">
          {/* HUD access terminal */}
          <div className="game-panel game-panel-border relative bg-[#06020f]/90 p-10 mb-6">
            <div className="hud-corner-tl hud-corner-br absolute inset-0 pointer-events-none" />
            <div className="text-5xl mb-4 drop-shadow-[0_0_30px_rgba(0,240,255,0.5)]"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.5" style={{filter:'drop-shadow(0 0 20px rgba(0,240,255,0.5))'}}><path d="M2 20c2-1 4-2 6-2s4 1 6 2 4 1 6 0" strokeLinecap="round"/><path d="M2 16c2-1 4-2 6-2s4 1 6 2 4 1 6 0" strokeLinecap="round"/><circle cx="12" cy="7" r="3"/><path d="M9 10l-2 6h2l1-3 2 3 2-3 1 3h2l-2-6"/></svg></div>
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
    const presentCount = filteredRoster.filter(a => Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)).length;
    const xpToday = filteredRoster.reduce((s, a) => s + (a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0);
    return (
      <div className="w-full relative mb-6">
        {/* Portal switcher bar */}
        <div className="flex items-center justify-center gap-2 py-2 mb-2">
          {[
            { label: "Coach", href: "/apex-athlete", active: true, color: "#00f0ff" },
            { label: "Athlete", href: "/apex-athlete/athlete", active: false, color: "#a855f7" },
            { label: "Parent", href: "/apex-athlete/parent", active: false, color: "#f59e0b" },
          ].map(p => (
            <a key={p.label} href={p.href}
              className="px-4 py-1.5 text-[10px] font-bold font-mono tracking-[0.2em] uppercase rounded-full transition-all"
              style={{
                background: p.active ? `${p.color}20` : 'transparent',
                border: `1px solid ${p.active ? p.color + '60' : 'rgba(255,255,255,0.08)'}`,
                color: p.active ? p.color : 'rgba(255,255,255,0.3)',
              }}>
              {p.label}
            </a>
          ))}
        </div>
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
              {firebaseConnected && (
                <span className="ml-3 px-2 py-0.5 text-[9px] font-mono tracking-wider rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CLOUD SYNC
                </span>
              )}
            </div>
            {/* Game HUD nav tabs */}
            <div className="flex flex-wrap">
              {(["coach", "parent", "audit", "analytics", "schedule", "strategy"] as const).map((v) => {
                const navIcons: Record<string, React.ReactNode> = {
                  coach: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
                  parent: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="5"/><path d="M3 21v-2a7 7 0 0114 0v2"/><path d="M19 8v6M22 11h-6"/></svg>,
                  audit: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>,
                  analytics: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
                  schedule: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
                  strategy: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
                };
                const active = view === v;
                return (
                  <button key={v} onClick={() => setView(v)}
                    className={`relative px-4 sm:px-5 py-3 text-[10px] font-bold font-mono tracking-[0.25em] uppercase transition-all duration-300 flex items-center gap-1.5 ${
                      active
                        ? "text-[#00f0ff] bg-[#00f0ff]/[0.08]"
                        : "text-white/15 hover:text-[#00f0ff]/60 hover:bg-[#00f0ff]/[0.03]"
                    }`}
                    style={{
                      borderTop: active ? '2px solid rgba(0,240,255,0.6)' : '2px solid rgba(0,240,255,0.08)',
                      borderBottom: active ? 'none' : '1px solid rgba(0,240,255,0.05)',
                      boxShadow: active ? '0 -4px 20px rgba(0,240,255,0.15), inset 0 1px 15px rgba(0,240,255,0.05)' : 'none'
                    }}>
                    <span className={active ? "text-[#f59e0b]" : ""}>{navIcons[v]}</span>{v}
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

          {/* ── AM/PM + Session Mode — auto-detects from schedule ── */}
          {view === "coach" && (
            <div className="game-panel game-panel-border relative bg-[#06020f]/80 backdrop-blur-xl px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setAutoSession(!autoSession)} title={autoSession ? "Auto-detecting from schedule. Tap to override." : "Manual mode. Tap to auto-detect."}
                  className={`text-[9px] font-mono tracking-wider uppercase px-2 py-1 rounded border transition-all inline-flex items-center gap-1 ${autoSession ? "text-[#00f0ff]/60 border-[#00f0ff]/20 bg-[#00f0ff]/5" : "text-white/20 border-white/[0.06]"}`}>
                  {autoSession ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg> AUTO</> : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 00-2-2h-1a2 2 0 00-2 2M9 11V4a2 2 0 00-2-2H6a2 2 0 00-2 2v7m5 0V3a2 2 0 00-2-2H6m9 13v-3a2 2 0 00-2-2H6a2 2 0 00-2 2v6a6 6 0 006 6h1a6 6 0 006-6v-1"/></svg> MANUAL</>}
                </button>
                <div className="flex rounded-lg overflow-hidden border border-[#a855f7]/25">
                  {(["am", "pm"] as const).map(t => (
                    <button key={t} onClick={() => { setAutoSession(false); setSessionTime(t); }}
                      className={`px-4 py-2 text-xs font-bold font-mono tracking-wider uppercase transition-all ${
                        sessionTime === t
                          ? t === "am"
                            ? "bg-gradient-to-r from-[#f59e0b]/25 to-[#fbbf24]/15 text-[#fbbf24] shadow-[inset_0_0_15px_rgba(251,191,36,0.15)]"
                            : "bg-gradient-to-r from-[#6366f1]/25 to-[#818cf8]/15 text-[#818cf8] shadow-[inset_0_0_15px_rgba(129,140,248,0.15)]"
                          : "bg-[#06020f]/60 text-white/20 hover:text-white/40"
                      }`}>
                      {t === "am" ? "☀ AM" : "☽ PM"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(["pool", "weight", "meet"] as const).map(m => {
                  const mLabels = { pool: "Pool", weight: "Weight", meet: "Meet" };
                  const ModeIcon = ({ mode }: { mode: string }) => {
                    if (mode === "pool") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>;
                    if (mode === "weight") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><path d="M6 12h12"/><rect x="6" y="7" width="3" height="10" rx="1"/><rect x="15" y="7" width="3" height="10" rx="1"/></svg>;
                    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
                  };
                  return (
                    <button key={m} onClick={() => { setAutoSession(false); setSessionMode(m); }}
                      className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold font-mono tracking-wider uppercase rounded-lg border transition-all ${
                        sessionMode === m
                          ? "bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
                          : "text-white/20 border-white/[0.06] hover:text-white/40 hover:border-white/10"
                      }`}>
                      <ModeIcon mode={m} /> {mLabels[m]}
                    </button>
                  );
                })}
              </div>
              <span className="text-white/10 text-[9px] font-mono">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>
          )}

          {/* Season goal progress */}
          <div className="flex items-center gap-4 px-2 mb-2">
            <span className="text-[#00f0ff]/20 text-[9px] font-mono uppercase tracking-wider shrink-0">{culture.seasonalGoal}</span>
            <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden xp-bar-segments">
              <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${Math.min(100, (culture.goalCurrent / culture.goalTarget) * 100)}%` }} />
            </div>
            <span className="text-[#f59e0b]/50 text-[9px] font-bold font-mono tabular-nums whitespace-nowrap shrink-0">{culture.goalCurrent}%<span className="text-white/10">/{culture.goalTarget}%</span></span>
          </div>
        </div>

        {/* Live HUD data strip */}
        <div className="relative border-y border-[#00f0ff]/10 bg-[#06020f]/90 backdrop-blur-xl">
          <div className="absolute inset-0 data-grid-bg opacity-30 pointer-events-none" />
          <div className="flex items-center gap-6 py-3 relative z-10 scan-sweep px-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${presentCount > 0 ? "bg-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.6)]" : "bg-white/10"}`} />
              <span className="neon-text-cyan text-sm font-bold font-mono tabular-nums whitespace-nowrap">{presentCount}<span className="text-white/15 font-normal">/{roster.length}</span></span>
              <span className="text-[#00f0ff]/30 text-[10px] font-mono uppercase">present</span>
            </div>
            <div className="w-px h-4 bg-[#00f0ff]/10" />
            <div className="flex items-center gap-2">
              <span className="neon-text-gold text-sm font-bold font-mono tabular-nums whitespace-nowrap">{xpToday}</span>
              <span className="text-[#f59e0b]/30 text-[10px] font-mono uppercase">XP today</span>
            </div>
            <div className="w-px h-4 bg-[#00f0ff]/10" />
            <span className="text-[#00f0ff]/40 text-xs font-mono flex items-center gap-1.5">
              {sessionTime === "am"
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[#fbbf24]/60"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                : <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[#818cf8]/60"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
              {sessionMode === "pool" ? "POOL" : sessionMode === "weight" ? "WEIGHT" : "MEET"}
              <span className="text-[#a855f7]/30">{sessionTime.toUpperCase()}</span>
            </span>
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
          <h2 className="text-white font-bold text-lg">Saint Andrew&apos;s Aquatics — {currentGroupDef.icon} {currentGroupDef.name}</h2>
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
    const [localMode, setLocalMode] = useState<"pool" | "weight" | "meet">(sessionMode);
    const lv = getLevel(athlete.xp);
    const prog = getLevelProgress(athlete.xp);
    const nxt = getNextLevel(athlete.xp);
    const sk = fmtStreak(athlete.streak);
    const wsk = fmtWStreak(athlete.weightStreak);
    const combos = checkCombos(athlete);
    const growth = getPersonalGrowth(athlete);
    const dxp = athlete.dailyXP.date === today() ? athlete.dailyXP : { pool: 0, weight: 0, meet: 0 };
    const dailyUsed = dxp.pool + dxp.weight + dxp.meet;
    const cps = localMode === "pool" ? currentCPs : localMode === "weight" ? WEIGHT_CPS : MEET_CPS;
    const cpMap = localMode === "pool" ? athlete.checkpoints : localMode === "weight" ? athlete.weightCheckpoints : athlete.meetCheckpoints;

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
              <div className="text-white font-black text-lg tabular-nums whitespace-nowrap">{s.val}</div>
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
          <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${dailyUsed >= DAILY_XP_CAP ? "text-red-400" : "text-white/30"}`}>{dailyUsed}/{DAILY_XP_CAP}</span>
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

        {/* Sticky mini session-mode toggle */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#0a0518]/95 backdrop-blur-sm">
          <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
            {([
              { mode: "pool" as const, label: "Pool", color: "#60a5fa", activeColor: "bg-[#60a5fa]/20 text-[#60a5fa] border-[#60a5fa]/30" },
              { mode: "weight" as const, label: "Weight", color: "#f59e0b", activeColor: "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30" },
              { mode: "meet" as const, label: "Meet", color: "#34d399", activeColor: "bg-[#34d399]/20 text-[#34d399] border-[#34d399]/30" },
            ]).map(opt => (
              <button key={opt.mode}
                onClick={(e) => { e.stopPropagation(); setLocalMode(opt.mode); }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold tracking-wide border transition-all ${
                  localMode === opt.mode ? opt.activeColor : "text-white/25 border-transparent hover:bg-white/[0.04]"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Daily check-in */}
        <div>
          <h4 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">
            {localMode === "pool" ? (currentSport === "diving" ? "Board Check-In" : currentSport === "waterpolo" ? "Pool Check-In" : "Pool Check-In") : localMode === "weight" ? (currentSport === "diving" ? "Dryland" : currentSport === "waterpolo" ? "Gym" : "Weight Room") : (currentSport === "waterpolo" ? "Match Day" : "Meet Day")}
          </h4>
          <Card className="divide-y divide-white/[0.04]">
            {cps.map(cp => {
              const checked = cpMap[cp.id];
              return (
                <button key={cp.id}
                  onClick={(e) => toggleCheckpoint(athlete.id, cp.id, cp.xp, localMode, e)}
                  disabled={dailyUsed >= DAILY_XP_CAP && !checked}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors duration-200 min-h-[56px] ${
                    checked ? "bg-[#6b21a8]/15 shadow-[inset_0_0_20px_rgba(107,33,168,0.06)]" : dailyUsed >= DAILY_XP_CAP ? "opacity-30 cursor-not-allowed" : "hover:bg-white/[0.03] cursor-pointer active:bg-white/[0.05]"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                    checked ? "border-[#7c3aed] bg-gradient-to-br from-[#7c3aed] to-[#6b21a8] scale-100" : "border-white/15 scale-100"
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

        {/* Side quests — Coach Approval Workflow */}
        <div>
          <h4 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">Side Quests</h4>
          <Card className="divide-y divide-white/[0.04]">
            {QUEST_DEFS.map(q => {
              const st = athlete.quests[q.id] || "pending";
              return (
                <div key={q.id}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors min-h-[56px] ${
                    st === "done" ? "bg-emerald-500/5" : st === "active" ? "bg-[#6b21a8]/5" : "bg-transparent"
                  }`}
                >
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-md shrink-0 uppercase tracking-wider ${CAT_COLORS[q.cat] || "bg-white/10 text-white/40"}`}>
                    {q.cat}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{q.name}</div>
                    <div className="text-white/20 text-[11px]">{q.desc}</div>
                    {/* Athlete quest state indicator */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        st === "done" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                          : st === "active" ? "bg-[#a855f7] shadow-[0_0_6px_rgba(168,85,247,0.5)]"
                          : "bg-white/10"
                      }`} />
                      <span className={`text-[9px] font-mono tracking-wider uppercase ${
                        st === "done" ? "text-emerald-400/70" : st === "active" ? "text-[#a855f7]/70" : "text-white/15"
                      }`}>
                        {st === "done" ? `${athlete.name.split(" ")[0]} completed` : st === "active" ? `${athlete.name.split(" ")[0]} submitted` : "Not assigned"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {st === "pending" && (
                      <button
                        onClick={(e) => cycleQuest(athlete.id, q.id, q.xp, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/25 hover:bg-[#a855f7]/25 hover:border-[#a855f7]/40 transition-all"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                        ASSIGN
                      </button>
                    )}
                    {st === "active" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => cycleQuest(athlete.id, q.id, q.xp, e)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 hover:border-emerald-500/40 hover:shadow-[0_0_12px_rgba(52,211,153,0.2)] transition-all"
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 8.5l4 4L14 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          APPROVE
                        </button>
                        <button
                          onClick={() => denyQuest(athlete.id, q.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 hover:border-red-500/40 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] transition-all"
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          DENY
                        </button>
                      </div>
                    )}
                    {st === "done" && (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 8.5l4 4L14 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          COMPLETED
                        </span>
                        <span className="text-emerald-400/60 text-[10px] font-bold font-mono">+{q.xp} xp</span>
                      </div>
                    )}
                  </div>
                </div>
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

        {/* Send Feedback to Athlete */}
        <Card className="p-5">
          <h4 className="text-[#f59e0b] text-[11px] uppercase tracking-[0.15em] font-bold mb-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Send Feedback
          </h4>
          {feedbackAthleteId === athlete.id ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["praise", "tip", "goal"] as const).map(ft => (
                  <button key={ft} onClick={() => setFeedbackType(ft)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      feedbackType === ft
                        ? ft === "praise" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : ft === "tip" ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                          : "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30"
                        : "bg-white/5 text-white/25 border border-white/10"
                    }`}>
                    {ft === "praise" ? "★ Praise" : ft === "tip" ? "→ Tip" : "◎ Goal"}
                  </button>
                ))}
              </div>
              <textarea value={feedbackMsg} onChange={e => setFeedbackMsg(e.target.value)}
                placeholder={feedbackType === "praise" ? "Great job today..." : feedbackType === "tip" ? "Try focusing on..." : "Your next goal is..."}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#f59e0b]/30 resize-none"
                rows={2} />
              <div className="flex gap-2">
                <button onClick={() => sendFeedback(athlete.id)} disabled={!feedbackMsg.trim()}
                  className="flex-1 py-2 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/25 text-[#f59e0b] text-sm font-bold disabled:opacity-30 hover:bg-[#f59e0b]/25 transition-all">
                  Send to {athlete.name.split(" ")[0]}
                </button>
                <button onClick={() => setFeedbackAthleteId(null)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/30 text-sm hover:text-white/50 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setFeedbackAthleteId(athlete.id)}
              className="w-full py-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/15 text-[#f59e0b]/70 text-sm font-bold hover:bg-[#f59e0b]/15 hover:text-[#f59e0b] transition-all">
              Send Feedback to {athlete.name.split(" ")[0]}
            </button>
          )}
        </Card>

        {/* Personal growth */}
        {growth && (
          <Card className="p-6">
            <h4 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">You vs Last Month</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-black tabular-nums whitespace-nowrap ${growth.xpGain > 0 ? "text-emerald-400" : growth.xpGain < 0 ? "text-red-400" : "text-white/20"}`}>
                  {growth.xpGain > 0 ? "+" : ""}{growth.xpGain}
                </div>
                <div className="text-white/20 text-[10px] uppercase mt-1">XP Gained</div>
              </div>
              <div>
                <div className={`text-2xl font-black tabular-nums whitespace-nowrap ${growth.streakDelta > 0 ? "text-emerald-400" : growth.streakDelta < 0 ? "text-red-400" : "text-white/20"}`}>
                  {growth.streakDelta > 0 ? "+" : ""}{growth.streakDelta}d
                </div>
                <div className="text-white/20 text-[10px] uppercase mt-1">Streak</div>
              </div>
              <div>
                <div className="text-2xl font-black tabular-nums whitespace-nowrap text-white">{athlete.totalPractices}</div>
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

  // ── RACE STRATEGY VIEW ─────────────────────────────────
  if (view === "strategy") {
    const EVENTS = ["50", "100", "200", "400", "500", "800", "1000", "1500", "1650"];
    const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"];

    const parseTime = (t: string): number | null => {
      const parts = t.replace(/[^0-9:.]/g, "").split(/[:.]/).map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1]; // M:SS
      if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 100; // M:SS.hh
      if (parts.length === 1 && parts[0] > 0) return parts[0]; // just seconds
      return null;
    };

    const fmtTime = (secs: number): string => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return m > 0 ? `${m}:${s.toFixed(2).padStart(5, "0")}` : `${s.toFixed(2)}`;
    };

    const generateStrategy = () => {
      const current = parseTime(stratCurrentTime);
      const goal = parseTime(stratGoalTime);
      if (!current || !goal || goal >= current) {
        setStratPlan(null);
        return;
      }

      const dist = parseInt(stratEvent);
      const splitCount = dist <= 100 ? 2 : dist <= 200 ? 4 : dist <= 400 ? 4 : Math.min(8, Math.ceil(dist / 100));
      const segLen = dist / splitCount;
      const improvement = ((current - goal) / current * 100).toFixed(1);
      const timeDrop = current - goal;
      const splits: { segment: string; time: string; pace: string; focus: string }[] = [];

      const pacePatterns: Record<string, number[]> = {
        "50": [0.48, 0.52],
        "100": [0.48, 0.52],
        "200": [0.24, 0.25, 0.25, 0.26],
        "400": [0.24, 0.25, 0.26, 0.25],
        "500": [0.19, 0.20, 0.21, 0.20, 0.20],
      };
      const pattern = pacePatterns[stratEvent] || Array(splitCount).fill(1 / splitCount);

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
        `Drop ${timeDrop.toFixed(2)}s from your ${stratEvent}m ${stratStroke} — that's ${improvement}% faster`,
        dist >= 200 ? "Negative split strategy: go out controlled, finish strong" : "Fast start, maintain through the back half",
        stratStroke === "Freestyle" ? "Focus on stroke rate consistency — count strokes per length" :
          stratStroke === "Butterfly" ? "Two strong kicks per stroke — especially off the walls" :
          stratStroke === "Backstroke" ? "Tight backstroke flags count — nail the turns" :
          stratStroke === "Breaststroke" ? "Maximize underwater pullout distance off each wall" :
          "Transition speed between strokes — especially fly-to-back",
        "Underwater breakouts are free speed — hold streamline past the flags",
        "Visualize the race: see yourself hitting each split, finishing strong",
      ];

      setStratPlan({ splits, tips, xpReward: 150, improvement });
    };

    const stratAthlete = roster.find(a => a.id === stratAthleteId);

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs /><XpFloats /><LevelUpOverlay />
        <div className="w-full relative z-10 px-5 sm:px-8">
          <GameHUDHeader />

          <Card className="p-6 mb-6" glow>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2" style={{filter:'drop-shadow(0 0 8px rgba(0,240,255,0.4))'}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
              <div>
                <h2 className="text-xl font-black tracking-tight neon-text-cyan">Race Strategy AI</h2>
                <p className="text-white/25 text-xs">Personal goal-focused race planning</p>
              </div>
              <span className="ml-auto text-[#f59e0b] text-sm font-bold">+150 XP</span>
            </div>

            {/* Athlete selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wider font-bold block mb-2">Athlete</label>
                <select value={stratAthleteId} onChange={e => setStratAthleteId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px]">
                  <option value="">Select athlete...</option>
                  {filteredRoster.map(a => <option key={a.id} value={a.id}>{a.name} — {getLevel(a.xp).name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wider font-bold block mb-2">Stroke</label>
                <select value={stratStroke} onChange={e => setStratStroke(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px]">
                  {STROKES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wider font-bold block mb-2">Event (meters)</label>
                <select value={stratEvent} onChange={e => setStratEvent(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px]">
                  {EVENTS.map(e => <option key={e} value={e}>{e}m</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wider font-bold block mb-2">Current Best (M:SS.hh)</label>
                <input type="text" value={stratCurrentTime} onChange={e => setStratCurrentTime(e.target.value)}
                  placeholder="1:05.30" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px] placeholder:text-white/15" />
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wider font-bold block mb-2">Goal Time (M:SS.hh)</label>
                <input type="text" value={stratGoalTime} onChange={e => setStratGoalTime(e.target.value)}
                  placeholder="1:02.00" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px] placeholder:text-white/15" />
              </div>
            </div>

            <button onClick={generateStrategy}
              className="game-btn w-full py-4 bg-gradient-to-r from-[#6b21a8] to-[#00f0ff]/30 text-white font-bold text-sm tracking-wider uppercase border border-[#00f0ff]/20 hover:border-[#00f0ff]/40 hover:shadow-[0_0_30px_rgba(0,240,255,0.15)] transition-all min-h-[48px]">
              GENERATE RACE STRATEGY
            </button>
          </Card>

          {/* Strategy output */}
          {stratPlan && (
            <>
              <Card className="p-6 mb-6" glow>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2" style={{filter:'drop-shadow(0 0 6px rgba(0,240,255,0.3))'}}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
                  <h3 className="text-[#00f0ff] text-sm font-black uppercase tracking-wider">Race Map</h3>
                  {stratAthlete && <span className="ml-auto text-white/30 text-xs">{stratAthlete.name} · {stratEvent}m {stratStroke}</span>}
                </div>

                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-[#00f0ff]/10 border border-emerald-500/20">
                  <div className="text-emerald-400 text-sm font-bold">Target Improvement: {stratPlan.improvement}%</div>
                  <div className="text-white/40 text-xs mt-1">{stratCurrentTime} → {stratGoalTime} — You&apos;ve got this!</div>
                </div>

                {/* Split table */}
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-3 text-[10px] uppercase tracking-wider text-white/25 font-bold px-3 mb-1">
                    <span>Segment</span><span>Split</span><span>Pace</span><span>Focus</span>
                  </div>
                  {stratPlan.splits.map((sp, i) => (
                    <div key={i} className="grid grid-cols-4 gap-3 items-center py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-[#00f0ff]/15 transition-all text-sm">
                      <span className="text-[#00f0ff] font-mono font-bold text-xs">{sp.segment}</span>
                      <span className="text-white font-bold tabular-nums">{sp.time}</span>
                      <span className="text-white/40 font-mono text-xs">{sp.pace}</span>
                      <span className="text-white/50 text-xs">{sp.focus}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{filter:'drop-shadow(0 0 6px rgba(245,158,11,0.3))'}}><path d="M9 18h6M10 22h4M12 2a7 7 0 014 12.7V17H8v-2.3A7 7 0 0112 2z"/></svg></span>
                  <h3 className="text-[#f59e0b] text-sm font-black uppercase tracking-wider">Race Tips</h3>
                </div>
                <div className="space-y-3">
                  {stratPlan.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3 py-2">
                      <span className="text-[#f59e0b] text-xs font-bold mt-0.5 shrink-0">{i + 1}.</span>
                      <span className="text-white/60 text-sm">{tip}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4 mb-6 text-center">
                <span className="text-[#f59e0b] text-xl font-black">+{stratPlan.xpReward} XP</span>
                <p className="text-white/25 text-xs mt-1">Awarded when you complete a race using this strategy</p>
              </Card>
            </>
          )}

          <div className="text-center text-white/[0.05] text-[10px] py-10 space-y-1">
            <p>Apex Athlete — Race Strategy AI</p>
            <p>Personal growth, not competition. Every rep counts.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── SCHEDULE VIEW ─────────────────────────────────────────
  if (view === "schedule") {
    const groupSched = schedules.find(s => s.groupId === scheduleGroup);
    const groupInfo = ROSTER_GROUPS.find(g => g.id === scheduleGroup);

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs /><XpFloats /><LevelUpOverlay />
        <div className="w-full relative z-10 px-4 sm:px-6">
          <GameHUDHeader />

          {/* Group selector */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {ROSTER_GROUPS.map(g => (
                <button key={g.id} onClick={() => setScheduleGroup(g.id as GroupId)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all ${
                    scheduleGroup === g.id
                      ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                      : "bg-[#06020f]/60 text-white/20 border border-white/5 hover:text-white/40"
                  }`}>
                  {g.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-xl overflow-hidden border border-white/10">
                <button onClick={() => setCalendarView(false)}
                  className={`px-3 py-2.5 text-xs font-bold font-mono tracking-wider transition-all ${
                    !calendarView ? "bg-[#00f0ff]/15 text-[#00f0ff]" : "bg-transparent text-white/20 hover:text-white/40"
                  }`}>
                  Weekly
                </button>
                <button onClick={() => setCalendarView(true)}
                  className={`px-3 py-2.5 text-xs font-bold font-mono tracking-wider transition-all ${
                    calendarView ? "bg-[#a855f7]/15 text-[#a855f7]" : "bg-transparent text-white/20 hover:text-white/40"
                  }`}>
                  Season Calendar
                </button>
              </div>
              {!calendarView && (
                <button onClick={() => setScheduleEditMode(!scheduleEditMode)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider transition-all ${
                    scheduleEditMode ? "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30" : "bg-white/5 text-white/25 border border-white/10"
                  }`}>
                  {scheduleEditMode ? "✓ Done Editing" : "✎ Tap to Edit Schedule"}
                </button>
              )}
            </div>
          </div>

          {/* Week schedule grid */}
          {!calendarView && <><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {DAYS_OF_WEEK.map(day => {
              const dayData = groupSched?.weekSchedule[day];
              const template = SCHEDULE_TEMPLATES.find(t => t.id === dayData?.template);
              const isToday = new Date().toLocaleDateString("en-US", { weekday: "short" }) === day;

              return (
                <div key={day} className={`rounded-2xl border p-3 transition-all ${
                  isToday ? "border-[#00f0ff]/30 bg-[#00f0ff]/5 shadow-[0_0_20px_rgba(0,240,255,0.1)]"
                    : "border-white/5 bg-[#0a0518]/50"
                }`}>
                  {/* Day header */}
                  <div className="text-center mb-3">
                    <div className={`text-[10px] font-mono tracking-wider font-bold ${isToday ? "text-[#00f0ff]" : "text-white/30"}`}>{day.toUpperCase()}</div>
                    {template && (
                      <div className="mt-1">
                        <span className="text-[10px]" style={{ color: template.color }}>{template.icon}</span>
                        <span className="text-[9px] text-white/20 block mt-0.5">{template.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Sessions */}
                  <div className="space-y-2">
                    {dayData?.sessions.map((session, si) => (
                      <div key={session.id} className={`p-3.5 rounded-xl border transition-all ${
                        session.type === "pool" ? "bg-[#60a5fa]/5 border-[#60a5fa]/15"
                          : session.type === "weight" ? "bg-[#f59e0b]/5 border-[#f59e0b]/15"
                          : "bg-[#34d399]/5 border-[#34d399]/15"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className={`text-[10px] font-bold ${
                            session.type === "pool" ? "text-[#60a5fa]" : session.type === "weight" ? "text-[#f59e0b]" : "text-[#34d399]"
                          }`}>{session.label}</div>
                          {scheduleEditMode && (
                            <button onClick={() => {
                              if (!groupSched) return;
                              const updated = [...schedules];
                              const gi = updated.findIndex(s => s.groupId === scheduleGroup);
                              if (gi < 0) return;
                              updated[gi].weekSchedule[day].sessions = updated[gi].weekSchedule[day].sessions.filter((_, idx) => idx !== si);
                              saveSchedules(updated);
                            }}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-red-400/40 hover:text-red-400 hover:bg-red-400/10 transition-all text-xs font-bold"
                              title="Remove session">
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="text-white/35 text-[10px] font-mono mt-0.5">
                          {fmt12(session.startTime)} – {fmt12(session.endTime)}
                        </div>
                        <div className="text-white/15 text-[8px] mt-0.5">{session.location}</div>

                        {scheduleEditMode && (
                          <div className="mt-2 space-y-1.5">
                            <input type="time" value={session.startTime}
                              onChange={e => {
                                if (!groupSched) return;
                                const updated = [...schedules];
                                const gi = updated.findIndex(s => s.groupId === scheduleGroup);
                                if (gi < 0) return;
                                updated[gi].weekSchedule[day].sessions[si].startTime = e.target.value;
                                saveSchedules(updated);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-base text-white focus:outline-none focus:border-[#00f0ff]/30" />
                            <input type="time" value={session.endTime}
                              onChange={e => {
                                if (!groupSched) return;
                                const updated = [...schedules];
                                const gi = updated.findIndex(s => s.groupId === scheduleGroup);
                                if (gi < 0) return;
                                updated[gi].weekSchedule[day].sessions[si].endTime = e.target.value;
                                saveSchedules(updated);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-base text-white focus:outline-none focus:border-[#00f0ff]/30" />
                            <input type="text" placeholder="Notes" value={session.notes}
                              onChange={e => {
                                if (!groupSched) return;
                                const updated = [...schedules];
                                const gi = updated.findIndex(s => s.groupId === scheduleGroup);
                                if (gi < 0) return;
                                updated[gi].weekSchedule[day].sessions[si].notes = e.target.value;
                                saveSchedules(updated);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-base text-white placeholder:text-white/10 focus:outline-none focus:border-[#00f0ff]/30" />
                          </div>
                        )}
                      </div>
                    ))}

                    {dayData?.sessions.length === 0 && !scheduleEditMode && (
                      <div className="text-center py-3">
                        <button onClick={() => setScheduleEditMode(true)}
                          className="text-white/15 text-xs hover:text-white/30 transition-all px-3 py-2 rounded-lg border border-dashed border-white/10 hover:border-white/20">
                          + Add Practice
                        </button>
                      </div>
                    )}

                    {/* Add session buttons - always visible in edit mode, or when day is empty */}
                    {(scheduleEditMode || dayData?.sessions.length === 0) && (
                      <div className="flex gap-1 mt-2">
                        {(["pool", "weight", "dryland"] as const).map(type => (
                          <button key={type} onClick={() => {
                            if (!groupSched) return;
                            const updated = [...schedules];
                            const gi = updated.findIndex(s => s.groupId === scheduleGroup);
                            if (gi < 0) return;
                            updated[gi].weekSchedule[day].sessions.push(makeDefaultSession(type, scheduleGroup));
                            if (dayData?.template === "rest-day") updated[gi].weekSchedule[day].template = "sprint-day";
                            saveSchedules(updated);
                          }}
                            className={`flex-1 py-3 rounded-lg text-xs font-bold border transition-all ${
                              type === "pool" ? "text-[#60a5fa]/40 border-[#60a5fa]/10 hover:bg-[#60a5fa]/10"
                                : type === "weight" ? "text-[#f59e0b]/40 border-[#f59e0b]/10 hover:bg-[#f59e0b]/10"
                                : "text-[#34d399]/40 border-[#34d399]/10 hover:bg-[#34d399]/10"
                            }`}>
                            {type === "pool" ? "+Pool" : type === "weight" ? "+Weights" : "+Dryland"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Template selector in edit mode */}
                  {scheduleEditMode && (
                    <select value={dayData?.template || "rest-day"}
                      onChange={e => {
                        if (!groupSched) return;
                        const updated = [...schedules];
                        const gi = updated.findIndex(s => s.groupId === scheduleGroup);
                        if (gi < 0) return;
                        updated[gi].weekSchedule[day].template = e.target.value;
                        saveSchedules(updated);
                      }}
                      className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[9px] text-white focus:outline-none focus:border-[#00f0ff]/30">
                      {SCHEDULE_TEMPLATES.map(t => (
                        <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {SCHEDULE_TEMPLATES.filter(t => t.id !== "rest-day").map(t => (
              <div key={t.id} className="flex items-center gap-1.5">
                <span style={{ color: t.color }}>{t.icon}</span>
                <span className="text-white/25 text-[10px]">{t.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
              <span className="text-white/25 text-[10px]">Pool</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
              <span className="text-white/25 text-[10px]">Weight</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34d399]" />
              <span className="text-white/25 text-[10px]">Dryland</span>
            </div>
          </div>

          <div className="text-center mt-8 text-white/[0.06] text-[10px]">
            <p>{groupInfo?.name || "Group"} · {groupSched ? Object.values(groupSched.weekSchedule).reduce((c, d) => c + d.sessions.length, 0) : 0} sessions/week</p>
          </div>
          </>}

          {/* Season Calendar View */}
          {calendarView && (() => {
            const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            const DAY_MAP: Record<number, DayOfWeek> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };

            const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
            const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
            const todayStr = new Date().toISOString().slice(0, 10);

            const prevMonth = () => {
              if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
              else setCalendarMonth(calendarMonth - 1);
            };
            const nextMonth = () => {
              if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
              else setCalendarMonth(calendarMonth + 1);
            };

            // Build array of cells: leading blanks + days
            const cells: (number | null)[] = [];
            for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);

            return (
              <div>
                {/* Month navigation */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button onClick={prevMonth} className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-[#00f0ff] hover:border-[#00f0ff]/30 flex items-center justify-center transition-all text-lg font-bold">&lsaquo;</button>
                  <div className="text-center min-w-[180px]">
                    <div className="text-sm font-black tracking-wider text-white/80">{MONTH_NAMES[calendarMonth]} {calendarYear}</div>
                    <div className="text-[9px] font-mono text-white/20 mt-0.5">{groupInfo?.name || "Group"} season schedule</div>
                  </div>
                  <button onClick={nextMonth} className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-[#00f0ff] hover:border-[#00f0ff]/30 flex items-center justify-center transition-all text-lg font-bold">&rsaquo;</button>
                </div>

                {/* Day-of-week header */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-[9px] font-mono font-bold text-white/20 tracking-wider py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((day, i) => {
                    if (day === null) return <div key={`blank-${i}`} className="aspect-square" />;

                    const date = new Date(calendarYear, calendarMonth, day);
                    const dow = date.getDay();
                    const dayKey = DAY_MAP[dow];
                    const daySessions = groupSched?.weekSchedule[dayKey]?.sessions || [];
                    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isToday = dateStr === todayStr;
                    const hasPool = daySessions.some(s => s.type === "pool");
                    const hasWeight = daySessions.some(s => s.type === "weight");
                    const hasDryland = daySessions.some(s => s.type === "dryland");
                    const sessionCount = daySessions.length;
                    const template = SCHEDULE_TEMPLATES.find(t => t.id === (groupSched?.weekSchedule[dayKey]?.template || "rest-day"));
                    const isRest = template?.id === "rest-day" || sessionCount === 0;
                    const isPast = dateStr < todayStr;

                    return (
                      <div key={day} className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all cursor-default ${
                        isToday
                          ? "border-[#00f0ff]/50 bg-[#00f0ff]/10 shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                          : isRest
                            ? "border-white/[0.03] bg-[#0a0518]/30"
                            : "border-white/[0.06] bg-[#0a0518]/60 hover:bg-[#0a0518]/80"
                      } ${isPast && !isToday ? "opacity-40" : ""}`}>
                        <span className={`text-[10px] font-mono font-bold leading-none ${
                          isToday ? "text-[#00f0ff]" : isRest ? "text-white/15" : "text-white/50"
                        }`}>{day}</span>
                        {!isRest && (
                          <div className="flex gap-[3px] mt-0.5">
                            {hasPool && <span className="w-[5px] h-[5px] rounded-full bg-[#60a5fa]" />}
                            {hasWeight && <span className="w-[5px] h-[5px] rounded-full bg-[#f59e0b]" />}
                            {hasDryland && <span className="w-[5px] h-[5px] rounded-full bg-[#34d399]" />}
                          </div>
                        )}
                        {template && !isRest && (
                          <span className="text-[7px] leading-none" style={{ color: template.color }}>{template.icon}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Calendar legend */}
                <div className="mt-5 flex flex-wrap gap-3 justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                    <span className="text-white/25 text-[10px]">Pool</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                    <span className="text-white/25 text-[10px]">Weight</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#34d399]" />
                    <span className="text-white/25 text-[10px]">Dryland</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded border border-[#00f0ff]/50 bg-[#00f0ff]/10" />
                    <span className="text-white/25 text-[10px]">Today</span>
                  </div>
                </div>

                {/* Session summary for the month */}
                <div className="mt-4 text-center text-white/[0.06] text-[10px]">
                  <p>{groupInfo?.name || "Group"} · {MONTH_NAMES[calendarMonth]} {calendarYear}</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── PARENT VIEW ──────────────────────────────────────────
  if (view === "parent") {
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs /><XpFloats /><LevelUpOverlay />
        <div className="w-full relative z-10 px-5 sm:px-8">
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
                      {growth.xpGain > 0 ? "↑" : "↓"} {Math.abs(growth.xpGain)} XP vs last month
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-white/25">
                      <div><span className="text-white/40 font-bold">{a.totalPractices}</span> sessions</div>
                      <div><span className="text-white/40 font-bold">{Object.values(a.quests).filter(q => q === "done").length}</span> quests</div>
                      <div><span className="text-white/40 font-bold">{getStreakMult(a.streak)}x</span> multiplier</div>
                    </div>
                  </div>
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
        <div className="w-full relative z-10 px-5 sm:px-8">
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
    const riskColor = (r: number) => r >= 60 ? "text-red-400" : r >= 40 ? "text-orange-400" : "text-yellow-400";
    const riskBg = (r: number) => r >= 60 ? "bg-red-500" : r >= 40 ? "bg-orange-500" : "bg-yellow-500";
    const trendIcon = engagementTrend.direction === "up" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg> : engagementTrend.direction === "down" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M15 8l4 4-4 4"/></svg>;
    const trendColor = engagementTrend.direction === "up" ? "text-emerald-400" : engagementTrend.direction === "down" ? "text-red-400" : "text-white/40";
    const cultureColor = cultureScore >= 70 ? "text-emerald-400" : cultureScore >= 40 ? "text-[#f59e0b]" : "text-red-400";
    const cultureBg = cultureScore >= 70 ? "bg-emerald-500" : cultureScore >= 40 ? "bg-[#f59e0b]" : "bg-red-500";

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full relative z-10 px-5 sm:px-8 pb-12">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-2">Coach Analytics</h2>
          <p className="text-[#00f0ff]/30 text-xs font-mono mb-8">Advanced insights · Predictive intelligence · Team health</p>

          {/* ── TEAM HEALTH DASHBOARD ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card className="p-5 text-center" neon>
              <div className={`text-4xl font-black tabular-nums whitespace-nowrap ${cultureColor}`}>{cultureScore}</div>
              <div className="text-white/20 text-[10px] uppercase mt-1 tracking-wider">Culture Score</div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div className={`h-full rounded-full ${cultureBg} transition-all`} style={{ width: `${cultureScore}%` }} />
              </div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className={`text-4xl font-black tabular-nums whitespace-nowrap ${trendColor}`}>{engagementTrend.delta > 0 ? "+" : ""}{engagementTrend.delta}%</div>
              <div className="text-white/20 text-[10px] uppercase mt-1 tracking-wider">{trendIcon} Engagement Trend</div>
              <div className="text-white/15 text-[10px] mt-2">vs last 7 days</div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className="text-4xl font-black tabular-nums whitespace-nowrap text-red-400">{atRiskAthletes.length}</div>
              <div className="text-white/20 text-[10px] uppercase mt-1 tracking-wider">At Risk Athletes</div>
              <div className="text-white/15 text-[10px] mt-2">need attention</div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className="text-4xl font-black tabular-nums whitespace-nowrap text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div>
              <div className="text-white/20 text-[10px] uppercase mt-1 tracking-wider">30-Day Attendance</div>
              <div className="text-white/15 text-[10px] mt-2">{avgXP(snapshots.slice(-30))} avg XP/day</div>
            </Card>
          </div>

          {/* ── ATTRITION RISK RADAR ── */}
          {atRiskAthletes.length > 0 && (
            <Card className="p-6 mb-6" glow>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter:'drop-shadow(0 0 6px rgba(239,68,68,0.4))'}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                <h3 className="text-red-400 text-sm font-black uppercase tracking-wider">Attrition Risk Radar</h3>
                <span className="text-white/15 text-[10px] ml-auto font-mono">{atRiskAthletes.length} athlete{atRiskAthletes.length > 1 ? "s" : ""} flagged</span>
              </div>
              <div className="space-y-3">
                {atRiskAthletes.slice(0, 8).map(a => {
                  const lv = getLevel(a.xp);
                  return (
                    <div key={a.id} className="flex items-center gap-4 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-red-500/20 transition-all">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${lv.color}15`, border: `1px solid ${lv.color}30`, color: lv.color }}>
                        {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{a.name}</div>
                        <div className="text-white/20 text-[10px]">
                          Streak: {a.streak}d · {a.totalPractices} sessions · {getLevel(a.xp).name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-black tabular-nums whitespace-nowrap ${riskColor(a.risk)}`}>{a.risk}</div>
                        <div className="text-white/15 text-[10px]">risk score</div>
                      </div>
                      <div className="w-16 h-2 rounded-full bg-white/[0.04] overflow-hidden shrink-0">
                        <div className={`h-full rounded-full ${riskBg(a.risk)} transition-all`} style={{ width: `${a.risk}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-white/10 text-[10px] mt-4 font-mono">Risk factors: low attendance, broken streaks, low XP growth, no quest engagement, no teammate interaction</p>
            </Card>
          )}

          {/* ── PEAK PERFORMANCE WINDOWS ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Peak Performance Windows</h3>
            <div className="flex items-end gap-3 h-32">
              {peakWindows.map((pw, i) => {
                const maxXP = Math.max(...peakWindows.map(p => p.avgXP), 1);
                const pct = (pw.avgXP / maxXP) * 100;
                const isTop = i === 0 && pw.avgXP > 0;
                return (
                  <div key={pw.day} className="flex-1 flex flex-col items-center gap-2">
                    <span className={`text-[10px] font-bold font-mono ${isTop ? "text-[#f59e0b]" : "text-white/25"}`}>{pw.avgXP}</span>
                    <div className={`w-full rounded-t transition-all ${isTop ? "bg-gradient-to-t from-[#f59e0b] to-[#f59e0b]/60" : "bg-[#6b21a8]/60"}`}
                      style={{ height: `${Math.max(pct, 4)}%` }} />
                    <span className={`text-[10px] font-bold ${isTop ? "text-[#f59e0b]" : "text-white/30"}`}>{pw.day}</span>
                  </div>
                );
              })}
            </div>
            {peakWindows[0]?.avgXP > 0 && (
              <p className="text-white/15 text-[10px] mt-4 font-mono">Best day: <span className="text-[#f59e0b]">{peakWindows[0].day}</span> — avg {peakWindows[0].avgXP} XP across {peakWindows[0].sessions} sessions</p>
            )}
          </Card>

          {/* ── CHECKPOINT EFFICIENCY ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Checkpoint Efficiency</h3>
            <p className="text-white/15 text-[10px] mb-4 font-mono">Which habits are sticking? Sorted by completion rate across the team.</p>
            <div className="space-y-2">
              {checkpointEfficiency.slice(0, 8).map(cp => (
                <div key={cp.id} className="flex items-center gap-3">
                  <span className="text-white/40 text-xs w-40 truncate">{cp.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-[#6b21a8] transition-all" style={{ width: `${cp.rate}%` }} />
                  </div>
                  <span className="text-white/30 text-[10px] font-mono w-10 text-right">{cp.rate}%</span>
                  <span className="text-white/15 text-[10px] font-mono w-8 text-right">{cp.count}</span>
                </div>
              ))}
            </div>
            {checkpointEfficiency.length > 0 && checkpointEfficiency[checkpointEfficiency.length - 1].rate < 20 && (
              <p className="text-orange-400/40 text-[10px] mt-4 font-mono">Low adoption: <span className="text-orange-400">{checkpointEfficiency[checkpointEfficiency.length - 1].name}</span> — consider coaching emphasis</p>
            )}
          </Card>

          {/* ── ENGAGEMENT CALENDAR ── */}
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

          {/* ── ATHLETE TIMELINE ── */}
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
                  <span className={`text-xs font-bold ml-auto ${riskColor(getAttritionRisk(tlAthlete))}`}>
                    Risk: {getAttritionRisk(tlAthlete)}/100
                  </span>
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

          {/* ── PERIOD COMPARISON ── */}
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
                    <div className="flex justify-between"><span className="text-white/35">Avg XP/day</span><span className="text-white font-bold tabular-nums">{avgXP(col.data)}</span></div>
                    <div className="flex justify-between"><span className="text-white/35">Avg Attendance</span><span className="text-white font-bold tabular-nums">{avgAtt(col.data)}%</span></div>
                    <div className="flex justify-between"><span className="text-white/35">Days tracked</span><span className="text-white font-bold tabular-nums">{col.data.length}</span></div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* ── MONTHLY REPORT CARD ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/30 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Monthly Report Card</h3>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div><div className="text-white/20 text-[10px] uppercase mt-1">Attendance</div></div>
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-[#a855f7]">{avgXP(snapshots.slice(-30))}</div><div className="text-white/20 text-[10px] uppercase mt-1">Avg XP/Day</div></div>
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-white">{longestStreak?.streak || 0}d</div><div className="text-white/20 text-[10px] uppercase mt-1">Longest Streak</div></div>
            </div>
            <div className="mb-4">
              <div className="text-white/25 text-[10px] uppercase tracking-wider mb-2">Top 5</div>
              {top5.map((a, i) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-white/40 truncate min-w-0"><span className="text-[#f59e0b] font-bold mr-2">{i + 1}.</span>{a.name}</span>
                  <span className="text-[#f59e0b] font-bold tabular-nums whitespace-nowrap shrink-0">{a.xp} XP</span>
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
            className="game-btn px-5 py-3 bg-[#06020f]/60 text-[#00f0ff]/40 text-sm font-mono border border-[#00f0ff]/15 hover:text-[#00f0ff]/70 hover:border-[#00f0ff]/30 transition-all min-h-[44px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1.5 -mt-0.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>Export Full CSV
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     COACH MAIN VIEW — LEADERBOARD-FIRST LAYOUT
     ════════════════════════════════════════════════════════════ */

  const present = filteredRoster.filter(a => Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)).length;
  const totalXpToday = filteredRoster.reduce((s, a) => s + (a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0);

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <XpFloats /><LevelUpOverlay />

      <div className="relative z-10 w-full px-5 sm:px-8">
        <div className="w-full">
          <GameHUDHeader />

        {/* ══════════════════════════════════════════════════════
           GROUP SELECTOR — SWITCH ROSTER GROUPS
           ══════════════════════════════════════════════════════ */}
        <div className="py-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {ROSTER_GROUPS.map(g => {
              const isActive = selectedGroup === g.id;
              const count = roster.filter(a => a.group === g.id).length;
              return (
                <button key={g.id} onClick={() => switchGroup(g.id)}
                  className={`game-btn px-4 py-3 text-xs sm:text-sm font-bold font-mono tracking-wider transition-all min-h-[44px] ${
                    isActive
                      ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                      : "bg-[#06020f]/60 text-white/30 border border-white/10 hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20"
                  }`}>
                  <span className="mr-1">{g.icon}</span>
                  <span>{g.name.toUpperCase()}</span>
                  <span className="ml-2 text-[10px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="text-center mt-3 text-xs font-mono text-white/20">
            {currentGroupDef.icon} {currentGroupDef.name} — {currentGroupDef.sport.toUpperCase()} — {filteredRoster.length} athletes
          </div>
        </div>

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
                    const medals = [<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="15" r="7" fill="#f59e0b22"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c0c0d2" strokeWidth="2"><circle cx="12" cy="15" r="7" fill="#c0c0d215"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cd7f32" strokeWidth="2"><circle cx="12" cy="15" r="7" fill="#cd7f3215"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>];
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
                        <div className="neon-text-gold text-2xl sm:text-3xl font-black mt-3 tracking-tight font-mono tabular-nums whitespace-nowrap">
                          {a.xp}<span className="text-xs text-[#f59e0b]/30 ml-1">XP</span>
                        </div>
                        {a.streak > 0 && (
                          <div className="text-white/20 text-[10px] mt-1 font-bold inline-flex items-center gap-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316"><path d="M12 23c-3.9 0-7-3.1-7-7 0-3 2-5.5 4-8l3 3c.4.4 1 .2 1-.3V2l5 6c2 2.4 3 5 3 8 0 3.9-3.1 7-7 7z"/></svg> {a.streak}d streak</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top 10 ranked list */}
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="text-[#00f0ff]/40 text-[11px] uppercase tracking-[0.2em] font-bold font-mono">// Top 10 Rankings</h3>
              <span className="text-[#00f0ff]/20 text-[10px] font-mono">{Math.min(10, sorted.length)} of {sorted.length}</span>
            </div>
            <div className="game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-2xl overflow-hidden shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
              {sorted.slice(0, 10).map((a, i) => {
                const lv = getLevel(a.xp);
                const sk = fmtStreak(a.streak);
                const rank = i + 1;
                const medalEmoji = rank === 1 ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="15" r="7" fill="#f59e0b22"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg> : rank === 2 ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0c0d2" strokeWidth="2"><circle cx="12" cy="15" r="7" fill="#c0c0d215"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg> : rank === 3 ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cd7f32" strokeWidth="2"><circle cx="12" cy="15" r="7" fill="#cd7f3215"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg> : null;
                return (
                  <div key={a.id} className={`flex items-center gap-4 py-4 px-6 transition-all duration-200 hover:bg-white/[0.04] hover:shadow-[inset_0_0_30px_rgba(107,33,168,0.05)] group ${rank <= 3 ? "bg-white/[0.02]" : ""} ${i < sorted.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                    <span className={`w-8 text-center text-sm font-black shrink-0 transition-colors ${rank <= 3 ? "text-[#f59e0b]" : "text-white/10 group-hover:text-white/25"}`}>
                      {medalEmoji || rank}
                    </span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white/70 shrink-0 transition-all duration-200 group-hover:scale-110"
                      style={{ background: `radial-gradient(circle, ${lv.color}20, ${lv.color}08)`, border: `2px solid ${lv.color}${rank <= 3 ? "60" : "30"}`, boxShadow: `0 0 12px ${lv.color}${rank <= 3 ? "20" : "10"}` }}>
                      {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className={`text-sm font-semibold flex-1 truncate group-hover:text-white transition-colors ${rank <= 3 ? "text-white" : "text-white/80"}`}>{a.name}</span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1 transition-all" style={{ color: lv.color, background: `${lv.color}12`, boxShadow: `0 0 8px ${lv.color}08` }}>{lv.icon} {lv.name}</span>
                    {a.streak > 0 && <span className="text-white/20 text-[10px] hidden sm:inline-flex items-center gap-0.5 font-bold"><svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316"><path d="M12 23c-3.9 0-7-3.1-7-7 0-3 2-5.5 4-8l3 3c.4.4 1 .2 1-.3V2l5 6c2 2.4 3 5 3 8 0 3.9-3.1 7-7 7z"/></svg> {a.streak}d</span>}
                    <span className="text-[#f59e0b] text-sm font-black w-16 text-right tabular-nums whitespace-nowrap shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">{a.xp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════ TEAM CHALLENGES ═══════ */}
        {view === "coach" && (
          <div className="w-full px-5 sm:px-8 py-4">
            <h3 className="text-[#f59e0b]/50 text-[11px] uppercase tracking-[0.2em] font-bold font-mono mb-3">// Team Challenges</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: "attendance-war", name: "Attendance War", desc: "Which group has the highest attendance % this week?", metric: "GROUP ATTENDANCE", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 7l4-4 4 4-4 4M3 11l4 4"/></svg>, color: "#ef4444" },
                { id: "xp-race", name: "XP Race", desc: "First group to collectively earn 5,000 XP wins", metric: "COLLECTIVE XP", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>, color: "#f59e0b" },
                { id: "streak-city", name: "Streak City", desc: "Group with the most athletes on 7+ day streaks", metric: "ACTIVE STREAKS", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="#f97316"><path d="M12 23c-3.9 0-7-3.1-7-7 0-3 2-5.5 4-8l3 3c.4.4 1 .2 1-.3V2l5 6c2 2.4 3 5 3 8 0 3.9-3.1 7-7 7z"/></svg>, color: "#f97316" },
                { id: "quest-masters", name: "Quest Masters", desc: "Group that completes the most side quests this week", metric: "QUESTS DONE", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, color: "#a855f7" },
              ].map(challenge => {
                const groupAthletes = roster.filter(a => a.group === selectedGroup);
                const val = challenge.id === "attendance-war"
                  ? `${groupAthletes.length > 0 ? Math.round((groupAthletes.filter(a => a.weekSessions > 0).length / groupAthletes.length) * 100) : 0}%`
                  : challenge.id === "xp-race"
                  ? `${groupAthletes.reduce((s, a) => s + a.xp, 0).toLocaleString()} XP`
                  : challenge.id === "streak-city"
                  ? `${groupAthletes.filter(a => a.streak >= 7).length} athletes`
                  : `${groupAthletes.reduce((s, a) => s + Object.values(a.quests).filter(q => q === "done").length, 0)} done`;
                return (
                  <div key={challenge.id} className="p-4 rounded-xl bg-[#06020f]/80 border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{challenge.icon}</span>
                      <span className="text-white/80 text-sm font-bold">{challenge.name}</span>
                    </div>
                    <p className="text-white/25 text-[10px] mb-3">{challenge.desc}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-mono tracking-wider" style={{ color: `${challenge.color}80` }}>{challenge.metric}</span>
                      <span className="text-lg font-black" style={{ color: challenge.color }}>{val}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
           COACH TOOLS + ROSTER CHECK-IN
           ══════════════════════════════════════════════════════ */}
        <div className="w-full px-5 sm:px-8 py-6">
          <div className="w-full">
            {/* AM/PM Session Selector — auto-detects from schedule */}
            <div className="mb-4 p-4 rounded-2xl bg-[#0a0518]/80 border border-[#a855f7]/15 flex items-center justify-between flex-wrap gap-3">
              <button onClick={() => setAutoSession(!autoSession)} title={autoSession ? "Auto-detecting from schedule" : "Manual mode"}
                className={`text-[9px] font-mono tracking-wider uppercase px-2 py-1 rounded border transition-all inline-flex items-center gap-1 ${autoSession ? "text-[#00f0ff]/60 border-[#00f0ff]/20 bg-[#00f0ff]/5" : "text-white/20 border-white/[0.06]"}`}>
                {autoSession ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg> AUTO</> : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 00-2-2h-1a2 2 0 00-2 2M9 11V4a2 2 0 00-2-2H6a2 2 0 00-2 2v7m5 0V3a2 2 0 00-2-2H6m9 13v-3a2 2 0 00-2-2H6a2 2 0 00-2 2v6a6 6 0 006 6h1a6 6 0 006-6v-1"/></svg> MANUAL</>}
              </button>
              <div className="flex rounded-xl overflow-hidden border border-[#a855f7]/25">
                {(["am", "pm"] as const).map(t => (
                  <button key={t} onClick={() => { setAutoSession(false); setSessionTime(t); }}
                    className={`px-6 py-3 text-sm font-bold font-mono tracking-wider uppercase transition-all ${
                      sessionTime === t
                        ? t === "am"
                          ? "bg-gradient-to-r from-[#f59e0b]/20 to-[#fbbf24]/10 text-[#fbbf24] shadow-[inset_0_0_20px_rgba(251,191,36,0.15)] border-r border-[#a855f7]/25"
                          : "bg-gradient-to-r from-[#6366f1]/20 to-[#818cf8]/10 text-[#818cf8] shadow-[inset_0_0_20px_rgba(129,140,248,0.15)]"
                        : "bg-[#06020f]/60 text-white/20 hover:text-white/40"
                    }`}>
                    <span className="inline-flex items-center gap-1.5">{t === "am" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> AM PRACTICE</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> PM PRACTICE</>}</span>
                  </button>
                ))}
              </div>
              <div className="text-white/15 text-[10px] font-mono">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
            </div>

            {/* Session mode + tools */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap items-center">
                {/* Session type */}
                {(["pool", "weight", "meet"] as const).map(m => {
                  const sportLabels = { swimming: { pool: "Pool", weight: "Weight Room", meet: "Meet Day" }, diving: { pool: "Board", weight: "Dryland", meet: "Meet Day" }, waterpolo: { pool: "Pool", weight: "Gym", meet: "Match Day" } };
                  const labels = sportLabels[currentSport as keyof typeof sportLabels] || sportLabels.swimming;
                  const ModeSvg = () => {
                    if (m === "pool") return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>;
                    if (m === "weight") return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><path d="M6 12h12"/><rect x="6" y="7" width="3" height="10" rx="1"/><rect x="15" y="7" width="3" height="10" rx="1"/></svg>;
                    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
                  };
                  return (
                    <button key={m} onClick={() => setSessionMode(m)}
                      className={`game-btn flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-all duration-200 min-h-[52px] font-mono tracking-wider uppercase ${
                        sessionMode === m
                          ? "bg-[#00f0ff]/15 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_40px_rgba(0,240,255,0.3),inset_0_0_20px_rgba(0,240,255,0.05)] scale-[1.02]"
                          : "bg-[#06020f]/60 text-white/30 hover:text-[#00f0ff]/60 border border-[#00f0ff]/10 hover:border-[#00f0ff]/25 hover:shadow-[0_0_25px_rgba(0,240,255,0.1)] hover:scale-[1.01]"
                      }`}>
                      <ModeSvg />{labels[m]}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={bulkMarkPresent} className="game-btn px-4 py-2.5 bg-[#00f0ff]/10 text-[#00f0ff]/80 text-sm font-mono tracking-wider border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all active:scale-[0.97] min-h-[44px]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>BULK
                </button>
                <button onClick={undoLast} className="game-btn flex items-center gap-1 px-3 py-2.5 bg-[#06020f]/60 text-[#00f0ff]/30 text-sm font-mono border border-[#00f0ff]/10 hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/25 transition-all active:scale-[0.97] min-h-[44px]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> UNDO</button>
                <button onClick={resetDay} className="game-btn flex items-center gap-1 px-3 py-2.5 bg-[#06020f]/60 text-[#a855f7]/30 text-sm font-mono border border-[#a855f7]/10 hover:text-[#e879f9]/60 hover:border-[#e879f9]/25 transition-all active:scale-[0.97] min-h-[44px]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> DAY</button>
                <button onClick={resetWeek} className="game-btn flex items-center gap-1 px-3 py-2.5 bg-[#06020f]/60 text-[#a855f7]/30 text-sm font-mono border border-[#a855f7]/10 hover:text-[#e879f9]/60 hover:border-[#e879f9]/25 transition-all active:scale-[0.97] min-h-[44px]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> WEEK</button>
                <button onClick={resetMonth} className="game-btn flex items-center gap-1 px-3 py-2.5 bg-[#06020f]/60 text-[#f59e0b]/30 text-sm font-mono border border-[#f59e0b]/10 hover:text-[#f59e0b]/60 hover:border-[#f59e0b]/25 transition-all active:scale-[0.97] min-h-[44px]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/><circle cx="12" cy="12" r="10"/></svg> MONTH</button>
                <button onClick={exportCSV} className="game-btn flex items-center gap-1 px-3 py-2.5 bg-[#06020f]/60 text-[#00f0ff]/30 text-sm font-mono border border-[#00f0ff]/10 hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/25 transition-all active:scale-[0.97] min-h-[44px]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV</button>
              </div>
            </div>

            {/* Active session info bar */}
            <div className="flex items-center gap-3 mb-4 text-[10px] font-mono tracking-wider text-white/25">
              <span className="text-[#00f0ff]/40">COACH: <span className="text-[#00f0ff]/70">{activeCoach}</span></span>
              <span className="text-white/10">|</span>
              <span className="text-[#a855f7]/40">SESSION: <span className="text-[#e879f9]/70">{sessionTime.toUpperCase()} {sessionMode === "pool" ? "POOL" : sessionMode === "weight" ? "WEIGHT" : "MEET"}</span></span>
              <span className="text-white/10">|</span>
              <button onClick={() => setManageCoaches(!manageCoaches)}
                className="text-white/20 hover:text-[#00f0ff]/60 transition-colors">
                {manageCoaches ? "CLOSE" : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1 -mt-0.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>MANAGE COACHES</>}
              </button>
            </div>

            {/* Coach management panel */}
            {manageCoaches && (
              <div className="game-card mb-6 p-5">
                <h4 className="text-[#00f0ff]/40 text-[10px] uppercase tracking-[0.2em] font-bold mb-4 font-mono">// Coach Profiles</h4>
                <div className="space-y-2 mb-4">
                  {coaches.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono ${c.role === "head" ? "text-[#f59e0b]" : "text-[#00f0ff]/60"}`}>
                          {c.role === "head" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" className="inline-block -mt-0.5"><path d="M2 20h20l-2-8-4 4-4-8-4 8-4-4z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.5" className="inline-block -mt-0.5"><path d="M2 20c2-1 4-2 6-2s4 1 6 2 4 1 6 0" strokeLinecap="round"/><circle cx="12" cy="9" r="3"/></svg>} {c.name}
                        </span>
                        <span className="text-[10px] text-white/15 font-mono">PIN: {c.pin}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${c.role === "head" ? "bg-[#f59e0b]/10 text-[#f59e0b]/60" : "bg-[#00f0ff]/10 text-[#00f0ff]/40"}`}>
                          {c.role.toUpperCase()}
                        </span>
                      </div>
                      {!(c.role === "head" && coaches.filter(x => x.role === "head").length <= 1) && (
                        <button onClick={() => removeCoach(i)} className="text-red-400/30 hover:text-red-400/80 text-xs transition-colors">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input value={newCoachName} onChange={e => setNewCoachName(e.target.value)} placeholder="Coach name"
                    className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs w-36 focus:outline-none focus:border-[#00f0ff]/30 min-h-[38px]" />
                  <input value={newCoachPin} onChange={e => setNewCoachPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4-digit PIN"
                    className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs w-28 focus:outline-none focus:border-[#00f0ff]/30 min-h-[38px]" />
                  <select value={newCoachRole} onChange={e => setNewCoachRole(e.target.value as "head" | "assistant" | "guest")}
                    className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none min-h-[38px]">
                    <option value="assistant">Assistant</option>
                    <option value="head">Head Coach</option>
                  </select>
                  <button onClick={addCoach}
                    className="px-4 py-2 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff]/80 text-xs font-bold border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20 transition-all min-h-[38px]">
                    + Add Coach
                  </button>
                </div>
                <div className="mt-4 pt-3 border-t border-white/[0.04]">
                  <h5 className="text-[#a855f7]/40 text-[9px] uppercase tracking-[0.2em] font-bold mb-2 font-mono">// Quick Invite</h5>
                  <p className="text-white/15 text-[10px] mb-2 font-mono">Share this link with colleagues — they can access Apex with their own PIN:</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[#00f0ff]/60 text-[10px] font-mono truncate">
                      {typeof window !== "undefined" ? `${window.location.origin}/apex-athlete/portal` : "/apex-athlete/portal"}
                    </code>
                    <button
                      onClick={() => { if (typeof navigator !== "undefined") navigator.clipboard.writeText(`${window.location.origin}/apex-athlete/portal`); }}
                      className="px-3 py-2 rounded-lg bg-[#a855f7]/10 text-[#a855f7]/60 text-[10px] font-bold border border-[#a855f7]/20 hover:bg-[#a855f7]/20 transition-all min-h-[34px] shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1 -mt-0.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy
                    </button>
                  </div>
                  <p className="text-white/10 text-[9px] mt-2 font-mono">Each coach logs in with their own PIN. All check-ins are tracked separately in the audit log.</p>
                </div>
              </div>
            )}

            {/* Add athlete */}
            <div className="mb-6">
              <button onClick={() => setAddAthleteOpen(!addAthleteOpen)}
                className="text-white/20 text-xs hover:text-white/40 transition-colors min-h-[36px]">
                {addAthleteOpen ? "Cancel" : "+ Add Athlete"}
              </button>
              {addAthleteOpen && (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-3 items-center flex-wrap">
                    <input value={newAthleteName} onChange={e => setNewAthleteName(e.target.value)} placeholder="Full Name"
                      className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm w-52 focus:outline-none focus:border-[#6b21a8]/40 min-h-[44px]" />
                    <input value={newAthleteAge} onChange={e => setNewAthleteAge(e.target.value.replace(/\D/g, ""))} placeholder="Age"
                      className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm w-20 focus:outline-none min-h-[44px]" />
                    <select value={newAthleteGender} onChange={e => setNewAthleteGender(e.target.value as "M" | "F")}
                      className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none min-h-[44px]">
                      <option value="M">M</option><option value="F">F</option>
                    </select>
                  </div>
                  <div className="flex gap-3 items-center flex-wrap">
                    <input value={newAthleteUSAId} onChange={e => setNewAthleteUSAId(e.target.value)} placeholder="USA Swimming ID (optional)"
                      className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm w-52 focus:outline-none focus:border-[#6b21a8]/40 min-h-[44px]" />
                    <input value={newAthleteParentEmail} onChange={e => setNewAthleteParentEmail(e.target.value)} placeholder="Parent Email (optional)"
                      className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm w-52 focus:outline-none focus:border-[#6b21a8]/40 min-h-[44px]" />
                    <button onClick={addAthleteAction}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#7c3aed] to-[#6b21a8] text-white text-sm font-bold min-h-[44px] hover:shadow-[0_0_20px_rgba(107,33,168,0.3)] transition-all">
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── ATHLETE ROSTER ─────────────────────────────── */}
            <h3 className="text-[#00f0ff]/30 text-[11px] uppercase tracking-[0.2em] font-bold mb-4 font-mono">// Roster Check-In</h3>
            <div className="space-y-2 mb-10">
              {[...filteredRoster].sort((a, b) => a.name.localeCompare(b.name)).map(a => {
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
                        className="flex items-center gap-4 p-4 sm:p-5 cursor-pointer hover:bg-white/[0.02] transition-colors duration-150 rounded-2xl group"
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
                            {a.streak > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]/70 inline-flex items-center gap-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316"><path d="M12 23c-3.9 0-7-3.1-7-7 0-3 2-5.5 4-8l3 3c.4.4 1 .2 1-.3V2l5 6c2 2.4 3 5 3 8 0 3.9-3.1 7-7 7z"/></svg> {a.streak}d · {sk.mult}</span>}
                            {hasCk && <span className="text-emerald-400/60 text-[10px] font-bold">✓ checked in</span>}
                          </div>
                        </div>
                        <div className="w-32 shrink-0 text-right">
                          <div className="text-white font-black text-base tabular-nums whitespace-nowrap drop-shadow-[0_0_8px_rgba(245,158,11,0.15)]">{a.xp}<span className="text-white/15 text-[10px] ml-1">XP</span></div>
                          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden mt-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]">
                            <div className="h-full rounded-full xp-shimmer" style={{ width: `${prog.percent}%` }} />
                          </div>
                          {dailyUsed > 0 && <div className="text-[10px] text-[#f59e0b]/60 font-bold mt-1.5">+{dailyUsed} today</div>}
                        </div>
                      </div>
                      <div className={`athlete-card-wrapper ${isExp ? "open" : ""}`}>
                      <div>
                        {isExp && <div className="px-4 sm:px-5 pb-5 expand-in"><AthleteExpanded athlete={a} /></div>}
                      </div>
                    </div>
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
                        <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${done ? "text-[#f59e0b]" : "text-white/25"}`}>{tc.current}%<span className="text-white/10">/{tc.target}%</span></span>
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

        {/* Mission + Privacy footer */}
        <div className="text-center text-white/[0.06] text-[10px] py-10 space-y-2">
          <p className="text-white/10 text-xs italic">&ldquo;Unlocking the greatness already inside every athlete — through the power of play.&rdquo;</p>
          <p className="text-white/[0.04]">Every rep counts. Every streak matters. Every athlete has a story.</p>
          <p className="text-white/[0.03] mt-1">Coach manages all data · Parental consent required · COPPA compliant</p>
        </div>
      </div>
    </div>
  );
}
