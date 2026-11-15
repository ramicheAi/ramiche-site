import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * CC-RECOVERY-DELIVERY-CONVERGENCE-01: a chat message's persistence (POST
 * .../conversations/[id]/messages) and its agent-relay dispatch (this route,
 * POST /api/command-center/chat) are two separate client-initiated calls. A
 * lost-ack retry of the SEND correctly reuses the original persisted row
 * (proven in messages/route.test.ts), but that alone does nothing to stop a
 * second DISPATCH — each client attempt that reaches this route would
 * otherwise trigger its own agent turn. This file covers only the new
 * atomic claim added at the top of POST_handler (relay_claimed column);
 * it does not attempt to exercise the full agent-dispatch pipeline below it,
 * which has no pre-existing test harness in this repo.
 */

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

// Owner-only at the handler (CC-SECURITY-RECONCILIATION-02) — exercised here
// as the verified owner; authorization itself is covered elsewhere.
const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
process.env.PARALLAX_OWNER_UID = "the-real-owner-uid";

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
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

describe("POST /api/command-center/chat — relay dispatch claim", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    createClient.mockReset();
    verifySessionCookie.mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: "password" });
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  async function runWithClaim(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn().mockResolvedValue(result);
    createClient.mockReturnValue({ rpc });
    vi.resetModules();
    const { POST } = (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await POST(
      postReq({
        message: "hello",
        channelId: "11111111-1111-1111-1111-111111111111",
        userMessageId: "22222222-2222-2222-2222-222222222222",
      }),
    );
    return { res, rpc, body: await res.json() };
  }

  it("a message already claimed by a prior attempt gets no second agent dispatch", async () => {
    // cc_claim_relay_dispatch returns claimed=false: another attempt owns this message or a
    // previous dispatch is inside its lease. No second agent turn.
    const { res, rpc, body } = await runWithClaim({ data: [{ claimed: false, attempts: null }], error: null });
    expect(res.status).toBe(200);
    expect(body.alreadyDispatched).toBe(true);
    expect(rpc).toHaveBeenCalledWith("cc_claim_relay_dispatch", {
      p_message_id: "22222222-2222-2222-2222-222222222222",
      p_lease_seconds: 120,
    });
  });

  it("a delivered message is not reclaimed", async () => {
    // The function encodes the terminal-state rule; from the route's point of view this is the
    // same short-circuit. The rule itself is proven against PostgreSQL in the migration PR.
    const { body } = await runWithClaim({ data: [{ claimed: false, attempts: 3 }], error: null });
    expect(body.alreadyDispatched).toBe(true);
  });

  it("the first-ever claim proceeds to dispatch", async () => {
    const { body } = await runWithClaim({ data: [{ claimed: true, attempts: 1 }], error: null });
    expect(body.alreadyDispatched).toBeUndefined();
  });

  it("fails open when the claim function is missing — the migration is not applied yet", async () => {
    const { body } = await runWithClaim({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.cc_claim_relay_dispatch" },
    });
    expect(body.alreadyDispatched).toBeUndefined();
  });
});
