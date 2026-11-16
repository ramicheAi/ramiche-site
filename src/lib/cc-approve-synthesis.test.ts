import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Approving a synthesis dispatches one agent turn per plan action for ONE persisted message (the
 * synthesis row). Its own guard is `metadata.approved_at`, which is a read — and it is only written
 * after every action finishes, so two concurrent approvals both read it as absent and both execute
 * the whole plan. The relay claim is the only atomic guard in the path, and these tests pin that it
 * is taken before anything is dispatched.
 */

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { executeOpenClaw, executeCompletion } = vi.hoisted(() => ({
  executeOpenClaw: vi.fn(),
  executeCompletion: vi.fn(),
}));
vi.mock("@/lib/provider-adapter", () => ({
  executeOpenClaw,
  executeCompletion,
  claudeModelForAgent: () => "claude-opus-5",
  cleanEnv: (v: unknown) => v,
}));
vi.mock("@/lib/openclaw-gateway", () => ({
  isOpenClawGatewayConfigured: () => true,
  resolveChatSessionKey: (a: string) => `agent:${a}:main`,
}));

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const originalEnv: Record<string, string | undefined> = {};

const SYNTHESIS_ID = "33333333-3333-3333-3333-333333333333";

function row(metadata: Record<string, unknown>) {
  return {
    id: SYNTHESIS_ID,
    channel_id: "11111111-1111-1111-1111-111111111111",
    content: "plan",
    metadata,
    sender_agent_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    tenant_id: "11111111-1111-1111-1111-111111111111",
  };
}

