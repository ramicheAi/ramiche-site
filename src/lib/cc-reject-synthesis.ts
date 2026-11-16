/**
 * Synthesis rejection.
 *
 * CC-RELEASE-CONSOLIDATION-01 Phase 2, founder decision 1: implement a genuine Reject action for
 * synthesis approvals. Before this file, the only terminal state on a synthesis plan was
 * `metadata.approved_at` — nothing anywhere wrote a rejected state, so a rejection could not be
 * recorded at all (see e2e journey D2 in this repo's acceptance harness, which was BLOCKED for
 * exactly this reason).
 *
 * The hard part is not writing `rejected_at` — it is making it impossible for a Reject submitted
 * while an Approve is already mid-flight to land underneath (or on top of) that Approve's own
 * work. `cc-approve-synthesis.ts` already solves exactly this shape of problem for "two concurrent
 * Approves": it calls `claimRelayDispatch`, an atomic Postgres claim on the row's own
 * `relay_status` lease, BEFORE dispatching anything, and only a successful claim is allowed to
 * execute. That claim's terminal states (`delivered`, `failed_permanent`) are never reclaimed by
 * any later caller. Reject reuses the SAME claim, on the SAME row, for the SAME reason: a synthesis
 * row's `relay_status` is otherwise untouched (synthesis rows are inserted directly by Atlas's
 * synthesis code, never routed through the per-user-message relay dispatch pipeline), so this is
 * the one claim mechanism that already exists on this exact row and is already proven atomic under
 * real concurrency (see supabase/tests/relay-dispatch-scenarios.sh and this round's own race
 * tests). Reusing it, instead of inventing a second, parallel claim mechanism for the same row,
 * means approve-vs-reject exclusivity is enforced by code that was already reviewed for exactly
 * this property, not by a new mechanism that would need its own round of review to earn the same
 * trust.
 *
 * Mapping onto relay_status, for a synthesis row specifically (not any other message kind):
 *   pending            never resolved (approved or rejected)
 *   claimed            someone is resolving it right now (an Approve executing, or a Reject
 *                      writing its two follow-up fields) — refuses the other side immediately
 *   delivered          approved, and the plan produced real output (see cc-approve-synthesis.ts)
 *   failed_permanent   rejected — on a synthesis row, this value is written ONLY by this file,
 *                      so seeing it here always means "rejected", never a generic relay failure
 *   unknown            an approve run whose outcome was not cleanly recorded; still re-approvable
 *
 * `cc-approve-synthesis.ts`'s own duplicate-claim handling already refuses to approve a
 * `failed_permanent` row (that is the whole point of the claim being terminal); this file adds the
 * accurate, synthesis-specific wording for that refusal ("this synthesis was rejected") instead of
 * the generic relay message, since on a synthesis row `failed_permanent` has exactly one cause.
 */

import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";
import { claimRelayDispatch, describeDuplicate, describeUnavailable, markRelayStatus } from "@/lib/relay-dispatch";
import { getSupabaseServiceForApprove, TENANT_ID } from "@/lib/cc-approve-synthesis";

/** Reject only ever writes two small fields and posts one channel message — a short lease is correct. */
export const REJECT_LEASE_SECONDS = 60;

export type RejectResult =
  | { ok: true; alreadyRejected?: boolean; rejectedAt: string; cancelled?: number }
  | { ok: false; error: string; status?: number };

/**
 * Reject a synthesis plan. Owner-gated by the caller (the route this is wired into runs
 * `ownerOnly`, same as approve); this function assumes that check already passed.
 */
