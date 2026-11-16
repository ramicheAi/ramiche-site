import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The streaming route dispatches the same persisted message as /api/command-center/chat. It used
 * to do so with no relay claim at all, which made it a callable bypass around the dedup mechanism:
 * two sends of one message id through this route ran the agent twice. These tests pin that the
 * route now takes the shared claim and honours its answer.
 */

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
process.env.PARALLAX_OWNER_UID = "the-real-owner-uid";

const { executeOpenClaw } = vi.hoisted(() => ({ executeOpenClaw: vi.fn() }));
vi.mock("@/lib/provider-adapter", () => ({
  executeOpenClaw,
  streamCompletion: vi.fn(() => ({ deltas: (async function* () {})(), outcome: Promise.resolve(null) })),
}));
const { gatewayConfigured } = vi.hoisted(() => ({ gatewayConfigured: vi.fn(() => true) }));
vi.mock("@/lib/openclaw-gateway", () => ({
  isOpenClawGatewayConfigured: () => gatewayConfigured(),
  resolveChatSessionKey: (agent: string) => `agent:${agent}:main`,
  gatewaySessionsSend: vi.fn(),
}));

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const originalEnv: Record<string, string | undefined> = {};

function postReqWith(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/command-center/chat/stream", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "__session=owner-session",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

function postReq() {
  return new NextRequest("http://localhost/api/command-center/chat/stream", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "__session=owner-session",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify({ message: "hello", channelId: "11111111-1111-1111-1111-111111111111", userMessageId: "22222222-2222-2222-2222-222222222222" }),
  });
}

function makeSvc(rpc: ReturnType<typeof vi.fn>, insertResult: { data: unknown; error: unknown } = { data: { id: "agent-message-id" }, error: null }) {
  const chain = {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(insertResult),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
  };
  return { rpc, from: vi.fn(() => chain) };
}

