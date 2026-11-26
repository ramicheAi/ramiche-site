/**
 * The classic console's "Live Chat" send, isolated from the 2000-line page component.
 *
 * CC-RECOVERY-16/17 removed a second, unclaimed dispatch attempt this page used to fire at
 * Firestore (`/api/bridge/chat`) alongside the real one. That left exactly one dispatch request —
 * but CC-RECOVERY-18/19 traced it further and found that one request was *always refused*: this
 * page called `/api/command-center/chat` with no `userMessageId`, and that route has refused every
 * such call since CC-RECOVERY-14 (an unclaimed dispatch is the exact duplicate-execution hole the
 * claim exists to close). So the classic console's chat has been non-functional, not merely
 * duplicate-safe by accident.
 *
 * CC-RECOVERY-19 fixes that the same way the main chat page already does it (see
 * sendUserMessageContent in command-center/chat/page.tsx): persist the message server-side first
 * (POST /api/command-center/conversations/:id/messages, under a fixed channel id for this
 * console), take the real id the server hands back, and only then dispatch with that id so the
 * Postgres claim actually protects it.
 *
 * `clientMessageId` makes retries safe: the persistence route has its own idempotency key —
 * reusing the same id (e.g. the caller retrying after losing the response to a network blip)
 * replays the original row instead of creating a second one, exactly as it does for the main chat
 * page. Dispatch is then re-attempted with that SAME userMessageId every time, by design — "agent
 * dispatch at most once for one accepted logical turn" is enforced by the server's atomic claim on
 * that id, not by anything in this function deciding whether to call it again.
 *
 * Deliberately pure (no DOM, no React state) so "persist once, dispatch with that id, independent
 * of any other call" is testable without mounting the page — same doctrine as relay-error-message.ts
 * and settings-view.ts.
 */

/** Fixed channel id for the classic console's own Live Chat panel. Any valid UUID works — the
 *  persistence route enforces the UUID shape but does not require a pre-existing channel row —
 *  this one just has to stay the same across sends so history and dispatch agree on one channel. */
export const LEGACY_CONSOLE_CHANNEL_ID = "00000000-0000-0000-0000-00000000cc01";

export type SendCommanderChatResult =
  | { kind: "delivered"; response: string; source?: string }
  | { kind: "not_persisted"; message: string }
  | { kind: "refused"; message: string }
  | { kind: "network_error"; message: string };

type PersistResponse =
  | { data: { id: string; created_at?: string }; replay?: boolean }
  | { error: { message?: string; code?: string } };

export async function sendCommanderChat(
  params: { message: string; agentName: string; channelName: string; clientMessageId: string },
  deps: {
    fetchImpl: typeof fetch;
    relayErrorMessage: (parsed: unknown, status?: number) => string;
  },
): Promise<SendCommanderChatResult> {
  let userMessageId: string;
  try {
    const res = await deps.fetchImpl(
      `/api/command-center/conversations/${LEGACY_CONSOLE_CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: params.message,
          clientMessageId: params.clientMessageId,
          metadata: { source: "legacy-console", targetAgent: params.agentName },
        }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as PersistResponse;
    if (!res.ok || !("data" in body) || !body.data?.id) {
      const errMessage = "error" in body && body.error?.message ? body.error.message : undefined;
      // Never dispatch without a persisted id — same rule the route itself enforces, applied here
      // too so a persistence failure is reported as "nothing was sent", not silently swallowed.
      return {
        kind: "not_persisted",
        message: errMessage ?? `The message could not be saved (${res.status}). Nothing was sent.`,
      };
    }
    userMessageId = body.data.id;
  } catch {
    return {
      kind: "network_error",
      message: "Network error — could not save the message. Nothing was sent.",
    };
  }

  try {
    const res = await deps.fetchImpl("/api/command-center/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: params.message,
        agentName: params.agentName,
        channelName: params.channelName,
        channelId: LEGACY_CONSOLE_CHANNEL_ID,
        userMessageId,
      }),
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
    return { kind: "refused", message: deps.relayErrorMessage(data, res.status) };
  } catch {
    return {
      kind: "network_error",
      message: "Network error — could not reach /api/command-center/chat",
    };
  }
}
