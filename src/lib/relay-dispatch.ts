/**
 * Relay dispatch claim — one implementation, used by every route that can dispatch an agent turn.
 *
 * The chat route and the streaming route both dispatch the same persisted user message. When only
 * one of them claimed the message, the other was a callable bypass: a client could send the same
 * message id twice through the unclaimed route and the agent would run twice. This module exists
 * so a route cannot accidentally implement a weaker version, and so the claim's failure modes are
 * identical wherever it is used.
 *
 * Guarantee, stated precisely: at most one live claim per message per lease. Terminal states
 * (delivered, failed_permanent) are never reclaimed. This is not exactly-once execution. A turn
 * the gateway accepted but never acknowledged, or a turn outliving its lease, can run twice; the
 * honest record for that case is `unknown`, never `delivered`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Longer than the routes' maxDuration (120 s) so a live turn is never reclaimable. */
export const RELAY_LEASE_SECONDS = 300;

/**
 * - pending: never dispatched
 * - claimed: a caller holds the lease and is dispatching
 * - delivered: the turn ran and its result was recorded
 * - failed: the dispatch definitely did not run (explicit rejection)
 * - unknown: the dispatch may or may not have run (timeout, transport loss, lost ack)
 * - failed_permanent: never retry
 */
export type RelayStatus =
  | "pending"
  | "claimed"
  | "delivered"
  | "failed"
  | "unknown"
  | "failed_permanent";

export type RelayClaim =
  /** We hold the lease. `attempt` fences the eventual mark. */
  | { state: "claimed"; attempt: number | null }
  /** Someone else holds the lease, or the turn is already terminal. */
  | { state: "duplicate"; status: string }
  /**
   * The claim could not be consulted at all (migration not applied, grant revoked, transport
   * failure, row missing). The caller proceeds — refusing every send while the mechanism is
   * unavailable would turn a schema problem into a chat outage — but the caller must log, because
   * this is the state in which deduplication is silently absent.
   */
  | { state: "unprotected"; reason: string };

function describe(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { code?: string; message?: string };
    return [e.code, e.message].filter(Boolean).join(" ") || "unknown error";
  }
  return typeof error === "string" ? error : "unknown error";
}

/**
 * Claim the right to dispatch one agent turn for a persisted message.
 *
 * Never throws. A missing RPC, a revoked grant and a network fault all become `unprotected` with a
 * warning, so the chat keeps working and the operator can see that dedup is off.
 */
export async function claimRelayDispatch(
  svc: SupabaseClient,
  messageId: string,
  leaseSeconds: number = RELAY_LEASE_SECONDS,
): Promise<RelayClaim> {
  try {
    const { data, error } = await svc.rpc("cc_claim_relay_dispatch", {
      p_message_id: messageId,
      p_lease_seconds: leaseSeconds,
    });
    if (error) {
      const reason = describe(error);
      console.warn("[relay] claim unavailable, dispatch is not deduplicated:", reason);
      return { state: "unprotected", reason };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      console.warn("[relay] claim returned no row, dispatch is not deduplicated");
      return { state: "unprotected", reason: "claim returned no row" };
    }
    if (row.claimed === true) {
      return {
        state: "claimed",
        attempt: typeof row.attempts === "number" ? row.attempts : null,
      };
    }
    const status = typeof row.status === "string" ? row.status : "unknown";
    if (status === "not_found") {
      // The id does not match a row. There is no prior attempt to be honest about, so proceed
      // rather than holding a 409 forever for an id that will never resolve.
      console.warn("[relay] claim found no message row, dispatching unclaimed");
      return { state: "unprotected", reason: "message row not found" };
    }
    return { state: "duplicate", status };
  } catch (error) {
    const reason = describe(error);
    console.warn("[relay] claim threw, dispatch is not deduplicated:", reason);
    return { state: "unprotected", reason };
  }
}

/**
 * Record the real outcome of a claimed attempt. The attempt number fences it: a slow attempt whose
 * lease has since expired cannot overwrite the outcome of the attempt that replaced it.
 *
 * Returns whether the write landed. A false return is not fatal, but it is worth logging: the row
 * will be retryable again after the lease, which is the safe direction for an unrecorded outcome.
 */
export async function markRelayStatus(
  svc: SupabaseClient,
  messageId: string,
  status: Exclude<RelayStatus, "pending" | "claimed">,
  attempt: number | null,
): Promise<boolean> {
  try {
    const { data, error } = await svc.rpc("cc_mark_relay_status", {
      p_message_id: messageId,
      p_status: status,
      p_attempt: attempt,
    });
    if (error) {
      console.warn("[relay] status not recorded:", status, describe(error));
      return false;
    }
    if (data === false) {
      console.warn(
        "[relay] status not recorded: another attempt now owns this message (attempt",
        attempt,
        ")",
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[relay] status threw:", status, describe(error));
    return false;
  }
}

/**
 * Classify a dispatch that did not succeed.
 *
 * `verified` means the gateway answered with an explicit failure: the turn did not run.
 * `unknown` means the call was lost after it may have been accepted: the turn may have run and its
 * result may have been discarded. Recording an unknown as a failure would invite a retry that can
 * duplicate the work, so the two must not be collapsed.
 */
export function classifyDispatchFailure(cause: "threw" | "gateway_error" | "no_reply"): {
  status: "failed" | "unknown";
  verified: boolean;
} {
  if (cause === "gateway_error") return { status: "failed", verified: true };
  // A thrown call and a gateway answer with no reply text are both ambiguous: in either case the
  // gateway may have accepted the turn before the result was lost.
  return { status: "unknown", verified: false };
}
