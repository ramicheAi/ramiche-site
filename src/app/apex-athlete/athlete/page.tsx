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
  usaSwimmingId?: string;
  birthday?: string;
  parentCode?: string;
  parentEmail?: string;
}

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
function getGroupTargets(group: string): { pool: number; weight: number } {
  const key = group.toLowerCase().replace(/\s+/g, "").replace("bronze 1", "bronze1").replace("bronze 2", "bronze2").replace("water polo", "waterpolo");
  return WEEK_TARGETS[key] ?? { pool: 5, weight: 0 };
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

// ── Selah guided meditation scripts ─────────────────────────
interface MeditationScript {
  id: string;
  title: string;
  duration: string;
  durationMin: number;
  category: "pre-practice" | "pre-race" | "post-practice" | "recovery" | "sleep" | "team";
  fullText: string;
}

const SELAH_MEDITATIONS: MeditationScript[] = [
  {
    id: "pre-practice-focus",
    title: "Pre-Practice Focus",
    duration: "3 min",
    durationMin: 3,
    category: "pre-practice",
    fullText: `Close your eyes. Take three deep breaths — in through your nose, out through your mouth.\n\nFeel the tension in your shoulders. Let it go. Feel your jaw. Unclench it.\n\nNow picture the pool. See the lane lines. Feel the water before you touch it.\n\nVisualize your warm-up — smooth, easy strokes. Your body waking up, finding its rhythm.\n\nNow see your main set. Visualize your strokes — smooth, powerful, effortless. Each one better than the last.\n\nYou are not here by accident. You chose this. Every early morning, every hard set — it led you here.\n\nToday, you will be present. Not thinking about yesterday, not worrying about tomorrow. Just this practice. Just this moment.\n\nTake one more deep breath. Open your eyes.\n\nYou are prepared. You are focused. You are ready.`,
  },
  {
    id: "pre-race-visualization",
    title: "Pre-Race Visualization",
    duration: "5 min",
    durationMin: 5,
    category: "pre-race",
    fullText: `Find a quiet spot. Sit or lie down. Close your eyes.\n\nTake five slow breaths. With each exhale, let go of one worry.\n\nNow see yourself on the blocks. Feel the rough surface under your feet. Your toes curled over the edge.\n\nFeel the energy of the crowd. The buzz of the natatorium. The smell of chlorine. This is your arena.\n\nHear the announcer call your event. Your heat. Your lane.\n\nStep up. Adjust your goggles. Shake out your arms.\n\n"Swimmers, take your mark..."\n\nYou drop into position. Everything goes silent.\n\nBEEP.\n\nVisualize your dive — streamlined, explosive. You hit the water like a knife. Your breakout is long and powerful.\n\nSee each stroke. Feel the catch. The pull. The rotation. Everything is connected.\n\nSee each turn. Your flip is tight. Your push-off is a rocket.\n\nYou are racing your best time. Not the swimmer next to you — YOUR best.\n\nThe final wall is coming. You dig deep. Your legs are screaming but you do not slow down.\n\nYou touch the wall. You look up at the board.\n\nFeel the finish. The relief. The pride.\n\nYou did it.\n\nOpen your eyes. That race lives inside you. Go make it real.`,
  },
  {
    id: "post-practice-recovery",
    title: "Post-Practice Recovery",
    duration: "3 min",
    durationMin: 3,
    category: "post-practice",
    fullText: `You showed up today. That matters.\n\nBefore you rush off — pause. Just for a moment.\n\nTake three slow breaths. Feel your heart rate coming down.\n\nThink about what went well today. Even one small thing. A good turn. A strong finish. Showing up when you didn't feel like it.\n\nAcknowledge it. You earned that.\n\nNow think about what didn't go perfectly. Don't judge it. Don't replay it with frustration.\n\nIt's data, not failure. It's information. What can you learn? What will you try differently tomorrow?\n\nFeel your muscles releasing. Your shoulders dropping. Your body is already starting to recover.\n\nYou put in the work. Now let your body do its job.\n\nDrink water. Eat well tonight. Sleep like recovery is part of training — because it is.\n\nTomorrow you'll be stronger because of today. Trust the process.\n\nWell done.`,
  },
  {
    id: "anxiety-reframe",
    title: "Anxiety Reframe",
    duration: "4 min",
    durationMin: 4,
    category: "recovery",
    fullText: `Let's talk about that feeling in your stomach. The one that shows up before big races. Before time trials. Before moments that matter.\n\nMost people call it anxiety. But let's reframe it.\n\nThe butterflies in your stomach aren't fear — they're fuel.\n\nYour heart is beating faster because your body is preparing for performance. Adrenaline is flooding your system. Your muscles are priming. Your senses are sharpening.\n\nThis is your body's way of saying: "I'm ready for something big."\n\nPressure is a privilege. It means you're in a position to do something meaningful.\n\nChampions feel this too. Every single one of them. The difference? They've learned to use it.\n\nSo breathe in courage. Hold it. Feel it expand in your chest.\n\nBreathe out doubt. Let it dissolve.\n\nBreathe in: "I am ready."\nBreathe out: "I release what I can't control."\n\nBreathe in: "I've trained for this."\nBreathe out: "I trust my preparation."\n\nBreathe in: "This energy is my advantage."\nBreathe out: "I let go of fear."\n\nYou are not nervous. You are activated.\n\nNow go use that energy.`,
  },
  {
    id: "confidence-builder",
    title: "Confidence Builder",
    duration: "3 min",
    durationMin: 3,
    category: "recovery",
    fullText: `Close your eyes. Stand tall — even if you're sitting.\n\nYou have put in the work. Let's remember that.\n\nEvery practice. Every rep. Every early morning when your alarm went off and you chose to show up.\n\nThink about your hardest practice this season. You survived it. You pushed through it. That strength is inside you right now.\n\nThink about your best race. Remember how that felt — the power, the speed, the confidence. That athlete is still you.\n\nNobody can take your work away. Not a bad practice. Not a tough race. Not doubt.\n\nIt's all inside you. Banked. Stored. Ready to use.\n\nSay this silently to yourself:\n\n"I have earned this moment."\n"I am strong."\n"I am prepared."\n"I trust my training."\n\nWhatever happens next — in the pool, in the race, in practice — you go in knowing one thing:\n\nYou've done the work. And that makes you dangerous.\n\nOpen your eyes. Carry this with you.`,
  },
  {
    id: "box-breathing-guided",
    title: "Box Breathing",
    duration: "5 min",
    durationMin: 5,
    category: "recovery",
    fullText: `Box breathing is used by Navy SEALs, elite athletes, and first responders to calm the nervous system under pressure.\n\nHere's how it works:\n\nBreathe in for 4 counts.\nHold for 4 counts.\nBreathe out for 4 counts.\nHold for 4 counts.\n\nLet's begin.\n\n— Round 1 —\nBreathe IN... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\nBreathe OUT... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\n\n— Round 2 —\nBreathe IN... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\nBreathe OUT... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\n\n— Round 3 —\nBreathe IN... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\nBreathe OUT... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\n\n— Round 4 —\nBreathe IN... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\nBreathe OUT... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\n\n— Round 5 —\nBreathe IN... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\nBreathe OUT... 1... 2... 3... 4...\nHOLD... 1... 2... 3... 4...\n\nNotice how your heart rate has slowed. Your mind is clearer. Your body is calmer.\n\nUse this anytime — before a race, before sleep, or whenever the pressure feels too heavy.\n\nYou are in control.`,
  },
  {
    id: "sleep-wind-down",
    title: "Sleep Wind-Down",
    duration: "7 min",
    durationMin: 7,
    category: "sleep",
    fullText: `The day is done. Whatever happened today — the good, the frustrating, the hard — let it rest.\n\nYou're lying down. Your body is heavy. That's okay. Let it be heavy.\n\nTake a long, slow breath in... and a long, slow breath out.\n\nWe're going to scan your body and release every bit of tension.\n\nStart at your toes. Curl them tight... and release. Feel them relax.\n\nMove to your feet and ankles. They carried you through practice today. Let them rest.\n\nYour calves. Your shins. Let them sink into the bed.\n\nYour quads. Your hamstrings. These muscles worked hard today. They deserve this.\n\nYour hips. Your lower back. Release.\n\nYour stomach. Unclench. Let it soften.\n\nYour chest. Feel it rise and fall. Slowly. Gently.\n\nYour shoulders — where you carry so much. Let them drop. All the way down.\n\nYour arms. Your hands. Your fingers. Heavy. Still.\n\nYour neck. Your jaw — unclench it. Let your tongue rest from the roof of your mouth.\n\nYour eyes. Your forehead. Smooth. Relaxed.\n\nYour whole body is resting now.\n\nTomorrow is a new page. New chances. New reps. New opportunities to grow.\n\nBut tonight? Tonight, rest is your superpower.\n\nYou don't need to solve anything right now. You don't need to plan. You just need to sleep.\n\nYour body is recovering. Your muscles are rebuilding. Your mind is processing everything you learned today.\n\nSleep is training. And you're doing it right now.\n\nGoodnight, champion.`,
  },
  {
    id: "pre-meet-team-talk",
    title: "Pre-Meet Team Talk",
    duration: "3 min",
    durationMin: 3,
    category: "team",
    fullText: `Look around you — this is your team.\n\nThese are the people who wake up early with you. Who push through hard sets with you. Who know what it costs to be here.\n\nEvery one of you has put in the work. The early mornings. The sore muscles. The days you didn't want to show up — but did anyway.\n\nToday is not about being perfect. It's about being present.\n\nToday we swim as one.\n\nWhen you're behind the blocks, know that your team is behind you.\n\nWhen you're in the water, swim with everything you have — not just for you, but for the person in the next lane wearing your cap.\n\nSupport each other. Cheer loud. Be the loudest team on this deck.\n\nRace fearless. Not reckless — fearless. There's a difference.\n\nFearless means you trust your training. You race YOUR race. You don't hold back.\n\nWhatever happens today — whatever times go up on that board — we leave this meet better than we came.\n\nBetter swimmers. Better teammates. Better people.\n\nThis is our meet. Let's go take it.\n\nHands in. Team on three. 1... 2... 3... TEAM!`,
  },
  {
    id: "post-loss-processing",
    title: "Post-Loss Processing",
    duration: "5 min",
    durationMin: 5,
    category: "recovery",
    fullText: `The time on the board isn't what you wanted.\n\nThat's okay. Sit with that for a moment. Don't push it away.\n\nFeel what you feel. Disappointment is valid. Frustration is valid. Even anger — it means you care deeply about this.\n\nBut this isn't your story's ending. It's one chapter. One data point. One race in a career full of races.\n\nEvery great champion has races they wish they could redo.\n\nMichael Phelps had bad races. Katie Ledecky has had bad races. Caeleb Dressel has had bad races.\n\nWhat made them great wasn't that they never failed. It's what they did next.\n\nSo let's process this — not avoid it.\n\nFirst: What happened? Not emotionally — technically. Where did the race go off plan? Was it the start? The turns? The back half? Pacing?\n\nBe specific. This is how you learn.\n\nSecond: What was outside your control? Bad sleep? A cold? Tough scheduling? Acknowledge it and let it go.\n\nThird: What will you change? Not "try harder" — that's not a plan. What specific thing will you work on in the next two weeks?\n\nWrite it down. Say it out loud. Tell your coach.\n\nNow take three deep breaths.\n\nBreathe in: "This race does not define me."\nBreathe out: "I am more than one swim."\n\nBreathe in: "I will learn from this."\nBreathe out: "I will come back stronger."\n\nBreathe in: "I am still that athlete."\nBreathe out: "And I'm not done."\n\nYou're going to be okay. Better than okay.\n\nThis is where champions are forged — not in the wins, but in the comebacks.`,
  },
];

const MED_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  "pre-practice": { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", label: "PRE-PRACTICE" },
  "pre-race": { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20", label: "PRE-RACE" },
  "post-practice": { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/20", label: "POST-PRACTICE" },
  "recovery": { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20", label: "RECOVERY" },
  "sleep": { bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/20", label: "SLEEP" },
  "team": { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/20", label: "TEAM" },
};

const MED_CATEGORY_ICONS: Record<string, string> = {
  "pre-practice": "\u{1F3CA}",
  "pre-race": "\u{1F3AF}",
  "post-practice": "\u{1F30A}",
  "recovery": "\u{26A1}",
  "sleep": "\u{1F319}",
  "team": "\u{1F91D}",
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
function MeetsIcon({ active }: { active: boolean }) {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#00f0ff" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="2"/></svg>);
}

interface MeetData {
  id: string;
  name: string;
  date: string;
  location: string;
  course: "SCY" | "SCM" | "LCM";
  rsvpDeadline: string;
  events: { id: string; name: string; entries: { athleteId: string; seedTime?: string }[] }[];
  rsvps: Record<string, "committed" | "declined" | "pending">;
  broadcasts: { id: string; message: string; timestamp: number; sentBy: string }[];
  status: "upcoming" | "active" | "completed";
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
type CourseType = "SCY" | "SCM" | "LCM";
const COURSE_LABELS: Record<CourseType, string> = { SCY: "Short Course Yards", SCM: "Short Course Meters", LCM: "Long Course Meters" };
const EVENTS_BY_COURSE: Record<CourseType, string[]> = {
  SCY: ["50", "100", "200", "500", "1000", "1650"],
  SCM: ["50", "100", "200", "400", "800", "1500"],
  LCM: ["50", "100", "200", "400", "800", "1500"],
};
const EVENTS = ["50", "100", "200", "400", "500", "800", "1000", "1500", "1650"];
const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"];
const UNIT_LABEL: Record<CourseType, string> = { SCY: "y", SCM: "m", LCM: "m" };

// ── USA Swimming motivational time standards ──
// Source: USA Swimming 2024-2028 motivational time standards + 2026 championship qualifying times
type StandardLevel = "WR" | "US_OPEN" | "OT" | "JR_NATL" | "FUTURES" | "SECTIONALS" | "AAAA" | "AAA" | "AA" | "A" | "BB" | "B";
interface StandardTimes { [stroke: string]: { [level in StandardLevel]?: string } }

// ── SCY (Short Course Yards — 25yd pool) ──
const SCY_BOYS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { AAAA: "20.49", AAA: "21.79", AA: "23.19", A: "25.69", BB: "28.69", B: "32.59" }, Backstroke: { AAAA: "23.39", AAA: "24.89", AA: "26.49", A: "29.29", BB: "32.79", B: "37.19" }, Breaststroke: { AAAA: "25.99", AAA: "27.59", AA: "29.39", A: "32.59", BB: "36.39", B: "41.29" }, Butterfly: { AAAA: "22.59", AAA: "23.99", AA: "25.49", A: "28.29", BB: "31.59", B: "35.89" } },
  "100": { Freestyle: { AAAA: "44.69", AAA: "47.49", AA: "50.49", A: "55.99", BB: "1:02.59", B: "1:11.09" }, Backstroke: { AAAA: "50.39", AAA: "53.49", AA: "56.89", A: "1:03.09", BB: "1:10.49", B: "1:19.99" }, Breaststroke: { AAAA: "56.19", AAA: "59.69", AA: "1:03.49", A: "1:10.39", BB: "1:18.69", B: "1:29.39" }, Butterfly: { AAAA: "49.29", AAA: "52.39", AA: "55.69", A: "1:01.79", BB: "1:09.09", B: "1:18.39" }, IM: { AAAA: "52.89", AAA: "56.19", AA: "59.79", A: "1:06.29", BB: "1:14.09", B: "1:24.09" } },
  "200": { Freestyle: { AAAA: "1:38.59", AAA: "1:44.59", AA: "1:51.09", A: "2:03.29", BB: "2:17.79", B: "2:35.79" }, Backstroke: { AAAA: "1:48.89", AAA: "1:55.39", AA: "2:02.39", A: "2:15.79", BB: "2:31.59", B: "2:51.49" }, Breaststroke: { AAAA: "2:01.09", AAA: "2:08.39", AA: "2:16.29", A: "2:31.19", BB: "2:49.09", B: "3:11.39" }, Butterfly: { AAAA: "1:48.29", AAA: "1:54.79", AA: "2:01.69", A: "2:15.09", BB: "2:30.79", B: "2:50.59" }, IM: { AAAA: "1:50.69", AAA: "1:57.29", AA: "2:04.39", A: "2:17.99", BB: "2:33.89", B: "2:53.89" } },
  "500": { Freestyle: { AAAA: "4:29.49", AAA: "4:46.09", AA: "5:04.09", A: "5:37.69", BB: "6:17.09", B: "7:07.89" } },
  "1000": { Freestyle: { AAAA: "9:23.89", AAA: "9:58.69", AA: "10:36.29", A: "11:46.39", BB: "13:09.29", B: "14:55.29" } },
  "1650": { Freestyle: { AAAA: "15:29.79", AAA: "16:27.29", AA: "17:29.49", A: "19:25.29", BB: "21:41.79", B: "24:36.49" } },
};
const SCY_GIRLS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { AAAA: "22.59", AAA: "23.99", AA: "25.49", A: "28.29", BB: "31.59", B: "35.89" }, Backstroke: { AAAA: "25.49", AAA: "27.09", AA: "28.79", A: "31.89", BB: "35.69", B: "40.49" }, Breaststroke: { AAAA: "28.39", AAA: "30.19", AA: "32.09", A: "35.59", BB: "39.79", B: "45.09" }, Butterfly: { AAAA: "24.59", AAA: "26.09", AA: "27.79", A: "30.79", BB: "34.39", B: "39.09" } },
  "100": { Freestyle: { AAAA: "49.19", AAA: "52.29", AA: "55.59", A: "1:01.59", BB: "1:08.89", B: "1:18.19" }, Backstroke: { AAAA: "54.99", AAA: "58.39", AA: "1:02.09", A: "1:08.89", BB: "1:16.99", B: "1:27.39" }, Breaststroke: { AAAA: "1:01.99", AAA: "1:05.89", AA: "1:10.09", A: "1:17.69", BB: "1:26.79", B: "1:38.09" }, Butterfly: { AAAA: "53.99", AAA: "57.39", AA: "1:00.99", A: "1:07.69", BB: "1:15.59", B: "1:25.79" }, IM: { AAAA: "57.79", AAA: "1:01.39", AA: "1:05.29", A: "1:12.39", BB: "1:20.89", B: "1:31.79" } },
  "200": { Freestyle: { AAAA: "1:47.89", AAA: "1:54.39", AA: "2:01.39", A: "2:14.69", BB: "2:30.49", B: "2:50.19" }, Backstroke: { AAAA: "1:58.39", AAA: "2:05.39", AA: "2:12.89", A: "2:27.39", BB: "2:44.49", B: "3:06.09" }, Breaststroke: { AAAA: "2:13.49", AAA: "2:21.59", AA: "2:30.19", A: "2:46.69", BB: "3:06.39", B: "3:31.29" }, Butterfly: { AAAA: "1:58.69", AAA: "2:05.79", AA: "2:13.39", A: "2:27.99", BB: "2:45.09", B: "3:06.89" }, IM: { AAAA: "2:01.49", AAA: "2:08.69", AA: "2:16.39", A: "2:31.29", BB: "2:48.79", B: "3:11.09" } },
  "500": { Freestyle: { AAAA: "4:55.49", AAA: "5:13.69", AA: "5:33.29", A: "6:10.19", BB: "6:53.39", B: "7:49.09" } },
  "1000": { Freestyle: { AAAA: "10:15.89", AAA: "10:54.09", AA: "11:35.29", A: "12:51.99", BB: "14:22.39", B: "16:18.49" } },
  "1650": { Freestyle: { AAAA: "16:55.79", AAA: "17:59.69", AA: "19:08.39", A: "21:14.39", BB: "23:43.29", B: "26:54.39" } },
};

// ── LCM (Long Course Meters — 50m pool) ──
const LCM_BOYS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { AAAA: "22.99", AAA: "24.39", AA: "25.99", A: "28.79", BB: "32.19", B: "36.49" }, Backstroke: { AAAA: "26.19", AAA: "27.79", AA: "29.59", A: "32.79", BB: "36.59", B: "41.59" }, Breaststroke: { AAAA: "28.99", AAA: "30.79", AA: "32.79", A: "36.39", BB: "40.59", B: "46.09" }, Butterfly: { AAAA: "25.29", AAA: "26.89", AA: "28.59", A: "31.69", BB: "35.39", B: "40.19" } },
  "100": { Freestyle: { AAAA: "50.49", AAA: "53.59", AA: "56.99", A: "1:03.19", BB: "1:10.69", B: "1:20.19" }, Backstroke: { AAAA: "56.69", AAA: "60.19", AA: "1:03.99", A: "1:10.99", BB: "1:19.39", B: "1:30.09" }, Breaststroke: { AAAA: "1:03.39", AAA: "1:07.29", AA: "1:11.59", A: "1:19.29", BB: "1:28.69", B: "1:40.79" }, Butterfly: { AAAA: "55.49", AAA: "58.99", AA: "1:02.69", A: "1:09.49", BB: "1:17.69", B: "1:28.09" }, IM: { AAAA: "59.59", AAA: "1:03.29", AA: "1:07.29", A: "1:14.59", BB: "1:23.39", B: "1:34.59" } },
  "200": { Freestyle: { AAAA: "1:51.69", AAA: "1:58.49", AA: "2:05.89", A: "2:19.69", BB: "2:36.09", B: "2:56.49" }, Backstroke: { AAAA: "2:02.49", AAA: "2:09.89", AA: "2:17.89", A: "2:33.09", BB: "2:50.89", B: "3:13.49" }, Breaststroke: { AAAA: "2:17.19", AAA: "2:25.49", AA: "2:34.39", A: "2:51.29", BB: "3:11.09", B: "3:36.29" }, Butterfly: { AAAA: "2:02.09", AAA: "2:09.39", AA: "2:17.29", A: "2:32.39", BB: "2:50.09", B: "3:12.59" }, IM: { AAAA: "2:05.79", AAA: "2:13.29", AA: "2:21.29", A: "2:36.99", BB: "2:55.29", B: "3:18.19" } },
  "400": { Freestyle: { AAAA: "3:56.09", AAA: "4:10.59", AA: "4:26.39", A: "4:55.09", BB: "5:29.09", B: "6:13.29" }, IM: { AAAA: "4:22.59", AAA: "4:38.79", AA: "4:56.29", A: "5:28.59", BB: "6:07.39", B: "6:56.29" } },
  "800": { Freestyle: { AAAA: "8:12.29", AAA: "8:42.79", AA: "9:15.69", A: "10:15.89", BB: "11:28.29", B: "12:59.89" } },
  "1500": { Freestyle: { AAAA: "15:34.39", AAA: "16:31.89", AA: "17:34.39", A: "19:29.09", BB: "21:46.09", B: "24:41.39" } },
};
const LCM_GIRLS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { AAAA: "25.39", AAA: "26.99", AA: "28.69", A: "31.79", BB: "35.49", B: "40.29" }, Backstroke: { AAAA: "28.69", AAA: "30.49", AA: "32.39", A: "35.89", BB: "40.09", B: "45.49" }, Breaststroke: { AAAA: "31.89", AAA: "33.89", AA: "36.09", A: "39.99", BB: "44.69", B: "50.69" }, Butterfly: { AAAA: "27.59", AAA: "29.29", AA: "31.19", A: "34.59", BB: "38.59", B: "43.89" } },
  "100": { Freestyle: { AAAA: "55.49", AAA: "58.99", AA: "1:02.69", A: "1:09.49", BB: "1:17.69", B: "1:28.09" }, Backstroke: { AAAA: "1:01.89", AAA: "1:05.79", AA: "1:09.89", A: "1:17.49", BB: "1:26.59", B: "1:38.29" }, Breaststroke: { AAAA: "1:09.89", AAA: "1:14.29", AA: "1:18.99", A: "1:27.49", BB: "1:37.69", B: "1:50.49" }, Butterfly: { AAAA: "1:00.79", AAA: "1:04.59", AA: "1:08.69", A: "1:16.19", BB: "1:25.09", B: "1:36.49" }, IM: { AAAA: "1:05.09", AAA: "1:09.19", AA: "1:13.49", A: "1:21.49", BB: "1:30.99", B: "1:42.89" } },
  "200": { Freestyle: { AAAA: "2:01.49", AAA: "2:08.69", AA: "2:16.39", A: "2:31.29", BB: "2:48.79", B: "3:11.09" }, Backstroke: { AAAA: "2:13.89", AAA: "2:21.89", AA: "2:30.49", A: "2:46.89", BB: "3:06.39", B: "3:31.29" }, Breaststroke: { AAAA: "2:30.59", AAA: "2:39.59", AA: "2:49.29", A: "3:07.49", BB: "3:28.99", B: "3:56.39" }, Butterfly: { AAAA: "2:13.49", AAA: "2:21.49", AA: "2:30.09", A: "2:46.39", BB: "3:05.79", B: "3:30.59" }, IM: { AAAA: "2:17.09", AAA: "2:25.19", AA: "2:33.89", A: "2:50.49", BB: "3:09.79", B: "3:35.29" } },
  "400": { Freestyle: { AAAA: "4:15.69", AAA: "4:31.49", AA: "4:48.59", A: "5:19.79", BB: "5:56.69", B: "6:44.59" }, IM: { AAAA: "4:47.89", AAA: "5:05.69", AA: "5:24.79", A: "5:59.99", BB: "6:42.39", B: "7:36.09" } },
  "800": { Freestyle: { AAAA: "8:54.89", AAA: "9:27.89", AA: "10:03.59", A: "11:09.29", BB: "12:27.89", B: "14:07.89" } },
  "1500": { Freestyle: { AAAA: "16:51.29", AAA: "17:53.69", AA: "19:01.09", A: "21:05.49", BB: "23:32.99", B: "26:42.79" } },
};

