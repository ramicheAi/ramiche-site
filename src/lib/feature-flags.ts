/**
 * Feature flags for METTLE.
 * Controls feature rollout to beta coaches, athletes, and parents.
 * Reads from Firestore "config/features" doc with localStorage fallback.
 */

import { hasConfig } from "./firebase";

interface FeatureFlags {
  swimcloudImport: boolean;
  realtimeSync: boolean;
  meetManagement: boolean;
  pushNotifications: boolean;
  billing: boolean;
  weightRoom: boolean;
  teamChallenges: boolean;
  questSystem: boolean;
  wellnessCheckin: boolean;
  parentEncouragement: boolean;
}

const DEFAULTS: FeatureFlags = {
  swimcloudImport: true,
  realtimeSync: true,
  meetManagement: true,
  pushNotifications: false,
  billing: true,
  weightRoom: true,
  teamChallenges: true,
  questSystem: true,
  wellnessCheckin: true,
  parentEncouragement: true,
};

const STORAGE_KEY = "mettle_feature_flags";
let loaded = false;
let cachedFlags: FeatureFlags = { ...DEFAULTS };

/** Get current feature flags (cached after first load) */
export function getFlags(): FeatureFlags {
  if (loaded) return cachedFlags;
  loaded = true;

  if (typeof window === "undefined") return cachedFlags;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedFlags = { ...DEFAULTS, ...JSON.parse(stored) };
    }
  } catch {
    // Use defaults
  }

  return cachedFlags;
}

/** Check if a specific feature is enabled */
export function isEnabled(flag: keyof FeatureFlags): boolean {
  return getFlags()[flag];
}

/** Load flags from Firestore (call once on app init) */
export async function loadFlags(): Promise<void> {
  if (!hasConfig) return;

  try {
    const { fbGet } = await import("./firebase");
    const remote = await fbGet("config/features");
    if (remote && typeof remote === "object") {
      cachedFlags = { ...DEFAULTS, ...(remote as Partial<FeatureFlags>) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedFlags));
    }
  } catch {
    // Use defaults/cached on error
  }
}

/** Update a flag locally (for testing) */
export function setFlag(flag: keyof FeatureFlags, value: boolean): void {
  const flags = getFlags();
  flags[flag] = value;
  cachedFlags = flags;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}
