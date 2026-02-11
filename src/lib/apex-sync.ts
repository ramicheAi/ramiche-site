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
  // 1. Instant local write
  lsSet(key, data);
  // 2. Async Firebase push (fire-and-forget)
  if (hasConfig && fbPath) {
    fbSet(fbPath, data as Record<string, unknown>).catch(() => {});
  }
}

export async function syncLoad<T>(key: string, fbPath?: string): Promise<T | null> {
  // 1. Try localStorage first (instant)
  const local = lsGet<T>(key);
  if (local !== null) {
    // Also backfill to Firebase if it doesn't have it
    if (hasConfig && fbPath) {
      fbGet<T>(fbPath).then((remote) => {
        if (!remote) {
          fbSet(fbPath, local as Record<string, unknown>).catch(() => {});
        }
      });
    }
    return local;
  }
  // 2. Fallback: try Firebase
  if (hasConfig && fbPath) {
    const remote = await fbGet<T>(fbPath);
    if (remote) {
      lsSet(key, remote); // Cache locally
      return remote;
    }
  }
  return null;
}

// ── Roster-specific sync ───────────────────────────────────────────

export function syncSaveRoster(key: string, groupId: string, athletes: unknown[]): void {
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
