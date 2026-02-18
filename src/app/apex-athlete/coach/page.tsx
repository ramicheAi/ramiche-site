"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Saint Andrew's Aquatics — Platinum Group
   Clean UI · React + Tailwind · localStorage
   ══════════════════════════════════════════════════════════════ */

// ── game engine ──────────────────────────────────────────────

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
const PRESENT_XP = 5; // Base XP just for showing up
const SHOUTOUT_XP = 25; // MVP/Shoutout bonus XP
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

// IDs auto-checked when "present" is toggled (the basics every kid does)
const AUTO_CHECK_IDS = new Set([
  "on-deck-early", "gear-ready", "on-time-ready", "warmup-complete",
  "practice-complete", "cool-down-complete", "no-skipped-reps",
]);

// Auto-checked basics — visible so coach can deselect exceptions
const AUTO_POOL_CPS = POOL_CPS.filter(cp => AUTO_CHECK_IDS.has(cp.id));

// Manual-award checkpoints — coach taps these for standout kids
const MANUAL_POOL_CPS = POOL_CPS.filter(cp => !AUTO_CHECK_IDS.has(cp.id));

const WEIGHT_CPS = [
  { id: "w-showed-up", name: "Showed Up", xp: 10, desc: "Present at 5:30pm, ready to lift" },
  { id: "w-full-workout", name: "Full Workout", xp: 20, desc: "Completed every exercise" },
  { id: "w-extra-sets", name: "Extra Sets", xp: 15, desc: "Did additional sets beyond the program" },
];

const MEET_CPS = [
  { id: "m-pr", name: "Personal Best", xp: 50, desc: "Set a new personal best in any event" },
  { id: "m-meet-record", name: "Meet Record", xp: 75, desc: "Broke the meet record" },
  { id: "m-team-record", name: "Team Record", xp: 100, desc: "Set a new team record" },
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
  quests: Record<string, "active" | "submitted" | "done" | "pending">;
  questNotes?: Record<string, string>;
  dailyXP: DailyXP;
  present?: boolean;
  birthday?: string;
  usaSwimmingId?: string;
  parentName?: string;
  parentPhone?: string;
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

// ── meet entry types ────────────────────────────────────────

interface MeetEventEntry {
  athleteId: string;
  seedTime: string;
}

interface MeetEvent {
  id: string;
  name: string;
  eventNum?: number;
  gender?: "M" | "F" | "Mixed";
  qualifyingTime?: string;
  entries: MeetEventEntry[];
}

interface MeetBroadcast {
  id: string;
  message: string;
  timestamp: number;
  sentBy: string;
}

interface SwimMeet {
  id: string;
  name: string;
  date: string;
  location: string;
  course: "SCY" | "SCM" | "LCM";
  rsvpDeadline: string;
  events: MeetEvent[];
  rsvps: Record<string, "committed" | "declined" | "pending">;
  broadcasts: MeetBroadcast[];
  status: "upcoming" | "active" | "completed";
}

// ── standard swim events ────────────────────────────────────

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

// ── qualifying time standards (sample SCY times for suggestions) ──
const QUALIFYING_STANDARDS: Record<string, Record<string, { M: number; F: number }>> = {
  SCY: {
    "50 Free": { M: 22.5, F: 25.0 },
    "100 Free": { M: 49.0, F: 55.0 },
    "200 Free": { M: 107.0, F: 118.0 },
    "500 Free": { M: 285.0, F: 315.0 },
    "100 Back": { M: 55.0, F: 61.0 },
    "200 Back": { M: 118.0, F: 130.0 },
    "100 Breast": { M: 62.0, F: 69.0 },
    "200 Breast": { M: 132.0, F: 145.0 },
    "100 Fly": { M: 53.0, F: 60.0 },
    "200 Fly": { M: 118.0, F: 130.0 },
    "200 IM": { M: 115.0, F: 125.0 },
    "400 IM": { M: 250.0, F: 275.0 },
  },
  SCM: {
    "50 Free": { M: 23.5, F: 26.0 },
    "100 Free": { M: 51.0, F: 57.0 },
    "200 Free": { M: 112.0, F: 123.0 },
    "400 Free": { M: 240.0, F: 265.0 },
    "100 Back": { M: 57.0, F: 63.0 },
    "200 Back": { M: 122.0, F: 135.0 },
    "100 Breast": { M: 64.0, F: 72.0 },
    "200 Breast": { M: 137.0, F: 150.0 },
    "100 Fly": { M: 55.0, F: 62.0 },
    "200 Fly": { M: 122.0, F: 135.0 },
    "200 IM": { M: 120.0, F: 130.0 },
    "400 IM": { M: 260.0, F: 285.0 },
  },
  LCM: {
    "50 Free": { M: 24.0, F: 27.0 },
    "100 Free": { M: 52.0, F: 58.0 },
    "200 Free": { M: 114.0, F: 126.0 },
    "400 Free": { M: 245.0, F: 270.0 },
    "100 Back": { M: 58.0, F: 65.0 },
    "200 Back": { M: 125.0, F: 138.0 },
    "100 Breast": { M: 66.0, F: 74.0 },
    "200 Breast": { M: 140.0, F: 155.0 },
    "100 Fly": { M: 56.0, F: 64.0 },
    "200 Fly": { M: 125.0, F: 138.0 },
    "200 IM": { M: 122.0, F: 132.0 },
    "400 IM": { M: 265.0, F: 290.0 },
  },
};

function parseTimeToSeconds(t: string): number {
  if (!t || t === "NT") return Infinity;
  const parts = t.split(":");
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  if (parts.length === 1) return parseFloat(parts[0]);
  return Infinity;
}

function formatSecondsToTime(s: number): string {
  if (!isFinite(s) || s <= 0) return "NT";
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins > 0) return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
  return secs.toFixed(2);
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
  { id: "sprint-day", name: "Sprint Day", icon: "\u26A1", color: "#f59e0b", description: "Short-distance speed work, starts & turns" },
  { id: "endurance-day", name: "Endurance Day", icon: "\uD83C\uDF0A", color: "#60a5fa", description: "Distance sets, threshold training, pacing" },
  { id: "drill-day", name: "Drill Day", icon: "\uD83D\uDD27", color: "#a855f7", description: "Technique drills, stroke correction, form focus" },
  { id: "technique-day", name: "Technique Day", icon: "\uD83C\uDFAF", color: "#34d399", description: "Video review, underwater work, refinement" },
  { id: "meet-day", name: "Meet Day", icon: "\uD83C\uDFC1", color: "#ef4444", description: "Competition day — warm-up, race, cool-down" },
  { id: "rest-day", name: "Rest Day", icon: "\uD83D\uDCA4", color: "#475569", description: "Recovery — no scheduled sessions" },
];

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

