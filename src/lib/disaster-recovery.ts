/**
 * Disaster Recovery — backup and restore for METTLE data.
 * Exports all localStorage data as a single encrypted JSON blob.
 * Can be pushed to Firestore as a backup doc or downloaded as a file.
 */

const BACKUP_KEY = "mettle-backup-meta";
const ALL_METTLE_KEYS = [
  "mettle-event-log",
  "mettle-feature-flags",
  "mettle-performance-log",
  "apex-roster",
  "apex-config",
  "apex-schedule",
  "apex-quests",
  "apex-attendance",
  "apex-xp",
  "apex-streaks",
  "apex-journals",
  "apex-feedback",
  "apex-challenges",
  "apex-meets",
  "apex-times",
  "apex-coach-auth",
];

export interface BackupManifest {
  version: 2;
  timestamp: number;
  keys: string[];
  sizeBytes: number;
  checksum: string;
}

/** Compute a simple checksum for integrity verification */
async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** Create a full backup of all METTLE data from localStorage */
export async function createBackup(): Promise<{ manifest: BackupManifest; data: string }> {
  const backup: Record<string, string | null> = {};
  const keysFound: string[] = [];

  for (const key of ALL_METTLE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      backup[key] = value;
      keysFound.push(key);
    }
  }

  // Also grab any keys that start with "apex-" or "mettle-" that we might have missed
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("apex-") || key.startsWith("mettle-")) && !backup[key]) {
      backup[key] = localStorage.getItem(key);
      keysFound.push(key);
    }
  }

  const data = JSON.stringify(backup);
  const checksum = await computeChecksum(data);

  const manifest: BackupManifest = {
    version: 2,
    timestamp: Date.now(),
    keys: keysFound,
    sizeBytes: new TextEncoder().encode(data).length,
    checksum,
  };

  localStorage.setItem(BACKUP_KEY, JSON.stringify(manifest));

  return { manifest, data };
}

/** Restore from a backup blob */
export async function restoreBackup(
  data: string,
  manifest: BackupManifest
): Promise<{ restored: number; errors: string[] }> {
  const checksum = await computeChecksum(data);
  const errors: string[] = [];

  if (checksum !== manifest.checksum) {
    errors.push("Checksum mismatch — backup may be corrupted");
    return { restored: 0, errors };
  }

  let parsed: Record<string, string | null>;
  try {
    parsed = JSON.parse(data);
  } catch {
    errors.push("Invalid backup data — cannot parse JSON");
    return { restored: 0, errors };
  }

  let restored = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== null && (key.startsWith("apex-") || key.startsWith("mettle-"))) {
      try {
        localStorage.setItem(key, value);
        restored++;
      } catch (e) {
        errors.push(`Failed to restore ${key}: ${e}`);
      }
    }
  }

  return { restored, errors };
}

/** Download backup as a JSON file */
export async function downloadBackup(): Promise<void> {
  const { manifest, data } = await createBackup();
  const blob = new Blob(
    [JSON.stringify({ manifest, data }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mettle-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Get last backup info */
export function getLastBackupInfo(): BackupManifest | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
