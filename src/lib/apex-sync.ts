// ── Apex Athlete Sync Layer ─────────────────────────────────────────
// Hybrid: localStorage (instant) + Firestore (persistent/multi-device)
//
// Strategy:
// 1. Read from localStorage first (instant, no loading spinner)
// 2. Push writes to both localStorage AND Firestore
// 3. Listen for Firestore changes → update localStorage + UI
// 4. If Firebase is not configured, falls back to localStorage only

import {
  hasConfig,
  fbSet,
  fbGet,
  fbSaveRoster,
  fbGetRoster,
  fbSaveConfig,
  fbGetConfig,
  fbSaveSchedule,
  fbGetSchedule,
  fbSaveAudit,
  fbSaveSnapshot,
  fbSaveFeedback,
  fbListenRoster,
  fbListenConfig,
  fbBatchSaveRosters,
  type Unsubscribe,
} from "./firebase";

// Re-export hasConfig for UI badges
export { hasConfig as firebaseConnected } from "./firebase";

// ── localStorage helpers (existing pattern) ────────────────────────

function lsGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function lsSet(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("[Sync] localStorage write error:", key, e);
  }
}

// ── Sync operations ────────────────────────────────────────────────
// Each operation: write localStorage immediately, then async push to Firebase

export function syncSave<T>(key: string, data: T, fbPath?: string): void {
  // GUARD: If writing roster data with zero XP, use fbSaveRoster (has protection)
  if (fbPath && (fbPath.startsWith("rosters/")) && Array.isArray(data)) {
    const totalXP = (data as { xp?: number }[]).reduce((s, a) => s + (a.xp || 0), 0);
    if (totalXP === 0) {
      console.warn("[Sync] BLOCKED localStorage write of zero-XP roster to", key);
      return; // Don't overwrite localStorage OR Firestore with empty data
    }
  }
  // 1. Instant local write
  lsSet(key, data);
  // 2. Async Firebase push (fire-and-forget)
  if (hasConfig && fbPath) {
    // Route roster writes through fbSaveRoster (has zero-XP guard)
    if (fbPath.startsWith("rosters/") && Array.isArray(data)) {
      const groupId = fbPath.replace("rosters/", "");
      fbSaveRoster(groupId, data as unknown[]).catch((e) => {
        console.warn("[Sync] Firebase roster write error:", fbPath, e);
      });
      return;
    }
    // Wrap arrays in an object — Firestore can't store raw arrays at document root
    const payload = Array.isArray(data) ? { _items: data } : (data as Record<string, unknown>);
    fbSet(fbPath, payload).catch((e) => {
      console.warn("[Sync] Firebase write error:", fbPath, e);
    });
  }
}

// Unwrap Firestore documents that were stored with _items wrapper
function unwrapFirestore<T>(remote: unknown): T | null {
  if (!remote || typeof remote !== "object") return null;
  const obj = remote as Record<string, unknown>;
  // If we stored it wrapped, unwrap
  if ("_items" in obj && Array.isArray(obj._items)) return obj._items as unknown as T;
  // Legacy: check if it has numeric keys (broken spread of array)
  const keys = Object.keys(obj).filter(k => k !== "_updatedAt");
  if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
    const arr = keys.sort((a, b) => Number(a) - Number(b)).map(k => obj[k]);
    return arr as unknown as T;
  }
  return remote as T;
}

export async function syncLoad<T>(key: string, fbPath?: string): Promise<T | null> {
  // 1. Try localStorage first (instant)
  const local = lsGet<T>(key);
  if (local !== null) {
    // Also backfill to Firebase if it doesn't have it
    if (hasConfig && fbPath) {
      fbGet<Record<string, unknown>>(fbPath).then((remote) => {
        if (!remote) {
          // Route roster backfills through fbSaveRoster (has zero-XP guard)
          if (fbPath.startsWith("rosters/") && Array.isArray(local)) {
            const groupId = fbPath.replace("rosters/", "");
            fbSaveRoster(groupId, local as unknown[]).catch(() => {});
            return;
          }
          const payload = Array.isArray(local) ? { _items: local } : (local as Record<string, unknown>);
          fbSet(fbPath, payload).catch(() => {});
        }
      });
    }
    return local;
  }
  // 2. Fallback: try Firebase
  if (hasConfig && fbPath) {
    const remote = await fbGet<Record<string, unknown>>(fbPath);
    if (remote) {
      const unwrapped = unwrapFirestore<T>(remote);
      if (unwrapped !== null) {
        lsSet(key, unwrapped); // Cache locally
        return unwrapped;
      }
    }
  }
  return null;
}

// ── Roster-specific sync ───────────────────────────────────────────

