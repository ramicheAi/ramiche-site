// ── Utility Functions ─────────────────────────────────────────────────

import type { Athlete } from "./types";
import { LEVELS, POOL_CPS, DIVING_CPS, WATERPOLO_CPS } from "./constants";

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── Game Engine ─────────────────────────────────────────────────────

export function getLevel(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(xp: number) {
  for (const lv of LEVELS) {
    if (xp < lv.xp) return lv;
  }
  return null;
}

export function getLevelProgress(xp: number) {
  const cur = getLevel(xp);
  const nxt = getNextLevel(xp);
  if (!nxt) return { percent: 100, remaining: 0 };
  const range = nxt.xp - cur.xp;
  const prog = xp - cur.xp;
  return {
    percent: Math.min(100, Math.round((prog / range) * 100)),
    remaining: nxt.xp - xp,
  };
}

export function getStreakMult(s: number) {
  if (s >= 60) return 2.5;
  if (s >= 30) return 2.0;
  if (s >= 14) return 1.75;
  if (s >= 7) return 1.5;
  if (s >= 3) return 1.25;
  return 1.0;
}

export function getWeightStreakMult(s: number) {
  if (s >= 7) return 1.5;
  if (s >= 3) return 1.25;
  return 1.0;
}

export function fmtStreak(s: number) {
  if (s >= 60) return { label: "MYTHIC", mult: "2.5x", tier: 5 };
  if (s >= 30) return { label: "LEGENDARY", mult: "2.0x", tier: 4 };
  if (s >= 14) return { label: "GOLD", mult: "1.75x", tier: 3 };
  if (s >= 7) return { label: "SILVER", mult: "1.5x", tier: 2 };
  if (s >= 3) return { label: "BRONZE", mult: "1.25x", tier: 1 };
  return { label: "STARTER", mult: "1.0x", tier: 0 };
}

export function fmtWStreak(s: number) {
  if (s >= 7) return { label: "IRON", mult: "1.5x", tier: 2 };
  if (s >= 3) return { label: "STEEL", mult: "1.25x", tier: 1 };
  return { label: "START", mult: "1.0x", tier: 0 };
}

// ── Checkpoint Helpers ──────────────────────────────────────────────

export function getCPsForSport(sport: string) {
  if (sport === "diving") return DIVING_CPS;
  if (sport === "waterpolo") return WATERPOLO_CPS;
  return POOL_CPS;
}

// ── Schedule Helpers ───────────────────────────────────────────────

export function makeDefaultSession(
  type: "pool" | "weight" | "dryland",
  groupId: string
) {
  const defaults = {
    pool: { label: "Pool Practice", start: "15:30", end: "17:30", location: "Main Pool" },
    weight: { label: "Weight Room", start: "17:30", end: "18:30", location: "Weight Room" },
    dryland: { label: "Dryland", start: "15:00", end: "15:30", location: "Pool Deck" },
  };
  const d = defaults[type];
  // Platinum gets later weight room time
  if (type === "weight" && groupId === "platinum") {
    return {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: d.label,
      startTime: "17:30",
      endTime: "18:30",
      location: d.location,
      notes: "",
    };
  }
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: d.label,
    startTime: d.start,
    endTime: d.end,
    location: d.location,
    notes: "",
  };
}

export function makeDefaultGroupSchedule(groupId: string) {
  const isPlatinum = groupId === "platinum";
  const emptyDay = () => ({ template: "rest-day", sessions: [] });

  const poolDay = (template: string) => {
    const sessions = [
      {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "pool",
        label: "Pool Practice",
        startTime: "15:30",
        endTime: "17:30",
        location: "Main Pool",
        notes: "",
      },
    ];
    if (isPlatinum) {
      sessions.push({
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}w`,
        type: "weight",
        label: "Weight Room",
        startTime: "17:30",
        endTime: "18:30",
        location: "Weight Room",
        notes: "",
      });
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
      Sat: {
        template: "meet-day",
        sessions: [
          {
            id: `s-${Date.now()}-sat`,
            type: "pool",
            label: isPlatinum ? "Meet / Optional Practice" : "Optional Practice",
            startTime: "08:00",
            endTime: "10:00",
            location: "Main Pool",
            notes: "Meets or optional practice",
          },
        ],
      },
      Sun: emptyDay(),
    },
  };
}

// ── Storage Helpers ────────────────────────────────────────────────

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    try {
      return JSON.parse(v);
    } catch {
      return v as unknown as T;
    }
  } catch {
    return fallback;
  }
}

export function save(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Roster Helpers ────────────────────────────────────────────────

// Practice sessions per week by roster group (derived from real schedules)
const WEEK_TARGETS: Record<string, number> = {
  platinum: 8,   // Mon AM+PM, Tue PM, Wed AM+PM, Thu PM, Fri AM, Sat
  gold: 6,       // Mon-Fri + Sat
  silver: 6,     // Mon-Fri + Sat
  bronze1: 6,    // Mon-Sat (6 days)
  bronze2: 4,    // Tue, Thu, Fri, Sat
  diving: 4,     // Mon, Wed, Fri, Sat
  waterpolo: 4,  // Mon-Thu
};

export function getWeekTarget(group: string): number {
  const key = group.toLowerCase().replace(/\s+/g, "").replace("bronze 1", "bronze1").replace("bronze 2", "bronze2").replace("water polo", "waterpolo");
  return WEEK_TARGETS[key] ?? 5;
}

export function makeAthlete(r: {
  name: string;
  age: number;
  gender: "M" | "F";
  group?: string;
}): Athlete {
  const group = r.group ?? "Varsity";
  return {
    id: r.name.toLowerCase().replace(/\s+/g, "-"),
    name: r.name,
    age: r.age,
    gender: r.gender,
    group,
    xp: 0,
    streak: 0,
    weightStreak: 0,
    lastStreakDate: "",
    lastWeightStreakDate: "",
    totalPractices: 0,
    weekSessions: 0,
    weekWeightSessions: 0,
    weekTarget: getWeekTarget(group),
    checkpoints: {},
    weightCheckpoints: {},
    meetCheckpoints: {},
    weightChallenges: {},
    quests: {},
    dailyXP: { date: today(), pool: 0, weight: 0, meet: 0 },
  };
}