function makeSvc(
  rpc: ReturnType<typeof vi.fn>,
  metadata: Record<string, unknown>,
  updateError: unknown = null,
  updateMatched = true,
) {
  const chain: Record<string, unknown> = {};
  for (const m of ["insert", "update", "upsert", "eq", "select", "in", "is", "order", "limit"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: row(metadata), error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  // Only the awaited writes (the metadata update and the action bookkeeping) reach `then`; the
  // synthesis read goes through `.single()`. Passing an error here makes the approve metadata write
  // fail, which is the case that must not be recorded as delivered.
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({
      // A successful update now returns the affected row (the code calls .select() to prove it
      // matched something), so "landed" has to look like a real write here.
      data: updateError || !updateMatched ? [] : [{ id: SYNTHESIS_ID }],
      error: updateError,
    }).then(resolve);
  return { rpc, from: vi.fn(() => chain) };
}

/** Any call to either dispatch primitive counts as a dispatch. */
function dispatchCalls(): number {
  return executeOpenClaw.mock.calls.length + executeCompletion.mock.calls.length;
}

const PLAN = {
  kind: "synthesis",
  plan: {
    decision: "proceed",
    actions: [{ owner: "atlas", task: "write the thing", kind: "task" }],
    execution_mode: "parallel",
  },
};

describe("approveSynthesisMessage — relay claim closes the concurrent-approval hole", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    createClient.mockReset();
    executeOpenClaw.mockReset();
    executeCompletion.mockReset();
    executeCompletion.mockResolvedValue({ ok: false, text: "" });
    executeOpenClaw.mockResolvedValue({
      ok: true,
      provider: "openclaw",
      model: "unknown",
      executionId: "e1",
      text: "done",
      latencyMs: 5,
    });
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  async function run(
    claimData: unknown,
    opts: { updateError?: unknown; updateMatched?: boolean } = {},
  ) {
    // The call order is the whole point of the claim: a claim taken after the dispatch leaves the
    // bypass open even though every "was the RPC called" assertion still passes.
    const order: string[] = [];
    const rpc = vi.fn((...args: unknown[]) => {
      if (args[0] === "cc_claim_relay_dispatch") {
        order.push("claim");
        return Promise.resolve({ data: claimData, error: null });
      }
      if (args[0] === "cc_mark_relay_status") {
        order.push(`mark:${(args[1] as { p_status: string }).p_status}`);
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    const dispatchMock = async () => {
      order.push("dispatch");
      return {
        ok: true,
        provider: "openclaw",
        model: "unknown",
        executionId: "e1",
        text: "done",
        latencyMs: 5,
      };
    };
    // Whichever primitive the plan actions use, both are a dispatch for ordering purposes.
    executeOpenClaw.mockImplementation(dispatchMock);
    executeCompletion.mockImplementation(dispatchMock);
    createClient.mockReturnValue(
      makeSvc(rpc, PLAN, opts.updateError, opts.updateMatched ?? true),
    );
    vi.resetModules();
    const { approveSynthesisMessage } = await import("./cc-approve-synthesis");
    const result = await approveSynthesisMessage(SYNTHESIS_ID);
    return { result, rpc, order };
  }

  it("refuses to execute a plan that another approval is already running", async () => {
    const { result } = await run([{ claimed: false, attempts: 1, status: "claimed" }]);
    expect(result.ok).toBe(false);
    expect((result as { status?: number }).status).toBe(409);
    // Wording is shared with the chat routes now (describeDuplicate), so assert the meaning:
    // an in-flight attempt, and nothing was dispatched.
    expect(String((result as { error?: string }).error)).toMatch(/still in flight/i);
    expect(dispatchCalls()).toBe(0);
  });

  it("refuses a plan the relay already delivered instead of running it twice", async () => {
    const { result } = await run([{ claimed: false, attempts: 1, status: "delivered" }]);
    expect(result.ok).toBe(false);
    expect((result as { status?: number }).status).toBe(409);
    expect(dispatchCalls()).toBe(0);
  });

  it("claims BEFORE the first dispatch, not merely at some point", async () => {
    // Asserting the RPC was called is not enough: moving the claim after the dispatch would leave
    // two concurrent approvals both executing the whole plan. Only the order proves the fix.
    const { result, rpc, order } = await run([{ claimed: true, attempts: 1, status: "claimed" }]);
    expect(rpc).toHaveBeenCalledWith("cc_claim_relay_dispatch", expect.objectContaining({ p_message_id: SYNTHESIS_ID }));
    expect(order).toContain("dispatch");
    expect(order.indexOf("claim")).toBe(0);
    expect(order.indexOf("claim")).toBeLessThan(order.indexOf("dispatch"));
    expect(result.ok).toBe(true);
  });

  it("records delivered only after the execution record actually landed", async () => {
    const { order } = await run([{ claimed: true, attempts: 1, status: "claimed" }]);
    // The mark must come after the dispatch, and it must be this mark.
    expect(order).toContain("mark:delivered");
    expect(order.indexOf("mark:delivered")).toBeGreaterThan(order.indexOf("dispatch"));
  });

  it("records unknown, never delivered, when the execution record fails to persist", async () => {
    const { order } = await run([{ claimed: true, attempts: 1, status: "claimed" }], {
      updateError: { code: "57014", message: "canceling statement due to statement timeout" },
    });
    // The plan ran (the dispatch happened) but nothing recorded it: that is unknown, not delivered.
    expect(order).toContain("dispatch");
    expect(order).toContain("mark:unknown");
    expect(order).not.toContain("mark:delivered");
  });

  it("records unknown when the execution record matched no row at all", async () => {
    // A 0-row update returns no error. Without .select() this looked like success and was recorded
    // as delivered, which is the same false-delivery class the relay exists to prevent.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { order } = await run([{ claimed: true, attempts: 1, status: "claimed" }], {
      updateMatched: false,
    });
    expect(order).toContain("mark:unknown");
    expect(order).not.toContain("mark:delivered");
    err.mockRestore();
  });

  it("refuses a legacy synthesis with the truth rather than asking the operator to wait", async () => {
    const { result } = await run([{ claimed: false, attempts: 1, status: "legacy" }]);
    expect(result.ok).toBe(false);
    expect((result as { status?: number }).status).toBe(409);
    expect(String((result as { error?: string }).error)).not.toMatch(/wait for it to finish/i);
    expect(String((result as { error?: string }).error)).toMatch(/new message/i);
    expect(dispatchCalls()).toBe(0);
  });
});
