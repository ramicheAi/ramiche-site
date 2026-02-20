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
import { ApexNotificationBell, addNotification } from "@/components/apex-notifications";

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
const PRESENT_XP = 5; // Base XP for showing up
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
  quests: Record<string, "active" | "done" | "pending">;
  dailyXP: DailyXP;
  // v6 fields — athlete + parent linking
  birthday?: string; // YYYY-MM-DD or MM/DD/YYYY
  usaSwimmingId?: string;
  parentCode?: string; // 6-char code parents use to access their child's portal
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  sport?: "swimming" | "diving" | "waterpolo";
  present?: boolean;
  // v7 — best times from SwimCloud / manual entry
  bestTimes?: BestTime[];
  bestTimesUpdated?: string; // ISO date of last fetch
}

interface BestTime {
  event: string;       // "100"
  stroke: string;      // "Freestyle"
  time: string;        // "52.34"
  seconds: number;     // 52.34
  course: "SCY" | "SCM" | "LCM";
  meet?: string;
  date?: string;
  source: "swimcloud" | "manual" | "import";
}

// ── meet entry types ────────────────────────────────────────
interface MeetEventEntry { athleteId: string; seedTime: string; }
interface MeetEvent { id: string; name: string; eventNum?: number; ageGroup?: string; gender?: "M" | "F" | "Mixed"; distance?: number; stroke?: string; sessionType?: "P" | "F"; isRelay?: boolean; qualifyingTime?: string; cutTime?: string; dayNumber?: number; entries: MeetEventEntry[]; }
interface MeetSession { id: string; day: string; sessionNum: number; warmupTime?: string; startTime?: string; events: MeetEvent[]; }
interface MeetBroadcast { id: string; message: string; timestamp: number; sentBy: string; }
interface MeetFile { id: string; name: string; dataUrl: string; uploadedAt: number; }
interface SwimMeet {
  id: string; name: string; date: string; endDate?: string; location: string;
  course: "SCY" | "SCM" | "LCM"; rsvpDeadline: string;
  description?: string; warmupTime?: string;
  sessions: MeetSession[];
  events: MeetEvent[]; rsvps: Record<string, "committed" | "declined" | "pending">;
  broadcasts: MeetBroadcast[]; status: "upcoming" | "active" | "completed" | "finalized";
  files?: MeetFile[];
  parserVersion?: number;
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

interface SessionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  group: string;
  sessionTime: "am" | "pm" | "auto" | "manual"; // legacy: auto/manual resolved to am/pm at save time
  sessionMode: "pool" | "weight" | "meet";
  startedAt: number; // timestamp
  endedAt: number; // timestamp when auto-saved
  presentAthletes: string[]; // athlete IDs
  checkpoints: Record<string, Record<string, boolean>>; // athleteId -> checkpoint -> checked
  weightCheckpoints: Record<string, Record<string, boolean>>;
  xpAwarded: Record<string, number>; // athleteId -> XP earned this session
  totalAttendance: number;
  totalAthletes: number;
  notes: string;
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

// ── notification types ──────────────────────────────────────
type NotificationPriority = "critical" | "high" | "medium" | "low";
type NotificationType = "streak-warning" | "level-up" | "attendance" | "quest-completion";

interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  athleteId?: string;
  group?: string;
  timestamp: number;
}

const PRIORITY_ORDER: Record<NotificationPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

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
type RosterEntry = { name: string; age: number; gender: "M" | "F"; group: GroupId; birthday?: string; usaSwimmingId?: string; parentName?: string; parentEmail?: string; parentPhone?: string };

