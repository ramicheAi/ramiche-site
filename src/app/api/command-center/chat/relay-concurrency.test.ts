import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * CC-RECOVERY-14: concurrency, at the route level.
 *
 * The SQL-level guarantee is proven separately (supabase/tests/relay-dispatch-scenarios.sh: 20
 * parallel claimers produce exactly one winner). This file proves the route does not undo it: two
 * simultaneous requests carrying the same message id must produce exactly one agent turn.
 *
 * The service client here simulates the database's atomic claim with a counter, so the second
 * request sees `claimed: false, status: 'claimed'`. That is what the real function returns to the
 * loser, and it is the input that makes the route dispatch or refuse.
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
  resolveChatSessionKey: (a: string) => `agent:${a}:main`,
  gatewaySessionsSend: vi.fn(),
}));

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const originalEnv: Record<string, string | undefined> = {};

const MESSAGE_ID = "22222222-2222-2222-2222-222222222222";

function postReq() {
  return new NextRequest("http://localhost/api/command-center/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "__session=owner-session",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify({
      message: "hello",
      channelId: "11111111-1111-1111-1111-111111111111",
      userMessageId: MESSAGE_ID,
    }),
  });
}

/** A client whose claim behaves like the SQL function: first caller wins, later callers lose. */
function losingClient(calls: { claims: number; marks: Array<Record<string, unknown>> }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["insert", "update", "upsert", "eq", "select", "in", "is", "order", "limit"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: { id: "reply-id" }, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [{ id: "reply-id" }], error: null }).then(resolve);

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "cc_claim_relay_dispatch") {
      calls.claims += 1;
      const won = calls.claims === 1;
      return {
        data: [{ claimed: won, attempts: 1, status: "claimed" }],
        error: null,
      };
    }
    if (fn === "cc_mark_relay_status") {
      calls.marks.push(args);
      return { data: true, error: null };
    }
    return { data: null, error: null };
  });

  return { rpc, from: vi.fn(() => chain) };
}

describe("relay claim under concurrent requests", () => {
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
    for (const k of [...ENV_KEYS, "OPENCLAW_CHAT_PRIMARY" as const]) {
      const orig = originalEnv[k];
      if (orig === undefined) delete process.env[k];
      else process.env[k] = orig;
    }
  });

  it("two simultaneous sends of the same message produce exactly one agent turn", async () => {
    const calls = { claims: 0, marks: [] as Array<Record<string, unknown>> };
    createClient.mockReturnValue(losingClient(calls));
    vi.resetModules();
    const { POST } = (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };

    const [a, b] = await Promise.all([POST(postReq()), POST(postReq())]);
    const bodies = [await a.json(), await b.json()];
    const statuses = [a.status, b.status].sort();

    // One dispatched, one refused. Never two, and never zero.
    expect(executeOpenClaw).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual([200, 409]);

    const refused = bodies[statuses.indexOf(409)];
    expect(refused.ok).toBe(false);
    expect(refused.relayStatus).toBe("claimed");
    // The loser must not be told it succeeded.
    expect(refused.alreadyDispatched).toBeUndefined();

    // Only the winner may write an outcome.
    expect(calls.marks).toHaveLength(1);
    expect(calls.marks[0]).toMatchObject({ p_message_id: MESSAGE_ID, p_status: "delivered" });
  });

  it("fences the outcome with the attempt number the claim returned", async () => {
    // A lease that expired and was re-claimed: the row is on attempt 2, and the mark must carry
    // attempt 2 or it will be refused by the database as a stale writer.
    const calls = { claims: 0, marks: [] as Array<Record<string, unknown>> };
    const client = losingClient(calls);
    client.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "cc_claim_relay_dispatch") {
        return { data: [{ claimed: true, attempts: 2, status: "claimed" }], error: null };
      }
      if (fn === "cc_mark_relay_status") {
        calls.marks.push(args);
        return { data: true, error: null };
      }
      return { data: null, error: null };
    });
    createClient.mockReturnValue(client);
    vi.resetModules();
    const { POST } = (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };

    const res = await POST(postReq());
    expect(res.status).toBe(200);
    expect(calls.marks[0]).toMatchObject({ p_attempt: 2 });
  });
});
