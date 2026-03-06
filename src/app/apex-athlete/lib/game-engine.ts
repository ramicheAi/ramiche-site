// ── Apex Athlete — Shared Game Engine ─────────────────────
// Single source of truth for levels, XP, streaks, multipliers.

export const LEVELS = [
  { name: "Rookie", xp: 0, icon: "🌱", color: "#94a3b8", gradient: "from-slate-400 to-slate-300" },
  { name: "Contender", xp: 300, icon: "⚡", color: "#a78bfa", gradient: "from-violet-400 to-purple-300" },
  { name: "Warrior", xp: 600, icon: "🔥", color: "#60a5fa", gradient: "from-blue-400 to-cyan-300" },
  { name: "Elite", xp: 1000, icon: "💎", color: "#f59e0b", gradient: "from-amber-400 to-yellow-300" },
  { name: "Captain", xp: 1500, icon: "⭐", color: "#f97316", gradient: "from-orange-400 to-amber-300" },
  { name: "Legend", xp: 2500, icon: "👑", color: "#ef4444", gradient: "from-red-500 to-orange-400" },
] as const;

export type Level = (typeof LEVELS)[number];

export function getLevel(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) if (xp >= LEVELS[i].xp) return LEVELS[i];
  return LEVELS[0];
}

export function getNextLevel(xp: number): Level | null {
  for (const lv of LEVELS) if (xp < lv.xp) return lv;
  return null;
}

export function getLevelProgress(xp: number) {
  const cur = getLevel(xp), nxt = getNextLevel(xp);
  if (!nxt) return { percent: 100, remaining: 0 };
  const range = nxt.xp - cur.xp, prog = xp - cur.xp;
  return { percent: Math.min(100, Math.round((prog / range) * 100)), remaining: nxt.xp - xp };
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
