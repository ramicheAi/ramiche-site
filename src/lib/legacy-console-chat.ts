/**
 * The classic console's "Live Chat" send, isolated from the 2000-line page component.
 *
 * CC-RECOVERY-16/17: this send used to fire TWO independent dispatch attempts for one user
 * action — an unauthenticated write to Firestore (`/api/bridge/chat`, for `bridge-sync.mjs` to
 * eventually relay) and this call to the Postgres-relay-protected `/api/command-center/chat`.
 * The Firestore leg held no claim, no lock, and no coordination with the Postgres claim at all;
 * it was dormant only because Firestore access currently 403s, not because anything in the code
 * prevented a duplicate dispatch. That write is gone. This function is now the one authoritative
 * dispatch request this page makes per send.
 *
 * Deliberately pure (no DOM, no React state) so "exactly one request per call, independent of any
 * other call" is testable without mounting the page — same doctrine as relay-error-message.ts and
 * settings-view.ts.
 */

export type SendCommanderChatResult =
  | { kind: "delivered"; response: string; source?: string }
  | { kind: "refused"; message: string }
  | { kind: "network_error"; message: string };

export async function sendCommanderChat(
  params: { message: string; agentName: string; channelName: string; channelId: string },
  deps: {
    fetchImpl: typeof fetch;
    relayErrorMessage: (parsed: unknown, status?: number) => string;
  },
): Promise<SendCommanderChatResult> {
  try {
    const res = await deps.fetchImpl("/api/command-center/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      response?: string;
      error?: string;
      source?: string;
    };
    if (data.ok && data.response) {
      return { kind: "delivered", response: data.response, source: data.source };
    }
    // This page dispatches without a persisted message id, so since CC-RECOVERY-14 the route
    // refuses it: an agent turn cannot be claimed, and an unclaimed dispatch is exactly the
    // duplicate-execution hole the claim exists to close. Show the route's own sentence rather
    // than its machine code, so the operator sees why nothing ran instead of a mystery. This is a
    // pre-existing, separate functional gap (this UI does not yet persist a message id before
    // sending) — not something CC-RECOVERY-17 fixes; it only removes the duplicate-dispatch risk.
    return { kind: "refused", message: deps.relayErrorMessage(data, res.status) };
  } catch {
    return {
      kind: "network_error",
      message: "Network error — could not reach /api/command-center/chat",
    };
  }
}
