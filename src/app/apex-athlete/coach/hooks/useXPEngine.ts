"use client";

import { useState, useCallback, useRef } from "react";
import { getLevel, getStreakMult, getWeightStreakMult } from "../../lib/game-engine";
import type { AchievementToast } from "../components/AchievementToasts";

// ── types ────────────────────────────────────────────────────
interface DailyXP { date: string; pool: number; weight: number; meet: number; }

interface Athlete {
  id: string; name: string; age: number; gender: "M" | "F"; group: string;
  xp: number; seasonXP?: number; streak: number; weightStreak: number;
  lastStreakDate: string; lastWeightStreakDate: string;
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
  pin?: string;
}

const DAILY_XP_CAP = 150;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── ROSTER_GROUPS (needed for sport detection) ──────────────
const ROSTER_GROUPS = [
  { id: "platinum", sport: "swimming" },
  { id: "gold", sport: "swimming" },
  { id: "silver", sport: "swimming" },
  { id: "bronze1", sport: "swimming" },
  { id: "bronze2", sport: "swimming" },
  { id: "diving", sport: "diving" },
  { id: "waterpolo", sport: "waterpolo" },
] as const;

function getSportForAthlete(athlete: { group: string }): string {
  const groupDef = ROSTER_GROUPS.find(g => g.id === athlete.group);
  return groupDef?.sport || "swimming";
}

// ── pool checkpoints (needed for perfect practice check) ────
const POOL_CP_IDS = [
  "on-deck-early", "gear-ready", "on-time-ready", "warmup-complete",
  "main-set-effort", "technique-focus", "kick-set", "cool-down",
  "coach-feedback", "positive-energy", "practice-complete",
];

// ── hook ─────────────────────────────────────────────────────

export interface XPEngineState {
  levelUpName: string | null;
  levelUpLevel: string;
  levelUpIcon: string;
  levelUpColor: string;
  levelUpExiting: boolean;
  xpFloats: { id: string; xp: number; x: number; y: number }[];
  achieveToasts: AchievementToast[];
  comboCount: number;
  comboExiting: boolean;
}

export interface XPEngineActions {
  awardXP: (athlete: Athlete, xpBase: number, category: "pool" | "weight" | "meet") => { newAthlete: Athlete; awarded: number };
  checkAchievements: (athlete: Athlete, cpId: string) => void;
  spawnXpFloat: (xp: number, e?: React.MouseEvent) => void;
  incrementCombo: () => void;
  checkLevelUp: (oldXP: number, newXP: number, athleteObj: { name: string; group: string }) => void;
}

