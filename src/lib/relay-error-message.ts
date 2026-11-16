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
export function relayErrorMessage(
  parsed: unknown,
  status: number,
  fallback = "Chat relay failed",
): string {
  const p = (parsed ?? {}) as { detail?: unknown; error?: unknown };
  if (typeof p.detail === "string" && p.detail.trim()) return p.detail;
  if (typeof p.error === "string" && p.error.trim()) return p.error;
  return `${fallback} (${status})`;
}
