import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rejecting a synthesis must never dispatch anything, must be idempotent, and must be mutually
 * exclusive with an Approve that is concurrently in flight on the same row. The real atomicity
 * argument (the relay claim) is covered by relay-dispatch.ts's own tests and by this round's
 * disposable-Postgres concurrency proof on the shared migration; these tests pin the application
 * layer's handling of every outcome that claim can return, and that nothing dispatches.
 */

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const originalEnv: Record<string, string | undefined> = {};

const SYNTHESIS_ID = "33333333-3333-3333-3333-333333333333";
const CHANNEL_ID = "11111111-1111-1111-1111-111111111111";

const PLAN_METADATA = {
  kind: "synthesis",
  plan: {
    decision: "proceed",
    actions: [
      { owner: "atlas", task: "write the thing" },
      { owner: "vee", task: "ship the other thing" },
    ],
    execution_mode: "parallel",
  },
};

function row(metadata: Record<string, unknown>) {
  return {
    id: SYNTHESIS_ID,
    channel_id: CHANNEL_ID,
    metadata,
    tenant_id: CHANNEL_ID,
  };
}

/** Records every insert and update payload so tests can assert nothing (or the right thing) was written. */
function makeSvc(
  rpc: ReturnType<typeof vi.fn>,
  initialMetadata: Record<string, unknown>,
  opts: { rereadMetadata?: Record<string, unknown> } = {},
) {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  let readCount = 0;

  const chain: Record<string, unknown> = {};
  for (const m of ["eq", "select", "order", "limit"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.insert = vi.fn(async (payload: Record<string, unknown>) => {
    inserts.push(payload);
    return { data: null, error: null };
  });
  chain.update = vi.fn((payload: Record<string, unknown>) => {
    updates.push(payload);
    return chain;
  });
  chain.single = vi.fn(async () => {
    readCount += 1;
    // First .single() is the initial read; a second (only reached on the already-rejected
    // duplicate path) returns the fresh re-read metadata, simulating what the claim's own
    // concurrent writer already landed.
    const meta = readCount === 1 ? initialMetadata : opts.rereadMetadata ?? initialMetadata;
    return { data: row(meta), error: null };
  });
  // update().eq() has no further chained method call in this code path (no .select() after
  // .update() in cc-reject-synthesis.ts), so give it a `then` for the awaited update call itself.
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve);

  return { rpc, from: vi.fn(() => chain), __inserts: inserts, __updates: updates };
}

describe("rejectSynthesisMessage", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    createClient.mockReset();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  function rpcFor(claimResult: { claimed: boolean; attempts?: number; status?: string }) {
    return vi.fn((name: string, args: Record<string, unknown>) => {
      if (name === "cc_claim_relay_dispatch") {
        return Promise.resolve({ data: [claimResult], error: null });
      }
      if (name === "cc_mark_relay_status") {
        expect(args.p_status).toBe("failed_permanent");
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  }

  async function run(metadata: Record<string, unknown>, rpc: ReturnType<typeof vi.fn>, note?: string) {
    createClient.mockReturnValue(makeSvc(rpc, metadata));
    vi.resetModules();
    const { rejectSynthesisMessage } = await import("./cc-reject-synthesis");
    return rejectSynthesisMessage(SYNTHESIS_ID, note);
  }

  it("claims, writes rejected_at, marks the relay terminal, and posts a channel notice", async () => {
    const rpc = rpcFor({ claimed: true, attempts: 1 });
    const result = await run(PLAN_METADATA, rpc, "weak plan");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.rejectedAt).toBe("string");
      expect(result.alreadyRejected).toBeUndefined();
      expect(result.cancelled).toBe(2);
    }
    expect(rpc).toHaveBeenCalledWith(
      "cc_claim_relay_dispatch",
      expect.objectContaining({ p_message_id: SYNTHESIS_ID }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "cc_mark_relay_status",
      expect.objectContaining({ p_message_id: SYNTHESIS_ID, p_status: "failed_permanent" }),
    );
  });

  it("writes action_statuses as cancelled for every action, never leaving one pending forever", async () => {
    const rpc = rpcFor({ claimed: true, attempts: 1 });
    createClient.mockReturnValue((() => {
      const svc = makeSvc(rpc, PLAN_METADATA);
      return svc;
    })());
    vi.resetModules();
    const svcInstance = createClient();
    createClient.mockReturnValue(svcInstance);
    const { rejectSynthesisMessage } = await import("./cc-reject-synthesis");
    await rejectSynthesisMessage(SYNTHESIS_ID);
    const updates = (svcInstance as unknown as { __updates: Array<Record<string, unknown>> }).__updates;
    const metaUpdate = updates.find((u) => u.metadata);
    const statuses = (metaUpdate?.metadata as Record<string, unknown> | undefined)?.action_statuses;
    expect(statuses).toEqual(["cancelled", "cancelled"]);
  });

  it("is idempotent: rejecting an already-rejected synthesis returns ok without re-claiming", async () => {
    const rpc = rpcFor({ claimed: true });
    const rejectedAt = "2026-11-16T00:00:00.000Z";
    const result = await run({ ...PLAN_METADATA, rejected_at: rejectedAt }, rpc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyRejected).toBe(true);
      expect(result.rejectedAt).toBe(rejectedAt);
    }
    // The fast read-only path returns before the claim is ever attempted.
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses to reject a synthesis that was already approved (fast path)", async () => {
    const rpc = rpcFor({ claimed: true });
    const result = await run({ ...PLAN_METADATA, approved_at: "2026-11-16T00:00:00.000Z" }, rpc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/already approved/i);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses when the claim loses the race to a concurrently in-flight approve", async () => {
    const rpc = rpcFor({ claimed: false, status: "claimed" });
    const result = await run(PLAN_METADATA, rpc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/in flight/i);
    }
  });

  it("refuses when the claim finds the plan already delivered", async () => {
    const rpc = rpcFor({ claimed: false, status: "delivered" });
    const result = await run(PLAN_METADATA, rpc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/already approved and executed/i);
    }
  });

  it("is idempotent even when the claim itself (not the metadata read) discovers the prior rejection", async () => {
    // Simulates the real race: two reject calls land close together, the metadata read for the
    // second one still shows no rejected_at (stale), but its claim attempt loses to the first and
    // sees failed_permanent. It must still report success, with the real timestamp.
    const rejectedAt = "2026-11-16T00:00:05.000Z";
    const rpc = rpcFor({ claimed: false, status: "failed_permanent" });
    createClient.mockReturnValue(makeSvc(rpc, PLAN_METADATA, { rereadMetadata: { ...PLAN_METADATA, rejected_at: rejectedAt } }));
    vi.resetModules();
    const { rejectSynthesisMessage } = await import("./cc-reject-synthesis");
    const result = await rejectSynthesisMessage(SYNTHESIS_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyRejected).toBe(true);
      expect(result.rejectedAt).toBe(rejectedAt);
    }
  });

  it("refuses with a 404 when the message does not exist", async () => {
    const rpc = vi.fn();
    createClient.mockReturnValue({
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: null, error: { message: "no rows" } }) }),
        }),
      }),
    });
    vi.resetModules();
    const { rejectSynthesisMessage } = await import("./cc-reject-synthesis");
    const result = await rejectSynthesisMessage(SYNTHESIS_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a message that is not a synthesis", async () => {
    const rpc = vi.fn();
    createClient.mockReturnValue(makeSvc(rpc, { kind: "chat" }));
    vi.resetModules();
    const { rejectSynthesisMessage } = await import("./cc-reject-synthesis");
    const result = await rejectSynthesisMessage(SYNTHESIS_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a bad messageId without ever touching Supabase", async () => {
    const rpc = vi.fn();
    createClient.mockReturnValue(makeSvc(rpc, PLAN_METADATA));
    vi.resetModules();
    const { rejectSynthesisMessage } = await import("./cc-reject-synthesis");
    const result = await rejectSynthesisMessage("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the claim is unavailable, and never writes rejected_at", async () => {
    const rpc = vi.fn((name: string) => {
      if (name === "cc_claim_relay_dispatch") {
        return Promise.resolve({ data: null, error: { code: "PGRST202", message: "function not found" } });
      }
      return Promise.resolve({ data: null, error: null });
    });
    const svc = makeSvc(rpc, PLAN_METADATA);
    createClient.mockReturnValue(svc);
    vi.resetModules();
    const { rejectSynthesisMessage } = await import("./cc-reject-synthesis");
    const result = await rejectSynthesisMessage(SYNTHESIS_ID);
    expect(result.ok).toBe(false);
    const updates = (svc as unknown as { __updates: Array<Record<string, unknown>> }).__updates;
    expect(updates.length).toBe(0);
  });
});
