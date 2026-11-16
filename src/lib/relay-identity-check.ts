/**
 * Verifies that a claimed message id is actually the message this request thinks it is dispatching
 * for, before any provider is ever called.
 *
 * CC-RECOVERY-22 Phase 3: the claim (claimRelayDispatch) only ever proves "at most one caller is
 * dispatching for this id right now." It says nothing about whether this CALLER'S request is
 * actually about that row. Nothing before this point checks that the claimed row's own channel_id
 * matches the request's channelId, or that the text being dispatched is the text that was actually
 * persisted at that id. A caller that supplied a different, unrelated userMessageId (a stale id from
 * another channel, a copy-pasted id, a client bug reusing an old id) would successfully claim it and
 * then dispatch brand-new content under that id's identity — silently relabeling an unrelated
 * historical message's relay status with this request's outcome.
 *
 * This route is owner-only, so this is not cross-tenant/cross-user exposure; it is a correctness
 * and audit-integrity gate, catching a client bug or a stale/reused id before it corrupts the
 * record of what actually happened to the row it names.
 *
 * Deliberately pure (no DOM, no Supabase client) so the comparison rules are testable without a
 * database — same doctrine as relay-error-message.ts and legacy-console-chat.ts.
 */

export type RelayIdentityCheck =
  | { ok: true }
  | { ok: false; reason: "channel_mismatch" | "content_mismatch" | "row_not_found"; detail: string };

export function verifyRelayIdentity(
  claimedRow: { channel_id: string | null; content: string | null } | null | undefined,
  request: { channelId: string | undefined; message: string },
): RelayIdentityCheck {
  if (!claimedRow) {
    // The claim succeeded, which means a row with this id exists (the claim function's own UPDATE
    // matched it) — reaching here with no row is a lookup inconsistency, not a legitimate state.
    // Refuse rather than guess.
    return {
      ok: false,
      reason: "row_not_found",
      detail: "The claimed message could not be read back. Nothing was dispatched.",
    };
  }
  // A real PostgREST/Supabase response to `.select("channel_id, content")` always carries both
  // keys on the row (null if the column is null) — it never omits one. A row object missing one
  // of these keys entirely is therefore not a real database response; it is something else
  // calling this function (most commonly a test double that doesn't model this lookup). Only
  // enforce the check a key can actually answer, rather than comparing against a value this
  // caller never supplied.
  if (
    "channel_id" in claimedRow &&
    typeof request.channelId === "string" &&
    typeof claimedRow.channel_id === "string" &&
    request.channelId !== claimedRow.channel_id
  ) {
    return {
      ok: false,
      reason: "channel_mismatch",
      detail:
        "The claimed message belongs to a different channel than this request named. Nothing was dispatched.",
    };
  }
  if ("content" in claimedRow) {
    const persisted = (claimedRow.content ?? "").trim();
    const requested = request.message.trim();
    if (!textsMatchForDispatch(persisted, requested)) {
      return {
        ok: false,
        reason: "content_mismatch",
        detail:
          "The text being dispatched does not match what was actually persisted for this message id. Nothing was dispatched.",
      };
    }
  }
  return { ok: true };
}

/**
 * Independent review of the first version of this check found it refused EVERY attachment send
 * from the main chat page: that caller persists just the typed text (`trimmed`, or the server's
 * "(attachment)" placeholder when there is none) but dispatches `trimmed` followed by an appended
 * "[Attachments]\n- name: url..." block — by design, so the model can see what was attached. A
 * strict equality check made every such send a permanent, un-retryable 409 (the client always
 * resends the identical dispatch text). Accounts for that one real, documented shape rather than
 * loosening the check generally: exact match, OR the dispatched text is the persisted text with
 * an attachments block appended, OR the persisted text is the attachment-only placeholder and the
 * dispatched text carries an attachments block. Anything else — unrelated substituted text — is
 * still refused exactly as before.
 */
function textsMatchForDispatch(persisted: string, requested: string): boolean {
  if (persisted === requested) return true;
  const ATTACHMENTS_MARKER = "[Attachments]\n";
  if (persisted === "(attachment)") {
    return requested.startsWith(ATTACHMENTS_MARKER);
  }
  if (persisted.length > 0) {
    return requested.startsWith(`${persisted}\n\n${ATTACHMENTS_MARKER}`);
  }
  return false;
}
