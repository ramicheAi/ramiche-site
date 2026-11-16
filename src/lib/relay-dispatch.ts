/**
 * Relay dispatch claim — one implementation, used by every route that can dispatch an agent turn.
 *
 * The chat route and the streaming route both dispatch the same persisted user message. When only
 * one of them claimed the message, the other was a callable bypass: a client could send the same
 * message id twice through the unclaimed route and the agent would run twice. This module exists
 * so a route cannot accidentally implement a weaker version, and so the claim's failure modes are
 * identical wherever it is used.
 *
 * Guarantee, stated precisely, and with its edges named: among the four message-scoped HTTP
 * dispatchers (chat, chat/stream, chat/approve, chat/approve/stream) at most one holds a live claim
 * per message per lease, terminal states (delivered, failed_permanent, legacy) are never reclaimed,
 * and no provider is called without a successful claim. This is NOT exactly-once execution, and it
 * does not cover the whole fleet:
 *
 *   - a turn the gateway accepted but never acknowledged, or a turn outliving its lease, can run
 *     twice; the honest record for that is `unknown`, never `delivered`;
 *   - `scripts/chat-bridge-poll.mjs` and `scripts/bridge-sync.mjs` dispatch agent turns for message
 *     rows from OUTSIDE these routes and never touch the claim. If either daemon is running against
 *     the same table, a send produces two agent turns and nothing here can prevent it. Verified by
 *     reading those files; whether they run in production is not knowable from this repo;
 *   - `voice/atlas`, `wellness/verse`, `lib/jobs.ts` and `lib/lead-gen.ts` call providers with no
 *     claim at all; they are outside this contract by design, not protected by it.
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
 * - legacy: dispatched before outcomes were recorded; nothing is known, and it is never retried
 */
export type RelayStatus =
  | "pending"
  | "claimed"
  | "delivered"
  | "failed"
  | "unknown"
  | "failed_permanent"
  | "legacy";

/**
 * Why a claim could not be obtained. Every one of these is a failure to confirm that this message
 * is safe to dispatch, and none of them permits dispatch.
 */
export type RelayUnavailableReason =
  | "bad_id"
  | "not_configured"
  | "not_deployed"
  | "unauthorized"
  | "transport"
  | "malformed"
  | "no_message";

export type RelayClaim =
  /** We hold the lease. `attempt` fences the eventual mark. */
  | { state: "claimed"; attempt: number | null }
  /** Someone else holds the lease, or the turn is already terminal. */
  | { state: "duplicate"; status: string }
  /**
   * The claim could not be consulted, so we do not know whether another attempt owns this message.
   * The caller MUST NOT dispatch. Proceeding here was the previous behaviour and it was wrong: it
   * turned "deduplication is unavailable" into "dispatch anyway, twice if someone retries", which
   * is precisely the failure the claim exists to prevent. A missing function, a revoked grant, a
   * PostgREST outage and a malformed reply are all the same answer to the caller: not confirmed,
   * nothing sent.
   */
  | { state: "unavailable"; reason: RelayUnavailableReason; detail: string };

function describe(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { code?: string; message?: string; details?: string; hint?: string };
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(" ") || "unknown error";
  }
  return typeof error === "string" && error ? error : "unknown error";
}

/**
 * Map a PostgREST/transport failure onto a reason an operator can act on.
 *
 * The distinction matters because the three core causes need three different fixes: deploy the
 * migration, restore the grant, or wait out the outage. Collapsing them into one "relay error"
 * would tell the operator nothing.
 */
export function classifyClaimError(error: unknown): RelayUnavailableReason {
  const text = describe(error);
  const code = (error && typeof error === "object" ? (error as { code?: unknown }).code : undefined) ?? "";
  const codeStr = typeof code === "string" ? code : "";

  // PostgREST's "function not in the schema cache": the migration has not been applied.
  if (codeStr === "PGRST202" || /could not find the function|schema cache/i.test(text)) {
    return "not_deployed";
  }
  // Postgres invalid_text_representation on the id parameter: the caller sent something that is not
  // a UUID. It can never succeed however many times it is retried, and it is the caller's input, not
  // a fault in the deduplication function, so say that instead of blaming the runtime.
  if (codeStr === "22P02" || /invalid input syntax for type uuid/i.test(text)) {
    return "bad_id";
  }
  // Postgres insufficient_privilege, or PostgREST rejecting the key before it reaches the database.
  if (
    codeStr === "42501" ||
    /permission denied|insufficient privilege|jwt|invalid api key|no api key/i.test(text)
  ) {
    return "unauthorized";
  }
  // Everything else is a transport or server fault: a timeout, a reset, a 5xx.
  return "transport";
}

