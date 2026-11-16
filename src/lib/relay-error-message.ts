/**
 * What to show the operator when a relay request is refused.
 *
 * The routes return two things on a refusal: `error`, a stable machine code
 * (`relay_not_deployed`, `user_message_id_required`), and `detail`, the sentence written for a
 * person ("... so no agent turn was dispatched. Nothing ran."). Showing the code tells an operator
 * to debug nothing; showing the sentence tells them what happened and whether anything ran.
 *
 * This is deliberately a pure function so the choice can be tested without mounting the 3000-line
 * chat page.
 */
/** The denials a person actually hits, in words. Anything else is named, not hidden. */
const DENIAL_TEXT: Record<string, string> = {
  // An anonymous first visit is not an expired session: there was never one to expire.
  missing_session: "you are not signed in; sign in to continue",
  invalid_session: "your session expired; sign in again",
  session_expired: "your session expired; sign in again",
  not_owner: "this session is signed in, but not as this runtime's configured owner",
  owner_not_configured: "no owner is configured for this runtime yet",
  cross_site: "the request was blocked for security reasons; reload the page and try again",
  origin_mismatch: "the request was blocked for security reasons; reload the page and try again",
  missing_origin: "the request was blocked for security reasons; reload the page and try again",
  device_revoked: "this device's access was revoked; sign in with the owner account",
  device_expired: "this device's access expired; sign in with the owner account",
};

export function relayErrorMessage(
  parsed: unknown,
  status?: number,
  fallback = "Chat relay failed",
): string {
  const p = (parsed ?? {}) as { detail?: unknown; error?: unknown; reason?: unknown };
  if (typeof p.detail === "string" && p.detail.trim()) return p.detail;
  if (typeof p.error === "string" && p.error.trim()) {
    // The authorization guard answers { error: "denied", reason: "session_expired" }. Showing
    // "denied" would be the code-and-nothing-else failure again, on the most common refusal there
    // is (an expired session), so name the reason when the error is only a category.
    if (p.error === "denied" && typeof p.reason === "string" && p.reason.trim()) {
      return DENIAL_TEXT[p.reason] ?? `this request was not authorized (${p.reason})`;
    }
    return p.error;
  }
  // There is no HTTP status to name on an SSE frame, so do not invent "error (0)".
  return status && status > 0 ? `${fallback} (${status})` : fallback;
}