export function syncSaveRoster(key: string, groupId: string, athletes: unknown[]): void {
  // GUARD: Never write zero-XP roster to localStorage or Firestore
  const totalXP = (athletes as { xp?: number }[]).reduce((s, a) => s + (a.xp || 0), 0);
  if (totalXP === 0) {
    console.warn("[Sync] BLOCKED zero-XP roster write to", key, groupId);
    return;
  }
  lsSet(key, athletes);
  if (hasConfig) {
    fbSaveRoster(groupId, athletes).catch(() => {});
  }
}

export async function syncLoadRoster(key: string, groupId: string): Promise<unknown[] | null> {
  const local = lsGet<unknown[]>(key);
  if (local) {
    if (hasConfig) {
      fbGetRoster(groupId).then((remote) => {
        if (!remote) fbSaveRoster(groupId, local).catch(() => {});
      });
    }
    return local;
  }
  if (hasConfig) {
    const remote = await fbGetRoster(groupId);
    if (remote?.athletes) {
      lsSet(key, remote.athletes);
      return remote.athletes;
    }
  }
  return null;
}

// ── Config sync ────────────────────────────────────────────────────

export function syncSaveConfig(key: string, configKey: string, data: Record<string, unknown>): void {
  lsSet(key, data);
  if (hasConfig) {
    fbSaveConfig(configKey, data).catch(() => {});
  }
}

export async function syncLoadConfig<T>(key: string, configKey: string): Promise<T | null> {
  const local = lsGet<T>(key);
  if (local) {
    if (hasConfig) {
      fbGetConfig<T>(configKey).then((remote) => {
        if (!remote) fbSaveConfig(configKey, local as Record<string, unknown>).catch(() => {});
      });
    }
    return local;
  }
  if (hasConfig) {
    const remote = await fbGetConfig<T>(configKey);
    if (remote) {
      lsSet(key, remote);
      return remote;
    }
  }
  return null;
}

// ── Schedule sync ──────────────────────────────────────────────────

export function syncSaveSchedule(key: string, groupId: string, schedule: unknown): void {
  lsSet(key, schedule);
  if (hasConfig) {
    fbSaveSchedule(groupId, schedule).catch(() => {});
  }
}

export async function syncLoadSchedule(key: string, groupId: string): Promise<unknown | null> {
  const local = lsGet<unknown>(key);
  if (local) {
    if (hasConfig) {
      fbGetSchedule(groupId).then((remote) => {
        if (!remote) fbSaveSchedule(groupId, local).catch(() => {});
      });
    }
    return local;
  }
  if (hasConfig) {
    const remote = await fbGetSchedule(groupId);
    if (remote?.schedule) {
      lsSet(key, remote.schedule);
      return remote.schedule;
    }
  }
  return null;
}

// ── Audit + Snapshot sync ──────────────────────────────────────────

export function syncSaveAudit(key: string, date: string, entries: unknown[]): void {
  lsSet(key, entries);
  if (hasConfig) {
    fbSaveAudit(date, entries).catch(() => {});
  }
}

export function syncSaveSnapshot(date: string, snapshot: Record<string, unknown>): void {
  if (hasConfig) {
    fbSaveSnapshot(date, snapshot).catch(() => {});
  }
}

// ── Feedback sync ──────────────────────────────────────────────────

export function syncSaveFeedback(key: string, athleteId: string, feedback: unknown[]): void {
  lsSet(key, feedback);
  if (hasConfig) {
    fbSaveFeedback(athleteId, feedback).catch(() => {});
  }
}

export async function syncLoadFeedback(key: string, athleteId: string): Promise<unknown[] | null> {
  const local = lsGet<unknown[]>(key);
  if (local) {
    if (hasConfig) {
      fbGet<{ feedback: unknown[] }>(`feedback/${athleteId}`).then((remote) => {
        if (!remote) fbSaveFeedback(athleteId, local).catch(() => {});
      });
    }
    return local;
  }
  if (hasConfig) {
    const remote = await fbGet<{ feedback: unknown[] }>(`feedback/${athleteId}`);
    if (remote?.feedback) {
      lsSet(key, remote.feedback);
      return remote.feedback;
    }
  }
  return null;
}

// ── Batched atomic writes (check-in + XP + leaderboard) ─────────
// Groups multiple writes into a single Firestore batch for atomicity

export function syncBatchCheckIn(
  rosterKey: string,
  groupId: string,
  athletes: unknown[],
  auditKey: string,
  auditDate: string,
  auditEntries: unknown[],
  snapshotDate?: string,
  snapshot?: Record<string, unknown>
): void {
  // 1. Local writes (instant)
  lsSet(rosterKey, athletes);
  lsSet(auditKey, auditEntries);

  // 2. Atomic Firebase push
  if (hasConfig) {
    Promise.all([
      fbSaveRoster(groupId, athletes),
      fbSaveAudit(auditDate, auditEntries),
      ...(snapshotDate && snapshot ? [fbSaveSnapshot(snapshotDate, snapshot)] : []),
    ]).catch((e) => {
      console.warn("[Sync] Batch check-in write error:", e);
    });
  }
}