/**
 * The truthful, client-facing description of a refusal to dispatch.
 *
 * Written once so the four dispatchers cannot describe the same condition differently. Every
 * message states the one fact the caller needs and cannot otherwise know: nothing ran.
 *
 * `retryable` means "retrying this exact request, unchanged, may succeed". A missing migration and
 * a missing grant are not retryable by the caller because no retry will change them; they need an
 * operator. A transport fault is.
 */
export function describeUnavailable(reason: RelayUnavailableReason): {
  httpStatus: number;
  code: string;
  retryable: boolean;
  detail: string;
} {
  switch (reason) {
    case "bad_id":
      // The function is healthy; the caller sent something that is not a UUID. Saying "the
      // deduplication function could not be interpreted" sent an operator to debug a healthy
      // component.
      return {
        httpStatus: 400,
        code: "invalid_message_id",
        retryable: false,
        detail:
          "That message id is not a UUID, so it cannot identify a persisted message and no agent turn was dispatched. Nothing ran.",
      };
    case "not_configured":
      return {
        httpStatus: 503,
        code: "relay_not_configured",
        retryable: false,
        detail:
          "The server has no database configured, so it cannot record who is allowed to dispatch this message. No agent turn was dispatched. Nothing ran.",
      };
    case "not_deployed":
      return {
        httpStatus: 503,
        code: "relay_not_deployed",
        retryable: false,
        detail:
          "The relay's deduplication function is not installed on this database, so no agent turn was dispatched. Nothing ran. This needs a deployment fix, not a retry.",
      };
    case "unauthorized":
      return {
        httpStatus: 503,
        code: "relay_unauthorized",
        retryable: false,
        detail:
          "The relay's deduplication function rejected this server's credentials, so no agent turn was dispatched. Nothing ran. This is a server permissions problem, not a problem with your message.",
      };
    case "malformed":
      return {
        httpStatus: 503,
        code: "relay_malformed",
        retryable: false,
        detail:
          "The relay's deduplication function returned a result this server cannot interpret, so no agent turn was dispatched. Nothing ran. Retrying will not help until that function is fixed.",
      };
    case "no_message":
      return {
        httpStatus: 404,
        code: "message_not_found",
        retryable: false,
        detail:
          "No persisted message matches that id, so no agent turn was dispatched. Nothing ran. Save the message first, then dispatch against its id.",
      };
    case "transport":
    default:
      return {
        httpStatus: 503,
        code: "relay_unavailable",
        retryable: true,
        detail:
          "The relay could not confirm that this message is safe to dispatch, so no agent turn was sent. Nothing ran. Retry shortly.",
      };
  }
}

/**
 * Claim the right to dispatch one agent turn for a persisted message.
 *
 * Never throws: every failure mode becomes `unavailable` with a typed reason, and the caller must
 * refuse to dispatch. This is the whole point of the function. It used to return `unprotected` and
 * the callers proceeded, which meant the mechanism's own failures were the one situation where
 * duplicate dispatch was guaranteed to be possible: no claim was held, no outcome could be
 * recorded (a mark with a null attempt is refused on an already-claimed row), and the next retry
 * re-claimed the row after the lease and ran the agent again.
 *
 * A malformed reply is treated as "cannot confirm", not as "no prior attempt". The difference
 * matters: a function that returns something unexpected is a function we do not understand well
 * enough to trust with a dispatch decision.
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
      const reason = classifyClaimError(error);
      // Error level, not warn: this is now a refusal to serve a dispatch, not a degraded mode.
      console.error(
        "[relay] claim failed, refusing to dispatch:",
        reason,
        describe(error),
      );
      return { state: "unavailable", reason, detail: describe(error) };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") {
      console.error("[relay] claim returned no usable row, refusing to dispatch");
      return {
        state: "unavailable",
        reason: "malformed",
        detail: `expected one row, got ${Array.isArray(data) ? "empty array" : typeof data}`,
      };
    }

    const record = row as { claimed?: unknown; attempts?: unknown; status?: unknown };
    if (typeof record.claimed !== "boolean") {
      console.error("[relay] claim row has no usable 'claimed' flag, refusing to dispatch");
      return {
        state: "unavailable",
        reason: "malformed",
        detail: `claimed is ${typeof record.claimed}, expected boolean`,
      };
    }

    if (record.claimed) {
      return {
        state: "claimed",
        attempt: typeof record.attempts === "number" ? record.attempts : null,
      };
    }

    if (typeof record.status !== "string" || record.status === "") {
      console.error("[relay] claim refused without a status, refusing to dispatch");
      return {
        state: "unavailable",
        reason: "malformed",
        detail: "claimed was false but no status was returned",
      };
    }
    if (record.status === "not_found") {
      // There is no row to attach a reply to and no attempt to be honest about. Dispatching would
      // produce a turn whose result cannot be recorded anywhere, so refuse and say why.
      console.error("[relay] claim found no message row, refusing to dispatch");
      return {
        state: "unavailable",
        reason: "no_message",
        detail: "cc_claim_relay_dispatch returned status not_found",
      };
    }

    return { state: "duplicate", status: record.status };
  } catch (error) {
    const reason = classifyClaimError(error);
    console.error("[relay] claim threw, refusing to dispatch:", reason, describe(error));
    return { state: "unavailable", reason, detail: describe(error) };
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
 * The status to record after a turn has been generated and its reply was (or was not) written.
 *
 * Extracted so it can be tested directly: an earlier version of this logic lived inline in two
 * routes, and the tests only asserted the shape of the response, so every mutation of the status
 * label survived the whole suite. `delivered` requires a reply that actually exists on disk.
 *
 * The `attempted === 0` case matters: a request with no channelId cannot persist anything, and
 * summarizePersistence calls that a success ("nothing attempted is a configuration choice"). For
 * the relay it is not a delivery — and `delivered` is terminal, so a retry would be refused with
 * alreadyDispatched:true while the reply exists nowhere.
 */
