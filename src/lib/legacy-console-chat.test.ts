import { describe, expect, it, vi } from "vitest";
import { sendCommanderChat } from "./legacy-console-chat";

/**
 * CC-RECOVERY-17: the classic console's chat send used to fire a second, unclaimed dispatch
 * attempt at /api/bridge/chat alongside this one. These tests pin the contract of the one
 * surviving call: exactly one fetch per send, independent of any other call, with no hidden
 * state carried between sends (a "refresh" is just a fresh call with no prior state to leak).
 */

const PARAMS = { message: "hi", agentName: "atlas", channelName: "Command Center", channelId: "cc-dashboard" };

function relayErrorMessage(parsed: unknown, status?: number): string {
  const p = (parsed ?? {}) as { detail?: string; error?: string };
  return p.detail ?? p.error ?? `failed (${status})`;
}

function jsonResponse(body: unknown, status = 200) {
  return { status, json: async () => body } as Response;
}

describe("sendCommanderChat — the one authoritative dispatch request per send", () => {
  it("issues exactly one fetch call, to /api/command-center/chat only", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => jsonResponse({ ok: true, response: "hello" }));
    await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/command-center/chat");
    // The bug this fix removes was a second, separate fetch to /api/bridge/chat alongside this
    // one. Asserting the call count is 1 is what catches that regressing.
  });

  it("reports delivered only when the route returns ok and a response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, response: "hello", source: "openclaw" }));
    const result = await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(result).toEqual({ kind: "delivered", response: "hello", source: "openclaw" });
  });

  it("reports refused, with the route's own message, when the claim is refused", async () => {
    // This is the CC-RECOVERY-14 case: no persisted message id, so the route refuses before any
    // dispatch happens. The function must surface the server's sentence, not swallow it.
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, error: "user_message_id_required", detail: "Nothing ran." }, 400),
    );
    const result = await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(result).toEqual({ kind: "refused", message: "Nothing ran." });
  });

  it("reports network_error when fetch itself throws, without throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    const result = await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(result.kind).toBe("network_error");
  });

  it("duplicate sends each make their own independent call — no shared state to race on", async () => {
    // The UI's own chatSending flag is what stops a literal double-click; this module holds no
    // state at all, so two calls in flight at once are just two independent fetches, each
    // resolving on its own. Confirms there is no module-level lock or memoized promise that would
    // make the second call silently reuse (or block on) the first.
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse({ ok: true, response: `reply ${calls}` });
    });
    const [a, b] = await Promise.all([
      sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage }),
      sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage }),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(a.kind).toBe("delivered");
    expect(b.kind).toBe("delivered");
  });

  it("recovers after a failed send — a retry is a fresh call, not stuck on the prior error", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce(jsonResponse({ ok: true, response: "second try worked" }));
    const first = await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(first.kind).toBe("network_error");
    const second = await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(second).toEqual({ kind: "delivered", response: "second try worked" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("a page refresh is just a fresh call — no hidden module state survives between invocations", async () => {
    // Simulates "send, (conceptually) reload the page, send again": since the module keeps no
    // state between calls, this is identical to the retry test above but is named for that
    // scenario explicitly, per the CC-RECOVERY-17 test list (duplicate sends, retries, refreshes,
    // error recovery).
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, response: "post-refresh reply" }));
    await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    const afterRefresh = await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
    expect(afterRefresh).toEqual({ kind: "delivered", response: "post-refresh reply" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("never calls /api/bridge/chat under any outcome", async () => {
    for (const body of [
      jsonResponse({ ok: true, response: "x" }),
      jsonResponse({ ok: false, error: "nope" }, 400),
    ]) {
      const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => body);
      await sendCommanderChat(PARAMS, { fetchImpl: fetchImpl as unknown as typeof fetch, relayErrorMessage });
      const urls = fetchImpl.mock.calls.map((c) => c[0]);
      expect(urls).not.toContain("/api/bridge/chat");
      expect(urls).toEqual(["/api/command-center/chat"]);
    }
  });
});
