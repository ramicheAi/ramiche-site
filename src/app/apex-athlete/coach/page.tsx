"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MASTER_PIN, clearSession } from "../auth";
import { useCoachAuth } from "../hooks/useCoachAuth";
import ParticleField from "@/components/ParticleField";
import { createInvite, getInvites, deactivateInvite, getInviteUrl, type Invite, type InviteRole } from "../invites";
import { fbSaveRoster, fbGet } from "@/lib/firebase";
import { syncSave, syncLoad, syncPushAllToFirebase } from "@/lib/apex-sync";
import { AnimatedCounter } from "../components/AnimatedCounter";
import StreakFlame from "../components/StreakFlame";
import PinAuthScreen from "./components/PinAuthScreen";
import LevelUpOverlay from "./components/LevelUpOverlay";
import AchievementToasts, { type AchievementToast } from "./components/AchievementToasts";
import ComboCounter from "./components/ComboCounter";
import PracticeRecapModal, { type RecapData } from "./components/PracticeRecapModal";
import { useXPEngine } from "./hooks/useXPEngine";
import GroupSelector from "./components/GroupSelector";
import StaffView from "./components/StaffView";

import BgOrbs from "./components/BgOrbs";
import XpFloats from "./components/XpFloats";
import ScheduleView from "./views/ScheduleView";
import CommsView from "./views/CommsView";
import MeetsView from "./views/MeetsView";
import AnalyticsDashboard from "./views/AnalyticsDashboard";
import AnalyticsTabContainer from "./views/AnalyticsTabContainer";
import type { Athlete, DailyXP, AuditEntry, TeamChallenge, DailySnapshot, TeamCulture, RosterGroup, SwimMeet, MentalReadiness, BreathworkSession, JournalEntry, RecoveryLog, WellnessData } from "./types";
import type { ScoringResult } from "../lib/meet-scoring";
import ParentPreviewModal from "./components/ParentPreviewModal";
import SplitAnalyzer from "./components/SplitAnalyzer";
import TeamAnalytics from "./components/TeamAnalytics";
import TimeStandards from "./components/TimeStandards";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Saint Andrew's Aquatics — Platinum Group
   Clean UI · React + Tailwind · localStorage
   ══════════════════════════════════════════════════════════════ */

// ── micro sound effects (Web Audio API) ──────────────────────
const SFX = {
  tick: () => { try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 1200; o.type = "sine"; g.gain.setValueAtTime(0.12, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08); o.start(); o.stop(c.currentTime + 0.08); } catch {} },
  untick: () => { try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 600; o.type = "sine"; g.gain.setValueAtTime(0.06, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06); o.start(); o.stop(c.currentTime + 0.06); } catch {} },
  questAssign: () => { try { const c = new AudioContext(); [660, 880].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; o.type = "triangle"; g.gain.setValueAtTime(0, c.currentTime + i * 0.08); g.gain.linearRampToValueAtTime(0.08, c.currentTime + i * 0.08 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.08 + 0.15); o.start(c.currentTime + i * 0.08); o.stop(c.currentTime + i * 0.08 + 0.15); }); } catch {} },
  questDone: () => { try { const c = new AudioContext(); [784, 988, 1318].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0, c.currentTime + i * 0.1); g.gain.linearRampToValueAtTime(0.1, c.currentTime + i * 0.1 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.1 + 0.25); o.start(c.currentTime + i * 0.1); o.stop(c.currentTime + i * 0.1 + 0.25); }); } catch {} },
  shoutout: () => { try { const c = new AudioContext(); [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; o.type = "triangle"; g.gain.setValueAtTime(0, c.currentTime + i * 0.06); g.gain.linearRampToValueAtTime(0.07, c.currentTime + i * 0.06 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.06 + 0.2); o.start(c.currentTime + i * 0.06); o.stop(c.currentTime + i * 0.06 + 0.2); }); } catch {} },
};

// ── game engine (shared) ────────────────────────────────────
import { LEVELS, getLevel, getNextLevel, getLevelProgress, getStreakMult, getWeightStreakMult, fmtStreak, fmtWStreak } from "../lib/game-engine";
import { getSportConfig } from "../lib/sport-config";

const DAILY_XP_CAP = 150;
const PRESENT_XP = 5; // Base XP just for showing up
const SHOUTOUT_XP = 25; // MVP/Shoutout bonus XP
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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
  { id: "m-best-time", name: "Season Best", xp: 15, desc: "Fastest time this season (not all-time PR)" },
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

// ── Real schedules from GoMotion + Ramon's PDF corrections (Feb 12) ──
function _s(type: SessionType, label: string, start: string, end: string, location = "Main Pool", notes = ""): ScheduleSession {
  return { id: `s-${Math.random().toString(36).slice(2, 8)}`, type, label, startTime: start, endTime: end, location, notes };
}
const _rest = (): DaySchedule => ({ template: "rest-day", sessions: [] });

