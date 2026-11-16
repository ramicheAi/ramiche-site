import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The status label the relay records for each terminal path of the JSON chat route.
 *
 * These exist because an independent review mutated every one of these labels and the full suite
 * still passed: the tests proved the response shape and the claim ordering, not the semantics. The
 * two cases below are the ones that were wrong in the reviewed head:
 *
 *   - a turn whose reply could never be written (no channelId) was recorded as `delivered`, which
 *     is terminal, so a retry was then refused with alreadyDispatched:true and the reply existed
 *     nowhere;
 *   - an exception during dispatch had to be recorded as `unknown`, not `failed`.
 */

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
process.env.PARALLAX_OWNER_UID = "the-real-owner-uid";

const { executeOpenClaw } = vi.hoisted(() => ({ executeOpenClaw: vi.fn() }));
vi.mock("@/lib/provider-adapter", () => ({
  executeOpenClaw,
  executeCompletion: vi.fn(async () => ({ ok: false, text: "" })),
  claudeModelForAgent: () => "claude-opus-5",
  lmStudioModel: () => "lmstudio-community/qwen",
  cleanEnv: (v: unknown) => v,
}));
vi.mock("@/lib/openclaw-gateway", () => ({
  isOpenClawGatewayConfigured: () => true,
  resolveChatSessionKey: (agent: string) => `agent:${agent}:main`,
  gatewaySessionsSend: vi.fn(),
}));

// The route only prefers OpenClaw when this is set; without it the test exercises the fallback
// providers and never reaches the dispatch this file is about.
const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENCLAW_CHAT_PRIMARY"] as const;
const originalEnv: Record<string, string | undefined> = {};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/command-center/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "__session=owner-session",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