export function statusAfterTurn(summary: { ok: boolean; attempted: number }): "delivered" | "unknown" {
  return summary.ok && summary.attempted > 0 ? "delivered" : "unknown";
}

/**
 * The status to record when a dispatch produced no reply at all.
 *
 * `failed` is reserved for "nothing was ever sent". If any provider was called, its failure is
 * ambiguous and the honest record is `unknown` — including a provider that answered and declined,
 * where the agent did run.
 */
export function statusAfterEmptyDispatch(attempted: boolean): "failed" | "unknown" {
  return attempted ? "unknown" : "failed";
}

/**
 * What a duplicate claim means, decided once for all three dispatchers.
 *
 * This exists because the answer needs three facts to agree — is it a genuine prior success, may
 * the client retry, and what do we tell it — and the three routes previously each decided with its
 * own inline expression. When `legacy` was added to the schema, all three kept treating it as
 * "still in flight, retryable", so every pre-migration message told the operator to wait for
 * something that will never finish. A state that is terminal in SQL has to be terminal in the API
 * too, and the only way to keep those in step is to have one function say it.
 *
 * Note on `legacy`: it is terminal by design. Rows were backfilled to `legacy` because the old
 * system recorded that a dispatch had been taken, never what came of it. Freezing them avoids
 * re-sending messages this host already sent; the cost is that a retry which used to be allowed is
 * now refused, so the wording must give the operator a way forward (send a new message) instead of
 * leaving them waiting.
 */
export type DuplicateDisposition = {
  /** A genuine prior success: report the existing result rather than an error. */
  alreadyDispatched: boolean;
  /** Whether retrying this exact message id could ever succeed. */
  retryable: boolean;
  reason: "delivered" | "failed_permanent" | "legacy" | "in_flight";
  detail: string;
};

export function describeDuplicate(status: string): DuplicateDisposition {
  if (status === "delivered") {
    return {
      alreadyDispatched: true,
      retryable: false,
      reason: "delivered",
      detail: "This message was already dispatched and its reply was recorded.",
    };
  }
  if (status === "failed_permanent") {
    return {
      alreadyDispatched: false,
      retryable: false,
      reason: "failed_permanent",
      detail: "A prior attempt for this message failed permanently and will not be retried.",
    };
  }
  if (status === "legacy") {
    return {
      alreadyDispatched: false,
      retryable: false,
      reason: "legacy",
      detail:
        "This message was dispatched before delivery outcomes were recorded, so it will not be retried. Send a new message if you need a fresh answer.",
    };
  }
  // 'claimed' is the only status that is genuinely in flight. 'failed' and 'unknown' are both
  // immediately reclaimable, so a duplicate report of either means another caller claimed it in the
  // same instant: transient, and worth retrying.
  return {
    alreadyDispatched: false,
    retryable: true,
    reason: "in_flight",
    detail: "A prior attempt for this message is still in flight.",
  };
}