export async function rejectSynthesisMessage(
  messageId: string,
  resolutionNote?: string
): Promise<RejectResult> {
  if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return { ok: false, error: "messageId required (uuid)", status: 400 };
  }

  const svc = getSupabaseServiceForApprove();
  if (!svc) {
    return { ok: false, error: "Supabase service role not configured", status: 500 };
  }

  const { data: row, error: readErr } = await svc
    .from("messages")
    .select("id, channel_id, metadata, tenant_id")
    .eq("id", messageId)
    .single();
  if (readErr || !row) {
    return {
      ok: false,
      error: `synthesis message not found: ${readErr?.message || "no row"}`,
      status: 404,
    };
  }

  const meta = (row.metadata as Record<string, unknown> | null) ?? {};
  if (meta.kind !== "synthesis") {
    return { ok: false, error: "message is not a synthesis", status: 400 };
  }
  const plan = meta.plan as { actions?: unknown[] } | undefined;
  const totalActions = Array.isArray(plan?.actions) ? plan!.actions!.length : 0;

  // Fast, read-only idempotency paths. Neither is the actual safety boundary (the claim below is)
  // — they exist only to answer the common, non-racing case (a double-click, a retried POST)
  // without taking the claim and without a confusing relay-status-flavored error.
  if (meta.rejected_at) {
    return { ok: true, alreadyRejected: true, rejectedAt: meta.rejected_at as string };
  }
  if (meta.approved_at) {
    return { ok: false, error: "this synthesis was already approved and cannot be rejected", status: 409 };
  }

  // The actual safety boundary: an atomic claim on this row's relay_status lease, the same
  // mechanism and the same row approve uses for its own exclusivity. At most one of a concurrent
  // Approve-vs-Reject pair can ever win this claim; the loser runs none of its effects.
  const claim = await claimRelayDispatch(svc, row.id as string, REJECT_LEASE_SECONDS);
  if (claim.state === "duplicate") {
    if (claim.status === "delivered") {
      return {
        ok: false,
        error: "this synthesis was already approved and executed, and cannot be rejected",
        status: 409,
      };
    }
    if (claim.status === "failed_permanent") {
      // On a synthesis row this value has exactly one cause: an earlier, successful rejection.
      // Re-read so the response carries the real timestamp rather than "now".
      const { data: fresh } = await svc.from("messages").select("metadata").eq("id", row.id).single();
      const freshMeta = (fresh?.metadata as Record<string, unknown> | null) ?? {};
      return {
        ok: true,
        alreadyRejected: true,
        rejectedAt: (freshMeta.rejected_at as string) ?? new Date().toISOString(),
      };
    }
    const dup = describeDuplicate(claim.status);
    return { ok: false, error: dup.detail, status: 409 };
  }
  if (claim.state === "unavailable") {
    // Fail closed (same doctrine as approve/relay dispatch): an unconfirmed claim means we cannot
    // know whether an approval is concurrently in flight, so refuse rather than guess.
    const u = describeUnavailable(claim.reason);
    return { ok: false, error: u.detail, status: u.httpStatus };
  }

  // claim.state === "claimed": we now exclusively hold this row. Nothing else can claim it until
  // this lease expires or we mark it terminal below.
  const rejectedAt = new Date().toISOString();
  const updatedMeta: Record<string, unknown> = {
    ...meta,
    rejected_at: rejectedAt,
    ...(resolutionNote?.trim() ? { rejection_resolution: resolutionNote.trim().slice(0, 500) } : {}),
    // Nothing will ever execute for this plan, so every action is cancelled, not left "pending"
    // forever — mirrors the sequential-mode halt-and-cancel behavior in cc-approve-synthesis.ts.
    action_statuses: new Array(totalActions).fill("cancelled"),
    action_status_updated_at: rejectedAt,
  };

  const { error: updErr } = await svc.from("messages").update({ metadata: updatedMeta }).eq("id", row.id);
  if (updErr) {
    // The claim is held but the write failed: log loudly. The row stays `claimed` until the short
    // lease above expires, after which a retry can claim and write it properly — the same
    // retry-after-lease-expiry behavior approve relies on for its own write failures.
    console.error("[reject] metadata update failed:", updErr.message);
    return { ok: false, error: `rejection failed to persist: ${updErr.message}`, status: 500 };
  }

  // Terminal: never reclaimed by a future approve or reject call on this message.
  const marked = await markRelayStatus(svc, row.id as string, "failed_permanent", claim.attempt);
  if (!marked) {
    // metadata.rejected_at already landed (the fact the operator and the UI care about), but the
    // enforcement lock did not convert to its permanent form. Log it; the lease above still blocks
    // a concurrent approve for REJECT_LEASE_SECONDS, and a retry of THIS reject is idempotent via
    // the meta.rejected_at fast path above.
    console.error("[reject] markRelayStatus(failed_permanent) did not land for", row.id);
  }

  const channelId = row.channel_id as string | null;
  const tenantId = (row.tenant_id as string) || TENANT_ID;
  if (channelId) {
    const senderId = AGENT_DM_UUID["atlas"] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const { error: insertErr } = await svc.from("messages").insert({
      channel_id: channelId,
      sender_agent_id: senderId,
      sender_type: "agent",
      content: `✗ Rejected: this plan will not be executed${resolutionNote?.trim() ? ` — ${resolutionNote.trim().slice(0, 240)}` : ""}`,
      tenant_id: tenantId,
      attachments: [],
      status: "sent",
      metadata: {
        kind: "task_status",
        synthesis_id: row.id,
        new_status: "rejected",
      },
    });
    if (insertErr) {
      console.error("[reject] channel notice insert failed:", insertErr.message);
    }
  }

  return { ok: true, rejectedAt, cancelled: totalActions };
}
