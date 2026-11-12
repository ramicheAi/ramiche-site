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

  it("a message already claimed by a prior attempt gets no second agent dispatch", async () => {
    // Zero rows updated by the conditional UPDATE (relay_claimed was already
    // true) — simulates: attempt 1 claimed and dispatched (or is mid-
    // dispatch), attempt 2 is a lost-ack retry's relay call for the SAME
    // persisted message id.
    const query: Record<string, unknown> = { data: null, error: null };
    query.update = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.select = vi.fn(() => query);
    query.maybeSingle = vi.fn(() => query);
    const fromMock = vi.fn(() => query);
    createClient.mockReturnValue({ from: fromMock });

    vi.resetModules();
    const { POST } = (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await POST(
      postReq({ message: "hello", channelId: "11111111-1111-1111-1111-111111111111", userMessageId: "22222222-2222-2222-2222-222222222222" })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.alreadyDispatched).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("messages");
    expect(query.update).toHaveBeenCalledWith({ relay_claimed: true });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "22222222-2222-2222-2222-222222222222");
    expect(query.eq).toHaveBeenNthCalledWith(2, "relay_claimed", false);
  });

  it("the first-ever claim for a message succeeds and does NOT short-circuit", async () => {
    // One row returned: this call won the claim and must proceed to dispatch.
    const query: Record<string, unknown> = { data: { id: "22222222-2222-2222-2222-222222222222" }, error: null };
    query.update = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.select = vi.fn(() => query);
    query.maybeSingle = vi.fn(() => query);
    createClient.mockReturnValue({ from: vi.fn(() => query) });

    vi.resetModules();
    const { POST } = (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await POST(
      postReq({ message: "hello", channelId: "11111111-1111-1111-1111-111111111111", userMessageId: "22222222-2222-2222-2222-222222222222" })
    );
    const body = await res.json();
    // Proceeding past the claim means it does NOT take the short-circuit
    // shape — whatever happens next in the (unmocked) dispatch pipeline is
    // out of scope for this test, which covers only the claim itself.
    expect(body.alreadyDispatched).toBeUndefined();
  });

  it("fails open (proceeds to dispatch) when the claim query errors — e.g. the migration hasn't been applied yet", async () => {
    const query: Record<string, unknown> = { data: null, error: { code: "PGRST204", message: "Could not find the 'relay_claimed' column" } };
    query.update = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.select = vi.fn(() => query);
    query.maybeSingle = vi.fn(() => query);
    createClient.mockReturnValue({ from: vi.fn(() => query) });

    vi.resetModules();
    const { POST } = (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await POST(
      postReq({ message: "hello", channelId: "11111111-1111-1111-1111-111111111111", userMessageId: "22222222-2222-2222-2222-222222222222" })
    );
    const body = await res.json();
    expect(body.alreadyDispatched).toBeUndefined();
  });
});
