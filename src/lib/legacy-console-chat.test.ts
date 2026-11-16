import { describe, expect, it, vi } from "vitest";
import { sendCommanderChat, LEGACY_CONSOLE_CHANNEL_ID } from "./legacy-console-chat";

/**
 * CC-RECOVERY-16/17/18/19: the classic console's chat send has had two bugs stacked on top of
 * each other. First it fired a second, unclaimed dispatch attempt at /api/bridge/chat alongside
 * the real one (removed in CC-RECOVERY-17). Then it turned out the "real" one was never actually
 * functional either: it called /api/command-center/chat with no userMessageId, which that route
 * has refused since CC-RECOVERY-14. CC-RECOVERY-19 fixes that by persisting the message first
 * (same server-authorized endpoint the main chat page uses) and dispatching with the id the server
 * hands back. These tests pin: persist-then-dispatch happens in that order with the right id
 * threaded through, a failed persist never reaches the dispatch step, and duplicate
 * sends/retries/refreshes/error-recovery all behave correctly.
 */

const PARAMS = { message: "hi", agentName: "atlas", channelName: "Command Center", clientMessageId: "11111111-1111-1111-1111-111111111111" };
const PERSIST_URL = `/api/command-center/conversations/${LEGACY_CONSOLE_CHANNEL_ID}/messages`;

function relayErrorMessage(parsed: unknown, status?: number): string {
  const p = (parsed ?? {}) as { detail?: string; error?: string };
  return p.detail ?? p.error ?? `failed (${status})`;
}