export function useXPEngine(): XPEngineState & XPEngineActions {
  // ── level-up state ──────────────────────────────────────
  const [levelUpName, setLevelUpName] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState("");
  const [levelUpIcon, setLevelUpIcon] = useState("");
  const [levelUpColor, setLevelUpColor] = useState("");
  const [levelUpExiting, setLevelUpExiting] = useState(false);

  // ── XP float state ──────────────────────────────────────
  const [xpFloats, setXpFloats] = useState<{ id: string; xp: number; x: number; y: number }[]>([]);
  const floatCounter = useRef(0);

  // ── achievement toast state ─────────────────────────────
  const [achieveToasts, setAchieveToasts] = useState<AchievementToast[]>([]);
  const achieveIdRef = useRef(0);

  // ── combo counter state ─────────────────────────────────
  const [comboCount, setComboCount] = useState(0);
  const [comboExiting, setComboExiting] = useState(false);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── level-up triumphant sound (Web Audio API) ───────────
  const playLevelUpSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.5);
      });
      [1046.5, 1318.5, 1568.0].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + 0.5);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.55);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + 0.5); osc.stop(now + 1.6);
      });
    } catch { /* silent fail if audio unavailable */ }
  }, []);

  // ── checkLevelUp ────────────────────────────────────────
  const checkLevelUp = useCallback((oldXP: number, newXP: number, athleteObj: { name: string; group: string }) => {
    const oldLv = getLevel(oldXP, getSportForAthlete(athleteObj));
    const newLv = getLevel(newXP, getSportForAthlete(athleteObj));
    if (newLv.name !== oldLv.name) {
      setLevelUpName(athleteObj.name);
      setLevelUpLevel(newLv.name);
      setLevelUpIcon(newLv.icon);
      setLevelUpColor(newLv.color);
      setLevelUpExiting(false);
      playLevelUpSound();
      if (navigator.vibrate) navigator.vibrate([50, 30, 80, 30, 120, 50, 80]);
      setTimeout(() => { setLevelUpExiting(true); }, 3500);
      setTimeout(() => { setLevelUpName(null); setLevelUpExiting(false); }, 4000);
    }
  }, [playLevelUpSound]);

  // ── spawnAchievement ────────────────────────────────────
  const spawnAchievement = useCallback((title: string, desc: string, icon: string, color: string) => {
    const id = `ach-${achieveIdRef.current++}`;
    setAchieveToasts(prev => [...prev, { id, title, desc, icon, color, exiting: false }]);
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.frequency.value = 1320; osc2.type = "sine";
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
      gain2.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime + 0.1); osc2.stop(ctx.currentTime + 0.5);
    } catch {}
    if (navigator.vibrate) navigator.vibrate([30, 20, 50]);
    setTimeout(() => setAchieveToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t)), 3200);
    setTimeout(() => setAchieveToasts(prev => prev.filter(t => t.id !== id)), 3600);
  }, []);

  // ── checkAchievements ───────────────────────────────────
  const checkAchievements = useCallback((athlete: Athlete, cpId: string) => {
    const totalChecked = Object.values(athlete.checkpoints).filter(Boolean).length +
      Object.values(athlete.weightCheckpoints).filter(Boolean).length +
      Object.values(athlete.meetCheckpoints).filter(Boolean).length;
    if (totalChecked === 1) {
      spawnAchievement("First Check-In", `${athlete.name} is on the board!`, "🎯", "#60a5fa");
    }
    const streakMilestones = [5, 10, 25, 50, 100];
    if (cpId === "practice-complete" && athlete.lastStreakDate !== today()) {
      const newStreak = athlete.streak + 1;
      if (streakMilestones.includes(newStreak)) {
        spawnAchievement(`${newStreak}-Day Streak`, `${athlete.name} is on fire!`, "🔥", "#f97316");
      }
    }
    if (cpId === "practice-complete") {
      const newTotal = athlete.totalPractices + 1;
      const practiceMilestones = [10, 25, 50, 100, 200, 500];
      if (practiceMilestones.includes(newTotal)) {
        spawnAchievement(`${newTotal} Practices`, `${athlete.name} — dedicated!`, "💪", "#a78bfa");
      }
    }
    const xpMilestones = [100, 250, 500, 1000, 2000, 5000];
    for (const m of xpMilestones) {
      if (athlete.xp < m) break;
      if (athlete.xp >= m && athlete.xp - m < DAILY_XP_CAP) {
        spawnAchievement(`${m} XP`, `${athlete.name} hit ${m.toLocaleString()} XP!`, "⚡", "#f59e0b");
        break;
      }
    }
    const allPool = POOL_CP_IDS.every(cpid => athlete.checkpoints[cpid]);
    if (allPool) {
      spawnAchievement("Perfect Practice", `${athlete.name} — every box checked!`, "⭐", "#f59e0b");
    }
    if (cpId === "m-pr") {
      spawnAchievement("New PR!", `${athlete.name} set a personal best!`, "🏆", "#f59e0b");
    }
    if (cpId === "m-team-record") {
      spawnAchievement("Team Record!", `${athlete.name} made history!`, "👑", "#ef4444");
    }
  }, [spawnAchievement]);

  // ── spawnXpFloat ────────────────────────────────────────
  const spawnXpFloat = useCallback((xp: number, e?: React.MouseEvent) => {
    if (xp <= 0) return;
    const id = `f-${floatCounter.current++}`;
    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY : window.innerHeight / 2;
    setXpFloats(prev => [...prev, { id, xp, x, y }]);
    setTimeout(() => setXpFloats(prev => prev.filter(f => f.id !== id)), 1100);
  }, []);

  // ── awardXP ─────────────────────────────────────────────
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
    a.seasonXP = (a.seasonXP || 0) + awarded;
    a.dailyXP[category] += awarded;
    checkLevelUp(oldXP, a.xp, a);
    return { newAthlete: a, awarded };
  }, [checkLevelUp]);

  // ── incrementCombo ──────────────────────────────────────
  const incrementCombo = useCallback(() => {
    if (comboResetRef.current) clearTimeout(comboResetRef.current);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    setComboExiting(false);
    setComboCount(prev => {
      const next = prev + 1;
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
    comboResetRef.current = setTimeout(() => {
      setComboExiting(true);
      comboTimerRef.current = setTimeout(() => { setComboCount(0); setComboExiting(false); }, 400);
    }, 2000);
  }, []);

  return {
    levelUpName, levelUpLevel, levelUpIcon, levelUpColor, levelUpExiting,
    xpFloats, achieveToasts, comboCount, comboExiting,
    awardXP, checkAchievements, spawnXpFloat, incrementCombo, checkLevelUp,
  };
}