// Source: Ramon's direct input (Mar 21, 2026) — CANONICAL. Do NOT modify without Ramon's approval.
// Weight room is 5:15 PM start (per Ramon's correction)
const REAL_SCHEDULES: Record<string, GroupSchedule> = {
  platinum: { groupId: "platinum", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [_s("pool", "Aerobic Endurance", "05:30", "07:00"), _s("pool", "Split: Sprint / Mid-Distance", "15:30", "17:00"), _s("weight", "Weight Room", "17:15", "18:30", "Weight Room")] },
    Tue: { template: "200-pace-day", sessions: [_s("pool", "All Groups 200-Pace Day", "16:00", "18:00")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Boys: Power/Speed · Girls: IM", "05:30", "07:00"), _s("pool", "Recovery (drills, starts, turns)", "15:30", "17:00"), _s("weight", "Weight Room", "17:15", "18:30", "Weight Room")] },
    Thu: { template: "technique-day", sessions: [_s("pool", "Sprint: Speed Work · Mid-D: Aerobic", "16:00", "18:00")] },
    Fri: { template: "sprint-day", sessions: [_s("pool", "Girls: Power/Speed · Boys: IM", "05:30", "07:00"), _s("weight", "Weight Room", "17:15", "18:30", "Weight Room")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Lactic Acid Threshold — Race Pace", "07:00", "09:30")] },
  }},
  // Source: GoMotion screenshots (Mon Mar 02 – Sat Mar 07, 2026) — CANONICAL
  gold: { groupId: "gold", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [_s("pool", "Gold", "17:30", "19:30")] },
    Tue: { template: "endurance-day", sessions: [_s("pool", "Gold", "17:30", "19:30")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Gold", "17:30", "19:30")] },
    Thu: { template: "technique-day", sessions: [_s("pool", "Gold", "17:30", "19:30")] },
    Fri: { template: "sprint-day", sessions: [_s("pool", "Gold", "17:30", "19:30")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Gold + Platinum Saturday", "07:00", "09:30")] },
  }},
  silver: { groupId: "silver", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [_s("pool", "Silver", "18:00", "19:30")] },
    Tue: { template: "endurance-day", sessions: [_s("pool", "Silver", "18:00", "19:30")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Silver", "18:00", "19:30")] },
    Thu: { template: "technique-day", sessions: [_s("pool", "Silver", "18:00", "19:30")] },
    Fri: { template: "sprint-day", sessions: [_s("pool", "Silver", "18:00", "19:30")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Silver Saturday", "08:50", "11:00")] },
  }},
  bronze1: { groupId: "bronze1", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [_s("pool", "Bronze 1", "17:00", "18:00")] },
    Tue: { template: "endurance-day", sessions: [_s("pool", "Bronze 1", "15:30", "16:30")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Bronze 1", "17:00", "18:00")] },
    Thu: { template: "technique-day", sessions: [_s("pool", "Bronze 1", "15:30", "16:30")] },
    Fri: { template: "sprint-day", sessions: [_s("pool", "Bronze 1", "17:00", "18:00")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Bronze 1 Saturday", "11:00", "12:00")] },
  }},
  bronze2: { groupId: "bronze2", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "endurance-day", sessions: [_s("pool", "Bronze 2", "17:30", "18:30")] },
    Tue: { template: "endurance-day", sessions: [_s("pool", "Bronze 2", "17:00", "18:00")] },
    Wed: { template: "drill-day", sessions: [_s("pool", "Bronze 2", "17:25", "18:25")] },
    Thu: { template: "technique-day", sessions: [_s("pool", "Bronze 2", "17:00", "18:00")] },
    Fri: { template: "sprint-day", sessions: [_s("pool", "Bronze 2", "17:00", "18:00")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Bronze 2 Saturday", "11:00", "12:00")] },
  }},
  diving: { groupId: "diving", weekSchedule: {
    Sun: _rest(),
    Mon: { template: "drill-day", sessions: [_s("pool", "Diving", "15:30", "17:00")] },
    Tue: _rest(),
    Wed: { template: "drill-day", sessions: [_s("pool", "Diving", "15:30", "17:00")] },
    Thu: { template: "drill-day", sessions: [_s("pool", "Diving", "15:30", "17:30")] },
    Fri: { template: "drill-day", sessions: [_s("pool", "Diving", "15:30", "17:00")] },
    Sat: { template: "meet-day", sessions: [_s("pool", "Diving Saturday", "10:00", "11:00")] },
  }},
  waterpolo: { groupId: "waterpolo", weekSchedule: {
    Sun: _rest(),
    Mon: _rest(),
    Tue: _rest(),
    Wed: _rest(),
    Thu: { template: "technique-day", sessions: [_s("pool", "Swimming & Water Polo", "17:45", "18:45")] },
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

// Helper to get sport from athlete group
function getSportForAthlete(athlete: { group: string }): string {
  const groupDef = ROSTER_GROUPS.find(g => g.id === athlete.group);
  return groupDef?.sport || "swimming";
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
    pin: String(100000 + Math.floor(Math.random() * 900000)),
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
  SESSION_HISTORY: "apex-athlete-session-history-v1",
  ACTIVE_SESSION: "apex-athlete-active-session-v1",
  SESSION_MODE: "apex-athlete-session-mode-v1",
};

interface SessionRecord {
  id: string;
  date: string;
  group: string;
  startTime: string;
  endTime: string;
  sessionType: "am" | "pm";
  attendance: { id: string; name: string; present: boolean; checkpoints: Record<string, boolean>; weightCheckpoints: Record<string, boolean>; }[];
  totalPresent: number;
  totalAthletes: number;
  locked: boolean;
}

// Get the current scheduled practice session for a group, or null if none
function getCurrentScheduledSession(group: string): { startTime: string; endTime: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const schedules = JSON.parse(localStorage.getItem("apex-athlete-schedules-v1") || "[]");
    const now = new Date();
    const dayMap: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
    const dayKey = dayMap[now.getDay()];
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (const gs of schedules) {
      if (gs.groupId !== group) continue;
      const day = gs.weekSchedule?.[dayKey];
      if (!day?.sessions?.length) continue;
      for (const sess of day.sessions) {
        const [sh, sm] = sess.startTime.split(":").map(Number);
        const [eh, em] = sess.endTime.split(":").map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        // Within session window (30 min before start to 3 hours after end)
        if (nowMins >= startMins - 30 && nowMins <= endMins + 180) {
          return { startTime: sess.startTime, endTime: sess.endTime };
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

// Check if the current practice session has ended (3 hours past end time)
function isSessionExpired(group: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const active = JSON.parse(localStorage.getItem("apex-athlete-active-session-v1") || "null");
    if (!active || active.group !== group) return false;
    const now = new Date();
    const [eh, em] = (active.endTime || "18:00").split(":").map(Number);
    const endMins = eh * 60 + em;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const activeDate = active.date || "";
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // If the active session is from a previous day, it's expired
    if (activeDate < todayStr) return true;
    // If 3 hours past end time, it's expired
    return nowMins > endMins + 180;
  } catch { return false; }
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    try { return JSON.parse(v); } catch { return v as unknown as T; }
  } catch { return fallback; }
}
function save(key: string, val: unknown) {
  // BACKUP: Before overwriting roster, save a timestamped backup
  if (key === "apex-athlete-roster-v5" && Array.isArray(val)) {
    const existing = localStorage.getItem(key);
    if (existing) {
      try {
        const prev = JSON.parse(existing);
        const prevXP = Array.isArray(prev) ? prev.reduce((s: number, a: { xp?: number }) => s + (a.xp || 0), 0) : 0;
        const newXP = (val as { xp?: number }[]).reduce((s, a) => s + (a.xp || 0), 0);
        // Only backup if we're about to lose XP
        if (prevXP > 0 && newXP < prevXP) {
          const backupKey = `apex-athlete-roster-backup-${new Date().toISOString().slice(0, 10)}`;
          localStorage.setItem(backupKey, existing);
          console.warn(`[Save] Backup created: ${backupKey} (prevXP: ${prevXP}, newXP: ${newXP})`);
        }
      } catch { /* ignore parse errors */ }
    }
  }
  localStorage.setItem(key, JSON.stringify(val));
  if (key === "apex-athlete-roster-v5" && Array.isArray(val)) {
    fbSaveRoster("all", val).catch(() => {});
    fbSaveRoster("platinum", val).catch(() => {});
  }
}

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
  <div style={{animation: 'glowBreathe 4s ease-in-out infinite'}} className={`game-panel game-panel-border game-panel-scan relative bg-[#0e0e18]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] ${glow ? "neon-pulse" : ""} ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}>{children}</div>
);

// BgOrbs extracted to ./components/BgOrbs.tsx

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function ApexAthletePage() {
  const router = useRouter();
  const [roster, setRoster] = useState<Athlete[]>([]);
  const { coachPin, setCoachPin, pinInput, setPinInput, unlocked, setUnlocked } = useCoachAuth();
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [expandedCheckIn, setExpandedCheckIn] = useState<string | null>(null);
  const [parentPreviewAthlete, setParentPreviewAthlete] = useState<string | null>(null);
  // Always start on "pool" — coach explicitly taps to switch. Never auto-restore from localStorage.
  const [sessionMode, setSessionModeRaw] = useState<"pool" | "weight" | "meet">("pool");
  // Pending mode switch — requires confirmation tap to actually switch
  const [pendingMode, setPendingMode] = useState<"pool" | "weight" | "meet" | null>(null);
  const pendingModeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: only switch mode via deliberate onClick with strict debounce + scroll/touch guards
  const lastModeSwitch = useRef(0);
  const modeSwitchLocked = useRef(false);
  const handleModeClick = useCallback((m: "pool" | "weight" | "meet", e: React.MouseEvent) => {
    if (!e.isTrusted) return;
    if (sessionMode === m) return;
    setPendingMode(null);
    setSessionModeRaw(m);
  }, [sessionMode]);

  // Auto-detect session mode moved below selectedGroup declaration

  // Always compute AM/PM from real clock time on page load. Manual toggle is session-only (sessionStorage).
  const [sessionTime, setSessionTime] = useState<"am" | "pm">(() => {
    if (typeof window === "undefined") return "am";
    const realTime = new Date().getHours() < 12 ? "am" : "pm";
    // Check if coach manually toggled in THIS browser session (survives soft navigations, not hard refresh)
    const manualDate = sessionStorage.getItem("apex_session_time_manual");
    if (manualDate === today()) {
      const saved = sessionStorage.getItem("apex_session_time_value");
      if (saved === "am" || saved === "pm") return saved;
    }
    // Clean up any stale sessionStorage
    if (manualDate && manualDate !== today()) {
      sessionStorage.removeItem("apex_session_time_manual");
      sessionStorage.removeItem("apex_session_time_value");
    }
    // Also clean up old localStorage overrides (migration from previous version)
    localStorage.removeItem("apex_session_time_manual");
    localStorage.removeItem("apex_session_time_value");
    return realTime;
  });
  // AM/PM is set once on load — coach can manually toggle but we never auto-override their choice
  // Two-tap confirmation for AM/PM toggle to prevent phantom switches
  const [pendingAmPm, setPendingAmPm] = useState(false);
  const pendingAmPmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [leaderTab, setLeaderTab] = useState<"all" | "M" | "F">("all");
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [view, setView] = useState<"coach" | "parent" | "audit" | "analytics" | "schedule" | "wellness" | "staff" | "meets" | "comms" | "splits" | "swimanalytics" | "timestandards">("coach");
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

  // Auto-detect session mode from today's schedule for the selected group
  useEffect(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
    const now = new Date();
    const dayKey = days[now.getDay()];
    const sched = REAL_SCHEDULES[selectedGroup];
    if (!sched) return;
    const daySched = sched.weekSchedule[dayKey];
    if (!daySched || daySched.sessions.length === 0) return;
    const hasWeight = daySched.sessions.some(s => s.type === "weight");
    const isMeetTemplate = daySched.template === "meet-day";
    const isMeetToday = meets.some(m => m.date === today());
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (isMeetTemplate || isMeetToday) { setSessionModeRaw("meet"); return; }
    if (hasWeight) {
      const weightSession = daySched.sessions.find(s => s.type === "weight");
      if (weightSession && hhmm >= weightSession.startTime) { setSessionModeRaw("weight"); return; }
    }
    setSessionModeRaw("pool");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup]);

  const [mounted, setMounted] = useState(false);
  const [levelUpName, setLevelUpName] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<string>("");
  const [levelUpIcon, setLevelUpIcon] = useState<string>("");
  const [levelUpColor, setLevelUpColor] = useState<string>("");
  const [levelUpExiting, setLevelUpExiting] = useState(false);
  const [xpFloats, setXpFloats] = useState<import("./components/XpFloats").XpFloat[]>([]);
  const [achieveToasts, setAchieveToasts] = useState<AchievementToast[]>([]);
  const achieveIdRef = useRef(0);
  // ── scroll guard: prevent phantom taps on mobile during/after scroll ──
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTouchEndRef = useRef(0);


  useEffect(() => {
    const markScrolling = () => {
      isScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => { isScrollingRef.current = false; }, 800);
    };
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const onTouchEnd = () => { lastTouchEndRef.current = Date.now(); };
    window.addEventListener("scroll", markScrolling, { passive: true });
    window.addEventListener("touchmove", markScrolling, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("scroll", markScrolling);
      window.removeEventListener("touchmove", markScrolling);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // AM/PM is set ONCE on page load from real clock time (see useState initializer above).
  // NO auto-switching after that — the coach has a manual toggle button if needed.
  // Previous visibilitychange listener was causing phantom PM switches mid-morning session.
  // Removed entirely: the initial load value is correct, and the coach can override manually.
  const floatCounter = useRef(0);

  // ── combo counter state ─────────────────────────────────
  const [comboCount, setComboCount] = useState(0);
  const [comboExiting, setComboExiting] = useState(false);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const incrementCombo = useCallback(() => {
    if (comboResetRef.current) clearTimeout(comboResetRef.current);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    setComboExiting(false);
    setComboCount(prev => {
      const next = prev + 1;
      // Escalating pitch chime
      if (next >= 3) {
        try {
          const ctx = new AudioContext();
          const baseFreq = 440 + Math.min(next * 60, 600);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = baseFreq; osc.type = "triangle";
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.start(); osc.stop(ctx.currentTime + 0.15);
          if (next >= 5) {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2); gain2.connect(ctx.destination);
            osc2.frequency.value = baseFreq * 1.5; osc2.type = "sine";
            gain2.gain.setValueAtTime(0.03, ctx.currentTime + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc2.start(ctx.currentTime + 0.05); osc2.stop(ctx.currentTime + 0.2);
          }
        } catch {}
        if (navigator.vibrate) navigator.vibrate(15);
      }
      return next;
    });
    // Reset combo after 2s of inactivity
    comboResetRef.current = setTimeout(() => {
      setComboExiting(true);
      comboTimerRef.current = setTimeout(() => { setComboCount(0); setComboExiting(false); }, 400);
    }, 2000);
  }, []);

  // ── bulk undo state ────────────────────────────────────
  const [bulkUndoVisible, setBulkUndoVisible] = useState(false);
  const [bulkUndoSnapshot, setBulkUndoSnapshot] = useState<Athlete[] | null>(null);
  const bulkUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── more menu & confirm dialog ─────────────────────────
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void } | null>(null);

  // ── practice recap ───────────────────────────────────
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<RecapData | null>(null);

  // ── invite system ─────────────────────────────────────
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteList, setInviteList] = useState<Invite[]>([]);
  const [newInviteRole, setNewInviteRole] = useState<InviteRole>("athlete");
  const [newInviteLabel, setNewInviteLabel] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const refreshInvites = useCallback(() => {
    setInviteList(getInvites());
  }, []);

  const handleCreateInvite = () => {
    const label = newInviteLabel.trim() || `${newInviteRole.charAt(0).toUpperCase() + newInviteRole.slice(1)} Invite`;
    createInvite(newInviteRole, label, { expiresInDays: 30 });
    setNewInviteLabel("");
    refreshInvites();
  };

  const handleCopyLink = (token: string) => {
    const url = getInviteUrl(token);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const handleDeactivate = (token: string) => {
    deactivateInvite(token);
    refreshInvites();
  };

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
  // Firestore is the source of truth. Always pull from Firestore first.
  // localStorage is a fast cache — never treat it as authoritative over Firestore.
  useEffect(() => {
    const pin = load<string>(K.PIN, "");
    if (!pin || pin === "1234") { setCoachPin(MASTER_PIN); save(K.PIN, MASTER_PIN); } else { setCoachPin(pin); }
    // Load selected group (local-only, not synced)
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
    const hadLocalData = r.length > 0;
    if (r.length === 0) { r = INITIAL_ROSTER.map(makeAthlete); /* DON'T save seed to localStorage — let Firestore sync load the real data */ }
    // If roster exists but is smaller than full roster, add missing athletes
    if (r.length > 0 && r.length < INITIAL_ROSTER.length) {
      const existingIds = new Set(r.map(a => a.id));
      const missing = INITIAL_ROSTER.filter(e => !existingIds.has(e.name.toLowerCase().replace(/\s+/g, "-"))).map(makeAthlete);
      if (missing.length > 0) { r = [...r, ...missing]; }
    }
    // Backfill PINs on athletes that don't have one
    let pinBackfilled = false;
    r = r.map(a => {
      if (!a.pin) { pinBackfilled = true; return { ...a, pin: String(100000 + Math.floor(Math.random() * 900000)) }; }
      return a;
    });
    if (pinBackfilled) {
      save(K.ROSTER, r);
      // Sync PINs to Firestore so athletes can log in from any device
      fbSaveRoster("all", r).catch(() => {});
      fbSaveRoster("platinum", r).catch(() => {});
    }
    // Auto-snapshot previous session before clearing (if any check-ins exist from a past day)
    const anyPastCheckins = r.some(a => a.dailyXP && (a.dailyXP||{}).date && (a.dailyXP||{}).date !== today() && (a.present || Object.values(a.checkpoints || {}).some(Boolean) || Object.values(a.weightCheckpoints || {}).some(Boolean) || Object.values(a.meetCheckpoints || {}).some(Boolean)));
    if (anyPastCheckins) {
      const prevDate = r.find(a => a.dailyXP?.date && (a.dailyXP||{}).date !== today())?.dailyXP?.date || today();
      const snaps = load<DailySnapshot[]>(K.SNAPSHOTS, []);
      if (!snaps.some(s => s.date === prevDate)) {
        const att = r.filter(a => a.present).length;
        snaps.push({
          date: prevDate, attendance: att, totalAthletes: r.length,
          totalXPAwarded: r.reduce((s, a) => s + ((a.dailyXP?.date === prevDate) ? (((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0)) : 0), 0),
          poolCheckins: r.reduce((s, a) => s + Object.values(a.checkpoints || {}).filter(Boolean).length, 0),
          weightCheckins: r.reduce((s, a) => s + Object.values(a.weightCheckpoints || {}).filter(Boolean).length, 0),
          meetCheckins: r.reduce((s, a) => s + Object.values(a.meetCheckpoints || {}).filter(Boolean).length, 0),
          questsCompleted: 0, challengesCompleted: 0,
          athleteXPs: Object.fromEntries(r.map(a => [a.id, (a.dailyXP?.date === prevDate) ? (((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0)) : 0])),
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
      else if ((a.dailyXP||{}).date !== today()) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 }, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {} };
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
    // Only save to localStorage if we had REAL local data (not seed).
    // If localStorage was empty, don't save seed data — let Firestore sync load the real data.
    if (hadLocalData) save(K.ROSTER, r);
    setRoster(r);
    setAuditLog(load<AuditEntry[]>(K.AUDIT, []));
    setTeamChallenges(load<TeamChallenge[]>(K.CHALLENGES, DEFAULT_CHALLENGES));
    setSnapshots(load<DailySnapshot[]>(K.SNAPSHOTS, []));
    setCulture(load<TeamCulture>(K.CULTURE, DEFAULT_CULTURE));
    // Load schedules — ALWAYS use REAL_SCHEDULES as source of truth
    const scheds = ROSTER_GROUPS.map(g => makeDefaultGroupSchedule(g.id));
    save(K.SCHEDULES, scheds);
    setSchedules(scheds);
    // Load coaches
    const savedCoaches = load<CoachProfile[]>(K.COACHES, []);
    setCoaches(savedCoaches);
    // Load meets
    setMeets(load<SwimMeet[]>(K.MEETS, []));
    // Load broadcasts + absence reports
    try { setAllBroadcasts(JSON.parse(localStorage.getItem("apex-broadcasts-v1") || "[]")); } catch { /* empty */ }
    try { setAbsenceReports(JSON.parse(localStorage.getItem("apex-absences-v1") || "[]")); } catch { /* empty */ }
    // Kill ALL service workers — no re-registration, no caching, ever.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }

    // ── Firestore-first data loading ──
    // Strategy: Try Firestore first → merge with localStorage (keep richer data) → update both
    (async () => {
      try {
        // Helper: pick the roster with more total XP (= more real data)
        const rosterXP = (athletes: Athlete[]) => athletes.reduce((s, a) => s + (a.xp || 0), 0);

        // 1. Load roster from localStorage (instant)
        let localRoster = load<Athlete[]>(K.ROSTER, []);
        // Migrate from older roster versions
        if (localRoster.length === 0) {
          const oldKeys = ["apex-athlete-roster-v4", "apex-athlete-roster-v3", "apex-athlete-roster-v2", "apex-athlete-roster-v1", "apex-athlete-roster"];
          for (const ok of oldKeys) {
            const old = load<Athlete[]>(ok, []);
            if (old.length > 0) {
              const migrated = old.map(a => ({ ...a, group: a.group || "platinum" }));
              const newGroups = INITIAL_ROSTER.filter(e => e.group !== "platinum").map(makeAthlete);
              localRoster = [...migrated, ...newGroups];
              break;
            }
          }
        }

        // 2. Load roster from Firestore — try ALL paths, pick the one with the most XP
        let firestoreRoster: Athlete[] = [];
        try {
          let bestXP = 0;
          for (const fbPath of ["rosters/all", "rosters/platinum"]) {
            try {
              const raw = await fbGet<Record<string, unknown>>(fbPath);
              if (raw) {
                let arr: Athlete[] | null = null;
                if ("_items" in raw && Array.isArray(raw._items)) arr = raw._items as Athlete[];
                else if ("athletes" in raw && Array.isArray(raw.athletes)) arr = raw.athletes as Athlete[];
                else {
                  const keys = Object.keys(raw).filter(k => k !== "_updatedAt" && k !== "groupId");
                  if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
                    arr = keys.sort((a, b) => Number(a) - Number(b)).map(k => raw[k]) as Athlete[];
                  }
                }
                if (arr && arr.length > 0) {
                  const xp = rosterXP(arr);
                  // Firestore path matched
                  if (xp > bestXP || firestoreRoster.length === 0) {
                    firestoreRoster = arr;
                    bestXP = xp;
                  }
                }
              }
            } catch (pathErr) { console.warn("[Sync] Error reading", fbPath, pathErr); }
          }
        } catch (e) { console.warn("[Sync] Firestore read failed (using local):", e); }

        // 3. Pick the roster with more data (higher total XP = more real check-in data)
        let r: Athlete[];
        if (firestoreRoster.length > 0 && localRoster.length > 0) {
          // Both exist — use the one with more XP (more real data)
          const fbXP = rosterXP(firestoreRoster);
          const lsXP = rosterXP(localRoster);
          if (fbXP >= lsXP) {
            r = firestoreRoster;
          } else {
            r = localRoster;
          }
        } else if (firestoreRoster.length > 0) {
          r = firestoreRoster;
        } else if (localRoster.length > 0) {
          r = localRoster;
        } else {
          // Neither has data — initialize from seed
          r = INITIAL_ROSTER.map(makeAthlete);
        }

        // 4. Ensure all athletes are present (add missing from seed)
        if (r.length > 0 && r.length < INITIAL_ROSTER.length) {
          const existingIds = new Set(r.map(a => a.id));
          const missing = INITIAL_ROSTER.filter(e => !existingIds.has(e.name.toLowerCase().replace(/\s+/g, "-"))).map(makeAthlete);
          if (missing.length > 0) r = [...r, ...missing];
        }

        // 5. Auto-snapshot previous session before clearing (if any check-ins exist from a past day)
        const anyPastCheckins = r.some(a => a.dailyXP && (a.dailyXP||{}).date && (a.dailyXP||{}).date !== today() && (a.present || Object.values(a.checkpoints || {}).some(Boolean) || Object.values(a.weightCheckpoints || {}).some(Boolean) || Object.values(a.meetCheckpoints || {}).some(Boolean)));
        if (anyPastCheckins) {
          const prevDate = r.find(a => a.dailyXP?.date && (a.dailyXP||{}).date !== today())?.dailyXP?.date || today();
          const snaps = load<DailySnapshot[]>(K.SNAPSHOTS, []);
          if (!snaps.some(s => s.date === prevDate)) {
            const att = r.filter(a => a.present).length;
            snaps.push({
              date: prevDate, attendance: att, totalAthletes: r.length,
              totalXPAwarded: r.reduce((s, a) => s + ((a.dailyXP?.date === prevDate) ? (((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0)) : 0), 0),
              poolCheckins: r.reduce((s, a) => s + Object.values(a.checkpoints || {}).filter(Boolean).length, 0),
              weightCheckins: r.reduce((s, a) => s + Object.values(a.weightCheckpoints || {}).filter(Boolean).length, 0),
              meetCheckins: r.reduce((s, a) => s + Object.values(a.meetCheckpoints || {}).filter(Boolean).length, 0),
              questsCompleted: 0, challengesCompleted: 0,
              athleteXPs: Object.fromEntries(r.map(a => [a.id, (a.dailyXP?.date === prevDate) ? (((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0)) : 0])),
              athleteStreaks: Object.fromEntries(r.map(a => [a.id, a.streak || 0])),
            });
            save(K.SNAPSHOTS, snaps);
          }
        }

        // 6. Normalize athlete data (ensure fields, reset daily XP for new day, auto-break streaks)
        r = r.map(a => {
          if (!a.lastStreakDate) a = { ...a, lastStreakDate: "" };
          if (!a.lastWeightStreakDate) a = { ...a, lastWeightStreakDate: "" };
          if (!a.group) a = { ...a, group: "platinum" };
          if (!a.dailyXP) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 }, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {} };
          else if ((a.dailyXP||{}).date !== today()) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 }, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {} };
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

        // 7. Save to BOTH localStorage AND Firestore (single source of truth)
        // GUARD: Never save zero-XP roster back to Firestore if we had real data
        const finalXP = r.reduce((s, a) => s + (a.xp || 0), 0);
        if (finalXP === 0 && (firestoreRoster.length > 0 || localRoster.length > 0)) {
          console.warn("[Init] BLOCKED: refusing to save zero-XP roster over existing data. firestoreXP:", rosterXP(firestoreRoster), "localXP:", rosterXP(localRoster));
          // Still set state for display, but don't persist zeros
          setRoster(r);
        } else {
          save(K.ROSTER, r);
          setRoster(r);
        }

        // 8. Load other data — pull from Firestore first, fall back to localStorage
        const loadWithSync = async <T,>(key: string, fbPath: string, fallback: T, setter: (v: T) => void) => {
          try {
            const remote = await syncLoad<T>(key, fbPath);
            if (remote !== null) { save(key, remote); setter(remote as T); return; }
          } catch { /* fall through */ }
          const local = load<T>(key, fallback);
          setter(local);
          // Push local to Firestore so it's available next time
          syncSave(key, local, fbPath);
        };

        await loadWithSync<AuditEntry[]>(K.AUDIT, "audit/all", [], setAuditLog);
        await loadWithSync<TeamChallenge[]>(K.CHALLENGES, "config/challenges", DEFAULT_CHALLENGES, setTeamChallenges);
        await loadWithSync<DailySnapshot[]>(K.SNAPSHOTS, "config/snapshots", [], setSnapshots);
        await loadWithSync<TeamCulture>(K.CULTURE, "config/culture", DEFAULT_CULTURE, setCulture);
        await loadWithSync<SwimMeet[]>(K.MEETS, "config/meets", [], setMeets);
        await loadWithSync<CoachProfile[]>(K.COACHES, "config/coaches", [], setCoaches);

        // Load + sync pin
        try {
          const remotePin = await syncLoad<string>(K.PIN, "config/pin");
          if (remotePin && typeof remotePin === "string") { save(K.PIN, remotePin); setCoachPin(remotePin); }
        } catch { /* keep local */ }

        // Load schedules — REAL_SCHEDULES is always the source of truth
        const scheds = ROSTER_GROUPS.map(g => makeDefaultGroupSchedule(g.id));
        save(K.SCHEDULES, scheds);
        setSchedules(scheds);
        // Push real schedules to Firestore so remote is always current
        try { await syncSave(K.SCHEDULES, scheds, "config/schedules"); } catch { /* ok */ }

        // Push authoritative roster to Firestore (ensures cloud is always current)
        syncSave(K.ROSTER, r, "rosters/all");
        // Sync complete

      } catch (e) {
        console.warn("[Sync] Firestore sync error — falling back to localStorage:", e);
        // Full localStorage fallback if Firestore fails
        let r = load<Athlete[]>(K.ROSTER, []);
        if (r.length === 0) { r = INITIAL_ROSTER.map(makeAthlete); save(K.ROSTER, r); }
        r = r.map(a => {
          if (!a.lastStreakDate) a = { ...a, lastStreakDate: "" };
          if (!a.lastWeightStreakDate) a = { ...a, lastWeightStreakDate: "" };
          if (!a.group) a = { ...a, group: "platinum" };
          if (!a.dailyXP) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 }, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {} };
          else if ((a.dailyXP||{}).date !== today()) a = { ...a, dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 }, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {} };
          return a;
        });
        save(K.ROSTER, r);
        setRoster(r);
        setAuditLog(load<AuditEntry[]>(K.AUDIT, []));
        setTeamChallenges(load<TeamChallenge[]>(K.CHALLENGES, DEFAULT_CHALLENGES));
        setSnapshots(load<DailySnapshot[]>(K.SNAPSHOTS, []));
        setCulture(load<TeamCulture>(K.CULTURE, DEFAULT_CULTURE));
        const scheds = ROSTER_GROUPS.map(g => makeDefaultGroupSchedule(g.id));
        save(K.SCHEDULES, scheds);
        setSchedules(scheds);
        setCoaches(load<CoachProfile[]>(K.COACHES, []));
        setMeets(load<SwimMeet[]>(K.MEETS, []));
      }
      setMounted(true);
    })();
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

  // ── session history state ──
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [editingHistorySession, setEditingHistorySession] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Load session history on mount
  useEffect(() => {
    if (!mounted) return;
    setSessionHistory(load<SessionRecord[]>(K.SESSION_HISTORY, []));
  }, [mounted]);

  // Save a session to history and clear current attendance
  const endCurrentSession = useCallback(() => {
    const groupRoster = roster.filter(a => a.group === selectedGroup);
    const hadCheckins = groupRoster.some(a => a.present || Object.values(a.checkpoints || {}).some(Boolean) || Object.values(a.weightCheckpoints || {}).some(Boolean));
    if (!hadCheckins) return; // Nothing to save

    const sessionId = `${today()}-${sessionTime}-${selectedGroup}-${Date.now()}`;
    const record: SessionRecord = {
      id: sessionId,
      date: today(),
      group: selectedGroup,
      startTime: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      endTime: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      sessionType: sessionTime,
      attendance: groupRoster.map(a => ({
        id: a.id, name: a.name, present: a.present ?? false,
        checkpoints: a.checkpoints || {}, weightCheckpoints: a.weightCheckpoints || {},
      })),
      totalPresent: groupRoster.filter(a => a.present).length,
      totalAthletes: groupRoster.length,
      locked: false,
    };

    // Save to history
    const history = load<SessionRecord[]>(K.SESSION_HISTORY, []);
    history.unshift(record);
    // Keep last 100 sessions
    const trimmed = history.slice(0, 100);
    save(K.SESSION_HISTORY, trimmed);
    setSessionHistory(trimmed);

    // Also save DailySnapshot for analytics
    const snaps = load<DailySnapshot[]>(K.SNAPSHOTS, []);
    const att = groupRoster.filter(a => a.present).length;
    snaps.push({
      date: today(), attendance: att, totalAthletes: groupRoster.length,
      totalXPAwarded: groupRoster.reduce((s, a) => s + (a.dailyXP ? ((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0) : 0), 0),
      poolCheckins: groupRoster.reduce((s, a) => s + Object.values(a.checkpoints || {}).filter(Boolean).length, 0),
      weightCheckins: groupRoster.reduce((s, a) => s + Object.values(a.weightCheckpoints || {}).filter(Boolean).length, 0),
      meetCheckins: groupRoster.reduce((s, a) => s + Object.values(a.meetCheckpoints || {}).filter(Boolean).length, 0),
      questsCompleted: 0, challengesCompleted: 0,
      athleteXPs: Object.fromEntries(groupRoster.map(a => [a.id, a.dailyXP ? ((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0) : 0])),
      athleteStreaks: Object.fromEntries(groupRoster.map(a => [a.id, a.streak || 0])),
    });
    save(K.SNAPSHOTS, snaps);

    // Build recap data BEFORE clearing
    const dailyXPs = groupRoster.map(a => ({
      name: a.name,
      xp: (a.dailyXP||{}).date === today() ? ((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0) : 0,
      level: getLevel(a.xp, getSportForAthlete(a)).name,
      color: getLevel(a.xp, getSportForAthlete(a)).color,
    })).sort((a, b) => b.xp - a.xp);
    const streaksActive = groupRoster.filter(a => a.streak > 0).length;
    const longestStreak = groupRoster.reduce((best, a) => a.streak > best.streak ? { name: a.name, streak: a.streak } : best, { name: "", streak: 0 });
    const totalCheckpoints = groupRoster.reduce((s, a) =>
      s + Object.values(a.checkpoints || {}).filter(Boolean).length +
      Object.values(a.weightCheckpoints || {}).filter(Boolean).length +
      Object.values(a.meetCheckpoints || {}).filter(Boolean).length, 0);

    setRecapData({
      group: selectedGroup, date: today(),
      attendance: groupRoster.filter(a => a.present).length,
      total: groupRoster.length,
      xpAwarded: groupRoster.reduce((s, a) => s + ((a.dailyXP||{}).date === today() ? ((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0) : 0), 0),
      topEarners: dailyXPs.filter(a => a.xp > 0).slice(0, 3),
      streaksActive,
      longestStreak: longestStreak.streak > 0 ? longestStreak : { name: "-", streak: 0 },
      mvp: dailyXPs[0]?.xp > 0 ? { name: dailyXPs[0].name, xp: dailyXPs[0].xp } : null,
      checkpointsChecked: totalCheckpoints,
    });
    setShowRecap(true);

    // Play recap sound
    try {
      const ctx = new AudioContext();
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
        osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.4);
      });
    } catch {}
    if (navigator.vibrate) navigator.vibrate([40, 30, 60, 30, 80]);

    // Clear current session — fresh slate
    const cleared = roster.map(a => a.group !== selectedGroup ? a : ({
      ...a, present: false, checkpoints: {}, weightCheckpoints: {}, meetCheckpoints: {},
    }));
    setRoster(cleared);
    save(K.ROSTER, cleared);

    // Clear active session marker
    save(K.ACTIVE_SESSION, null);
  }, [roster, selectedGroup, sessionTime]);

  // ── auto-session detection: schedule-based + timer ──
  useEffect(() => {
    if (!mounted || roster.length === 0) return;

    // Check every 60 seconds if the session has expired
    const checkExpiry = () => {
      const active = load<{ date: string; group: string; endTime: string; sessionKey: string } | null>(K.ACTIVE_SESSION, null);
      if (!active || active.group !== selectedGroup) return;

      const now = new Date();
      const todayStr = today();

      // If active session is from a previous day, auto-end it
      if (active.date < todayStr) {
        endCurrentSession();
        return;
      }

      // If 3 hours past the scheduled end time, auto-end
      const [eh, em] = (active.endTime || "18:00").split(":").map(Number);
      const endMins = eh * 60 + em;
      const nowMins = now.getHours() * 60 + now.getMinutes();
      if (nowMins > endMins + 180) {
        endCurrentSession();
      }
    };

    // On page load, check if we need to auto-end a stale session
    checkExpiry();

    // Also set up a periodic check
    const interval = setInterval(checkExpiry, 60000);
    return () => clearInterval(interval);
  }, [mounted, roster.length, selectedGroup, endCurrentSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── mark session as active when first check-in happens ──
  useEffect(() => {
    if (!mounted || roster.length === 0) return;
    const groupRoster = roster.filter(a => a.group === selectedGroup);
    const hasCheckins = groupRoster.some(a => a.present || Object.values(a.checkpoints || {}).some(Boolean) || Object.values(a.weightCheckpoints || {}).some(Boolean));
    if (hasCheckins) {
      const active = load<{ date: string; group: string } | null>(K.ACTIVE_SESSION, null);
      if (!active || active.group !== selectedGroup || active.date !== today()) {
        // Mark this as an active session
        const sched = getCurrentScheduledSession(selectedGroup);
        save(K.ACTIVE_SESSION, {
          date: today(),
          group: selectedGroup,
          startTime: sched?.startTime || (sessionTime === "am" ? "06:00" : "15:00"),
          endTime: sched?.endTime || (sessionTime === "am" ? "08:00" : "18:00"),
          sessionKey: `${today()}-${sessionTime}-${selectedGroup}`,
        });
      }
    }
  }, [mounted, roster, selectedGroup, sessionTime]);

  // ── auto-snapshot ────────────────────────────────────────
  useEffect(() => {
    if (!mounted || roster.length === 0) return;
    const snap = () => {
      const d = today();
      const att = roster.filter(a => Object.values(a.checkpoints||{}).some(Boolean) || Object.values(a.weightCheckpoints||{}).some(Boolean) || Object.values(a.meetCheckpoints||{}).some(Boolean)).length;
      const s: DailySnapshot = {
        date: d, attendance: att, totalAthletes: roster.length,
        totalXPAwarded: roster.reduce((s, a) => s + ((a.dailyXP||{}).date === d ? ((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0) : 0), 0),
        poolCheckins: roster.reduce((s, a) => s + Object.values(a.checkpoints||{}).filter(Boolean).length, 0),
        weightCheckins: roster.reduce((s, a) => s + Object.values(a.weightCheckpoints||{}).filter(Boolean).length, 0),
        meetCheckins: roster.reduce((s, a) => s + Object.values(a.meetCheckpoints||{}).filter(Boolean).length, 0),
        questsCompleted: roster.reduce((s, a) => s + Object.values(a.quests||{}).filter(q => q === "done").length, 0),
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
  const saveRoster = useCallback((r: Athlete[]) => { setRoster(r); save(K.ROSTER, r); fbSaveRoster("all", r).catch(() => {}); fbSaveRoster("platinum", r).catch(() => {}); }, []);
  const saveCulture = useCallback((c: TeamCulture) => { setCulture(c); save(K.CULTURE, c); }, []);
  const saveSchedules = useCallback((s: GroupSchedule[]) => { setSchedules(s); save(K.SCHEDULES, s); }, []);

  const addAudit = useCallback((athleteId: string, athleteName: string, action: string, xpDelta: number) => {
    const entry: AuditEntry = { timestamp: Date.now(), coach: "Coach", athleteId, athleteName, action, xpDelta };
    setAuditLog(prev => { const n = [entry, ...prev].slice(0, 2000); save(K.AUDIT, n); return n; });
  }, []);

  // ── level-up triumphant sound (Web Audio API) ──────────
  const playLevelUpSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const now = ctx.currentTime;
      // Rising arpeggio: C5 → E5 → G5 → C6
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.5);
      });
      // Final shimmer chord
      [1046.5, 1318.5, 1568.0].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + 0.5);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.55);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + 0.5);
        osc.stop(now + 1.6);
      });
    } catch { /* silent fail if audio unavailable */ }
  }, []);

  const checkLevelUp = useCallback((oldXP: number, newXP: number, athleteObj: { name: string; group: string }) => {
    const oldLv = getLevel(oldXP, getSportForAthlete(athleteObj));
    const newLv = getLevel(newXP, getSportForAthlete(athleteObj));
    if (newLv.name !== oldLv.name) {
      setLevelUpName(athleteObj.name);
      setLevelUpLevel(newLv.name);
      setLevelUpIcon(newLv.icon);
      setLevelUpColor(newLv.color);
      setLevelUpExiting(false);
      // Play triumphant sound
      playLevelUpSound();
      // Haptic burst
      if (navigator.vibrate) navigator.vibrate([50, 30, 80, 30, 120, 50, 80]);
      // Auto-dismiss with fade-out
      setTimeout(() => { setLevelUpExiting(true); }, 3500);
      setTimeout(() => { setLevelUpName(null); setLevelUpExiting(false); }, 4000);
    }
  }, []);

  // ── achievement toast system ──────────────────────────────
  const spawnAchievement = useCallback((title: string, desc: string, icon: string, color: string) => {
    const id = `ach-${achieveIdRef.current++}`;
    setAchieveToasts(prev => [...prev, { id, title, desc, icon, color, exiting: false }]);
    // Play a subtle chime
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
      // Second note (fifth)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.frequency.value = 1320; osc2.type = "sine";
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
      gain2.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime + 0.1); osc2.stop(ctx.currentTime + 0.5);
    } catch {}
    // Haptic
    if (navigator.vibrate) navigator.vibrate([30, 20, 50]);
    // Auto exit
    setTimeout(() => setAchieveToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t)), 3200);
    setTimeout(() => setAchieveToasts(prev => prev.filter(t => t.id !== id)), 3600);
  }, []);

  const checkAchievements = useCallback((athlete: Athlete, cpId: string) => {
    const totalChecked = Object.values(athlete.checkpoints).filter(Boolean).length +
      Object.values(athlete.weightCheckpoints).filter(Boolean).length +
      Object.values(athlete.meetCheckpoints).filter(Boolean).length;
    // First ever check-in
    if (totalChecked === 1) {
      spawnAchievement("First Check-In", `${athlete.name} is on the board!`, "🎯", "#60a5fa");
    }
    // Streak milestones
    const streakMilestones = [5, 10, 25, 50, 100];
    if (cpId === "practice-complete" && athlete.lastStreakDate !== today()) {
      const newStreak = athlete.streak + 1;
      if (streakMilestones.includes(newStreak)) {
        spawnAchievement(`${newStreak}-Day Streak`, `${athlete.name} is on fire!`, "🔥", "#f97316");
      }
    }
    // Practice count milestones
    if (cpId === "practice-complete") {
      const newTotal = athlete.totalPractices + 1;
      const practiceMilestones = [10, 25, 50, 100, 200, 500];
      if (practiceMilestones.includes(newTotal)) {
        spawnAchievement(`${newTotal} Practices`, `${athlete.name} — dedicated!`, "💪", "#a78bfa");
      }
    }
    // XP milestones
    const xpMilestones = [100, 250, 500, 1000, 2000, 5000];
    for (const m of xpMilestones) {
      if (athlete.xp < m) break;
      // Only trigger if they JUST crossed it (within 150 XP of the milestone — max daily cap)
      if (athlete.xp >= m && athlete.xp - m < DAILY_XP_CAP) {
        spawnAchievement(`${m} XP`, `${athlete.name} hit ${m.toLocaleString()} XP!`, "⚡", "#f59e0b");
        break;
      }
    }
    // Perfect practice (all pool checkpoints checked)
    const allPool = POOL_CPS.every(cp => athlete.checkpoints[cp.id]);
    if (allPool) {
      spawnAchievement("Perfect Practice", `${athlete.name} — every box checked!`, "⭐", "#f59e0b");
    }
    // Meet milestones
    if (cpId === "m-pr") {
      spawnAchievement("New PR!", `${athlete.name} set a personal best!`, "🏆", "#f59e0b");
    }
    if (cpId === "m-team-record") {
      spawnAchievement("Team Record!", `${athlete.name} made history!`, "👑", "#ef4444");
    }
  }, [spawnAchievement]);

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
    if ((a.dailyXP||{}).date !== today()) a.dailyXP = { date: today(), pool: 0, weight: 0, meet: 0 };
    const used = ((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0);
    const room = Math.max(0, DAILY_XP_CAP - used);
    const mult = category === "weight" ? getWeightStreakMult(a.weightStreak) : getStreakMult(a.streak);
    const raw = Math.round(xpBase * mult);
    const awarded = Math.min(raw, room);
    if (awarded <= 0) return { newAthlete: a, awarded: 0 };
    const oldXP = a.xp;
    a.xp += awarded;
    a.seasonXP = (a.seasonXP || 0) + awarded;
    a.dailyXP[category] += awarded;
    checkLevelUp(oldXP, a.xp, a);
    return { newAthlete: a, awarded };
  }, [checkLevelUp]);

  // ── meet score handler (auto-awards XP from meet results) ──
  const handleMeetScore = useCallback((result: ScoringResult, meet: SwimMeet) => {
    if (result.totalXP <= 0) return;
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === result.athleteId);
      if (idx < 0) return prev;
      const a = { ...prev[idx] };
      const { newAthlete, awarded } = awardXP(a, result.totalXP, "meet");
      if (awarded > 0) {
        spawnXpFloat(awarded);
        addAudit(newAthlete.id, newAthlete.name, `Meet bonus: ${result.bonuses.map(b => b.label).join(", ")}`, awarded);
      }
      if (result.newBestTimes.length > 0) {
        const bt = { ...(newAthlete.bestTimes || {}) };
        for (const nb of result.newBestTimes) {
          const key = `${nb.event}-${nb.course}`;
          bt[key] = { time: nb.time, seconds: nb.seconds, meetId: meet.id, meetName: meet.name, date: meet.date, course: nb.course, source: "manual" as const };
        }
        newAthlete.bestTimes = bt;
      }
      // Auto-check meet checkpoints based on results
      const mc = { ...(newAthlete.meetCheckpoints || {}) };
      const bonusLabels = result.bonuses.map(b => b.label.toLowerCase());
      if (result.newBestTimes.length > 0 || bonusLabels.some(l => l.includes("pr") || l.includes("personal"))) mc["m-pr"] = true;
      if (bonusLabels.some(l => l.includes("meet record"))) mc["m-meet-record"] = true;
      if (bonusLabels.some(l => l.includes("team record"))) mc["m-team-record"] = true;
      if (bonusLabels.some(l => l.includes("best time") || l.includes("season"))) mc["m-best-time"] = true;
      newAthlete.meetCheckpoints = mc;
      const next = [...prev];
      next[idx] = newAthlete;
      return next;
    });
  }, [awardXP, spawnXpFloat, addAudit]);

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
        SFX.untick();
        // Revert XP when unchecking
        const mult = category === "weight" ? getWeightStreakMult(a.weightStreak) : getStreakMult(a.streak);
        const awarded = Math.round(cpXP * mult);
        a.xp = Math.max(0, a.xp - awarded); a.seasonXP = Math.max(0, (a.seasonXP || 0) - awarded);
        if ((a.dailyXP||{}).date === today()) {
          a.dailyXP = { ...a.dailyXP, [category]: Math.max(0, a.dailyXP[category] - awarded) };
        }
        addAudit(a.id, a.name, `Unchecked: ${cpId}`, -awarded);
        const r = [...prev]; r[idx] = a; save(K.ROSTER, r); return r;
      }
      cps[cpId] = true; a[cpMap] = cps;
      SFX.tick();
      incrementCombo();
      const { newAthlete, awarded } = awardXP(a, cpXP, category);
      let final = { ...newAthlete, [cpMap]: cps };
      // Increment streak once per day on Practice Complete (pool) or Showed Up (weight)
      if (category === "pool" && cpId === "practice-complete" && final.lastStreakDate !== today()) {
        final = { ...final, streak: final.streak + 1, lastStreakDate: today(), totalPractices: final.totalPractices + 1, weekSessions: final.weekSessions + 1 };
      }
      if (category === "weight" && cpId === "w-showed-up" && final.lastWeightStreakDate !== today()) {
        final = { ...final, weightStreak: final.weightStreak + 1, lastWeightStreakDate: today(), weekWeightSessions: final.weekWeightSessions + 1 };
      }
      addAudit(final.id, final.name, `Checked: ${cpId}`, awarded);
      if (e) spawnXpFloat(awarded, e);
      // Check for achievement milestones
      setTimeout(() => checkAchievements(final, cpId), 100);
      const r = [...prev]; r[idx] = final; save(K.ROSTER, r); return r;
    });
  }, [awardXP, addAudit, incrementCombo, spawnXpFloat, checkAchievements]);

  // ── weight challenge toggle ──────────────────────────────
  const toggleWeightChallenge = useCallback((athleteId: string, chId: string, chXP: number, e?: React.MouseEvent) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      let a = { ...prev[idx], weightChallenges: { ...prev[idx].weightChallenges } };
      if (a.weightChallenges[chId]) {
        a.weightChallenges[chId] = false;
        SFX.untick();
        const mult = getWeightStreakMult(a.weightStreak);
        const reverted = Math.round(chXP * mult);
        a.xp = Math.max(0, a.xp - reverted); a.seasonXP = Math.max(0, (a.seasonXP || 0) - reverted);
        if ((a.dailyXP||{}).date === today()) {
          a.dailyXP = { ...a.dailyXP, weight: Math.max(0, ((a.dailyXP||{}).weight||0) - reverted) };
        }
        addAudit(a.id, a.name, `Unchallenged: ${chId}`, -reverted);
      } else {
        a.weightChallenges[chId] = true;
        SFX.tick();
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
      if (next === "active") SFX.questAssign();
      let awarded = 0;
      if (next === "done") {
        SFX.questDone();
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
        incrementCombo();
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
            a.xp = Math.max(0, a.xp - reverted); a.seasonXP = Math.max(0, (a.seasonXP || 0) - reverted);
            if ((a.dailyXP||{}).date === today()) {
              const cat = sessionMode === "meet" ? "meet" : sessionMode;
              a.dailyXP = { ...a.dailyXP, [cat]: Math.max(0, a.dailyXP[cat] - reverted) };
            }
            totalReverted += reverted;
          }
        }
        // Revert base present XP
        const baseReverted = Math.round(PRESENT_XP * mult);
        a.xp = Math.max(0, a.xp - baseReverted); a.seasonXP = Math.max(0, (a.seasonXP || 0) - baseReverted);
        if ((a.dailyXP||{}).date === today()) {
          const cat = sessionMode === "meet" ? "meet" : sessionMode;
          a.dailyXP = { ...a.dailyXP, [cat]: Math.max(0, a.dailyXP[cat] - baseReverted) };
        }
        totalReverted += baseReverted;
        a = { ...a, [cpMapKey]: oldCPs };
        addAudit(a.id, a.name, `Absent (checkpoints cleared)`, -totalReverted);
      }
      const r = [...prev]; r[idx] = a; save(K.ROSTER, r); return r;
    });
  }, [addAudit, awardXP, incrementCombo, selectedGroup, sessionMode]);

  // ── shoutout / MVP — coach recognition for standout moments ─
  const giveShoutout = useCallback((athleteId: string, e?: React.MouseEvent) => {
    setRoster(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) return prev;
      const a = { ...prev[idx] };
      const { newAthlete, awarded } = awardXP(a, SHOUTOUT_XP, "pool");
      SFX.shoutout();
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
          if ((a.dailyXP||{}).date === today()) {
            a.dailyXP = { ...a.dailyXP, pool: Math.max(0, ((a.dailyXP||{}).pool||0) - last.xpDelta) };
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
  const switchGroup = useCallback((g: GroupId) => { setSelectedGroup(g); save(K.GROUP, g); setSelectedAthlete(null); }, []);
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
    const rows = roster.map(a => `${a.name},${a.age},${a.gender},${a.xp},${getLevel(a.xp, getSportForAthlete(a)).name},${a.streak},${a.weightStreak},${a.totalPractices}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `apex-athlete-${today()}.csv`;
    link.click(); URL.revokeObjectURL(url);
  }, [roster]);

  const importCSV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const header = lines[0].toLowerCase();
      const cols = header.split(",").map(c => c.trim());
      const nameIdx = cols.findIndex(c => c === "name");
      const ageIdx = cols.findIndex(c => c === "age");
      const genderIdx = cols.findIndex(c => c === "gender" || c === "sex");
      const groupIdx = cols.findIndex(c => c === "group");
      if (nameIdx === -1) { alert("CSV must have a 'Name' column"); return; }
      const newAthletes: Athlete[] = [];
      const existingNames = new Set(roster.map(a => a.name.toLowerCase()));
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const name = vals[nameIdx];
        if (!name) continue;
        if (existingNames.has(name.toLowerCase())) continue;
        const age = ageIdx >= 0 ? parseInt(vals[ageIdx]) || 12 : 12;
        const gRaw = genderIdx >= 0 ? vals[genderIdx]?.toUpperCase() : "M";
        const gender: "M" | "F" = gRaw === "F" || gRaw === "FEMALE" ? "F" : "M";
        const groupRaw = groupIdx >= 0 ? vals[groupIdx]?.toLowerCase() : selectedGroup;
        const group = ROSTER_GROUPS.find(g => g.id === groupRaw || g.name.toLowerCase() === groupRaw)?.id || selectedGroup;
        newAthletes.push(makeAthlete({ name, age, gender, group }));
        existingNames.add(name.toLowerCase());
      }
      if (newAthletes.length === 0) { alert("No new athletes found in CSV (all duplicates or empty)"); return; }
      saveRoster([...roster, ...newAthletes]);
      addAudit("system", "CSV Import", `Imported ${newAthletes.length} athletes`, 0);
      alert(`Imported ${newAthletes.length} athlete${newAthletes.length > 1 ? "s" : ""}!`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [roster, saveRoster, addAudit, selectedGroup]);

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
    const pct = Math.round((roster.filter(a => Object.values(a.checkpoints||{}).some(Boolean)).length / roster.length) * 100);
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
    const questEngagement = roster.reduce((s, a) => s + Object.values(a.quests||{}).filter(q => q !== "pending").length, 0);
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
    if (!recent7.length || !prev7.length) return { direction: "flat" as const, delta: 0 };
    const recentAvg = recent7.reduce((s, x) => s + x.totalXPAwarded, 0) / recent7.length;
    const prevAvg = prev7.reduce((s, x) => s + x.totalXPAwarded, 0) / prev7.length;
    const delta = Math.round(((recentAvg - prevAvg) / Math.max(prevAvg, 1)) * 100);
    return { direction: delta > 5 ? "up" as const : delta < -5 ? "down" as const : "flat" as const, delta };
  }, [snapshots]);

  // Coach efficiency — which checkpoints are most/least awarded
  const checkpointEfficiency = useMemo(() => {
    const counts: Record<string, number> = {};
    const groupRoster = roster.filter(a => a.group === selectedGroup);
    for (const a of groupRoster) {
      for (const [k, v] of Object.entries(a.checkpoints||{})) if (v) counts[k] = (counts[k] || 0) + 1;
    }
    return [...currentCPs].map(cp => ({ ...cp, count: counts[cp.id] || 0, rate: groupRoster.length ? Math.round(((counts[cp.id] || 0) / groupRoster.length) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [roster, selectedGroup, currentCPs]);

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */

  // Card is defined outside the component to prevent re-render issues
  // BgOrbs + XpFloats extracted to ./components/

  // ── level-up dismiss handler ──────────────────────────
  const handleLevelUpDismiss = useCallback(() => {
    setLevelUpExiting(true);
    setTimeout(() => setLevelUpName(null), 500);
  }, []);

  // ── achievement toasts dismiss handler ─────────────────────
  const handleAchieveDismiss = useCallback((id: string) => {
    setAchieveToasts(prev => prev.map(x => x.id === id ? { ...x, exiting: true } : x));
  }, []);

  // ── loading ──────────────────────────────────────────────

  if (!mounted) return (
    <div className="min-h-screen bg-[#0e0e18] flex items-center justify-center relative">
      <BgOrbs />
      <div className="text-center relative z-10">
        <div className="neon-text-cyan text-sm font-mono tracking-wider opacity-60">INITIALIZING...</div>
      </div>
    </div>
  );

  // ── PIN gate ─────────────────────────────────────────────
  if (!unlocked) {
    return (
      <PinAuthScreen
        coaches={coaches}
        coachPin={coachPin}
        onUnlock={(pin) => { setPinInput(pin); setUnlocked(true); try { localStorage.setItem("mettle_coach_session", JSON.stringify({ role: "coach", ts: Date.now() })); } catch {} }}
      />
    );
  }

  // ── shared game HUD header (used by ALL views) ─────────
  const GameHUDHeader = () => {
    const presentCount = filteredRoster.filter(a => a.present || Object.values(a.checkpoints||{}).some(Boolean) || Object.values(a.weightCheckpoints||{}).some(Boolean)).length;
    const xpToday = filteredRoster.reduce((s, a) => s + ((a.dailyXP||{}).date === today() ? ((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0) : 0), 0);
    const secondaryTabs = [
      { id: "coach" as const, label: "Check-In" },
      { id: "meets" as const, label: "Meets" },
      { id: "schedule" as const, label: "Schedule" },
      { id: "staff" as const, label: "Staff" },
      { id: "comms" as const, label: "Comms" },
      { id: "analytics" as const, label: "Analytics" },
      { id: "splits" as const, label: "Splits" },
      { id: "swimanalytics" as const, label: "Swim" },
      { id: "timestandards" as const, label: "Standards" },
      { id: "audit" as const, label: "Audit" },
    ];
    return (
      <div className="w-full relative mb-4">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff]/60 to-transparent" />

        <div className="pt-6 pb-2">
          {/* Title row — compact */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Image 
                src="/mettle-brand/v5/mettle-icon.svg" 
                alt="METTLE logo" 
                width={40}
                height={40}
                className="w-9 h-9 sm:w-10 sm:h-10"
                style={{ filter: 'drop-shadow(0 0 20px rgba(201,168,76,0.2))' }}
                loading="lazy"
                quality={85}
              />
              <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.04em] leading-none" style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #FFD700 30%, #C9A84C 60%, #B8860B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 4s ease-in-out infinite',
                filter: 'drop-shadow(0 0 30px rgba(201,168,76,0.3))'
              }}>
                METTLE
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={togglePushNotifications} disabled={pushLoading}
                className={`game-btn w-10 h-10 flex items-center justify-center text-sm transition-all ${
                  pushEnabled ? "text-[#00f0ff] border border-[#00f0ff]/30" : "text-[#f8fafc]/60 border border-white/[0.06] hover:text-[#00f0ff]/60"
                }`} title={pushEnabled ? "Notifications ON" : "Enable notifications"}>
                {pushLoading ? "..." : pushEnabled ? "🔔" : "🔕"}
              </button>
              {view === "coach" && (
                <button onClick={() => { if (editingCulture) saveCulture(culture); setEditingCulture(!editingCulture); }}
                  className="game-btn w-10 h-10 flex items-center justify-center text-xs font-mono tracking-wider uppercase text-[#f8fafc]/60 border border-white/[0.06] hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20 transition-all">
                  {editingCulture ? "✓" : "✎"}
                </button>
              )}
              <button onClick={() => { clearSession(); window.location.href = "/apex-athlete/portal"; }} className="game-btn w-10 h-10 flex items-center justify-center text-[#f8fafc]/30 hover:text-red-400 border border-white/[0.06] hover:border-red-400/30 transition-all" title="Sign Out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
            </div>
          </div>

          {/* Personalized greeting */}
          <div className="mb-3 px-1">
            <span className="text-[#f8fafc]/40 text-xs font-mono">
              {(() => {
                const h = new Date().getHours();
                const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
                const name = currentCoach?.name || "Coach";
                return `${greeting}, ${name}`;
              })()}
            </span>
            <span className="text-[#f8fafc]/20 text-xs font-mono ml-2">
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
          </div>

          {/* Portal switcher — Coach / Athlete / Parent */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "COACH", href: null },
              { label: "ATHLETE", href: "/apex-athlete/athlete" },
              { label: "PARENT", href: "/apex-athlete/parent" },
            ].map(p => (
              <button key={p.label} onClick={() => { if (p.href) window.location.href = p.href; }}
                className={`py-3 text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[46px] text-center ${
                  !p.href
                    ? "bg-[#00f0ff]/12 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.15)]"
                    : "bg-[#0e0e18]/60 text-[#f8fafc]/50 border border-white/[0.06] hover:text-[#f8fafc]/70 hover:border-white/15 active:scale-[0.97]"
                }`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <button onClick={() => { clearSession(); window.location.href = "/apex-athlete/portal"; }} className="w-full py-2.5 text-xs font-mono tracking-wider uppercase text-[#f8fafc]/40 hover:text-red-400 transition-colors mb-4">Sign Out</button>

          {/* Section nav tabs — 2 rows on mobile, single row on tablet+ */}
          <div className="md:hidden space-y-2 mb-4">
            <div className="grid grid-cols-4 gap-2">
              {secondaryTabs.slice(0, 4).map(t => {
                const active = view === t.id;
                return (
                  <button key={t.id} onClick={() => { setView(t.id); setSelectedAthlete(null); window.scrollTo(0, 0); }}
                    className={`py-3 text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[46px] text-center ${
                      active
                        ? "bg-[#00f0ff]/12 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.15)]"
                        : "bg-[#0e0e18]/60 text-[#f8fafc]/50 border border-white/[0.06] hover:text-[#f8fafc]/70 hover:border-white/15 active:scale-[0.97]"
                    }`}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {secondaryTabs.slice(4).map(t => {
                const active = view === t.id;
                return (
                  <button key={t.id} onClick={() => { setView(t.id); setSelectedAthlete(null); window.scrollTo(0, 0); }}
                    className={`py-3 text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[46px] text-center ${
                      active
                        ? "bg-[#a855f7]/12 text-[#a855f7] border-2 border-[#a855f7]/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                        : "bg-[#0e0e18]/60 text-[#f8fafc]/50 border border-white/[0.06] hover:text-[#f8fafc]/70 hover:border-white/15 active:scale-[0.97]"
                    }`}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="hidden md:grid grid-cols-8 gap-2 mb-4">
            {secondaryTabs.map(t => {
              const active = view === t.id;
              return (
                <button key={t.id} onClick={() => { setView(t.id); setSelectedAthlete(null); }}
                  className={`py-3 text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[46px] text-center ${
                    active
                      ? "bg-[#00f0ff]/12 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.15)]"
                      : "bg-[#0e0e18]/60 text-[#f8fafc]/50 border border-white/[0.06] hover:text-[#f8fafc]/70 hover:border-white/15 active:scale-[0.97]"
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
              <span className="text-[#f8fafc]/70 font-bold text-sm">{culture.teamName}</span>
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
        <div className="relative border-y border-[#00f0ff]/10 bg-[#0e0e18]/90 backdrop-blur-xl">
          <div className="flex items-center justify-center gap-5 py-2.5 px-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${presentCount > 0 ? "bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.6)]" : "bg-white/10"}`} />
              <span className="neon-text-cyan text-xs font-bold font-mono tabular-nums">{presentCount}<span className="text-[#f8fafc]/50 font-normal">/{roster.length}</span></span>
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
        {/* Build version — tiny, for cache verification */}
        <div className="text-center py-0.5">
          <span className="text-[#f8fafc]/10 text-[9px] font-mono">v2026.03.07a</span>
        </div>
      </div>
    );
  };


  // ── expanded athlete detail ─────────────────────────────
  const AthleteExpanded = ({ athlete }: { athlete: Athlete }) => {
    const lv = getLevel(athlete.xp, getSportForAthlete(athlete));
    const prog = getLevelProgress(athlete.xp, getSportForAthlete(athlete));
    const nxt = getNextLevel(athlete.xp, getSportForAthlete(athlete));
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
            <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center text-lg font-black text-[#f8fafc] shrink-0"
              style={{ border: `3px solid ${lv.color}50`, boxShadow: `0 0 20px ${lv.color}20` }}>
              {athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[#f8fafc] font-bold text-lg">{athlete.name}</div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[#f8fafc]/60 text-xs">{athlete.age}y · {athlete.gender}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>
                  {lv.icon} {lv.name}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">
                  {sk.label} · {sk.mult}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <AnimatedCounter value={athlete.xp} suffix=" XP" className="text-[#f8fafc]/60 font-bold" />
                  <span className="text-[#f8fafc]/60">{nxt ? `${prog.remaining} to ${nxt.name}` : "MAX LEVEL"}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full xp-shimmer transition-all duration-500" style={{ width: `${prog.percent}%` }} />
                </div>
              </div>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setParentPreviewAthlete(athlete.id); }}
            className="mt-3 w-full rounded-lg border border-purple-500/30 bg-purple-900/20 px-3 py-2 text-xs font-medium text-purple-300 hover:bg-purple-900/40 hover:border-purple-500/50 transition-colors">
            Preview Parent View
          </button>
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
              <div className="text-[#f8fafc] font-black text-lg tabular-nums whitespace-nowrap">{s.val}</div>
              <div className="text-[#f8fafc]/60 text-xs uppercase tracking-wider font-medium mt-0.5">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Daily cap */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[#f8fafc]/60">Daily XP:</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${dailyUsed >= DAILY_XP_CAP ? "bg-red-500" : "bg-[#6b21a8]"}`} style={{ width: `${(dailyUsed / DAILY_XP_CAP) * 100}%` }} />
          </div>
          <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${dailyUsed >= DAILY_XP_CAP ? "text-red-400" : "text-[#f8fafc]/60"}`}>{dailyUsed}/{DAILY_XP_CAP}</span>
        </div>

        {/* Streaks */}
        <div className="flex gap-3">
          <Card className="flex-1 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[#f8fafc]/60 text-xs uppercase tracking-wider">Pool Streak</div>
              <div className="text-[#f8fafc] font-bold">{athlete.streak}d <span className="text-[#a855f7] text-xs">{sk.label}</span></div>
            </div>
            <span className="text-[#a855f7] font-bold text-sm">{sk.mult}</span>
          </Card>
          <Card className="flex-1 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[#f8fafc]/60 text-xs uppercase tracking-wider">Weight Streak</div>
              <div className="text-[#f8fafc] font-bold">{athlete.weightStreak}d <span className="text-[#f59e0b] text-xs">{wsk.label}</span></div>
            </div>
            <span className="text-[#f59e0b] font-bold text-sm">{wsk.mult}</span>
          </Card>
        </div>

        {/* Daily Check-In — auto-checked basics the coach can deselect */}
        {sessionMode === "pool" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold">Daily Check-In</h4>
              <span className={`text-xs font-bold tabular-nums ${athlete.present ? "text-emerald-400" : "text-[#f8fafc]/30"}`}>{dailyUsed} xp today</span>
            </div>
            {!athlete.present && (
              <Card className="px-5 py-4">
                <button
                  onClick={() => togglePresent(athlete.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 active:scale-95 transition-all touch-manipulation"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Mark Present
                </button>
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
                        {done && <svg className="w-3.5 h-3.5 text-[#f8fafc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[#f8fafc] text-sm font-medium">{cp.name}</div>
                        <div className="text-[#f8fafc]/40 text-[11px]">{cp.desc}</div>
                      </div>
                      <span className={`text-xs font-bold ${done ? "text-emerald-400" : "text-[#f8fafc]/30"}`}>+{cp.xp}</span>
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
            <h4 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">Standout Awards</h4>
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
                      {done && <svg className="w-3.5 h-3.5 text-[#f8fafc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#f8fafc] text-sm font-medium">{cp.name}</div>
                      <div className="text-[#f8fafc]/40 text-[11px]">{cp.desc}</div>
                    </div>
                    <span className={`text-xs font-bold ${done ? "text-[#a855f7]" : "text-[#f8fafc]/30"}`}>+{cp.xp}</span>
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
            <h4 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">Weight Challenges</h4>
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
                      {done && <svg className="w-3.5 h-3.5 text-[#f8fafc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#f8fafc] text-sm font-medium">{ch.name}</div>
                      <div className="text-[#f8fafc]/60 text-[11px]">{ch.desc}</div>
                    </div>
                    <span className={`text-xs font-bold ${done ? "text-[#f59e0b]" : "text-[#f8fafc]/60"}`}>+{ch.xp} xp</span>
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
              <h4 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold">Side Quests</h4>
              {Object.values(athlete.quests).filter(q => q === "submitted").length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 animate-pulse">
                  {Object.values(athlete.quests).filter(q => q === "submitted").length} to review
                </span>
              )}
            </div>
            <span className="text-[#f8fafc]/25 text-xs font-mono">{Object.values(athlete.quests).filter(q => q === "done").length}/{QUEST_DEFS.length} done</span>
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
                        <span className="text-[#f8fafc] text-sm font-medium">{q.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${CAT_COLORS[q.cat] || "bg-white/10 text-[#f8fafc]/40"}`}>
                          {q.cat}
                        </span>
                      </div>
                      <div className="text-[#f8fafc]/40 text-xs mt-1">{q.desc}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs font-mono tracking-wider ${
                          st === "done" ? "text-emerald-400/70" : st === "submitted" ? "text-[#f59e0b]/70" : st === "active" ? "text-[#a855f7]/70" : "text-[#f8fafc]/25"
                        }`}>
                          {st === "done" ? "Completed" : st === "submitted" ? "Submitted — review now" : st === "active" ? "In progress" : "Not assigned"}
                        </span>
                        <span className={`text-xs font-bold font-mono ${st === "done" ? "text-emerald-400/60" : "text-[#f8fafc]/20"}`}>+{q.xp} xp</span>
                      </div>
                      {st === "submitted" && athlete.questNotes?.[q.id] && (
                        <div className="mt-2 p-2 rounded-lg bg-[#f59e0b]/5 border border-[#f59e0b]/15">
                          <span className="text-[#f59e0b]/60 text-[10px] uppercase tracking-wider font-bold">Athlete notes:</span>
                          <p className="text-[#f8fafc]/70 text-xs mt-0.5">{athlete.questNotes[q.id]}</p>
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
            <h4 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">You vs Last Month</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-black tabular-nums whitespace-nowrap ${growth.xpGain > 0 ? "text-emerald-400" : growth.xpGain < 0 ? "text-red-400" : "text-[#f8fafc]/60"}`}>
                  {growth.xpGain > 0 ? "+" : ""}{growth.xpGain}
                </div>
                <div className="text-[#f8fafc]/60 text-xs uppercase mt-1">XP Gained</div>
              </div>
              <div>
                <div className={`text-2xl font-black tabular-nums whitespace-nowrap ${growth.streakDelta > 0 ? "text-emerald-400" : growth.streakDelta < 0 ? "text-red-400" : "text-[#f8fafc]/60"}`}>
                  {growth.streakDelta > 0 ? "+" : ""}{growth.streakDelta}d
                </div>
                <div className="text-[#f8fafc]/60 text-xs uppercase mt-1">Streak</div>
              </div>
              <div>
                <div className="text-2xl font-black tabular-nums whitespace-nowrap text-[#f8fafc]">{athlete.totalPractices}</div>
                <div className="text-[#f8fafc]/60 text-xs uppercase mt-1">Total Sessions</div>
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

  // ── ATHLETE DETAIL DRILL-DOWN VIEW ───────────────────────
  const AthleteDetailView = ({ athlete, onBack }: { athlete: Athlete; onBack: () => void }) => {
    const lv = getLevel(athlete.xp, getSportForAthlete(athlete));
    const prog = getLevelProgress(athlete.xp, getSportForAthlete(athlete));
    const nxt = getNextLevel(athlete.xp, getSportForAthlete(athlete));
    const sk = fmtStreak(athlete.streak);
    const wsk = fmtWStreak(athlete.weightStreak);
    const dxp = athlete.dailyXP.date === today() ? athlete.dailyXP : { pool: 0, weight: 0, meet: 0 };
    const dailyUsed = dxp.pool + dxp.weight + dxp.meet;

    return (
      <div className="min-h-screen bg-[#0e0e18] text-[#f8fafc] relative overflow-x-hidden">
        <BgOrbs />
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="w-full py-6 sm:py-8">

            {/* Back button */}
            <button onClick={onBack}
              className="flex items-center gap-2 text-[#00f0ff]/60 hover:text-[#00f0ff] transition-colors mb-6 group min-h-[44px]">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="transition-transform group-hover:-translate-x-1">
                <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm font-bold font-mono tracking-wider uppercase">Back to Dashboard</span>
            </button>

            <div className="space-y-6">
              {/* Profile header */}
              <Card className="p-6 sm:p-8">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-black text-[#f8fafc] shrink-0"
                    style={{ background: `radial-gradient(circle at 30% 30%, ${lv.color}30, ${lv.color}08)`, border: `3px solid ${lv.color}60`, boxShadow: `0 0 30px ${lv.color}20` }}>
                    {athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[#f8fafc] font-black text-2xl tracking-tight">{athlete.name}</h2>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[#f8fafc]/60 text-sm">{athlete.age}y · {athlete.gender === "M" ? "Male" : "Female"}</span>
                      <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>
                        {lv.icon} {lv.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* XP progress bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[#f8fafc] font-bold">{lv.name} — <AnimatedCounter value={athlete.xp} />/{nxt ? nxt.xpThreshold : lv.xpThreshold} XP</span>
                    <span className="text-[#f8fafc]/50">{nxt ? `${prog.remaining} to ${nxt.name}` : "MAX LEVEL"}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${prog.percent}%`, background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }} />
                  </div>
                </div>
              </Card>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total XP", val: athlete.xp, color: "#A78BFA" },
                  { label: "Sessions", val: athlete.totalPractices, color: "#00f0ff" },
                  { label: "Pool Streak", val: `${athlete.streak}d`, color: "#a855f7" },
                  { label: "Weight Streak", val: `${athlete.weightStreak}d`, color: "#f59e0b" },
                ].map(s => (
                  <Card key={s.label} className="py-5 px-4 text-center">
                    <div className="text-2xl font-black tabular-nums whitespace-nowrap" style={{ color: s.color }}>{s.val}</div>
                    <div className="text-[#f8fafc]/50 text-xs uppercase tracking-wider font-bold mt-1">{s.label}</div>
                  </Card>
                ))}
              </div>

              {/* Streaks detail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-5 flex items-center justify-between">
                  <div>
                    <div className="text-[#f8fafc]/50 text-xs uppercase tracking-wider font-bold">Pool Streak</div>
                    <div className="text-[#f8fafc] font-black text-xl mt-1 flex items-center gap-2">
                      <StreakFlame streak={athlete.streak} size={20} />
                      {athlete.streak}d
                      <span className="text-[#a855f7] text-sm font-bold">{sk.label}</span>
                    </div>
                  </div>
                  <span className="text-[#a855f7] font-black text-lg">{sk.mult}</span>
                </Card>
                <Card className="p-5 flex items-center justify-between">
                  <div>
                    <div className="text-[#f8fafc]/50 text-xs uppercase tracking-wider font-bold">Weight Streak</div>
                    <div className="text-[#f8fafc] font-black text-xl mt-1">{athlete.weightStreak}d
                      <span className="text-[#f59e0b] text-sm font-bold ml-2">{wsk.label}</span>
                    </div>
                  </div>
                  <span className="text-[#f59e0b] font-black text-lg">{wsk.mult}</span>
                </Card>
              </div>

              {/* Daily XP usage */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold">Daily XP</h3>
                  <span className={`text-sm font-bold tabular-nums ${dailyUsed >= DAILY_XP_CAP ? "text-red-400" : "text-[#f8fafc]/60"}`}>{dailyUsed}/{DAILY_XP_CAP}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${dailyUsed >= DAILY_XP_CAP ? "bg-red-500" : ""}`}
                    style={{ width: `${(dailyUsed / DAILY_XP_CAP) * 100}%`, ...( dailyUsed < DAILY_XP_CAP ? { background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' } : {}) }} />
                </div>
                <div className="flex justify-between text-xs text-[#f8fafc]/40 mt-2">
                  <span>Pool: {dxp.pool}</span>
                  <span>Weight: {dxp.weight}</span>
                  <span>Meet: {dxp.meet}</span>
                </div>
              </Card>

              {/* Daily Check-In Checkpoints */}
              {(() => {
                const cps = sessionMode === "pool" ? currentCPs : sessionMode === "weight" ? WEIGHT_CPS : MEET_CPS;
                const cpMap = sessionMode === "pool" ? athlete.checkpoints : sessionMode === "weight" ? athlete.weightCheckpoints : athlete.meetCheckpoints;
                const autoPool = sessionMode === "pool";
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold">Daily Check-In</h3>
                      <span className={`text-xs font-bold tabular-nums ${athlete.present ? "text-emerald-400" : "text-[#f8fafc]/30"}`}>{dailyUsed} xp today</span>
                    </div>
                    {!athlete.present ? (
                      <Card className="px-5 py-4">
                        <button
                          onClick={() => togglePresent(athlete.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 active:scale-95 transition-all touch-manipulation"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Mark Present
                        </button>
                      </Card>
                    ) : (
                      <Card className="divide-y divide-white/[0.04]">
                        {(autoPool ? AUTO_POOL_CPS : cps).map(cp => {
                          const done = cpMap[cp.id];
                          return (
                            <button key={cp.id} onClick={() => toggleCheckpoint(athlete.id, cp.id, cp.xp, sessionMode === "pool" ? "pool" : sessionMode === "weight" ? "weight" : "meet")}
                              className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors min-h-[52px] ${done ? "bg-emerald-500/5" : "hover:bg-white/[0.02]"}`}>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${done ? "border-emerald-400 bg-emerald-500" : "border-white/15"}`}>
                                {done && <svg className="w-3.5 h-3.5 text-[#f8fafc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[#f8fafc] text-sm font-medium">{cp.name}</div>
                                <div className="text-[#f8fafc]/40 text-[11px]">{cp.desc}</div>
                              </div>
                              <span className={`text-xs font-bold ${done ? "text-emerald-400" : "text-[#f8fafc]/30"}`}>+{cp.xp}</span>
                            </button>
                          );
                        })}
                      </Card>
                    )}
                  </div>
                );
              })()}

              {/* Quests */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold">Quests</h3>
                  <span className="text-[#f8fafc]/25 text-xs font-mono">{Object.values(athlete.quests).filter(q => q === "done").length}/{QUEST_DEFS.length} done</span>
                </div>
                <Card className="divide-y divide-white/[0.04]">
                  {QUEST_DEFS.map(q => {
                    const st = athlete.quests[q.id] || "pending";
                    return (
                      <div key={q.id} className="flex items-center gap-4 px-5 py-4">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          st === "done" ? "border-emerald-400 bg-emerald-500" :
                          st === "submitted" ? "border-[#f59e0b] bg-[#f59e0b]/20" :
                          st === "active" ? "border-[#a855f7] bg-[#a855f7]/10" :
                          "border-white/15"
                        }`}>
                          {st === "done" && <svg className="w-4 h-4 text-[#f8fafc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          {st === "submitted" && <span className="text-xs">!</span>}
                          {st === "active" && <span className="text-xs text-[#a855f7]">●</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[#f8fafc] text-sm font-bold">{q.name}</div>
                          <div className="text-[#f8fafc]/40 text-xs mt-0.5">{q.desc}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[q.cat] || "text-[#f8fafc]/30"}`}>{q.cat}</span>
                          <span className="text-[#f8fafc]/30 text-xs font-bold">+{q.xp}</span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>

              {/* Week overview */}
              <Card className="p-5">
                <h3 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-3">This Week</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-black tabular-nums text-[#f8fafc]">{athlete.weekSessions}</div>
                    <div className="text-[#f8fafc]/50 text-xs uppercase mt-1">Pool Sessions</div>
                  </div>
                  <div>
                    <div className="text-xl font-black tabular-nums text-[#f8fafc]">{athlete.weekWeightSessions}</div>
                    <div className="text-[#f8fafc]/50 text-xs uppercase mt-1">Weight Sessions</div>
                  </div>
                  <div>
                    <div className="text-xl font-black tabular-nums text-[#f8fafc]">{athlete.weekTarget}</div>
                    <div className="text-[#f8fafc]/50 text-xs uppercase mt-1">Target</div>
                  </div>
                </div>
              </Card>

              {/* Best Times (SwimCloud) */}
              {(() => {
                const [btState, setBtState] = useState<"idle" | "loading" | "done" | "error">("idle");
                const [btData, setBtData] = useState<{ times: Array<{ event: string; stroke: string; time: string; course: string; meet: string; date: string }>; swimmer?: string; team?: string; swimmerUrl?: string; count?: number; cached?: boolean; message?: string; error?: string } | null>(null);

                const fetchBestTimes = async () => {
                  setBtState("loading");
                  try {
                    const res = await fetch("/api/swimcloud", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: athlete.name, usaSwimmingId: athlete.usaSwimmingId }),
                    });
                    const data = await res.json();
                    setBtData(data);
                    setBtState(data.error ? "error" : "done");
                  } catch {
                    setBtState("error");
                    setBtData({ times: [], error: "Network error" });
                  }
                };

                const courseColors: Record<string, string> = { SCY: "#00f0ff", LCM: "#a855f7", SCM: "#f59e0b" };

                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold">Best Times</h3>
                      <button onClick={fetchBestTimes} disabled={btState === "loading"}
                        className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-colors disabled:opacity-40 min-h-[32px]">
                        {btState === "loading" ? "Fetching…" : btState === "done" ? "Refresh" : "Fetch from SwimCloud"}
                      </button>
                    </div>
                    {btState === "loading" && (
                      <Card className="p-6 text-center">
                        <div className="text-[#f8fafc]/40 text-sm animate-pulse">Searching SwimCloud for {athlete.name}…</div>
                      </Card>
                    )}
                    {btState === "error" && (
                      <Card className="p-5">
                        <div className="text-red-400 text-sm">{btData?.error || "Failed to fetch times"}</div>
                        {btData?.message && <div className="text-[#f8fafc]/40 text-xs mt-1">{btData.message}</div>}
                      </Card>
                    )}
                    {btState === "done" && btData && (
                      <Card className="divide-y divide-white/[0.04]">
                        {btData.swimmer && (
                          <div className="px-5 py-3 flex items-center justify-between">
                            <div className="text-[#f8fafc]/50 text-xs">
                              {btData.swimmer} · {btData.team || ""}
                              {btData.cached && <span className="text-[#f8fafc]/30 ml-2">(cached)</span>}
                            </div>
                            {btData.swimmerUrl && (
                              <a href={btData.swimmerUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[#00f0ff]/60 text-xs hover:text-[#00f0ff] transition-colors">View Profile →</a>
                            )}
                          </div>
                        )}
                        {btData.times.length === 0 ? (
                          <div className="px-5 py-4 text-[#f8fafc]/40 text-sm text-center">
                            {btData.message || "No times found"}
                          </div>
                        ) : (
                          btData.times.map((t, i) => (
                            <div key={i} className="px-5 py-3 flex items-center gap-3">
                              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: courseColors[t.course] || "#fff", background: `${courseColors[t.course] || "#fff"}15` }}>
                                {t.course}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[#f8fafc] text-sm font-medium">{t.event} {t.stroke}</div>
                                {(t.meet || t.date) && <div className="text-[#f8fafc]/30 text-[10px] truncate">{t.meet}{t.date ? ` · ${t.date}` : ""}</div>}
                              </div>
                              <span className="text-[#f8fafc] font-black text-lg tabular-nums">{t.time}</span>
                            </div>
                          ))
                        )}
                      </Card>
                    )}
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── STAFF VIEW ───────────────────────────────────────────
  if (view === "staff") {
    const isAdmin = pinInput === coachPin || !currentCoach || (currentCoach && currentCoach.role === "head");
    return (
      <StaffView
        isAdmin={!!isAdmin}
        coaches={coaches}
        saveCoaches={saveCoaches as (c: { id: string; name: string; role: "head" | "assistant"; groups: string[]; email: string; pin: string }[]) => void}
        addAudit={addAudit}
        ROSTER_GROUPS={ROSTER_GROUPS}
        GameHUDHeader={GameHUDHeader}
        BgOrbs={BgOrbs}
      />
    );
  }

  // ── PARENT VIEW ──────────────────────────────────────────
  if (view === "parent") {
    const parentAthleteId = selectedAthlete;
    const parentAthlete = parentAthleteId ? roster.find(a => a.id === parentAthleteId) : null;

    if (parentAthlete) {
      return (
        <div className="min-h-screen bg-[#0e0e18] text-[#f8fafc] relative overflow-x-hidden">
          <BgOrbs /><XpFloats floats={xpFloats} /><LevelUpOverlay name={levelUpName} level={levelUpLevel} color={levelUpColor} exiting={levelUpExiting} onDismiss={handleLevelUpDismiss} /><AchievementToasts toasts={achieveToasts} onDismiss={handleAchieveDismiss} /><ComboCounter comboCount={comboCount} comboExiting={comboExiting} />
          <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10">
            <GameHUDHeader />
            <div className="mb-4 flex items-center gap-2">
              <span className="bg-[#6b21a8]/20 text-[#a855f7] text-[10px] font-mono font-bold px-2 py-0.5 rounded">PARENT PREVIEW</span>
            </div>
            <AthleteDetailView athlete={parentAthlete} onBack={() => setSelectedAthlete(null)} />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0e0e18] text-[#f8fafc] relative overflow-x-hidden">
        <BgOrbs /><XpFloats floats={xpFloats} /><LevelUpOverlay name={levelUpName} level={levelUpLevel} color={levelUpColor} exiting={levelUpExiting} onDismiss={handleLevelUpDismiss} /><AchievementToasts toasts={achieveToasts} onDismiss={handleAchieveDismiss} /><ComboCounter comboCount={comboCount} comboExiting={comboExiting} />
        <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Parent View</h2>
          <p className="text-[#00f0ff]/25 text-xs mb-8 font-mono">Tap an athlete to preview what their parent sees</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...roster].sort((a, b) => b.xp - a.xp).map(a => {
              const lv = getLevel(a.xp, getSportForAthlete(a)); const prog = getLevelProgress(a.xp, getSportForAthlete(a)); const growth = getPersonalGrowth(a);
              return (
                <div key={a.id} onClick={() => setSelectedAthlete(a.id)} className="cursor-pointer active:scale-[0.98] transition-all">
                <Card className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#6b21a8]/20 border border-[#6b21a8]/15 flex items-center justify-center text-xs font-bold text-[#f8fafc]">
                      {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[#f8fafc] font-medium text-sm truncate">{a.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold" style={{ color: lv.color }}>{lv.icon} {lv.name}</span>
                        <span className="text-[#f8fafc]/50 text-xs">{a.xp} XP</span>
                      </div>
                    </div>
                    <span className="text-[#f8fafc]/20 text-xs">&rarr;</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-2">
                    <div className="h-full rounded-full xp-shimmer transition-all" style={{ width: `${prog.percent}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#f8fafc]/60">
                    <span>Streak: {a.streak}d</span><span>Practices: {a.totalPractices}</span>
                    {a.pin && <span className="ml-auto font-mono text-[#a855f7] font-bold bg-[#6b21a8]/20 px-2 py-0.5 rounded">PIN: {a.pin}</span>}
                  </div>
                  {growth && growth.xpGain !== 0 && (
                    <div className={`mt-2 text-xs font-medium ${growth.xpGain > 0 ? "text-emerald-400/60" : "text-red-400/60"}`}>
                      {growth.xpGain > 0 ? "↑" : "↓"} {Math.abs(growth.xpGain)} XP vs last month
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <div className="grid grid-cols-3 gap-2 text-xs text-[#f8fafc]/60">
                      <div><span className="text-[#f8fafc]/40 font-bold">{a.totalPractices}</span> sessions</div>
                      <div><span className="text-[#f8fafc]/40 font-bold">{Object.values(a.quests||{}).filter(q => q === "done").length}</span> quests</div>
                      <div><span className="text-[#f8fafc]/40 font-bold">{getStreakMult(a.streak)}x</span> multiplier</div>
                    </div>
                  </div>
                </Card>
                </div>
              );
            })}
          </div>
          <p className="text-[#f8fafc]/40 text-xs text-center mt-12">Coach manages all data. Parental consent required. Contact coach for data export.</p>
        </div>
      </div>
    );
  }

  // ── AUDIT VIEW ───────────────────────────────────────────
  if (view === "audit") {
    return (
      <div className="min-h-screen bg-[#0e0e18] text-[#f8fafc] relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-6">Audit Log</h2>
          <div className="game-panel game-panel-border bg-[#0e0e18]/80 backdrop-blur-2xl p-2 max-h-[70vh] overflow-y-auto shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
            {!auditLog.length && <p className="text-[#f8fafc]/60 text-sm p-6 font-mono">No actions recorded yet.</p>}
            {auditLog.slice(0, 200).map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-5 text-sm hover:bg-[#00f0ff]/[0.03] transition-colors border-b border-[#00f0ff]/5 last:border-0">
                <span className="text-[#00f0ff]/25 text-xs w-36 shrink-0 font-mono">{new Date(e.timestamp).toLocaleString()}</span>
                <span className="text-[#f8fafc]/50 flex-1 truncate font-mono">{e.athleteName}: {e.action}</span>
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
    return (
      <MeetsView
        GameHUDHeader={GameHUDHeader}
        meets={meets}
        setMeets={setMeets}
        saveMeetsToStorage={(m) => save(K.MEETS, m)}
        roster={roster}
        filteredRoster={filteredRoster}
        ROSTER_GROUPS={ROSTER_GROUPS}
        onMeetScore={handleMeetScore}
      />
    );
  }

  // ── COMMS VIEW (Broadcast to Parents) ──────────────────────
  if (view === "comms") {
    return (
      <CommsView
        GameHUDHeader={GameHUDHeader}
        allBroadcasts={allBroadcasts}
        setAllBroadcasts={setAllBroadcasts}
        absenceReports={absenceReports}
        ROSTER_GROUPS={ROSTER_GROUPS}
      />
    );
  }

  // ── ANALYTICS VIEW ───────────────────────────────────────
  if (view === "analytics") {
    return (
      <AnalyticsTabContainer
        roster={roster}
        selectedGroup={selectedGroup}
        calendarData={calendarData}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        timelineAthleteId={timelineAthleteId}
        setTimelineAthleteId={setTimelineAthleteId}
        periodComparison={periodComparison}
        comparePeriod={comparePeriod}
        setComparePeriod={setComparePeriod}
        engagementTrend={engagementTrend}
        cultureScore={cultureScore}
        atRiskAthletes={atRiskAthletes}
        snapshots={snapshots}
        peakWindows={peakWindows}
        auditLog={auditLog}
        mostImproved={mostImproved}
        avgAtt={avgAtt}
        avgXP={avgXP}
        getAttritionRisk={getAttritionRisk}
        exportCSV={exportCSV}
        GameHUDHeader={GameHUDHeader}
        getSportForAthlete={getSportForAthlete}
      />
    );
  }

  // ── SPLIT ANALYZER VIEW ──────────────────────────────────
  if (view === "splits") {
    return <SplitAnalyzer GameHUDHeader={GameHUDHeader} />;
  }

  // ── SWIM ANALYTICS VIEW ──────────────────────────────────
  if (view === "swimanalytics") {
    return <TeamAnalytics GameHUDHeader={GameHUDHeader} />;
  }


  // ── TIME STANDARDS VIEW ──────────────────────────────────
  if (view === "timestandards") {
    return (
      <div className="w-full px-4 py-6">
        <TimeStandards />
      </div>
    );
  }

  // ── SCHEDULE VIEW ──────────────────────────────────────
  if (view === "schedule") {
    return <ScheduleView GameHUDHeader={GameHUDHeader} schedules={schedules} saveSchedules={saveSchedules} selectedGroup={scheduleGroup} templates={[]} />;
  }

  /* ════════════════════════════════════════════════════════════
     COACH MAIN VIEW — LEADERBOARD-FIRST LAYOUT
     ════════════════════════════════════════════════════════════ */

  const present = filteredRoster.filter(a => a.present || Object.values(a.checkpoints || {}).some(Boolean) || Object.values(a.weightCheckpoints || {}).some(Boolean)).length;
  const totalXpToday = filteredRoster.reduce((s, a) => s + ((a.dailyXP?.date === today()) ? ((a.dailyXP?.pool || 0) + (a.dailyXP?.weight || 0) + (a.dailyXP?.meet || 0)) : 0), 0);

  // ── Athlete detail drill-down ──────────────────────────
  if (selectedAthlete) {
    const detailAthlete = roster.find(a => a.id === selectedAthlete);
    if (detailAthlete) {
      return <AthleteDetailView athlete={detailAthlete} onBack={() => setSelectedAthlete(null)} />;
    }
    setSelectedAthlete(null);
  }

  return (
    <div className="min-h-screen bg-[#0e0e18] text-[#f8fafc] relative overflow-x-hidden">
      <BgOrbs />
      <ParticleField variant="gold" count={40} speed={0.3} opacity={0.4} />
      <XpFloats floats={xpFloats} /><LevelUpOverlay name={levelUpName} level={levelUpLevel} color={levelUpColor} exiting={levelUpExiting} onDismiss={handleLevelUpDismiss} /><AchievementToasts toasts={achieveToasts} onDismiss={handleAchieveDismiss} />

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="w-full">
          <GameHUDHeader />

        <GroupSelector
          groups={ROSTER_GROUPS}
          accessibleGroups={accessibleGroups}
          selectedGroup={selectedGroup}
          roster={roster}
          currentGroupDef={currentGroupDef}
          filteredRosterCount={filteredRoster.length}
          onSwitchGroup={switchGroup}
        />

        {/* ══════════════════════════════════════════════════════
           LEADERBOARD — THE HERO SECTION
           ══════════════════════════════════════════════════════ */}
        <div className="py-6">
            {/* Section header with tabs */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight neon-text-cyan">Leaderboard</h2>
                <div className="flex gap-1 bg-[#0e0e18]/60 p-1 border border-[#00f0ff]/15 game-panel-sm">
                  {(["all", "M", "F"] as const).map(t => (
                    <button key={t} onClick={() => setLeaderTab(t)}
                      className={`game-btn px-4 py-2 text-xs font-bold transition-all min-h-[32px] font-mono tracking-wider ${
                        leaderTab === t ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 shadow-[0_0_16px_rgba(0,240,255,0.3)]" : "text-[#f8fafc]/60 hover:text-[#00f0ff]/50 border border-transparent"
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
                    <span className="text-[#f8fafc] text-xs font-medium">{mvpMale.name.split(" ")[0]}</span>
                  </div>
                )}
                {mvpFemale && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#e879f9]/10 to-transparent border border-[#e879f9]/15">
                    <span className="text-xs font-bold text-[#e879f9] tracking-wider">♀ MVP</span>
                    <span className="text-[#f8fafc] text-xs font-medium">{mvpFemale.name.split(" ")[0]}</span>
                  </div>
                )}
                {mostImproved && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/15">
                    <span className="text-xs font-bold text-emerald-400 tracking-wider">RISING</span>
                    <span className="text-[#f8fafc] text-xs font-medium">{mostImproved.name.split(" ")[0]}</span>
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
                    const lv = getLevel(a.xp, getSportForAthlete(a));
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
                        <div className={`${avatarSizes[rank]} mx-auto ${rank === 0 ? "hex-avatar" : "rounded-full"} flex items-center justify-center font-black text-[#f8fafc] mb-3 border-[3px] ${ringColors[rank]} ring-pulse transition-all duration-300 group-hover:scale-110`}
                          style={{ background: `radial-gradient(circle at 30% 30%, ${lv.color}35, ${lv.color}10)`, "--ring-glow": rank === 0 ? "rgba(245,158,11,0.4)" : rank === 1 ? "rgba(0,240,255,0.3)" : "rgba(205,127,50,0.3)" } as React.CSSProperties}>
                          {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className={`text-base sm:text-lg font-black truncate w-full ${rank === 0 ? "neon-text-gold" : "text-[#f8fafc]"}`}>{a.name.split(" ")[0]}</div>
                        <div className="text-[#00f0ff]/20 text-[11px] truncate w-full font-mono">{a.name.split(" ").slice(1).join(" ")}</div>
                        <div className="rank-badge text-[11px] font-bold mt-3 px-4 py-1.5 inline-flex items-center gap-1.5 font-mono" style={{ color: lv.color, background: `${lv.color}18`, boxShadow: `0 0 15px ${lv.color}15` }}>
                          {lv.icon} {lv.name}
                        </div>
                        <div className="neon-text-gold text-2xl sm:text-3xl font-black mt-3 tracking-tight font-mono tabular-nums whitespace-nowrap">
                          {a.xp}<span className="text-xs text-[#f59e0b]/30 ml-1">XP</span>
                        </div>
                        {a.streak > 0 && (
                          <div className="text-[#f8fafc]/60 text-xs mt-1 font-bold flex items-center gap-1"><StreakFlame streak={a.streak} size={14} /> {a.streak}d streak</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ranked list — Top 10 with expand */}
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="text-[#00f0ff]/40 text-[11px] uppercase tracking-[0.2em] font-bold font-mono">// Rankings</h3>
              <span className="text-[#00f0ff]/20 text-xs font-mono">{sorted.length} athletes</span>
            </div>
            <div className="game-panel game-panel-border game-panel-scan relative bg-[#0e0e18]/80 backdrop-blur-2xl overflow-hidden shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
              {(showAllLeaderboard ? sorted : sorted.slice(0, 10)).map((a, i) => {
                const lv = getLevel(a.xp, getSportForAthlete(a));
                const rank = i + 1;
                const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                return (
                  <div key={a.id} className={`flex items-center gap-4 py-4 px-6 transition-all duration-200 hover:bg-white/[0.04] hover:shadow-[inset_0_0_30px_rgba(107,33,168,0.05)] group ${rank <= 3 ? "bg-white/[0.02]" : ""} ${i < (showAllLeaderboard ? sorted.length : Math.min(sorted.length, 10)) - 1 ? "border-b border-white/[0.03]" : ""}`}>
                    <span className={`w-8 text-center text-sm font-black shrink-0 transition-colors ${rank <= 3 ? "text-[#f59e0b]" : "text-[#f8fafc]/40 group-hover:text-[#f8fafc]/60"}`}>
                      {medalEmoji || rank}
                    </span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-[#f8fafc]/70 shrink-0 transition-all duration-200 group-hover:scale-110"
                      style={{ background: `radial-gradient(circle, ${lv.color}20, ${lv.color}08)`, border: `2px solid ${lv.color}${rank <= 3 ? "60" : "30"}`, boxShadow: `0 0 12px ${lv.color}${rank <= 3 ? "20" : "10"}` }}>
                      {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className={`text-sm font-semibold flex-1 truncate group-hover:text-[#f8fafc] transition-colors ${rank <= 3 ? "text-[#f8fafc]" : "text-[#f8fafc]/80"}`}>{a.name}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1 transition-all" style={{ color: lv.color, background: `${lv.color}12`, boxShadow: `0 0 8px ${lv.color}08` }}>{lv.icon} {lv.name}</span>
                    {a.streak > 0 && <span className="text-[#f8fafc]/60 text-xs hidden sm:inline-flex items-center gap-0.5 font-bold"><StreakFlame streak={a.streak} size={12} /> {a.streak}d</span>}
                    <AnimatedCounter value={a.xp} className="text-[#f59e0b] text-sm font-black w-16 text-right tabular-nums whitespace-nowrap shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]" />
                  </div>
                );
              })}
              {sorted.length > 10 && (
                <button
                  onClick={() => setShowAllLeaderboard(!showAllLeaderboard)}
                  className="w-full py-4 text-center text-sm font-bold font-mono tracking-wider text-[#00f0ff]/50 hover:text-[#00f0ff] hover:bg-white/[0.02] transition-all border-t border-white/[0.06]"
                >
                  {showAllLeaderboard ? "▲ Show Top 10" : `▼ Show All ${sorted.length} Athletes`}
                </button>
              )}
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
                  const isPending = pendingMode === m && sessionMode !== m;
                  return (
                    <button key={m}
                      onClick={(e) => handleModeClick(m, e)}
                      className={`w-full py-4 text-sm font-bold font-mono tracking-wider uppercase transition-all duration-200 rounded-xl min-h-[60px] flex flex-col items-center justify-center gap-1.5 touch-manipulation select-none ${
                        sessionMode === m
                          ? "bg-[#00f0ff]/12 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_16px_rgba(0,240,255,0.2)]"
                          : isPending
                            ? "bg-amber-500/20 text-amber-300 border-2 border-amber-500/50 animate-pulse"
                            : "bg-[#0e0e18]/60 text-[#f8fafc]/60 border border-white/[0.06] hover:text-[#00f0ff]/50 active:scale-[0.97]"
                      }`}>
                      <ModeIcon /><span className="text-[11px]">{isPending ? "Tap to confirm" : labels[m]}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={(e) => {
                  if (!e.isTrusted) return;
                  if (isScrollingRef.current) return;
                  const now = Date.now();
                  if (now - lastTouchEndRef.current < 600) return;
                  // Validate touch didn't move (scroll guard)
                  if (touchStartRef.current) {
                    const touch = e.nativeEvent as unknown as { clientX?: number; clientY?: number };
                    if (touch.clientX !== undefined && touch.clientY !== undefined) {
                      const dx = Math.abs(touch.clientX - touchStartRef.current.x);
                      const dy = Math.abs(touch.clientY - touchStartRef.current.y);
                      if (dx > 15 || dy > 15) return;
                    }
                  }
                  // Two-tap confirmation for AM/PM switch
                  if (pendingAmPm) {
                    // Confirmed — switch
                    setPendingAmPm(false);
                    if (pendingAmPmTimer.current) clearTimeout(pendingAmPmTimer.current);
                    const next = sessionTime === "am" ? "pm" : "am";
                    setSessionTime(next);
                    sessionStorage.setItem("apex_session_time_manual", today());
                    sessionStorage.setItem("apex_session_time_value", next);
                  } else {
                    // First tap — show confirmation
                    setPendingAmPm(true);
                    if (pendingAmPmTimer.current) clearTimeout(pendingAmPmTimer.current);
                    pendingAmPmTimer.current = setTimeout(() => setPendingAmPm(false), 3000);
                  }
                }}
                className={`w-full text-xs font-bold font-mono tracking-wider transition-all duration-200 rounded-xl min-h-[44px] touch-manipulation select-none ${
                  pendingAmPm
                    ? "bg-amber-500/20 text-amber-300 border-2 border-amber-500/50 animate-pulse"
                    : sessionTime === "am"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                }`}>
                {pendingAmPm ? `Tap to switch to ${sessionTime === "am" ? "PM" : "AM"}` : sessionTime === "am" ? "☀ AM" : "☽ PM"}
              </button>
            </div>

            {/* Quick actions — full-width toolbar */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              <button onClick={bulkMarkPresent} className="game-btn py-3 bg-[#00f0ff]/10 text-[#00f0ff]/70 text-xs font-mono tracking-wider border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20 transition-all active:scale-[0.97] rounded-xl min-h-[48px] tap-feedback touch-glow-cyan">
                Bulk
              </button>
              <button onClick={exportCSV} className="game-btn py-3 bg-[#0e0e18]/60 text-[#f8fafc]/50 text-xs font-mono border border-white/[0.06] hover:text-[#00f0ff]/50 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">Export</button>
              <label className="game-btn py-3 bg-[#0e0e18]/60 text-[#f8fafc]/50 text-xs font-mono border border-white/[0.06] hover:text-[#34d399]/50 transition-all active:scale-[0.97] rounded-xl min-h-[48px] flex items-center justify-center cursor-pointer">
                Import
                <input type="file" accept=".csv,.txt" onChange={importCSV} className="hidden" />
              </label>
              <button onClick={() => setAddAthleteOpen(!addAthleteOpen)} className="game-btn py-3 bg-[#0e0e18]/60 text-[#f8fafc]/50 text-xs font-mono border border-white/[0.06] hover:text-[#a855f7]/50 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">
                {addAthleteOpen ? "Cancel" : "+ Add"}
              </button>
              <div className="relative">
                <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="w-full game-btn py-3 bg-[#0e0e18]/60 text-[#f8fafc]/40 text-xs font-mono border border-white/[0.06] hover:text-[#f8fafc]/60 transition-all active:scale-[0.97] rounded-xl min-h-[48px]">
                  More
                </button>
                {showMoreMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#0a0315]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] py-1 min-w-[160px]">
                      <button onClick={() => { setShowMoreMenu(false); setConfirmAction({ label: "End current session? Attendance will be saved and a fresh slate will load.", action: endCurrentSession }); }} className="w-full text-left px-4 py-3 text-[#00f0ff]/80 text-xs font-mono hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] transition-colors font-semibold">End Session + Save</button>
                      <button onClick={() => { setShowMoreMenu(false); setShowSessionHistory(true); }} className="w-full text-left px-4 py-3 text-[#f8fafc]/60 text-xs font-mono hover:bg-white/[0.05] hover:text-[#f8fafc]/80 transition-colors">Session History</button>
                      <button onClick={() => { setShowMoreMenu(false); undoLast(); }} className="w-full text-left px-4 py-3 text-[#f8fafc]/60 text-xs font-mono hover:bg-white/[0.05] hover:text-[#f8fafc]/80 transition-colors">Undo Last</button>
                      <button onClick={() => { setShowMoreMenu(false); refreshInvites(); setShowInviteModal(true); }} className="w-full text-left px-4 py-3 text-[#a855f7]/70 text-xs font-mono hover:bg-[#a855f7]/10 hover:text-[#a855f7] transition-colors">Invite Links</button>
                      <div className="border-t border-white/[0.06] my-1" />
                      <button onClick={() => { setShowMoreMenu(false); setConfirmAction({ label: "Reset today's check-ins for this group?", action: resetDay }); }} className="w-full text-left px-4 py-3 text-[#f8fafc]/50 text-xs font-mono hover:bg-red-500/10 hover:text-red-400/80 transition-colors">Reset Day</button>
                      <button onClick={() => { setShowMoreMenu(false); setConfirmAction({ label: "Reset this week's sessions and check-ins?", action: resetWeek }); }} className="w-full text-left px-4 py-3 text-[#f8fafc]/50 text-xs font-mono hover:bg-red-500/10 hover:text-red-400/80 transition-colors">Reset Week</button>
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
                  <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 bg-white/[0.05] text-[#f8fafc]/50 text-xs font-mono rounded-lg hover:bg-white/[0.1] transition-all">Cancel</button>
                  <button onClick={() => { confirmAction.action(); setConfirmAction(null); }} className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold font-mono rounded-lg hover:bg-red-500/30 transition-all active:scale-[0.97]">Confirm</button>
                </div>
              </div>
            )}

            {/* Session History modal */}
            {showSessionHistory && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setShowSessionHistory(false); setEditingHistorySession(null); setConfirmDeleteSessionId(null); setConfirmClearAll(false); }}>
                <div className="bg-[#0a0315] border border-white/10 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[#f8fafc] font-bold text-lg font-mono">Session History</h3>
                    <div className="flex items-center gap-3">
                      {sessionHistory.filter(s => s.group === selectedGroup).length > 0 && (
                        <button
                          onClick={() => setConfirmClearAll(true)}
                          className="text-red-400/50 hover:text-red-400 text-xs font-mono px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                        >
                          Clear All
                        </button>
                      )}
                      <button onClick={() => { setShowSessionHistory(false); setEditingHistorySession(null); setConfirmDeleteSessionId(null); setConfirmClearAll(false); }} className="text-[#f8fafc]/40 hover:text-[#f8fafc] text-2xl">&times;</button>
                    </div>
                  </div>
                  {/* Clear All confirmation */}
                  {confirmClearAll && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-red-400/80 text-xs font-mono mb-3">Delete all session history for this group? This cannot be undone.</p>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setConfirmClearAll(false)} className="px-3 py-1.5 bg-white/[0.05] text-[#f8fafc]/50 text-xs font-mono rounded-lg hover:bg-white/[0.1] transition-all">Cancel</button>
                        <button onClick={() => {
                          const updated = sessionHistory.filter(s => s.group !== selectedGroup);
                          save(K.SESSION_HISTORY, updated);
                          setSessionHistory(updated);
                          setConfirmClearAll(false);
                        }} className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold font-mono rounded-lg hover:bg-red-500/30 transition-all active:scale-[0.97]">Delete All</button>
                      </div>
                    </div>
                  )}
                  {sessionHistory.filter(s => s.group === selectedGroup).length === 0 ? (
                    <p className="text-[#f8fafc]/30 text-sm font-mono text-center py-8">No saved sessions yet. Tap &ldquo;End Session + Save&rdquo; after practice to create history.</p>
                  ) : (
                    <div className="space-y-3">
                      {sessionHistory.filter(s => s.group === selectedGroup).slice(0, 20).map(session => (
                        <div key={session.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="text-[#f8fafc] font-mono text-sm font-bold">{session.date}</span>
                              <span className="text-[#f8fafc]/40 font-mono text-xs ml-2">{session.sessionType.toUpperCase()} &middot; {session.startTime}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#00f0ff] font-mono text-sm font-bold">{session.totalPresent}/{session.totalAthletes}</span>
                              <button
                                onClick={() => setEditingHistorySession(editingHistorySession === session.id ? null : session.id)}
                                className="text-[#f8fafc]/30 hover:text-[#f8fafc]/60 text-xs font-mono px-2 py-1 rounded hover:bg-white/[0.05] transition-colors"
                              >
                                {editingHistorySession === session.id ? "Close" : "Edit"}
                              </button>
                              {confirmDeleteSessionId === session.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => {
                                    const updated = sessionHistory.filter(s => s.id !== session.id);
                                    save(K.SESSION_HISTORY, updated);
                                    setSessionHistory(updated);
                                    setConfirmDeleteSessionId(null);
                                  }} className="text-red-400 text-xs font-mono font-bold px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/25 transition-colors">Delete</button>
                                  <button onClick={() => setConfirmDeleteSessionId(null)} className="text-[#f8fafc]/30 text-xs font-mono px-2 py-1 rounded hover:bg-white/[0.05] transition-colors">Cancel</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteSessionId(session.id)}
                                  className="text-[#f8fafc]/20 hover:text-red-400/60 text-xs font-mono px-1.5 py-1 rounded hover:bg-red-500/10 transition-colors"
                                  title="Delete session"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                          {editingHistorySession === session.id && (
                            <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-3">
                              {session.attendance.map(a => (
                                <div key={a.id} className="flex items-center justify-between py-1.5">
                                  <span className="text-[#f8fafc]/70 text-xs font-mono">{a.name}</span>
                                  <button
                                    onClick={() => {
                                      const updated = sessionHistory.map(s => {
                                        if (s.id !== session.id) return s;
                                        const newAtt = s.attendance.map(att => att.id === a.id ? { ...att, present: !att.present } : att);
                                        return { ...s, attendance: newAtt, totalPresent: newAtt.filter(x => x.present).length };
                                      });
                                      save(K.SESSION_HISTORY, updated);
                                      setSessionHistory(updated);
                                    }}
                                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all min-w-[60px] ${
                                      a.present ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/[0.03] text-[#f8fafc]/30 border border-white/[0.06]"
                                    }`}
                                  >
                                    {a.present ? "Present" : "Absent"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Add athlete — expandable */}
            {addAthleteOpen && (
              <div className="flex gap-3 mb-5 items-center flex-wrap">
                <input value={newAthleteName} onChange={e => setNewAthleteName(e.target.value)} placeholder="Name"
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[#f8fafc] text-sm w-52 focus:outline-none focus:border-[#6b21a8]/40 min-h-[44px]" style={{ fontSize: '16px' }} />
                <input value={newAthleteAge} onChange={e => setNewAthleteAge(e.target.value.replace(/\D/g, ""))} placeholder="Age"
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[#f8fafc] text-sm w-20 focus:outline-none min-h-[44px]" style={{ fontSize: '16px' }} />
                <select value={newAthleteGender} onChange={e => setNewAthleteGender(e.target.value as "M" | "F")}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[#f8fafc] text-sm focus:outline-none min-h-[44px]" style={{ fontSize: '16px' }}>
                  <option value="M">M</option><option value="F">F</option>
                </select>
                <button onClick={addAthleteAction}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#7c3aed] to-[#6b21a8] text-[#f8fafc] text-sm font-bold min-h-[44px] hover:shadow-[0_0_20px_rgba(107,33,168,0.3)] transition-all">
                  Add
                </button>
              </div>
            )}

            {/* ── ATHLETE ROSTER ─────────────────────────────── */}
            <h3 className="text-[#00f0ff]/30 text-[11px] uppercase tracking-[0.2em] font-bold mb-5 font-mono">// Roster Check-In</h3>
            <div className="space-y-3 mb-12" style={{ 
              contentVisibility: "auto",
              containIntrinsicSize: "0 4000px" /* Estimate: ~50 athletes * 80px each */
            }}>
              {[...filteredRoster].sort((a, b) => a.name.localeCompare(b.name)).map((a, index) => {
                const lv = getLevel(a.xp, getSportForAthlete(a));
                const prog = getLevelProgress(a.xp, getSportForAthlete(a));
                const sk = fmtStreak(a.streak);
                const hasCk = Object.values(a.checkpoints||{}).some(Boolean) || Object.values(a.weightCheckpoints||{}).some(Boolean);
                const dailyUsed = (a.dailyXP||{}).date === today() ? ((a.dailyXP||{}).pool||0) + ((a.dailyXP||{}).weight||0) + ((a.dailyXP||{}).meet||0) : 0;

                return (
                  <div 
                    key={a.id} 
                    className="relative overflow-hidden transition-all duration-200 game-card"
                    style={{
                      contentVisibility: index > 15 ? "auto" : "visible",
                      containIntrinsicSize: "0 88px" /* Each athlete card ~88px height */
                    }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: `linear-gradient(180deg, ${hasCk ? "#00f0ff" : lv.color}${hasCk ? "80" : "25"}, transparent)`, boxShadow: hasCk ? `0 0 8px ${lv.color}40` : "none" }} />
                    <div className={`game-panel-sm bg-[#0e0e18]/70 backdrop-blur-xl border transition-all duration-200 ${
                      hasCk ? "border-[#00f0ff]/15 shadow-[0_0_15px_rgba(0,240,255,0.05)]" : "border-[#00f0ff]/8"
                    } hover:border-[#00f0ff]/25`}>
                      <div
                        className="flex items-center gap-3 p-4 sm:p-5 cursor-pointer hover:bg-white/[0.02] transition-all duration-150 rounded-2xl group touch-manipulation"
                        onClick={() => setExpandedCheckIn(expandedCheckIn === a.id ? null : a.id)}
                      >
                        {/* Present toggle — tap to mark present/absent without expanding */}
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); togglePresent(a.id); }}
                          onTouchEnd={(e) => { e.stopPropagation(); }}
                          className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center transition-all duration-200 active:scale-90 touch-manipulation ${
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
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-black text-[#f8fafc] shrink-0 transition-all duration-300 group-hover:scale-110"
                          style={{ background: `radial-gradient(circle at 30% 30%, ${lv.color}30, ${lv.color}08)`, border: `2px solid ${lv.color}${hasCk ? "90" : "35"}`, boxShadow: hasCk ? `0 0 20px ${lv.color}20` : `0 0 8px ${lv.color}08` }}
                        >
                          {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <button className="text-[#f8fafc] text-sm font-semibold truncate hover:text-[#00f0ff] transition-colors text-left" onClick={(e) => { e.stopPropagation(); setSelectedAthlete(a.id); }}>{a.name}</button>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: lv.color, background: `${lv.color}15` }}>{lv.icon} {lv.name}</span>
                            {a.streak > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]/70 inline-flex items-center gap-0.5"><StreakFlame streak={a.streak} size={12} /> {a.streak}d · {sk.mult}</span>}
                          </div>
                        </div>
                        <div className="w-28 shrink-0 text-right">
                          <div className="text-[#f8fafc] font-black text-sm tabular-nums whitespace-nowrap"><AnimatedCounter value={a.xp} /><span className="text-[#f8fafc]/50 text-xs ml-1">XP</span></div>
                          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-1.5">
                            <div className="h-full rounded-full xp-shimmer" style={{ width: `${prog.percent}%` }} />
                          </div>
                          {dailyUsed > 0 && <div className="text-xs text-[#f59e0b]/60 font-bold mt-1">+{dailyUsed}</div>}
                        </div>
                      </div>
                      {/* Inline check-in expand */}
                      {expandedCheckIn === a.id && (
                        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] expand-in" onClick={e => e.stopPropagation()}>
                          {!a.present ? (
                            <button
                              onClick={() => togglePresent(a.id)}
                              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 active:scale-95 transition-all touch-manipulation mt-2"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              Mark Present
                            </button>
                          ) : (
                            <div className="space-y-1 mt-2">
                              {/* Mode switcher pills */}
                              <div className="flex gap-1.5 mb-3">
                                {(["pool", "weight", "meet"] as const).map(m => (
                                  <button key={m} onClick={(e) => handleModeClick(m, e)}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                                      sessionMode === m
                                        ? m === "pool" ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                                          : m === "weight" ? "bg-orange-500/15 text-orange-400 border border-orange-400/30"
                                          : "bg-purple-500/15 text-purple-400 border border-purple-400/30"
                                        : "bg-white/[0.03] text-[#f8fafc]/30 border border-white/[0.06] hover:bg-white/[0.06]"
                                    }`}
                                  >
                                    {m === "pool" ? "🏊 Pool" : m === "weight" ? "🏋️ Weights" : "🏅 Meet"}
                                  </button>
                                ))}
                              </div>
                              {(sessionMode === "pool" ? AUTO_POOL_CPS : sessionMode === "weight" ? WEIGHT_CPS : MEET_CPS).map(cp => {
                                const cpMap = sessionMode === "pool" ? a.checkpoints : sessionMode === "weight" ? a.weightCheckpoints : a.meetCheckpoints;
                                const done = cpMap[cp.id];
                                return (
                                  <button key={cp.id} onClick={() => toggleCheckpoint(a.id, cp.id, cp.xp, sessionMode)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                                      done ? "bg-emerald-500/8 border border-emerald-500/15" : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
                                    }`}
                                  >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                      done ? "bg-emerald-500/20 border border-emerald-400/40" : "bg-white/[0.04] border border-white/[0.08]"
                                    }`}>
                                      {done && <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className={`text-sm font-medium ${done ? "text-emerald-400/80" : "text-[#f8fafc]/70"}`}>{cp.name}</span>
                                    </div>
                                    <span className={`text-xs font-bold tabular-nums ${done ? "text-emerald-400/60" : "text-[#f8fafc]/20"}`}>+{cp.xp}</span>
                                  </button>
                                );
                              })}
                              <button
                                onClick={() => setSelectedAthlete(a.id)}
                                className="w-full text-center text-xs text-[#00f0ff]/40 hover:text-[#00f0ff]/70 font-mono mt-2 py-2 transition-colors"
                              >
                                View Full Profile →
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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
                    <div key={tc.id} className={`game-panel game-panel-border bg-[#0e0e18]/70 backdrop-blur-xl border p-5 transition-all card-press ${done ? "border-[#f59e0b]/30 neon-pulse-gold" : "border-[#00f0ff]/10"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[#f8fafc] font-medium text-sm">{tc.name}</span>
                        <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${done ? "text-[#f59e0b]" : "text-[#f8fafc]/60"}`}>{tc.current}%<span className="text-[#f8fafc]/40">/{tc.target}%</span></span>
                      </div>
                      <p className="text-[#f8fafc]/50 text-[11px] mb-3">{tc.description} · <span className="text-[#f59e0b]/60">+{tc.reward} XP</span></p>
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

        {/* ── Invite Links Modal ── */}
        {showInviteModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
            <div className="bg-[#0a0315] border border-[#a855f7]/20 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[#f8fafc] font-bold text-lg font-mono">Invite Links</h3>
                <button onClick={() => setShowInviteModal(false)} className="text-[#f8fafc]/40 hover:text-[#f8fafc] text-2xl leading-none">&times;</button>
              </div>

              {/* Create new invite */}
              <div className="bg-[#a855f7]/5 border border-[#a855f7]/15 rounded-xl p-4 mb-5">
                <p className="text-[#f8fafc]/50 text-xs font-mono mb-3">Create a shareable link — no PIN needed</p>
                <div className="flex gap-2 mb-3">
                  {(["athlete", "parent", "coach"] as InviteRole[]).map(r => (
                    <button key={r} onClick={() => setNewInviteRole(r)}
                      className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all ${
                        newInviteRole === r
                          ? r === "athlete" ? "bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40"
                          : r === "parent" ? "bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40"
                          : "bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40"
                          : "bg-white/[0.03] text-[#f8fafc]/30 border border-white/[0.06]"
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newInviteLabel}
                    onChange={e => setNewInviteLabel(e.target.value)}
                    placeholder={`e.g. "Gold Group Athletes"`}
                    className="flex-1 px-3 py-2.5 bg-[#0e0e18]/80 border border-white/10 rounded-lg text-[#f8fafc] text-sm placeholder:text-[#f8fafc]/20 focus:outline-none focus:border-[#a855f7]/40"
                  />
                  <button onClick={handleCreateInvite}
                    className="px-4 py-2.5 bg-[#a855f7]/20 text-[#a855f7] text-xs font-bold font-mono rounded-lg border border-[#a855f7]/30 hover:bg-[#a855f7]/30 transition-all active:scale-[0.97]">
                    Create
                  </button>
                </div>
              </div>

              {/* Active invites */}
              <div className="space-y-2">
                {inviteList.length === 0 ? (
                  <p className="text-[#f8fafc]/20 text-sm font-mono text-center py-6">No invite links yet. Create one above.</p>
                ) : (
                  inviteList.slice().reverse().map(inv => {
                    const isExpired = inv.expiresAt > 0 && Date.now() > inv.expiresAt;
                    const isMaxed = inv.maxUses > 0 && inv.useCount >= inv.maxUses;
                    const isActive = inv.active && !isExpired && !isMaxed;
                    const roleColor = inv.role === "athlete" ? "#a855f7" : inv.role === "parent" ? "#f59e0b" : "#00f0ff";
                    return (
                      <div key={inv.token} className={`border rounded-xl p-3 ${isActive ? "border-white/10 bg-white/[0.02]" : "border-white/[0.04] bg-white/[0.01] opacity-50"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: roleColor, background: `${roleColor}15`, border: `1px solid ${roleColor}25` }}>
                              {inv.role}
                            </span>
                            <span className="text-[#f8fafc]/60 text-sm">{inv.label}</span>
                          </div>
                          <span className="text-[#f8fafc]/20 text-[10px] font-mono">{inv.useCount} used</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <button onClick={() => handleCopyLink(inv.token)}
                              className={`flex-1 py-2 text-xs font-mono rounded-lg border transition-all active:scale-[0.97] ${
                                copiedToken === inv.token
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-white/[0.03] text-[#f8fafc]/50 border-white/[0.06] hover:text-[#f8fafc]/70"
                              }`}>
                              {copiedToken === inv.token ? "Copied!" : "Copy Link"}
                            </button>
                          )}
                          {isActive && (
                            <button onClick={() => handleDeactivate(inv.token)}
                              className="py-2 px-3 text-xs font-mono text-red-400/50 rounded-lg border border-white/[0.04] hover:bg-red-500/10 hover:text-red-400 transition-all">
                              Disable
                            </button>
                          )}
                          {!isActive && (
                            <span className="text-xs font-mono text-[#f8fafc]/20">
                              {!inv.active ? "Disabled" : isExpired ? "Expired" : "Max uses reached"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Practice Recap Overlay */}
        {showRecap && recapData && (
          <PracticeRecapModal recapData={recapData} onClose={() => setShowRecap(false)} />
        )}

        {/* Privacy footer */}
        <div className="text-center text-[#f8fafc]/[0.05] text-xs py-10 space-y-1">
          <p>METTLE — Athlete Relations Manager</p>
          <p>Coach manages all data. Parental consent required.</p>
        </div>
      </div>

      {/* Living breathing animations */}
      <style jsx>{`
        @keyframes glowBreathe {
          0%, 100% { box-shadow: 0 0 8px rgba(0, 240, 255, 0.05), inset 0 0 8px rgba(0, 240, 255, 0.02); }
          50% { box-shadow: 0 0 20px rgba(0, 240, 255, 0.12), inset 0 0 15px rgba(0, 240, 255, 0.04); }
        }
        @keyframes subtleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .glow-breathe {
          animation: glowBreathe 4s ease-in-out infinite;
        }
        .subtle-float {
          animation: subtleFloat 6s ease-in-out infinite;
        }
        .pulse-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }
        @keyframes recapEnter {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .recap-enter {
          animation: recapEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      {parentPreviewAthlete && (() => {
        const a = roster.find(r => r.id === parentPreviewAthlete);
        if (!a) return null;
        return <ParentPreviewModal isOpen={true} onClose={() => setParentPreviewAthlete(null)} athlete={{ id: a.id, name: a.name, group: a.group, bestTimes: a.bestTimes ? Object.fromEntries(Object.entries(a.bestTimes).map(([k, v]) => [k, v.time])) : undefined, level: getLevel(a.xp, getSportForAthlete(a)).name, xp: a.xp, streak: a.streak }} />;
      })()}
    </div>
  );
}