function jsonResponse(body: unknown, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

/** A fetchImpl that persists successfully to a given id, then dispatches per `dispatchBody`. */
function fetchFixture(persistedId: string, dispatchBody: unknown, dispatchStatus = 200) {
  return vi.fn(async (url: unknown) => {
    if (url === PERSIST_URL) return jsonResponse({ data: { id: persistedId }, replay: false });
    if (url === "/api/command-center/chat") return jsonResponse(dispatchBody, dispatchStatus);
    throw new Error(`unexpected fetch to ${url}`);
  }) as unknown as typeof fetch;
}

describe("sendCommanderChat — persist first, then dispatch with the real id", () => {
  it("persists before dispatching, and sends the persisted id as userMessageId", async () => {
    const fetchImpl = fetchFixture("msg-abc-123", { ok: true, response: "hello" });
    const result = await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
    expect(result).toEqual({ kind: "delivered", response: "hello", source: undefined });
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(PERSIST_URL);
    expect(calls[1][0]).toBe("/api/command-center/chat");
    const dispatchBody = JSON.parse((calls[1][1] as RequestInit).body as string);
    expect(dispatchBody.userMessageId).toBe("msg-abc-123");
    expect(dispatchBody.channelId).toBe(LEGACY_CONSOLE_CHANNEL_ID);
  });

  it("sends the client message id on the persist call, for server-side replay on retry", async () => {
    const fetchImpl = fetchFixture("msg-1", { ok: true, response: "x" });
    await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const persistBody = JSON.parse((calls[0][1] as RequestInit).body as string);
    expect(persistBody.clientMessageId).toBe(PARAMS.clientMessageId);
    expect(persistBody.content).toBe(PARAMS.message);
  });

  it("never reaches dispatch when persistence fails — nothing is sent", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (url === PERSIST_URL) return jsonResponse({ error: { message: "db down" } }, 502);
      throw new Error("must not call anything else");
    }) as unknown as typeof fetch;
    const result = await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
    expect(result).toEqual({ kind: "not_persisted", message: "db down" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never reaches dispatch when the persist call itself throws", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (url === PERSIST_URL) throw new Error("network blip");
      throw new Error("must not call anything else");
    }) as unknown as typeof fetch;
    const result = await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
    expect(result.kind).toBe("network_error");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports refused with the route's own message when dispatch itself is refused", async () => {
    const fetchImpl = fetchFixture("msg-1", { ok: false, error: "relay_unavailable", detail: "Retry shortly." }, 503);
    const result = await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
    expect(result).toEqual({ kind: "refused", message: "Retry shortly." });
  });

  it("reports network_error when the dispatch call throws after a successful persist", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (url === PERSIST_URL) return jsonResponse({ data: { id: "msg-1" } });
      throw new Error("dispatch network blip");
    }) as unknown as typeof fetch;
    const result = await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
    expect(result.kind).toBe("network_error");
  });

  it("a retry (same clientMessageId) that replays the persisted row still dispatches with that same id", async () => {
    // The persistence route's own idempotency key means a retry with the same clientMessageId
    // returns the ORIGINAL row's id (replay:true), not a new one. This function must thread that
    // same id through to dispatch rather than treating a replay as a fresh message — otherwise a
    // retry would try to dispatch under a second, never-before-seen id with no claim history.
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (url === PERSIST_URL) return jsonResponse({ data: { id: "original-row-id" }, replay: true });
      return jsonResponse({ ok: true, response: "dispatched" });
    }) as unknown as typeof fetch;
    const result = await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
    expect(result.kind).toBe("delivered");
    const dispatchCall = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
    const dispatchBody = JSON.parse((dispatchCall[1] as RequestInit).body as string);
    expect(dispatchBody.userMessageId).toBe("original-row-id");
  });

  it("a genuine retry after a lost response dispatches exactly once more, server-claim-safe", async () => {
    // Simulates: first attempt's dispatch call is lost to the network (never resolves to this
    // caller), caller retries with the SAME clientMessageId. This function always re-calls
    // dispatch — duplicate-dispatch protection for one persisted id is the server's claim, not a
    // decision this function makes. What this function must get right is always sending the SAME
    // userMessageId on every retry, which the prior test already pins; this test just confirms
    // retrying doesn't throw or get stuck.
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse({ data: { id: "row-1" } }))
      .mockImplementationOnce(async () => {
        throw new Error("dispatch lost");
      })
      .mockImplementationOnce(async () => jsonResponse({ data: { id: "row-1" }, replay: true }))
      .mockImplementationOnce(async () => jsonResponse({ ok: true, response: "second attempt landed" }));
    const first = await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(first.kind).toBe("network_error");
    const second = await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(second).toEqual({ kind: "delivered", response: "second attempt landed" });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("duplicate sends with DIFFERENT clientMessageIds are two independent persisted messages", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (url === PERSIST_URL) {
        n += 1;
        return jsonResponse({ data: { id: `row-${n}` } });
      }
      return jsonResponse({ ok: true, response: `reply ${n}` });
    }) as unknown as typeof fetch;
    const [a, b] = await Promise.all([
      sendCommanderChat({ ...PARAMS, clientMessageId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }, { fetchImpl, relayErrorMessage }),
      sendCommanderChat({ ...PARAMS, clientMessageId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, { fetchImpl, relayErrorMessage }),
    ]);
    expect(a.kind).toBe("delivered");
    expect(b.kind).toBe("delivered");
    expect(fetchImpl).toHaveBeenCalledTimes(4); // 2 persists + 2 dispatches, no cross-talk
  });

  it("a page refresh is just a fresh call — no hidden module state survives between invocations", async () => {
    const fetchImpl = fetchFixture("row-after-refresh", { ok: true, response: "post-refresh reply" });
    await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
    const afterRefresh = await sendCommanderChat(
      { ...PARAMS, clientMessageId: "22222222-2222-2222-2222-222222222222" },
      { fetchImpl, relayErrorMessage },
    );
    expect(afterRefresh).toEqual({ kind: "delivered", response: "post-refresh reply", source: undefined });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("never calls /api/bridge/chat under any outcome", async () => {
    for (const fetchImpl of [
      fetchFixture("row-x", { ok: true, response: "x" }),
      fetchFixture("row-y", { ok: false, error: "nope" }, 400),
    ]) {
      await sendCommanderChat(PARAMS, { fetchImpl, relayErrorMessage });
      const urls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
      expect(urls).not.toContain("/api/bridge/chat");
      expect(urls).toEqual([PERSIST_URL, "/api/command-center/chat"]);
    }
  });
});