// ── Real-time listeners ────────────────────────────────────────────
// Subscribe to Firestore changes → update localStorage + call back

export function syncListenRoster(
  key: string,
  groupId: string,
  callback: (athletes: unknown[]) => void
): Unsubscribe | null {
  if (!hasConfig) return null;
  return fbListenRoster(groupId, (athletes) => {
    if (athletes) {
      lsSet(key, athletes);
      callback(athletes);
    }
  });
}

export function syncListenConfig<T>(
  key: string,
  configKey: string,
  callback: (data: T) => void
): Unsubscribe | null {
  if (!hasConfig) return null;
  return fbListenConfig<T>(configKey, (data) => {
    if (data) {
      lsSet(key, data);
      callback(data);
    }
  });
}

// ── Team summary denormalization ──────────────────────────────────
// Pre-compute aggregate stats at the team level for fast queries
// Stored in Firestore as organizations/default/summaries/team
// Avoids loading every athlete just to show team-level dashboards

interface TeamSummary {
  totalAthletes: number;
  totalXP: number;
  avgXP: number;
  activeAthletes: number; // athletes with > 0 practices
  topAthletes: Array<{ name: string; xp: number; level: string }>;
  groupCounts: Record<string, number>;
  lastUpdated: string;
}

interface SyncAthlete {
  name?: string;
  xp?: number;
  level?: string;
  totalPractices?: number;
  group?: string;
}

export function computeTeamSummary(allAthletes: SyncAthlete[]): TeamSummary {
  const totalAthletes = allAthletes.length;
  const totalXP = allAthletes.reduce((sum, a) => sum + (a.xp || 0), 0);
  const avgXP = totalAthletes > 0 ? Math.round(totalXP / totalAthletes) : 0;
  const activeAthletes = allAthletes.filter((a) => (a.totalPractices || 0) > 0).length;
  const sorted = [...allAthletes].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const topAthletes = sorted.slice(0, 10).map((a) => ({
    name: a.name || "Unknown",
    xp: a.xp || 0,
    level: a.level || "Rookie",
  }));
  const groupCounts: Record<string, number> = {};
  for (const a of allAthletes) {
    const g = a.group || "unassigned";
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  }
  return { totalAthletes, totalXP, avgXP, activeAthletes, topAthletes, groupCounts, lastUpdated: new Date().toISOString() };
}

export function syncSaveTeamSummary(allAthletes: SyncAthlete[]): void {
  const summary = computeTeamSummary(allAthletes);
  lsSet("apex-team-summary", summary);
  if (hasConfig) {
    fbSet("summaries/team", summary as unknown as Record<string, unknown>).catch(() => {});
  }
}

export async function syncLoadTeamSummary(): Promise<TeamSummary | null> {
  const local = lsGet<TeamSummary>("apex-team-summary");
  if (local) return local;
  if (hasConfig) {
    const remote = await fbGet<TeamSummary>("summaries/team");
    if (remote) {
      lsSet("apex-team-summary", remote);
      return remote;
    }
  }
  return null;
}

// ── Batch sync: push all localStorage to Firebase ──────────────────

export async function syncPushAllToFirebase(): Promise<{ synced: number; errors: number }> {
  if (!hasConfig) return { synced: 0, errors: 0 };
  let synced = 0;
  let errors = 0;

  // Push roster for each group
  const groups = ["platinum", "gold", "silver", "bronze1", "bronze2", "diving", "waterpolo"];
  const rosterKey = "apex-athlete-roster-v5";
  const allRosters: Record<string, unknown[]> = {};

  for (const g of groups) {
    const athletes = lsGet<unknown[]>(`${rosterKey}-${g}`) || lsGet<unknown[]>(rosterKey);
    if (athletes) {
      allRosters[g] = athletes;
    }
  }

  // Also try the main roster key (might be a flat list)
  const mainRoster = lsGet<unknown[]>(rosterKey);
  if (mainRoster && !allRosters["platinum"]) {
    allRosters["platinum"] = mainRoster;
  }

  if (Object.keys(allRosters).length > 0) {
    const ok = await fbBatchSaveRosters(allRosters);
    if (ok) synced += Object.keys(allRosters).length;
    else errors++;
  }

  // Push config keys
  const configKeys = [
    { ls: "apex-athlete-pin", fb: "pin" },
    { ls: "apex-athlete-culture-v2", fb: "culture" },
    { ls: "apex-athlete-challenges-v2", fb: "challenges" },
    { ls: "apex-athlete-coaches-v1", fb: "coaches" },
  ];

  for (const { ls, fb } of configKeys) {
    const data = lsGet<unknown>(ls);
    if (data) {
      const ok = await fbSaveConfig(fb, typeof data === "object" && data !== null ? data as Record<string, unknown> : { value: data });
      if (ok) synced++;
      else errors++;
    }
  }

  return { synced, errors };
}