function makeDefaultGroupSchedule(groupId: string): GroupSchedule {
  const isPlatinum = groupId === "platinum";
  const emptyDay = (): DaySchedule => ({ template: "rest-day", sessions: [] });

  const poolDay = (template: string): DaySchedule => {
    const sessions: ScheduleSession[] = [
      { id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "pool", label: "Pool Practice", startTime: "15:30", endTime: "17:30", location: "Main Pool", notes: "" },
    ];
    if (isPlatinum) {
      sessions.push({ id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}w`, type: "weight", label: "Weight Room", startTime: "17:30", endTime: "18:30", location: "Weight Room", notes: "" });
    }
    return { template, sessions };
  };

  return {
    groupId,
    weekSchedule: {
      Mon: poolDay("sprint-day"),
      Tue: poolDay("endurance-day"),
      Wed: poolDay("drill-day"),
      Thu: poolDay("technique-day"),
      Fri: poolDay("sprint-day"),
      Sat: { template: "meet-day", sessions: [{ id: `s-${Date.now()}-sat`, type: "pool", label: isPlatinum ? "Meet / Optional Practice" : "Optional Practice", startTime: "08:00", endTime: "10:00", location: "Main Pool", notes: "Meets or optional practice" }] },
      Sun: emptyDay(),
    },
  };
}

// ── initial roster ───────────────────────────────────────────

// ── ROSTER GROUPS ────────────────────────────────────────────
const ROSTER_GROUPS = [
  { id: "platinum", name: "Platinum", sport: "swimming", color: "#c0c0ff", icon: "💎" },
  { id: "gold", name: "Gold", sport: "swimming", color: "#f59e0b", icon: "🥇" },
  { id: "silver", name: "Silver", sport: "swimming", color: "#94a3b8", icon: "🥈" },
  { id: "bronze1", name: "Bronze 1", sport: "swimming", color: "#cd7f32", icon: "🥉" },
  { id: "bronze2", name: "Bronze 2", sport: "swimming", color: "#cd7f32", icon: "🥉" },
  { id: "diving", name: "Diving", sport: "diving", color: "#38bdf8", icon: "🤿" },
  { id: "waterpolo", name: "Water Polo", sport: "waterpolo", color: "#f97316", icon: "🤽" },
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

const WEEK_TARGETS: Record<string, number> = {
  platinum: 8, gold: 6, silver: 6, bronze1: 6, bronze2: 4, diving: 4, waterpolo: 4,
};
function getWeekTarget(group: string): number {
  const key = group.toLowerCase().replace(/\s+/g, "").replace("bronze 1", "bronze1").replace("bronze 2", "bronze2").replace("water polo", "waterpolo");
  return WEEK_TARGETS[key] ?? 5;
}

function makeAthlete(r: { name: string; age: number; gender: "M" | "F"; group?: string }): Athlete {
  const g = r.group ?? "Varsity";
  return {
    id: r.name.toLowerCase().replace(/\s+/g, "-"),
    name: r.name, age: r.age, gender: r.gender, group: g,
    xp: 0, streak: 0, weightStreak: 0, lastStreakDate: "", lastWeightStreakDate: "",
    totalPractices: 0, weekSessions: 0, weekWeightSessions: 0, weekTarget: getWeekTarget(g),
    checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {},
    weightChallenges: {}, quests: {},
    dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 },
  };
}

// ── storage ──────────────────────────────────────────────────

// ── Coach Profile types ──────────────────────────────────────
interface CoachProfile {
  id: string;
  name: string;
  role: "head" | "assistant";
  groups: GroupId[];
  email: string;
  pin: string;
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
  SCHEDULES: "apex-athlete-schedules-v1",
  WELLNESS: "apex-athlete-wellness-v1",
  MEETS: "apex-meets-v1",
  LAST_SESSION: "apex-athlete-last-session-v1",
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
  teamName: "Saint Andrew's Aquatics",
  mission: "Excellence Through Consistency",
  seasonalGoal: "90% attendance this month",
  goalTarget: 90, goalCurrent: 0,
  weeklyQuote: "Champions do extra. — Unknown",
};

/* ── standalone presentational components (outside main component to prevent re-render bugs) ── */

const Card = ({ children, className = "", glow = false, neon = false }: { children: React.ReactNode; className?: string; glow?: boolean; neon?: boolean }) => (
  <div className={`game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] ${glow ? "neon-pulse" : ""} ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}>{children}</div>
);

const BgOrbs = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="absolute inset-0 bg-[#06020f]" />
    <div className="absolute inset-0 data-grid-bg opacity-30" />
    <div className="nebula-1 absolute -top-[20%] left-[20%] w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.08)_0%,rgba(107,33,168,0.12)_30%,transparent_60%)]" />
    <div className="nebula-2 absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.1)_0%,rgba(0,240,255,0.04)_40%,transparent_60%)]" />
    <div className="nebula-3 absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(232,121,249,0.06)_0%,transparent_55%)]" />
    <div className="nebula-drift absolute top-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.05)_0%,transparent_55%)]" />
    <div className="scan-line absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff]/20 to-transparent" />
  </div>
);

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
  const [leaderTab, setLeaderTab] = useState<"all" | "M" | "F">("all");
  const [view, setView] = useState<"coach" | "parent" | "audit" | "analytics" | "schedule" | "wellness" | "staff" | "meets" | "comms">("coach");
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
  const [selectedGroup, setSelectedGroup] = useState<GroupId>("platinum");
  const [mounted, setMounted] = useState(false);
  const [levelUpName, setLevelUpName] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<string>("");
  const [xpFloats, setXpFloats] = useState<{ id: string; xp: number; x: number; y: number }[]>([]);
  const floatCounter = useRef(0);

  // ── bulk undo state ────────────────────────────────────
  const [bulkUndoVisible, setBulkUndoVisible] = useState(false);
  const [bulkUndoSnapshot, setBulkUndoSnapshot] = useState<Athlete[] | null>(null);
  const bulkUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── more menu & confirm dialog ─────────────────────────
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void } | null>(null);

  // ── schedule state ──────────────────────────────────────
  const [schedules, setSchedules] = useState<GroupSchedule[]>([]);
  const [scheduleGroup, setScheduleGroup] = useState<GroupId>("platinum");
  const [editingSession, setEditingSession] = useState<{ day: DayOfWeek; sessionIdx: number } | null>(null);
  const [scheduleEditMode, setScheduleEditMode] = useState(false);

  // ── coach management state ──────────────────────────────
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [addCoachOpen, setAddCoachOpen] = useState(false);
  const [newCoachName, setNewCoachName] = useState("");
  const [newCoachRole, setNewCoachRole] = useState<"head" | "assistant">("assistant");
  const [newCoachGroups, setNewCoachGroups] = useState<GroupId[]>([]);
  const [newCoachEmail, setNewCoachEmail] = useState("");
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);

  // ── meets & comms state ─────────────────────────────────
  const [meets, setMeets] = useState<SwimMeet[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [newMeetName, setNewMeetName] = useState("");
  const [newMeetDate, setNewMeetDate] = useState("");
  const [newMeetLocation, setNewMeetLocation] = useState("");
  const [newMeetCourse, setNewMeetCourse] = useState<"SCY" | "SCM" | "LCM">("SCY");
  const [newMeetDeadline, setNewMeetDeadline] = useState("");
  const [editingMeetId, setEditingMeetId] = useState<string | null>(null);
  const [meetEventPicker, setMeetEventPicker] = useState<string | null>(null);

  // ── comms state (must be at top level — hooks cannot be inside conditionals) ──
  const [allBroadcasts, setAllBroadcasts] = useState<{ id: string; message: string; timestamp: string; from: string; group: string }[]>([]);
  const [commsMsg, setCommsMsg] = useState("");
  const [commsGroup, setCommsGroup] = useState<"all" | GroupId>("all");
  const [absenceReports, setAbsenceReports] = useState<{ id: string; athleteId: string; athleteName: string; reason: string; dateStart: string; dateEnd: string; note: string; submitted: string; group: string }[]>([]);

  // ── push notification state ──────────────────────────────
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // ── mount & load ─────────────────────────────────────────
  useEffect(() => {
    const pin = load<string>(K.PIN, "");
    if (!pin || pin === "1234") { setCoachPin("2451"); save(K.PIN, "2451"); } else { setCoachPin(pin); }
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
    // Auto-snapshot previous session before clearing (if any check-ins exist from a past day)
    const anyPastCheckins = r.some(a => a.dailyXP && a.dailyXP.date && a.dailyXP.date !== today() && (a.present || Object.values(a.checkpoints || {}).some(Boolean) || Object.values(a.weightCheckpoints || {}).some(Boolean) || Object.values(a.meetCheckpoints || {}).some(Boolean)));
    if (anyPastCheckins) {
      const prevDate = r.find(a => a.dailyXP?.date && a.dailyXP.date !== today())?.dailyXP?.date || today();
      const snaps = load<DailySnapshot[]>(K.SNAPSHOTS, []);
      if (!snaps.some(s => s.date === prevDate)) {
        const att = r.filter(a => a.present).length;
        snaps.push({
          date: prevDate, attendance: att, totalAthletes: r.length,
          totalXPAwarded: r.reduce((s, a) => s + ((a.dailyXP?.date === prevDate) ? (a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet) : 0), 0),
          poolCheckins: r.reduce((s, a) => s + Object.values(a.checkpoints || {}).filter(Boolean).length, 0),
          weightCheckins: r.reduce((s, a) => s + Object.values(a.weightCheckpoints || {}).filter(Boolean).length, 0),
          meetCheckins: r.reduce((s, a) => s + Object.values(a.meetCheckpoints || {}).filter(Boolean).length, 0),
          questsCompleted: 0, challengesCompleted: 0,
          athleteXPs: Object.fromEntries(r.map(a => [a.id, (a.dailyXP?.date === prevDate) ? (a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet) : 0])),
          athleteStreaks: Object.fromEntries(r.map(a => [a.id, a.streak || 0])),
        });
        save(K.SNAPSHOTS, snaps);
      }
    }
    r = r.map(a => {
      // Ensure new fields exist for legacy data
      if (!a.lastStreakDate) a = { ...a, lastStreakDate: "" };
      if (!a.lastWeightStreakDate) a = { ...a, lastWeightStreakDate: "" };
      if (!a.group) a = { ...a, group: "platinum" };
      // Reset daily XP + check-ins for new day (clean slate per practice)
      if (!a.dailyXP) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 }, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {} };
      else if (a.dailyXP.date !== today()) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 }, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {} };
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
    // Load coaches
    const savedCoaches = load<CoachProfile[]>(K.COACHES, []);
    setCoaches(savedCoaches);
    // Load meets
    setMeets(load<SwimMeet[]>(K.MEETS, []));
    // Load broadcasts + absence reports
    try { setAllBroadcasts(JSON.parse(localStorage.getItem("apex-broadcasts-v1") || "[]")); } catch { /* empty */ }
    try { setAbsenceReports(JSON.parse(localStorage.getItem("apex-absences-v1") || "[]")); } catch { /* empty */ }
    // Check push notification status
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushEnabled(!!sub);
        });
      });
    }
    setMounted(true);
  }, []);

  // ── push notification helpers ──────────────────────────────
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BHgOaNL7hhbIUOL6ThAyhrFtFQor9IxAM_l3gYaIJ9mQlzocIhJY5bHXEdkPqZvg2FGlOnXBwXBBeWGNKrcEM5g";

  const togglePushNotifications = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        setPushEnabled(false);
      } else {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON(), userId: pinInput || "coach", group: selectedGroup }),
        });
        setPushEnabled(true);
      }
    } catch (err) {
      console.error("Push notification error:", err);
    } finally {
      setPushLoading(false);
    }
  }, [pinInput, selectedGroup]);

  const sendPushToGroup = useCallback(async (title: string, body: string, group?: string) => {
    try {
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, group }),
      });
    } catch (err) {
      console.error("Send push error:", err);
    }
  }, []);

  // ── auto-session detection: reset check-ins for new practice ──
  useEffect(() => {
    if (!mounted || roster.length === 0) return;
    const sessionKey = `${today()}-${sessionTime}-${selectedGroup}`;
    const lastSession = load<string>(K.LAST_SESSION, "");
    if (lastSession && lastSession !== sessionKey) {
      // New session detected — snapshot old data, then clear present + checkpoints for this group
      const groupRoster = roster.filter(a => a.group === selectedGroup);
      const hadCheckins = groupRoster.some(a => a.present || Object.values(a.checkpoints || {}).some(Boolean) || Object.values(a.weightCheckpoints || {}).some(Boolean));
      if (hadCheckins) {
        // Save snapshot before clearing
        const snaps = load<DailySnapshot[]>(K.SNAPSHOTS, []);
        const prevDate = lastSession.split("-").slice(0, 3).join("-") || today();
        if (!snaps.some(s => s.date === prevDate)) {
          const att = groupRoster.filter(a => a.present).length;
          snaps.push({
            date: prevDate, attendance: att, totalAthletes: groupRoster.length,
            totalXPAwarded: groupRoster.reduce((s, a) => s + (a.dailyXP ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0),
            poolCheckins: groupRoster.reduce((s, a) => s + Object.values(a.checkpoints || {}).filter(Boolean).length, 0),
            weightCheckins: groupRoster.reduce((s, a) => s + Object.values(a.weightCheckpoints || {}).filter(Boolean).length, 0),
            meetCheckins: groupRoster.reduce((s, a) => s + Object.values(a.meetCheckpoints || {}).filter(Boolean).length, 0),
            questsCompleted: 0, challengesCompleted: 0,
            athleteXPs: Object.fromEntries(groupRoster.map(a => [a.id, a.dailyXP ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0])),
            athleteStreaks: Object.fromEntries(groupRoster.map(a => [a.id, a.streak || 0])),
          });
          save(K.SNAPSHOTS, snaps);
        }
      }
      const cleared = roster.map(a => a.group !== selectedGroup ? a : ({
        ...a, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {},
      }));
      saveRoster(cleared);
    }
    save(K.LAST_SESSION, sessionKey);
  }, [mounted, sessionTime, selectedGroup]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const saveSchedules = useCallback((s: GroupSchedule[]) => { setSchedules(s); save(K.SCHEDULES, s); }, []);

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

  // ── quest: coach assigns (pending→active) or approves (submitted→done) ──
  const cycleQuest = useCallback((athleteId: string, qId: string, qXP: number, e?: React.MouseEvent) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      let a = { ...prev[idx], quests: { ...prev[idx].quests } };
      const cur = a.quests[qId] || "pending";
      // Coach flow: pending → active (assign), submitted → done (approve)
      const next: "active" | "submitted" | "done" | "pending" =
        cur === "pending" ? "active" :
        cur === "submitted" ? "done" :
        cur === "active" ? "done" : // fallback: coach can still approve directly
        "pending";
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

  // ── quest deny (reset to active so athlete can re-submit) ──
  const denyQuest = useCallback((athleteId: string, qId: string) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const a = { ...prev[idx], quests: { ...prev[idx].quests } };
      a.quests[qId] = "active"; // back to active, not pending — quest stays assigned
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

  // ── attendance toggle (per-athlete, no expansion needed) ─
  // Present = auto-check Tier 1 (basics) + base XP. Coach manually awards Tier 2.
  const togglePresent = useCallback((athleteId: string) => {
    const gDef = ROSTER_GROUPS.find(g => g.id === selectedGroup) || ROSTER_GROUPS[0];
    const sportCPs = sessionMode === "pool" ? getCPsForSport(gDef.sport) : sessionMode === "weight" ? WEIGHT_CPS : MEET_CPS;
    // For pool: only auto-check Tier 1 IDs. For weight/meet: auto-check all (smaller lists).
    const autoCPs = sessionMode === "pool" ? sportCPs.filter(cp => AUTO_CHECK_IDS.has(cp.id)) : sportCPs;
    const cpMapKey = sessionMode === "pool" ? "checkpoints" : sessionMode === "weight" ? "weightCheckpoints" : "meetCheckpoints";
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const wasPresent = prev[idx].present;
      let a = { ...prev[idx] };

      if (!wasPresent) {
        // MARKING PRESENT → auto-check Tier 1 checkpoints + award XP
        a.present = true;
        const newCPs: Record<string, boolean> = { ...a[cpMapKey] };
        let totalAwarded = 0;
        // Award base "showed up" XP
        const { newAthlete: a1, awarded: baseAwarded } = awardXP(a, PRESENT_XP, sessionMode === "meet" ? "meet" : sessionMode);
        a = { ...a1 };
        totalAwarded += baseAwarded;
        // Auto-check only Tier 1 checkpoints
        for (const cp of autoCPs) {
          if (!newCPs[cp.id]) {
            newCPs[cp.id] = true;
            const { newAthlete: aN, awarded } = awardXP(a, cp.xp, sessionMode === "meet" ? "meet" : sessionMode);
            a = { ...aN };
            totalAwarded += awarded;
          }
        }
        a = { ...a, [cpMapKey]: newCPs };
        // Streak increment (once per day)
        const streakAlreadyCounted = a.lastStreakDate === today();
        if (!streakAlreadyCounted) {
          a = { ...a, streak: a.streak + 1, lastStreakDate: today(), totalPractices: a.totalPractices + 1, weekSessions: a.weekSessions + 1 };
        }
        addAudit(a.id, a.name, `Present (basics auto-checked)`, totalAwarded);
      } else {
        // MARKING ABSENT → uncheck ALL checkpoints (Tier 1 + any manual Tier 2) + revert XP
        a.present = false;
        const oldCPs: Record<string, boolean> = { ...a[cpMapKey] };
        const mult = sessionMode === "weight" ? getWeightStreakMult(a.weightStreak) : getStreakMult(a.streak);
        let totalReverted = 0;
        for (const cp of sportCPs) {
          if (oldCPs[cp.id]) {
            oldCPs[cp.id] = false;
            const reverted = Math.round(cp.xp * mult);
            a.xp = Math.max(0, a.xp - reverted);
            if (a.dailyXP.date === today()) {
              const cat = sessionMode === "meet" ? "meet" : sessionMode;
              a.dailyXP = { ...a.dailyXP, [cat]: Math.max(0, a.dailyXP[cat] - reverted) };
            }
            totalReverted += reverted;
          }
        }
        // Revert base present XP
        const baseReverted = Math.round(PRESENT_XP * mult);
        a.xp = Math.max(0, a.xp - baseReverted);
        if (a.dailyXP.date === today()) {
          const cat = sessionMode === "meet" ? "meet" : sessionMode;
          a.dailyXP = { ...a.dailyXP, [cat]: Math.max(0, a.dailyXP[cat] - baseReverted) };
        }
        totalReverted += baseReverted;
        a = { ...a, [cpMapKey]: oldCPs };
        addAudit(a.id, a.name, `Absent (checkpoints cleared)`, -totalReverted);
      }
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); return r;
    });
  }, [addAudit, awardXP, selectedGroup, sessionMode]);

  // ── shoutout / MVP — coach recognition for standout moments ─
  const giveShoutout = useCallback((athleteId: string, e?: React.MouseEvent) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const a = { ...prev[idx] };
      const { newAthlete, awarded } = awardXP(a, SHOUTOUT_XP, "pool");
      addAudit(newAthlete.id, newAthlete.name, "Shoutout", awarded);
      if (e) spawnXpFloat(awarded, e);
      const r = [...prev]; r[idx] = newAthlete; save(K.ROSTER, r); return r;
    });
  }, [awardXP, addAudit, spawnXpFloat]);

  // ── coach tools ──────────────────────────────────────────
  const bulkMarkPresent = useCallback(() => {
    // Save snapshot for timed undo
    setBulkUndoSnapshot(roster.map(a => ({ ...a })));
    if (bulkUndoTimer.current) clearTimeout(bulkUndoTimer.current);
    setBulkUndoVisible(true);
    bulkUndoTimer.current = setTimeout(() => { setBulkUndoVisible(false); setBulkUndoSnapshot(null); }, 10000);

    const gDef = ROSTER_GROUPS.find(g => g.id === selectedGroup) || ROSTER_GROUPS[0];
    const sportCPs = sessionMode === "pool" ? getCPsForSport(gDef.sport) : sessionMode === "weight" ? WEIGHT_CPS : MEET_CPS;
    // For pool: only auto-check Tier 1 IDs. For weight/meet: auto-check all.
    const autoCPs = sessionMode === "pool" ? sportCPs.filter(cp => AUTO_CHECK_IDS.has(cp.id)) : sportCPs;
    const cpMapKey = sessionMode === "pool" ? "checkpoints" : sessionMode === "weight" ? "weightCheckpoints" : "meetCheckpoints";
    setRoster(prev => {
      const r = prev.map(a => {
        if (a.group !== selectedGroup) return a;
        let athlete = { ...a };
        athlete.present = true;
        const newCPs: Record<string, boolean> = { ...athlete[cpMapKey] };
        let totalAwarded = 0;
        // Base present XP
        const { newAthlete: a1, awarded: baseAwarded } = awardXP(athlete, PRESENT_XP, sessionMode === "meet" ? "meet" : sessionMode);
        athlete = { ...a1 };
        totalAwarded += baseAwarded;
        // Auto-check only Tier 1 checkpoints
        for (const cp of autoCPs) {
          if (!newCPs[cp.id]) {
            newCPs[cp.id] = true;
            const { newAthlete: aN, awarded } = awardXP(athlete, cp.xp, sessionMode === "meet" ? "meet" : sessionMode);
            athlete = { ...aN };
            totalAwarded += awarded;
          }
        }
        athlete = { ...athlete, [cpMapKey]: newCPs };
        addAudit(athlete.id, athlete.name, `Bulk: basics auto-checked`, totalAwarded);
        const streakAlreadyCounted = a.lastStreakDate === today();
        if (!streakAlreadyCounted) {
          athlete = { ...athlete, streak: athlete.streak + 1, lastStreakDate: today(), totalPractices: athlete.totalPractices + 1, weekSessions: athlete.weekSessions + 1 };
        }
        return athlete;
      });
      save(K.ROSTER, r); return r;
    });
  }, [awardXP, addAudit, selectedGroup, roster, sessionMode]);

  const bulkUndoAll = useCallback(() => {
    if (!bulkUndoSnapshot) return;
    setRoster(bulkUndoSnapshot);
    save(K.ROSTER, bulkUndoSnapshot);
    addAudit("system", "System", "Bulk check-in undone", 0);
    setBulkUndoVisible(false);
    setBulkUndoSnapshot(null);
    if (bulkUndoTimer.current) clearTimeout(bulkUndoTimer.current);
  }, [bulkUndoSnapshot, addAudit]);

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
    saveRoster(roster.map(a => a.group !== selectedGroup ? a : ({ ...a, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster, selectedGroup]);

  const resetWeek = useCallback(() => {
    saveRoster(roster.map(a => a.group !== selectedGroup ? a : ({ ...a, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, weightChallenges: {}, weekSessions: 0, weekWeightSessions: 0, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster, selectedGroup]);

  const resetMonth = useCallback(() => {
    saveRoster(roster.map(a => a.group !== selectedGroup ? a : ({ ...a, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {}, weightChallenges: {}, quests: {}, weekSessions: 0, weekWeightSessions: 0, streak: 0, weightStreak: 0, lastStreakDate: "", lastWeightStreakDate: "", dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 } })));
  }, [roster, saveRoster, selectedGroup]);

  // ── group switching ─────────────────────────────────────
  const switchGroup = useCallback((g: GroupId) => { setSelectedGroup(g); save(K.GROUP, g); setExpandedId(null); }, []);
  const currentGroupDef = ROSTER_GROUPS.find(g => g.id === selectedGroup) || ROSTER_GROUPS[0];

  // ── coach management ──────────────────────────────────
  const saveCoaches = useCallback((c: CoachProfile[]) => { setCoaches(c); save(K.COACHES, c); }, []);

  const addCoach = useCallback(() => {
    if (!newCoachName.trim()) return;
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    const coach: CoachProfile = {
      id: `coach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newCoachName.trim(),
      role: newCoachRole,
      groups: newCoachRole === "head" ? ROSTER_GROUPS.map(g => g.id) : newCoachGroups,
      email: newCoachEmail.trim(),
      pin,
    };
    saveCoaches([...coaches, coach]);
    setNewCoachName(""); setNewCoachRole("assistant"); setNewCoachGroups([]); setNewCoachEmail(""); setAddCoachOpen(false);
    addAudit("system", "System", `Added coach: ${coach.name} (${coach.role})`, 0);
  }, [newCoachName, newCoachRole, newCoachGroups, newCoachEmail, coaches, saveCoaches, addAudit]);

  const removeCoach = useCallback((id: string) => {
    const c = coaches.find(x => x.id === id);
    if (!c) return;
    saveCoaches(coaches.filter(x => x.id !== id));
    addAudit("system", "System", `Removed coach: ${c.name}`, 0);
  }, [coaches, saveCoaches, addAudit]);

  const updateCoach = useCallback((id: string, updates: Partial<CoachProfile>) => {
    saveCoaches(coaches.map(c => c.id === id ? { ...c, ...updates } : c));
    setEditingCoachId(null);
  }, [coaches, saveCoaches]);

  const toggleCoachGroup = useCallback((gid: GroupId) => {
    setNewCoachGroups(prev => prev.includes(gid) ? prev.filter(g => g !== gid) : [...prev, gid]);
  }, []);

  // Current coach's accessible groups (for access control)
  // Head coach / admin (master PIN) sees all groups; assistant coaches see only their assigned groups
  const currentCoach = useMemo(() => {
    if (pinInput === coachPin) return null; // master PIN = admin/head coach
    return coaches.find(c => c.pin === pinInput);
  }, [pinInput, coachPin, coaches]);

  const accessibleGroups = useMemo(() => {
    // Master PIN or no coaches configured = all groups
    if (!currentCoach) return ROSTER_GROUPS.map(g => g.id);
    if (currentCoach.role === "head") return ROSTER_GROUPS.map(g => g.id);
    return currentCoach.groups;
  }, [currentCoach]);

  const addAthleteAction = useCallback(() => {
    if (!newAthleteName.trim() || !newAthleteAge) return;
    const a = makeAthlete({ name: newAthleteName.trim(), age: parseInt(newAthleteAge), gender: newAthleteGender, group: selectedGroup });
    saveRoster([...roster, a]);
    setNewAthleteName(""); setNewAthleteAge(""); setAddAthleteOpen(false);
    addAudit(a.id, a.name, `Added to ${currentGroupDef.name}`, 0);
  }, [newAthleteName, newAthleteAge, newAthleteGender, roster, saveRoster, addAudit, selectedGroup, currentGroupDef]);

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

  // Card and BgOrbs are defined outside the component to prevent re-render issues

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

  if (!mounted) return (
    <div className="min-h-screen bg-[#06020f] flex items-center justify-center relative">
      <BgOrbs />
      <div className="text-center relative z-10">
        <div className="neon-text-cyan text-sm font-mono tracking-wider opacity-60">INITIALIZING...</div>
      </div>
    </div>
  );

  // ── PIN gate ─────────────────────────────────────────────
  const tryUnlock = () => {
    // Master PIN (admin/head coach)
    if (pinInput === coachPin) { setUnlocked(true); setPinError(false); return; }
    // Individual coach PINs
    const matchedCoach = coaches.find(c => c.pin === pinInput);
    if (matchedCoach) { setUnlocked(true); setPinError(false); return; }
    setPinError(true);
  };
  const resetPin = () => { setCoachPin("2451"); save(K.PIN, "2451"); setPinInput(""); setPinError(false); };

  if (!unlocked && (view === "coach" || view === "schedule" || view === "staff")) {
    return (
      <div className="min-h-screen bg-[#06020f] flex items-center justify-center p-6 relative overflow-hidden">
        <BgOrbs />
        <div className="text-center max-w-xs w-full relative z-10">
          {/* HUD access terminal */}
          <div className="game-panel game-panel-border relative bg-[#06020f]/90 p-10 mb-6">
            <div className="neon-text-cyan text-xs tracking-[0.5em] uppercase mb-2 font-bold opacity-60">Athlete Performance System</div>
            <h1 className="text-4xl font-black mb-2 tracking-tighter neon-text-cyan animated-gradient-text" style={{color: '#00f0ff', textShadow: '0 0 30px rgba(0,240,255,0.5), 0 0 60px rgba(168,85,247,0.3)'}}>Apex Athlete</h1>
            <div className="text-[#a855f7]/30 text-xs tracking-[0.3em] uppercase font-mono mb-8">// COACH ACCESS TERMINAL</div>
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
            {pinError && <p className="text-red-400 text-xs -mt-2 font-mono">ACCESS DENIED. Default: 2451.</p>}
            <button onClick={tryUnlock}
              className="game-btn w-full py-4 bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_30px_rgba(0,240,255,0.3)] transition-all active:scale-[0.97] min-h-[52px]">
              Authenticate
            </button>
            <a href="/apex-athlete/parent"
              className="text-[#00f0ff]/20 text-xs hover:text-[#00f0ff]/50 transition-colors mt-2 min-h-[44px] font-mono tracking-wider uppercase block text-center">
              Parent / Read-Only Access
            </a>
            {pinError && (
              <button onClick={resetPin} className="text-white/50 text-xs hover:text-white/60 transition-colors font-mono">
                RESET PIN → 2451
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── shared game HUD header (used by ALL views) ─────────
  const GameHUDHeader = () => {
    const presentCount = filteredRoster.filter(a => a.present || Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)).length;
    const xpToday = filteredRoster.reduce((s, a) => s + (a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0);
    const secondaryTabs = [
      { id: "coach" as const, label: "Check-In" },
      { id: "meets" as const, label: "Meets" },
      { id: "comms" as const, label: "Comms" },
      { id: "analytics" as const, label: "Analytics" },
      { id: "schedule" as const, label: "Schedule" },
      { id: "audit" as const, label: "Audit" },
    ];
    return (
      <div className="w-full relative mb-4">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff]/60 to-transparent" />

        <div className="pt-6 pb-2">
          {/* Title row — compact */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.04em] leading-none" style={{
              background: 'linear-gradient(135deg, #00f0ff 0%, #a855f7 40%, #00f0ff 60%, #e879f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 200%',
              animation: 'gradientShift 4s ease-in-out infinite',
              filter: 'drop-shadow(0 0 30px rgba(0,240,255,0.3))'
            }}>
              APEX ATHLETE
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={togglePushNotifications} disabled={pushLoading}
                className={`game-btn w-10 h-10 flex items-center justify-center text-sm transition-all ${
                  pushEnabled ? "text-[#00f0ff] border border-[#00f0ff]/30" : "text-white/60 border border-white/[0.06] hover:text-[#00f0ff]/60"
                }`} title={pushEnabled ? "Notifications ON" : "Enable notifications"}>
                {pushLoading ? "..." : pushEnabled ? "🔔" : "🔕"}
              </button>
              {view === "coach" && (
                <button onClick={() => { if (editingCulture) saveCulture(culture); setEditingCulture(!editingCulture); }}
                  className="game-btn w-10 h-10 flex items-center justify-center text-xs font-mono tracking-wider uppercase text-white/60 border border-white/[0.06] hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20 transition-all">
                  {editingCulture ? "✓" : "✎"}
                </button>
              )}
            </div>
          </div>

          {/* Section nav tabs — 2 rows on mobile, single row on tablet+ */}
          <div className="md:hidden space-y-2 mb-4">
            <div className="grid grid-cols-3 gap-2">
              {secondaryTabs.slice(0, 3).map(t => {
                const active = view === t.id;
                return (
                  <button key={t.id} onClick={() => setView(t.id)}
                    className={`py-3 text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[46px] text-center ${
                      active
                        ? "bg-[#00f0ff]/12 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.15)]"
                        : "bg-[#06020f]/60 text-white/50 border border-white/[0.06] hover:text-white/70 hover:border-white/15 active:scale-[0.97]"
                    }`}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondaryTabs.slice(3).map(t => {
                const active = view === t.id;
                return (
                  <button key={t.id} onClick={() => setView(t.id)}
                    className={`py-3 text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[46px] text-center ${
                      active
                        ? "bg-[#a855f7]/12 text-[#a855f7] border-2 border-[#a855f7]/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                        : "bg-[#06020f]/60 text-white/50 border border-white/[0.06] hover:text-white/70 hover:border-white/15 active:scale-[0.97]"
                    }`}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="hidden md:grid grid-cols-6 gap-2 mb-4">
            {secondaryTabs.map(t => {
              const active = view === t.id;
              return (
                <button key={t.id} onClick={() => setView(t.id)}
                  className={`py-3 text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[46px] text-center ${
                    active
                      ? "bg-[#00f0ff]/12 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.15)]"
                      : "bg-[#06020f]/60 text-white/50 border border-white/[0.06] hover:text-white/70 hover:border-white/15 active:scale-[0.97]"
                  }`}>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Team identity — inline compact */}
          <div className="flex items-center gap-3 px-1 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f59e0b]/20 to-[#6b21a8]/20 border border-[#f59e0b]/30 flex items-center justify-center shrink-0">
              <span className="text-[#f59e0b] text-sm font-black">SA</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-white/70 font-bold text-sm">{culture.teamName}</span>
              <span className="text-[#f59e0b]/30 text-xs ml-2 font-mono italic hidden sm:inline">{culture.mission}</span>
            </div>
          </div>

          {/* Season goal — minimal */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-[#00f0ff]/20 text-xs font-mono uppercase tracking-wider shrink-0">{culture.seasonalGoal}</span>
            <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden xp-bar-segments">
              <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${Math.min(100, (culture.goalCurrent / culture.goalTarget) * 100)}%` }} />
            </div>
            <span className="text-[#f59e0b]/50 text-xs font-bold font-mono tabular-nums whitespace-nowrap shrink-0">{culture.goalCurrent}%</span>
          </div>
        </div>

        {/* Live HUD data strip — compact */}
        <div className="relative border-y border-[#00f0ff]/10 bg-[#06020f]/90 backdrop-blur-xl">
          <div className="flex items-center justify-center gap-5 py-2.5 px-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${presentCount > 0 ? "bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.6)]" : "bg-white/10"}`} />
              <span className="neon-text-cyan text-xs font-bold font-mono tabular-nums">{presentCount}<span className="text-white/50 font-normal">/{roster.length}</span></span>
            </div>
            <div className="w-px h-3 bg-[#00f0ff]/10" />
            <div className="flex items-center gap-1.5">
              <span className="neon-text-gold text-xs font-bold font-mono tabular-nums">{xpToday}</span>
              <span className="text-[#f59e0b]/30 text-xs font-mono uppercase">XP</span>
            </div>
            <div className="w-px h-3 bg-[#00f0ff]/10" />
            <span className="text-[#00f0ff]/40 text-xs font-mono">{sessionMode === "pool" ? (currentSport === "diving" ? "🤿 BOARD" : currentSport === "waterpolo" ? "🤽 POOL" : "🏊 POOL") : sessionMode === "weight" ? "🏋️ WEIGHT" : "🏁 MEET"}</span>
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
            className="text-white/60 text-xs hover:text-white/50 px-3 py-1.5 rounded-lg border border-white/[0.06] transition-colors min-h-[36px]">
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
          <span className="text-[#f59e0b] font-bold">{culture.goalCurrent}%<span className="text-white/60">/{culture.goalTarget}%</span></span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${Math.min(100, (culture.goalCurrent / culture.goalTarget) * 100)}%` }} />
        </div>
      </div>
      <div className="border-t border-white/[0.04] pt-3">
        {editingCulture ? (
          <input value={culture.weeklyQuote} onChange={e => setCulture({ ...culture, weeklyQuote: e.target.value })}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white/60 text-sm italic w-full focus:outline-none" />
        ) : (
          <p className="text-white/60 text-sm italic text-center">&ldquo;{culture.weeklyQuote}&rdquo;</p>
        )}
      </div>
      {editingCulture && (
        <div className="mt-3 flex gap-3 text-xs items-center">
          <label className="text-white/60">Goal %: <input type="number" value={culture.goalTarget}
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
    const cps = sessionMode === "pool" ? currentCPs : sessionMode === "weight" ? WEIGHT_CPS : MEET_CPS;
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
                <span className="text-white/60 text-xs">{athlete.age}y · {athlete.gender}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>
                  {lv.icon} {lv.name}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">
                  {sk.label} · {sk.mult}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/60 font-bold">{athlete.xp} XP</span>
                  <span className="text-white/60">{nxt ? `${prog.remaining} to ${nxt.name}` : "MAX LEVEL"}</span>
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
              <div className="text-white/60 text-xs uppercase tracking-wider font-medium mt-0.5">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Daily cap */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">Daily XP:</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${dailyUsed >= DAILY_XP_CAP ? "bg-red-500" : "bg-[#6b21a8]"}`} style={{ width: `${(dailyUsed / DAILY_XP_CAP) * 100}%` }} />
          </div>
          <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${dailyUsed >= DAILY_XP_CAP ? "text-red-400" : "text-white/60"}`}>{dailyUsed}/{DAILY_XP_CAP}</span>
        </div>

        {/* Streaks */}
        <div className="flex gap-3">
          <Card className="flex-1 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white/60 text-xs uppercase tracking-wider">Pool Streak</div>
              <div className="text-white font-bold">{athlete.streak}d <span className="text-[#a855f7] text-xs">{sk.label}</span></div>
            </div>
            <span className="text-[#a855f7] font-bold text-sm">{sk.mult}</span>
          </Card>
          <Card className="flex-1 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white/60 text-xs uppercase tracking-wider">Weight Streak</div>
              <div className="text-white font-bold">{athlete.weightStreak}d <span className="text-[#f59e0b] text-xs">{wsk.label}</span></div>
            </div>
            <span className="text-[#f59e0b] font-bold text-sm">{wsk.mult}</span>
          </Card>
        </div>

        {/* Daily Check-In — auto-checked basics the coach can deselect */}
        {sessionMode === "pool" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold">Daily Check-In</h4>
              <span className={`text-xs font-bold tabular-nums ${athlete.present ? "text-emerald-400" : "text-white/30"}`}>{dailyUsed} xp today</span>
            </div>
            {!athlete.present && (
              <Card className="px-5 py-4">
                <div className="text-white/40 text-sm text-center">Tap present on the roster to check in</div>
              </Card>
            )}
            {athlete.present && (
              <Card className="divide-y divide-white/[0.04]">
                {AUTO_POOL_CPS.map(cp => {
                  const done = cpMap[cp.id];
                  return (
                    <button key={cp.id} onClick={(e) => toggleCheckpoint(athlete.id, cp.id, cp.xp, "pool", e)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors min-h-[52px] ${
                        done ? "bg-emerald-500/5" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        done ? "border-emerald-400 bg-emerald-500" : "border-white/15"
                      }`}>
                        {done && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">{cp.name}</div>
                        <div className="text-white/40 text-[11px]">{cp.desc}</div>
                      </div>
                      <span className={`text-xs font-bold ${done ? "text-emerald-400" : "text-white/30"}`}>+{cp.xp}</span>
                    </button>
                  );
                })}
              </Card>
            )}
          </div>
        )}

        {/* Standout awards — manual checkpoints coach taps for exceptional behavior */}
        {sessionMode === "pool" && (
          <div>
            <h4 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">Standout Awards</h4>
            <Card className="divide-y divide-white/[0.04]">
              {MANUAL_POOL_CPS.map(cp => {
                const done = cpMap[cp.id];
                return (
                  <button key={cp.id} onClick={(e) => toggleCheckpoint(athlete.id, cp.id, cp.xp, "pool", e)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors min-h-[52px] ${
                      done ? "bg-[#a855f7]/5" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      done ? "border-[#a855f7] bg-[#a855f7]" : "border-white/15"
                    }`}>
                      {done && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{cp.name}</div>
                      <div className="text-white/40 text-[11px]">{cp.desc}</div>
                    </div>
                    <span className={`text-xs font-bold ${done ? "text-[#a855f7]" : "text-white/30"}`}>+{cp.xp}</span>
                  </button>
                );
              })}
            </Card>
          </div>
        )}

        {/* Shoutout — coach recognition for standout moments */}
        <button
          onClick={(e) => giveShoutout(athlete.id, e)}
          className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-gradient-to-r from-[#f59e0b]/10 to-[#fbbf24]/10 border border-[#f59e0b]/20 hover:border-[#f59e0b]/40 hover:from-[#f59e0b]/15 hover:to-[#fbbf24]/15 transition-all active:scale-[0.98] min-h-[56px]"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.4 4.8L18 7.6l-4 3.9.9 5.5L10 14.5 5.1 17l.9-5.5-4-3.9 5.6-.8L10 2z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"/></svg>
          <span className="text-[#f59e0b] font-bold text-sm">Shoutout</span>
          <span className="text-[#f59e0b]/60 text-xs font-mono">+{SHOUTOUT_XP} xp</span>
        </button>

        {/* Weight challenges */}
        {sessionMode === "weight" && (
          <div>
            <h4 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">Weight Challenges</h4>
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
                      <div className="text-white/60 text-[11px]">{ch.desc}</div>
                    </div>
                    <span className={`text-xs font-bold ${done ? "text-[#f59e0b]" : "text-white/60"}`}>+{ch.xp} xp</span>
                  </button>
                );
              })}
            </Card>
          </div>
        )}

        {/* Side quests — Coach assigns, athlete completes, coach approves */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold">Side Quests</h4>
              {Object.values(athlete.quests).filter(q => q === "submitted").length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 animate-pulse">
                  {Object.values(athlete.quests).filter(q => q === "submitted").length} to review
                </span>
              )}
            </div>
            <span className="text-white/25 text-xs font-mono">{Object.values(athlete.quests).filter(q => q === "done").length}/{QUEST_DEFS.length} done</span>
          </div>
          <Card className="divide-y divide-white/[0.04]">
            {QUEST_DEFS.map(q => {
              const st = athlete.quests[q.id] || "pending";
              return (
                <div key={q.id}
                  className={`w-full px-5 py-4 transition-colors ${
                    st === "done" ? "bg-emerald-500/5" : st === "submitted" ? "bg-[#f59e0b]/5 border-l-2 border-l-[#f59e0b]/40" : st === "active" ? "bg-[#6b21a8]/5" : "bg-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      st === "done" ? "border-emerald-400 bg-emerald-400/20" : st === "submitted" ? "border-[#f59e0b] bg-[#f59e0b]/20" : st === "active" ? "border-[#a855f7] bg-[#a855f7]/20" : "border-white/15"
                    }`}>
                      {st === "done" ? (
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : st === "submitted" ? (
                        <svg className="w-3.5 h-3.5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" /></svg>
                      ) : st === "active" ? (
                        <svg className="w-3.5 h-3.5 text-[#a855f7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9" strokeWidth="2"/></svg>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-medium">{q.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${CAT_COLORS[q.cat] || "bg-white/10 text-white/40"}`}>
                          {q.cat}
                        </span>
                      </div>
                      <div className="text-white/40 text-xs mt-1">{q.desc}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs font-mono tracking-wider ${
                          st === "done" ? "text-emerald-400/70" : st === "submitted" ? "text-[#f59e0b]/70" : st === "active" ? "text-[#a855f7]/70" : "text-white/25"
                        }`}>
                          {st === "done" ? "Completed" : st === "submitted" ? "Submitted — review now" : st === "active" ? "In progress" : "Not assigned"}
                        </span>
                        <span className={`text-xs font-bold font-mono ${st === "done" ? "text-emerald-400/60" : "text-white/20"}`}>+{q.xp} xp</span>
                      </div>
                      {st === "submitted" && athlete.questNotes?.[q.id] && (
                        <div className="mt-2 p-2 rounded-lg bg-[#f59e0b]/5 border border-[#f59e0b]/15">
                          <span className="text-[#f59e0b]/60 text-[10px] uppercase tracking-wider font-bold">Athlete notes:</span>
                          <p className="text-white/70 text-xs mt-0.5">{athlete.questNotes[q.id]}</p>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center">
                      {st === "pending" && (
                        <button
                          onClick={(e) => cycleQuest(athlete.id, q.id, q.xp, e)}
                          className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider min-h-[36px] bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/25 hover:bg-[#a855f7]/25 transition-all active:scale-[0.97]"
                        >
                          Assign
                        </button>
                      )}
                      {st === "submitted" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => cycleQuest(athlete.id, q.id, q.xp, e)}
                            className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider min-h-[36px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all active:scale-[0.97] animate-pulse"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => denyQuest(athlete.id, q.id)}
                            className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider min-h-[36px] bg-red-500/10 text-red-400/70 border border-red-500/15 hover:bg-red-500/20 transition-all active:scale-[0.97]"
                          >
                            Deny
                          </button>
                        </div>
                      )}
                      {st === "active" && (
                        <span className="px-3 py-2 rounded-lg text-xs font-mono tracking-wider text-[#a855f7]/50 border border-[#a855f7]/10">
                          Waiting
                        </span>
                      )}
                      {st === "done" && (
                        <span className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/15">
                          Done
                        </span>
                      )}
                    </div>
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

        {/* Personal growth */}
        {growth && (
          <Card className="p-6">
            <h4 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">You vs Last Month</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-black tabular-nums whitespace-nowrap ${growth.xpGain > 0 ? "text-emerald-400" : growth.xpGain < 0 ? "text-red-400" : "text-white/60"}`}>
                  {growth.xpGain > 0 ? "+" : ""}{growth.xpGain}
                </div>
                <div className="text-white/60 text-xs uppercase mt-1">XP Gained</div>
              </div>
              <div>
                <div className={`text-2xl font-black tabular-nums whitespace-nowrap ${growth.streakDelta > 0 ? "text-emerald-400" : growth.streakDelta < 0 ? "text-red-400" : "text-white/60"}`}>
                  {growth.streakDelta > 0 ? "+" : ""}{growth.streakDelta}d
                </div>
                <div className="text-white/60 text-xs uppercase mt-1">Streak</div>
              </div>
              <div>
                <div className="text-2xl font-black tabular-nums whitespace-nowrap text-white">{athlete.totalPractices}</div>
                <div className="text-white/60 text-xs uppercase mt-1">Total Sessions</div>
              </div>
            </div>
          </Card>
        )}

        {view === "coach" && (
          <button onClick={() => removeAthlete(athlete.id)} className="text-red-400/30 text-xs hover:text-red-400 transition-colors min-h-[36px] px-1">
            Remove Athlete
          </button>
        )}
      </div>
    );
  };

  // ── STAFF VIEW ───────────────────────────────────────────
  if (view === "staff") {
    // Only head coach / admin (master PIN) can manage staff
    const isAdmin = pinInput === coachPin || !currentCoach || (currentCoach && currentCoach.role === "head");
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Coach Staff</h2>
          <p className="text-[#00f0ff]/25 text-xs mb-8 font-mono">Manage coaching staff &amp; group access</p>

          {/* Current coaches list */}
          <div className="space-y-4 mb-8">
            {coaches.length === 0 && (
              <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl p-8 text-center">
                <p className="text-white/60 text-sm font-mono">No coaches added yet.</p>
                <p className="text-white/40 text-xs font-mono mt-2">Master PIN ({coachPin}) has full access to all groups.</p>
              </div>
            )}
            {coaches.map(c => {
              const isEditing = editingCoachId === c.id;
              return (
                <div key={c.id} className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border border-[#00f0ff]/10 p-5" style={{ isolation: 'isolate' }}>
                  <div className="relative z-[5] flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
                        c.role === "head" ? "bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b]" : "bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff]"
                      }`}>
                        {c.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">{c.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            c.role === "head" ? "bg-[#f59e0b]/15 text-[#f59e0b]" : "bg-[#00f0ff]/10 text-[#00f0ff]/70"
                          }`}>
                            {c.role === "head" ? "HEAD COACH" : "ASSISTANT"}
                          </span>
                          <span className="text-white/50 text-xs font-mono">PIN: {c.pin}</span>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => setEditingCoachId(isEditing ? null : c.id)}
                          className="game-btn px-3 py-1.5 text-xs font-mono tracking-wider text-white/60 border border-white/[0.06] hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20 transition-all min-h-[32px]">
                          {isEditing ? "CANCEL" : "EDIT"}
                        </button>
                        <button onClick={() => removeCoach(c.id)}
                          className="game-btn px-3 py-1.5 text-xs font-mono tracking-wider text-red-400/30 border border-red-400/10 hover:text-red-400/70 hover:border-red-400/30 transition-all min-h-[32px]">
                          REMOVE
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Group assignments */}
                  <div className="mt-3">
                    <span className="text-white/60 text-xs font-mono uppercase tracking-wider">Groups: </span>
                    {c.role === "head" ? (
                      <span className="text-[#f59e0b]/60 text-xs font-mono">ALL GROUPS (Head Coach)</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {ROSTER_GROUPS.map(g => {
                          const assigned = c.groups.includes(g.id);
                          if (isEditing) {
                            return (
                              <button key={g.id} onClick={() => {
                                const newGroups = assigned ? c.groups.filter(x => x !== g.id) : [...c.groups, g.id];
                                updateCoach(c.id, { groups: newGroups });
                                setEditingCoachId(c.id); // keep editing
                              }}
                                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all min-h-[28px] ${
                                  assigned
                                    ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                                    : "bg-white/[0.03] text-white/60 border border-white/[0.06] hover:border-[#00f0ff]/20"
                                }`}>
                                {g.icon} {g.name}
                              </button>
                            );
                          }
                          return assigned ? (
                            <span key={g.id} className="px-2.5 py-1 text-xs font-mono bg-[#00f0ff]/10 text-[#00f0ff]/60 rounded-md border border-[#00f0ff]/15">
                              {g.icon} {g.name}
                            </span>
                          ) : null;
                        })}
                        {c.groups.length === 0 && !isEditing && (
                          <span className="text-red-400/40 text-xs font-mono">No groups assigned</span>
                        )}
                      </div>
                    )}
                  </div>

                  {c.email && (
                    <div className="mt-2 text-white/50 text-xs font-mono">{c.email}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Coach Form */}
          {isAdmin && (
            <div className="mb-10">
              {!addCoachOpen ? (
                <button onClick={() => setAddCoachOpen(true)}
                  className="game-btn px-5 py-3 bg-gradient-to-r from-[#00f0ff]/15 to-[#a855f7]/15 border border-[#00f0ff]/20 text-[#00f0ff]/70 text-sm font-mono tracking-wider hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all min-h-[44px]">
                  + ADD COACH
                </button>
              ) : (
                <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border border-[#00f0ff]/20 p-6 space-y-4" style={{ isolation: 'isolate' }}>
                  <div className="relative z-[5] space-y-4">
                  <h3 className="text-[#00f0ff]/40 text-[11px] uppercase tracking-[0.2em] font-bold font-mono">// Add New Coach</h3>

                  <div>
                    <label className="text-white/60 text-xs font-mono uppercase tracking-wider block mb-1.5">Name</label>
                    <input value={newCoachName} onChange={e => setNewCoachName(e.target.value)}
                      placeholder="Coach name"
                      className="relative z-10 w-full bg-[#06020f]/80 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-[#00f0ff]/40 focus:ring-1 focus:ring-[#00f0ff]/20 transition-all min-h-[44px] font-mono"
                      style={{ fontSize: '16px', WebkitAppearance: 'none' }} />
                  </div>

                  <div>
                    <label className="text-white/60 text-xs font-mono uppercase tracking-wider block mb-1.5">Email (optional)</label>
                    <input value={newCoachEmail} onChange={e => setNewCoachEmail(e.target.value)}
                      placeholder="coach@email.com" type="email"
                      className="relative z-10 w-full bg-[#06020f]/80 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-[#00f0ff]/40 focus:ring-1 focus:ring-[#00f0ff]/20 transition-all min-h-[44px] font-mono"
                      style={{ fontSize: '16px', WebkitAppearance: 'none' }} />
                  </div>

                  <div>
                    <label className="text-white/60 text-xs font-mono uppercase tracking-wider block mb-1.5">Role</label>
                    <div className="flex gap-2">
                      {(["head", "assistant"] as const).map(r => (
                        <button key={r} onClick={() => setNewCoachRole(r)}
                          className={`game-btn flex-1 px-4 py-3 text-sm font-mono tracking-wider transition-all min-h-[44px] ${
                            newCoachRole === r
                              ? r === "head"
                                ? "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40"
                                : "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40"
                              : "bg-[#06020f]/60 text-white/60 border border-white/[0.08] hover:text-white/50"
                          }`}>
                          {r === "head" ? "HEAD COACH" : "ASSISTANT"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {newCoachRole === "assistant" && (
                    <div>
                      <label className="text-white/60 text-xs font-mono uppercase tracking-wider block mb-1.5">Assign Groups</label>
                      <div className="flex flex-wrap gap-2">
                        {ROSTER_GROUPS.map(g => (
                          <button key={g.id} onClick={() => toggleCoachGroup(g.id)}
                            className={`game-btn px-3 py-2 text-xs font-mono transition-all min-h-[36px] ${
                              newCoachGroups.includes(g.id)
                                ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                                : "bg-[#06020f]/60 text-white/60 border border-white/[0.06] hover:border-[#00f0ff]/20"
                            }`}>
                            {g.icon} {g.name}
                          </button>
                        ))}
                      </div>
                      {newCoachGroups.length === 0 && (
                        <p className="text-[#f59e0b]/40 text-xs font-mono mt-1">Select at least one group</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={addCoach}
                      disabled={!newCoachName.trim() || (newCoachRole === "assistant" && newCoachGroups.length === 0)}
                      className="game-btn flex-1 py-3 bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed">
                      ADD COACH
                    </button>
                    <button onClick={() => { setAddCoachOpen(false); setNewCoachName(""); setNewCoachEmail(""); setNewCoachRole("assistant"); setNewCoachGroups([]); }}
                      className="game-btn px-4 py-3 text-white/60 border border-white/[0.06] text-sm font-mono hover:text-white/40 transition-all min-h-[44px]">
                      CANCEL
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Access control info */}
          <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border border-[#a855f7]/10 p-5 mb-10">
            <h3 className="text-[#a855f7]/40 text-[11px] uppercase tracking-[0.2em] font-bold font-mono mb-3">// Access Control</h3>
            <div className="space-y-2 text-[11px] text-white/60 font-mono">
              <p><span className="text-[#f59e0b]/60">Master PIN ({coachPin})</span> — Full admin access to all groups</p>
              <p><span className="text-[#f59e0b]/60">Head Coach</span> — Access to all groups</p>
              <p><span className="text-[#00f0ff]/60">Assistant</span> — Access only to assigned groups</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PARENT VIEW ──────────────────────────────────────────
  if (view === "parent") {
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs /><XpFloats /><LevelUpOverlay />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Parent View</h2>
          <p className="text-[#00f0ff]/25 text-xs mb-8 font-mono">Read-only — athlete progress & growth</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        <span className="text-xs font-bold" style={{ color: lv.color }}>{lv.icon} {lv.name}</span>
                        <span className="text-white/50 text-xs">{a.xp} XP</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-2">
                    <div className="h-full rounded-full xp-shimmer transition-all" style={{ width: `${prog.percent}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/60">
                    <span>Streak: {a.streak}d</span><span>Practices: {a.totalPractices}</span>
                  </div>
                  {growth && growth.xpGain !== 0 && (
                    <div className={`mt-2 text-xs font-medium ${growth.xpGain > 0 ? "text-emerald-400/60" : "text-red-400/60"}`}>
                      {growth.xpGain > 0 ? "↑" : "↓"} {Math.abs(growth.xpGain)} XP vs last month
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
                      <div><span className="text-white/40 font-bold">{a.totalPractices}</span> sessions</div>
                      <div><span className="text-white/40 font-bold">{Object.values(a.quests).filter(q => q === "done").length}</span> quests</div>
                      <div><span className="text-white/40 font-bold">{getStreakMult(a.streak)}x</span> multiplier</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="text-white/40 text-xs text-center mt-12">Coach manages all data. Parental consent required. Contact coach for data export.</p>
        </div>
      </div>
    );
  }

  // ── AUDIT VIEW ───────────────────────────────────────────
  if (view === "audit") {
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-6">Audit Log</h2>
          <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl p-2 max-h-[70vh] overflow-y-auto shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
            {!auditLog.length && <p className="text-white/60 text-sm p-6 font-mono">No actions recorded yet.</p>}
            {auditLog.slice(0, 200).map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-5 text-sm hover:bg-[#00f0ff]/[0.03] transition-colors border-b border-[#00f0ff]/5 last:border-0">
                <span className="text-[#00f0ff]/25 text-xs w-36 shrink-0 font-mono">{new Date(e.timestamp).toLocaleString()}</span>
                <span className="text-white/50 flex-1 truncate font-mono">{e.athleteName}: {e.action}</span>
                {e.xpDelta > 0 && <span className="neon-text-gold font-bold text-sm font-mono">+{e.xpDelta}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── MEETS VIEW ──────────────────────────────────────────
  if (view === "meets") {
    const saveMeets = (m: SwimMeet[]) => { setMeets(m); save(K.MEETS, m); };
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
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-12">
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
                <p className="text-white/60 text-xs mb-4">{new Date(editMeet.date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {editMeet.course} · {editMeet.location || "TBD"}</p>

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

  // ── COMMS VIEW (Broadcast to Parents) ──────────────────────
  if (view === "comms") {
    const BROADCAST_KEY = "apex-broadcasts-v1";
    const ABSENCE_KEY = "apex-absences-v1";

    const sendBroadcast = () => {
      if (!commsMsg.trim()) return;
      const bc = { id: `bc-${Date.now()}`, message: commsMsg, timestamp: new Date().toISOString(), from: "Coach", group: commsGroup };
      const updated = [...allBroadcasts, bc];
      setAllBroadcasts(updated);
      localStorage.setItem(BROADCAST_KEY, JSON.stringify(updated));
      setCommsMsg("");
    };

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-12">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Communications</h2>
          <p className="text-[#00f0ff]/30 text-xs font-mono mb-6">Broadcast to parents · View absence reports</p>

          {/* Send broadcast */}
          <Card className="p-5 mb-6" neon>
            <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Send to Parents</h3>
            <div className="flex gap-2 mb-3">
              <select value={commsGroup} onChange={e => setCommsGroup(e.target.value as "all" | GroupId)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f0ff]/40">
                <option value="all">All Groups</option>
                {ROSTER_GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input value={commsMsg} onChange={e => setCommsMsg(e.target.value)} placeholder="Type a message for parents..."
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }}
                onKeyDown={e => { if (e.key === "Enter") sendBroadcast(); }} />
              <button onClick={sendBroadcast} disabled={!commsMsg.trim()}
                className="game-btn px-5 py-2.5 text-sm font-bold text-[#00f0ff] border border-[#00f0ff]/30 rounded-lg hover:bg-[#00f0ff]/10 disabled:opacity-30 transition-all">
                Send
              </button>
            </div>
          </Card>

          {/* Sent messages */}
          <Card className="p-5 mb-6" neon>
            <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Sent Messages</h3>
            {allBroadcasts.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-4">No messages sent yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allBroadcasts.slice().reverse().map(bc => (
                  <div key={bc.id} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                    <p className="text-sm text-white/70">{bc.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-white/60">
                      <span>{new Date(bc.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span>{new Date(bc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-[#a855f7]">{bc.group === "all" ? "All Groups" : ROSTER_GROUPS.find(g => g.id === bc.group)?.name || bc.group}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Absence reports from parents */}
          <Card className="p-5" neon>
            <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Absence Reports</h3>
            {absenceReports.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-4">No absences reported</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {absenceReports.slice().reverse().map(ab => (
                  <div key={ab.id} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{ab.athleteName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">{ab.reason}</span>
                    </div>
                    <p className="text-xs text-white/60">{ab.dateStart}{ab.dateEnd !== ab.dateStart ? ` – ${ab.dateEnd}` : ""}</p>
                    {ab.note && <p className="text-xs text-white/60 mt-1">{ab.note}</p>}
                    <p className="text-xs text-white/40 mt-1">Reported: {new Date(ab.submitted).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
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
    const trendIcon = engagementTrend.direction === "up" ? "📈" : engagementTrend.direction === "down" ? "📉" : "➡️";
    const trendColor = engagementTrend.direction === "up" ? "text-emerald-400" : engagementTrend.direction === "down" ? "text-red-400" : "text-white/40";
    const cultureColor = cultureScore >= 70 ? "text-emerald-400" : cultureScore >= 40 ? "text-[#f59e0b]" : "text-red-400";
    const cultureBg = cultureScore >= 70 ? "bg-emerald-500" : cultureScore >= 40 ? "bg-[#f59e0b]" : "bg-red-500";

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-12">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-2">Coach Analytics</h2>
          <p className="text-[#00f0ff]/30 text-xs font-mono mb-8">Advanced insights · Predictive intelligence · Team health</p>

          {/* ── TEAM HEALTH DASHBOARD ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card className="p-5 text-center" neon>
              <div className={`text-4xl font-black tabular-nums whitespace-nowrap ${cultureColor}`}>{cultureScore}</div>
              <div className="text-white/60 text-xs uppercase mt-1 tracking-wider">Culture Score</div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div className={`h-full rounded-full ${cultureBg} transition-all`} style={{ width: `${cultureScore}%` }} />
              </div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className={`text-4xl font-black tabular-nums whitespace-nowrap ${trendColor}`}>{engagementTrend.delta > 0 ? "+" : ""}{engagementTrend.delta}%</div>
              <div className="text-white/60 text-xs uppercase mt-1 tracking-wider">{trendIcon} Engagement Trend</div>
              <div className="text-white/50 text-xs mt-2">vs last 7 days</div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className="text-4xl font-black tabular-nums whitespace-nowrap text-red-400">{atRiskAthletes.length}</div>
              <div className="text-white/60 text-xs uppercase mt-1 tracking-wider">At Risk Athletes</div>
              <div className="text-white/50 text-xs mt-2">need attention</div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className="text-4xl font-black tabular-nums whitespace-nowrap text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div>
              <div className="text-white/60 text-xs uppercase mt-1 tracking-wider">30-Day Attendance</div>
              <div className="text-white/50 text-xs mt-2">{avgXP(snapshots.slice(-30))} avg XP/day</div>
            </Card>
          </div>

          {/* ── ATTRITION RISK RADAR ── */}
          {atRiskAthletes.length > 0 && (
            <Card className="p-6 mb-6" glow>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-lg">🚨</span>
                <h3 className="text-red-400 text-sm font-black uppercase tracking-wider">Attrition Risk Radar</h3>
                <span className="text-white/50 text-xs ml-auto font-mono">{atRiskAthletes.length} athlete{atRiskAthletes.length > 1 ? "s" : ""} flagged</span>
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
                        <div className="text-white/60 text-xs">
                          Streak: {a.streak}d · {a.totalPractices} sessions · {getLevel(a.xp).name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-black tabular-nums whitespace-nowrap ${riskColor(a.risk)}`}>{a.risk}</div>
                        <div className="text-white/50 text-xs">risk score</div>
                      </div>
                      <div className="w-16 h-2 rounded-full bg-white/[0.04] overflow-hidden shrink-0">
                        <div className={`h-full rounded-full ${riskBg(a.risk)} transition-all`} style={{ width: `${a.risk}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-white/40 text-xs mt-4 font-mono">Risk factors: low attendance, broken streaks, low XP growth, no quest engagement, no teammate interaction</p>
            </Card>
          )}

          {/* ── PEAK PERFORMANCE WINDOWS ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Peak Performance Windows</h3>
            <div className="flex items-end gap-3 h-32">
              {peakWindows.map((pw, i) => {
                const maxXP = Math.max(...peakWindows.map(p => p.avgXP), 1);
                const pct = (pw.avgXP / maxXP) * 100;
                const isTop = i === 0 && pw.avgXP > 0;
                return (
                  <div key={pw.day} className="flex-1 flex flex-col items-center gap-2">
                    <span className={`text-xs font-bold font-mono ${isTop ? "text-[#f59e0b]" : "text-white/60"}`}>{pw.avgXP}</span>
                    <div className={`w-full rounded-t transition-all ${isTop ? "bg-gradient-to-t from-[#f59e0b] to-[#f59e0b]/60" : "bg-[#6b21a8]/60"}`}
                      style={{ height: `${Math.max(pct, 4)}%` }} />
                    <span className={`text-xs font-bold ${isTop ? "text-[#f59e0b]" : "text-white/60"}`}>{pw.day}</span>
                  </div>
                );
              })}
            </div>
            {peakWindows[0]?.avgXP > 0 && (
              <p className="text-white/50 text-xs mt-4 font-mono">Best day: <span className="text-[#f59e0b]">{peakWindows[0].day}</span> — avg {peakWindows[0].avgXP} XP across {peakWindows[0].sessions} sessions</p>
            )}
          </Card>

          {/* ── ATTENDANCE & RECOGNITION ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Attendance & Recognition</h3>
            <p className="text-white/50 text-xs mb-4 font-mono">Attendance rate and shoutout distribution across the team.</p>
            <div className="space-y-3">
              {(() => {
                const groupRoster = roster.filter(a => a.group === selectedGroup);
                const presentCount = groupRoster.filter(a => a.present).length;
                const presentRate = groupRoster.length ? Math.round((presentCount / groupRoster.length) * 100) : 0;
                const shoutoutCount = groupRoster.filter(a => auditLog.some(e => e.athleteId === a.id && e.action.includes("Shoutout"))).length;
                const shoutoutRate = groupRoster.length ? Math.round((shoutoutCount / groupRoster.length) * 100) : 0;
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 text-xs w-32">Attendance</span>
                      <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${presentRate}%` }} />
                      </div>
                      <span className="text-emerald-400 text-xs font-mono font-bold w-12 text-right">{presentRate}%</span>
                      <span className="text-white/50 text-xs font-mono w-12 text-right">{presentCount}/{groupRoster.length}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 text-xs w-32">Shoutouts</span>
                      <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full rounded-full bg-[#f59e0b] transition-all" style={{ width: `${shoutoutRate}%` }} />
                      </div>
                      <span className="text-[#f59e0b] text-xs font-mono font-bold w-12 text-right">{shoutoutRate}%</span>
                      <span className="text-white/50 text-xs font-mono w-12 text-right">{shoutoutCount}/{groupRoster.length}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </Card>

          {/* ── ENGAGEMENT CALENDAR ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Engagement Calendar</h3>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 30 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - 29 + i);
                const ds = d.toISOString().slice(0, 10);
                const snap = calendarData[ds];
                const intensity = snap ? Math.min(1, snap.totalXPAwarded / 500) : 0;
                const isSel = selectedDay === ds;
                return (
                  <button key={ds} onClick={() => setSelectedDay(isSel ? null : ds)}
                    className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                      isSel ? "ring-2 ring-[#f59e0b]/40 text-white" : "text-white/60 hover:bg-white/[0.04]"
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
            <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Athlete Timeline</h3>
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
                        <span className="text-xs text-white/50 font-mono">{new Date(s.date).getDate()}</span>
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
              <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold">Period Comparison</h3>
              <select value={comparePeriod} onChange={e => setComparePeriod(e.target.value as "week" | "month")}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none min-h-[32px]">
                <option value="week">Week</option><option value="month">Month</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[{ label: p.currentLabel, data: p.current }, { label: p.previousLabel, data: p.previous }].map(col => (
                <Card key={col.label} className="p-4">
                  <div className="text-white/60 text-xs uppercase tracking-wider font-medium mb-3">{col.label}</div>
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
            <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Monthly Report Card</h3>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div><div className="text-white/60 text-xs uppercase mt-1">Attendance</div></div>
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-[#a855f7]">{avgXP(snapshots.slice(-30))}</div><div className="text-white/60 text-xs uppercase mt-1">Avg XP/Day</div></div>
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-white">{longestStreak?.streak || 0}d</div><div className="text-white/60 text-xs uppercase mt-1">Longest Streak</div></div>
            </div>
            <div className="mb-4">
              <div className="text-white/60 text-xs uppercase tracking-wider mb-2">Top 5</div>
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
            📊 Export Full CSV
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     COACH MAIN VIEW — LEADERBOARD-FIRST LAYOUT
     ════════════════════════════════════════════════════════════ */

  const present = filteredRoster.filter(a => a.present || Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)).length;
  const totalXpToday = filteredRoster.reduce((s, a) => s + (a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0);

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <XpFloats /><LevelUpOverlay />

      <div className="relative z-10 w-full max-w-[1920px] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="w-full">
          <GameHUDHeader />

        {/* ══════════════════════════════════════════════════════
           GROUP SELECTOR — SWITCH ROSTER GROUPS
           ══════════════════════════════════════════════════════ */}
        <div className="py-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {ROSTER_GROUPS.filter(g => accessibleGroups.includes(g.id)).map(g => {
              const isActive = selectedGroup === g.id;
              const count = roster.filter(a => a.group === g.id).length;
              return (
                <button key={g.id} onClick={() => switchGroup(g.id)}
                  className={`game-btn px-4 py-3 text-xs sm:text-sm font-bold font-mono tracking-wider transition-all min-h-[44px] ${
                    isActive
                      ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                      : "bg-[#06020f]/60 text-white/60 border border-white/10 hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20"
                  }`}>
                  <span className="mr-1">{g.icon}</span>
                  <span>{g.name.toUpperCase()}</span>
                  <span className="ml-2 text-xs opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="text-center mt-3 text-xs font-mono text-white/60">
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
                        leaderTab === t ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 shadow-[0_0_16px_rgba(0,240,255,0.3)]" : "text-white/60 hover:text-[#00f0ff]/50 border border-transparent"
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
                    <span className="text-xs font-bold text-[#f59e0b] tracking-wider">♂ MVP</span>
                    <span className="text-white text-xs font-medium">{mvpMale.name.split(" ")[0]}</span>
                  </div>
                )}
                {mvpFemale && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#e879f9]/10 to-transparent border border-[#e879f9]/15">
                    <span className="text-xs font-bold text-[#e879f9] tracking-wider">♀ MVP</span>
                    <span className="text-white text-xs font-medium">{mvpFemale.name.split(" ")[0]}</span>
                  </div>
                )}
                {mostImproved && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/15">
                    <span className="text-xs font-bold text-emerald-400 tracking-wider">RISING</span>
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
                <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-[800px] lg:max-w-[1000px] mx-auto items-end">
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
                        <div className="neon-text-gold text-2xl sm:text-3xl font-black mt-3 tracking-tight font-mono tabular-nums whitespace-nowrap">
                          {a.xp}<span className="text-xs text-[#f59e0b]/30 ml-1">XP</span>
                        </div>
                        {a.streak > 0 && (
                          <div className="text-white/60 text-xs mt-1 font-bold">🔥 {a.streak}d streak</div>
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
              <span className="text-[#00f0ff]/20 text-xs font-mono">{sorted.length} athletes</span>
            </div>
            <div className="game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-2xl overflow-hidden shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
              {sorted.map((a, i) => {
                const lv = getLevel(a.xp);
                const sk = fmtStreak(a.streak);
                const rank = i + 1;
                const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                return (
                  <div key={a.id} className={`flex items-center gap-4 py-4 px-6 transition-all duration-200 hover:bg-white/[0.04] hover:shadow-[inset_0_0_30px_rgba(107,33,168,0.05)] group ${rank <= 3 ? "bg-white/[0.02]" : ""} ${i < sorted.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                    <span className={`w-8 text-center text-sm font-black shrink-0 transition-colors ${rank <= 3 ? "text-[#f59e0b]" : "text-white/40 group-hover:text-white/60"}`}>
                      {medalEmoji || rank}
                    </span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white/70 shrink-0 transition-all duration-200 group-hover:scale-110"
                      style={{ background: `radial-gradient(circle, ${lv.color}20, ${lv.color}08)`, border: `2px solid ${lv.color}${rank <= 3 ? "60" : "30"}`, boxShadow: `0 0 12px ${lv.color}${rank <= 3 ? "20" : "10"}` }}>
                      {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className={`text-sm font-semibold flex-1 truncate group-hover:text-white transition-colors ${rank <= 3 ? "text-white" : "text-white/80"}`}>{a.name}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1 transition-all" style={{ color: lv.color, background: `${lv.color}12`, boxShadow: `0 0 8px ${lv.color}08` }}>{lv.icon} {lv.name}</span>
                    {a.streak > 0 && <span className="text-white/60 text-xs hidden sm:inline font-bold">🔥 {a.streak}d</span>}
                    <span className="text-[#f59e0b] text-sm font-black w-16 text-right tabular-nums whitespace-nowrap shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">{a.xp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
           COACH TOOLS + ROSTER CHECK-IN
           ══════════════════════════════════════════════════════ */}
        <div className="w-full px-5 sm:px-8 py-4">
          <div className="w-full">
            {/* Session mode — full-width tabs + AM/PM toggle */}
            <div className="mb-5 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["pool", "weight", "meet"] as const).map(m => {
                  const sportLabels = { swimming: { pool: "Pool", weight: "Weight Room", meet: "Meet Day" }, diving: { pool: "Board", weight: "Dryland", meet: "Meet Day" }, waterpolo: { pool: "Pool", weight: "Gym", meet: "Match Day" } };
                  const labels = sportLabels[currentSport as keyof typeof sportLabels] || sportLabels.swimming;
                  const ModeIcon = () => {
                    if (m === "pool") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>;
                    if (m === "weight") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><path d="M6 12h12"/><rect x="6" y="7" width="3" height="10" rx="1"/><rect x="15" y="7" width="3" height="10" rx="1"/></svg>;
                    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
                  };
                  return (
                    <button key={m} onClick={() => setSessionMode(m)}
                      className={`w-full py-4 text-sm font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[60px] flex flex-col items-center justify-center gap-1.5 ${
                        sessionMode === m
                          ? "bg-[#00f0ff]/12 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_16px_rgba(0,240,255,0.2)]"
                          : "bg-[#06020f]/60 text-white/60 border border-white/[0.06] hover:text-[#00f0ff]/50 active:scale-[0.97]"
                      }`}>
                      <ModeIcon /><span className="text-[11px]">{labels[m]}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setSessionTime(sessionTime === "am" ? "pm" : "am")}
                className={`w-full text-xs font-bold font-mono tracking-wider transition-all duration-200 rounded-xl min-h-[44px] ${
                  sessionTime === "am"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                }`}>
                {sessionTime === "am" ? "☀ AM" : "☽ PM"}
              </button>
            </div>

            {/* Quick actions — full-width toolbar */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <button onClick={bulkMarkPresent} className="game-btn py-3 bg-[#00f0ff]/10 text-[#00f0ff]/70 text-xs font-mono tracking-wider border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">
                Bulk
              </button>
              <button onClick={exportCSV} className="game-btn py-3 bg-[#06020f]/60 text-white/50 text-xs font-mono border border-white/[0.06] hover:text-[#00f0ff]/50 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">Export</button>
              <button onClick={() => setAddAthleteOpen(!addAthleteOpen)} className="game-btn py-3 bg-[#06020f]/60 text-white/50 text-xs font-mono border border-white/[0.06] hover:text-[#a855f7]/50 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">
                {addAthleteOpen ? "Cancel" : "+ Add"}
              </button>
              <div className="relative">
                <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="w-full game-btn py-3 bg-[#06020f]/60 text-white/40 text-xs font-mono border border-white/[0.06] hover:text-white/60 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">
                  More
                </button>
                {showMoreMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#0a0315]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] py-1 min-w-[160px]">
                      <button onClick={() => { setShowMoreMenu(false); undoLast(); }} className="w-full text-left px-4 py-3 text-white/60 text-xs font-mono hover:bg-white/[0.05] hover:text-white/80 transition-colors">Undo Last</button>
                      <div className="border-t border-white/[0.06] my-1" />
                      <button onClick={() => { setShowMoreMenu(false); setConfirmAction({ label: "Reset today's check-ins for this group?", action: resetDay }); }} className="w-full text-left px-4 py-3 text-white/50 text-xs font-mono hover:bg-red-500/10 hover:text-red-400/80 transition-colors">Reset Day</button>
                      <button onClick={() => { setShowMoreMenu(false); setConfirmAction({ label: "Reset this week's sessions and check-ins?", action: resetWeek }); }} className="w-full text-left px-4 py-3 text-white/50 text-xs font-mono hover:bg-red-500/10 hover:text-red-400/80 transition-colors">Reset Week</button>
                      <button onClick={() => { setShowMoreMenu(false); setConfirmAction({ label: "Reset all monthly data, streaks, and quests?", action: resetMonth }); }} className="w-full text-left px-4 py-3 text-red-400/50 text-xs font-mono hover:bg-red-500/10 hover:text-red-400/80 transition-colors">Reset Month</button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bulk undo bar — appears after bulk check-in, auto-dismisses in 10s */}
            {bulkUndoVisible && (
              <div className="flex items-center justify-between gap-3 mb-3 px-4 py-3 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl animate-in slide-in-from-top-2">
                <span className="text-[#f59e0b]/80 text-xs font-mono">Bulk check-in applied</span>
                <button onClick={bulkUndoAll} className="px-4 py-1.5 bg-[#f59e0b]/20 text-[#f59e0b] text-xs font-bold font-mono rounded-lg hover:bg-[#f59e0b]/30 transition-all active:scale-[0.97]">Undo All</button>
              </div>
            )}

            {/* Confirm dialog for destructive actions */}
            {confirmAction && (
              <div className="flex items-center justify-between gap-3 mb-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <span className="text-red-400/80 text-xs font-mono">{confirmAction.label}</span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 bg-white/[0.05] text-white/50 text-xs font-mono rounded-lg hover:bg-white/[0.1] transition-all">Cancel</button>
                  <button onClick={() => { confirmAction.action(); setConfirmAction(null); }} className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold font-mono rounded-lg hover:bg-red-500/30 transition-all active:scale-[0.97]">Confirm</button>
                </div>
              </div>
            )}

            {/* Add athlete — expandable */}
            {addAthleteOpen && (
              <div className="flex gap-3 mb-5 items-center flex-wrap">
                <input value={newAthleteName} onChange={e => setNewAthleteName(e.target.value)} placeholder="Name"
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm w-52 focus:outline-none focus:border-[#6b21a8]/40 min-h-[44px]" style={{ fontSize: '16px' }} />
                <input value={newAthleteAge} onChange={e => setNewAthleteAge(e.target.value.replace(/\D/g, ""))} placeholder="Age"
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm w-20 focus:outline-none min-h-[44px]" style={{ fontSize: '16px' }} />
                <select value={newAthleteGender} onChange={e => setNewAthleteGender(e.target.value as "M" | "F")}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none min-h-[44px]" style={{ fontSize: '16px' }}>
                  <option value="M">M</option><option value="F">F</option>
                </select>
                <button onClick={addAthleteAction}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#7c3aed] to-[#6b21a8] text-white text-sm font-bold min-h-[44px] hover:shadow-[0_0_20px_rgba(107,33,168,0.3)] transition-all">
                  Add
                </button>
              </div>
            )}

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
                        className="flex items-center gap-3 p-4 sm:p-5 cursor-pointer hover:bg-white/[0.02] transition-colors duration-150 rounded-2xl group"
                        onClick={() => setExpandedId(isExp ? null : a.id)}
                      >
                        {/* Present toggle — tap to mark present/absent without expanding */}
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePresent(a.id); }}
                          className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition-all duration-200 active:scale-90 ${
                            a.present
                              ? "bg-emerald-500/20 border-2 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                              : "bg-white/[0.03] border-2 border-white/10 hover:border-white/20"
                          }`}
                          aria-label={a.present ? "Mark absent" : "Mark present"}
                        >
                          {a.present ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-white/15" />
                          )}
                        </button>
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 transition-all duration-300 group-hover:scale-110"
                          style={{ background: `radial-gradient(circle at 30% 30%, ${lv.color}30, ${lv.color}08)`, border: `2px solid ${lv.color}${hasCk ? "90" : "35"}`, boxShadow: hasCk ? `0 0 20px ${lv.color}20` : `0 0 8px ${lv.color}08` }}
                        >
                          {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{a.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>{lv.icon} {lv.name}</span>
                            {a.streak > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]/70">🔥 {a.streak}d · {sk.mult}</span>}
                          </div>
                        </div>
                        <div className="w-28 shrink-0 text-right">
                          <div className="text-white font-black text-sm tabular-nums whitespace-nowrap">{a.xp}<span className="text-white/50 text-xs ml-1">XP</span></div>
                          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-1.5">
                            <div className="h-full rounded-full xp-shimmer" style={{ width: `${prog.percent}%` }} />
                          </div>
                          {dailyUsed > 0 && <div className="text-xs text-[#f59e0b]/60 font-bold mt-1">+{dailyUsed}</div>}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamChallenges.map(tc => {
                  const pct = Math.min(100, (tc.current / tc.target) * 100);
                  const done = tc.current >= tc.target;
                  return (
                    <div key={tc.id} className={`game-panel game-panel-border bg-[#06020f]/70 backdrop-blur-xl border p-5 transition-all ${done ? "border-[#f59e0b]/30 neon-pulse-gold" : "border-[#00f0ff]/10"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-sm">{tc.name}</span>
                        <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${done ? "text-[#f59e0b]" : "text-white/60"}`}>{tc.current}%<span className="text-white/40">/{tc.target}%</span></span>
                      </div>
                      <p className="text-white/50 text-[11px] mb-3">{tc.description} · <span className="text-[#f59e0b]/60">+{tc.reward} XP</span></p>
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
        <div className="text-center text-white/[0.05] text-xs py-10 space-y-1">
          <p>Apex Athlete — Saint Andrew&apos;s Aquatics</p>
          <p>Coach manages all data. Parental consent required.</p>
        </div>
      </div>
    </div>
  );
}