// ── SCM (Short Course Meters — 25m pool) ──
const SCM_BOYS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { AAAA: "22.29", AAA: "23.69", AA: "25.19", A: "27.89", BB: "31.19", B: "35.39" }, Backstroke: { AAAA: "25.39", AAA: "26.99", AA: "28.69", A: "31.79", BB: "35.49", B: "40.29" }, Breaststroke: { AAAA: "27.99", AAA: "29.79", AA: "31.69", A: "35.09", BB: "39.19", B: "44.49" }, Butterfly: { AAAA: "24.49", AAA: "26.09", AA: "27.69", A: "30.69", BB: "34.29", B: "38.89" } },
  "100": { Freestyle: { AAAA: "48.79", AAA: "51.79", AA: "55.09", A: "1:01.09", BB: "1:08.29", B: "1:17.39" }, Backstroke: { AAAA: "54.79", AAA: "58.19", AA: "1:01.89", A: "1:08.59", BB: "1:16.69", B: "1:27.09" }, Breaststroke: { AAAA: "1:01.19", AAA: "1:04.99", AA: "1:09.19", A: "1:16.59", BB: "1:25.69", B: "1:37.19" }, Butterfly: { AAAA: "53.59", AAA: "56.89", AA: "1:00.49", A: "1:07.09", BB: "1:14.99", B: "1:25.09" }, IM: { AAAA: "57.49", AAA: "1:01.09", AA: "1:04.99", A: "1:12.09", BB: "1:20.49", B: "1:31.19" } },
  "200": { Freestyle: { AAAA: "1:47.89", AAA: "1:54.39", AA: "2:01.39", A: "2:14.69", BB: "2:30.49", B: "2:50.19" }, Backstroke: { AAAA: "1:58.19", AAA: "2:05.19", AA: "2:12.69", A: "2:27.09", BB: "2:44.09", B: "3:05.49" }, Breaststroke: { AAAA: "2:12.39", AAA: "2:20.39", AA: "2:28.99", A: "2:45.39", BB: "3:04.49", B: "3:28.89" }, Butterfly: { AAAA: "1:58.09", AAA: "2:05.09", AA: "2:12.59", A: "2:27.09", BB: "2:44.09", B: "3:05.49" }, IM: { AAAA: "2:01.09", AAA: "2:08.29", AA: "2:15.99", A: "2:30.89", BB: "2:48.29", B: "3:10.59" } },
  "400": { Freestyle: { AAAA: "3:49.29", AAA: "4:03.39", AA: "4:18.69", A: "4:46.59", BB: "5:19.59", B: "6:02.49" }, IM: { AAAA: "4:13.89", AAA: "4:29.49", AA: "4:46.39", A: "5:17.69", BB: "5:55.19", B: "6:42.49" } },
  "800": { Freestyle: { AAAA: "7:56.89", AAA: "8:26.49", AA: "8:58.29", A: "9:56.69", BB: "11:06.89", B: "12:35.69" } },
  "1500": { Freestyle: { AAAA: "15:04.09", AAA: "16:00.09", AA: "17:00.29", A: "18:51.39", BB: "21:03.89", B: "23:53.59" } },
};
const SCM_GIRLS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { AAAA: "24.59", AAA: "26.09", AA: "27.79", A: "30.79", BB: "34.39", B: "39.09" }, Backstroke: { AAAA: "27.79", AAA: "29.49", AA: "31.39", A: "34.79", BB: "38.79", B: "44.09" }, Breaststroke: { AAAA: "30.79", AAA: "32.69", AA: "34.79", A: "38.59", BB: "43.09", B: "48.89" }, Butterfly: { AAAA: "26.69", AAA: "28.39", AA: "30.19", A: "33.49", BB: "37.39", B: "42.39" } },
  "100": { Freestyle: { AAAA: "53.59", AAA: "56.89", AA: "1:00.49", A: "1:07.09", BB: "1:14.99", B: "1:25.09" }, Backstroke: { AAAA: "59.79", AAA: "1:03.49", AA: "1:07.49", A: "1:14.89", BB: "1:23.69", B: "1:34.89" }, Breaststroke: { AAAA: "1:07.39", AAA: "1:11.59", AA: "1:16.19", A: "1:24.39", BB: "1:34.39", B: "1:46.69" }, Butterfly: { AAAA: "58.69", AAA: "1:02.39", AA: "1:06.29", A: "1:13.49", BB: "1:22.09", B: "1:33.09" }, IM: { AAAA: "1:02.89", AAA: "1:06.79", AA: "1:11.09", A: "1:18.79", BB: "1:28.09", B: "1:39.69" } },
  "200": { Freestyle: { AAAA: "1:57.19", AAA: "2:04.09", AA: "2:11.49", A: "2:25.89", BB: "2:42.79", B: "3:04.29" }, Backstroke: { AAAA: "2:09.59", AAA: "2:17.29", AA: "2:25.49", A: "2:41.29", BB: "2:59.99", B: "3:24.09" }, Breaststroke: { AAAA: "2:25.39", AAA: "2:34.09", AA: "2:43.39", A: "3:00.89", BB: "3:21.59", B: "3:48.09" }, Butterfly: { AAAA: "2:09.19", AAA: "2:16.89", AA: "2:25.09", A: "2:40.79", BB: "2:59.39", B: "3:23.39" }, IM: { AAAA: "2:12.89", AAA: "2:21.09", AA: "2:29.79", A: "2:45.89", BB: "3:04.69", B: "3:29.39" } },
  "400": { Freestyle: { AAAA: "4:07.59", AAA: "4:22.89", AA: "4:39.39", A: "5:09.69", BB: "5:45.49", B: "6:31.79" }, IM: { AAAA: "4:38.39", AAA: "4:55.59", AA: "5:14.09", A: "5:48.09", BB: "6:29.09", B: "7:21.09" } },
  "800": { Freestyle: { AAAA: "8:37.49", AAA: "9:09.39", AA: "9:43.79", A: "10:47.29", BB: "12:03.29", B: "13:40.09" } },
  "1500": { Freestyle: { AAAA: "16:19.49", AAA: "17:19.69", AA: "18:25.09", A: "20:25.29", BB: "22:48.09", B: "25:51.69" } },
};