const INITIAL_ROSTER: RosterEntry[] = [
  // ── PLATINUM (33) ──
  { name: "William Domokos-Murphy", age: 17, gender: "M", group: "platinum", parentName: "Monika Domokos", parentPhone: "(561) 704-0402" },
  { name: "Enrico Guizardi", age: 15, gender: "M", group: "platinum", parentName: "Enrico Guizardi", parentPhone: "(305) 427-9691" },
  { name: "Jorge Aguila", age: 17, gender: "M", group: "platinum", parentName: "Jorge Aguila", parentPhone: "(954) 839-7321" },
  { name: "Jared Berke", age: 17, gender: "M", group: "platinum", parentName: "Ira Berke", parentPhone: "(561) 530-7084" },
  { name: "Andrew Bouche", age: 17, gender: "M", group: "platinum" },
  { name: "Conner Brinley", age: 18, gender: "M", group: "platinum", parentName: "Brian Brinley", parentPhone: "(561) 702-9878" },
  { name: "Bradley DiPaolo", age: 16, gender: "M", group: "platinum", parentName: "Frank DiPaolo", parentPhone: "954-734-5919" },
  { name: "William Gillis", age: 18, gender: "M", group: "platinum", parentName: "Greta Gillis", parentPhone: "(561) 912-9030" },
  { name: "William McAndrews", age: 14, gender: "M", group: "platinum" },
  { name: "Matthias Orlandini", age: 16, gender: "M", group: "platinum" },
  { name: "Matthew Prieres", age: 16, gender: "M", group: "platinum", parentName: "Denise Prieres", parentPhone: "(973) 393-2063" },
  { name: "Luke Reid", age: 14, gender: "M", group: "platinum", parentName: "Katie Reid", parentPhone: "(847) 431-6211" },
  { name: "Surfiel Santiago", age: 18, gender: "M", group: "platinum", parentName: "Alexander Santiago", parentPhone: "(772) 924-5527" },
  { name: "Simon Sheinfeld", age: 16, gender: "M", group: "platinum" },
  { name: "Cash Vinas", age: 17, gender: "M", group: "platinum", parentName: "Heather Vinas", parentPhone: "(631) 404-2144" },
  { name: "Nerea Gutierrez", age: 17, gender: "F", group: "platinum" },
  { name: "Mayah Chouloute", age: 16, gender: "F", group: "platinum" },
  { name: "Sophia Gamboa-Pereira", age: 14, gender: "F", group: "platinum", parentName: "Sophia Gamboa-Pereira", parentPhone: "(954) 383-3852" },
  { name: "Gabia Gelumbickas", age: 17, gender: "F", group: "platinum" },
  { name: "Alejandra Gil-Restrepo", age: 17, gender: "F", group: "platinum" },
  { name: "Christina Gumbinger", age: 18, gender: "F", group: "platinum", parentName: "Baoqin Li", parentPhone: "(561) 271-9400" },
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
  { name: "Jackson Baral", age: 12, gender: "M", group: "gold", parentName: "Brian Baral", parentPhone: "(312) 515-3512" },
  { name: "Lorenz Fahnenschmidt", age: 12, gender: "M", group: "gold" },
  { name: "Daniel Gil-Restrepo", age: 14, gender: "M", group: "gold" },
  { name: "Benjamin Gober", age: 15, gender: "M", group: "gold", parentName: "Channing Barnett", parentPhone: "(917) 257-5738" },
  { name: "Joaquin Gomez-Llendo", age: 13, gender: "M", group: "gold", parentName: "Luis Gomez", parentPhone: "(310) 420-7275" },
  { name: "Kayla Jorge", age: 15, gender: "F", group: "gold" },
  { name: "Sakshi Kaur", age: 12, gender: "F", group: "gold", parentName: "Manpreet Kaur", parentPhone: "(646) 496-8543" },
  { name: "Peter Lehmann", age: 16, gender: "M", group: "gold", parentName: "Jeannette Lehmann", parentPhone: "5612123219" },
  { name: "Brooklyn Lewis", age: 13, gender: "F", group: "gold", parentName: "Meagan Lewis", parentPhone: "(305) 968-6948" },
  { name: "Maria Monozova", age: 14, gender: "F", group: "gold" },
  { name: "Ari Nelson", age: 15, gender: "M", group: "gold" },
  { name: "Aliyana Ordunez", age: 14, gender: "F", group: "gold" },
  { name: "Mathaus Polli", age: 13, gender: "M", group: "gold" },
  { name: "Eli Rudikoff", age: 15, gender: "M", group: "gold", parentName: "Adam Rudikoff", parentPhone: "(617) 290-3640" },
  { name: "Daniel Sigda", age: 13, gender: "M", group: "gold" },
  { name: "Julieta Siok", age: 13, gender: "F", group: "gold", parentName: "Daniela Iurkovic", parentPhone: "(561) 809-1061" },
  { name: "Alexandra Thomson", age: 13, gender: "F", group: "gold", parentName: "Joanna Thomson", parentPhone: "(405) 706-6058" },
  { name: "Ava Umstattd", age: 14, gender: "F", group: "gold" },
  { name: "Camile Waber", age: 15, gender: "F", group: "gold", parentName: "Jodi Waber", parentPhone: "(561) 414-4878" },
  { name: "Tyler Wright", age: 12, gender: "M", group: "gold", parentName: "Chelsea Wright", parentPhone: "(954) 552-1442" },
  { name: "Oleh Zinerko", age: 13, gender: "M", group: "gold" },
  // ── SILVER (~48) ──
  { name: "Henry Andrews", age: 10, gender: "M", group: "silver" },
  { name: "Maxim Anisimov", age: 12, gender: "M", group: "silver" },
  { name: "Whitney Avella", age: 10, gender: "F", group: "silver" },
  { name: "James Averian", age: 11, gender: "M", group: "silver", parentName: "TANIA AVERIAN", parentPhone: "(773) 593-0909" },
  { name: "Fletcher Baral", age: 10, gender: "M", group: "silver", parentName: "Brian Baral", parentPhone: "(312) 515-3512" },
  { name: "Mila Bidva", age: 10, gender: "F", group: "silver" },
  { name: "Alec Chen", age: 13, gender: "M", group: "silver", parentName: "Warren Chen", parentPhone: "(310) 850-3351" },
  { name: "Alessandro Cubas", age: 14, gender: "M", group: "silver", parentName: "Irma Sikaffy-Cubas", parentPhone: "(561) 524-7952" },
  { name: "Tomas Fabo", age: 11, gender: "M", group: "silver" },
  { name: "Danny Fang", age: 13, gender: "M", group: "silver", parentName: "Xiaohua Fang", parentPhone: "(561) 297-2963" },
  { name: "Jackson Gallo", age: 13, gender: "M", group: "silver", parentName: "Kristin Gallo", parentPhone: "(561) 558-3363" },
  { name: "Melana Gnesin", age: 11, gender: "F", group: "silver" },
  { name: "Jeffrey Hill", age: 10, gender: "M", group: "silver" },
  { name: "Penn Hofeld", age: 10, gender: "M", group: "silver" },
  { name: "Marko Ivanovskyy", age: 13, gender: "M", group: "silver" },
  { name: "Savva Kan", age: 14, gender: "M", group: "silver" },
  { name: "Nina Kosta", age: 11, gender: "F", group: "silver" },
  { name: "Sara Kourjakian", age: 10, gender: "F", group: "silver" },
  { name: "Elanna Krslovic", age: 10, gender: "F", group: "silver", parentName: "Anthony Krslovic", parentPhone: "561-302-1178" },
  { name: "Roman Kuleshov", age: 9, gender: "M", group: "silver" },
  { name: "Mark Kuleshov", age: 11, gender: "M", group: "silver" },
  { name: "Hlib Kyryliuk", age: 13, gender: "M", group: "silver", parentName: "Natalia Kyryliuk", parentPhone: "(504) 920-1858" },
  { name: "Konrad Laszczak", age: 12, gender: "M", group: "silver" },
  { name: "Matthew Lehmann", age: 12, gender: "M", group: "silver", parentName: "Jeannette Lehmann", parentPhone: "5612123219" },
  { name: "Ates Maranezli", age: 12, gender: "M", group: "silver", parentName: "Hasan Maranezli", parentPhone: "(754) 271-1412" },
  { name: "Vincent McAndrews", age: 10, gender: "M", group: "silver" },
  { name: "Antonio Micalizzi", age: 15, gender: "M", group: "silver", parentName: "Bernard Micalizzi", parentPhone: "(704) 488-3334" },
  { name: "Julie Miksik", age: 11, gender: "F", group: "silver" },
  { name: "Nikolai Morozov", age: 11, gender: "M", group: "silver" },
  { name: "Stella Nessen", age: 10, gender: "F", group: "silver" },
  { name: "Samantha Panetta", age: 12, gender: "F", group: "silver", parentName: "Yvette Panetta", parentPhone: "917-674-6485" },
  { name: "Harper Parrott", age: 11, gender: "F", group: "silver", parentName: "Caitlin Parrott", parentPhone: "(954) 242-8835" },
  { name: "Hadya Refaat", age: 12, gender: "F", group: "silver" },
  { name: "Luke Rodgers", age: 16, gender: "M", group: "silver", parentName: "David Rodgers", parentPhone: "(561) 541-2330" },
  { name: "Eli Rutkovsky", age: 10, gender: "M", group: "silver", parentName: "Irina Sitnikov", parentPhone: "(201) 250-2088" },
  { name: "Caio Samora", age: 12, gender: "M", group: "silver", parentName: "Arielle Barreto", parentPhone: "(954) 294-6121" },
  { name: "Lucas Siems", age: 15, gender: "M", group: "silver", parentName: "Paul Siems", parentPhone: "(404) 200-0921" },
  { name: "Luigi Silveira", age: 12, gender: "M", group: "silver", parentName: "Eduardo Silveira", parentPhone: "(954) 242-2599" },
  { name: "Lila Sinclair", age: 11, gender: "F", group: "silver" },
  { name: "Shay Swan", age: 14, gender: "M", group: "silver", parentName: "Amie Swan", parentPhone: "(941) 266-1326" },
  { name: "Tyler Szmiga", age: 14, gender: "M", group: "silver", parentName: "Loren Szmiga", parentPhone: "(561) 699-8540" },
  { name: "Arnas Thompson", age: 10, gender: "M", group: "silver" },
  { name: "Morgan Thomson", age: 11, gender: "F", group: "silver" },
  { name: "Liam Torres", age: 13, gender: "M", group: "silver", parentName: "Bianca Torres", parentPhone: "(305) 904-6095" },
  { name: "Liam van Arkel", age: 14, gender: "M", group: "silver" },
  { name: "Olivia Warner", age: 10, gender: "F", group: "silver" },
  { name: "Everett Weeks", age: 12, gender: "M", group: "silver", parentName: "Amy Weeks", parentPhone: "(954) 994-4943" },
  // ── BRONZE 1 (~38) ──
  { name: "Arthur Alikhanyan", age: 12, gender: "M", group: "bronze1" },
  { name: "Robert Bekh", age: 9, gender: "M", group: "bronze1", parentName: "Andriy Bekh", parentPhone: "(561) 850-7851" },
  { name: "Mark Bekh", age: 6, gender: "M", group: "bronze1", parentName: "Andriy Bekh", parentPhone: "(561) 850-7851" },
  { name: "Kali Bidva", age: 7, gender: "F", group: "bronze1", parentName: "Valerie Bidva", parentPhone: "561-221-7822" },
  { name: "Alexandra Bohlman", age: 10, gender: "F", group: "bronze1" },
  { name: "Vivian Cartelli", age: 8, gender: "F", group: "bronze1" },
  { name: "Emilia Castaneda", age: 9, gender: "F", group: "bronze1" },
  { name: "Shawn Cohen", age: 11, gender: "M", group: "bronze1" },
  { name: "Edwin Diaz", age: 11, gender: "M", group: "bronze1", parentName: "Ana Franco", parentPhone: "(918) 936-0167" },
  { name: "Mark Egorov", age: 11, gender: "M", group: "bronze1" },
  { name: "Fabiano Feu Rosa", age: 6, gender: "M", group: "bronze1" },
  { name: "Daniel Fralou", age: 7, gender: "M", group: "bronze1", parentName: "Sviatlana Fralou", parentPhone: "(312) 852-1923" },
  { name: "Aron Garber", age: 7, gender: "M", group: "bronze1" },
  { name: "Shane Hogenson", age: 7, gender: "M", group: "bronze1", parentName: "Holly Hogenson", parentPhone: "(612) 570-3196" },
  { name: "Andrei Kanashin", age: 7, gender: "M", group: "bronze1", parentName: "Anastasiia Kanashina", parentPhone: "(754) 303-1518" },
  { name: "Vanya Klachko", age: 8, gender: "M", group: "bronze1" },
  { name: "Yana Klachko", age: 10, gender: "F", group: "bronze1", parentName: "Katherine Klachko", parentPhone: "(805) 455-2981" },
  { name: "Kaia Kohn", age: 9, gender: "F", group: "bronze1", parentName: "Marissa Kohn", parentPhone: "(917) 231-6815" },
  { name: "Aimee Laham Boulos", age: 8, gender: "F", group: "bronze1", parentName: "Diana Lopez y Royo", parentPhone: "(305) 336-6963" },
  { name: "Mateo Libreros", age: 9, gender: "M", group: "bronze1" },
  { name: "Ivans Loscenkovs", age: 12, gender: "M", group: "bronze1" },
  { name: "Ella Lurie", age: 8, gender: "F", group: "bronze1" },
  { name: "Zora Nerette", age: 9, gender: "F", group: "bronze1", parentName: "Wesley Nerette", parentPhone: "(305) 283-3753" },
  { name: "Nikolay Nichiporenko", age: 11, gender: "M", group: "bronze1" },
  { name: "Amelia O'Malley Mastropieri", age: 8, gender: "F", group: "bronze1" },
  { name: "Emerson Panetta", age: 9, gender: "M", group: "bronze1" },
  { name: "Ariela Pilewski", age: 8, gender: "F", group: "bronze1", parentName: "Irina Pilewski", parentPhone: "(404) 931-7592" },
  { name: "Anastasia Pylypenko", age: 9, gender: "F", group: "bronze1", parentName: "ANDRII PYLYPENKO", parentPhone: "(347) 262-5922" },
  { name: "Isabella Ramirez", age: 7, gender: "F", group: "bronze1" },
  { name: "Ilgin Sabah", age: 12, gender: "M", group: "bronze1" },
  { name: "Bahdan Sak", age: 12, gender: "M", group: "bronze1", parentName: "Aksana Sak", parentPhone: "(786) 780-9046" },
  { name: "Emma Schechter", age: 9, gender: "F", group: "bronze1", parentName: "Lorell Ruiz", parentPhone: "(561) 405-0905" },
  { name: "Luna Stroud", age: 7, gender: "F", group: "bronze1", parentName: "Annie Stroud", parentPhone: "(561) 901-5500" },
  { name: "Talia Weinbaum", age: 7, gender: "F", group: "bronze1" },
  { name: "Austin Wilson", age: 8, gender: "M", group: "bronze1" },
  { name: "Olivia Ynigo-Imme", age: 9, gender: "F", group: "bronze1" },
  { name: "Cameron Ziegenfuss", age: 8, gender: "M", group: "bronze1", parentName: "Adam Ziegenfuss", parentPhone: "(561) 719-6065" },
  // ── BRONZE 2 (~26) ──
  { name: "Mohamed AboShanab", age: 10, gender: "M", group: "bronze2" },
  { name: "Allegra Arrendale", age: 9, gender: "F", group: "bronze2" },
  { name: "Nathaniel Borodin", age: 12, gender: "M", group: "bronze2" },
  { name: "Zean Chen", age: 13, gender: "M", group: "bronze2" },
  { name: "Cora Chodash", age: 10, gender: "F", group: "bronze2", parentName: "Kim Chodash", parentPhone: "(954) 401-2121" },
  { name: "Diego Corrales", age: 9, gender: "M", group: "bronze2", parentName: "Michaelena Corrales", parentPhone: "(703) 398-2666" },
  { name: "Alessandra Davis", age: 9, gender: "F", group: "bronze2" },
  { name: "Jaxson Dehnert", age: 8, gender: "M", group: "bronze2", parentName: "Sofia Dehnert", parentPhone: "(203) 808-9973" },
  { name: "Emma Dorsey", age: 11, gender: "F", group: "bronze2", parentName: "Nicole Picard", parentPhone: "(860) 539-7935" },
  { name: "Valentina Esteban", age: 10, gender: "F", group: "bronze2" },
  { name: "Pablo Galan", age: 12, gender: "M", group: "bronze2" },
  { name: "Ashton Gaspin", age: 10, gender: "M", group: "bronze2", parentName: "Matthew Gaspin", parentPhone: "(516) 318-0018" },
  { name: "Adrian-Nickolay Georgiev", age: 10, gender: "M", group: "bronze2" },
  { name: "Miles Heller", age: 12, gender: "M", group: "bronze2", parentName: "Jessica Heller", parentPhone: "(267) 216-8368" },
  { name: "Ace Hill", age: 7, gender: "M", group: "bronze2" },
  { name: "Ela Kasikci", age: 13, gender: "F", group: "bronze2" },
  { name: "Boban Kirk", age: 10, gender: "M", group: "bronze2" },
  { name: "Alexa Kish", age: 11, gender: "F", group: "bronze2" },
  { name: "Alexandra Maskow", age: 12, gender: "F", group: "bronze2", parentName: "Peter Maskow", parentPhone: "(440) 567-0350" },
  { name: "Andrew Mateo", age: 11, gender: "M", group: "bronze2" },
  { name: "Alan Mateo", age: 8, gender: "M", group: "bronze2" },
  { name: "Borislav Petrov", age: 13, gender: "M", group: "bronze2" },
  { name: "Callen Previll", age: 12, gender: "M", group: "bronze2" },
  { name: "Joseph Rams", age: 12, gender: "M", group: "bronze2" },
  { name: "Noah Rasmussen", age: 10, gender: "M", group: "bronze2", parentName: "Fernanda Rasmussen", parentPhone: "(561) 990-9925" },
  { name: "Olivia Rekosiewicz", age: 12, gender: "F", group: "bronze2" },
  // ── DIVING (6) ──
  { name: "Cecilia Brems", age: 14, gender: "F", group: "diving" },
  { name: "Millie Cochrane", age: 16, gender: "F", group: "diving" },
  { name: "Chase Korn", age: 13, gender: "M", group: "diving" },
  { name: "Sofia Kourjakian", age: 13, gender: "F", group: "diving" },
  { name: "Harper Mull", age: 15, gender: "F", group: "diving" },
  { name: "Justin Zeller", age: 9, gender: "M", group: "diving" },
  // ── WATER POLO (~57) ──
  { name: "Georgios Androutsopoulos", age: 14, gender: "M", group: "waterpolo", parentName: "Olga Androutsopoulos", parentPhone: "(314) 616-8304" },
  { name: "James Beatty", age: 16, gender: "M", group: "waterpolo", parentName: "Sally Beatty", parentPhone: "(312) 520-1785" },
  { name: "George Beatty", age: 13, gender: "M", group: "waterpolo", parentName: "Sally Beatty", parentPhone: "(312) 520-1785" },
  { name: "Elan Beker", age: 15, gender: "M", group: "waterpolo" },
  { name: "Aiden Breit", age: 13, gender: "M", group: "waterpolo", parentName: "Paula Breit", parentPhone: "(917) 626-2218" },
  { name: "Grace Brinley", age: 16, gender: "F", group: "waterpolo" },
  { name: "Dimitri Buslayev", age: 11, gender: "M", group: "waterpolo", parentName: "Liya Buslayev", parentPhone: "(917) 669-1548" },
  { name: "Xavier Dicoi", age: 12, gender: "M", group: "waterpolo", parentName: "Derrick Dicoi", parentPhone: "(561) 565-8869" },
  { name: "Pedro Drumond Galati", age: 14, gender: "M", group: "waterpolo", parentName: "Aline Drumond", parentPhone: "(305) 989-0035" },
  { name: "Jack Durocher", age: 13, gender: "M", group: "waterpolo", parentName: "Patrick Durocher", parentPhone: "(561) 243-2035" },
  { name: "Christopher Durocher", age: 10, gender: "M", group: "waterpolo" },
  { name: "Aram Egiazarian", age: 12, gender: "M", group: "waterpolo", parentName: "Aram Egiazarian", parentPhone: "(561) 618-8963" },
  { name: "Leo Falkin", age: 14, gender: "M", group: "waterpolo", parentName: "Jamie Falkin", parentPhone: "(561) 271-4607" },
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

// Practice sessions per week by roster group (from real schedules)
// Practice targets per group (from actual schedule)
const WEEK_TARGETS: Record<string, { pool: number; weight: number }> = {
  platinum: { pool: 9, weight: 3 }, gold: { pool: 6, weight: 0 }, silver: { pool: 6, weight: 0 },
  bronze1: { pool: 6, weight: 0 }, bronze2: { pool: 4, weight: 0 }, diving: { pool: 4, weight: 0 }, waterpolo: { pool: 5, weight: 0 },
};
const WEEK_TARGETS_TOTAL: Record<string, number> = Object.fromEntries(
  Object.entries(WEEK_TARGETS).map(([k, v]) => [k, v.pool + v.weight])
);
function getWeekTarget(group: string): number {
  const key = group.toLowerCase().replace(/\s+/g, "").replace("bronze 1", "bronze1").replace("bronze 2", "bronze2").replace("water polo", "waterpolo");
  return WEEK_TARGETS_TOTAL[key] ?? 5;
}

function makeAthlete(r: RosterEntry & { group?: string }): Athlete {
  const g = r.group ?? "Varsity";
  return {
    id: r.name.toLowerCase().replace(/\s+/g, "-"),
    name: r.name, age: r.age, gender: r.gender, group: g,
    xp: 0, streak: 0, weightStreak: 0, lastStreakDate: "", lastWeightStreakDate: "",
    totalPractices: 0, weekSessions: 0, weekWeightSessions: 0, weekTarget: getWeekTarget(g),
    checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {},
    weightChallenges: {}, quests: {},
    dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 },
    birthday: r.birthday ?? "",
    usaSwimmingId: r.usaSwimmingId ?? "",
    parentCode: generateParentCode(),
    parentName: r.parentName ?? "",
    parentEmail: r.parentEmail ?? "",
    parentPhone: r.parentPhone ?? "",
    sport: "swimming",
    present: false,
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
  MEETS: "apex-meets-v1",
  SESSION_HISTORY: "apex-session-history-v1",
  LAST_SESSION_ID: "apex-last-session-id",
  LAST_ACTIVITY_TS: "apex-last-activity-ts",
};

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

// ── reusable card component — sci-fi game panel (outside component to prevent remount on re-render) ─
const Card = ({ children, className = "", glow = false, neon = false }: { children: React.ReactNode; className?: string; glow?: boolean; neon?: boolean }) => (
  <div className={`game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] ${glow ? "neon-pulse" : ""} ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}>{children}</div>
);

// ── ambient background — sci-fi nebula + star field (stable across re-renders) ─
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
  const [autoSession, setAutoSession] = useState(true); // auto-detect from schedule
  const [leaderTab, setLeaderTab] = useState<"all" | "M" | "F">("all");
  const [view, setView] = useState<"coach" | "parent" | "audit" | "analytics" | "schedule" | "wellness" | "strategy" | "meets" | "comms">("coach");
  const [activeCoach, setActiveCoach] = useState<string>("Coach");
  const [activeCoachGroups, setActiveCoachGroups] = useState<string[]>(["all"]);

  // ── Bulk undo + More menu state ─────────────────────────────
  const [bulkUndoVisible, setBulkUndoVisible] = useState(false);
  const [bulkUndoSnapshot, setBulkUndoSnapshot] = useState<Athlete[] | null>(null);
  const bulkUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void } | null>(null);

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
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);
  const [viewingSession, setViewingSession] = useState<SessionRecord | null>(null);
  const lastSessionIdRef = useRef<string>("");
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
  const [meetGroupFilter, setMeetGroupFilter] = useState<GroupId | "all">("all");
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
  const [newCoachGroups, setNewCoachGroups] = useState<string[]>(["all"]);

  // ── Sync status state ──
  const [syncBusy, setSyncBusy] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; errors: number } | null>(null);

  // ── Invite link state ──
  const [inviteCoachName, setInviteCoachName] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

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
  const [meetView, setMeetView] = useState<"overview" | "sessions" | "entries" | "info">("overview");
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [meetDescription, setMeetDescription] = useState("");
  const [viewingAthleteEntries, setViewingAthleteEntries] = useState<string | null>(null);
  const [allBroadcasts, setAllBroadcasts] = useState<{ id: string; message: string; timestamp: string; from: string; group: string }[]>([]);
  const [commsMsg, setCommsMsg] = useState("");
  const [commsGroup, setCommsGroup] = useState<"all" | GroupId>("all");
  const [absenceReports, setAbsenceReports] = useState<{ id: string; athleteId: string; athleteName: string; reason: string; dateStart: string; dateEnd: string; note: string; submitted: string; group: string }[]>([]);

  // ── best times state ──
  const [fetchingTimes, setFetchingTimes] = useState<string | null>(null); // athleteId currently fetching
  const [fetchingTimesAll, setFetchingTimesAll] = useState(false);
  const [bestTimesStatus, setBestTimesStatus] = useState<string | null>(null);

  // Helper: get best time for a specific athlete/event/stroke/course
  const getAthletesBestTime = useCallback((athleteId: string, event: string, stroke: string, course: "SCY" | "SCM" | "LCM" = "SCY"): BestTime | null => {
    const athlete = roster.find(a => a.name === athleteId || a.id === athleteId);
    if (!athlete?.bestTimes) return null;
    return athlete.bestTimes.find(t => t.event === event && t.stroke === stroke && t.course === course) || null;
  }, [roster]);

  // Helper: parse time string to seconds
  const parseTimeToSecs = (t: string): number => {
    if (!t) return 0;
    const clean = t.replace(/[^0-9:.]/g, "").trim();
    const parts = clean.split(":");
    if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    return parseFloat(clean) || 0;
  };

  // Helper: normalize stroke names for comparison between Hy-Tek (abbreviated) and SwimCloud (full)
  // Hy-Tek uses: "Free", "Back", "Breast", "Fly", "IM"
  // SwimCloud uses: "Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"
  const normalizeStrokeForMatch = (s: string): string => {
    if (!s) return "";
    const lower = s.toLowerCase().trim();
    if (lower === "free" || lower === "freestyle") return "free";
    if (lower === "back" || lower === "backstroke") return "back";
    if (lower === "breast" || lower === "breaststroke") return "breast";
    if (lower === "fly" || lower === "butterfly") return "fly";
    if (lower === "im" || lower === "individual medley") return "im";
    return lower;
  };

  // Course conversion factors (USA Swimming standard approximations)
  // These convert times FROM source course TO target course
  const courseConvert = (secs: number, from: "SCY"|"SCM"|"LCM", to: "SCY"|"SCM"|"LCM"): number => {
    if (from === to) return secs;
    // SCY ↔ LCM
    if (from === "SCY" && to === "LCM") return secs * 1.11;
    if (from === "LCM" && to === "SCY") return secs * 0.9;
    // SCY ↔ SCM
    if (from === "SCY" && to === "SCM") return secs * 1.03;
    if (from === "SCM" && to === "SCY") return secs * 0.97;
    // LCM ↔ SCM
    if (from === "LCM" && to === "SCM") return secs * 0.97;
    if (from === "SCM" && to === "LCM") return secs * 1.03;
    return secs;
  };

  const formatSecsToTime = (secs: number): string => {
    if (secs >= 60) {
      const mins = Math.floor(secs / 60);
      const rest = (secs - mins * 60).toFixed(2).padStart(5, "0");
      return `${mins}:${rest}`;
    }
    return secs.toFixed(2);
  };

  // Helper: find an athlete's best time for a given event, handling stroke name normalization
  // Tries exact course match first, then converts from other courses if needed
  const findMatchingBestTime = (bestTimes: BestTime[] | undefined, distance: number | undefined, stroke: string | undefined, course: "SCY" | "SCM" | "LCM" = "SCY"): BestTime | null => {
    if (!bestTimes || !distance || !stroke) return null;
    const normStroke = normalizeStrokeForMatch(stroke);
    const distStr = String(distance);
    const matches = bestTimes.filter(t => t.event === distStr && normalizeStrokeForMatch(t.stroke) === normStroke);
    if (matches.length === 0) return null;
    // Prefer exact course match
    const exactCourse = matches.find(t => t.course === course);
    if (exactCourse) return exactCourse;
    // Convert from other courses and return the fastest equivalent
    const converted = matches.map(t => ({
      ...t,
      seconds: courseConvert(t.seconds, t.course, course),
      time: formatSecsToTime(courseConvert(t.seconds, t.course, course)),
      course,
      _originalCourse: t.course,
      _originalTime: t.time,
    }));
    converted.sort((a, b) => a.seconds - b.seconds);
    return converted[0] || null;
  };

  // Fetch best times from SwimCloud for a single athlete
  const fetchBestTimes = useCallback(async (athlete: Athlete) => {
    if (!athlete.name) return;
    setFetchingTimes(athlete.id);
    try {
      const res = await fetch("/api/swimcloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: athlete.name, usaSwimmingId: athlete.usaSwimmingId }),
      });
      const data = await res.json();
      if (data.times && data.times.length > 0) {
        const updated = roster.map(a => {
          if (a.id !== athlete.id) return a;
          return { ...a, bestTimes: data.times, bestTimesUpdated: new Date().toISOString().slice(0, 10) };
        });
        setRoster(updated);
        save(K.ROSTER, updated);
        syncSaveRoster(K.ROSTER, selectedGroup, updated);
        setBestTimesStatus(`${data.times.length} times found for ${athlete.name}`);
      } else {
        setBestTimesStatus(data.message || `No times found for ${athlete.name}`);
      }
    } catch {
      setBestTimesStatus(`Error fetching times for ${athlete.name}`);
    } finally {
      setFetchingTimes(null);
      setTimeout(() => setBestTimesStatus(null), 4000);
    }
  }, [roster]);

  // Fetch best times for all athletes in the current group
  const fetchAllBestTimes = useCallback(async () => {
    setFetchingTimesAll(true);
    setBestTimesStatus("Fetching times for all athletes...");
    let found = 0;
    let failed = 0;
    const athletes = roster.filter(a => a.group === selectedGroup && a.sport !== "diving" && a.sport !== "waterpolo");
    for (const athlete of athletes) {
      try {
        const res = await fetch("/api/swimcloud", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: athlete.name, usaSwimmingId: athlete.usaSwimmingId }),
        });
        const data = await res.json();
        if (data.times && data.times.length > 0) {
          found++;
          setRoster(prev => {
            const updated = prev.map(a => a.id !== athlete.id ? a : { ...a, bestTimes: data.times, bestTimesUpdated: new Date().toISOString().slice(0, 10) });
            save(K.ROSTER, updated);
            syncSaveRoster(K.ROSTER, selectedGroup, updated);
            return updated;
          });
        } else {
          failed++;
        }
        setBestTimesStatus(`Fetching... ${found + failed}/${athletes.length} (${found} found)`);
        // Rate limit — don't hammer SwimCloud
        await new Promise(r => setTimeout(r, 800));
      } catch {
        failed++;
      }
    }
    setBestTimesStatus(`Done! ${found} athletes with times, ${failed} not found`);
    setFetchingTimesAll(false);
    setTimeout(() => setBestTimesStatus(null), 6000);
  }, [roster, selectedGroup]);

  const saveCoaches = useCallback((c: CoachAccess[]) => { setCoaches(c); save(K.COACHES, c); }, []);
  const addCoach = useCallback(() => {
    if (!newCoachName.trim() || !newCoachPin.trim() || newCoachPin.length < 4) return;
    const groups = newCoachRole === "head" ? ["all"] : newCoachGroups.filter(x => x !== "all");
    if (newCoachRole === "assistant" && groups.length === 0) return;
    const c: CoachAccess = { id: `coach-${Date.now()}`, name: newCoachName.trim(), pin: newCoachPin, groups, role: newCoachRole, createdAt: Date.now() };
    saveCoaches([...coaches, c]);
    setNewCoachName(""); setNewCoachPin(""); setNewCoachRole("assistant"); setNewCoachGroups([]);
  }, [newCoachName, newCoachPin, newCoachRole, newCoachGroups, coaches, saveCoaches]);
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

  // ── notification state ──────────────────────────────────
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(new Set());

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
    // Force-migrate old default PIN or empty → current default
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
    setSessionHistory(load<SessionRecord[]>(K.SESSION_HISTORY, []));
    lastSessionIdRef.current = load<string>(K.LAST_SESSION_ID, "");
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
    // Load meets + comms
    // Load meets + auto-migrate broken event data from old parser
    const loadedMeets = load<SwimMeet[]>(K.MEETS, []);
    const CURRENT_PARSER_VERSION = 4;
    const migratedMeets = loadedMeets.map(m => {
      // Check if events have broken data: no distance, all same stroke, all "Mixed" gender, or generic "Free" names
      const hasBrokenEvents = m.events.length > 3 && (
        m.events.every(ev => !ev.distance || ev.distance === 0) ||
        m.events.every(ev => ev.gender === "Mixed") ||
        m.events.filter(ev => ev.stroke === "Free" || !ev.stroke).length > m.events.length * 0.8
      );
      // Version check: force re-parse if parsed with older version
      const needsVersionUpgrade = m.parserVersion !== CURRENT_PARSER_VERSION && m.events.length > 0;
      if (!hasBrokenEvents && !needsVersionUpgrade) return m;
      // Try to re-parse from stored source file
      const sourceFile = (m.files || []).find(f => /\.(hy3|ev3|hyv|cl2|sd3)$/i.test(f.name) || f.name.startsWith("file_"));
      if (!sourceFile || !sourceFile.dataUrl) return m;
      try {
        // Decode base64 data URL
        let text = "";
        if (sourceFile.dataUrl.startsWith("data:")) {
          const b64 = sourceFile.dataUrl.split(",")[1] || "";
          text = decodeURIComponent(escape(atob(b64)));
        }
        if (!text || text.length < 20) return m;
        // Inline mini-parser for migration (same logic as parseMeetFile)
        let normalized = text;
        if (normalized.charCodeAt(0) === 0xFEFF) normalized = normalized.slice(1);
        const rawL = normalized.split(/\r?\n/).filter(l => l.trim().length > 2);
        if (rawL.length < 3 && normalized.includes("*>")) normalized = normalized.replace(/\*>/g, "\n");
        const lines = normalized.split(/\r?\n/).map(l => l.replace(/\*>\s*$/, "").trim()).filter(l => l.length > 2);
        if (lines.length < 2 || !lines[0].includes(";")) return m;
        // Detect format
        const hf = lines[0].split(";");
        const f1 = (hf[1] || "").trim();
        const f1IsDate = /^\d{2}\/\d{2}\/\d{4}$/.test(f1);
        let ext = "hy3";
        if (f1IsDate) { ext = "ev3"; } else {
          const sl = lines[1]?.split(";") || [];
          const f1of2 = (sl[1] || "").trim().toUpperCase();
          if (f1of2 === "P" || f1of2 === "F") ext = "ev3";
        }
        const sMap: Record<string, string> = { A: "Free", B: "Back", C: "Breast", D: "Fly", E: "IM" };
        const sMapN: Record<string, string> = { "1": "Free", "2": "Back", "3": "Breast", "4": "Fly", "5": "IM", "6": "Free Relay", "7": "Medley Relay" };
        const newEvents: MeetEvent[] = [];
        for (let i = 1; i < lines.length; i++) {
          const r = lines[i].split(";");
          if (r.length < 7) continue;
          const evNum = parseInt(r[0]) || i;
          let dist = "", strokeName = "", gender: "M" | "F" | "Mixed" = "Mixed";
          let sessType = "", qualTime = "", cutTimeV = "", isRelay = false;
          let dayNum: number | undefined;
          if (ext === "ev3") {
            dist = (r[6] || "").trim(); const sn = (r[7] || "1").trim();
            const gc = (r[2] || "").toUpperCase().trim(); sessType = (r[1] || "").toUpperCase().trim();
            isRelay = (r[3] || "").toUpperCase().trim() === "R";
            strokeName = isRelay ? (sn === "1" || sn === "6" ? "Free Relay" : "Medley Relay") : (sMapN[sn] || "Free");
            gender = gc === "M" ? "M" : gc === "F" ? "F" : "Mixed"; qualTime = (r[9] || "").trim();
          } else {
            dist = (r[8] || "").trim(); const sc = (r[9] || "A").trim().toUpperCase();
            const gc = (r[5] || "").toUpperCase().trim(); sessType = (r[2] || "").toUpperCase().trim();
            isRelay = (r[4] || "").toUpperCase().trim() === "R";
            strokeName = isRelay ? (sc === "A" ? "Free Relay" : "Medley Relay") : (sMap[sc] || "Free");
            gender = gc === "M" ? "M" : (gc === "W" || gc === "F") ? "F" : "Mixed";
            qualTime = (r[16] || "").trim() || (r[15] || "").trim() || (r[17] || "").trim();
            cutTimeV = (r[20] || "").trim() || (r[21] || "").trim() || (r[19] || "").trim();
            dayNum = parseInt(r[23] || "") || undefined;
          }
          const gLabel = gender === "F" ? "Girls" : gender === "M" ? "Boys" : "";
          const sLabel = sessType === "P" ? "Prelims" : sessType === "F" ? "Finals" : "";
          const dStr = dist && dist !== "0" ? `${dist} ` : "";
          const name = `${gLabel ? gLabel + " " : ""}${dStr}${strokeName}${sLabel ? " (" + sLabel + ")" : ""}`.trim();
          // Preserve existing entries from old event at same index
          const oldEv = m.events[i - 1];
          newEvents.push({
            id: oldEv?.id || `ev-import-${evNum}`, name: name || `Event ${evNum}`,
            eventNum: evNum, gender, distance: parseInt(dist) || undefined, stroke: strokeName,
            sessionType: (sessType === "P" || sessType === "F") ? sessType as "P" | "F" : undefined,
            isRelay, qualifyingTime: qualTime || cutTimeV || undefined,
            cutTime: cutTimeV && qualTime && cutTimeV !== qualTime ? cutTimeV : undefined,
            dayNumber: dayNum, entries: oldEv?.entries || [],
          });
        }
        if (newEvents.length > 0) return { ...m, events: newEvents, parserVersion: CURRENT_PARSER_VERSION };
      } catch { /* migration failed, keep original */ }
      return m;
    });
    if (JSON.stringify(migratedMeets) !== JSON.stringify(loadedMeets)) {
      save(K.MEETS, migratedMeets);
    }
    setMeets(migratedMeets);
    try { setAllBroadcasts(JSON.parse(localStorage.getItem("apex-broadcasts-v1") || "[]")); } catch { /* */ }
    try { setAbsenceReports(JSON.parse(localStorage.getItem("apex-absences-v1") || "[]")); } catch { /* */ }
    // Read ?invite= param for auto-fill on PIN screen
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get("invite");
      if (invite) setInviteCoachName(decodeURIComponent(invite));
    }
    setMounted(true);
    // Auto-sync localStorage → Firestore on first load
    if (firebaseConnected) {
      syncPushAllToFirebase().then(({ synced, errors }) => {
        if (synced > 0) console.log(`[Sync] Auto-pushed ${synced} items to Firestore`);
        if (errors > 0) console.warn(`[Sync] ${errors} sync errors`);
      });
    }
  }, []);

  // ── auto-detect AM/PM + session mode from schedule ─────
  useEffect(() => {
    if (!mounted || !autoSession || schedules.length === 0) return;
    const detect = () => {
      // Don't auto-switch if athletes are already checked in — coach is in an active session
      const ga = roster.filter(a => a.group === selectedGroup);
      const hasActiveCheckins = ga.some(a =>
        a.present ||
        Object.values(a.checkpoints).some(Boolean) ||
        Object.values(a.weightCheckpoints).some(Boolean) ||
        Object.values(a.meetCheckpoints).some(Boolean)
      );
      if (hasActiveCheckins) return; // respect the coach's current session

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
      // If no active session, pick the next upcoming one ONLY if within 60 min
      if (!best) {
        for (const sess of daySched.sessions) {
          const [sh, sm] = sess.startTime.split(":").map(Number);
          const startMins = sh * 60 + sm;
          if (startMins > nowMins && startMins - nowMins <= 60) {
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
        // No sessions active or upcoming soon — default by current time of day
        setSessionTime(now.getHours() < 12 ? "am" : "pm");
      }
    };
    detect();
    const iv = setInterval(detect, 60000); // re-check every minute
    return () => clearInterval(iv);
  }, [mounted, autoSession, schedules, selectedGroup, roster]);

  // ── auto-reset between sessions ───────────
  // Checks on load AND every 2 min: if check-in data exists and either
  // (a) date changed or (b) 90+ min since last activity, snapshot + clear.
  const doSessionReset = useCallback(() => {
    if (roster.length === 0) return;
    const groupAthletes = roster.filter(a => a.group === selectedGroup);
    const hasAnyCheckins = groupAthletes.some(a =>
      a.present ||
      Object.values(a.checkpoints).some(Boolean) ||
      Object.values(a.weightCheckpoints).some(Boolean) ||
      Object.values(a.meetCheckpoints).some(Boolean)
    );
    if (!hasAnyCheckins) return;

    const lastActivityTs = load<number>(K.LAST_ACTIVITY_TS, 0);
    const lastSessionId = load<string>(K.LAST_SESSION_ID, "");
    const now = Date.now();
    const minutesSinceActivity = lastActivityTs > 0 ? (now - lastActivityTs) / 60000 : 99999;
    const lastDate = lastSessionId ? lastSessionId.slice(0, 10) : "";
    const todayStr = today();
    const dateChanged = lastDate !== "" && lastDate !== todayStr;
    const stale = minutesSinceActivity >= 90; // 90 min gap = new session

    if (!dateChanged && !stale) return;

    const sessionId = lastSessionId || `${todayStr}-unknown-${selectedGroup}`;
    // Resolve actual AM/PM from the session start time
    const sessionStartTime = lastActivityTs || now - 7200000;
    const resolvedAmPm: "am" | "pm" = new Date(sessionStartTime).getHours() < 12 ? "am" : "pm";
    const sessionRecord: SessionRecord = {
      id: sessionId,
      date: lastDate || todayStr,
      group: selectedGroup,
      sessionTime: resolvedAmPm,
      sessionMode: sessionMode,
      startedAt: sessionStartTime,
      endedAt: lastActivityTs || now,
      presentAthletes: groupAthletes.filter(a => a.present || Object.values(a.checkpoints).some(Boolean)).map(a => a.id),
      checkpoints: Object.fromEntries(groupAthletes.map(a => [a.id, { ...a.checkpoints }])),
      weightCheckpoints: Object.fromEntries(groupAthletes.map(a => [a.id, { ...a.weightCheckpoints }])),
      xpAwarded: Object.fromEntries(groupAthletes.map(a => [a.id, a.dailyXP.date === todayStr ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0])),
      totalAttendance: groupAthletes.filter(a => a.present || Object.values(a.checkpoints).some(Boolean)).length,
      totalAthletes: groupAthletes.length,
      notes: "",
    };

    setSessionHistory(prev => {
      // Merge by date + group + AM/PM — one session per practice slot, always overrides
      const slotKey = `${sessionRecord.date}-${sessionRecord.group}-${sessionRecord.sessionTime}`;
      const updated = [...prev.filter(s => {
        const sSlot = `${s.date}-${s.group}-${s.sessionTime}`;
        return sSlot !== slotKey;
      }), sessionRecord].slice(-200);
      save(K.SESSION_HISTORY, updated);
      return updated;
    });

    const cleared = roster.map(a => {
      if (a.group !== selectedGroup) return a;
      return { ...a, present: false, checkpoints: {} as Record<string, boolean>, weightCheckpoints: {} as Record<string, boolean>, meetCheckpoints: {} as Record<string, boolean> };
    });
    setRoster(cleared);
    save(K.ROSTER, cleared);
    syncSaveRoster(K.ROSTER, selectedGroup, cleared);
    const newId = `${todayStr}-${new Date().getHours().toString().padStart(2, "0")}:${new Date().getMinutes().toString().padStart(2, "0")}-${selectedGroup}`;
    lastSessionIdRef.current = newId;
    save(K.LAST_SESSION_ID, newId);
    save(K.LAST_ACTIVITY_TS, now);
  }, [roster, selectedGroup, sessionMode]);

  // Run reset check on mount, every 2 min, AND when page becomes visible (iOS background tab)
  useEffect(() => {
    if (!mounted || roster.length === 0) return;
    doSessionReset(); // run immediately on mount
    const iv = setInterval(doSessionReset, 120000);
    const onVisible = () => { if (document.visibilityState === "visible") doSessionReset(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, [mounted, roster, doSessionReset]);

  // ── manual end session (used by prominent button + menu) ──
  const endSessionManual = useCallback(() => {
    const groupAthletes = roster.filter(a => a.group === selectedGroup);
    const hasCheckins = groupAthletes.some(a => a.present || Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean) || Object.values(a.meetCheckpoints).some(Boolean));
    if (!hasCheckins) return;
    const sid = lastSessionIdRef.current || `${today()}-manual-${selectedGroup}`;
    const todayStr = today();
    const manualStartTs = load<number>(K.LAST_ACTIVITY_TS, Date.now());
    const manualAmPm: "am" | "pm" = new Date(manualStartTs).getHours() < 12 ? "am" : "pm";
    const rec: SessionRecord = { id: sid, date: todayStr, group: selectedGroup, sessionTime: manualAmPm, sessionMode, startedAt: manualStartTs, endedAt: Date.now(), presentAthletes: groupAthletes.filter(a => a.present || Object.values(a.checkpoints).some(Boolean)).map(a => a.id), checkpoints: Object.fromEntries(groupAthletes.map(a => [a.id, { ...a.checkpoints }])), weightCheckpoints: Object.fromEntries(groupAthletes.map(a => [a.id, { ...a.weightCheckpoints }])), xpAwarded: Object.fromEntries(groupAthletes.map(a => [a.id, a.dailyXP.date === todayStr ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0])), totalAttendance: groupAthletes.filter(a => a.present || Object.values(a.checkpoints).some(Boolean)).length, totalAthletes: groupAthletes.length, notes: "" };
    setSessionHistory(prev => {
      const slotKey = `${rec.date}-${rec.group}-${rec.sessionTime}`;
      const u = [...prev.filter(s => { const k = `${s.date}-${s.group}-${s.sessionTime}`; return k !== slotKey; }), rec].slice(-200);
      save(K.SESSION_HISTORY, u); return u;
    });
    const cleared = roster.map(a => a.group !== selectedGroup ? a : { ...a, present: false, checkpoints: {} as Record<string, boolean>, weightCheckpoints: {} as Record<string, boolean>, meetCheckpoints: {} as Record<string, boolean> });
    setRoster(cleared); save(K.ROSTER, cleared); syncSaveRoster(K.ROSTER, selectedGroup, cleared);
    const newSid = `${todayStr}-${new Date().getHours().toString().padStart(2, "0")}:${new Date().getMinutes().toString().padStart(2, "0")}-${selectedGroup}-new`;
    lastSessionIdRef.current = newSid; save(K.LAST_SESSION_ID, newSid); save(K.LAST_ACTIVITY_TS, Date.now());
  }, [roster, selectedGroup, sessionMode]);

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
        const r = [...prev]; r[idx] = a; save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r); return r;
      }
      cps[cpId] = true; a[cpMap] = cps;
      const { newAthlete, awarded } = awardXP(a, cpXP, category);
      let final = { ...newAthlete, [cpMap]: cps };
      // Increment streak once per day on Practice Complete (pool) or Showed Up (weight)
      if (category === "pool" && cpId === "practice-complete" && final.lastStreakDate !== today()) {
        final = { ...final, streak: final.streak + 1, lastStreakDate: today(), totalPractices: final.totalPractices + 1, weekSessions: final.weekSessions + 1 };
        // Fire streak milestone notifications
        if (final.streak === 7) addNotification("STREAK_WARNING", "7-Day Streak!", `${final.name} just hit a 7-day streak! Silver tier unlocked.`, "coach");
        if (final.streak === 30) addNotification("STREAK_WARNING", "30-Day Streak!", `${final.name} hit a legendary 30-day streak! 2.0x multiplier active.`, "coach");
        if (final.streak === 90) addNotification("STREAK_WARNING", "90-Day Streak!", `${final.name} achieved a mythic 90-day streak!`, "coach");
      }
      if (category === "weight" && cpId === "showed-up" && final.lastWeightStreakDate !== today()) {
        final = { ...final, weightStreak: final.weightStreak + 1, lastWeightStreakDate: today(), weekWeightSessions: final.weekWeightSessions + 1 };
      }
      // Check for level-up and fire notification
      const oldLv = getLevel(a.xp);
      const newLv = getLevel(final.xp);
      if (newLv.name !== oldLv.name) {
        addNotification("LEVEL_UP", "Level Up!", `${final.name} just reached ${newLv.name.toUpperCase()} level!`, "coach");
      }
      addAudit(final.id, final.name, `Checked: ${cpId}`, awarded);
      if (e) spawnXpFloat(awarded, e);
      const r = [...prev]; r[idx] = final; save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r);
      save(K.LAST_ACTIVITY_TS, Date.now()); // track activity for auto-reset
      const sid = `${today()}-${new Date().getHours().toString().padStart(2, "0")}:${new Date().getMinutes().toString().padStart(2, "0")}-${selectedGroup}`;
      if (!lastSessionIdRef.current || !lastSessionIdRef.current.startsWith(today())) { lastSessionIdRef.current = sid; save(K.LAST_SESSION_ID, sid); }
      return r;
    });
  }, [awardXP, addAudit, spawnXpFloat, selectedGroup]);

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
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r); return r;
    });
  }, [awardXP, addAudit, spawnXpFloat, selectedGroup]);

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
        // Quest completion notification
        const questDef = QUEST_DEFS.find(q => q.id === qId);
        addNotification("QUEST_APPROVED", "Quest Complete!", `${a.name} completed "${questDef?.name || qId}" (+${awarded} XP)`, "coach");
      }
      addAudit(a.id, a.name, `Quest ${qId}: ${next}`, awarded);
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r); return r;
    });
  }, [awardXP, addAudit, spawnXpFloat, selectedGroup]);

  const denyQuest = useCallback((athleteId: string, qId: string) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const a = { ...prev[idx], quests: { ...prev[idx].quests } };
      a.quests[qId] = "pending";
      addAudit(a.id, a.name, `Quest denied: ${qId}`, 0);
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r); return r;
    });
  }, [addAudit, selectedGroup]);

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

  const togglePresent = useCallback((athleteId: string) => {
    const gDef = ROSTER_GROUPS.find(g => g.id === selectedGroup) || ROSTER_GROUPS[0];
    const sportCPs = sessionMode === "pool" ? getCPsForSport(gDef.sport) : sessionMode === "weight" ? WEIGHT_CPS : MEET_CPS;
    // For pool: only auto-check Tier 1 IDs. For weight/meet: auto-check all.
    const autoCPs = sessionMode === "pool" ? sportCPs.filter(cp => AUTO_CHECK_IDS.has(cp.id)) : sportCPs;
    const cpMapKey = sessionMode === "pool" ? "checkpoints" : sessionMode === "weight" ? "weightCheckpoints" : "meetCheckpoints";
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const wasPresent = prev[idx].present;
      let a = { ...prev[idx] };
      if (!wasPresent) {
        a.present = true;
        const newCPs: Record<string, boolean> = { ...(a as any)[cpMapKey] };
        let totalAwarded = 0;
        const { newAthlete: a1, awarded: baseAwarded } = awardXP(a, PRESENT_XP, sessionMode === "meet" ? "meet" : sessionMode);
        a = { ...a1 };
        totalAwarded += baseAwarded;
        // Only auto-check Tier 1 checkpoints
        for (const cp of autoCPs) {
          if (!newCPs[cp.id]) {
            newCPs[cp.id] = true;
            const { newAthlete: aN, awarded } = awardXP(a, cp.xp, sessionMode === "meet" ? "meet" : sessionMode);
            a = { ...aN };
            totalAwarded += awarded;
          }
        }
        a = { ...a, [cpMapKey]: newCPs };
        const streakAlreadyCounted = prev[idx].lastStreakDate === today();
        if (!streakAlreadyCounted) {
          a = { ...a, streak: a.streak + 1, lastStreakDate: today(), totalPractices: a.totalPractices + 1, weekSessions: a.weekSessions + 1 };
        }
        addAudit(a.id, a.name, `Present (basics auto-checked)`, totalAwarded);
      } else {
        // MARKING ABSENT → uncheck ALL checkpoints (Tier 1 + any manual Tier 2) + revert XP
        a.present = false;
        const oldCPs: Record<string, boolean> = { ...(a as any)[cpMapKey] };
        const mult = sessionMode === "weight" ? getWeightStreakMult(a.weightStreak) : getStreakMult(a.streak);
        let totalReverted = 0;
        for (const cp of sportCPs) {
          if (oldCPs[cp.id]) {
            oldCPs[cp.id] = false;
            const reverted = Math.round(cp.xp * mult);
            a.xp = Math.max(0, a.xp - reverted);
            totalReverted += reverted;
          }
        }
        const baseReverted = Math.round(PRESENT_XP * mult);
        a.xp = Math.max(0, a.xp - baseReverted);
        if (a.dailyXP.date === today()) {
          const sport = sessionMode === "meet" ? "meet" : sessionMode;
          a.dailyXP = { ...a.dailyXP, [sport]: Math.max(0, (a.dailyXP as any)[sport] - (baseReverted + totalReverted)) };
        }
        a = { ...a, [cpMapKey]: oldCPs };
        addAudit(a.id, a.name, `Absent (undone)`, -(baseReverted + totalReverted));
      }
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r); return r;
    });
  }, [awardXP, addAudit, selectedGroup, sessionMode]);

  const giveShoutout = useCallback((athleteId: string, e?: React.MouseEvent) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const a = { ...prev[idx] };
      const { newAthlete, awarded } = awardXP(a, SHOUTOUT_XP, "pool");
      addAudit(newAthlete.id, newAthlete.name, "Shoutout", awarded);
      if (e) spawnXpFloat(awarded, e);
      const r = [...prev]; r[idx] = newAthlete; save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r); return r;
    });
  }, [awardXP, addAudit, spawnXpFloat, selectedGroup]);

  const bulkMarkPresent = useCallback(() => {
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
        const newCPs: Record<string, boolean> = { ...(athlete as any)[cpMapKey] };
        let totalAwarded = 0;
        const { newAthlete: a1, awarded: baseAwarded } = awardXP(athlete, PRESENT_XP, sessionMode === "meet" ? "meet" : sessionMode);
        athlete = { ...a1 };
        totalAwarded += baseAwarded;
        // Only auto-check Tier 1 checkpoints
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
      save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r); return r;
    });
  }, [awardXP, addAudit, selectedGroup, roster, sessionMode]);

  const bulkUndoAll = useCallback(() => {
    if (!bulkUndoSnapshot) return;
    setRoster(bulkUndoSnapshot);
    save(K.ROSTER, bulkUndoSnapshot); syncSaveRoster(K.ROSTER, selectedGroup, bulkUndoSnapshot);
    addAudit("system", "System", "Bulk check-in undone", 0);
    setBulkUndoVisible(false);
    setBulkUndoSnapshot(null);
    if (bulkUndoTimer.current) clearTimeout(bulkUndoTimer.current);
  }, [bulkUndoSnapshot, addAudit, selectedGroup]);

  const undoLast = useCallback(() => {
    setAuditLog(prev => {
      if (!prev.length) return prev;
      const last = prev[0];
      if (last.xpDelta > 0) {
        setRoster(rPrev => {
          const idx = rPrev.findIndex(a => a.id === last.athleteId);
          if (idx < 0) return rPrev;
          const a = { ...rPrev[idx] };
          a.xp = Math.max(0, a.xp - last.xpDelta);
          if (a.dailyXP.date === today()) {
            a.dailyXP = { ...a.dailyXP, pool: Math.max(0, a.dailyXP.pool - last.xpDelta) };
          }
          const r = [...rPrev]; r[idx] = a; save(K.ROSTER, r); syncSaveRoster(K.ROSTER, selectedGroup, r); return r;
        });
      }
      const n = prev.slice(1); save(K.AUDIT, n); return n;
    });
  }, [selectedGroup]);

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
  const coachCanAccessGroup = useCallback((groupId: string) => activeCoachGroups.includes("all") || activeCoachGroups.includes(groupId), [activeCoachGroups]);
  const accessibleGroups = useMemo(() => ROSTER_GROUPS.filter(g => coachCanAccessGroup(g.id)), [coachCanAccessGroup]);
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

  const updateAthleteProfile = useCallback((athleteId: string, updates: Partial<Pick<Athlete, "birthday" | "usaSwimmingId" | "parentName" | "parentEmail" | "parentPhone" | "parentCode">>) => {
    setRoster(prev => {
      const next = prev.map(a => a.id === athleteId ? { ...a, ...updates } : a);
      save(K.ROSTER, next);
      syncSaveRoster(K.ROSTER, selectedGroup, next);
      return next;
    });
  }, [selectedGroup]);

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

  // ── notification generation (auto from roster data) ─────
  const notifications = useMemo((): AppNotification[] => {
    if (!mounted || roster.length === 0) return [];
    const notifs: AppNotification[] = [];
    const now = Date.now();
    const todayStr = today();

    // --- Streak warnings: athletes with streak > 0 but no check-in today ---
    for (const a of roster) {
      if (a.streak > 0 && a.lastStreakDate && a.lastStreakDate !== todayStr) {
        const last = new Date(a.lastStreakDate);
        const diffDays = Math.floor((new Date(todayStr).getTime() - last.getTime()) / 86400000);
        if (diffDays >= 1) {
          const groupDef = ROSTER_GROUPS.find(g => g.id === a.group);
          notifs.push({
            id: `streak-warn-${a.id}`,
            type: "streak-warning",
            priority: diffDays >= 2 ? "critical" : "high",
            title: "Streak at Risk",
            message: `${a.name}'s ${a.streak}-day streak is about to break -- ${diffDays} day${diffDays > 1 ? "s" : ""} since last check-in`,
            athleteId: a.id,
            group: groupDef?.name || a.group,
            timestamp: now - diffDays * 1000,
          });
        }
      }
    }

    // --- Level-up celebrations: athletes near or just crossed a level threshold ---
    for (const a of roster) {
      const currentLv = getLevel(a.xp);
      const nextLv = getNextLevel(a.xp);
      // Check if they recently leveled (XP is within 50 of threshold)
      if (currentLv.xp > 0 && a.xp - currentLv.xp < 50 && a.xp >= currentLv.xp) {
        const groupDef = ROSTER_GROUPS.find(g => g.id === a.group);
        notifs.push({
          id: `level-up-${a.id}-${currentLv.name}`,
          type: "level-up",
          priority: "medium",
          title: "Level Up!",
          message: `${a.name} just hit ${currentLv.name.toUpperCase()} level!`,
          athleteId: a.id,
          group: groupDef?.name || a.group,
          timestamp: now - 100,
        });
      }
      // Warn if close to next level (within 30 XP)
      if (nextLv && nextLv.xp - a.xp <= 30 && nextLv.xp - a.xp > 0) {
        const groupDef = ROSTER_GROUPS.find(g => g.id === a.group);
        notifs.push({
          id: `level-near-${a.id}-${nextLv.name}`,
          type: "level-up",
          priority: "low",
          title: "Almost There",
          message: `${a.name} is ${nextLv.xp - a.xp} XP away from ${nextLv.name.toUpperCase()}`,
          athleteId: a.id,
          group: groupDef?.name || a.group,
          timestamp: now - 200,
        });
      }
    }

    // --- Attendance alerts per group ---
    for (const g of ROSTER_GROUPS) {
      const groupAthletes = roster.filter(a => a.group === g.id);
      if (groupAthletes.length === 0) continue;
      const checkedIn = groupAthletes.filter(a =>
        Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)
      ).length;
      const rate = Math.round((checkedIn / groupAthletes.length) * 100);
      // Only flag groups with at least some athletes expected
      if (rate < 70 && groupAthletes.length >= 3) {
        notifs.push({
          id: `attendance-${g.id}-${todayStr}`,
          type: "attendance",
          priority: rate < 40 ? "critical" : "high",
          title: "Low Attendance",
          message: `${g.name} attendance at ${rate}% today (${checkedIn}/${groupAthletes.length})`,
          group: g.name,
          timestamp: now - 300,
        });
      }
    }

    // --- Quest completions ---
    for (const g of ROSTER_GROUPS) {
      const groupAthletes = roster.filter(a => a.group === g.id);
      for (const q of QUEST_DEFS) {
        const completed = groupAthletes.filter(a => a.quests[q.id] === "done").length;
        if (completed >= 2) {
          notifs.push({
            id: `quest-${q.id}-${g.id}`,
            type: "quest-completion",
            priority: "low",
            title: "Quest Completed",
            message: `${completed} athletes in ${g.name} completed '${q.name}'`,
            group: g.name,
            timestamp: now - 400,
          });
        }
      }
    }

    return notifs;
  }, [mounted, roster]);

  const activeNotifications = useMemo(() =>
    notifications
      .filter(n => !dismissedNotifs.has(n.id))
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.timestamp - a.timestamp),
    [notifications, dismissedNotifs]
  );

  const dismissNotification = useCallback((id: string) => {
    setDismissedNotifs(prev => new Set([...prev, id]));
  }, []);

  // ── bridge: sync computed notifications into shared localStorage system ──
  const prevNotifIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!mounted) return;
    const notifTypeMap: Record<string, "STREAK_WARNING" | "LEVEL_UP" | "QUEST_APPROVED" | "ATTRITION_RISK" | "MVP_ALERT"> = {
      "streak-warning": "STREAK_WARNING",
      "level-up": "LEVEL_UP",
      "attendance": "ATTRITION_RISK",
      "quest-completion": "QUEST_APPROVED",
    };
    for (const n of activeNotifications) {
      if (!prevNotifIdsRef.current.has(n.id)) {
        const mappedType = notifTypeMap[n.type] || "STREAK_WARNING";
        addNotification(mappedType, n.title, n.message, "coach");
      }
    }
    prevNotifIdsRef.current = new Set(activeNotifications.map(n => n.id));
  }, [activeNotifications, mounted]);

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

  // Card + BgOrbs are now defined outside the component to prevent remount on re-render

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
  // BgOrbs is now defined outside the component

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
    const match = coaches.find(c => c.pin === pinInput);
    if (match) {
      setUnlocked(true); setPinError(false); setActiveCoach(match.name); setActiveCoachGroups(match.groups);
      // Auto-select first allowed group if current selection is not allowed
      if (!match.groups.includes("all") && !match.groups.includes(selectedGroup)) {
        const firstAllowed = match.groups[0] as GroupId;
        if (firstAllowed) switchGroup(firstAllowed);
      }
      try { sessionStorage.setItem("apex-coach-auth", "1"); localStorage.setItem("apex-coach-auth", Date.now().toString()); } catch {}
    }
    else if (pinInput === coachPin) { setUnlocked(true); setPinError(false); setActiveCoach("Head Coach"); setActiveCoachGroups(["all"]); try { sessionStorage.setItem("apex-coach-auth", "1"); localStorage.setItem("apex-coach-auth", Date.now().toString()); } catch {} }
    else setPinError(true);
  };
  const resetPin = () => { setCoachPin("2451"); save(K.PIN, "2451"); setPinInput(""); setPinError(false); };

  if (!unlocked && (view === "coach" || view === "schedule")) {
    return (
      <div className="min-h-screen bg-[#06020f] flex items-center justify-center p-6 relative overflow-hidden">
        <BgOrbs />
        <div className="text-center max-w-xs w-full relative z-10">
          {/* HUD access terminal */}
          <div className="game-panel game-panel-border relative bg-[#06020f]/90 p-10 mb-6">
            <h1 className="text-4xl font-black mb-2 tracking-tighter neon-text-cyan animated-gradient-text" style={{color: '#00f0ff', textShadow: '0 0 30px rgba(0,240,255,0.5), 0 0 60px rgba(168,85,247,0.3)'}}>Apex Athlete</h1>
            <div className="text-[#a855f7]/60 text-sm tracking-[0.3em] uppercase font-mono mb-8">// COACH ACCESS TERMINAL</div>
          </div>
          {inviteCoachName && (
            <div className="game-panel bg-[#a855f7]/[0.06] border border-[#a855f7]/20 px-4 py-3 mb-4 text-center">
              <div className="text-xs text-[#a855f7]/40 font-mono tracking-wider uppercase mb-1">Invited by</div>
              <div className="text-[#a855f7] font-bold text-sm">{inviteCoachName}</div>
              <div className="text-white/50 text-sm font-mono mt-1">Enter your PIN to access the coach portal</div>
            </div>
          )}
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
            {pinError && <p className="text-red-400 text-sm -mt-2 font-mono">ACCESS DENIED. Default: 2451.</p>}
            <button onClick={tryUnlock}
              className="game-btn w-full py-4 bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_30px_rgba(0,240,255,0.3)] transition-all active:scale-[0.97] min-h-[52px]">
              Authenticate
            </button>
            {pinError && (
              <button onClick={resetPin} className="text-white/60 text-sm hover:text-white/60 transition-colors font-mono min-h-[44px]">
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
    const presentCount = filteredRoster.filter(a => Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)).length;
    const xpToday = filteredRoster.reduce((s, a) => s + (a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0);
    const secondaryTabs = [
      { id: "coach" as const, label: "Check-In" },
      { id: "meets" as const, label: "Meets" },
      { id: "comms" as const, label: "Comms" },
      { id: "analytics" as const, label: "Analytics" },
      { id: "schedule" as const, label: "Schedule" },
      { id: "strategy" as const, label: "Strategy" },
    ];
    return (
      <div className="w-full relative mb-4">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff]/60 to-transparent" />

        <div className="pt-6 pb-2">
          {/* Title row — compact */}
          <div className="flex items-center justify-between mb-4">
            <div>
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
              {/* Sync Status Badge */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono tracking-wider rounded border ${
                  firebaseConnected
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                }`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${firebaseConnected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)]"}`} />
                  {firebaseConnected ? "CLOUD SYNC" : "OFFLINE"}
                </span>
                {firebaseConnected && (
                  <button
                    onClick={async () => {
                      if (syncBusy) return;
                      setSyncBusy(true);
                      try {
                        const result = await syncPushAllToFirebase();
                        setLastSyncResult(result);
                        setLastSyncTime(Date.now());
                      } catch { setLastSyncResult({ synced: 0, errors: 1 }); }
                      setSyncBusy(false);
                    }}
                    disabled={syncBusy}
                    className="px-2 py-0.5 text-xs font-mono tracking-wider rounded bg-[#00f0ff]/10 text-[#00f0ff]/60 border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20 hover:text-[#00f0ff]/80 transition-all disabled:opacity-40"
                  >
                    {syncBusy ? "SYNCING..." : "SYNC NOW"}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ApexNotificationBell portal="coach" accentColor="#00f0ff" />
              {view === "coach" && (
                <button onClick={() => { if (editingCulture) saveCulture(culture); setEditingCulture(!editingCulture); }}
                  className="game-btn w-10 h-10 flex items-center justify-center text-xs font-mono tracking-wider uppercase text-white/50 border border-white/[0.06] hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20 transition-all">
                  {editingCulture ? "✓" : "✎"}
                </button>
              )}
            </div>
          </div>

          {/* Portal switcher — full-width grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Coach", href: "/apex-athlete", active: true, color: "#00f0ff" },
              { label: "Athlete", href: "/apex-athlete/athlete", active: false, color: "#a855f7" },
              { label: "Parent", href: "/apex-athlete/parent", active: false, color: "#f59e0b" },
            ].map(p => (
              <a key={p.label} href={p.href}
                onClick={() => { try { localStorage.setItem("apex-coach-group", selectedGroup); } catch {} }}
                className={`py-3 text-sm font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[48px] text-center flex items-center justify-center ${
                  p.active
                    ? "border-2 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                    : "border hover:border-white/20 active:scale-[0.97]"
                }`}
                style={{
                  background: p.active ? `${p.color}1a` : 'rgba(6,2,15,0.6)',
                  borderColor: p.active ? `${p.color}66` : 'rgba(255,255,255,0.06)',
                  color: p.active ? p.color : 'rgba(255,255,255,0.25)',
                }}>
                {p.label}
              </a>
            ))}
          </div>

          {/* Section nav tabs — 2-row on mobile, single row on md+ */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
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

          {/* Team name */}
          <div className="px-1 mb-3">
            <span className="text-white/70 font-bold text-sm">{culture.teamName}</span>
          </div>

          {/* Season goal — minimal */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-[#00f0ff]/50 text-sm font-mono uppercase tracking-wider shrink-0">{culture.seasonalGoal}</span>
            <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden xp-bar-segments">
              <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${Math.min(100, (culture.goalCurrent / culture.goalTarget) * 100)}%` }} />
            </div>
            <span className="text-[#f59e0b]/70 text-sm font-bold font-mono tabular-nums whitespace-nowrap shrink-0">{culture.goalCurrent}%</span>
          </div>
        </div>

        {/* Live HUD data strip — compact */}
        <div className="relative border-y border-[#00f0ff]/10 bg-[#06020f]/90 backdrop-blur-xl">
          <div className="flex items-center justify-center gap-5 py-2.5 px-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${presentCount > 0 ? "bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.6)]" : "bg-white/10"}`} />
              <span className="neon-text-cyan text-sm font-bold font-mono tabular-nums">{presentCount}<span className="text-white/60 font-normal">/{roster.length}</span></span>
            </div>
            <div className="w-px h-3 bg-[#00f0ff]/10" />
            <div className="flex items-center gap-1.5">
              <span className="neon-text-gold text-sm font-bold font-mono tabular-nums">{xpToday}</span>
              <span className="text-[#f59e0b]/60 text-sm font-mono uppercase">XP</span>
            </div>
            <div className="w-px h-3 bg-[#00f0ff]/10" />
            <span className="text-[#00f0ff]/70 text-sm font-mono">
              {sessionTime === "am"
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[#fbbf24]/60 inline mr-1"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                : <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[#818cf8]/60 inline mr-1"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
              {sessionMode === "pool" ? "POOL" : sessionMode === "weight" ? "WEIGHT" : "MEET"} {sessionTime.toUpperCase()}
            </span>
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
            className="text-white/50 text-sm hover:text-white/70 px-3 py-2 rounded-lg border border-white/[0.08] transition-colors min-h-[44px]">
            {editingCulture ? "Save" : "Edit"}
          </button>
        )}
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-white/60">
            {editingCulture ? (
              <input value={culture.seasonalGoal} onChange={e => setCulture({ ...culture, seasonalGoal: e.target.value })}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-0.5 text-white/50 w-52 focus:outline-none" />
            ) : culture.seasonalGoal}
          </span>
          <span className="text-[#f59e0b] font-bold">{culture.goalCurrent}%<span className="text-white/50">/{culture.goalTarget}%</span></span>
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
          <p className="text-white/50 text-sm italic text-center">&ldquo;{culture.weeklyQuote}&rdquo;</p>
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
                <span className="text-white/50 text-sm">{athlete.age}y · {athlete.gender === "M" ? "Male" : "Female"}</span>
                <span className="text-sm font-bold px-2.5 py-1 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>
                  {lv.icon} {lv.name}
                </span>
                <span className="text-sm font-bold px-2.5 py-1 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">
                  {sk.label} · {sk.mult}
                </span>
              </div>
              {/* Athlete Details */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {athlete.birthday && <span className="text-white/50"><span className="text-white/70">DOB:</span> {athlete.birthday}</span>}
                {athlete.usaSwimmingId && <span className="text-white/50"><span className="text-white/70">USA-S:</span> {athlete.usaSwimmingId}</span>}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60 font-bold">{athlete.xp} XP</span>
                  <span className="text-white/50">{nxt ? `${prog.remaining} to ${nxt.name}` : "MAX LEVEL"}</span>
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
              <div className="text-white/50 text-sm uppercase tracking-wider font-medium mt-0.5">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Daily cap */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">Daily XP:</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${dailyUsed >= DAILY_XP_CAP ? "bg-red-500" : "bg-[#6b21a8]"}`} style={{ width: `${(dailyUsed / DAILY_XP_CAP) * 100}%` }} />
          </div>
          <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${dailyUsed >= DAILY_XP_CAP ? "text-red-400" : "text-white/50"}`}>{dailyUsed}/{DAILY_XP_CAP}</span>
        </div>

        {/* Streaks */}
        <div className="flex gap-3">
          <Card className="flex-1 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white/60 text-sm uppercase tracking-wider">Pool Streak</div>
              <div className="text-white font-bold">{athlete.streak}d <span className="text-[#a855f7] text-sm">{sk.label}</span></div>
            </div>
            <span className="text-[#a855f7] font-bold text-sm">{sk.mult}</span>
          </Card>
          <Card className="flex-1 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white/60 text-sm uppercase tracking-wider">Weight Streak</div>
              <div className="text-white font-bold">{athlete.weightStreak}d <span className="text-[#f59e0b] text-sm">{wsk.label}</span></div>
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

        {/* Standout Awards — manual checkpoints coach taps for exceptional behavior */}
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
          className="w-full game-btn px-5 py-4 bg-[#f59e0b]/10 text-[#f59e0b] text-sm font-bold font-mono tracking-wider border border-[#f59e0b]/20 hover:bg-[#f59e0b]/20 transition-all active:scale-[0.97] rounded-xl flex items-center justify-center gap-2 min-h-[52px]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          SHOUTOUT +{SHOUTOUT_XP} XP
        </button>

        {/* Weight challenges */}
        {sessionMode === "weight" && (
          <div>
            <h4 className="text-white/60 text-sm uppercase tracking-[0.15em] font-bold mb-3">Weight Challenges</h4>
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
                      <div className="text-white/50 text-sm">{ch.desc}</div>
                    </div>
                    <span className={`text-xs font-bold ${done ? "text-[#f59e0b]" : "text-white/50"}`}>+{ch.xp} xp</span>
                  </button>
                );
              })}
            </Card>
          </div>
        )}

        {/* Meet Day Bonuses — shown when session mode is meet */}
        {sessionMode === "meet" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold">Meet Day Bonuses</h4>
              <span className={`text-xs font-bold tabular-nums ${athlete.present ? "text-red-400" : "text-white/30"}`}>{dailyUsed} xp today</span>
            </div>
            {!athlete.present && (
              <Card className="px-5 py-4">
                <div className="text-white/40 text-sm text-center">Tap present on the roster to check in</div>
              </Card>
            )}
            {athlete.present && (
              <Card className="divide-y divide-white/[0.04]">
                {MEET_CPS.map(cp => {
                  const done = cpMap[cp.id];
                  return (
                    <button key={cp.id} onClick={(e) => toggleCheckpoint(athlete.id, cp.id, cp.xp, "meet", e)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors min-h-[52px] ${
                        done ? "bg-red-500/5" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        done ? "border-red-400 bg-red-500" : "border-white/15"
                      }`}>
                        {done && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">{cp.name}</div>
                        <div className="text-white/40 text-[11px]">{cp.desc}</div>
                      </div>
                      <span className={`text-xs font-bold ${done ? "text-red-400" : "text-white/30"}`}>+{cp.xp}</span>
                    </button>
                  );
                })}
              </Card>
            )}
          </div>
        )}

        {/* Side quests — Coach assigns, athlete completes, coach approves */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white/60 text-sm uppercase tracking-[0.15em] font-bold">Side Quests</h4>
            <span className="text-white/25 text-xs font-mono">{Object.values(athlete.quests).filter(q => q === "done").length}/{QUEST_DEFS.length} done</span>
          </div>
          <Card className="divide-y divide-white/[0.04]">
            {QUEST_DEFS.map(q => {
              const st = athlete.quests[q.id] || "pending";
              return (
                <div key={q.id}
                  className={`w-full px-5 py-4 transition-colors ${
                    st === "done" ? "bg-emerald-500/5" : st === "active" ? "bg-[#6b21a8]/5" : "bg-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      st === "done" ? "border-emerald-400 bg-emerald-400/20" : st === "active" ? "border-[#a855f7] bg-[#a855f7]/20" : "border-white/15"
                    }`}>
                      {st === "done" ? (
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : st === "active" ? (
                        <svg className="w-4 h-4 text-[#a855f7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9" strokeWidth="2"/></svg>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                      )}
                    </div>
                    {/* Quest info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-medium">{q.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${CAT_COLORS[q.cat] || "bg-white/10 text-white/60"}`}>
                          {q.cat}
                        </span>
                      </div>
                      <div className="text-white/40 text-xs mt-1">{q.desc}</div>
                      {/* Status line */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs font-mono tracking-wider ${
                          st === "done" ? "text-emerald-400/70" : st === "active" ? "text-[#a855f7]/70" : "text-white/25"
                        }`}>
                          {st === "done" ? "Completed" : st === "active" ? "Awaiting approval" : "Not assigned"}
                        </span>
                        <span className={`text-xs font-bold font-mono ${st === "done" ? "text-emerald-400/60" : "text-white/20"}`}>+{q.xp} xp</span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="shrink-0 flex items-center">
                      {st === "pending" && (
                        <button
                          onClick={(e) => cycleQuest(athlete.id, q.id, q.xp, e)}
                          className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider min-h-[40px] bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/25 hover:bg-[#a855f7]/25 transition-all active:scale-[0.97]"
                        >
                          Assign
                        </button>
                      )}
                      {st === "active" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => cycleQuest(athlete.id, q.id, q.xp, e)}
                            className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider min-h-[40px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all active:scale-[0.97]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => denyQuest(athlete.id, q.id)}
                            className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider min-h-[40px] bg-red-500/10 text-red-400/70 border border-red-500/15 hover:bg-red-500/20 transition-all active:scale-[0.97]"
                          >
                            Deny
                          </button>
                        </div>
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

        {/* Send Feedback to Athlete */}
        <Card className="p-5">
          <h4 className="text-[#f59e0b] text-xs uppercase tracking-[0.15em] font-bold mb-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Send Feedback
          </h4>
          {feedbackAthleteId === athlete.id ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["praise", "tip", "goal"] as const).map(ft => (
                  <button key={ft} onClick={() => setFeedbackType(ft)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider min-h-[44px] transition-all ${
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
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#f59e0b]/30 resize-none"
                rows={2} />
              <div className="flex gap-2">
                <button onClick={() => sendFeedback(athlete.id)} disabled={!feedbackMsg.trim()}
                  className="flex-1 py-2 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/25 text-[#f59e0b] text-sm font-bold disabled:opacity-30 hover:bg-[#f59e0b]/25 transition-all">
                  Send to {athlete.name.split(" ")[0]}
                </button>
                <button onClick={() => setFeedbackAthleteId(null)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:text-white/50 transition-all">
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
            <h4 className="text-white/60 text-sm uppercase tracking-[0.15em] font-bold mb-4">You vs Last Month</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-black tabular-nums whitespace-nowrap ${growth.xpGain > 0 ? "text-emerald-400" : growth.xpGain < 0 ? "text-red-400" : "text-white/50"}`}>
                  {growth.xpGain > 0 ? "+" : ""}{growth.xpGain}
                </div>
                <div className="text-white/50 text-sm uppercase mt-1">XP Gained</div>
              </div>
              <div>
                <div className={`text-2xl font-black tabular-nums whitespace-nowrap ${growth.streakDelta > 0 ? "text-emerald-400" : growth.streakDelta < 0 ? "text-red-400" : "text-white/50"}`}>
                  {growth.streakDelta > 0 ? "+" : ""}{growth.streakDelta}d
                </div>
                <div className="text-white/50 text-sm uppercase mt-1">Streak</div>
              </div>
              <div>
                <div className="text-2xl font-black tabular-nums whitespace-nowrap text-white">{athlete.totalPractices}</div>
                <div className="text-white/50 text-sm uppercase mt-1">Total Sessions</div>
              </div>
            </div>
          </Card>
        )}

        {view === "coach" && (
          <button onClick={() => removeAthlete(athlete.id)} className="text-red-400/50 text-sm hover:text-red-400 transition-colors min-h-[44px] px-2">
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
      const improvement = ((current - goal) / current * 100).toFixed(1);
      const timeDrop = current - goal;
      const stroke = stratStroke;

      // ── SMART SPLIT LOGIC ──
      // Splits per 50 for pool races; sprints get 25m segments
      const splitLen = dist <= 50 ? 25 : 50;
      const splitCount = Math.max(2, Math.round(dist / splitLen));
      const segLen = dist / splitCount;

      // ── STROKE + DISTANCE SPECIFIC PACE CURVES ──
      // Based on elite pacing research: sprints = fast start + hold; mid = even/negative; distance = build
      type PacingStyle = "sprint" | "mid" | "distance";
      const pacingStyle: PacingStyle = dist <= 100 ? "sprint" : dist <= 200 ? "mid" : "distance";

      const buildPattern = (n: number): number[] => {
        const raw: number[] = [];
        for (let i = 0; i < n; i++) {
          const pos = i / (n - 1 || 1); // 0..1 position through race
          let w: number;
          if (pacingStyle === "sprint") {
            // Fast first split, hold, slight fade, kick finish
            w = i === 0 ? 0.96 : i === n - 1 ? 1.01 : 1.0 + pos * 0.02;
          } else if (pacingStyle === "mid") {
            // Even first half, slight negative split second half
            w = i === 0 ? 0.98 : pos < 0.5 ? 1.0 : i === n - 1 ? 0.97 : 1.0 - (pos - 0.5) * 0.04;
          } else {
            // Distance: controlled start, settle, build, finish strong
            w = i === 0 ? 0.98 : i === n - 1 ? 0.96 : pos < 0.3 ? 1.01 : pos > 0.8 ? 0.98 : 1.0;
          }
          // Stroke adjustments: fly fades more, breast is more even
          if (stroke === "Butterfly") w += pos * 0.015;
          if (stroke === "Breaststroke") w = 1.0 + (i === 0 ? -0.02 : 0);
          raw.push(w);
        }
        const sum = raw.reduce((a, b) => a + b, 0);
        return raw.map(r => r / sum);
      };

      const pattern = buildPattern(splitCount);
      const splits: { segment: string; time: string; pace: string; focus: string }[] = [];

      // ── STROKE + PHASE SPECIFIC FOCUS CUES ──
      const getFocus = (i: number, n: number): string => {
        const phase = i / (n - 1 || 1);
        const isFirst = i === 0;
        const isLast = i === n - 1;
        const isSecondLast = i === n - 2;

        if (stroke === "Freestyle") {
          if (isFirst) return dist <= 100 ? "Explosive dive, tight streamline, breakout at full speed" : "Controlled start — long stroke, settle into rhythm";
          if (isLast) return "Sprint home — increase kick tempo, head down, drive into the wall";
          if (isSecondLast) return "Build into the finish — shorten stroke slightly, increase turnover";
          if (phase < 0.3) return "Lock breathing pattern — every 3 strokes. High elbow catch, full extension";
          if (phase < 0.6) return "Maintain DPS (distance per stroke). Tight streamline off walls, 3+ kicks underwater";
          return "Start building — engage kick, increase stroke rate, stay long";
        }
        if (stroke === "Butterfly") {
          if (isFirst) return "Strong entry — dolphin kick off the start, aggressive breakout, establish rhythm early";
          if (isLast) return "Power through — shorten stroke, fast hands, two kicks per stroke to the wall";
          if (phase < 0.3) return "Big powerful strokes — wide catch, full hip drive, breathe every 2 strokes";
          if (phase < 0.6) return "Keep hips high. Breathe forward not up. Dolphin kick hard off every wall";
          return "Fight for technique — if form breaks, shorten stroke but keep moving. Drive kicks";
        }
        if (stroke === "Backstroke") {
          if (isFirst) return "Fast underwater off start — tight streamline, powerful dolphin kicks past the flags";
          if (isLast) return "Count strokes from flags — tempo up, finish with a strong pull into the wall";
          if (phase < 0.3) return "Pinky-first entry, full rotation, steady kick. Count strokes per length";
          if (phase < 0.6) return "Maintain rotation and kick tempo. Tight turns — plant feet high on the wall";
          return "Build tempo — increase stroke rate, drive hips, keep head still";
        }
        if (stroke === "Breaststroke") {
          if (isFirst) return "Long pullout — full underwater pull + dolphin kick + glide. Don't rush the breakout";
          if (isLast) return "Accelerate the kick — narrow pull, fast shoot forward, attack the wall";
          if (phase < 0.3) return "Find your glide. Each stroke: pull → breathe → kick → glide. Don't rush the glide";
          if (phase < 0.6) return "Maximize pullout off every wall — it's the fastest part of breaststroke";
          return "Shorten the glide slightly, increase turnover — keep the kick narrow and fast";
        }
        // IM
        if (isFirst) return "Fly leg: fast start, establish tempo early, strong underwaters";
        if (phase < 0.25) return "Fly → Back transition: carry momentum, tight underwater off the turn";
        if (phase < 0.5) return "Backstroke leg: steady rotation, fast underwaters, count from flags";
        if (phase < 0.75) return "Breast leg: long pullouts, don't rush — this is where races are won or lost";
        if (isLast) return "Free leg: SPRINT. Empty the tank. Fast turnover, head down, drive home";
        return "Smooth transitions — maintain speed through each turn. Underwaters are free speed";
      };

      for (let i = 0; i < splitCount; i++) {
        const splitTime = goal * pattern[i];
        splits.push({
          segment: `${Math.round(segLen * i)}–${Math.round(segLen * (i + 1))}m`,
          time: fmtTime(splitTime),
          pace: `${(splitTime / segLen * 100).toFixed(1)}s/100`,
          focus: getFocus(i, splitCount),
        });
      }

      // ── SMART TIPS: stroke + distance + improvement specific ──
      const tips: string[] = [];
      tips.push(`Target: drop ${timeDrop.toFixed(2)}s (${improvement}% faster) on your ${stratEvent}m ${stroke}`);

      // Pacing advice
      if (pacingStyle === "sprint") {
        tips.push("Sprint race: go out fast and hold. The first 15m off the start is your fastest — use it");
      } else if (pacingStyle === "mid") {
        tips.push(stroke === "IM" ? "Fly & back: controlled. Breast: long pullouts. Free: all-out sprint" : "Even splits or slight negative split — don't die on the back half");
      } else {
        tips.push("Build through the race. The 3rd quarter is where most people lose it — stay disciplined there");
      }

      // Stroke-specific technical tip
      if (stroke === "Freestyle") {
        tips.push(dist >= 400
          ? "Count strokes per length — consistency means efficiency. Breathe every 3, switch to every 2 on the last 100"
          : "High elbow catch + full hip rotation = free speed. Don't cross over on hand entry");
      } else if (stroke === "Butterfly") {
        tips.push("Two kicks per stroke — first kick on entry, second on recovery. Keep hips at the surface");
      } else if (stroke === "Backstroke") {
        tips.push("Backstroke flags = your turn signal. Know your stroke count. Underwater dolphin kicks are your weapon");
      } else if (stroke === "Breaststroke") {
        tips.push("The pullout is the fastest you'll go all race. Full pull → dolphin kick → breaststroke kick → streamline glide");
      } else {
        tips.push("Each stroke has a weakness — fly fatigue, back turns, breast tempo, free endurance. Train your weakest");
      }

      // Underwater / wall work
      tips.push(dist <= 100
        ? "Breakout speed off the start sets the tone. Explode off the block and hold your streamline"
        : "Walls win races — tight turns + 3-5 strong underwater kicks every wall. That's free speed nobody can take");

      // Mental
      tips.push(dist >= 400
        ? "Race your splits, not the field. Check the pace clock mentally at each wall"
        : "Pre-race visualization: see yourself nailing the start, holding form, attacking the finish");

      setStratPlan({ splits, tips, xpReward: 150, improvement });
    };

    const stratAthlete = roster.find(a => a.id === stratAthleteId);

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs /><XpFloats /><LevelUpOverlay />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16">
          <GameHUDHeader />

          <Card className="p-6 mb-6" glow>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2" style={{filter:'drop-shadow(0 0 8px rgba(0,240,255,0.4))'}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
              <div>
                <h2 className="text-xl font-black tracking-tight neon-text-cyan">Race Strategy AI</h2>
                <p className="text-white/50 text-sm">Personal goal-focused race planning</p>
              </div>
              <span className="ml-auto text-[#f59e0b] text-sm font-bold">+150 XP</span>
            </div>

            {/* Athlete selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-white/60 text-sm uppercase tracking-wider font-bold block mb-2">Athlete</label>
                <select value={stratAthleteId} onChange={e => setStratAthleteId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px]">
                  <option value="">Select athlete...</option>
                  {filteredRoster.map(a => <option key={a.id} value={a.id}>{a.name} — {getLevel(a.xp).name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/60 text-sm uppercase tracking-wider font-bold block mb-2">Stroke</label>
                <select value={stratStroke} onChange={e => setStratStroke(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px]">
                  {STROKES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-white/60 text-sm uppercase tracking-wider font-bold block mb-2">Event (meters)</label>
                <select value={stratEvent} onChange={e => setStratEvent(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px]">
                  {EVENTS.map(e => <option key={e} value={e}>{e}m</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/60 text-sm uppercase tracking-wider font-bold block mb-2">Current Best (M:SS.hh)</label>
                <input type="text" value={stratCurrentTime} onChange={e => setStratCurrentTime(e.target.value)}
                  placeholder="1:05.30" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px] placeholder:text-white/50" />
              </div>
              <div>
                <label className="text-white/60 text-sm uppercase tracking-wider font-bold block mb-2">Goal Time (M:SS.hh)</label>
                <input type="text" value={stratGoalTime} onChange={e => setStratGoalTime(e.target.value)}
                  placeholder="1:02.00" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00f0ff]/30 min-h-[44px] placeholder:text-white/50" />
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
                  {stratAthlete && <span className="ml-auto text-white/50 text-sm">{stratAthlete.name} · {stratEvent}m {stratStroke}</span>}
                </div>

                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-[#00f0ff]/10 border border-emerald-500/20">
                  <div className="text-emerald-400 text-sm font-bold">Target Improvement: {stratPlan.improvement}%</div>
                  <div className="text-white/60 text-xs mt-1">{stratCurrentTime} → {stratGoalTime} — You&apos;ve got this!</div>
                </div>

                {/* Split table */}
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-3 text-sm uppercase tracking-wider text-white/50 font-bold px-3 mb-1">
                    <span>Segment</span><span>Split</span><span>Pace</span><span>Focus</span>
                  </div>
                  {stratPlan.splits.map((sp, i) => (
                    <div key={i} className="grid grid-cols-4 gap-3 items-center py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-[#00f0ff]/15 transition-all text-sm">
                      <span className="text-[#00f0ff] font-mono font-bold text-xs">{sp.segment}</span>
                      <span className="text-white font-bold tabular-nums">{sp.time}</span>
                      <span className="text-white/60 font-mono text-xs">{sp.pace}</span>
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
                <p className="text-white/50 text-sm mt-1">Awarded when you complete a race using this strategy</p>
              </Card>
            </>
          )}

          <div className="text-center text-white/[0.08] text-sm py-10 space-y-1">
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
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-4 sm:px-6 lg:px-12 xl:px-16">
          <GameHUDHeader />

          {/* Group selector */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {ROSTER_GROUPS.map(g => (
                <button key={g.id} onClick={() => setScheduleGroup(g.id as GroupId)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all ${
                    scheduleGroup === g.id
                      ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                      : "bg-[#06020f]/60 text-white/50 border border-white/5 hover:text-white/60"
                  }`}>
                  {g.name}
                </button>
              ))}
            </div>
            <div className={`grid ${!calendarView ? 'grid-cols-3' : 'grid-cols-2'} gap-2 w-full`}>
              <button onClick={() => setCalendarView(false)}
                className={`py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider transition-all min-h-[44px] text-center border ${
                  !calendarView ? "bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/30" : "bg-transparent text-white/50 hover:text-white/60 border-white/10"
                }`}>
                Weekly
              </button>
              <button onClick={() => setCalendarView(true)}
                className={`py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider transition-all min-h-[44px] text-center border ${
                  calendarView ? "bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/30" : "bg-transparent text-white/50 hover:text-white/60 border-white/10"
                }`}>
                Season Calendar
              </button>
              {!calendarView && (
                <button onClick={() => setScheduleEditMode(!scheduleEditMode)}
                  className={`py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider transition-all min-h-[44px] text-center border ${
                    scheduleEditMode ? "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30" : "bg-white/5 text-white/25 border-white/10"
                  }`}>
                  {scheduleEditMode ? "✓ Done" : "✎ Edit"}
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
                    <div className={`text-sm font-mono tracking-wider font-bold ${isToday ? "text-[#00f0ff]" : "text-white/50"}`}>{day.toUpperCase()}</div>
                    {template && (
                      <div className="mt-1">
                        <span className="text-sm" style={{ color: template.color }}>{template.icon}</span>
                        <span className="text-xs text-white/50 block mt-0.5">{template.name}</span>
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
                          <div className={`text-xs font-bold ${
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
                        <div className="text-white/35 text-xs font-mono mt-0.5">
                          {fmt12(session.startTime)} – {fmt12(session.endTime)}
                        </div>
                        <div className="text-white/50 text-xs mt-0.5">{session.location}</div>

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
                          className="text-white/60 text-sm hover:text-white/60 transition-all px-3 py-2.5 rounded-lg border border-dashed border-white/15 hover:border-white/25 min-h-[44px]">
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
                      className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00f0ff]/30">
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
                <span className="text-white/50 text-sm">{t.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
              <span className="text-white/50 text-sm">Pool</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
              <span className="text-white/50 text-sm">Weight</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34d399]" />
              <span className="text-white/50 text-sm">Dryland</span>
            </div>
          </div>

          <div className="text-center mt-8 text-white/[0.06] text-xs">
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
                  <button onClick={prevMonth} className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:text-[#00f0ff] hover:border-[#00f0ff]/30 flex items-center justify-center transition-all text-lg font-bold">&lsaquo;</button>
                  <div className="text-center min-w-[180px]">
                    <div className="text-sm font-black tracking-wider text-white/80">{MONTH_NAMES[calendarMonth]} {calendarYear}</div>
                    <div className="text-xs font-mono text-white/50 mt-0.5">{groupInfo?.name || "Group"} season schedule</div>
                  </div>
                  <button onClick={nextMonth} className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:text-[#00f0ff] hover:border-[#00f0ff]/30 flex items-center justify-center transition-all text-lg font-bold">&rsaquo;</button>
                </div>

                {/* Day-of-week header */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-xs font-mono font-bold text-white/50 tracking-wider py-1">{d}</div>
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
                        <span className={`text-xs font-mono font-bold leading-none ${
                          isToday ? "text-[#00f0ff]" : isRest ? "text-white/50" : "text-white/50"
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
                    <span className="text-white/50 text-sm">Pool</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                    <span className="text-white/50 text-sm">Weight</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#34d399]" />
                    <span className="text-white/50 text-sm">Dryland</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded border border-[#00f0ff]/50 bg-[#00f0ff]/10" />
                    <span className="text-white/50 text-sm">Today</span>
                  </div>
                </div>

                {/* Session summary for the month */}
                <div className="mt-4 text-center text-white/[0.06] text-xs">
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
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16">
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
                        <span className="text-xs font-bold" style={{ color: lv.color }}>{lv.icon} {lv.name}</span>
                        <span className="text-white/60 text-sm">{a.xp} XP</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-white/25">
                        <span>{a.age}y · {a.gender === "M" ? "Male" : "Female"}</span>
                        {a.birthday && <span>DOB: {a.birthday}</span>}
                        {a.usaSwimmingId && <span>USA-S: {a.usaSwimmingId}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-2">
                    <div className="h-full rounded-full xp-shimmer transition-all" style={{ width: `${prog.percent}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/25">
                    <span>Streak: {a.streak}d</span><span>Practices: {a.totalPractices}</span>
                  </div>
                  {growth && growth.xpGain !== 0 && (
                    <div className={`mt-2 text-xs font-medium ${growth.xpGain > 0 ? "text-emerald-400/60" : "text-red-400/60"}`}>
                      {growth.xpGain > 0 ? "↑" : "↓"} {Math.abs(growth.xpGain)} XP vs last month
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <div className="grid grid-cols-3 gap-2 text-xs text-white/25">
                      <div><span className="text-white/60 font-bold">{a.totalPractices}</span> sessions</div>
                      <div><span className="text-white/60 font-bold">{Object.values(a.quests).filter(q => q === "done").length}</span> quests</div>
                      <div><span className="text-white/60 font-bold">{getStreakMult(a.streak)}x</span> multiplier</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="text-white/60 text-sm text-center mt-12">Coach manages all data. Parental consent required. Contact coach for data export.</p>
        </div>
      </div>
    );
  }

  // ── AUDIT VIEW ───────────────────────────────────────────
  if (view === "audit") {
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-6">Audit Log</h2>
          <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl p-2 max-h-[70vh] overflow-y-auto shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
            {!auditLog.length && <p className="text-white/50 text-sm p-6 font-mono">No actions recorded yet.</p>}
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
    const trendColor = engagementTrend.direction === "up" ? "text-emerald-400" : engagementTrend.direction === "down" ? "text-red-400" : "text-white/60";
    const cultureColor = cultureScore >= 70 ? "text-emerald-400" : cultureScore >= 40 ? "text-[#f59e0b]" : "text-red-400";
    const cultureBg = cultureScore >= 70 ? "bg-emerald-500" : cultureScore >= 40 ? "bg-[#f59e0b]" : "bg-red-500";

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 pb-12">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-2">Coach Analytics</h2>
          <p className="text-[#00f0ff]/30 text-xs font-mono mb-8">Advanced insights · Predictive intelligence · Team health</p>

          {/* ── TEAM HEALTH DASHBOARD ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card className="p-5 text-center" neon>
              <div className={`text-4xl font-black tabular-nums whitespace-nowrap ${cultureColor}`}>{cultureScore}</div>
              <div className="text-white/50 text-sm uppercase mt-1 tracking-wider">Culture Score</div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div className={`h-full rounded-full ${cultureBg} transition-all`} style={{ width: `${cultureScore}%` }} />
              </div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className={`text-4xl font-black tabular-nums whitespace-nowrap ${trendColor}`}>{engagementTrend.delta > 0 ? "+" : ""}{engagementTrend.delta}%</div>
              <div className="text-white/50 text-sm uppercase mt-1 tracking-wider">{trendIcon} Engagement Trend</div>
              <div className="text-white/60 text-sm mt-2">vs last 7 days</div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className="text-4xl font-black tabular-nums whitespace-nowrap text-red-400">{atRiskAthletes.length}</div>
              <div className="text-white/50 text-sm uppercase mt-1 tracking-wider">At Risk Athletes</div>
              <div className="text-white/60 text-sm mt-2">need attention</div>
            </Card>
            <Card className="p-5 text-center" neon>
              <div className="text-4xl font-black tabular-nums whitespace-nowrap text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div>
              <div className="text-white/50 text-sm uppercase mt-1 tracking-wider">30-Day Attendance</div>
              <div className="text-white/60 text-sm mt-2">{avgXP(snapshots.slice(-30))} avg XP/day</div>
            </Card>
          </div>

          {/* ── ATTRITION RISK RADAR ── */}
          {atRiskAthletes.length > 0 && (
            <Card className="p-6 mb-6" glow>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter:'drop-shadow(0 0 6px rgba(239,68,68,0.4))'}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                <h3 className="text-red-400 text-sm font-black uppercase tracking-wider">Attrition Risk Radar</h3>
                <span className="text-white/60 text-sm ml-auto font-mono">{atRiskAthletes.length} athlete{atRiskAthletes.length > 1 ? "s" : ""} flagged</span>
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
                        <div className="text-white/50 text-sm">
                          Streak: {a.streak}d · {a.totalPractices} sessions · {getLevel(a.xp).name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-black tabular-nums whitespace-nowrap ${riskColor(a.risk)}`}>{a.risk}</div>
                        <div className="text-white/60 text-sm">risk score</div>
                      </div>
                      <div className="w-16 h-2 rounded-full bg-white/[0.04] overflow-hidden shrink-0">
                        <div className={`h-full rounded-full ${riskBg(a.risk)} transition-all`} style={{ width: `${a.risk}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-white/60 text-sm mt-4 font-mono">Risk factors: low attendance, broken streaks, low XP growth, no quest engagement, no teammate interaction</p>
            </Card>
          )}

          {/* ── PEAK PERFORMANCE WINDOWS ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/60 text-sm uppercase tracking-[0.15em] font-bold mb-5">Peak Performance Windows</h3>
            <div className="flex items-end gap-3 h-32">
              {peakWindows.map((pw, i) => {
                const maxXP = Math.max(...peakWindows.map(p => p.avgXP), 1);
                const pct = (pw.avgXP / maxXP) * 100;
                const isTop = i === 0 && pw.avgXP > 0;
                return (
                  <div key={pw.day} className="flex-1 flex flex-col items-center gap-2">
                    <span className={`text-xs font-bold font-mono ${isTop ? "text-[#f59e0b]" : "text-white/25"}`}>{pw.avgXP}</span>
                    <div className={`w-full rounded-t transition-all ${isTop ? "bg-gradient-to-t from-[#f59e0b] to-[#f59e0b]/60" : "bg-[#6b21a8]/60"}`}
                      style={{ height: `${Math.max(pct, 4)}%` }} />
                    <span className={`text-xs font-bold ${isTop ? "text-[#f59e0b]" : "text-white/60"}`}>{pw.day}</span>
                  </div>
                );
              })}
            </div>
            {peakWindows[0]?.avgXP > 0 && (
              <p className="text-white/60 text-sm mt-4 font-mono">Best day: <span className="text-[#f59e0b]">{peakWindows[0].day}</span> — avg {peakWindows[0].avgXP} XP across {peakWindows[0].sessions} sessions</p>
            )}
          </Card>

          {/* ── CHECKPOINT EFFICIENCY ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/60 text-sm uppercase tracking-[0.15em] font-bold mb-5">Checkpoint Efficiency</h3>
            <p className="text-white/60 text-sm mb-4 font-mono">Which habits are sticking? Sorted by completion rate across the team.</p>
            <div className="space-y-2">
              {checkpointEfficiency.slice(0, 8).map(cp => (
                <div key={cp.id} className="flex items-center gap-3">
                  <span className="text-white/60 text-xs w-40 truncate">{cp.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full bg-[#6b21a8] transition-all" style={{ width: `${cp.rate}%` }} />
                  </div>
                  <span className="text-white/50 text-sm font-mono w-10 text-right">{cp.rate}%</span>
                  <span className="text-white/60 text-sm font-mono w-8 text-right">{cp.count}</span>
                </div>
              ))}
            </div>
            {checkpointEfficiency.length > 0 && checkpointEfficiency[checkpointEfficiency.length - 1].rate < 20 && (
              <p className="text-orange-400/40 text-xs mt-4 font-mono">Low adoption: <span className="text-orange-400">{checkpointEfficiency[checkpointEfficiency.length - 1].name}</span> — consider coaching emphasis</p>
            )}
          </Card>

          {/* ── ENGAGEMENT CALENDAR ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/60 text-sm uppercase tracking-[0.15em] font-bold mb-4">Engagement Calendar</h3>
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
                <div className="grid grid-cols-3 gap-3 text-white/60">
                  <span>Attendance: {selSnap.attendance}/{selSnap.totalAthletes}</span>
                  <span>XP Earned: {selSnap.totalXPAwarded}</span>
                  <span>Pool: {selSnap.poolCheckins} | Wt: {selSnap.weightCheckins}</span>
                </div>
              </Card>
            )}
          </Card>

          {/* ── ATHLETE TIMELINE ── */}
          <Card className="p-6 mb-6">
            <h3 className="text-white/60 text-sm uppercase tracking-[0.15em] font-bold mb-4">Athlete Timeline</h3>
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
              <h3 className="text-white/60 text-xs uppercase tracking-[0.15em] font-bold">Period Comparison</h3>
              <select value={comparePeriod} onChange={e => setComparePeriod(e.target.value as "week" | "month")}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none min-h-[32px]">
                <option value="week">Week</option><option value="month">Month</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[{ label: p.currentLabel, data: p.current }, { label: p.previousLabel, data: p.previous }].map(col => (
                <Card key={col.label} className="p-4">
                  <div className="text-white/50 text-sm uppercase tracking-wider font-medium mb-3">{col.label}</div>
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
            <h3 className="text-white/60 text-sm uppercase tracking-[0.15em] font-bold mb-4">Monthly Report Card</h3>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div><div className="text-white/50 text-sm uppercase mt-1">Attendance</div></div>
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-[#a855f7]">{avgXP(snapshots.slice(-30))}</div><div className="text-white/50 text-sm uppercase mt-1">Avg XP/Day</div></div>
              <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-white">{longestStreak?.streak || 0}d</div><div className="text-white/50 text-sm uppercase mt-1">Longest Streak</div></div>
            </div>
            <div className="mb-4">
              <div className="text-white/50 text-sm uppercase tracking-wider mb-2">Top 5</div>
              {top5.map((a, i) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-white/60 truncate min-w-0"><span className="text-[#f59e0b] font-bold mr-2">{i + 1}.</span>{a.name}</span>
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

  // ── MEETS VIEW ──────────────────────────────────────────
  if (view === "meets") {
    const saveMeets = (m: SwimMeet[]) => { setMeets(m); save(K.MEETS, m); };
    const clearAllMeets = () => { saveMeets([]); setEditingMeetId(null); setImportStatus({ type: "success", message: "All meets cleared. Import a fresh file to start over." }); };
    const createMeet = () => {
      if (!newMeetName || !newMeetDate) return;
      const m: SwimMeet = {
        id: `meet-${Date.now()}`, name: newMeetName, date: newMeetDate, location: newMeetLocation,
        course: newMeetCourse, rsvpDeadline: newMeetDeadline || newMeetDate,
        description: "", sessions: [],
        events: [], rsvps: {}, broadcasts: [], status: "upcoming", files: [],
      };
      saveMeets([...meets, m]);
      setNewMeetName(""); setNewMeetDate(""); setNewMeetLocation(""); setNewMeetDeadline("");
    };
    // Helper: days until meet
    const daysUntil = (dateStr: string) => {
      const d = new Date(dateStr + "T12:00:00");
      const now = new Date();
      return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };
    // ── HY3/HYV/EV3/SD3 Meet File Parser ──────────────────────────────
    const parseMeetFile = (text: string, filename: string): Partial<SwimMeet> | null => {
      // Normalize: handle *> as line delimiters OR trailing markers
      let normalizedText = text;
      // Strip BOM if present
      if (normalizedText.charCodeAt(0) === 0xFEFF) normalizedText = normalizedText.slice(1);
      const rawLines = normalizedText.split(/\r?\n/).filter(l => l.trim().length > 2);
      if (rawLines.length < 3 && normalizedText.includes("*>")) {
        // All on one line with *> as delimiter
        normalizedText = normalizedText.replace(/\*>/g, "\n");
      }
      const lines = normalizedText.split(/\r?\n/)
        .map(l => l.replace(/\*>\s*$/, "").replace(/\*>$/, "").trim())
        .filter(l => l.length > 2);
      if (lines.length < 2) return null;

      let ext = filename.toLowerCase().split(".").pop() || "";
      // Auto-detect format if extension is missing or unrecognized
      if (!["hy3", "hyv", "cl2", "sd3", "ev3"].includes(ext)) {
        const firstLine = lines[0];
        if (firstLine.includes(";")) {
          // Use MULTIPLE signals to differentiate HY3 vs EV3
          let ev3Score = 0;
          let hy3Score = 0;

          // Signal 1: Header field[1] is a date (MM/DD/YYYY) => EV3
          const headerFields = firstLine.split(";");
          const field1 = (headerFields[1] || "").trim();
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(field1)) ev3Score += 3;
          else hy3Score += 1;

          // Signal 2: Semicolon count in event lines (HY3 has ~25-30+ fields, EV3 has ~16)
          const eventLine = lines[1] || "";
          const semiCount = (eventLine.match(/;/g) || []).length;
          if (semiCount > 20) hy3Score += 2;
          else if (semiCount <= 20 && semiCount >= 8) ev3Score += 1;

          // Signal 3: Event line field[1] is P or F (session type) => EV3 format
          const evFields = eventLine.split(";");
          const f1 = (evFields[1] || "").trim().toUpperCase();
          if (f1 === "P" || f1 === "F") {
            // In EV3, field[1] is session type. In HY3, field[1] is event number (a digit).
            if (!/^\d+$/.test(f1)) ev3Score += 3;
          } else if (/^\d+$/.test(f1)) {
            hy3Score += 2; // field[1] is a number => HY3 (evNum;evNum;...)
          }

          // Signal 4: HY3 has stroke code (single letter A-E) at index 9
          const f9 = (evFields[9] || "").trim().toUpperCase();
          if (/^[A-E]$/.test(f9)) hy3Score += 2;

          // Signal 5: EV3 has stroke NUMBER at index 7
          const f7ev3 = (evFields[7] || "").trim();
          if (/^[1-7]$/.test(f7ev3) && (f1 === "P" || f1 === "F")) ev3Score += 2;

          // Signal 6: EV3 has gender (F/M) at field[2], HY3 has gender (W/M) at field[5]
          const f2 = (evFields[2] || "").trim().toUpperCase();
          const f5 = (evFields[5] || "").trim().toUpperCase();
          if ((f2 === "F" || f2 === "M") && (f1 === "P" || f1 === "F")) ev3Score += 2;
          if (f5 === "W" || f5 === "M") hy3Score += 1;

          ext = ev3Score > hy3Score ? "ev3" : "hy3";
        } else if (firstLine.substring(0, 2) === "B1" || firstLine.substring(0, 2) === "01") {
          ext = "sd3";
        } else {
          return null;
        }
      }

      let meetName = ""; let meetDate = ""; let meetEndDate = ""; let facility = "";
      let course: "SCY" | "SCM" | "LCM" = "SCY";
      const events: MeetEvent[] = [];
      const sessions: MeetSession[] = [];

      const strokeMap: Record<string, string> = { A: "Free", B: "Back", C: "Breast", D: "Fly", E: "IM" };
      const strokeMapNum: Record<string, string> = { "1": "Free", "2": "Back", "3": "Breast", "4": "Fly", "5": "IM", "6": "Free Relay", "7": "Medley Relay" };
      const parseDate = (d: string) => { const p = (d || "").trim().split("/"); return p.length === 3 && p[0].length >= 1 ? `${p[2]}-${p[0].padStart(2,"0")}-${p[1].padStart(2,"0")}` : ""; };
      // Validate that a string looks like a swim time (e.g. "17:34.59", "1:23.45", "59.99", "NT")
      const isValidTime = (t: string) => /^\d{1,3}:\d{2}\.\d{2}$/.test(t) || /^\d{1,2}\.\d{2}$/.test(t);
      // Find first valid time from multiple HY3 row indices
      const findHy3Time = (row: string[], indices: number[]) => {
        for (const i of indices) { const v = (row[i] || "").trim(); if (isValidTime(v)) return v; }
        return "";
      };

      const isSemicolon = lines[0]?.includes(";");

      if (isSemicolon) {
        const header = lines[0].split(";");
        meetName = (header[0] || "").trim();

        if (ext === "ev3") {
          // EV3 header: meetName;startDate;endDate;entryDeadline;Y;facility;;software;version;CN;code
          meetDate = parseDate(header[1] || "");
          meetEndDate = parseDate(header[2] || "");
          facility = (header[5] || "").trim();
          const courseField = (header[4] || "").toUpperCase();
          if (courseField.includes("Y")) course = "SCY";
          else if (courseField.includes("L")) course = "LCM";
          else if (courseField.includes("S")) course = "SCM";
        } else {
          // HY3 header: meetName;facility;startDate;endDate;entryDeadline;courseCode;...
          facility = (header[1] || "").trim();
          meetDate = parseDate(header[2] || "");
          meetEndDate = parseDate(header[3] || "");
          const courseField = (header[5] || "").toUpperCase();
          if (courseField.includes("Y") || courseField === "YLS") course = "SCY";
          else if (courseField.includes("L")) course = "LCM";
          else if (courseField.includes("S")) course = "SCM";
        }

        // Parse event rows
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(";");
          if (row.length < 7) continue;
          const evNum = parseInt(row[0]) || i;

          let dist = ""; let strokeName = ""; let gender: "M" | "F" | "Mixed" = "Mixed";
          let sessionType = ""; let qualTime = ""; let cutTimeVal = ""; let dayNum: number | undefined;
          let isRelay = false;

          if (ext === "ev3") {
            // EV3 row: evNum;sessionType;gender;I/R;0;0;distance;strokeNum;;qualTime;;maxEntries;;cutTime;;;;
            dist = (row[6] || "").trim();
            const strokeNum = (row[7] || "1").trim();
            const genderCode = (row[2] || "").toUpperCase().trim();
            sessionType = (row[1] || "").toUpperCase().trim();
            isRelay = (row[3] || "").toUpperCase().trim() === "R";
            strokeName = isRelay
              ? (strokeNum === "1" || strokeNum === "6" ? "Free Relay" : "Medley Relay")
              : (strokeMapNum[strokeNum] || "Free");
            gender = genderCode === "M" ? "M" : genderCode === "F" ? "F" : "Mixed";
            const rawQT = (row[9] || "").trim();
            const rawCut = (row[13] || "").trim();
            const ev3TimeA = isValidTime(rawQT) ? rawQT : "";
            const ev3TimeB = isValidTime(rawCut) ? rawCut : "";
            if (ev3TimeA && ev3TimeB && ev3TimeA !== ev3TimeB) {
              const secsA = parseTimeToSecs(ev3TimeA);
              const secsB = parseTimeToSecs(ev3TimeB);
              qualTime = secsA < secsB ? ev3TimeA : ev3TimeB; // faster = qualifying standard
              cutTimeVal = secsA < secsB ? ev3TimeB : ev3TimeA; // slower = consideration
            } else {
              qualTime = ev3TimeA || ev3TimeB;
              cutTimeVal = "";
            }
          } else {
            // HY3 row: evNum;evNum;sessionType;session;I/R;gender(W/M);0;109;distance;strokeCode;...
            dist = (row[8] || "").trim();
            const strokeCode = (row[9] || "A").trim().toUpperCase();
            const genderCode = (row[5] || "").toUpperCase().trim();
            sessionType = (row[2] || "").toUpperCase().trim();
            isRelay = (row[4] || "").toUpperCase().trim() === "R";
            strokeName = isRelay
              ? (strokeCode === "A" ? "Free Relay" : "Medley Relay")
              : (strokeMap[strokeCode] || "Free");
            gender = genderCode === "M" ? "M" : (genderCode === "W" || genderCode === "F") ? "F" : "Mixed";
            // HY3: index 16 = bonus/consideration time (slower), index 20 = qualifying standard (faster)
            // For filtering, qualifyingTime should be the actual standard (faster)
            const timeA = findHy3Time(row, [16, 15, 17]);
            const timeB = findHy3Time(row, [20, 21, 19]);
            if (timeA && timeB && timeA !== timeB) {
              const secsA = parseTimeToSecs(timeA);
              const secsB = parseTimeToSecs(timeB);
              qualTime = secsA < secsB ? timeA : timeB; // faster = qualifying standard
              cutTimeVal = secsA < secsB ? timeB : timeA; // slower = consideration/bonus
            } else {
              qualTime = timeA || timeB;
              cutTimeVal = "";
            }
            dayNum = parseInt(row[23] || "") || undefined;
          }

          const genderLabel = gender === "F" ? "Girls" : gender === "M" ? "Boys" : "";
          const sessionLabel = sessionType === "P" ? "Prelims" : sessionType === "F" ? "Finals" : "";
          const distStr = dist && dist !== "0" ? `${dist} ` : "";
          const name = `${genderLabel ? genderLabel + " " : ""}${distStr}${strokeName}${sessionLabel ? " (" + sessionLabel + ")" : ""}`.trim();
          events.push({
            id: `ev-import-${evNum}`,
            name: name || `Event ${evNum}`,
            eventNum: evNum,
            gender,
            distance: parseInt(dist) || undefined,
            stroke: strokeName,
            sessionType: (sessionType === "P" || sessionType === "F") ? sessionType as "P" | "F" : undefined,
            isRelay,
            qualifyingTime: qualTime || cutTimeVal || undefined,
            cutTime: cutTimeVal && qualTime && cutTimeVal !== qualTime ? cutTimeVal : undefined,
            dayNumber: dayNum,
            entries: [],
          });
        }
      } else {
        // ── Fixed-width record format (SDIF / older Hy-Tek) ──
        const isSD3 = ext === "sd3";
        let eventNum = 0;
        for (const line of lines) {
          const recType = line.substring(0, 2);
          if (recType === "B1" || recType === "01") {
            meetName = (isSD3 ? line.substring(11, 56) : line.substring(2, 47)).trim();
            facility = (isSD3 ? line.substring(56, 101) : line.substring(47, 92)).trim();
            const dateStr = (isSD3 ? line.substring(101, 109) : line.substring(92, 100)).trim();
            if (dateStr.length === 8) meetDate = `${dateStr.slice(4, 8)}-${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}`;
            const endStr = (isSD3 ? line.substring(109, 117) : line.substring(100, 108)).trim();
            if (endStr.length === 8) meetEndDate = `${endStr.slice(4, 8)}-${endStr.slice(0, 2)}-${endStr.slice(2, 4)}`;
            const courseCode = (isSD3 ? line.charAt(117) : line.charAt(108)).toUpperCase();
            course = courseCode === "L" ? "LCM" : courseCode === "X" || courseCode === "M" ? "SCM" : "SCY";
          }
          if (recType === "E0" || recType === "D3" || recType === "04") {
            eventNum++;
            const eventDesc = (isSD3 ? line.substring(11, 36) : line.substring(2, 32)).trim();
            let name = eventDesc;
            if (!name || name.length < 3) {
              const d = line.substring(isSD3 ? 36 : 32, isSD3 ? 40 : 36).trim();
              const sc = line.charAt(isSD3 ? 40 : 36);
              name = `${d} ${strokeMapNum[sc] || "Free"}`;
            }
            const genderCode = line.charAt(isSD3 ? 41 : 37);
            const gdr: "M" | "F" | "Mixed" = genderCode === "M" ? "M" : genderCode === "F" ? "F" : "Mixed";
            if (name.length > 2) events.push({ id: `ev-import-${eventNum}`, name, eventNum, gender: gdr, entries: [] });
          }
        }
      }

      if (!meetName && events.length === 0) return null;

      // Validate output quality — if all events look broken, retry with opposite format
      if (isSemicolon && events.length > 3) {
        const allMixed = events.every(e => e.gender === "Mixed");
        const allFree = events.filter(e => e.stroke === "Free" || !e.stroke).length > events.length * 0.8;
        const noDistances = events.every(e => !e.distance || e.distance === 0);
        if ((allMixed && noDistances) || (allMixed && allFree)) {
          // Likely wrong format detection — retry with opposite
          const retryExt = ext === "ev3" ? "hy3" : "ev3";
          const retryEvents: MeetEvent[] = [];
          for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(";");
            if (row.length < 7) continue;
            const evNum = parseInt(row[0]) || i;
            let rDist = ""; let rStroke = ""; let rGender: "M" | "F" | "Mixed" = "Mixed";
            let rSession = ""; let rRelay = false; let rQT = ""; let rCut = ""; let rDay: number | undefined;
            if (retryExt === "ev3") {
              rDist = (row[6] || "").trim();
              const sn = (row[7] || "1").trim();
              const gc = (row[2] || "").toUpperCase().trim();
              rSession = (row[1] || "").toUpperCase().trim();
              rRelay = (row[3] || "").toUpperCase().trim() === "R";
              rStroke = rRelay ? (sn === "1" || sn === "6" ? "Free Relay" : "Medley Relay") : (strokeMapNum[sn] || "Free");
              rGender = gc === "M" ? "M" : gc === "F" ? "F" : "Mixed";
              rQT = (row[9] || "").trim();
            } else {
              rDist = (row[8] || "").trim();
              const sc = (row[9] || "A").trim().toUpperCase();
              const gc = (row[5] || "").toUpperCase().trim();
              rSession = (row[2] || "").toUpperCase().trim();
              rRelay = (row[4] || "").toUpperCase().trim() === "R";
              rStroke = rRelay ? (sc === "A" ? "Free Relay" : "Medley Relay") : (strokeMap[sc] || "Free");
              rGender = gc === "M" ? "M" : (gc === "W" || gc === "F") ? "F" : "Mixed";
              rQT = (row[20] || "").trim();
              rCut = (row[15] || "").trim() || (row[16] || "").trim();
              rDay = parseInt(row[23] || "") || undefined;
            }
            const rGL = rGender === "F" ? "Girls" : rGender === "M" ? "Boys" : "";
            const rSL = rSession === "P" ? "Prelims" : rSession === "F" ? "Finals" : "";
            const rDS = rDist && rDist !== "0" ? `${rDist} ` : "";
            const rName = `${rGL ? rGL + " " : ""}${rDS}${rStroke}${rSL ? " (" + rSL + ")" : ""}`.trim();
            retryEvents.push({
              id: `ev-import-${evNum}`, name: rName || `Event ${evNum}`, eventNum: evNum, gender: rGender,
              distance: parseInt(rDist) || undefined, stroke: rStroke,
              sessionType: (rSession === "P" || rSession === "F") ? rSession as "P" | "F" : undefined,
              isRelay: rRelay, qualifyingTime: rQT || rCut || undefined,
              cutTime: rCut && rQT && rCut !== rQT ? rCut : undefined, dayNumber: rDay, entries: [],
            });
          }
          // Check if retry is better
          const retryAllMixed = retryEvents.every(e => e.gender === "Mixed");
          const retryNoDist = retryEvents.every(e => !e.distance || e.distance === 0);
          if (!retryAllMixed || !retryNoDist) {
            // Retry is better — use it
            return {
              name: meetName || filename.replace(/\.(hy3|hyv|cl2|sd3|ev3)$/i, ""),
              date: meetDate || new Date().toISOString().slice(0, 10),
              endDate: meetEndDate || undefined,
              location: facility, course, events: retryEvents, sessions,
            };
          }
        }
      }

      return {
        name: meetName || filename.replace(/\.(hy3|hyv|cl2|sd3|ev3)$/i, ""),
        date: meetDate || new Date().toISOString().slice(0, 10),
        endDate: meetEndDate || undefined,
        location: facility,
        course,
        events,
        sessions,
      };
    };

    const handleMeetFileImport = (files: FileList | null) => {
      if (!files || files.length === 0) {
        setImportStatus({ type: "error", message: "No file selected. Tap the button and choose a .hy3 or .ev3 file." });
        return;
      }
      const file = files[0];
      const shortName = file.name.length > 40 ? file.name.slice(0, 20) + "..." + file.name.slice(-15) : file.name;
      setImportStatus({ type: "success", message: `Reading "${shortName}" (${(file.size / 1024).toFixed(1)} KB)...` });

      // Try reading as text first (most reliable), fall back to ArrayBuffer
      const tryReadAsText = () => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string || "";
          if (text && text.length >= 10) {
            processFileText(text, file);
          } else {
            // Fallback: try ArrayBuffer approach
            tryReadAsArrayBuffer();
          }
        };
        reader.onerror = () => tryReadAsArrayBuffer();
        reader.readAsText(file, "utf-8");
      };

      const tryReadAsArrayBuffer = () => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            let text = "";
            if (reader.result instanceof ArrayBuffer) {
              const decoder = new TextDecoder("utf-8");
              text = decoder.decode(new Uint8Array(reader.result));
            }
            if (!text || text.length < 10) {
              setImportStatus({ type: "error", message: `File "${shortName}" appears empty (${file.size} bytes). Try: save the file to your device first, then upload from Files.` });
              return;
            }
            processFileText(text, file);
          } catch (err) {
            setImportStatus({ type: "error", message: `Error reading file: ${err instanceof Error ? err.message : "unknown"}` });
          }
        };
        reader.onerror = () => {
          setImportStatus({ type: "error", message: `Failed to read "${shortName}" (${file.size} bytes). Save to Files app first, then upload.` });
        };
        reader.readAsArrayBuffer(file);
      };

      const processFileText = (text: string, file: File) => {
        try {
          const parsed = parseMeetFile(text, file.name);
          if (parsed && (parsed.name || (parsed.events && parsed.events.length > 0))) {
            let dataUrl = "";
            try { dataUrl = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(text)))}`; } catch { dataUrl = ""; }
            // Always fully replace if a meet with same name exists — wipe old events/sessions completely
            const existingIdx = meets.findIndex(m => m.name === parsed.name);
            const newMeet: SwimMeet = {
              id: existingIdx >= 0 ? meets[existingIdx].id : `meet-${Date.now()}`,
              name: parsed.name || file.name,
              date: parsed.date || new Date().toISOString().slice(0, 10),
              endDate: parsed.endDate,
              location: parsed.location || "",
              course: parsed.course || "SCY",
              rsvpDeadline: parsed.date || new Date().toISOString().slice(0, 10),
              description: `Imported from ${file.name}`,
              sessions: parsed.sessions || [],
              events: parsed.events || [],
              rsvps: {},
              broadcasts: existingIdx >= 0 ? meets[existingIdx].broadcasts : [],
              status: "upcoming",
              files: dataUrl ? [{ id: `f-${Date.now()}`, name: file.name, dataUrl, uploadedAt: Date.now() }] : [],
              parserVersion: 4,
            };
            // Delete old meet fully and insert fresh — prevents stale localStorage data
            const updated = existingIdx >= 0
              ? meets.map((m, i) => i === existingIdx ? newMeet : m)
              : [...meets, newMeet];
            saveMeets(updated);
            // Detect format for display
            const detectedExt = file.name.toLowerCase().split(".").pop() || "auto";
            const formatLabel = detectedExt === "hy3" ? "HY3 (Hy-Tek)" : detectedExt === "ev3" ? "EV3 (Hy-Tek)" : detectedExt === "sd3" ? "SD3 (SDIF)" : `auto-detected`;
            // Show detailed import summary with qualifying times to prove parsing worked
            const evCount = parsed.events?.length || 0;
            const sampleEvents = (parsed.events || []).slice(0, 6).map(e => {
              const qt = e.qualifyingTime ? ` QT: ${e.qualifyingTime}` : "";
              return `${e.name}${qt}`;
            }).join("\n  ");
            const moreText = evCount > 6 ? `\n  + ${evCount - 6} more events` : "";
            const replacedText = existingIdx >= 0 ? " (REPLACED old data)" : "";
            const dateStr = parsed.date ? new Date(parsed.date + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "TBD";
            setImportStatus({ type: "success", message: `Imported "${parsed.name}"${replacedText}\nFormat: ${formatLabel} | ${evCount} events | ${parsed.course || "SCY"}\n  ${sampleEvents}${moreText}\n${dateStr} at ${parsed.location || "TBD"}` });
            setTimeout(() => setEditingMeetId(newMeet.id), 1200);
          } else {
            const lineCount = text.split(/\r?\n/).length;
            const firstLine = text.split(/\r?\n/)[0]?.slice(0, 80) || "(empty)";
            setImportStatus({ type: "error", message: `Could not parse "${shortName}"\n${text.length} chars, ${lineCount} lines\nFirst line: ${firstLine}\n\nTry a .hy3 or .ev3 file from Hy-Tek Meet Manager.` });
          }
        } catch (err) {
          setImportStatus({ type: "error", message: `Error: ${err instanceof Error ? err.message : "unknown"}` });
        }
      };

      tryReadAsText();
    };

    const handlePasteImport = () => {
      const text = pasteText.trim();
      if (!text || text.length < 10) {
        setImportStatus({ type: "error", message: "Paste the meet file content first — copy from email or Hy-Tek export." });
        return;
      }
      const fakeFile = { name: "pasted-meet.hy3", size: text.length } as File;
      try {
        const parsed = parseMeetFile(text, fakeFile.name);
        if (parsed && (parsed.name || (parsed.events && parsed.events.length > 0))) {
          let dataUrl = "";
          try { dataUrl = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(text)))}`; } catch { dataUrl = ""; }
          const existingIdx = meets.findIndex(m => m.name === parsed.name);
          const newMeet: SwimMeet = {
            id: existingIdx >= 0 ? meets[existingIdx].id : `meet-${Date.now()}`,
            name: parsed.name || "Pasted Meet",
            date: parsed.date || new Date().toISOString().slice(0, 10),
            endDate: parsed.endDate,
            location: parsed.location || "",
            course: parsed.course || "SCY",
            rsvpDeadline: parsed.date || new Date().toISOString().slice(0, 10),
            description: "Imported from pasted content",
            sessions: parsed.sessions || [],
            events: parsed.events || [],
            rsvps: {},
            broadcasts: existingIdx >= 0 ? meets[existingIdx].broadcasts : [],
            status: "upcoming",
            files: dataUrl ? [{ id: `f-${Date.now()}`, name: "pasted-meet.hy3", dataUrl, uploadedAt: Date.now() }] : [],
            parserVersion: 4,
          };
          const updated = existingIdx >= 0
            ? meets.map((m, i) => i === existingIdx ? newMeet : m)
            : [...meets, newMeet];
          saveMeets(updated);
          const evCount = parsed.events?.length || 0;
          const replacedText = existingIdx >= 0 ? " (REPLACED old data)" : "";
          setImportStatus({ type: "success", message: `Imported "${parsed.name}"${replacedText}\n${evCount} events | ${parsed.course || "SCY"}\n${parsed.location || ""}` });
          setPasteText("");
          setShowPasteImport(false);
          setTimeout(() => setEditingMeetId(newMeet.id), 1200);
        } else {
          setImportStatus({ type: "error", message: "Could not parse pasted content. Make sure you copied the full meet file." });
        }
      } catch (err) {
        setImportStatus({ type: "error", message: `Error: ${err instanceof Error ? err.message : "unknown"}` });
      }
    };

    const handleFileUpload = (meetId: string, files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          const mf: MeetFile = { id: `f-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: file.name, dataUrl: reader.result as string, uploadedAt: Date.now() };
          saveMeets(meets.map(m => m.id === meetId ? { ...m, files: [...(m.files || []), mf] } : m));
        };
        reader.readAsDataURL(file);
      });
    };
    const removeMeetFile = (meetId: string, fileId: string) => {
      saveMeets(meets.map(m => m.id === meetId ? { ...m, files: (m.files || []).filter(f => f.id !== fileId) } : m));
    };
    const enterGroupToEvent = (meetId: string, eventId: string, groupId: string) => {
      const groupAthletes = INITIAL_ROSTER.filter(a => a.group.toLowerCase().includes(groupId.toLowerCase()));
      const meet = meets.find(m => m.id === meetId);
      saveMeets(meets.map(m => {
        if (m.id !== meetId) return m;
        return { ...m, events: m.events.map(ev => {
          if (ev.id !== eventId) return ev;
          const existing = new Set(ev.entries.map(e => e.athleteId));
          const newEntries = groupAthletes.filter(a => !existing.has(a.name)).map(a => {
            // Auto-populate seed time from best times
            const rosterAthlete = roster.find(r => r.name === a.name);
            let seedTime = "";
            if (rosterAthlete?.bestTimes && ev.distance && ev.stroke) {
              const bt = findMatchingBestTime(rosterAthlete.bestTimes, ev.distance, ev.stroke, meet?.course || "SCY");
              if (bt) seedTime = bt.time;
            }
            return { athleteId: a.name, seedTime };
          });
          return { ...ev, entries: [...ev.entries, ...newEntries] };
        })};
      }));
    };
    const deleteMeet = (id: string) => saveMeets(meets.filter(m => m.id !== id));
    const addEventToMeet = (meetId: string, eventName: string) => {
      saveMeets(meets.map(m => m.id === meetId ? { ...m, events: [...m.events, { id: `ev-${Date.now()}`, name: eventName, entries: [] }] } : m));
    };
    const removeEvent = (meetId: string, eventId: string) => {
      saveMeets(meets.map(m => m.id === meetId ? { ...m, events: m.events.filter(e => e.id !== eventId) } : m));
    };
    const toggleAthleteEntry = (meetId: string, eventId: string, athleteId: string) => {
      const meet = meets.find(m => m.id === meetId);
      saveMeets(meets.map(m => {
        if (m.id !== meetId) return m;
        return { ...m, events: m.events.map(ev => {
          if (ev.id !== eventId) return ev;
          const exists = ev.entries.find(e => e.athleteId === athleteId);
          if (exists) return { ...ev, entries: ev.entries.filter(e => e.athleteId !== athleteId) };
          // Auto-populate seed time from best times
          let seedTime = "";
          const rosterAthlete = roster.find(r => r.name === athleteId);
          if (rosterAthlete?.bestTimes && ev.distance && ev.stroke) {
            const bt = findMatchingBestTime(rosterAthlete.bestTimes, ev.distance, ev.stroke, meet?.course || "SCY");
            if (bt) seedTime = bt.time;
          }
          return { ...ev, entries: [...ev.entries, { athleteId, seedTime }] };
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
    const finalizeMeet = (meetId: string) => {
      saveMeets(meets.map(m => m.id === meetId ? { ...m, status: "finalized" as const } : m));
    };
    const unfinalizeMeet = (meetId: string) => {
      saveMeets(meets.map(m => m.id === meetId ? { ...m, status: "upcoming" as const } : m));
    };
    const exportMeetCSV = (meet: SwimMeet) => {
      const rows: string[] = ["Event #,Event,Athlete,Gender,Age,Group,Seed Time"];
      meet.events.forEach((ev, idx) => {
        ev.entries.forEach(entry => {
          const ath = INITIAL_ROSTER.find(a => a.name === entry.athleteId);
          rows.push(`${ev.eventNum || idx + 1},"${ev.name}","${entry.athleteId}",${ath?.gender || ""},${ath?.age || ""},"${ath?.group || ""}","${entry.seedTime || "NT"}"`);
        });
      });
      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${meet.name.replace(/[^a-zA-Z0-9]/g, "_")}_entries.csv`; a.click();
      URL.revokeObjectURL(url);
    };
    const exportMeetSD3 = (meet: SwimMeet) => {
      // Generate SDIF/SD3 format for OME import
      const pad = (s: string, len: number) => (s + " ".repeat(len)).slice(0, len);
      const padNum = (n: number, len: number) => String(n).padStart(len, "0");
      const dateMMDDYYYY = (d: string) => { const p = d.split("-"); return p[1] + p[2] + p[0]; };
      const courseCode = meet.course === "LCM" ? "L" : meet.course === "SCM" ? "S" : "Y";
      const lines: string[] = [];
      // A0 — File Description
      lines.push(pad("A0", 2) + pad("03", 2) + pad("Apex Athlete", 30) + pad("", 126));
      // B1 — Meet record
      lines.push(pad("B1", 2) + pad("", 9) + pad(meet.name, 45) + pad(meet.location || "", 45) + dateMMDDYYYY(meet.date) + dateMMDDYYYY(meet.endDate || meet.date) + courseCode + pad("", 50));
      // C1 — Team record
      lines.push(pad("C1", 2) + pad("", 9) + pad("SA", 6) + pad("Saint Andrew's Aquatics", 30) + pad("", 113));
      // D0/D3 — Individual entries
      meet.events.forEach((ev, idx) => {
        ev.entries.forEach(entry => {
          const ath = INITIAL_ROSTER.find(a => a.name === entry.athleteId);
          if (!ath) return;
          const nameParts = ath.name.split(" ");
          const lastName = nameParts.slice(-1)[0] || "";
          const firstName = nameParts.slice(0, -1).join(" ") || "";
          const gender = ath.gender === "M" ? "M" : "F";
          const seedTime = entry.seedTime ? entry.seedTime.replace(/[:.]/g, "") : "";
          // D0 — Individual Event record
          lines.push(
            pad("D0", 2) + pad("", 9) +
            pad(gender, 1) +
            pad(ath.usaSwimmingId || "", 14) +
            pad(lastName, 20) + pad(firstName, 20) +
            pad("", 3) + // nickname
            padNum(ev.eventNum || idx + 1, 4) +
            pad(ev.name, 25) +
            pad(seedTime || "NT", 8) +
            pad(courseCode, 1) +
            pad("", 57)
          );
        });
      });
      // Z0 — File terminator
      lines.push(pad("Z0", 2) + pad("", 158));
      const blob = new Blob([lines.join("\r\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${meet.name.replace(/[^a-zA-Z0-9]/g, "_")}_entries.sd3`; a.click();
      URL.revokeObjectURL(url);
    };
    const editMeet = editingMeetId ? meets.find(m => m.id === editingMeetId) : null;

    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 pb-12">
          <GameHUDHeader />
          <h2 className="text-3xl font-black tracking-tight neon-text-cyan mb-1">Meet Entry</h2>
          <p className="text-[#00f0ff]/30 text-sm font-mono mb-6">Create meets · Import meet files · Enter athletes</p>

          {!editMeet ? (
            <>
              {/* Import meet file — upload or paste */}
              <Card className="p-5 mb-4" neon>
                <h3 className="text-base font-bold text-white/60 mb-2 uppercase tracking-wider">Import Meet</h3>
                <p className="text-white/50 text-sm mb-3">Upload a file or paste the content — events auto-populate</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="flex items-center justify-center gap-2 cursor-pointer game-btn py-6 px-4 text-lg font-black text-[#00f0ff] border-2 border-dashed border-[#00f0ff]/30 rounded-2xl hover:bg-[#00f0ff]/10 hover:border-[#00f0ff]/50 transition-all active:scale-[0.97] min-h-[72px]">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    Upload File
                    <input type="file" className="hidden" onChange={e => { handleMeetFileImport(e.target.files); e.target.value = ""; }} accept=".hy3,.ev3,.hyv,.cl2,.sd3,text/plain,*/*" />
                  </label>
                  <button onClick={() => setShowPasteImport(!showPasteImport)}
                    className={`flex items-center justify-center gap-2 game-btn py-6 px-4 text-lg font-black border-2 border-dashed rounded-2xl transition-all active:scale-[0.97] min-h-[72px] ${showPasteImport ? "text-[#a855f7] border-[#a855f7]/30 bg-[#a855f7]/10" : "text-[#a855f7]/70 border-[#a855f7]/20 hover:bg-[#a855f7]/10 hover:border-[#a855f7]/30"}`}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Paste Content
                  </button>
                </div>
                {showPasteImport && (
                  <div className="mt-3">
                    <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                      placeholder="Paste the full meet file content here (from email, Hy-Tek export, etc.)"
                      rows={6}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#a855f7]/40 font-mono resize-none"
                      style={{ fontSize: "14px" }} />
                    <button onClick={handlePasteImport} disabled={!pasteText.trim()}
                      className={`w-full mt-2 py-4 rounded-xl text-lg font-black transition-all active:scale-[0.97] ${pasteText.trim() ? "bg-[#a855f7] text-white" : "bg-white/[0.04] text-white/20 cursor-not-allowed"}`}>
                      Import Pasted Content
                    </button>
                  </div>
                )}
                <p className="text-center text-xs text-white/20 mt-2">Supports Hy-Tek .hy3, .ev3, SDIF .sd3</p>
              </Card>

              {importStatus && (
                <div className={`mb-4 px-5 py-5 rounded-xl border ${importStatus.type === "success" ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}
                  onClick={() => setImportStatus(null)}>
                  <div className={`text-lg font-bold mb-1 ${importStatus.type === "success" ? "text-green-400" : "text-red-400"}`}>
                    {importStatus.type === "success" ? "✓ Import Successful" : "✕ Import Failed"}
                  </div>
                  <div className={`text-sm whitespace-pre-wrap ${importStatus.type === "success" ? "text-green-300/70" : "text-red-300/70"}`}>
                    {importStatus.message}
                  </div>
                  <span className="block text-xs opacity-40 mt-2">tap to dismiss</span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-xs text-white/50 uppercase font-mono">or create manually</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Create new meet */}
              <Card className="p-5 mb-6" neon>
                <h3 className="text-base font-bold text-white/60 mb-3 uppercase tracking-wider">New Meet</h3>
                <div className="space-y-3">
                  <input value={newMeetName} onChange={e => setNewMeetName(e.target.value)} placeholder="Meet name"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={newMeetDate} onChange={e => setNewMeetDate(e.target.value)}
                      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
                    <select value={newMeetCourse} onChange={e => setNewMeetCourse(e.target.value as "SCY" | "SCM" | "LCM")}
                      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f0ff]/40">
                      <option value="SCY">SCY</option><option value="SCM">SCM</option><option value="LCM">LCM</option>
                    </select>
                  </div>
                  <input value={newMeetLocation} onChange={e => setNewMeetLocation(e.target.value)} placeholder="Location"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-white/50 uppercase mb-1 block">RSVP Deadline</label>
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
                <div className="text-center py-16 text-white/40 text-lg">No meets yet — import a file or create one above</div>
              ) : (
                <div className="space-y-4">
                  {meets.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(m => {
                    const rc = rsvpCounts(m);
                    const d = daysUntil(m.date);
                    const totalEntries = m.events.reduce((sum, ev) => sum + ev.entries.length, 0);
                    return (
                      <button key={m.id} onClick={() => setEditingMeetId(m.id)}
                        className="w-full text-left rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden hover:bg-white/[0.04] hover:border-white/[0.12] transition-all active:scale-[0.99]"
                        style={{ borderLeft: `4px solid ${m.status === "finalized" ? "#10b981" : d <= 7 ? "#f59e0b" : "#00f0ff"}40` }}>
                        <div className="px-6 py-6">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-white text-xl tracking-tight truncate">{m.name}</h4>
                              <p className="text-white/50 text-base mt-1">{m.location || "TBD"}</p>
                            </div>
                            <span className={`text-sm px-4 py-1.5 rounded-full font-bold uppercase shrink-0 ml-3 ${
                              m.status === "finalized" ? "bg-emerald-500/10 text-emerald-400" :
                              m.status === "upcoming" ? "bg-[#00f0ff]/10 text-[#00f0ff]" :
                              m.status === "active" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                              "bg-white/5 text-white/60"
                            }`}>{m.status === "finalized" ? "Locked" : m.status}</span>
                          </div>
                          <div className="flex items-center gap-3 text-base mt-3">
                            <span className="font-bold text-white/70">{new Date(m.date + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{m.endDate && m.endDate !== m.date ? ` – ${new Date(m.endDate + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</span>
                            <span className="text-white/20">·</span>
                            <span className="font-bold text-white/50">{m.course}</span>
                            {d > 0 && <span className={`ml-auto text-sm font-bold px-3 py-1 rounded-full ${d <= 7 ? "bg-[#f59e0b]/10 text-[#f59e0b]" : "bg-white/[0.04] text-white/40"}`}>{d}d away</span>}
                          </div>
                          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-white/[0.05]">
                            <div className="text-center">
                              <span className="text-2xl font-black text-[#a855f7]">{m.events.length}</span>
                              <span className="text-xs text-white/30 block uppercase">events</span>
                            </div>
                            <div className="text-center">
                              <span className="text-2xl font-black text-[#00f0ff]">{totalEntries}</span>
                              <span className="text-xs text-white/30 block uppercase">entries</span>
                            </div>
                            <div className="text-center">
                              <span className="text-2xl font-black text-emerald-400">{rc.committed}</span>
                              <span className="text-xs text-white/30 block uppercase">committed</span>
                            </div>
                            <svg className="w-6 h-6 text-white/20 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Edit meet — Team Unify-style tabbed management */
            <div>
              <button onClick={() => { setEditingMeetId(null); setMeetView("overview"); setViewingAthleteEntries(null); }}
                className="flex items-center gap-2 text-[#00f0ff]/60 text-base font-bold mb-5 hover:text-[#00f0ff] transition-colors py-3 -ml-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                All Meets
              </button>

              {/* Meet header */}
              <Card className="p-5 mb-4" neon>
                <h3 className="font-bold text-white text-2xl mb-1">{editMeet.name}</h3>
                <p className="text-white/50 text-base mb-1">
                  {new Date(editMeet.date + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {editMeet.endDate && editMeet.endDate !== editMeet.date && ` – ${new Date(editMeet.endDate + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
                  {" · "}{editMeet.course} · {editMeet.location || "TBD"}
                </p>
                {editMeet.rsvpDeadline && <p className="text-xs text-[#f59e0b]/60">Registration deadline: {new Date(editMeet.rsvpDeadline + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}

                {/* RSVP summary bar */}
                {(() => { const rc = rsvpCounts(editMeet); return (
                  <div className="flex items-center gap-4 mt-3 text-base">
                    <span className="text-emerald-400 font-bold">{rc.committed} committed</span>
                    <span className="text-red-400">{rc.declined} declined</span>
                    <span className="text-white/50">{rc.pending} pending</span>
                    <span className="text-[#a855f7] ml-auto font-bold">{editMeet.events.length} events</span>
                  </div>
                ); })()}

                {/* Action buttons — finalize + export */}
                <div className="flex gap-2 mt-4">
                  {editMeet.status === "finalized" ? (
                    <button onClick={() => unfinalizeMeet(editMeet.id)}
                      className="flex-1 game-btn py-3.5 text-base font-bold text-[#f59e0b] border border-[#f59e0b]/20 rounded-lg hover:bg-[#f59e0b]/10 transition-all min-h-[48px]">
                      Unlock Entries
                    </button>
                  ) : (
                    <button onClick={() => finalizeMeet(editMeet.id)}
                      disabled={editMeet.events.length === 0 || editMeet.events.every(e => e.entries.length === 0)}
                      className="flex-1 game-btn py-3.5 text-base font-bold text-emerald-400 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/10 disabled:opacity-30 transition-all min-h-[48px]">
                      Finalize Entries
                    </button>
                  )}
                  <button onClick={() => exportMeetCSV(editMeet)}
                    disabled={editMeet.events.every(e => e.entries.length === 0)}
                    className="game-btn py-3.5 px-5 text-base font-bold text-[#00f0ff]/60 border border-[#00f0ff]/15 rounded-lg hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] disabled:opacity-30 transition-all min-h-[48px]">
                    CSV
                  </button>
                  <button onClick={() => exportMeetSD3(editMeet)}
                    disabled={editMeet.events.every(e => e.entries.length === 0)}
                    className="game-btn py-3.5 px-5 text-base font-bold text-[#a855f7]/60 border border-[#a855f7]/15 rounded-lg hover:bg-[#a855f7]/10 hover:text-[#a855f7] disabled:opacity-30 transition-all min-h-[48px]">
                    SD3
                  </button>
                </div>
                {editMeet.status === "finalized" && (
                  <div className="mt-2 text-center text-xs text-emerald-400/60 font-mono uppercase">Entries locked -- export ready for meet host</div>
                )}
              </Card>

              {/* Clear & Re-import button — escape hatch for broken imports */}
              <div className="mb-4">
                <label className="flex items-center justify-center gap-3 cursor-pointer w-full py-4 min-h-[56px] bg-[#f59e0b]/[0.06] text-[#f59e0b] font-bold text-base rounded-xl border-2 border-dashed border-[#f59e0b]/25 hover:bg-[#f59e0b]/15 transition-all active:scale-[0.98]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Clear Events & Re-import File
                  <input type="file" className="hidden" onChange={e => {
                    const f = e.target.files;
                    if (f && f.length > 0) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const text = reader.result as string || "";
                        if (text.length < 10) { setImportStatus({ type: "error", message: "File appears empty" }); return; }
                        const parsed = parseMeetFile(text, f[0].name);
                        if (parsed && parsed.events && parsed.events.length > 0) {
                          let dataUrl = "";
                          try { dataUrl = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(text)))}`; } catch { dataUrl = ""; }
                          // Completely replace ALL meet data — fresh import
                          saveMeets(meets.map(m => m.id === editMeet.id ? ({
                            ...m,
                            name: parsed.name || m.name,
                            date: parsed.date || m.date,
                            endDate: parsed.endDate ?? m.endDate,
                            location: parsed.location || m.location,
                            course: parsed.course || m.course,
                            events: parsed.events || [],
                            sessions: parsed.sessions || [],
                            files: dataUrl ? [{ id: `f-${Date.now()}`, name: f[0].name, dataUrl, uploadedAt: Date.now() }] : m.files,
                            parserVersion: 4,
                          } as SwimMeet) : m));
                          const sampleEvs = (parsed.events || []).slice(0, 4).map(ev => {
                            const qt = ev.qualifyingTime ? ` QT: ${ev.qualifyingTime}` : "";
                            return `${ev.name}${qt}`;
                          }).join(", ");
                          setImportStatus({ type: "success", message: `Re-imported ${parsed.events.length} events (old events cleared)\n${sampleEvs}${parsed.events.length > 4 ? ` +${parsed.events.length - 4} more` : ""}` });
                        } else {
                          setImportStatus({ type: "error", message: `Could not parse file. Try a .hy3 or .ev3 file.` });
                        }
                      };
                      reader.readAsText(f[0], "utf-8");
                    }
                    e.target.value = "";
                  }} accept="*/*" />
                </label>
                {importStatus && (
                  <div className={`mt-3 px-5 py-4 rounded-xl border ${importStatus.type === "success" ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}
                    onClick={() => setImportStatus(null)}>
                    <div className={`text-base font-bold mb-1 ${importStatus.type === "success" ? "text-green-400" : "text-red-400"}`}>
                      {importStatus.type === "success" ? "Import OK" : "Import Failed"}
                    </div>
                    <div className={`text-sm whitespace-pre-wrap ${importStatus.type === "success" ? "text-green-300/70" : "text-red-300/70"}`}>
                      {importStatus.message}
                    </div>
                    <span className="block text-xs opacity-40 mt-1">tap to dismiss</span>
                  </div>
                )}
              </div>

              {/* Tab navigation — like Team Unify: Info / Event Order / Member Entry */}
              <div className="flex gap-1 mb-4 bg-white/[0.02] rounded-xl p-1.5 border border-white/[0.05]">
                {(["info", "events", "members"] as const).map(tab => (
                  <button key={tab} onClick={() => { setMeetView(tab === "events" ? "overview" : tab === "members" ? "entries" : "info"); setViewingAthleteEntries(null); }}
                    className={`flex-1 py-4 text-base font-bold rounded-lg transition-all uppercase tracking-wider ${
                      (tab === "info" && meetView === "info") || (tab === "events" && meetView === "overview") || (tab === "members" && meetView === "entries")
                        ? "bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20"
                        : "text-white/25 hover:text-white/60"
                    }`}>
                    {tab === "info" ? "Info" : tab === "events" ? "Event Order" : "Member Entry"}
                  </button>
                ))}
              </div>

              {/* ── INFO TAB ── */}
              {meetView === "info" && (
                <div className="space-y-4">
                  {/* Description */}
                  <Card className="p-4">
                    <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-2">Meet Description</h4>
                    {editMeet.description ? (
                      <p className="text-sm text-white/60 whitespace-pre-wrap">{editMeet.description}</p>
                    ) : (
                      <p className="text-sm text-white/50 italic">No description — add one below</p>
                    )}
                    <textarea value={meetDescription} onChange={e => setMeetDescription(e.target.value)} placeholder="Add meet info, qualifying standards, notes..."
                      rows={3} className="mt-3 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-[#00f0ff]/40 resize-none" style={{ fontSize: "16px" }} />
                    <button onClick={() => { saveMeets(meets.map(m => m.id === editMeet.id ? { ...m, description: meetDescription } : m)); }}
                      disabled={!meetDescription.trim()} className="mt-2 game-btn px-4 py-2 text-xs font-bold text-[#00f0ff] border border-[#00f0ff]/20 rounded-lg hover:bg-[#00f0ff]/10 disabled:opacity-30 transition-all">
                      Save Description
                    </button>
                  </Card>

                  {/* Files & Documents */}
                  <Card className="p-4">
                    <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-2">Files & Documents</h4>
                    {(editMeet.files || []).length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {(editMeet.files || []).map(f => (
                          <div key={f.id} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                            <svg className="w-4 h-4 text-[#a855f7]/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            <a href={f.dataUrl} download={f.name} className="text-xs text-[#00f0ff]/70 hover:text-[#00f0ff] truncate flex-1">{f.name}</a>
                            <span className="text-xs text-white/50 shrink-0">{new Date(f.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            <button onClick={() => removeMeetFile(editMeet.id, f.id)} className="text-red-400/20 hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer game-btn py-2 px-4 text-xs font-bold text-[#a855f7]/50 border border-[#a855f7]/15 rounded-lg hover:bg-[#a855f7]/10 hover:text-[#a855f7] transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Upload File
                      <input type="file" multiple className="hidden" onChange={e => handleFileUpload(editMeet.id, e.target.files)} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.hy3,.hyv,.cl2,.sd3,.ev3" />
                    </label>
                  </Card>

                  {/* Fetch Best Times from SwimCloud */}
                  <Card className="p-4">
                    <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-2">Best Times (SwimCloud)</h4>
                    <p className="text-xs text-white/40 mb-3">Auto-fetch best times from USA Swimming records. Times auto-populate as seed times for event entry and filter athletes by qualifying standards.</p>
                    <div className="flex gap-2">
                      <button onClick={fetchAllBestTimes} disabled={fetchingTimesAll}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-bold transition-all min-h-[56px] active:scale-[0.97] ${
                          fetchingTimesAll
                            ? "bg-[#00f0ff]/10 text-[#00f0ff]/50 cursor-wait"
                            : "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/25 hover:bg-[#00f0ff]/25"
                        }`}>
                        <svg className={`w-5 h-5 ${fetchingTimesAll ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {fetchingTimesAll ? "Fetching..." : "Fetch All Best Times"}
                      </button>
                    </div>
                    {bestTimesStatus && (
                      <p className={`text-sm mt-2 ${bestTimesStatus.includes("Error") || bestTimesStatus.includes("not found") ? "text-red-400/70" : "text-emerald-400/70"}`}>
                        {bestTimesStatus}
                      </p>
                    )}
                    {/* Show athletes with/without times */}
                    {(() => {
                      const withTimes = filteredRoster.filter(a => a.bestTimes && a.bestTimes.length > 0).length;
                      const total = filteredRoster.length;
                      return withTimes > 0 && (
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${(withTimes / total) * 100}%` }} />
                          </div>
                          <span className="text-sm font-bold text-white/50">{withTimes}/{total} with times</span>
                        </div>
                      );
                    })()}
                  </Card>

                  {/* Message Parents */}
                  <Card className="p-4">
                    <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-2">Message Parents</h4>
                    <div className="flex gap-2">
                      <input value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Send update about this meet..."
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }} />
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
                            <span className="text-white/10 ml-2">{new Date(bc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ── EVENT ORDER TAB — Apple-quality meet management ── */}
              {meetView === "overview" && (
                <div>
                  {/* Re-import notice if events look broken */}
                  {editMeet.events.length > 3 && (
                    editMeet.events.every(ev => ev.gender === "Mixed") ||
                    editMeet.events.every(ev => !ev.distance || ev.distance === 0) ||
                    editMeet.events.filter(ev => ev.stroke === "Free" || !ev.stroke).length > editMeet.events.length * 0.8
                  ) && (
                    <Card className="p-5 mb-5 border-[#f59e0b]/30 bg-[#f59e0b]/[0.06]" neon>
                      <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-[#f59e0b] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        <div className="flex-1">
                          <p className="text-base font-bold text-[#f59e0b] mb-1">Events may not have imported correctly</p>
                          <p className="text-sm text-white/50 mb-3">Re-upload the meet file to fix event names, distances, and genders.</p>
                          <label className="inline-flex items-center gap-2 cursor-pointer px-5 py-3 min-h-[52px] bg-[#f59e0b]/15 text-[#f59e0b] font-bold text-base rounded-xl border border-[#f59e0b]/30 hover:bg-[#f59e0b]/25 transition-all active:scale-[0.97]">
                            Re-import Meet File
                            <input type="file" className="hidden" onChange={e => {
                              const f = e.target.files;
                              if (f && f.length > 0) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const text = reader.result as string || "";
                                  if (text.length < 10) return;
                                  const parsed = parseMeetFile(text, f[0].name);
                                  if (parsed && parsed.events && parsed.events.length > 0) {
                                    let dataUrl = "";
                                    try { dataUrl = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(text)))}`; } catch { dataUrl = ""; }
                                    saveMeets(meets.map(m => m.id === editMeet.id ? ({
                                      ...m,
                                      name: parsed.name || m.name,
                                      date: parsed.date || m.date,
                                      endDate: parsed.endDate ?? m.endDate,
                                      location: parsed.location || m.location,
                                      course: parsed.course || m.course,
                                      events: parsed.events ?? m.events,
                                      files: dataUrl ? [{ id: `f-${Date.now()}`, name: f[0].name, dataUrl, uploadedAt: Date.now() }, ...(m.files || []).filter(mf => !mf.name.startsWith("file_"))] : m.files,
                                      parserVersion: 4,
                                    } as SwimMeet) : m));
                                    setImportStatus({ type: "success", message: `Re-imported ${parsed.events.length} events successfully` });
                                  }
                                };
                                reader.readAsText(f[0], "utf-8");
                              }
                              e.target.value = "";
                            }} accept="*/*" />
                          </label>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Add events button */}
                  {meetEventPicker === editMeet.id ? (
                    <Card className="p-6 mb-5">
                      <h4 className="text-2xl font-black text-white mb-1">Select Events</h4>
                      <p className="text-lg text-white/40 mb-5">{editMeet.course} course</p>
                      <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pb-2">
                        {STANDARD_SWIM_EVENTS.filter(e => e.courses.includes(editMeet.course)).map(e => {
                          const added = editMeet.events.some(ev => ev.name === e.name);
                          return (
                            <button key={e.name} onClick={() => { if (!added) addEventToMeet(editMeet.id, e.name); }}
                              className={`text-lg px-5 py-5 min-h-[64px] rounded-2xl transition-all font-bold tracking-tight ${
                                added
                                  ? "bg-[#00f0ff]/15 text-[#00f0ff] border-2 border-[#00f0ff]/40"
                                  : "bg-white/[0.04] text-white/80 border-2 border-white/[0.08] hover:bg-[#a855f7]/15 hover:text-[#a855f7] hover:border-[#a855f7]/30 active:scale-[0.96]"
                              }`}>
                              {added && <span className="mr-1">✓</span>}{e.name}
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={() => setMeetEventPicker(null)} className="mt-5 w-full py-5 text-lg font-bold text-white/70 bg-white/[0.04] border-2 border-white/[0.1] rounded-2xl hover:bg-white/[0.08] transition-all active:scale-[0.98]">Done</button>
                    </Card>
                  ) : (
                    <button onClick={() => setMeetEventPicker(editMeet.id)}
                      className="w-full py-6 mb-5 text-xl font-bold text-[#a855f7] bg-[#a855f7]/[0.06] border-2 border-dashed border-[#a855f7]/25 rounded-2xl hover:bg-[#a855f7]/15 transition-all min-h-[72px] active:scale-[0.98]">
                      + Add Events
                    </button>
                  )}

                  {/* Summary bar */}
                  {editMeet.events.length > 0 && (
                    <div className="flex items-center gap-4 mb-4 px-1">
                      <span className="text-lg font-black text-white">{editMeet.events.length} Events</span>
                      <span className="text-base text-white/30">·</span>
                      <span className="text-base text-emerald-400 font-bold">{editMeet.events.reduce((sum, ev) => sum + ev.entries.length, 0)} total entries</span>
                      {editMeet.events.some(ev => ev.dayNumber) && (
                        <>
                          <span className="text-base text-white/30">·</span>
                          <span className="text-base text-[#a855f7] font-bold">{new Set(editMeet.events.map(ev => ev.dayNumber || 1)).size} days</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Event list */}
                  {editMeet.events.length === 0 ? (
                    <div className="text-center py-16 text-white/40 text-lg">No events yet — add events above or import a meet file</div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const strokeColor: Record<string, string> = {
                          "Free": "#00f0ff", "Back": "#4ade80", "Breast": "#f59e0b", "Fly": "#a855f7", "IM": "#ec4899",
                          "Free Relay": "#06b6d4", "Medley Relay": "#d946ef",
                        };
                        const renderEventCard = (ev: MeetEvent, idx: number) => {
                          const entryCount = ev.entries.length;
                          const color = strokeColor[ev.stroke || ""] || "#00f0ff";
                          const genderLabel = ev.gender === "F" ? "Girls" : ev.gender === "M" ? "Boys" : "Mixed";
                          const genderColor = ev.gender === "F" ? "#ec4899" : ev.gender === "M" ? "#3b82f6" : "#94a3b8";
                          const distLabel = ev.distance ? `${ev.distance}` : "";
                          const strokeLabel = ev.stroke || "";
                          const sessionLabel = ev.sessionType === "P" ? "Prelims" : ev.sessionType === "F" ? "Finals" : "";
                          const hasStructured = ev.distance || ev.stroke;
                          // Build a full display name: "Girls 1650 Free" when structured data exists
                          const fullEventName = hasStructured
                            ? `${genderLabel !== "Mixed" ? genderLabel + " " : ""}${distLabel ? distLabel + " " : ""}${strokeLabel}`.trim()
                            : ev.name;
                          return (
                            <div key={ev.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden" style={{ borderLeft: `4px solid ${color}40` }}>
                              {/* Main event row */}
                              <div className="flex items-center gap-4 px-5 py-5 min-h-[88px]">
                                {/* Event number badge */}
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-xl" style={{ backgroundColor: `${color}15`, color, border: `2px solid ${color}30` }}>
                                  {ev.eventNum || idx + 1}
                                </div>
                                {/* Event details */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xl font-black text-white tracking-tight leading-tight">
                                    {fullEventName}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {hasStructured && (
                                      <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: `${genderColor}15`, color: genderColor }}>
                                        {genderLabel}
                                      </span>
                                    )}
                                    {sessionLabel && (
                                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${sessionLabel === "Finals" ? "bg-[#f59e0b]/15 text-[#f59e0b]" : "bg-white/[0.06] text-white/60"}`}>
                                        {sessionLabel}
                                      </span>
                                    )}
                                    {ev.isRelay && <span className="text-sm font-bold px-3 py-1 rounded-full bg-[#a855f7]/15 text-[#a855f7]">Relay</span>}
                                    {ev.qualifyingTime && (
                                      <span className="text-sm font-mono font-bold px-3 py-1 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">QT {ev.qualifyingTime}</span>
                                    )}
                                    {ev.cutTime && (
                                      <span className="text-sm font-mono font-bold px-3 py-1 rounded-full bg-white/[0.04] text-white/50">Bonus {ev.cutTime}</span>
                                    )}
                                  </div>
                                </div>
                                {/* Entry count + actions */}
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="text-center min-w-[48px]">
                                    <span className="text-2xl font-black block" style={{ color }}>{entryCount}</span>
                                    <span className="text-xs text-white/30 uppercase tracking-wider">entered</span>
                                  </div>
                                  <button onClick={() => removeEvent(editMeet.id, ev.id)}
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-red-400/20 hover:text-red-400 hover:bg-red-400/10 transition-all">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                              </div>
                              {/* Quick-add group buttons — gender-filtered + QT-aware */}
                              <div className="px-5 pb-5">
                                {/* QT filter indicator */}
                                {ev.qualifyingTime && ev.distance && ev.stroke && (
                                  <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
                                    <span className="text-xs font-bold text-[#f59e0b]/70 uppercase tracking-wider">QT {ev.qualifyingTime}</span>
                                    {ev.cutTime && <span className="text-xs text-white/30">Bonus {ev.cutTime}</span>}
                                    <span className="text-xs text-white/20">— Green = qualifies, Amber = close</span>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2.5">
                                  {ROSTER_GROUPS.filter(g => g.id !== "diving" && g.id !== "waterpolo").map(g => {
                                    let groupAthletes = INITIAL_ROSTER.filter(a => a.group.toLowerCase().includes(g.id.toLowerCase()));
                                    // Filter by event gender if specific
                                    if (ev.gender === "M") groupAthletes = groupAthletes.filter(a => a.gender === "M");
                                    if (ev.gender === "F") groupAthletes = groupAthletes.filter(a => a.gender === "F");
                                    // Count how many qualify based on best times vs QT and bonus
                                    let qualifiedCount = 0;
                                    let bonusCount = 0;
                                    let hasTimeCount = 0;
                                    const qtSecs = ev.qualifyingTime ? parseTimeToSecs(ev.qualifyingTime) : 0;
                                    const bonusSecs = ev.cutTime ? parseTimeToSecs(ev.cutTime) : 0;
                                    if (ev.distance && ev.stroke) {
                                      groupAthletes.forEach(a => {
                                        const ra = roster.find(r => r.name === a.name);
                                        const bt = findMatchingBestTime(ra?.bestTimes, ev.distance, ev.stroke, editMeet.course || "SCY");
                                        if (bt) {
                                          hasTimeCount++;
                                          if (qtSecs > 0 && bt.seconds <= qtSecs) qualifiedCount++;
                                          else if (bonusSecs > 0 && bt.seconds <= bonusSecs) bonusCount++;
                                        }
                                      });
                                    }
                                    if (groupAthletes.length === 0) return null;
                                    const enteredFromGroup = groupAthletes.filter(a => ev.entries.some(e => e.athleteId === a.name)).length;
                                    const allEntered = enteredFromGroup === groupAthletes.length;
                                    return (
                                      <button key={g.id} onClick={() => {
                                        // Enter all gender-matched athletes from this group — auto-populate seed times
                                        const toEnter = groupAthletes.filter(a => !ev.entries.some(e => e.athleteId === a.name));
                                        if (toEnter.length === 0) return;
                                        saveMeets(meets.map(m => {
                                          if (m.id !== editMeet.id) return m;
                                          return { ...m, events: m.events.map(e => {
                                            if (e.id !== ev.id) return e;
                                            return { ...e, entries: [...e.entries, ...toEnter.map(a => {
                                              const ra = roster.find(r => r.name === a.name);
                                              const bt = findMatchingBestTime(ra?.bestTimes, ev.distance, ev.stroke, editMeet.course || "SCY");
                                              return { athleteId: a.name, seedTime: bt?.time || "" };
                                            })] };
                                          })};
                                        }));
                                      }}
                                        className={`text-lg font-bold px-6 py-4 min-h-[56px] rounded-2xl border-2 transition-all active:scale-[0.96] ${
                                          allEntered
                                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400/70"
                                            : "bg-white/[0.03] border-white/[0.08] hover:bg-[#a855f7]/15 hover:text-[#a855f7] hover:border-[#a855f7]/30"
                                        }`}
                                        style={!allEntered ? { color: g.color + "90" } : undefined}>
                                        {allEntered ? "✓ " : "+ "}{g.name}
                                        <span className="text-sm opacity-60 ml-1.5">{enteredFromGroup}/{groupAthletes.length}</span>
                                        {qualifiedCount > 0 && (
                                          <span className="text-xs ml-1 text-[#22c55e]">({qualifiedCount} QT)</span>
                                        )}
                                        {bonusCount > 0 && (
                                          <span className="text-xs ml-1 text-[#f59e0b]">({bonusCount} bonus)</span>
                                        )}
                                        {hasTimeCount > 0 && qualifiedCount === 0 && bonusCount === 0 && (
                                          <span className="text-xs ml-1 text-white/30">({hasTimeCount} timed)</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* Entered athletes — show seed times + QT comparison */}
                                {entryCount > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.05]">
                                    {ev.entries.map(e => {
                                      const seedSecs = e.seedTime ? parseTimeToSecs(e.seedTime) : 0;
                                      const evQtSecs = ev.qualifyingTime ? parseTimeToSecs(ev.qualifyingTime) : 0;
                                      const evBonusSecs = ev.cutTime ? parseTimeToSecs(ev.cutTime) : 0;
                                      const qualifies = seedSecs > 0 && evQtSecs > 0 && seedSecs <= evQtSecs;
                                      const meetsBonus = !qualifies && seedSecs > 0 && evBonusSecs > 0 && seedSecs <= evBonusSecs;
                                      const gap = seedSecs > 0 && evQtSecs > 0 ? seedSecs - evQtSecs : 0;
                                      const borderColor = !e.seedTime ? "#00f0ff" : qualifies ? "#22c55e" : meetsBonus ? "#f59e0b" : gap > 0 && gap < 10 ? "#f59e0b" : "#ef4444";
                                      return (
                                        <button key={e.athleteId} onClick={() => toggleAthleteEntry(editMeet.id, ev.id, e.athleteId)}
                                          className="text-lg font-semibold px-5 py-4 min-h-[56px] rounded-xl transition-all active:scale-[0.96] hover:opacity-80"
                                          style={{ background: borderColor + "10", color: borderColor + "cc", border: `1px solid ${borderColor}30` }}>
                                          <span>{e.athleteId.split(" ")[0]} {e.athleteId.split(" ").slice(1).map(w => w[0]).join("")}</span>
                                          {e.seedTime && <span className="text-sm font-mono ml-2" style={{ color: qualifies ? "#22c55e" : meetsBonus ? "#f59e0b" : "#ef4444" }}>{e.seedTime}</span>}
                                          {e.seedTime && evQtSecs > 0 && !qualifies && gap > 0 && (
                                            <span className="text-xs ml-1 opacity-60">+{gap.toFixed(1)}s</span>
                                          )}
                                          {qualifies && <span className="text-xs ml-1 text-emerald-400">QT</span>}
                                          {meetsBonus && <span className="text-xs ml-1 text-[#f59e0b]">BONUS</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        };
                        const hasDays = editMeet.events.some(ev => ev.dayNumber && ev.dayNumber > 0);
                        if (hasDays) {
                          const dayGroups = new Map<number, { ev: MeetEvent; idx: number }[]>();
                          editMeet.events.forEach((ev, idx) => {
                            const day = ev.dayNumber || 1;
                            if (!dayGroups.has(day)) dayGroups.set(day, []);
                            dayGroups.get(day)!.push({ ev, idx });
                          });
                          const dayDates: Record<number, string> = {};
                          if (editMeet.date) {
                            const start = new Date(editMeet.date + "T12:00:00");
                            Array.from(dayGroups.keys()).sort((a, b) => a - b).forEach((day, i) => {
                              const d = new Date(start);
                              d.setDate(d.getDate() + i);
                              dayDates[day] = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                            });
                          }
                          return Array.from(dayGroups.keys()).sort((a, b) => a - b).map(day => (
                            <div key={`day-${day}`}>
                              <div className="flex items-center gap-3 mt-8 mb-4">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xl font-black text-[#00f0ff] uppercase tracking-widest">Day {day}</span>
                                  {dayDates[day] && <span className="text-base text-white/30 font-medium">{dayDates[day]}</span>}
                                </div>
                                <div className="flex-1 h-px bg-[#00f0ff]/15" />
                                <span className="text-base text-white/40 font-bold">{dayGroups.get(day)!.length} events</span>
                              </div>
                              <div className="space-y-3">
                                {dayGroups.get(day)!.map(({ ev, idx }) => renderEventCard(ev, idx))}
                              </div>
                            </div>
                          ));
                        }
                        return editMeet.events.map((ev, idx) => renderEventCard(ev, idx));
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* ── MEMBER ENTRY TAB — athlete-centric ── */}
              {meetView === "entries" && (
                <div>
                  {!viewingAthleteEntries ? (
                    /* Athlete list — grouped by roster group, pick who to enter */
                    <div>
                      {/* Group filter pills — large tap targets */}
                      <div className="flex flex-wrap gap-2.5 mb-6">
                        <button onClick={() => setMeetGroupFilter("all")}
                          className={`text-lg font-bold px-6 py-4 min-h-[56px] rounded-2xl transition-all active:scale-[0.96] ${meetGroupFilter === "all" ? "bg-[#00f0ff]/15 text-[#00f0ff] border-2 border-[#00f0ff]/30" : "bg-white/[0.03] text-white/50 border-2 border-white/[0.06]"}`}>
                          All
                        </button>
                        {ROSTER_GROUPS.filter(g => g.id !== "diving" && g.id !== "waterpolo").map(g => {
                          const count = filteredRoster.filter(a => a.group.toLowerCase().includes(g.id.toLowerCase())).length;
                          return (
                            <button key={g.id} onClick={() => setMeetGroupFilter(g.id)}
                              className={`text-lg font-bold px-6 py-4 min-h-[56px] rounded-2xl transition-all active:scale-[0.96] ${meetGroupFilter === g.id ? "border-2" : "bg-white/[0.03] border-2 border-white/[0.06]"}`}
                              style={meetGroupFilter === g.id ? { backgroundColor: `${g.color}15`, color: g.color, borderColor: `${g.color}40` } : { color: g.color + "80" }}>
                              {g.name} <span className="text-sm opacity-50">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-2">
                        {filteredRoster.filter(a => meetGroupFilter === "all" || a.group.toLowerCase().includes(meetGroupFilter.toLowerCase())).map(a => {
                          const entryCount = editMeet.events.filter(ev => ev.entries.some(e => e.athleteId === a.name)).length;
                          const group = ROSTER_GROUPS.find(g => a.group.toLowerCase().includes(g.id.toLowerCase()));
                          return (
                            <button key={a.id} onClick={() => setViewingAthleteEntries(a.name)}
                              className="w-full flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-5 min-h-[72px] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all text-left active:scale-[0.98]">
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0"
                                style={{ backgroundColor: (group?.color || "#00f0ff") + "15", color: group?.color || "#00f0ff" }}>
                                {a.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xl font-bold text-white truncate">{a.name}</div>
                                <div className="text-base text-white/40">{a.group}{a.age ? ` · ${a.age}` : ""}</div>
                              </div>
                              <div className="text-right shrink-0">
                                {entryCount > 0 ? (
                                  <div>
                                    <span className="text-2xl font-black text-[#00f0ff]">{entryCount}</span>
                                    <span className="text-sm text-white/30 block">events</span>
                                  </div>
                                ) : (
                                  <span className="text-base text-white/20">—</span>
                                )}
                              </div>
                              <svg className="w-6 h-6 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Individual athlete entry — show all events, toggle entry */
                    <div>
                      <button onClick={() => setViewingAthleteEntries(null)} className="flex items-center gap-2 text-[#00f0ff]/60 text-base font-bold mb-4 hover:text-[#00f0ff] transition-colors py-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        All Athletes
                      </button>
                      {(() => {
                        const athlete = filteredRoster.find(a => a.name === viewingAthleteEntries);
                        if (!athlete) return null;
                        const enteredEvents = editMeet.events.filter(ev => ev.entries.some(e => e.athleteId === athlete.name));
                        const totalEvents = editMeet.events.length;
                        const group = ROSTER_GROUPS.find(g => athlete.group.toLowerCase().includes(g.id.toLowerCase()));
                        return (
                          <div>
                            {/* Athlete header */}
                            <Card className="p-5 mb-5" neon>
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0"
                                  style={{ backgroundColor: (group?.color || "#00f0ff") + "15", color: group?.color || "#00f0ff" }}>
                                  {athlete.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-xl font-black text-white">{athlete.name}</h4>
                                  <p className="text-base text-white/40">{athlete.group} · {athlete.gender === "M" ? "Male" : "Female"}{athlete.age ? ` · Age ${athlete.age}` : ""}</p>
                                </div>
                                <div className="text-center shrink-0">
                                  <div className="text-3xl font-black text-[#00f0ff]">{enteredEvents.length}</div>
                                  <div className="text-sm text-white/30">of {totalEvents}</div>
                                </div>
                              </div>
                            </Card>

                            {/* Events list — toggle entry with large tap targets */}
                            <div className="space-y-2.5">
                              {editMeet.events
                                .filter(ev => ev.gender === "Mixed" || ev.gender === athlete.gender || (!ev.gender))
                                .map((ev, idx) => {
                                const isEntered = ev.entries.some(e => e.athleteId === athlete.name);
                                const seedEntry = ev.entries.find(e => e.athleteId === athlete.name);
                                const strokeColor: Record<string, string> = { "Free": "#00f0ff", "Back": "#4ade80", "Breast": "#f59e0b", "Fly": "#a855f7", "IM": "#ec4899", "Free Relay": "#06b6d4", "Medley Relay": "#d946ef" };
                                const evColor = strokeColor[ev.stroke || ""] || "#00f0ff";
                                const displayName = (ev.distance && ev.stroke) ? `${ev.distance} ${ev.stroke}` : ev.name;
                                const sessionLabel = ev.sessionType === "P" ? "Prelims" : ev.sessionType === "F" ? "Finals" : "";
                                return (
                                  <button key={ev.id} onClick={() => toggleAthleteEntry(editMeet.id, ev.id, athlete.name)}
                                    className={`w-full flex items-center gap-4 px-5 py-5 min-h-[76px] rounded-2xl transition-all text-left active:scale-[0.98] ${
                                      isEntered
                                        ? "bg-[#00f0ff]/[0.08] border-2 border-[#00f0ff]/25"
                                        : "bg-white/[0.02] border-2 border-white/[0.06] hover:bg-white/[0.05]"
                                    }`}>
                                    {/* Checkbox */}
                                    <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${
                                      isEntered ? "bg-[#00f0ff] border-[#00f0ff]" : "border-white/20"
                                    }`}>
                                      {isEntered && <svg className="w-6 h-6 text-[#06020f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    {/* Event # badge */}
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-black" style={{ backgroundColor: `${evColor}15`, color: evColor }}>
                                      {ev.eventNum || idx + 1}
                                    </div>
                                    {/* Event details */}
                                    <div className="flex-1 min-w-0">
                                      <span className={`text-xl font-bold block truncate ${isEntered ? "text-white" : "text-white/50"}`}>{displayName}</span>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {sessionLabel && <span className="text-sm text-white/30">{sessionLabel}</span>}
                                        {ev.qualifyingTime && <span className="text-sm font-mono text-[#f59e0b]/60">QT {ev.qualifyingTime}</span>}
                                        {ev.isRelay && <span className="text-sm text-[#a855f7]/60">Relay</span>}
                                      </div>
                                    </div>
                                    {/* Seed time */}
                                    <span className={`text-lg font-mono shrink-0 ${
                                      seedEntry?.seedTime ? "text-emerald-400 font-bold" : isEntered ? "text-[#f59e0b]" : "text-white/15"
                                    }`}>
                                      {seedEntry?.seedTime || (isEntered ? "NT" : "")}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Navigation between athletes */}
                            <div className="flex gap-3 mt-6">
                              {(() => {
                                const curIdx = filteredRoster.findIndex(a => a.name === viewingAthleteEntries);
                                const prev = curIdx > 0 ? filteredRoster[curIdx - 1] : null;
                                const next = curIdx < filteredRoster.length - 1 ? filteredRoster[curIdx + 1] : null;
                                return (
                                  <>
                                    <button onClick={() => prev && setViewingAthleteEntries(prev.name)} disabled={!prev}
                                      className="flex-1 game-btn py-5 text-lg font-bold text-white/60 border-2 border-white/[0.08] rounded-2xl hover:text-white/80 hover:border-white/[0.15] disabled:opacity-20 transition-all truncate min-h-[60px] active:scale-[0.97]">
                                      ← {prev?.name.split(" ")[0] || ""}
                                    </button>
                                    <button onClick={() => next && setViewingAthleteEntries(next.name)} disabled={!next}
                                      className="flex-1 game-btn py-5 text-lg font-bold text-white/60 border-2 border-white/[0.08] rounded-2xl hover:text-white/80 hover:border-white/[0.15] disabled:opacity-20 transition-all truncate min-h-[60px] active:scale-[0.97]">
                                      {next?.name.split(" ")[0] || ""} →
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
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
        <div className="w-full max-w-[1920px] mx-auto relative z-10 px-5 sm:px-8 lg:px-12 xl:px-16 pb-12">
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
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }}
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
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-white/50">
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
                    {ab.note && <p className="text-xs text-white/50 mt-1">{ab.note}</p>}
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

  /* ════════════════════════════════════════════════════════════
     COACH MAIN VIEW — LEADERBOARD-FIRST LAYOUT
     ════════════════════════════════════════════════════════════ */

  const present = filteredRoster.filter(a => Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean)).length;
  const totalXpToday = filteredRoster.reduce((s, a) => s + (a.dailyXP.date === today() ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0);

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <XpFloats /><LevelUpOverlay />

      <div className="relative z-10 w-full max-w-[1920px] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
        <div className="w-full">
          <GameHUDHeader />

        {/* ══════════════════════════════════════════════════════
           GROUP SELECTOR — SWITCH ROSTER GROUPS
           ══════════════════════════════════════════════════════ */}
        <div className="py-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {accessibleGroups.map(g => {
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
          <div className="text-center mt-3 text-xs font-mono text-white/50">
            {currentGroupDef.icon} {currentGroupDef.name} — {currentGroupDef.sport.toUpperCase()} — {filteredRoster.length} athletes
          </div>

          {/* Best Times — quick action below group selector */}
          {currentGroupDef.sport === "swimming" && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <button onClick={fetchAllBestTimes} disabled={fetchingTimesAll}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all min-h-[48px] active:scale-[0.97] ${
                  fetchingTimesAll
                    ? "bg-[#00f0ff]/10 text-[#00f0ff]/50 cursor-wait"
                    : "bg-[#00f0ff]/10 text-[#00f0ff]/70 border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20"
                }`}>
                <svg className={`w-4 h-4 ${fetchingTimesAll ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {fetchingTimesAll ? "Fetching..." : "Fetch Best Times"}
              </button>
              {bestTimesStatus && (
                <span className={`text-xs ${bestTimesStatus.includes("Error") || bestTimesStatus.includes("not found") ? "text-red-400/60" : "text-emerald-400/60"}`}>
                  {bestTimesStatus}
                </span>
              )}
              {(() => {
                const withTimes = filteredRoster.filter(a => a.bestTimes && a.bestTimes.length > 0).length;
                return withTimes > 0 ? (
                  <span className="text-xs text-white/30">{withTimes}/{filteredRoster.length} have times</span>
                ) : null;
              })()}
            </div>
          )}
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
                        <div className="text-[#00f0ff]/20 text-xs truncate w-full font-mono">{a.name.split(" ").slice(1).join(" ")}</div>
                        <div className="rank-badge text-xs font-bold mt-3 px-4 py-1.5 inline-flex items-center gap-1.5 font-mono" style={{ color: lv.color, background: `${lv.color}18`, boxShadow: `0 0 15px ${lv.color}15` }}>
                          {lv.icon} {lv.name}
                        </div>
                        <div className="neon-text-gold text-2xl sm:text-3xl font-black mt-3 tracking-tight font-mono tabular-nums whitespace-nowrap">
                          {a.xp}<span className="text-xs text-[#f59e0b]/30 ml-1">XP</span>
                        </div>
                        {a.streak > 0 && (
                          <div className="text-white/50 text-sm mt-1 font-bold inline-flex items-center gap-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316"><path d="M12 23c-3.9 0-7-3.1-7-7 0-3 2-5.5 4-8l3 3c.4.4 1 .2 1-.3V2l5 6c2 2.4 3 5 3 8 0 3.9-3.1 7-7 7z"/></svg> {a.streak}d streak</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top 10 ranked list */}
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="text-[#00f0ff]/40 text-xs uppercase tracking-[0.2em] font-bold font-mono">// Top 10 Rankings</h3>
              <span className="text-[#00f0ff]/20 text-xs font-mono">{Math.min(10, sorted.length)} of {sorted.length}</span>
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
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1 transition-all" style={{ color: lv.color, background: `${lv.color}12`, boxShadow: `0 0 8px ${lv.color}08` }}>{lv.icon} {lv.name}</span>
                    {a.streak > 0 && <span className="text-white/50 text-sm hidden sm:inline-flex items-center gap-0.5 font-bold"><svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316"><path d="M12 23c-3.9 0-7-3.1-7-7 0-3 2-5.5 4-8l3 3c.4.4 1 .2 1-.3V2l5 6c2 2.4 3 5 3 8 0 3.9-3.1 7-7 7z"/></svg> {a.streak}d</span>}
                    <span className="text-[#f59e0b] text-sm font-black w-16 text-right tabular-nums whitespace-nowrap shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">{a.xp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════ TEAM CHALLENGES ═══════ */}
        {view === "coach" && (
          <div className="w-full py-4">
            <h3 className="text-[#f59e0b]/50 text-xs uppercase tracking-[0.2em] font-bold font-mono mb-3">// Team Challenges</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    <p className="text-white/50 text-sm mb-3">{challenge.desc}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono tracking-wider" style={{ color: `${challenge.color}80` }}>{challenge.metric}</span>
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
        <div className="w-full py-6">
          <div className="w-full">
            {/* Session mode — full-width tabs */}
            <div className="space-y-2.5 mb-5">
              <div className="grid grid-cols-3 gap-2">
                {(["pool", "weight", "meet"] as const).map(m => {
                  const sportLabels = { swimming: { pool: "Pool", weight: "Weight Room", meet: "Meet Day" }, diving: { pool: "Board", weight: "Dryland", meet: "Meet Day" }, waterpolo: { pool: "Pool", weight: "Gym", meet: "Match Day" } };
                  const labels = sportLabels[currentSport as keyof typeof sportLabels] || sportLabels.swimming;
                  const ModeSvg = () => {
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
                      <ModeSvg /><span className="text-[11px]">{labels[m]}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => {
                  const ga = roster.filter(a => a.group === selectedGroup);
                  const hasCheckins = ga.some(a => a.present || Object.values(a.checkpoints).some(Boolean));
                  if (hasCheckins) {
                    setConfirmAction({ label: `Switch to ${sessionTime === "am" ? "PM" : "AM"}? This will save and end the current session.`, action: () => { endSessionManual(); setSessionTime(sessionTime === "am" ? "pm" : "am"); } });
                  } else {
                    setSessionTime(sessionTime === "am" ? "pm" : "am");
                  }
                }}
                className={`w-full text-xs font-bold font-mono tracking-wider transition-all duration-200 rounded-xl min-h-[44px] ${
                  sessionTime === "am"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                }`}>
                {sessionTime === "am" ? "☀ AM" : "☽ PM"}
              </button>
            </div>

            {/* End Session banner — prominent, appears when athletes are checked in */}
            {(() => {
              const ga = roster.filter(a => a.group === selectedGroup);
              const checkedIn = ga.filter(a => a.present || Object.values(a.checkpoints).some(Boolean) || Object.values(a.weightCheckpoints).some(Boolean) || Object.values(a.meetCheckpoints).some(Boolean)).length;
              if (checkedIn === 0) return null;
              return (
                <button onClick={() => setConfirmAction({ label: `End session? ${checkedIn} athlete${checkedIn !== 1 ? "s" : ""} checked in — data will be saved to history.`, action: endSessionManual })}
                  className="w-full mb-3 py-4 bg-emerald-500/15 text-emerald-400 text-sm font-bold font-mono tracking-wider border border-emerald-500/30 rounded-xl hover:bg-emerald-500/25 transition-all active:scale-[0.98] min-h-[56px]">
                  End Session + Save ({checkedIn} checked in)
                </button>
              );
            })()}

            {/* Quick actions — full-width toolbar */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <button onClick={bulkMarkPresent} className="game-btn py-3 bg-[#00f0ff]/10 text-[#00f0ff]/70 text-xs font-mono tracking-wider border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">
                Bulk Check-In
              </button>
              <button onClick={exportCSV} className="game-btn py-3 bg-[#06020f]/60 text-white/50 text-xs font-mono border border-white/[0.06] hover:text-[#00f0ff]/50 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">Export</button>
              <button onClick={() => setAddAthleteOpen(!addAthleteOpen)} className="game-btn py-3 bg-[#06020f]/60 text-white/50 text-xs font-mono border border-white/[0.06] hover:text-[#a855f7]/50 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">
                {addAthleteOpen ? "Cancel" : "+ Athlete"}
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
                      <button onClick={() => { setShowMoreMenu(false); endSessionManual(); }} className="w-full text-left px-4 py-3 text-[#22d3ee] text-xs font-mono font-bold hover:bg-[#22d3ee]/10 transition-colors">End Session + Save</button>
                      <button onClick={() => { setShowMoreMenu(false); setViewingSession(sessionHistory.filter(s => s.group === selectedGroup).slice(-1)[0] || null); }} className="w-full text-left px-4 py-3 text-[#22d3ee]/60 text-xs font-mono hover:bg-[#22d3ee]/10 hover:text-[#22d3ee]/80 transition-colors">Session History ({sessionHistory.filter(s => s.group === selectedGroup).length})</button>
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
              <div className="flex items-center justify-between gap-3 mt-3 px-4 py-3 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl">
                <span className="text-[#f59e0b]/80 text-xs font-mono">Bulk check-in applied</span>
                <button onClick={bulkUndoAll} className="px-4 py-1.5 bg-[#f59e0b]/20 text-[#f59e0b] text-xs font-bold font-mono rounded-lg hover:bg-[#f59e0b]/30 transition-all active:scale-[0.97]">Undo All</button>
              </div>
            )}
            {/* Confirm dialog for destructive actions */}
            {confirmAction && (
              <div className="flex items-center justify-between gap-3 mt-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <span className="text-red-400/80 text-xs font-mono">{confirmAction.label}</span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 bg-white/[0.05] text-white/50 text-xs font-mono rounded-lg hover:bg-white/[0.1] transition-all">Cancel</button>
                  <button onClick={() => { confirmAction.action(); setConfirmAction(null); }} className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold font-mono rounded-lg hover:bg-red-500/30 transition-all active:scale-[0.97]">Confirm</button>
                </div>
              </div>
            )}

            {/* Session History overlay */}
            {viewingSession && (
              <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingSession(null)}>
                <div className="bg-[#0a0315] border border-white/10 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="sticky top-0 bg-[#0a0315] border-b border-white/10 p-4 flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg">Session History</h3>
                    <button onClick={() => setViewingSession(null)} className="text-white/40 hover:text-white/80 text-2xl leading-none">&times;</button>
                  </div>
                  {/* Session list */}
                  <div className="p-4 space-y-2">
                    {sessionHistory.filter(s => s.group === selectedGroup).reverse().map(sess => (
                      <button key={sess.id} onClick={() => setViewingSession(sess)}
                        className={`w-full text-left p-4 rounded-xl border transition-all min-h-[56px] ${
                          viewingSession.id === sess.id
                            ? "bg-[#22d3ee]/10 border-[#22d3ee]/30"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                        }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-white/80 font-mono text-sm">{new Date(sess.date + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                            <span className={`font-mono text-xs font-bold ml-2 ${(sess.sessionTime === "pm" || (!sess.sessionTime && sess.startedAt > 0 && new Date(sess.startedAt).getHours() >= 12)) ? "text-[#a855f7]" : "text-[#f59e0b]"}`}>
                              {(sess.sessionTime === "am" || sess.sessionTime === "pm") ? sess.sessionTime.toUpperCase() : new Date(sess.startedAt).getHours() < 12 ? "AM" : "PM"}
                            </span>
                            {sess.startedAt > 0 && (
                              <span className="text-white/30 font-mono text-xs ml-1">
                                {new Date(sess.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                {sess.endedAt > sess.startedAt && ` – ${new Date(sess.endedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                              </span>
                            )}
                          </div>
                          <span className="text-[#22d3ee]/60 font-mono text-sm">{sess.totalAttendance}/{sess.totalAthletes}</span>
                        </div>
                      </button>
                    ))}
                    {sessionHistory.filter(s => s.group === selectedGroup).length === 0 && (
                      <div className="text-center text-white/30 font-mono text-sm py-8">No session history yet. Sessions are auto-saved when a new practice starts.</div>
                    )}
                  </div>
                  {/* Session detail */}
                  {viewingSession && viewingSession.presentAthletes.length > 0 && (
                    <div className="border-t border-white/10 p-4">
                      <h4 className="text-white/60 font-mono text-xs uppercase mb-3 tracking-wider">
                        {new Date(viewingSession.date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — {(viewingSession.sessionTime === "am" || viewingSession.sessionTime === "pm") ? viewingSession.sessionTime.toUpperCase() : new Date(viewingSession.startedAt).getHours() < 12 ? "AM" : "PM"} PRACTICE
                        {viewingSession.startedAt > 0 && <span className="ml-1 text-white/30">({new Date(viewingSession.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – {new Date(viewingSession.endedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})</span>}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-[#22d3ee]/5 rounded-lg p-3 text-center">
                          <div className="text-[#22d3ee] font-bold text-xl">{viewingSession.totalAttendance}</div>
                          <div className="text-white/40 text-xs font-mono">PRESENT</div>
                        </div>
                        <div className="bg-[#a855f7]/5 rounded-lg p-3 text-center">
                          <div className="text-[#a855f7] font-bold text-xl">{Object.values(viewingSession.xpAwarded).reduce((s, v) => s + v, 0)}</div>
                          <div className="text-white/40 text-xs font-mono">TOTAL XP</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-white/40 font-mono text-xs uppercase mb-2">Athletes Present</div>
                        {viewingSession.presentAthletes.map(id => {
                          const ath = roster.find(a => a.id === id);
                          return ath ? (
                            <div key={id} className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-lg">
                              <span className="text-white/70 text-sm">{ath.name}</span>
                              <span className="text-[#f59e0b]/60 font-mono text-xs">+{viewingSession.xpAwarded[id] || 0} XP</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                      {/* Restore session button */}
                      <button onClick={() => {
                        // Restore this session's checkpoints to the roster (for editing)
                        const restored = roster.map(a => {
                          if (a.group !== selectedGroup) return a;
                          const cp = viewingSession.checkpoints[a.id] || {};
                          const wcp = viewingSession.weightCheckpoints[a.id] || {};
                          const wasPresent = viewingSession.presentAthletes.includes(a.id);
                          return { ...a, present: wasPresent, checkpoints: cp, weightCheckpoints: wcp };
                        });
                        setRoster(restored);
                        save(K.ROSTER, restored);
                        syncSaveRoster(K.ROSTER, selectedGroup, restored);
                        setViewingSession(null);
                      }} className="w-full mt-4 py-3 bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b]/80 font-mono text-xs rounded-xl hover:bg-[#f59e0b]/20 transition-all active:scale-[0.98] min-h-[48px]">
                        Restore This Session (Edit)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Active session info bar */}
            <div className="flex items-center gap-3 mb-4 text-xs font-mono tracking-wider text-white/25">
              <span className="text-[#00f0ff]/40">COACH: <span className="text-[#00f0ff]/70">{activeCoach}</span></span>
              <span className="text-white/10">|</span>
              <span className="text-[#a855f7]/40">SESSION: <span className="text-[#e879f9]/70">{sessionTime.toUpperCase()} {sessionMode === "pool" ? "POOL" : sessionMode === "weight" ? "WEIGHT" : "MEET"}</span></span>
              <span className="text-white/10">|</span>
              {activeCoachGroups.includes("all") && <button onClick={() => setManageCoaches(!manageCoaches)}
                className="text-white/50 hover:text-[#00f0ff]/60 transition-colors">
                {manageCoaches ? "CLOSE" : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1 -mt-0.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>MANAGE COACHES</>}
              </button>}
            </div>

            {/* Coach management modal — rendered as fixed overlay to avoid z-index/stacking issues on iOS */}
            {manageCoaches && activeCoachGroups.includes("all") && (
              <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={() => setManageCoaches(false)}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-[#0a0518] border border-[#00f0ff]/20 p-5 shadow-[0_0_60px_rgba(0,240,255,0.1)]" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[#00f0ff]/60 text-xs uppercase tracking-[0.2em] font-bold font-mono">// Coach Profiles</h4>
                    <button onClick={() => setManageCoaches(false)} className="text-white/60 hover:text-white/60 transition-colors text-lg leading-none">&times;</button>
                  </div>
                  <div className="space-y-2 mb-4">
                    {coaches.map((c, i) => (
                      <div key={i} className="py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-xs font-mono ${c.role === "head" ? "text-[#f59e0b]" : "text-[#00f0ff]/60"}`}>
                              {c.role === "head" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" className="inline-block -mt-0.5"><path d="M2 20h20l-2-8-4 4-4-8-4 8-4-4z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.5" className="inline-block -mt-0.5"><path d="M2 20c2-1 4-2 6-2s4 1 6 2 4 1 6 0" strokeLinecap="round"/><circle cx="12" cy="9" r="3"/></svg>} {c.name}
                            </span>
                            <span className="text-xs text-white/50 font-mono">PIN: {c.pin}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-mono ${c.role === "head" ? "bg-[#f59e0b]/10 text-[#f59e0b]/60" : "bg-[#00f0ff]/10 text-[#00f0ff]/40"}`}>
                              {c.role.toUpperCase()}
                            </span>
                          </div>
                          {!(c.role === "head" && coaches.filter(x => x.role === "head").length <= 1) && (
                            <button onClick={() => removeCoach(i)} className="text-red-400/40 hover:text-red-400/80 text-sm transition-colors ml-2">&times;</button>
                          )}
                        </div>
                        <div className="flex gap-1 flex-wrap mt-1.5">
                          {c.groups.includes("all") ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b]/50 font-mono">ALL GROUPS</span>
                          ) : c.groups.map(gId => {
                            const gDef = ROSTER_GROUPS.find(g => g.id === gId);
                            return gDef ? <span key={gId} className="text-xs px-1.5 py-0.5 rounded bg-white/[0.04] text-white/60 font-mono">{gDef.icon} {gDef.name}</span> : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-2 items-center flex-wrap">
                      <input value={newCoachName} onChange={e => setNewCoachName(e.target.value)} placeholder="Coach name"
                        type="text" autoComplete="off" autoCorrect="off" autoCapitalize="words" inputMode="text"
                        className="bg-[#1a1025] border border-white/[0.15] rounded-lg px-3 py-2.5 text-white text-sm w-36 focus:outline-none focus:border-[#00f0ff]/50 focus:ring-1 focus:ring-[#00f0ff]/30 min-h-[48px]" style={{ fontSize: "16px" }} />
                      <input value={newCoachPin} onChange={e => setNewCoachPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4-digit PIN"
                        type="tel" autoComplete="off" inputMode="numeric" pattern="[0-9]*"
                        className="bg-[#1a1025] border border-white/[0.15] rounded-lg px-3 py-2.5 text-white text-sm w-28 focus:outline-none focus:border-[#00f0ff]/50 focus:ring-1 focus:ring-[#00f0ff]/30 min-h-[48px]" style={{ fontSize: "16px" }} />
                      <select value={newCoachRole} onChange={e => { const role = e.target.value as "head" | "assistant" | "guest"; setNewCoachRole(role); if (role === "head") setNewCoachGroups(["all"]); }}
                        className="bg-[#1a1025] border border-white/[0.15] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none min-h-[48px]" style={{ fontSize: "16px" }}>
                        <option value="assistant" style={{ background: "#1a1025", color: "white" }}>Assistant</option>
                        <option value="head" style={{ background: "#1a1025", color: "white" }}>Head Coach</option>
                      </select>
                    </div>
                    {newCoachRole === "assistant" && (
                      <div>
                        <p className="text-white/50 text-sm font-mono mb-2">ASSIGN GROUPS:</p>
                        <div className="flex gap-2 flex-wrap">
                          {ROSTER_GROUPS.map(g => {
                            const sel = newCoachGroups.includes(g.id);
                            return (
                              <button key={g.id} type="button" onClick={() => setNewCoachGroups(prev => sel ? prev.filter(x => x !== g.id) : [...prev.filter(x => x !== "all"), g.id])}
                                className={`px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-all min-h-[44px] ${sel ? "border-[#00f0ff]/40 bg-[#00f0ff]/15 text-[#00f0ff]" : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white/50"}`}>
                                {g.icon} {g.name.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <button onClick={addCoach} disabled={!newCoachName.trim() || newCoachPin.length < 4 || (newCoachRole === "assistant" && newCoachGroups.filter(x => x !== "all").length === 0)}
                      className="w-full px-5 py-3 rounded-lg bg-[#00f0ff]/15 text-[#00f0ff] text-sm font-bold border border-[#00f0ff]/30 hover:bg-[#00f0ff]/25 transition-all min-h-[48px] disabled:opacity-30 disabled:cursor-not-allowed">
                      + Add Coach
                    </button>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/[0.06]">
                    <h5 className="text-[#a855f7]/40 text-xs uppercase tracking-[0.2em] font-bold mb-2 font-mono">// Quick Invite</h5>
                    <p className="text-white/50 text-sm mb-2 font-mono">Share this link — coaches log in with their own PIN:</p>
                    <div className="flex gap-2 items-center">
                      <code className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[#00f0ff]/60 text-xs font-mono truncate">
                        {typeof window !== "undefined" ? `${window.location.origin}/apex-athlete/portal` : "/apex-athlete/portal"}
                      </code>
                      <button
                        onClick={() => { if (typeof navigator !== "undefined") navigator.clipboard.writeText(`${window.location.origin}/apex-athlete/portal`); }}
                        className="px-3 py-2 rounded-lg bg-[#a855f7]/10 text-[#a855f7]/60 text-xs font-bold border border-[#a855f7]/20 hover:bg-[#a855f7]/20 transition-all min-h-[34px] shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1 -mt-0.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add athlete — expandable */}
            <div className="mb-6">
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
            <h3 className="text-[#00f0ff]/30 text-xs uppercase tracking-[0.2em] font-bold mb-4 font-mono">// Roster Check-In</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-10">
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
                      >
                        {/* Present toggle — one tap, no expansion */}
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePresent(a.id); }}
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 active:scale-90 ${
                            a.present
                              ? "border-emerald-400 bg-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                              : "border-white/15 hover:border-white/30"
                          }`}
                          aria-label={a.present ? "Mark absent" : "Mark present"}
                        >
                          {a.present
                            ? <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            : <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                          }
                        </button>
                        <div className="flex items-center gap-4 flex-1 min-w-0" onClick={() => setExpandedId(isExp ? null : a.id)}>
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 transition-all duration-300 group-hover:scale-110"
                          style={{ background: `radial-gradient(circle at 30% 30%, ${lv.color}30, ${lv.color}08)`, border: `2.5px solid ${lv.color}${hasCk ? "90" : "35"}`, boxShadow: hasCk ? `0 0 25px ${lv.color}25, 0 0 50px ${lv.color}08` : `0 0 10px ${lv.color}10` }}
                        >
                          {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{a.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>{lv.icon} {lv.name}</span>
                            {a.streak > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]/70 inline-flex items-center gap-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316"><path d="M12 23c-3.9 0-7-3.1-7-7 0-3 2-5.5 4-8l3 3c.4.4 1 .2 1-.3V2l5 6c2 2.4 3 5 3 8 0 3.9-3.1 7-7 7z"/></svg> {a.streak}d · {sk.mult}</span>}
                            {a.present && <span className="text-emerald-400/60 text-xs font-bold">PRESENT</span>}
                          </div>
                        </div>
                        <div className="w-28 shrink-0 text-right">
                          <div className="text-white font-black text-base tabular-nums whitespace-nowrap drop-shadow-[0_0_8px_rgba(245,158,11,0.15)]">{a.xp}<span className="text-white/60 text-sm ml-1">XP</span></div>
                          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden mt-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]">
                            <div className="h-full rounded-full xp-shimmer" style={{ width: `${prog.percent}%` }} />
                          </div>
                          {dailyUsed > 0 && <div className="text-xs text-[#f59e0b]/60 font-bold mt-1.5">+{dailyUsed} today</div>}
                        </div>
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
              <h3 className="text-[#00f0ff]/30 text-xs uppercase tracking-[0.2em] font-bold mb-4 font-mono">// Team Challenges</h3>
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
                      <p className="text-white/50 text-xs mb-3">{tc.description} · <span className="text-[#f59e0b]/60">+{tc.reward} XP</span></p>
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
        <div className="text-center text-white/[0.06] text-xs py-10 space-y-2">
          <p className="text-white/60 text-sm italic">&ldquo;Unlocking the greatness already inside every athlete — through the power of play.&rdquo;</p>
          <p className="text-white/[0.04]">Every rep counts. Every streak matters. Every athlete has a story.</p>
        </div>
      </div>
    </div>
  );
}
