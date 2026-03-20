/**
 * Apex Athlete Storage Service
 * Single abstraction for all localStorage operations.
 * Built-in guards: zero-XP protection, versioned keys, type-safe access.
 */

/* ── Key Registry ── */
export const KEYS = {
  ROSTER: "apex-athlete-roster-v5",
  SNAPSHOTS: "apex-athlete-snapshots-v2",
  AUDIT: "apex-athlete-audit-v2",
  MEETS: "apex-athlete-meets-v2",
  AUTH: "apex-coach-auth",
  SETTINGS: "apex-athlete-settings",
  COMMS: "apex-athlete-comms-v2",
  PRACTICE_PLANS: "apex-athlete-practice-plans",
  WAITLIST: "apex-athlete-waitlist",
  BEST_TIMES_SEEN: "apex-best-times-seen",
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];

/* ── Core read/write ── */
export function storageGet<T>(key: StorageKey): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storageSet<T>(key: StorageKey, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key: StorageKey): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

/* ── Roster-specific: zero-XP guard ── */
interface RosterAthlete {
  xp?: number;
  [key: string]: unknown;
}

/**
 * Save roster ONLY if it has real data (at least one athlete with xp > 0).
 * Prevents seed/empty data from overwriting real athlete records.
 * Returns true if saved, false if blocked by guard.
 */
export function storageSaveRoster(roster: RosterAthlete[]): boolean {
  if (!Array.isArray(roster) || roster.length === 0) return false;
  const hasRealData = roster.some((a) => (a.xp ?? 0) > 0);
  if (!hasRealData) return false;
  return storageSet(KEYS.ROSTER, roster);
}

/**
 * Load roster from localStorage.
 */
export function storageGetRoster<T>(): T[] | null {
  return storageGet<T[]>(KEYS.ROSTER);
}