describe("POST /api/command-center/chat/stream — relay claim", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
    gatewayConfigured.mockReturnValue(true);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    createClient.mockReset();
    executeOpenClaw.mockReset();
    executeOpenClaw.mockResolvedValue({ ok: true, provider: "openclaw", model: "unknown", executionId: "e1", text: "hi there", latencyMs: 5 });
    verifySessionCookie.mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: "password" });
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  async function runWith(
    rpcResult: { data: unknown; error: unknown },
    opts: { body?: Record<string, unknown>; insertResult?: { data: unknown; error: unknown } } = {},
  ) {
    const rpc = vi.fn().mockResolvedValue(rpcResult);
    createClient.mockReturnValue(makeSvc(rpc, opts.insertResult));
    vi.resetModules();
    const { POST } = (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await POST(opts.body ? postReqWith(opts.body) : postReq());
    const text = await res.text();
    return { res, text, rpc, svc: createClient.mock.results.at(-1)?.value as ReturnType<typeof makeSvc> };
  }

  it("claims before dispatching, and records delivery after the turn", async () => {
    const { text, rpc } = await runWith({ data: [{ claimed: true, attempts: 1, status: "claimed" }], error: null });
    expect(rpc).toHaveBeenCalledWith("cc_claim_relay_dispatch", expect.objectContaining({ p_message_id: "22222222-2222-2222-2222-222222222222" }));
    expect(executeOpenClaw).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("cc_mark_relay_status", expect.objectContaining({ p_status: "delivered", p_attempt: 1 }));
    // The dispatched reply actually reached the stream, so this is a real turn, not an early exit.
    expect(text).toContain("hi there");
    expect(text).toContain("done");
  });

  it("does not dispatch a message the relay already delivered", async () => {
    const { text } = await runWith({ data: [{ claimed: false, attempts: 1, status: "delivered" }], error: null });
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(text).toContain("alreadyDispatched");
  });

  it("does not offer a retry for a legacy row, and does not call it in flight", async () => {
    // A regression an independent review caught: `retryable` was `status !== "failed_permanent"`,
    // so a row frozen as legacy was advertised as retryable and as "still in flight". Neither is
    // true, and a client that trusts it loops forever.
    const { text } = await runWith({ data: [{ claimed: false, attempts: 1, status: "legacy" }], error: null });
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(text).toContain("dispatch_in_progress_or_failed");
    expect(text).toContain('"retryable":false');
    expect(text).not.toContain("in flight");
  });

  it("reports an in-flight attempt honestly instead of dispatching again", async () => {
    const { text } = await runWith({ data: [{ claimed: false, attempts: 1, status: "claimed" }], error: null });
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(text).toContain("dispatch_in_progress_or_failed");
    expect(text).not.toContain("alreadyDispatched");
  });

  it("refuses to dispatch when the claim RPC is missing, and says nothing ran", async () => {
    // CC-RECOVERY-14. This used to dispatch anyway and still report "done", which is the worst
    // combination: an agent turn ran with no lease and no recordable outcome.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { text } = await runWith({ data: null, error: { code: "PGRST202", message: "not found" } });
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(text).toContain("relay_not_deployed");
    expect(text).toContain('"retryable":false');
    expect(text).not.toContain('"done"');
    err.mockRestore();
  });

  it("blames the caller for a non-UUID id instead of the deduplication function", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { text } = await runWith({
      data: null,
      error: { code: "22P02", message: 'invalid input syntax for type uuid: "abc"' },
    });
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(text).toContain("invalid_message_id");
    expect(text).not.toMatch(/deduplication function/i);
    err.mockRestore();
  });

  it("refuses when the claim returns a malformed row, rather than treating it as unclaimed", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { text } = await runWith({ data: [{ claimed: "true" }], error: null });
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(text).toContain("relay_malformed");
    err.mockRestore();
  });

  it("refuses to dispatch when the request omits the message id", async () => {
    // Without an id there is nothing to claim, so this is a bypass, not a degraded mode.
    const { text, rpc } = await runWith(
      { data: [{ claimed: true, attempts: 1, status: "claimed" }], error: null },
      { body: { message: "hello", channelId: "11111111-1111-1111-1111-111111111111" } },
    );
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("cc_claim_relay_dispatch", expect.anything());
    expect(text).toContain("user_message_id_required");
  });

  it("records a thrown gateway call as unknown, never delivered", async () => {
    executeOpenClaw.mockRejectedValue(new Error("gateway timeout"));
    const { rpc } = await runWith({ data: [{ claimed: true, attempts: 2, status: "claimed" }], error: null });
    expect(rpc).toHaveBeenCalledWith("cc_mark_relay_status", expect.objectContaining({ p_status: "unknown", p_attempt: 2 }));
  });

  // The following pin the STATUS LABEL for each terminal path, not just the response shape. An
  // independent review mutated each of these labels and the whole suite still passed, so these are
  // the tests that make the honesty claim testable.

  it("records unknown, never delivered, when the reply could not be saved", async () => {
    const { rpc } = await runWith(
      { data: [{ claimed: true, attempts: 1, status: "claimed" }], error: null },
      { insertResult: { data: null, error: { code: "23503", message: "insert failed" } } },
    );
    expect(rpc).toHaveBeenCalledWith(
      "cc_mark_relay_status",
      expect.objectContaining({ p_status: "unknown", p_attempt: 1 }),
    );
    expect(rpc).not.toHaveBeenCalledWith(
      "cc_mark_relay_status",
      expect.objectContaining({ p_status: "delivered" }),
    );
  });

  it("records unknown when no channelId means there was nowhere to save the reply", async () => {
    const { rpc } = await runWith(
      { data: [{ claimed: true, attempts: 1, status: "claimed" }], error: null },
      { body: { message: "hello", userMessageId: "22222222-2222-2222-2222-222222222222" } },
    );
    expect(rpc).toHaveBeenCalledWith(
      "cc_mark_relay_status",
      expect.objectContaining({ p_status: "unknown" }),
    );
  });

  it("records failed only when no provider was even configured", async () => {
    gatewayConfigured.mockReturnValue(false);
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rpc } = await runWith({ data: [{ claimed: true, attempts: 1, status: "claimed" }], error: null });
    expect(executeOpenClaw).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "cc_mark_relay_status",
      expect.objectContaining({ p_status: "failed" }),
    );
    warn.mockRestore();
  });

  it("records unknown, not failed, when a provider was called and its error is ambiguous", async () => {
    executeOpenClaw.mockResolvedValue({ ok: false, provider: "openclaw", model: "unknown", executionId: "e", error: "Gateway returned no reply text", latencyMs: 900 });
    const { rpc } = await runWith({ data: [{ claimed: true, attempts: 1, status: "claimed" }], error: null });
    expect(rpc).toHaveBeenCalledWith(
      "cc_mark_relay_status",
      expect.objectContaining({ p_status: "unknown" }),
    );
    expect(rpc).not.toHaveBeenCalledWith(
      "cc_mark_relay_status",
      expect.objectContaining({ p_status: "failed" }),
    );
  });
});