function makeSvc(rpc: ReturnType<typeof vi.fn>) {
  const chain: Record<string, unknown> = {};
  for (const m of ["insert", "update", "upsert", "eq", "select", "in", "is", "order", "limit"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: { id: "agent-message-id" }, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return { rpc, from: vi.fn(() => chain) };
}

describe("POST /api/command-center/chat — relay status labels", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.OPENCLAW_CHAT_PRIMARY = "1";
    createClient.mockReset();
    executeOpenClaw.mockReset();
    executeOpenClaw.mockResolvedValue({
      ok: true,
      provider: "openclaw",
      model: "unknown",
      executionId: "e1",
      text: "hi there",
      latencyMs: 5,
    });
    verifySessionCookie.mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: "password" });
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  async function run(
    body: Record<string, unknown>,
    claimData = [{ claimed: true, attempts: 1, status: "claimed" }],
    opts: { fromThrows?: boolean; claimResult?: { data: unknown; error: unknown } } = {},
  ) {
    const rpc = vi.fn((...args: unknown[]) => {
      const fn = args[0];
      if (fn === "cc_claim_relay_dispatch") {
        return Promise.resolve(opts.claimResult ?? { data: claimData, error: null });
      }
      if (fn === "cc_mark_relay_status") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    const svc = makeSvc(rpc);
    if (opts.fromThrows) {
      // Everything after the claim touches the database through from(); making that throw drives
      // the route's outer catch, which is the only path that decides the status there.
      (svc as unknown as { from: () => never }).from = () => {
        throw new Error("connection reset");
      };
    }
    createClient.mockReturnValue(svc);
    vi.resetModules();
    const { POST } = (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await POST(postReq(body));
    const marks = rpc.mock.calls
      .filter((c) => c[0] === "cc_mark_relay_status")
      .map((c) => (c[1] as { p_status: string } | undefined)?.p_status);
    const b = await res.json().catch(() => null);
    (globalThis as unknown as { attemptedPersistence?: unknown }).attemptedPersistence = b?.persistence;
    return { res, marks, body: b };
  }

  it("never records delivered for a turn whose reply had nowhere to be written", async () => {
    const { res, marks } = await run({ message: "hello", userMessageId: "22222222-2222-2222-2222-222222222222" });
    // The turn ran, so this is not a failure of the dispatch; it is an unrecorded outcome.
    expect(marks).toContain("unknown");
    expect(marks).not.toContain("delivered");
    expect(res.status).toBe(200);
  });

  it("records delivered only when a reply was actually persisted", async () => {
    const { marks } = await run({
      message: "hello",
      channelId: "11111111-1111-1111-1111-111111111111",
      userMessageId: "22222222-2222-2222-2222-222222222222",
    });
    expect(marks).toContain("delivered");
  });

  it("records unknown, not failed, when the dispatch throws after it may have been accepted", async () => {
    executeOpenClaw.mockRejectedValue(new Error("gateway timeout"));
    const { marks } = await run({
      message: "hello",
      channelId: "11111111-1111-1111-1111-111111111111",
      userMessageId: "22222222-2222-2222-2222-222222222222",
    });
    expect(marks).toContain("unknown");
    expect(marks).not.toContain("failed");
  });

  it("records unknown, not failed, when the request throws outside the dispatch loop", async () => {
    // The outer catch is a different decision point from the per-target loop. An exception there
    // can also have fired after the gateway accepted the turn, so 'failed' would assert a
    // non-delivery we cannot prove. This pins the catch's label, which survived mutation before.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { marks } = await run(
      {
        message: "hello",
        channelId: "11111111-1111-1111-1111-111111111111",
        userMessageId: "22222222-2222-2222-2222-222222222222",
      },
      [{ claimed: true, attempts: 1, status: "claimed" }],
      { fromThrows: true },
    );
    expect(marks).toContain("unknown");
    expect(marks).not.toContain("failed");
    err.mockRestore();
  });

  it("refuses to dispatch when the request omits the message id", async () => {
    // CC-RECOVERY-14. Without an id there is no claim, so this was a complete bypass of the
    // duplicate-dispatch guarantee. It is now a 400, and no provider is touched.
    const { res, body, marks } = await run({
      message: "hello",
      channelId: "11111111-1111-1111-1111-111111111111",
    });
    expect(res.status).toBe(400);
    expect((body as { error?: string }).error).toBe("user_message_id_required");
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(marks).toEqual([]);
  });

  it("refuses to dispatch when the claim is unavailable, naming the cause", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { res, body, marks } = await run(
      {
        message: "hello",
        channelId: "11111111-1111-1111-1111-111111111111",
        userMessageId: "22222222-2222-2222-2222-222222222222",
      },
      [{ claimed: true, attempts: 1, status: "claimed" }],
      { claimResult: { data: null, error: { code: "PGRST202", message: "Could not find the function" } } },
    );
    expect(res.status).toBe(503);
    expect((body as { error?: string }).error).toBe("relay_not_deployed");
    expect(executeOpenClaw).not.toHaveBeenCalled();
    // Nothing ran, so nothing may be recorded as delivered.
    expect(marks).not.toContain("delivered");
    err.mockRestore();
  });

  it("records unknown when the gateway accepted a turn and returned no reply text", async () => {
    // Uncertain acceptance: the gateway answered, so the turn may have run. It must never be
    // recorded as either delivered or failed.
    executeOpenClaw.mockResolvedValue({
      ok: false,
      provider: "openclaw",
      model: "unknown",
      executionId: "e1",
      error: "Gateway returned no reply text (check sessions_send policy / timeout)",
      latencyMs: 9000,
    });
    const { res, marks } = await run({
      message: "hello",
      channelId: "11111111-1111-1111-1111-111111111111",
      userMessageId: "22222222-2222-2222-2222-222222222222",
    });
    expect(res.status).toBe(502);
    expect(marks).toContain("unknown");
    expect(marks).not.toContain("failed");
    expect(marks).not.toContain("delivered");
  });

  it("blames the caller for a non-UUID message id, at the route level", async () => {
    // The classifier is unit-tested, but a route that hardcoded 503 would still pass that. This goes
    // through the handler: 400, a caller-facing code, no dispatch, and no wording that sends an
    // operator to debug a healthy deduplication function.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { res, body } = await run(
      { message: "hello", channelId: "11111111-1111-1111-1111-111111111111", userMessageId: "abc" },
      [{ claimed: true, attempts: 1, status: "claimed" }],
      { claimResult: { data: null, error: { code: "22P02", message: 'invalid input syntax for type uuid: "abc"' } } },
    );
    const b = body as { error?: string; detail?: string; retryable?: boolean };
    expect(res.status).toBe(400);
    expect(b.error).toBe("invalid_message_id");
    expect(b.retryable).toBe(false);
    expect(b.detail).toMatch(/not a UUID/i);
    expect(b.detail).not.toMatch(/deduplication function/i);
    expect(executeOpenClaw).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("refuses a legacy row with the truth: not in flight, not retryable", async () => {
    const { res, body, marks } = await run(
      { message: "hello", channelId: "11111111-1111-1111-1111-111111111111", userMessageId: "22222222-2222-2222-2222-222222222222" },
      [{ claimed: false, attempts: 1, status: "legacy" }],
    );
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(marks).toEqual([]);
    expect(res.status).toBe(409);
    const b = body as { detail: string; retryable: boolean; relayStatus: string };
    expect(b.relayStatus).toBe("legacy");
    expect(b.retryable).toBe(false);
    expect(b.detail).not.toMatch(/in flight/i);
    expect(b.detail).toMatch(/new message/i);
  });

  it("does not dispatch, and reports the prior success, when the relay already delivered", async () => {
    const { marks, body } = await run(
      { message: "hello", channelId: "11111111-1111-1111-1111-111111111111", userMessageId: "22222222-2222-2222-2222-222222222222" },
      [{ claimed: false, attempts: 1, status: "delivered" }],
    );
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(marks).toEqual([]);
    expect((body as { alreadyDispatched?: boolean }).alreadyDispatched).toBe(true);
  });
});