// Lookup table by course
const STANDARDS_TABLE: Record<CourseType, { M: { [event: string]: StandardTimes }; F: { [event: string]: StandardTimes } }> = {
  SCY: { M: SCY_BOYS, F: SCY_GIRLS },
  LCM: { M: LCM_BOYS, F: LCM_GIRLS },
  SCM: { M: SCM_BOYS, F: SCM_GIRLS },
};

const STANDARD_COLORS: Record<StandardLevel, string> = {
  WR: "#ff0000", US_OPEN: "#e11d48", OT: "#ffd700", JR_NATL: "#ff6b35", FUTURES: "#ef4444", SECTIONALS: "#f472b6",
  AAAA: "#ef4444", AAA: "#f59e0b", AA: "#a855f7", A: "#60a5fa", BB: "#22c55e", B: "#94a3b8",
};
const STANDARD_LABELS: Record<StandardLevel, string> = {
  WR: "World Record", US_OPEN: "US Open", OT: "Olympic Trials", JR_NATL: "Jr. Nationals", FUTURES: "Futures", SECTIONALS: "Sectionals",
  AAAA: "AAAA", AAA: "AAA", AA: "AA", A: "A", BB: "BB", B: "B",
};

// ── Championship Qualifying Times (SCY) — USA Swimming 2025-2026 ──
// US_OPEN = US Open / National Championship qualifying; WR = World Record reference times
const CHAMP_SCY_BOYS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { WR: "17.63", US_OPEN: "18.59", OT: "19.19", JR_NATL: "20.09", FUTURES: "20.79", SECTIONALS: "21.49" }, Backstroke: { WR: "21.80", US_OPEN: "22.49", JR_NATL: "23.09", FUTURES: "23.89" }, Breaststroke: { WR: "24.95", US_OPEN: "24.59", JR_NATL: "25.19", FUTURES: "26.09" }, Butterfly: { WR: "21.32", US_OPEN: "21.49", JR_NATL: "22.09", FUTURES: "22.89" } },
  "100": { Freestyle: { WR: "39.90", US_OPEN: "41.09", OT: "42.09", JR_NATL: "43.59", FUTURES: "45.09", SECTIONALS: "46.49" }, Backstroke: { WR: "43.49", US_OPEN: "45.09", OT: "46.09", JR_NATL: "48.09", FUTURES: "49.69", SECTIONALS: "51.29" }, Breaststroke: { WR: "49.53", US_OPEN: "51.09", OT: "52.09", JR_NATL: "54.09", FUTURES: "55.69", SECTIONALS: "57.39" }, Butterfly: { WR: "42.80", US_OPEN: "44.59", OT: "45.59", JR_NATL: "47.29", FUTURES: "48.89", SECTIONALS: "50.49" }, IM: { WR: "46.40", US_OPEN: "48.79", JR_NATL: "49.79", FUTURES: "51.49" } },
  "200": { Freestyle: { WR: "1:28.81", US_OPEN: "1:30.59", OT: "1:32.09", JR_NATL: "1:35.69", FUTURES: "1:38.09", SECTIONALS: "1:40.49" }, Backstroke: { WR: "1:35.41", US_OPEN: "1:38.09", OT: "1:40.09", JR_NATL: "1:43.89", FUTURES: "1:46.49", SECTIONALS: "1:49.09" }, Breaststroke: { WR: "1:47.55", US_OPEN: "1:50.09", OT: "1:52.09", JR_NATL: "1:56.29", FUTURES: "1:59.09", SECTIONALS: "2:01.89" }, Butterfly: { WR: "1:37.12", US_OPEN: "1:39.59", OT: "1:41.09", JR_NATL: "1:44.69", FUTURES: "1:47.29", SECTIONALS: "1:49.89" }, IM: { WR: "1:37.83", US_OPEN: "1:40.09", OT: "1:42.09", JR_NATL: "1:45.79", FUTURES: "1:48.49", SECTIONALS: "1:51.09" } },
  "500": { Freestyle: { WR: "4:02.12", US_OPEN: "4:07.09", OT: "4:11.09", JR_NATL: "4:18.69", FUTURES: "4:24.09", SECTIONALS: "4:29.49" } },
  "1000": { Freestyle: { US_OPEN: "8:48.09", JR_NATL: "9:05.69", FUTURES: "9:18.09" } },
  "1650": { Freestyle: { WR: "14:08.85", US_OPEN: "14:19.09", OT: "14:32.09", JR_NATL: "14:59.49", FUTURES: "15:19.09", SECTIONALS: "15:39.09" } },
};
const CHAMP_SCY_GIRLS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { WR: "20.37", US_OPEN: "21.09", OT: "21.69", JR_NATL: "22.59", FUTURES: "23.29", SECTIONALS: "23.99" }, Backstroke: { WR: "23.46", US_OPEN: "24.49", JR_NATL: "25.19", FUTURES: "25.99" }, Breaststroke: { WR: "26.56", US_OPEN: "27.19", JR_NATL: "27.89", FUTURES: "28.79" }, Butterfly: { WR: "21.92", US_OPEN: "23.49", JR_NATL: "24.09", FUTURES: "24.89" } },
  "100": { Freestyle: { WR: "44.39", US_OPEN: "45.99", OT: "47.09", JR_NATL: "48.89", FUTURES: "50.29", SECTIONALS: "51.69" }, Backstroke: { WR: "48.34", US_OPEN: "50.49", OT: "51.69", JR_NATL: "53.69", FUTURES: "55.19", SECTIONALS: "56.69" }, Breaststroke: { WR: "55.73", US_OPEN: "57.09", OT: "58.09", JR_NATL: "1:00.29", FUTURES: "1:01.89", SECTIONALS: "1:03.49" }, Butterfly: { WR: "47.42", US_OPEN: "49.49", OT: "50.69", JR_NATL: "52.69", FUTURES: "54.19", SECTIONALS: "55.69" }, IM: { WR: "51.51", US_OPEN: "54.09", JR_NATL: "55.29", FUTURES: "56.89" } },
  "200": { Freestyle: { WR: "1:38.39", US_OPEN: "1:40.09", OT: "1:42.09", JR_NATL: "1:45.89", FUTURES: "1:48.49", SECTIONALS: "1:51.09" }, Backstroke: { WR: "1:45.37", US_OPEN: "1:48.59", OT: "1:51.09", JR_NATL: "1:55.09", FUTURES: "1:57.89", SECTIONALS: "2:00.69" }, Breaststroke: { WR: "2:00.93", US_OPEN: "2:03.09", OT: "2:05.09", JR_NATL: "2:09.59", FUTURES: "2:12.69", SECTIONALS: "2:15.79" }, Butterfly: { WR: "1:47.59", US_OPEN: "1:49.69", OT: "1:51.69", JR_NATL: "1:55.69", FUTURES: "1:58.49", SECTIONALS: "2:01.29" }, IM: { WR: "1:49.51", US_OPEN: "1:51.09", OT: "1:53.09", JR_NATL: "1:57.09", FUTURES: "2:00.09", SECTIONALS: "2:03.09" } },
  "500": { Freestyle: { WR: "4:21.49", US_OPEN: "4:28.09", OT: "4:34.09", JR_NATL: "4:42.29", FUTURES: "4:48.49", SECTIONALS: "4:54.69" } },
  "1000": { Freestyle: { US_OPEN: "9:38.09", JR_NATL: "9:52.09", FUTURES: "10:06.09" } },
  "1650": { Freestyle: { WR: "15:18.59", US_OPEN: "15:38.09", OT: "15:52.09", JR_NATL: "16:22.69", FUTURES: "16:44.09", SECTIONALS: "17:05.09" } },
};
// ── Championship Qualifying Times (LCM) ──
const CHAMP_LCM_BOYS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { WR: "20.91", US_OPEN: "21.49", OT: "22.09", JR_NATL: "22.89", FUTURES: "23.49" }, Backstroke: { WR: "23.71", US_OPEN: "25.49", JR_NATL: "26.19" }, Breaststroke: { WR: "25.95", US_OPEN: "27.49", JR_NATL: "28.49" }, Butterfly: { WR: "22.27", US_OPEN: "23.79", JR_NATL: "24.59" } },
  "100": { Freestyle: { WR: "46.40", US_OPEN: "47.49", OT: "48.49", JR_NATL: "49.79", FUTURES: "50.99", SECTIONALS: "52.09" }, Backstroke: { WR: "51.60", US_OPEN: "52.49", OT: "53.59", JR_NATL: "55.19", FUTURES: "56.49" }, Breaststroke: { WR: "56.88", US_OPEN: "58.49", OT: "59.69", JR_NATL: "1:01.59", FUTURES: "1:02.99" }, Butterfly: { WR: "49.45", US_OPEN: "50.49", OT: "51.59", JR_NATL: "53.29", FUTURES: "54.49" } },
  "200": { Freestyle: { WR: "1:42.00", US_OPEN: "1:44.09", OT: "1:46.09", JR_NATL: "1:49.09", FUTURES: "1:51.49", SECTIONALS: "1:53.89" }, Backstroke: { WR: "1:51.92", US_OPEN: "1:53.59", OT: "1:56.09", JR_NATL: "1:59.69", FUTURES: "2:02.29" }, Breaststroke: { WR: "2:05.48", US_OPEN: "2:07.09", OT: "2:09.09", JR_NATL: "2:13.09", FUTURES: "2:15.89" }, Butterfly: { WR: "1:50.34", US_OPEN: "1:52.09", OT: "1:54.09", JR_NATL: "1:57.49", FUTURES: "2:00.09" }, IM: { WR: "1:54.00", US_OPEN: "1:55.09", OT: "1:57.09", JR_NATL: "2:00.69", FUTURES: "2:03.29" } },
  "400": { Freestyle: { WR: "3:40.07", US_OPEN: "3:43.09", OT: "3:46.09", JR_NATL: "3:52.09", FUTURES: "3:56.49" }, IM: { WR: "4:02.50", US_OPEN: "4:07.09", OT: "4:11.09", JR_NATL: "4:17.89", FUTURES: "4:22.49" } },
  "800": { Freestyle: { WR: "7:32.12", US_OPEN: "7:42.09", OT: "7:52.09", JR_NATL: "8:05.09", FUTURES: "8:14.09" } },
  "1500": { Freestyle: { WR: "14:31.02", US_OPEN: "14:45.09", OT: "15:00.09", JR_NATL: "15:22.09", FUTURES: "15:38.09" } },
};
const CHAMP_LCM_GIRLS: { [event: string]: StandardTimes } = {
  "50":  { Freestyle: { WR: "23.41", US_OPEN: "23.99", OT: "24.69", JR_NATL: "25.49", FUTURES: "26.09" }, Backstroke: { WR: "26.98", US_OPEN: "28.49", JR_NATL: "29.09" }, Breaststroke: { WR: "29.30", US_OPEN: "30.99", JR_NATL: "31.89" }, Butterfly: { WR: "24.38", US_OPEN: "26.49", JR_NATL: "27.19" } },
  "100": { Freestyle: { WR: "51.71", US_OPEN: "52.49", OT: "53.69", JR_NATL: "55.29", FUTURES: "56.49", SECTIONALS: "57.69" }, Backstroke: { WR: "57.33", US_OPEN: "58.49", OT: "59.69", JR_NATL: "1:01.49", FUTURES: "1:02.89" }, Breaststroke: { WR: "1:04.13", US_OPEN: "1:05.09", OT: "1:06.09", JR_NATL: "1:08.29", FUTURES: "1:09.79" }, Butterfly: { WR: "55.48", US_OPEN: "56.49", OT: "57.69", JR_NATL: "59.49", FUTURES: "1:00.89" } },
  "200": { Freestyle: { WR: "1:52.23", US_OPEN: "1:53.59", OT: "1:56.09", JR_NATL: "1:59.39", FUTURES: "2:01.89", SECTIONALS: "2:04.39" }, Backstroke: { WR: "2:03.35", US_OPEN: "2:04.59", OT: "2:07.09", JR_NATL: "2:10.89", FUTURES: "2:13.59" }, Breaststroke: { WR: "2:17.55", US_OPEN: "2:19.59", OT: "2:22.09", JR_NATL: "2:26.49", FUTURES: "2:29.49" }, Butterfly: { WR: "2:01.81", US_OPEN: "2:04.09", OT: "2:07.09", JR_NATL: "2:10.89", FUTURES: "2:13.59" }, IM: { WR: "2:06.12", US_OPEN: "2:07.09", OT: "2:09.09", JR_NATL: "2:13.09", FUTURES: "2:16.09" } },
  "400": { Freestyle: { WR: "3:55.38", US_OPEN: "3:59.09", OT: "4:05.09", JR_NATL: "4:11.49", FUTURES: "4:16.09" }, IM: { WR: "4:24.06", US_OPEN: "4:29.09", OT: "4:35.09", JR_NATL: "4:42.49", FUTURES: "4:47.49" } },
  "800": { Freestyle: { WR: "8:04.79", US_OPEN: "8:15.09", OT: "8:26.09", JR_NATL: "8:40.09", FUTURES: "8:50.09" } },
  "1500": { Freestyle: { WR: "15:20.48", US_OPEN: "15:45.09", OT: "16:10.09", JR_NATL: "16:34.09", FUTURES: "16:50.09" } },
};
// ── Florida Gold Coast LSC Senior Champs (SCY) ──
const FGC_SCY_BOYS: { [event: string]: { [stroke: string]: string } } = {
  "50": { Freestyle: "23.99", Backstroke: "27.49", Breaststroke: "29.99", Butterfly: "26.49" },
  "100": { Freestyle: "51.99", Backstroke: "58.99", Breaststroke: "1:04.99", Butterfly: "56.99", IM: "1:01.99" },
  "200": { Freestyle: "1:52.99", Backstroke: "2:05.99", Breaststroke: "2:19.99", Butterfly: "2:04.99", IM: "2:07.99" },
  "500": { Freestyle: "5:09.99" },
  "1650": { Freestyle: "17:49.99" },
};
const FGC_SCY_GIRLS: { [event: string]: { [stroke: string]: string } } = {
  "50": { Freestyle: "26.49", Backstroke: "29.99", Breaststroke: "33.49", Butterfly: "29.49" },
  "100": { Freestyle: "57.49", Backstroke: "1:04.99", Breaststroke: "1:12.49", Butterfly: "1:03.49", IM: "1:07.99" },
  "200": { Freestyle: "2:04.99", Backstroke: "2:17.99", Breaststroke: "2:34.99", Butterfly: "2:17.49", IM: "2:20.99" },
  "500": { Freestyle: "5:39.99" },
  "1650": { Freestyle: "19:29.99" },
};

