/**
 * Pure derivation of bridge/sync rollup status from acceptance evidence, never
 * from process liveness alone. See docs/bridge/CC-BRIDGE-PROJECT-TRUTH-01.md
 * section 5 ("sync state model") for the full spec this implements a core slice
 * of — PR1 in that document's dependency graph.
 *
 * The headline bug this exists to make structurally impossible: a sync loop
 * that ticks every 60s (so "lastSync" always looks fresh) while 0 of N pushes
 * are actually accepted by the receiver must never be classified LIVE.
 */

export type SyncRollupStatus = "live" | "stale" | "failed" | "unknown" | "pending";

export interface CollectionSyncResult {
  /** Collection name, e.g. "agents", "projects". */
  name: string;
  /** True only if the receiver returned a successful acceptance for this push. */
  accepted: boolean;
  /** Whether this collection must be accepted for the overall rollup to be "live". */
  required: boolean;
}

export interface DeriveSyncStateInput {
  /** Per-collection results from the most recent completed sync cycle, or null if none has ever completed. */
  lastCycle: CollectionSyncResult[] | null;
  /** ms since epoch the last cycle was attempted, or null if no cycle has ever run. */
  lastAttemptedAtMs: number | null;
  /** ms since epoch "now" — passed in, never read from Date.now(), so this stays pure and testable. */
  nowMs: number;
  /** How old a successful cycle may be before it is considered stale. */
  freshnessBudgetMs: number;
  /** In-flight: an attempt has started but not yet completed (no lastCycle update for it). */
  pending?: boolean;
}

export interface DeriveSyncStateResult {
  status: SyncRollupStatus;
  /** accepted/required counts from the last completed cycle, for display — never a bare timestamp. */
  accepted: number;
  required: number;
  /** ms since the last cycle attempt, or null if there has never been one. */
  ageMs: number | null;
}

/**
 * Deriving "live" requires BOTH a completed cycle AND every required collection
 * accepted AND that cycle being within the freshness budget. A tick with no
 * acceptance evidence is never live — this is the fix for the bridge's
 * 284,629-cycle "ticking but 0/11 accepted" failure mode.
 */
export function deriveSyncState(input: DeriveSyncStateInput): DeriveSyncStateResult {
  const { lastCycle, lastAttemptedAtMs, nowMs, freshnessBudgetMs, pending } = input;

  if (lastAttemptedAtMs == null || lastCycle == null) {
    return { status: pending ? "pending" : "unknown", accepted: 0, required: 0, ageMs: null };
  }

  const ageMs = nowMs - lastAttemptedAtMs;
  const required = lastCycle.filter((c) => c.required);
  const acceptedRequired = required.filter((c) => c.accepted);
  const accepted = lastCycle.filter((c) => c.accepted).length;

  // A non-finite age (NaN from a corrupt/non-numeric timestamp input, or
  // Infinity) must never fall through the `ageMs < 0` / `ageMs > budget`
  // checks below as "fresh" — both comparisons are false for NaN, which
  // used to fail OPEN into "live" (independent review finding). Same for a
  // non-finite freshness budget.
  if (!Number.isFinite(ageMs) || !Number.isFinite(freshnessBudgetMs)) {
    return { status: "unknown", accepted, required: required.length, ageMs: null };
  }

  // Clock skew / future timestamp — never trust it as fresh.
  if (ageMs < 0) {
    return { status: "unknown", accepted, required: required.length, ageMs };
  }

  const allRequiredAccepted = required.length > 0 && acceptedRequired.length === required.length;

  if (!allRequiredAccepted) {
    // Zero or partial acceptance of required collections is never "live",
    // no matter how recent the attempt was — this is NT-1 / NT-2 / NT-4.
    return { status: "failed", accepted, required: required.length, ageMs };
  }

  if (ageMs > freshnessBudgetMs) {
    return { status: "stale", accepted, required: required.length, ageMs };
  }

  return { status: "live", accepted, required: required.length, ageMs };
}

/** Convenience: true iff the UI is allowed to render a "LIVE" badge for this state. */
export function isLiveStatus(result: DeriveSyncStateResult): boolean {
  return result.status === "live";
}
