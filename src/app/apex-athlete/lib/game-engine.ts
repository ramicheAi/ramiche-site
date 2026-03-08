// ── Apex Athlete — Shared Game Engine ─────────────────────
// Single source of truth for levels, XP, streaks, multipliers.
// NOW DEPRECATED: Use sport-config.ts and sport-constants.ts for sport-aware definitions

import { getSportConfig } from "./sport-config";

// Keep for backward compatibility during migration
export const LEVELS = [
  { name: "Rookie", xp: 0, icon: "🌱", color: "#94a3b8", gradient: "from-slate-400 to-slate-300" },
  { name: "Contender", xp: 300, icon: "⚡", color: "#a78bfa", gradient: "from-violet-400 to-purple-300" },
  { name: "Warrior", xp: 600, icon: "🔥", color: "#60a5fa", gradient: "from-blue-400 to-cyan-300" },
  { name: "Elite", xp: 1000, icon: "💎", color: "#f59e0b", gradient: "from-amber-400 to-yellow-300" },
  { name: "Captain", xp: 1500, icon: "⭐", color: "#f97316", gradient: "from-orange-400 to-amber-300" },
  { name: "Legend", xp: 2500, icon: "👑", color: "#ef4444", gradient: "from-red-500 to-orange-400" },
] as const;

export type Level = (typeof LEVELS)[number];

// Sport-aware versions (returns SportLevel)
export function getLevel(xp: number, sport = "swimming"): { name: string; xpThreshold: number; color: string; icon: string } {
  const levels = getSportConfig(sport).levels;
  for (let i = levels.length - 1; i >= 0; i--) if (xp >= levels[i].xpThreshold) return levels[i];
  return levels[0];
}

export function getNextLevel(xp: number, sport = "swimming"): { name: string; xpThreshold: number; color: string; icon: string } | null {
  const levels = getSportConfig(sport).levels;
  for (const lv of levels) if (xp < lv.xpThreshold) return lv;
  return null;
}

// Backward compatibility layer (deprecated)
export function getLevelLegacy(xp: number): Level {
  return getLevel(xp, "swimming") as unknown as Level;
}

export function getNextLevelLegacy(xp: number): Level | null {
  const result = getNextLevel(xp, "swimming");
  return result as unknown as Level | null;
}

export function getLevelProgress(xp: number, sport = "swimming") {
  const cur = getLevel(xp, sport), nxt = getNextLevel(xp, sport);
  if (!nxt) return { percent: 100, remaining: 0 };
  const range = nxt.xpThreshold - cur.xpThreshold, prog = xp - cur.xpThreshold;
  return { percent: Math.min(100, Math.round((prog / range) * 100)), remaining: nxt.xpThreshold - xp };
}

export function getStreakMult(s: number) {
  if (s >= 60) return 2.5; if (s >= 30) return 2.0; if (s >= 14) return 1.75;
  if (s >= 7) return 1.5; if (s >= 3) return 1.25; return 1.0;
}

export function getWeightStreakMult(s: number) {
  if (s >= 7) return 1.5; if (s >= 3) return 1.25; return 1.0;
}

export function fmtStreak(s: number) {
  if (s >= 60) return { label: "MYTHIC", mult: "2.5x", tier: 5, color: "#ef4444" };
  if (s >= 30) return { label: "LEGENDARY", mult: "2.0x", tier: 4, color: "#f59e0b" };
  if (s >= 14) return { label: "GOLD", mult: "1.75x", tier: 3, color: "#eab308" };
  if (s >= 7) return { label: "SILVER", mult: "1.5x", tier: 2, color: "#94a3b8" };
  if (s >= 3) return { label: "BRONZE", mult: "1.25x", tier: 1, color: "#cd7f32" };
  return { label: "STARTER", mult: "1.0x", tier: 0, color: "#475569" };
}

export function fmtWStreak(s: number) {
  if (s >= 7) return { label: "IRON", mult: "1.5x", tier: 2 };
  if (s >= 3) return { label: "STEEL", mult: "1.25x", tier: 1 };
  return { label: "START", mult: "1.0x", tier: 0 };
}