// Unified lookup: merges motivational + championship cuts
function getAllStandards(gender: "M"|"F", event: string, stroke: string, course: CourseType): { [level in StandardLevel]?: string } {
  const motivational = STANDARDS_TABLE[course]?.[gender]?.[event]?.[stroke] || {};
  let champ: Record<string, string> = {};
  if (course === "SCY") {
    champ = (gender === "M" ? CHAMP_SCY_BOYS : CHAMP_SCY_GIRLS)[event]?.[stroke] || {};
  } else if (course === "LCM") {
    champ = (gender === "M" ? CHAMP_LCM_BOYS : CHAMP_LCM_GIRLS)[event]?.[stroke] || {};
  }
  return { ...motivational, ...champ };
}

function getFGCCut(gender: "M"|"F", event: string, stroke: string): string | null {
  const table = gender === "M" ? FGC_SCY_BOYS : FGC_SCY_GIRLS;
  return table[event]?.[stroke] || null;
}

function getStandardForAthlete(gender: "M"|"F", event: string, stroke: string, course: CourseType = "SCY"): { [level in StandardLevel]?: string } | null {
  const all = getAllStandards(gender, event, stroke, course);
  return Object.keys(all).length > 0 ? all : null;
}

function getAthleteCutLevel(gender: "M"|"F", event: string, stroke: string, timeSecs: number, course: CourseType = "SCY"): StandardLevel | null {
  const stds = getStandardForAthlete(gender, event, stroke, course);
  if (!stds) return null;
  const levels: StandardLevel[] = ["WR", "US_OPEN", "OT", "JR_NATL", "FUTURES", "SECTIONALS", "AAAA", "AAA", "AA", "A", "BB", "B"];
  for (const lv of levels) {
    const cutStr = stds[lv];
    if (cutStr) {
      const cutSecs = parseTime(cutStr);
      if (cutSecs !== null && timeSecs <= cutSecs) return lv;
    }
  }
  return null;
}

function getNextCut(gender: "M"|"F", event: string, stroke: string, timeSecs: number, course: CourseType = "SCY"): { level: StandardLevel; time: string; secs: number; gap: number } | null {
  const stds = getStandardForAthlete(gender, event, stroke, course);
  if (!stds) return null;
  const levels: StandardLevel[] = ["B", "BB", "A", "AA", "AAA", "AAAA", "SECTIONALS", "FUTURES", "JR_NATL", "OT", "US_OPEN", "WR"];
  for (const lv of levels) {
    const cutStr = stds[lv];
    if (cutStr) {
      const cutSecs = parseTime(cutStr);
      if (cutSecs !== null && timeSecs > cutSecs) {
        return { level: lv, time: cutStr, secs: cutSecs, gap: timeSecs - cutSecs };
      }
    }
  }
  return null;
}

function pacePerSplit(totalSecs: number, distance: number, splitDist: number = 50): string {
  const numSplits = distance / splitDist;
  const splitSecs = totalSecs / numSplits;
  return fmtTime(splitSecs);
}

function generateDailyGoals(currentSecs: number, goalSecs: number, event: string, stroke: string): string[] {
  const gap = currentSecs - goalSecs;
  const dist = parseInt(event);
  const goals: string[] = [];
  if (gap > 0) {
    const paceGoal = pacePerSplit(goalSecs, dist);
    goals.push(`Hold ${paceGoal} per 50 on your main set today`);
    if (dist >= 200) {
      goals.push(`Negative split your last ${dist >= 400 ? "200" : "100"} — finish faster than you start`);
    }
    if (gap > 3) {
      goals.push(`Focus on 1 technique cue today: ${stroke === "Freestyle" ? "high elbow catch" : stroke === "Backstroke" ? "hip rotation" : stroke === "Breaststroke" ? "narrow kick" : stroke === "Butterfly" ? "early breath timing" : "clean transitions"}`);
    }
    if (gap > 1 && gap <= 3) {
      goals.push("You're close — race-pace the last 25 of every rep");
    }
    goals.push(`Underwater: 3+ dolphin kicks off every wall`);
    goals.push("Streamline tight — thumbs locked, squeeze ears");
    if (dist <= 100) {
      goals.push("Explosive start: react to the beep, don't anticipate");
    }
    if (dist >= 400) {
      goals.push("Breathing pattern: every 3 strokes for the first half");
    }
  } else {
    goals.push("You've already hit this standard — set a new target!");
    goals.push("Focus on race execution: splits, turns, underwaters");
  }
  return goals.slice(0, 5);
}

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
type TabKey = "dashboard" | "times" | "goals" | "standards" | "raceprep" | "quests" | "journal" | "feedback" | "leaderboard" | "wellness" | "meets";

