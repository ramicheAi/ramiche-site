// SyncStatus — dot indicator for Firestore sync state
// Green = synced, Yellow = syncing, Red = error. Dark theme only.

"use client";

import type { FirestoreSyncState } from "@/hooks/useFirestoreSync";

interface SyncStatusProps {
  state: FirestoreSyncState;
  className?: string;
}

export default function SyncStatus({ state, className = "" }: SyncStatusProps) {
  const { syncing, lastSyncTime, error } = state;

  let dotColor = "bg-emerald-400 shadow-emerald-400/50";
  let label = "Synced";
  if (error) {
    dotColor = "bg-red-500 shadow-red-500/50";
    label = "Sync error";
  } else if (syncing) {
    dotColor = "bg-yellow-400 shadow-yellow-400/50";
    label = "Syncing…";
  }

  const timeStr = lastSyncTime
    ? lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a0a1a]/80 border border-white/[0.08] ${className}`}
      title={error ?? (timeStr ? `Last sync: ${timeStr}` : "Not yet synced")}
    >
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full shadow-[0_0_6px] ${dotColor} ${syncing ? "animate-pulse" : ""}`}
      />
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      {timeStr && !error && (
        <span className="text-[10px] text-slate-500">{timeStr}</span>
      )}
    </div>
  );
}