export default function AthletePortal() {
  const [mounted, setMounted] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  // Onboarding: athlete registers once with name + USA Swimming ID, then locked to their profile
  const [onboardStep, setOnboardStep] = useState<"name" | "swimid" | "confirm">("name");
  const [nameInput, setNameInput] = useState("");
  const [idInput, setIdInput] = useState(""); // USA Swimming ID (format: XXXX-XXXXXX or similar)
  const [onboardError, setOnboardError] = useState("");
  const [selectedOnboardAthlete, setSelectedOnboardAthlete] = useState<Athlete | null>(null);
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
  const [meditationModal, setMeditationModal] = useState<string|null>(null);
  const [completedMeditations, setCompletedMeditations] = useState<{meditationId: string; completedAt: number}[]>([]);
  const [searchResults, setSearchResults] = useState<Athlete[]>([]);
  const [celebration, setCelebration] = useState<{ level: string; color: string } | null>(null);
  const prevLevelRef = { current: "" };
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
  // Goals state
  const [goalEvent, setGoalEvent] = useState("100");
  const [goalStroke, setGoalStroke] = useState("Freestyle");
  const [goalCourse, setGoalCourse] = useState<CourseType>("SCY");
  const [savedGoals, setSavedGoals] = useState<{ event: string; stroke: string; targetLevel: StandardLevel; targetTime: string; course?: CourseType }[]>([]);
  const [rpAutoFilled, setRpAutoFilled] = useState(false);
  const [rpResult, setRpResult] = useState<RacePlan | null>(null);

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);

  const [isCoach, setIsCoach] = useState(false);
  const [coachGroup, setCoachGroup] = useState<string>("");
  useEffect(() => {
    setMounted(true);
    // Auto-unlock for coaches who already authenticated in the coach portal
    try {
      if (sessionStorage.getItem("apex-coach-auth")) {
        setUnlocked(true);
        setIsCoach(true);
        setCoachGroup(localStorage.getItem("apex-coach-group") || "");
      } else {
        const ls = localStorage.getItem("apex-coach-auth");
        if (ls && Date.now() - parseInt(ls) < 3600000) {
          setUnlocked(true);
          setIsCoach(true);
          setCoachGroup(localStorage.getItem("apex-coach-group") || "");
        }
      }
    } catch {}
  }, []);

  const handlePin = () => {
    if (pinInput === "2451") { setUnlocked(true); setPinError(false); return; }
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
    setCompletedMeditations(load<{meditationId: string; completedAt: number}[]>(`apex-athlete-meditations-${a.id}`, []));
    setSavedGoals(load<{ event: string; stroke: string; targetLevel: StandardLevel; targetTime: string }[]>(`apex-athlete-goals-${a.id}`, []));
  };

  const completeOnboarding = (a: Athlete, swimId: string) => {
    // Save profile lock — this device is now locked to this athlete
    localStorage.setItem("apex-athlete-profile-lock", JSON.stringify({ athleteId: a.id, name: a.name, usaSwimmingId: swimId }));
    // Also save the USA Swimming ID to the athlete record in the shared roster
    if (swimId) {
      const currentRoster = load<Athlete[]>(K.ROSTER, []);
      const updatedRoster = currentRoster.map(r => r.id === a.id ? { ...r, usaSwimmingId: swimId } : r);
      save(K.ROSTER, updatedRoster);
      setRoster(updatedRoster);
    }
    loadAthleteData(a);
  };

  const logout = () => {
    localStorage.removeItem("apex-athlete-profile-lock");
    setAthlete(null);
    setSelectedOnboardAthlete(null);
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

  // Full leaderboard (gender-based, auto-scroll to athlete position)
  const { leaderboard, athleteRank } = useMemo(() => {
    if (!athlete) return { leaderboard: [] as Athlete[], athleteRank: 0 };
    const genderFiltered = roster
      .filter(a => a.gender === athlete.gender && a.group === athlete.group)
      .sort((a, b) => b.xp - a.xp);
    const rank = genderFiltered.findIndex(a => a.id === athlete.id) + 1;
    return { leaderboard: genderFiltered, athleteRank: rank };
  }, [athlete, roster]);

  // Unread feedback count
  const unreadCount = feedback.filter(f => !f.read).length;

  // Auto-scroll to athlete's position on leaderboard tab
  useEffect(() => {
    if (tab === "leaderboard") {
      setTimeout(() => {
        const el = document.getElementById("my-rank");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [tab]);

  // Level-up celebration detection
  useEffect(() => {
    if (!athlete) return;
    const curLevel = getLevel(athlete.xp).name;
    if (prevLevelRef.current && prevLevelRef.current !== curLevel) {
      const lv = getLevel(athlete.xp);
      setCelebration({ level: lv.name, color: lv.color });
      setTimeout(() => setCelebration(null), 4000);
    }
    prevLevelRef.current = curLevel;
  }, [athlete?.xp]);

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
          <p className="text-white/60 text-sm mb-6">Enter PIN to access your dashboard</p>
          <input type="password" inputMode="numeric" maxLength={6} value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={e => e.key === "Enter" && handlePin()}
            className={`w-full px-5 py-4 bg-[#0a0518] border rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder:text-white/50 focus:outline-none transition-all ${pinError ? "border-red-500/60 animate-pulse" : "border-[#a855f7]/20 focus:border-[#a855f7]/50"}`}
            placeholder="····" autoFocus />
          <button onClick={handlePin}
            className="w-full mt-4 py-3 rounded-xl bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#a855f7] font-bold hover:bg-[#a855f7]/30 transition-all min-h-[44px]">
            Unlock
          </button>
          {pinError && <p className="text-red-400 text-xs mt-3">Incorrect PIN</p>}
          <Link href="/apex-athlete/portal" className="text-white/50 text-sm hover:text-white/60 transition-colors block mt-6">
            ← Back to Portal Selector
          </Link>
        </div>
      </div>
    );
  }

  // ── Coach mode: browse any athlete without onboarding lock ──
  if (!athlete && isCoach) {
    return (
      <div className="min-h-screen bg-[#06020f] relative overflow-hidden flex flex-col items-center justify-center px-5">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.08)_0%,transparent_70%)]" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          {/* Portal switcher */}
          <div className="flex justify-center gap-2 mb-6">
            <Link href="/apex-athlete" className="px-3 py-2.5 rounded-full text-xs font-bold border border-[#00f0ff]/30 text-[#00f0ff]/80 hover:bg-[#00f0ff]/10 transition-all min-h-[44px]">Coach</Link>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-[#a855f7] bg-[#a855f7]/20 text-[#a855f7]">Athlete</span>
            <Link href="/apex-athlete/parent" className="px-3 py-2.5 rounded-full text-xs font-bold border border-[#f59e0b]/30 text-[#f59e0b]/80 hover:bg-[#f59e0b]/10 transition-all min-h-[44px]">Parent</Link>
          </div>
          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] text-xs font-bold mb-3">COACH VIEW</div>
            <h1 className="text-2xl font-black text-white">Select Athlete</h1>
            <p className="text-white/60 text-sm mt-1">Browse any athlete&apos;s portal</p>
          </div>
          {/* Group filter for coaches */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-3">
            {["all", "platinum", "gold", "silver", "bronze1", "bronze2", "diving", "waterpolo"].map(g => (
              <button key={g} onClick={() => setCoachGroup(g === "all" ? "" : g)}
                className="px-3 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all min-h-[44px]"
                style={{
                  background: (g === "all" ? !coachGroup : coachGroup === g) ? '#a855f720' : 'transparent',
                  border: `1px solid ${(g === "all" ? !coachGroup : coachGroup === g) ? '#a855f760' : 'rgba(255,255,255,0.08)'}`,
                  color: (g === "all" ? !coachGroup : coachGroup === g) ? '#a855f7' : 'rgba(255,255,255,0.5)',
                }}>{g === "all" ? "All" : g.replace("bronze", "Brz ").replace("waterpolo", "WP").replace("platinum", "Plat").replace("gold", "Gold").replace("silver", "Silver").replace("diving", "Diving")}</button>
            ))}
          </div>
          <input type="text" placeholder="Search by name..." value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            className="w-full px-4 py-3 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:border-[#a855f7]/50 mb-3" autoFocus />
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {(nameInput.length >= 2 ? searchResults : roster.filter(a => !coachGroup || a.group === coachGroup).slice(0, 30)).map(a => {
              const lv = getLevel(a.xp || 0);
              return (
                <button key={a.id} onClick={() => loadAthleteData(a)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-[#0a0518]/80 border border-white/5 hover:border-[#a855f7]/30 transition-all flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{background:`${lv.color}20`,color:lv.color}}>{a.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{a.name}</div>
                    <div className="text-white/60 text-xs">{lv.name} · {a.xp || 0} XP</div>
                  </div>
                  <div className="text-white/50 text-xs">{a.group}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Onboarding: athlete registers once, then locked to their profile ──
  if (!athlete) {
    // USA Swimming ID format validation: XXXX-XXXXXX or at least 6 alphanumeric chars
    const isValidSwimId = (id: string) => {
      const trimmed = id.trim();
      if (trimmed.length < 4) return false;
      // Accept XXXX-XXXXXX format, or plain alphanumeric 6+ chars
      return /^[A-Za-z0-9]{4,}-[A-Za-z0-9]{4,}$/.test(trimmed) || /^[A-Za-z0-9]{6,}$/.test(trimmed);
    };

    // Format helper for display
    const formatSwimIdHint = (id: string) => {
      const trimmed = id.trim().toUpperCase();
      if (trimmed.length === 0) return "";
      // Auto-insert hyphen after 4 chars if not already present
      if (trimmed.length > 4 && !trimmed.includes("-")) {
        return trimmed.slice(0, 4) + "-" + trimmed.slice(4);
      }
      return trimmed;
    };

    const stepLabels = [
      { step: "name", label: "1. SELECT NAME", desc: "Find your profile" },
      { step: "swimid", label: "2. USA SWIMMING ID", desc: "Verify your identity" },
      { step: "confirm", label: "3. CONFIRM", desc: "Lock your portal" },
    ];
    const currentStepIdx = stepLabels.findIndex(s => s.step === onboardStep);

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
            <p className="text-white/60 text-sm">{stepLabels[currentStepIdx]?.desc || "Get started"}</p>
          </div>

          {/* Step progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {stepLabels.map((s, i) => (
              <div key={s.step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                  i < currentStepIdx ? "bg-[#a855f7]/20 border-[#a855f7]/40 text-[#a855f7]"
                    : i === currentStepIdx ? "bg-[#a855f7] border-[#a855f7] text-white"
                    : "bg-white/5 border-white/10 text-white/50"
                }`}>
                  {i < currentStepIdx ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (i + 1)}
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`w-8 h-0.5 rounded ${i < currentStepIdx ? "bg-[#a855f7]/40" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Select name from roster */}
          {onboardStep === "name" && (
            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">Your Name</label>
              <div className="relative">
                <input type="text" value={nameInput} onChange={e => { setNameInput(e.target.value); setOnboardError(""); }}
                  placeholder="Start typing your name..."
                  className="w-full px-5 py-4 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl text-white text-lg placeholder:text-white/50 focus:outline-none focus:border-[#a855f7]/50 transition-all min-h-[48px]"
                  autoFocus />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl overflow-hidden z-50 shadow-xl shadow-black/50">
                    {searchResults.map(a => {
                      const lv = getLevel(a.xp);
                      return (
                        <button key={a.id} onClick={() => {
                          setNameInput(a.name);
                          setSelectedOnboardAthlete(a);
                          setSearchResults([]);
                          setOnboardStep("swimid");
                        }}
                          className="w-full px-5 py-4 text-left hover:bg-[#a855f7]/10 transition-colors flex items-center justify-between border-b border-white/5 last:border-0 min-h-[48px]">
                          <div>
                            <span className="text-white font-semibold">{a.name}</span>
                            <span className="text-white/50 text-xs ml-2">{a.group.toUpperCase()}</span>
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
              <p className="text-white/50 text-xs mt-4 text-center">Select your name from the roster. If you don&apos;t see yourself, ask your coach to add you.</p>
            </div>
          )}

          {/* Step 2: USA Swimming ID */}
          {onboardStep === "swimid" && selectedOnboardAthlete && (
            <div className="space-y-4">
              <div className="bg-[#0a0518] border border-[#a855f7]/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center text-xs font-bold text-[#a855f7]">
                  {selectedOnboardAthlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{selectedOnboardAthlete.name}</p>
                  <p className="text-white/60 text-xs">{selectedOnboardAthlete.group.toUpperCase()} · Age {selectedOnboardAthlete.age}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>

              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">USA Swimming ID</label>
                <div className="relative">
                  <input type="text" value={idInput}
                    onChange={e => { setIdInput(e.target.value.replace(/[^A-Za-z0-9-]/g, "").toUpperCase()); setOnboardError(""); }}
                    placeholder="XXXX-XXXXXX"
                    maxLength={15}
                    className="w-full px-5 py-4 bg-[#0a0518] border border-[#a855f7]/20 rounded-xl text-white text-xl font-mono placeholder:text-white/50 focus:outline-none focus:border-[#a855f7]/50 transition-all text-center tracking-[0.15em] min-h-[56px]"
                    autoFocus />
                  {/* Format hint */}
                  {idInput.length > 0 && (
                    <div className="absolute -bottom-6 left-0 right-0 text-center">
                      <span className={`text-sm font-mono ${isValidSwimId(idInput) ? "text-emerald-400/80" : "text-white/50"}`}>
                        {formatSwimIdHint(idInput)}
                        {isValidSwimId(idInput) && (
                          <span className="ml-1">
                            <svg className="inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 mt-2 p-3 rounded-xl bg-[#0a0518]/60 border border-[#00f0ff]/10">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  <p className="text-white/60 text-sm">Your USA Swimming ID links your portal to your parent&apos;s account. Format: <span className="text-white/50 font-mono">XXXX-XXXXXX</span>. Find it on your USA Swimming registration or ask your coach.</p>
                </div>
              </div>

              {onboardError && <p className="text-red-400 text-xs mt-2">{onboardError}</p>}

              <button onClick={() => {
                if (!idInput.trim()) { setOnboardError("Enter your USA Swimming ID to continue"); return; }
                if (!isValidSwimId(idInput)) { setOnboardError("ID must be at least 6 characters (format: XXXX-XXXXXX)"); return; }
                // Validate: if athlete already has a usaSwimmingId set by coach, it must match
                if (selectedOnboardAthlete.usaSwimmingId && selectedOnboardAthlete.usaSwimmingId.toUpperCase() !== idInput.trim().toUpperCase()) {
                  setOnboardError("USA Swimming ID does not match the ID on file. Check with your coach.");
                  return;
                }
                setOnboardStep("confirm");
              }}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white font-bold text-lg hover:brightness-110 transition-all min-h-[52px] disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!idInput.trim()}>
                Verify &amp; Continue
              </button>
              <button onClick={() => { setOnboardStep("name"); setNameInput(""); setIdInput(""); setSelectedOnboardAthlete(null); setOnboardError(""); }}
                className="w-full py-2 text-white/60 text-sm hover:text-white/50 transition-colors">
                ← That&apos;s not me
              </button>
            </div>
          )}

          {/* Step 3: Final confirmation */}
          {onboardStep === "confirm" && selectedOnboardAthlete && (
            <div className="space-y-4">
              {(() => {
                const match = selectedOnboardAthlete;
                const lv = getLevel(match.xp);
                return (
                  <>
                    <div className="bg-[#0a0518] border border-[#a855f7]/20 rounded-xl p-6 text-center">
                      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#a855f7]/10 border-2 border-[#a855f7]/25 flex items-center justify-center text-lg font-bold text-[#a855f7]">
                        {match.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <p className="text-white font-bold text-xl mb-1">{match.name}</p>
                      <p className="text-white/60 text-sm mb-2">{match.group.toUpperCase()} · Age {match.age}</p>
                      <span className="text-sm font-bold" style={{ color: lv.color }}>{lv.icon} {lv.name} · {match.xp} XP</span>
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center justify-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>
                          <span className="text-[#22d3ee] font-mono text-sm tracking-wider">{formatSwimIdHint(idInput)}</span>
                        </div>
                        <p className="text-white/50 text-sm mt-1">USA Swimming ID</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <p className="text-white/60 text-sm">This will lock this device to your profile. Only your data will be visible. To switch athletes, you&apos;ll need to log out first.</p>
                      </div>
                    </div>

                    <button onClick={() => {
                      completeOnboarding(match, idInput.trim().toUpperCase());
                    }}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white font-bold text-lg hover:brightness-110 transition-all min-h-[52px]">
                      Lock Profile &amp; Enter Portal
                    </button>
                    <button onClick={() => { setOnboardStep("swimid"); setOnboardError(""); }}
                      className="w-full py-2 text-white/60 text-sm hover:text-white/50 transition-colors">
                      ← Go back
                    </button>
                  </>
                );
              })()}
            </div>
          )}

          <div className="text-center mt-8">
            <Link href="/apex-athlete/portal" className="text-white/50 text-sm hover:text-white/60 transition-colors">← Back to Portal Selector</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Tab definitions ─────────────────────────────────────
  const TABS: { key: TabKey; label: string; icon: (active: boolean) => React.ReactNode; badge?: number }[] = [
    { key: "dashboard", label: "Stats", icon: (a) => <StatsIcon active={a} /> },
    { key: "times", label: "Times", icon: (a) => <TimerIcon active={a} /> },
    { key: "standards", label: "Cuts", icon: (a) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a?"#ffd700":"currentColor"} strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
    { key: "goals", label: "Goals", icon: (a) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a?"#22c55e":"currentColor"} strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill={a?"#22c55e":"currentColor"}/></svg> },
    { key: "raceprep", label: "Race", icon: (a) => <TargetIcon active={a} /> },
    { key: "meets", label: "Meets", icon: (a) => <MeetsIcon active={a} /> },
    { key: "quests", label: "Quests", icon: (a) => <QuestsIcon active={a} /> },
    { key: "journal", label: "Log", icon: (a) => <JournalIcon active={a} /> },
    { key: "feedback", label: "Coach", icon: (a) => <MessageIcon active={a} />, badge: unreadCount },
    { key: "leaderboard", label: "Board", icon: (a) => <BoardIcon active={a} /> },
    { key: "wellness", label: "Mind", icon: (a) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a?"#a855f7":"currentColor"} strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> },
  ];

  // ── Main dashboard ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#06020f] relative overflow-hidden">
      {/* Portal switcher */}
      <div className="relative z-20 flex items-center justify-center gap-2 py-2">
        {[
          { label: "Coach", href: "/apex-athlete", color: "#00f0ff" },
          { label: "Athlete", href: "/apex-athlete/athlete", active: true, color: "#a855f7" },
          { label: "Parent", href: "/apex-athlete/parent", color: "#f59e0b" },
        ].map(p => (
          <a key={p.label} href={p.href}
            className="px-4 py-2.5 text-xs font-bold font-mono tracking-[0.2em] uppercase rounded-full transition-all min-h-[44px]"
            style={{
              background: (p as any).active ? `${p.color}20` : 'transparent',
              border: `1px solid ${(p as any).active ? p.color + '60' : 'rgba(255,255,255,0.08)'}`,
              color: (p as any).active ? p.color : 'rgba(255,255,255,0.5)',
            }}>
            {p.label}
          </a>
        ))}
      </div>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.08)_0%,transparent_70%)]" />
      </div>

      {/* Level-Up Celebration Overlay */}
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" style={{ animation: "aa-welcome-in 0.5s ease-out, aa-welcome-out 0.5s ease-in 3.5s forwards" }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle, ${celebration.color}30, transparent 70%)` }} />
          <div className="relative text-center" style={{ animation: "aa-subtle-pulse 1.5s ease-in-out infinite" }}>
            <svg className="w-20 h-20 mx-auto mb-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={celebration.color} strokeWidth="1.5" fill={`${celebration.color}40`}/>
            </svg>
            <div className="text-5xl font-black text-white mb-2" style={{ textShadow: `0 0 40px ${celebration.color}80, 0 0 80px ${celebration.color}40` }}>LEVEL UP!</div>
            <div className="text-2xl font-bold" style={{ color: celebration.color }}>{celebration.level}</div>
            <div className="text-white/60 text-sm mt-2">Keep pushing — greatness is earned</div>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header + AM/PM indicator */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={logout} className="text-white/60 hover:text-white/60 text-sm transition-colors min-h-[44px]">{isCoach ? "← Switch" : "Sign Out"}</button>
          <div className="text-center">
            <h2 className="text-white font-bold text-lg">{athlete.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span style={{ color: level.color }} className="text-sm font-bold">{level.icon} {level.name}</span>
              <span className="text-white/50 text-xs">·</span>
              <span className="text-white/60 text-xs">{athlete.group.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-white/50 text-sm font-mono">Age {athlete.age}</span>
              {athlete.usaSwimmingId && (
                <>
                  <span className="text-white/60 text-sm">·</span>
                  <span className="text-[#00f0ff]/90 text-sm font-mono">USA-S {athlete.usaSwimmingId}</span>
                </>
              )}
            </div>
          </div>
          {/* AM/PM Toggle */}
          <button onClick={() => setSessionTime(sessionTime === "am" ? "pm" : "am")}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold font-mono tracking-wider transition-all duration-200 active:scale-95 ${
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
            <span className="text-white/60 text-xs font-mono">XP: {athlete.xp}</span>
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
            <div className="text-sm font-mono tracking-wider" style={{ color: streak.color }}>{streak.label}</div>
            <div className="text-white/50 text-sm">{streak.mult}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-xl font-black text-white">{athlete.totalPractices}</div>
            <div className="text-white/60 text-sm font-mono tracking-wider">PRACTICES</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0a0518]/80 border border-white/5 text-center">
            <div className="text-xl font-black text-white">{athlete.weekSessions + athlete.weekWeightSessions}/{getWeekTarget(athlete.group)}</div>
            <div className="text-white/60 text-xs font-mono tracking-wider">
              {athlete.weekSessions}🏊 {athlete.weekWeightSessions}🏋️ / {getGroupTargets(athlete.group).pool}+{getGroupTargets(athlete.group).weight}
            </div>
            <div className="text-white/60 text-xs font-mono tracking-wider">THIS WEEK</div>
          </div>
        </div>

        {/* Tab Navigation — two rows for full visibility on mobile */}
        <div className="mb-5 bg-[#0a0518]/50 p-1.5 rounded-xl border border-white/5 space-y-1">
          {[TABS.slice(0, 5), TABS.slice(5)].map((row, ri) => (
            <div key={ri} className="flex gap-0.5">
              {row.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold rounded-lg transition-all relative ${
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
          ))}
        </div>

        {/* ══════════════ DASHBOARD TAB ══════════════ */}
        {tab === "dashboard" && attrs && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#a855f7]/10">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3 text-center">YOUR STRENGTHS</h3>
              <RadarChart values={attrs} />
              <div className="grid grid-cols-5 gap-1 mt-3">
                {ATTRIBUTES.map(a => (
                  <div key={a.key} className="text-center">
                    <div className="text-sm text-white/60">{a.label}</div>
                    <div className="text-xs font-bold" style={{ color: a.color }}>{attrs[a.key as keyof typeof attrs]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">TODAY&apos;S EFFORT</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-[#60a5fa]">{athlete.dailyXP?.pool || 0}</div>
                  <div className="text-sm text-white/60">Pool</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-[#f59e0b]">{athlete.dailyXP?.weight || 0}</div>
                  <div className="text-sm text-white/60">Weight</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-[#ef4444]">{athlete.dailyXP?.meet || 0}</div>
                  <div className="text-sm text-white/60">Meet</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 text-center">
                <span className="text-white/50 text-xs">Streak multiplier: </span>
                <span className="text-[#a855f7] text-sm font-bold">{streakMult}x</span>
              </div>
            </div>

            {athlete.weightStreak > 0 && (
              <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#f59e0b]/10">
                <h3 className="text-white/50 text-xs font-mono tracking-wider mb-2">IRON DISCIPLINE</h3>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-[#f59e0b]">{athlete.weightStreak}</span>
                  <span className="text-white/60 text-xs">sessions · {athlete.weekWeightSessions} this week</span>
                </div>
              </div>
            )}

            {/* Attendance Calendar — last 28 days heatmap */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">YOUR CONSISTENCY — LAST 28 DAYS</h3>
              <div className="grid grid-cols-7 gap-1.5">
                {["S","M","T","W","T","F","S"].map((d,i) => (
                  <div key={i} className="text-center text-white/50 text-xs font-mono">{d}</div>
                ))}
                {(() => {
                  const days = [];
                  const today = new Date();
                  // Start from 27 days ago, align to start of week (Sunday)
                  const start = new Date(today);
                  start.setDate(start.getDate() - 27);
                  // Pad to start of week
                  const padStart = start.getDay();
                  for (let i = 0; i < padStart; i++) days.push(null);
                  for (let i = 0; i < 28; i++) {
                    const d = new Date(start);
                    d.setDate(d.getDate() + i);
                    const dateStr = d.toISOString().slice(0, 10);
                    // Check if athlete practiced on this day (check journal or daily XP)
                    const hadPractice = journal.some(j => j.date === dateStr) ||
                      (athlete.dailyXP?.date === dateStr && (athlete.dailyXP.pool + athlete.dailyXP.weight + athlete.dailyXP.meet) > 0) ||
                      times.some(t => t.date === dateStr);
                    const isToday = dateStr === todayStr;
                    days.push({ date: dateStr, active: hadPractice, isToday, day: d.getDate() });
                  }
                  return days.map((d, i) => {
                    if (!d) return <div key={`pad-${i}`} />;
                    return (
                      <div key={d.date} className={`aspect-square rounded-md flex items-center justify-center text-sm font-mono transition-all ${
                        d.isToday ? "ring-1 ring-[#a855f7]/40" : ""
                      } ${
                        d.active
                          ? "bg-[#a855f7]/30 text-[#a855f7] border border-[#a855f7]/20"
                          : "bg-white/[0.02] text-white/60 border border-white/[0.03]"
                      }`}>
                        {d.day}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-sm font-mono">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#a855f7]/30 border border-[#a855f7]/20" /> Active</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white/[0.02] border border-white/[0.03]" /> <span className="text-white/50">Rest</span></span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ TIMES / PR TAB ══════════════ */}
        {tab === "times" && (
          <div className="space-y-4">
            {/* Log new time */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#00f0ff]/10">
              <h3 className="text-[#00f0ff] text-xs font-mono tracking-wider mb-3 flex items-center gap-2">
                <TimerIcon active={true} /> DROP A TIME
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
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#00f0ff]/30" />
                <button onClick={() => setNewTime(p => ({ ...p, meet: !p.meet }))}
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold border transition-all ${
                    newTime.meet ? "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30" : "bg-white/5 text-white/60 border-white/10"
                  }`}>
                  {newTime.meet ? "MEET TIME" : "PRACTICE"}
                </button>
              </div>
              <input type="text" placeholder="Notes (optional)" value={newTime.notes}
                onChange={e => setNewTime(p => ({ ...p, notes: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#00f0ff]/30 mb-3" />
              <button onClick={saveTime} disabled={!newTime.time}
                className="w-full py-2.5 rounded-lg bg-[#00f0ff]/15 border border-[#00f0ff]/25 text-[#00f0ff] text-sm font-bold disabled:opacity-30 hover:bg-[#00f0ff]/25 transition-all min-h-[44px]">
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
                        {pr.meet && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] font-bold">MEET</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-[#00f0ff] font-mono font-bold">{pr.time}</span>
                        <span className="text-white/50 text-sm block">{pr.date}</span>
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
                          {isPR && <span className="text-xs px-1 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] font-black">PR</span>}
                          {t.meet && <span className="text-xs px-1 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] font-bold">MEET</span>}
                          <span className="text-white/50 text-sm">{t.session.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono text-sm">{t.time}</span>
                          <span className="text-white/50 text-sm">{t.date}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {times.length === 0 && (
              <div className="text-center py-10 text-white/50 text-sm">
                No times logged yet. Add your first time above.
              </div>
            )}
          </div>
        )}

        {/* ══════════════ TIME STANDARDS TAB ══════════════ */}
        {tab === "standards" && athlete && (() => {
          const g = athlete.gender;
          return (
            <div className="space-y-4">
              {/* Course selector */}
              <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#ffd700]/10">
                <h3 className="text-[#ffd700] text-xs font-mono tracking-wider mb-3 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  USA SWIMMING TIME STANDARDS
                </h3>
                <div className="flex gap-1.5 mb-4 p-1 rounded-lg bg-white/[0.03] border border-white/5">
                  {(["SCY", "SCM", "LCM"] as CourseType[]).map(c => (
                    <button key={c} onClick={() => setGoalCourse(c)}
                      className={`flex-1 py-2.5 rounded-md text-sm font-bold transition-all min-h-[44px] ${goalCourse === c ? "bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/30" : "text-white/60 hover:text-white/80"}`}>
                      <div>{c}</div>
                      <div className="text-xs font-normal mt-0.5 opacity-70">{c === "SCY" ? "25yd" : c === "SCM" ? "25m" : "50m"}</div>
                    </button>
                  ))}
                </div>

                {/* Championship Qualifying Cuts */}
                <div className="mb-4">
                  <h4 className="text-white/80 text-sm font-bold mb-2">Championship Qualifying Times</h4>
                  <p className="text-white/50 text-xs mb-3">These are the times needed to qualify for national-level meets</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(["WR", "US_OPEN", "OT", "JR_NATL", "FUTURES", "SECTIONALS"] as StandardLevel[]).map(lv => (
                      <span key={lv} className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: STANDARD_COLORS[lv] + "15", color: STANDARD_COLORS[lv], border: `1px solid ${STANDARD_COLORS[lv]}30` }}>
                        {STANDARD_LABELS[lv]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Standards table by stroke */}
                {STROKES.map(stroke => {
                  const events = EVENTS_BY_COURSE[goalCourse];
                  const hasAnyData = events.some(ev => {
                    const stds = getAllStandards(g, ev, stroke, goalCourse);
                    return Object.keys(stds).length > 0;
                  });
                  if (!hasAnyData) return null;
                  return (
                    <div key={stroke} className="mb-5">
                      <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                        {stroke}
                      </h4>
                      <div className="overflow-x-auto -mx-2 px-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left text-white/60 py-2 pr-2 font-mono">Event</th>
                              {(["B", "BB", "A", "AA", "AAA", "AAAA", "SECTIONALS", "FUTURES", "JR_NATL", "OT", "US_OPEN", "WR"] as StandardLevel[]).map(lv => {
                                const hasCol = events.some(ev => getAllStandards(g, ev, stroke, goalCourse)[lv]);
                                if (!hasCol) return null;
                                return <th key={lv} className="text-center py-2 px-1 font-bold" style={{ color: STANDARD_COLORS[lv] }}>{lv === "JR_NATL" ? "JrNat" : lv === "SECTIONALS" ? "Sect" : lv === "FUTURES" ? "Fut" : lv === "US_OPEN" ? "USO" : lv === "WR" ? "WR" : lv}</th>;
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {events.map(ev => {
                              const stds = getAllStandards(g, ev, stroke, goalCourse);
                              if (!stds || Object.keys(stds).length === 0) return null;
                              const pr = personalRecords.find(p => p.event === ev && p.stroke === stroke);
                              const prSecs = pr ? parseTime(pr.time) : null;
                              return (
                                <tr key={ev} className="border-b border-white/5 hover:bg-white/[0.02]">
                                  <td className="py-2 pr-2 text-white font-bold">{ev}{UNIT_LABEL[goalCourse]}</td>
                                  {(["B", "BB", "A", "AA", "AAA", "AAAA", "SECTIONALS", "FUTURES", "JR_NATL", "OT", "US_OPEN", "WR"] as StandardLevel[]).map(lv => {
                                    const hasCol = events.some(e2 => getAllStandards(g, e2, stroke, goalCourse)[lv]);
                                    if (!hasCol) return null;
                                    const cutTime = stds[lv];
                                    if (!cutTime) return <td key={lv} className="text-center py-2 px-1 text-white/50">—</td>;
                                    const cutSecs = parseTime(cutTime);
                                    const achieved = prSecs && cutSecs ? prSecs <= cutSecs : false;
                                    return (
                                      <td key={lv} className={`text-center py-2 px-1 font-mono ${achieved ? "text-emerald-400 font-bold" : "text-white/80"}`}>
                                        {achieved && <span className="text-emerald-400">✓</span>}
                                        {cutTime}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {/* Florida Gold Coast LSC */}
                {goalCourse === "SCY" && (
                  <div className="mt-6 p-4 rounded-xl bg-[#0a0518]/60 border border-[#00f0ff]/10">
                    <h4 className="text-[#00f0ff] text-xs font-mono tracking-wider mb-3 flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>
                      FL GOLD COAST LSC — SENIOR CHAMPS
                    </h4>
                    <div className="overflow-x-auto -mx-2 px-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-white/60 py-2 pr-2 font-mono">Event</th>
                            {STROKES.map(s => {
                              const fgcTable = g === "M" ? FGC_SCY_BOYS : FGC_SCY_GIRLS;
                              const hasStroke = Object.values(fgcTable).some(ev => ev[s]);
                              if (!hasStroke) return null;
                              return <th key={s} className="text-center py-2 px-1 text-[#00f0ff] font-bold">{s.slice(0, 4)}</th>;
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {EVENTS_BY_COURSE.SCY.map(ev => {
                            const fgcTable = g === "M" ? FGC_SCY_BOYS : FGC_SCY_GIRLS;
                            if (!fgcTable[ev]) return null;
                            return (
                              <tr key={ev} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="py-2 pr-2 text-white font-bold">{ev}y</td>
                                {STROKES.map(s => {
                                  const hasStroke = Object.values(fgcTable).some(e => e[s]);
                                  if (!hasStroke) return null;
                                  const cutTime = fgcTable[ev]?.[s];
                                  if (!cutTime) return <td key={s} className="text-center py-2 px-1 text-white/50">—</td>;
                                  const cutSecs = parseTime(cutTime);
                                  const pr = personalRecords.find(p => p.event === ev && p.stroke === s);
                                  const prSecs = pr ? parseTime(pr.time) : null;
                                  const achieved = prSecs && cutSecs ? prSecs <= cutSecs : false;
                                  return (
                                    <td key={s} className={`text-center py-2 px-1 font-mono ${achieved ? "text-emerald-400 font-bold" : "text-white/80"}`}>
                                      {achieved && "✓"}{cutTime}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-white/60 text-xs mt-2">Qualifying times for Florida Gold Coast Senior Championships</p>
                  </div>
                )}

                {/* Legend */}
                <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                    <span className="text-emerald-400 font-bold">✓ = Achieved</span>
                    <span className="text-white/60">Showing: {g === "M" ? "Boys" : "Girls"} · {goalCourse}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(["B", "BB", "A", "AA", "AAA", "AAAA", "SECTIONALS", "FUTURES", "JR_NATL", "OT"] as StandardLevel[]).map(lv => (
                      <span key={lv} className="text-xs px-1.5 py-0.5 rounded" style={{ color: STANDARD_COLORS[lv], background: STANDARD_COLORS[lv] + "10" }}>
                        {STANDARD_LABELS[lv]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══════════════ GOALS TAB ══════════════ */}
        {tab === "goals" && athlete && (
          <div className="space-y-4">
            {/* Event/Stroke selector */}
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#22c55e]/10">
              <h3 className="text-[#22c55e] text-xs font-mono tracking-wider mb-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#22c55e"/></svg>
                SET YOUR TARGET
              </h3>
              {/* Course selector */}
              <div className="flex gap-1.5 mb-4 p-1 rounded-lg bg-white/[0.03] border border-white/5">
                {(["SCY", "SCM", "LCM"] as CourseType[]).map(c => (
                  <button key={c} onClick={() => {
                    setGoalCourse(c);
                    const courseEvents = EVENTS_BY_COURSE[c];
                    if (!courseEvents.includes(goalEvent)) setGoalEvent(courseEvents[1] || courseEvents[0]);
                  }}
                    className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${goalCourse === c ? "bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30" : "text-white/60 hover:text-white/50"}`}>
                    <div>{c}</div>
                    <div className="text-xs font-normal mt-0.5 opacity-70">{c === "SCY" ? "25yd" : c === "SCM" ? "25m" : "50m"}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <select value={goalEvent} onChange={e => setGoalEvent(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]/30">
                  {EVENTS_BY_COURSE[goalCourse].map(e => <option key={e} value={e}>{e}{UNIT_LABEL[goalCourse]}</option>)}
                </select>
                <select value={goalStroke} onChange={e => setGoalStroke(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#22c55e]/30">
                  {STROKES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Current PR for selected event */}
              {(() => {
                const pr = personalRecords.find(p => p.event === goalEvent && p.stroke === goalStroke);
                const stds = getStandardForAthlete(athlete.gender, goalEvent, goalStroke, goalCourse);
                const prSecs = pr ? parseTime(pr.time) : null;
                const currentLevel = prSecs ? getAthleteCutLevel(athlete.gender, goalEvent, goalStroke, prSecs, goalCourse) : null;
                const nextCut = prSecs ? getNextCut(athlete.gender, goalEvent, goalStroke, prSecs, goalCourse) : null;

                return (
                  <div className="space-y-3">
                    {/* Your PR */}
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm font-mono">YOUR BEST</span>
                        {pr ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[#00f0ff] font-mono font-bold text-lg">{pr.time}</span>
                            {currentLevel && (
                              <span className="text-sm px-2 py-0.5 rounded-full font-black" style={{ background: `${STANDARD_COLORS[currentLevel]}15`, color: STANDARD_COLORS[currentLevel], border: `1px solid ${STANDARD_COLORS[currentLevel]}30` }}>
                                {currentLevel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/50 text-sm">No PR logged</span>
                        )}
                      </div>
                    </div>

                    {/* USA Swimming Standards grid */}
                    {stds && (
                      <div>
                        <h4 className="text-white/60 text-sm font-mono tracking-wider mb-2">USA SWIMMING {goalCourse} ({athlete.gender === "M" ? "BOYS" : "GIRLS"})</h4>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["B", "BB", "A", "AA", "AAA", "AAAA", "SECTIONALS", "FUTURES", "JR_NATL", "OT", "US_OPEN", "WR"] as StandardLevel[]).map(lv => {
                            const cutTime = stds[lv];
                            if (!cutTime) return null;
                            const cutSecs = parseTime(cutTime);
                            const achieved = prSecs && cutSecs ? prSecs <= cutSecs : false;
                            const isNext = nextCut?.level === lv;
                            return (
                              <button key={lv} onClick={() => {
                                if (cutTime && athlete) {
                                  const newGoal = { event: goalEvent, stroke: goalStroke, targetLevel: lv, targetTime: cutTime, course: goalCourse };
                                  const updated = [...savedGoals.filter(g => !(g.event === goalEvent && g.stroke === goalStroke && (g.course || "SCY") === goalCourse)), newGoal];
                                  setSavedGoals(updated);
                                  save(`apex-athlete-goals-${athlete.id}`, updated);
                                }
                              }}
                                className={`p-2.5 rounded-lg border text-center transition-all ${
                                  achieved ? "bg-emerald-500/10 border-emerald-500/20" :
                                  isNext ? "bg-white/5 border-2" : "bg-white/[0.02] border-white/5"
                                }`}
                                style={isNext ? { borderColor: STANDARD_COLORS[lv] + "60" } : {}}>
                                <div className="text-sm font-black" style={{ color: STANDARD_COLORS[lv] }}>{lv}</div>
                                <div className={`font-mono text-sm ${achieved ? "text-emerald-400 line-through" : "text-white"}`}>{cutTime}</div>
                                {achieved && <div className="text-emerald-400 text-xs">ACHIEVED</div>}
                                {isNext && <div className="text-xs font-bold" style={{ color: STANDARD_COLORS[lv] }}>NEXT</div>}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-white/60 text-sm text-center mt-2">Tap a standard to set it as your goal</p>
                      </div>
                    )}

                    {/* Active Goal + Gap Analysis */}
                    {(() => {
                      const activeGoal = savedGoals.find(g => g.event === goalEvent && g.stroke === goalStroke);
                      if (!activeGoal || !prSecs) return null;
                      const targetSecs = parseTime(activeGoal.targetTime);
                      if (!targetSecs) return null;
                      const gap = prSecs - targetSecs;
                      const dist = parseInt(goalEvent);
                      const currentPace = pacePerSplit(prSecs, dist);
                      const targetPace = pacePerSplit(targetSecs, dist);
                      const dailyGoals = generateDailyGoals(prSecs, targetSecs, goalEvent, goalStroke);
                      const progressPct = gap > 0 ? Math.max(0, Math.min(100, ((1 - gap / prSecs) * 100))) : 100;

                      return (
                        <div className="space-y-3">
                          {/* Gap analysis */}
                          <div className="p-4 rounded-xl border" style={{ borderColor: STANDARD_COLORS[activeGoal.targetLevel] + "20", background: STANDARD_COLORS[activeGoal.targetLevel] + "05" }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono font-bold" style={{ color: STANDARD_COLORS[activeGoal.targetLevel] }}>
                                TARGET: {activeGoal.targetLevel} CUT
                              </span>
                              <span className="text-white/60 text-sm">{goalEvent}m {goalStroke}</span>
                            </div>
                            <div className="flex items-center gap-3 mb-3">
                              <div className="text-center">
                                <div className="text-white/60 text-sm">NOW</div>
                                <div className="text-[#00f0ff] font-mono font-bold">{pr?.time}</div>
                              </div>
                              <div className="flex-1">
                                <svg viewBox="0 0 100 8" className="w-full h-2"><rect x="0" y="2" width="100" height="4" rx="2" fill="rgba(255,255,255,0.05)"/><rect x="0" y="2" width={progressPct} height="4" rx="2" fill={STANDARD_COLORS[activeGoal.targetLevel]}/></svg>
                              </div>
                              <div className="text-center">
                                <div className="text-sm" style={{ color: STANDARD_COLORS[activeGoal.targetLevel] }}>GOAL</div>
                                <div className="font-mono font-bold" style={{ color: STANDARD_COLORS[activeGoal.targetLevel] }}>{activeGoal.targetTime}</div>
                              </div>
                            </div>
                            {gap > 0 ? (
                              <div className="text-center text-white/60 text-xs">
                                <span className="text-white font-bold">{fmtTime(gap)}</span> to drop
                              </div>
                            ) : (
                              <div className="text-center text-emerald-400 text-xs font-bold">
                                GOAL ACHIEVED! Set a new target.
                              </div>
                            )}
                          </div>

                          {/* Pace breakdown */}
                          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                            <h4 className="text-white/60 text-sm font-mono mb-2">PACE PER 50</h4>
                            <div className="flex items-center justify-between">
                              <div><span className="text-white/50 text-sm">Current</span><div className="text-white font-mono">{currentPace}</div></div>
                              <svg width="20" height="10" viewBox="0 0 20 10"><path d="M2 5h14M12 1l4 4-4 4" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none"/></svg>
                              <div className="text-right"><span className="text-sm" style={{ color: STANDARD_COLORS[activeGoal.targetLevel] }}>Target</span><div className="font-mono font-bold" style={{ color: STANDARD_COLORS[activeGoal.targetLevel] }}>{targetPace}</div></div>
                            </div>
                          </div>

                          {/* Daily micro-goals */}
                          <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#f59e0b]/10">
                            <h4 className="text-[#f59e0b] text-sm font-mono tracking-wider mb-3">TODAY&apos;S FOCUS</h4>
                            <div className="space-y-2">
                              {dailyGoals.map((goal, i) => (
                                <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02]">
                                  <span className="text-[#f59e0b] text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                                  <span className="text-white/50 text-xs leading-relaxed">{goal}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {!stds && (
                      <div className="text-center py-6 text-white/50 text-sm">
                        No USA Swimming standards available for {goalEvent}m {goalStroke}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* All saved goals */}
            {savedGoals.length > 0 && (
              <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-white/5">
                <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">YOUR ACTIVE GOALS</h3>
                <div className="space-y-2">
                  {savedGoals.map((g, i) => {
                    const pr = personalRecords.find(p => p.event === g.event && p.stroke === g.stroke);
                    const prSecs = pr ? parseTime(pr.time) : null;
                    const targetSecs = parseTime(g.targetTime);
                    const achieved = prSecs && targetSecs ? prSecs <= targetSecs : false;
                    return (
                      <button key={i} onClick={() => { setGoalEvent(g.event); setGoalStroke(g.stroke); }}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${achieved ? "bg-emerald-500/5 border-emerald-500/15" : "bg-white/[0.02] border-white/5 hover:border-white/10"}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-white text-sm font-bold">{g.event}m {g.stroke}</span>
                          <span className="text-sm px-2 py-0.5 rounded-full font-black" style={{ background: `${STANDARD_COLORS[g.targetLevel]}15`, color: STANDARD_COLORS[g.targetLevel] }}>
                            {achieved ? "ACHIEVED" : g.targetLevel}
                          </span>
                        </div>
                        <div className="text-white/60 text-xs mt-1">
                          {pr ? `${pr.time} → ${g.targetTime}` : `Target: ${g.targetTime}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
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
              <p className="text-white/50 text-sm mb-4">Plan your race. Visualize every split. Race with confidence.</p>

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
                  <label className="text-white/60 text-sm font-mono block mb-1">CURRENT BEST</label>
                  <input type="text" placeholder="1:05.30" value={rpCurrent}
                    onChange={e => setRpCurrent(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#ef4444]/30" />
                </div>
                <div>
                  <label className="text-white/60 text-sm font-mono block mb-1">GOAL TIME</label>
                  <input type="text" placeholder="1:02.00" value={rpGoal}
                    onChange={e => setRpGoal(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#ef4444]/30" />
                </div>
              </div>
              <button onClick={generateRacePrep} disabled={!rpCurrent || !rpGoal}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#ef4444]/20 to-[#f59e0b]/20 border border-[#ef4444]/25 text-white text-sm font-bold disabled:opacity-30 hover:border-[#ef4444]/40 transition-all min-h-[44px]">
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
                  <div className="text-white/60 text-sm">You&apos;ve got this. Visualize every split.</div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {rpResult.splits.map((sp, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 items-center py-2 px-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
                      <span className="text-[#00f0ff] font-mono font-bold">{sp.segment}</span>
                      <span className="text-white font-bold">{sp.time}</span>
                      <span className="text-white/60 font-mono">{sp.pace}</span>
                      <span className="text-white/60 text-sm">{sp.focus}</span>
                    </div>
                  ))}
                </div>

                <h4 className="text-[#f59e0b] text-sm font-mono tracking-wider mb-2">RACE TIPS</h4>
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
                        <span className="text-white/50 text-sm">{rp.date}</span>
                      </div>
                      <div className="text-white/60 text-xs mt-1">{rp.currentTime} → {rp.goalTime} ({rp.improvement}% drop)</div>
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
                        <span className={`text-sm px-1.5 py-0.5 rounded-full border ${CAT_COLORS[q.cat] || ""}`}>{q.cat}</span>
                      </div>
                      <p className="text-white/60 text-xs">{q.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[#f59e0b] text-sm font-bold">+{q.xp}</div>
                      <div className={`text-sm font-mono ${status === "done" ? "text-emerald-400" : status === "active" ? "text-[#a855f7]" : "text-white/50"}`}>
                        {status === "done" ? "COMPLETE" : status === "active" ? "ACTIVE" : "LOCKED"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-white/50 text-sm text-center mt-4">Quests are assigned and approved by your coach</p>
          </div>
        )}

        {/* ══════════════ JOURNAL TAB ══════════════ */}
        {tab === "journal" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0a0518]/80 border border-[#a855f7]/10">
              <h3 className="text-white/50 text-xs font-mono tracking-wider mb-3">HOW&apos;D IT GO TODAY?</h3>
              <div className="flex items-center gap-1 mb-4 justify-center">
                {[1, 2, 3, 4, 5].map(m => (
                  <button key={m} onClick={() => setJournalDraft(d => ({ ...d, mood: m }))}
                    className={`w-10 h-10 rounded-lg border text-lg transition-all ${
                      journalDraft.mood === m ? "border-[#a855f7]/40 bg-[#a855f7]/10 scale-110" : "border-white/5 opacity-30"
                    }`}>
                    {m === 1 ? "😞" : m === 2 ? "😤" : m === 3 ? "😐" : m === 4 ? "😊" : "🔥"}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-white/60 text-sm font-mono block mb-1">WINS TODAY</label>
                  <textarea value={journalDraft.wentWell} onChange={e => setJournalDraft(d => ({ ...d, wentWell: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#a855f7]/30 resize-none"
                    rows={2} placeholder="I nailed my flip turns today..." />
                </div>
                <div>
                  <label className="text-white/60 text-sm font-mono block mb-1">WHAT I&apos;LL WORK ON</label>
                  <textarea value={journalDraft.workOn} onChange={e => setJournalDraft(d => ({ ...d, workOn: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#a855f7]/30 resize-none"
                    rows={2} placeholder="Need to focus on breathing pattern..." />
                </div>
                <div>
                  <label className="text-white/60 text-sm font-mono block mb-1">MY GOALS</label>
                  <textarea value={journalDraft.goals} onChange={e => setJournalDraft(d => ({ ...d, goals: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#a855f7]/30 resize-none"
                    rows={2} placeholder="Drop 2 seconds on my 100 free..." />
                </div>
                <button onClick={saveJournalEntry}
                  disabled={!journalDraft.wentWell && !journalDraft.workOn && !journalDraft.goals}
                  className="w-full py-2.5 rounded-lg bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#a855f7] text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#a855f7]/30 transition-all min-h-[44px]">
                  Save Reflection
                </button>
              </div>
            </div>

            {journal.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-white/60 text-xs font-mono">PAST ENTRIES</h3>
                {journal.slice(0, 7).map((j, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[#0a0518]/50 border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/60 text-sm font-mono">{j.date}</span>
                      <span className="text-sm">{j.mood === 1 ? "😞" : j.mood === 2 ? "😤" : j.mood === 3 ? "😐" : j.mood === 4 ? "😊" : "🔥"}</span>
                    </div>
                    {j.wentWell && <p className="text-white/60 text-sm"><span className="text-emerald-400/80">✓</span> {j.wentWell}</p>}
                    {j.workOn && <p className="text-white/60 text-sm"><span className="text-[#f59e0b]/80">→</span> {j.workOn}</p>}
                    {j.goals && <p className="text-white/60 text-sm"><span className="text-[#a855f7]/80">★</span> {j.goals}</p>}
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
                <p className="text-white/50 text-sm">No feedback yet</p>
                <p className="text-white/60 text-sm mt-1">Your coach will send feedback after practices and meets</p>
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
                          <span className={`text-sm font-mono font-bold tracking-wider ${style.labelColor}`}>{style.label}</span>
                          {!f.read && <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />}
                        </div>
                        <span className="text-white/50 text-sm">{f.date}</span>
                      </div>
                      <p className="text-white/60 text-sm">{f.message}</p>
                      <p className="text-white/50 text-sm mt-1.5">— {f.from}</p>
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white/50 text-xs font-mono tracking-wider">{athlete.gender === "F" ? "GIRLS" : "BOYS"} LEADERBOARD</h3>
              <span className="text-white/50 text-sm font-mono">Your rank: <span className="text-[#a855f7] font-bold">#{athleteRank}</span> of {leaderboard.length}</span>
            </div>
            {leaderboard.map((a, i) => {
              const lv = getLevel(a.xp);
              const isMe = a.id === athlete.id;
              const rank = i + 1;
              return (
                <div key={a.id} id={isMe ? "my-rank" : undefined}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isMe ? "bg-[#a855f7]/15 border-[#a855f7]/30 shadow-[0_0_20px_rgba(168,85,247,0.15)] ring-1 ring-[#a855f7]/20" : "bg-[#0a0518]/50 border-white/5"
                  }`}>
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black ${
                    rank === 1 ? "bg-[#f59e0b]/20 text-[#f59e0b]" : rank === 2 ? "bg-white/10 text-white/50" : rank === 3 ? "bg-[#cd7f32]/20 text-[#cd7f32]" : "bg-white/5 text-white/50"
                  }`}>
                    {rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold truncate block ${isMe ? "text-white" : "text-white/60"}`}>
                      {a.name} {isMe && <span className="text-[#a855f7] text-sm ml-1 px-1.5 py-0.5 rounded bg-[#a855f7]/15 border border-[#a855f7]/25 animate-pulse">YOU</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span style={{ color: lv.color }} className="text-xs">{lv.icon}</span>
                    <span className="text-white/60 text-xs font-mono">{a.xp} XP</span>
                    {a.streak >= 3 && <span className="text-sm text-[#ef4444]">{a.streak}d</span>}
                  </div>
                </div>
              );
            })}
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
                      <span className="text-white/60 text-sm font-mono tracking-wider">{metric.label}</span>
                      <span className="text-lg">{metric.emoji[wellnessCheckin[metric.key] - 1]}</span>
                    </div>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(v => (
                        <button key={v} onClick={() => setWellnessCheckin(prev => ({...prev, [metric.key]: v}))}
                          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                            wellnessCheckin[metric.key] >= v
                              ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                              : "bg-white/5 text-white/50 border border-white/5"
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
                      <span className="text-white/60 text-sm font-mono tracking-wider">READINESS SCORE</span>
                      <div className={`text-3xl font-black mt-1 ${readiness >= 80 ? "text-emerald-400" : readiness >= 60 ? "text-amber-400" : "text-red-400"}`}>
                        {readiness}%
                      </div>
                      <span className="text-white/60 text-sm">
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
              <p className="text-white/60 text-sm mb-3">4 seconds in · 4 hold · 4 out · 4 hold. Calms your nervous system before races.</p>
              <div className="flex flex-col items-center">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center border-2 transition-all duration-1000 ${
                  breathPhase === "idle" ? "border-white/10" :
                  breathPhase === "inhale" ? "border-cyan-400 scale-110 bg-cyan-500/10" :
                  breathPhase === "hold" ? "border-amber-400 bg-amber-500/5" :
                  "border-indigo-400 scale-90 bg-indigo-500/10"
                }`}>
                  <div className="text-center">
                    <div className="text-2xl font-black text-white">{breathPhase === "idle" ? "—" : breathTimer}</div>
                    <div className={`text-sm font-mono tracking-wider mt-1 ${
                      breathPhase === "idle" ? "text-white/60" :
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
                {breathCount > 0 && <span className="text-white/50 text-sm mt-2">{breathCount} cycles completed</span>}
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
                            <span className="text-white/60 text-sm">{med.desc}</span>
                          </div>
                        </div>
                        <span className="text-white/50 text-sm font-mono">{med.duration}</span>
                      </div>
                    </button>
                    {activeMeditation === med.id && (
                      <div className="mt-2 ml-4 space-y-2 animate-[fadeIn_0.3s_ease-out]">
                        {med.steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-violet-500/5">
                            <span className="text-violet-400/70 text-xs font-mono w-4 shrink-0">{i + 1}</span>
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

        {/* ── MEETS TAB ── */}
        {tab === "meets" && (() => {
          const meets: MeetData[] = (() => { try { return JSON.parse(localStorage.getItem("apex-meets-v1") || "[]"); } catch { return []; } })();
          const myMeets = meets.filter(m => m.status !== "completed" && m.events?.some(e => e.entries?.some(en => en.athleteId === athlete.id)));
          const myRsvpMeets = meets.filter(m => m.status !== "completed" && (m.rsvps?.[athlete.id] !== undefined || m.events?.some(e => e.entries?.some(en => en.athleteId === athlete.id))));
          const allUpcoming = myMeets.length > 0 ? myMeets : myRsvpMeets;

          return (
            <div className="space-y-4">
              <h3 className="text-white/50 text-xs font-mono tracking-wider">YOUR UPCOMING MEETS</h3>

              {allUpcoming.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#0a0518]/80 border border-white/5 text-center">
                  <MeetsIcon active={false} />
                  <p className="text-white/60 text-sm mt-3">No upcoming meets yet</p>
                  <p className="text-white/50 text-xs mt-1">Your coach will add you to meets as they come up</p>
                </div>
              ) : (
                allUpcoming.map(meet => {
                  const myEvents = meet.events?.filter(e => e.entries?.some(en => en.athleteId === athlete.id)) || [];
                  const myRsvp = meet.rsvps?.[athlete.id] || "pending";
                  const meetDate = new Date(meet.date + "T00:00:00");
                  const daysUntil = Math.ceil((meetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const rsvpDeadline = meet.rsvpDeadline ? new Date(meet.rsvpDeadline + "T00:00:00") : null;
                  const rsvpExpired = rsvpDeadline ? Date.now() > rsvpDeadline.getTime() : false;

                  return (
                    <div key={meet.id} className="p-4 rounded-2xl bg-[#0a0518]/80 border border-[#00f0ff]/10">
                      {/* Meet header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-white font-bold text-lg">{meet.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-white/60 text-xs">{meetDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                            <span className="text-white/50">·</span>
                            <span className="text-white/60 text-xs">{meet.location}</span>
                            <span className="text-white/50">·</span>
                            <span className="text-[#00f0ff]/80 text-xs font-mono">{meet.course}</span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                          daysUntil <= 3 ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                          daysUntil <= 7 ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                          "bg-[#00f0ff]/10 text-[#00f0ff]/90 border border-[#00f0ff]/20"
                        }`}>
                          {daysUntil <= 0 ? "TODAY" : daysUntil === 1 ? "TOMORROW" : `${daysUntil} DAYS`}
                        </div>
                      </div>

                      {/* My events */}
                      {myEvents.length > 0 && (
                        <div className="mb-3">
                          <span className="text-white/60 text-sm font-mono tracking-wider block mb-2">YOUR EVENTS</span>
                          <div className="space-y-1.5">
                            {myEvents.map(ev => {
                              const myEntry = ev.entries?.find(en => en.athleteId === athlete.id);
                              return (
                                <div key={ev.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                                  <span className="text-white/70 text-sm font-medium">{ev.name}</span>
                                  {myEntry?.seedTime && (
                                    <span className="text-[#00f0ff]/80 text-xs font-mono">{myEntry.seedTime}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* RSVP status */}
                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <span className="text-white/60 text-sm font-mono">RSVP:</span>
                        <span className={`px-2 py-0.5 rounded text-sm font-bold ${
                          myRsvp === "committed" ? "bg-emerald-500/15 text-emerald-400" :
                          myRsvp === "declined" ? "bg-red-500/15 text-red-400" :
                          "bg-amber-500/15 text-amber-400"
                        }`}>
                          {myRsvp === "committed" ? "COMMITTED" : myRsvp === "declined" ? "DECLINED" : "PENDING"}
                        </span>
                        {rsvpDeadline && !rsvpExpired && myRsvp === "pending" && (
                          <span className="text-white/50 text-sm">Deadline: {rsvpDeadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        )}
                      </div>

                      {/* Broadcasts */}
                      {meet.broadcasts && meet.broadcasts.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <span className="text-white/60 text-sm font-mono tracking-wider block mb-2">COACH UPDATES</span>
                          {meet.broadcasts.slice(-2).map(b => (
                            <div key={b.id} className="p-2 rounded-lg bg-[#00f0ff]/5 border border-[#00f0ff]/10 mb-1.5">
                              <p className="text-white/50 text-sm">{b.message}</p>
                              <span className="text-white/50 text-sm">{new Date(b.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })()}

        {/* Footer */}
        <div className="text-center mt-10 text-white/[0.06] text-sm space-y-1">
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
