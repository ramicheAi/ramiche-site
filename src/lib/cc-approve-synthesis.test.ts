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

/** Set by makeSvc so a test can read what was actually written. */
const svcState: { updates?: Array<Record<string, unknown>> } = {};

function makeSvc(
  rpc: ReturnType<typeof vi.fn>,
  metadata: Record<string, unknown>,
  updateError: unknown = null,
  updateMatched = true,
  insertError: unknown = null,
  insertFailKinds: string[] | null = null,
) {
  const chain: Record<string, unknown> = {};
  for (const m of ["insert", "update", "upsert", "eq", "select", "in", "is", "order", "limit"]) {
    chain[m] = vi.fn(() => chain);
  }
  // The five message inserts are awaited directly, so insert() must resolve on its own.
  const updates: Array<Record<string, unknown>> = [];
  (svcState as { updates?: Array<Record<string, unknown>> }).updates = updates;
  chain.update = vi.fn((payload: Record<string, unknown>) => {
    updates.push(payload);
    return chain;
  });
  chain.insert = vi.fn(async (payload: { metadata?: { kind?: string } }) => {
    const kind = payload?.metadata?.kind;
    const fails = insertError && (!insertFailKinds || (kind && insertFailKinds.includes(kind)));
    return { data: null, error: fails ? insertError : null };
  });
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

/** Did ANY metadata write in this test carry approved_at? */
function wroteApprovedAt(): boolean {
  return (svcState.updates ?? []).some((u) => {
    const meta = u?.metadata as Record<string, unknown> | undefined;
    return !!meta && Object.prototype.hasOwnProperty.call(meta, "approved_at");
  });
}

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
    opts: {
      updateError?: unknown;
      updateMatched?: boolean;
      insertError?: unknown;
      insertFailKinds?: string[];
      blockAll?: boolean;
      dispatchText?: string;
    } = {},
  ) {
    // The call order is the whole point of the claim: a claim taken after the dispatch leaves the
    // bypass open even though every "was the RPC called" assertion still passes.
    const order: string[] = [];
    const rpc = vi.fn((...args: unknown[]) => {
      if (args[0] === "cc_claim_relay_dispatch") {
        order.push("claim");
        // A raw {data,error} may be passed to simulate a failed or malformed claim.
        if (
          claimData &&
          typeof claimData === "object" &&
          ("error" in (claimData as object) || "data" in (claimData as object)) &&
          !Array.isArray(claimData)
        ) {
          return Promise.resolve(claimData as { data: unknown; error: unknown });
        }
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
    if (opts.blockAll) {
      // Every backend down: the action is marked blocked and no message is written, which is the
      // state that must not be recorded as a delivery.
      const blocked = async () => ({ ok: false, text: "", error: "no chat backend responded" });
      executeOpenClaw.mockImplementation(blocked);
      executeCompletion.mockImplementation(blocked);
    } else if (opts.dispatchText) {
      const withText = async () => ({ ok: true, text: opts.dispatchText });
      executeOpenClaw.mockImplementation(withText);
      executeCompletion.mockImplementation(withText);
    } else {
      executeOpenClaw.mockImplementation(dispatchMock);
      executeCompletion.mockImplementation(dispatchMock);
    }
    createClient.mockReturnValue(
      makeSvc(
        rpc,
        PLAN,
        opts.updateError,
        opts.updateMatched ?? true,
        opts.insertError,
        opts.insertFailKinds ?? null,
      ),
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
    const { order, result } = await run([{ claimed: true, attempts: 1, status: "claimed" }], {
      updateError: { code: "57014", message: "canceling statement due to statement timeout" },
    });
    // The plan ran (the dispatch happened) but nothing recorded it: that is unknown, not delivered.
    expect(order).toContain("dispatch");
    expect(order).toContain("mark:unknown");
    expect(order).not.toContain("mark:delivered");
    // CC-RECOVERY-16: `persistedCleanly` used to look only at the output-message writes, so this
    // exact case — outputs fine, approval record itself failed to persist — returned ok:true with
    // no `persisted:false`, and the Telegram/web callers reported an unconditional success for a
    // run that will re-execute the whole plan on the next approval tap.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.persisted).toBe(false);
  });

  it("records unknown when the execution record matched no row at all", async () => {
    // A 0-row update returns no error. Without .select() this looked like success and was recorded
    // as delivered, which is the same false-delivery class the relay exists to prevent.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { order, result } = await run([{ claimed: true, attempts: 1, status: "claimed" }], {
      updateMatched: false,
    });
    expect(order).toContain("mark:unknown");
    expect(order).not.toContain("mark:delivered");
    // Nothing persisted: the update matched no row, so the approved_at in its payload never reached
    // the database and the run stays re-approvable. The mark, not the payload, is what matters here.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.persisted).toBe(false);
    err.mockRestore();
  });

  it("refuses to run the plan when the claim is unavailable, and dispatches nothing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, order } = await run({ data: null, error: { code: "PGRST202", message: "no function" } });
    expect(result.ok).toBe(false);
    expect((result as { status?: number }).status).toBe(503);
    expect(String((result as { error?: string }).error)).toMatch(/nothing ran/i);
    expect(order).not.toContain("dispatch");
    err.mockRestore();
  });

  it("refuses when the claim returns a malformed row", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, order } = await run({ data: [{ claimed: "yes" }], error: null });
    expect(result.ok).toBe(false);
    expect((result as { status?: number }).status).toBe(503);
    expect(order).not.toContain("dispatch");
    err.mockRestore();
  });

  it("two simultaneous approvals run the plan once", async () => {
    // The metadata guard is a read and is written only after every action finishes, so it cannot
    // stop this. The atomic claim is the only thing that can.
    //
    // "Once" is measured against a single approval rather than a hardcoded count: one approval
    // dispatches more than once internally (execute then verify), so only the comparison is
    // meaningful.
    async function runApprovals(n: number) {
      const calls = { claims: 0 };
      const order: string[] = [];
      const rpc = vi.fn((...args: unknown[]) => {
        if (args[0] === "cc_claim_relay_dispatch") {
          calls.claims += 1;
          return Promise.resolve({
            data: [{ claimed: calls.claims === 1, attempts: 1, status: "claimed" }],
            error: null,
          });
        }
        return Promise.resolve({ data: true, error: null });
      });
      createClient.mockReturnValue(makeSvc(rpc, PLAN, null, true));
      executeCompletion.mockImplementation(async () => {
        order.push("dispatch");
        return { ok: true, text: "done" };
      });
      vi.resetModules();
      const { approveSynthesisMessage } = await import("./cc-approve-synthesis");
      const results = await Promise.all(
        Array.from({ length: n }, () => approveSynthesisMessage(SYNTHESIS_ID)),
      );
      return { results, dispatches: order.filter((x) => x === "dispatch").length };
    }

    const baseline = await runApprovals(1);
    const concurrent = await runApprovals(2);

    expect(baseline.dispatches).toBeGreaterThan(0);
    expect(concurrent.results.filter((r) => r.ok)).toHaveLength(1);
    expect(concurrent.results.filter((r) => !r.ok)).toHaveLength(1);
    expect((concurrent.results.find((r) => !r.ok) as { status?: number }).status).toBe(409);
    // The second approval added no dispatch of its own.
    expect(concurrent.dispatches).toBe(baseline.dispatches);
    expect(concurrent.dispatches).toBeLessThan(baseline.dispatches * 2);
  });

  it("records unknown, never delivered, when the plan ran but its messages never persisted", async () => {
    // The P1 an independent review found in the fifth dispatcher: every deliverable insert had its
    // error discarded, and `delivered` was decided only by whether the metadata update matched a
    // row. So a run whose every output failed to persist was recorded as a terminal delivery, and a
    // retry was then refused with "already executed" while the output existed nowhere.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { order, result } = await run([{ claimed: true, attempts: 1, status: "claimed" }], {
      insertError: { code: "23502", message: "null value in column \"content\" violates not-null" },
    });
    expect(order).toContain("dispatch");
    expect(order).toContain("mark:unknown");
    expect(order).not.toContain("mark:delivered");
    const r = result as { persisted?: boolean; writeFailures?: number };
    expect(r.persisted).toBe(false);
    expect(r.writeFailures).toBeGreaterThan(0);
    err.mockRestore();
  });

  it("records unknown when every backend is down and the plan executed nothing", async () => {
    // An independent review's second P1: with all backends down, executeAction marks the action
    // blocked and writes no message, so writeFailures stayed 0 and this recorded a terminal
    // `delivered` for a plan that produced nothing. `delivered` is terminal, so the outage burned
    // the plan and every later approval was refused with "already executed".
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { order, result } = await run([{ claimed: true, attempts: 1, status: "claimed" }], {
      blockAll: true,
    });
    expect(order).toContain("mark:unknown");
    expect(order).not.toContain("mark:delivered");
    expect((result as { executed?: number }).executed).toBe(0);
    // The mechanism that makes `unknown` more than a label: no approved_at, so the card stays
    // approvable and the next approval re-claims the row and runs the plan again.
    expect(wroteApprovedAt()).toBe(false);
    err.mockRestore();
  });

  it("the complete event carries the same truth as the response", async () => {
    // The operator sees events, not the return value, so the event must carry it too.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const events: Array<Record<string, unknown>> = [];
    const rpc = vi.fn((...args: unknown[]) => {
      if (args[0] === "cc_claim_relay_dispatch") {
        return Promise.resolve({ data: [{ claimed: true, attempts: 1, status: "claimed" }], error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    createClient.mockReturnValue(makeSvc(rpc, PLAN, null, true, { code: "23502", message: "null value" }));
    executeOpenClaw.mockImplementation(async () => ({ ok: true, text: "done" }));
    executeCompletion.mockImplementation(async () => ({ ok: true, text: "done" }));
    vi.resetModules();
    const { approveSynthesisMessageStreamed } = await import("./cc-approve-synthesis");
    await approveSynthesisMessageStreamed(SYNTHESIS_ID, (e) => events.push(e as unknown as Record<string, unknown>));
    const complete = events.find((e) => e.type === "complete");
    expect(complete).toBeTruthy();
    expect(complete?.persisted).toBe(false);
    expect(complete?.writeFailures).toBeGreaterThan(0);
    err.mockRestore();
  });

  it("writes approved_at only for a run that actually delivered", async () => {
    await run([{ claimed: true, attempts: 1, status: "claimed" }]);
    expect(wroteApprovedAt()).toBe(true);
  });

  it("records delivered when an action persisted output and then self-blocked", async () => {
    // The reason the gate counts OUTPUT, not successes: a self-blocking action writes its
    // deliverable and returns blocked. `executed` is 0, but the run produced something, so it is a
    // delivery. Gating on executed instead would call this unknown and re-run the whole plan.
    const { order } = await run([{ claimed: true, attempts: 1, status: "claimed" }], {
      dispatchText: "[BLOCKED: needs the owner's decision]",
    });
    expect(order).toContain("mark:delivered");
  });

  it("a failed status pill does not turn a persisted deliverable into unknown", async () => {
    // The bookkeeping insert is not the run's output. Counting it would re-run the whole plan and
    // duplicate both the LLM spend and the deliverable.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { order } = await run([{ claimed: true, attempts: 1, status: "claimed" }], {
      insertError: { code: "23502", message: "null value" },
      insertFailKinds: ["task_status"],
    });
    expect(order).toContain("mark:delivered");
    err.mockRestore();
  });

  it("still records delivered when every write lands", async () => {
    // The gate must not make delivered unreachable.
    const { order } = await run([{ claimed: true, attempts: 1, status: "claimed" }]);
    expect(order).toContain("mark:delivered");
  });

  it("claims with a lease longer than the approval stream's own duration", async () => {
    // approve/stream has maxDuration 300 s; a lease equal to it lets a slow plan be reclaimed while
    // it is still running, which runs the whole plan twice.
    const { rpc } = await run([{ claimed: true, attempts: 1, status: "claimed" }]);
    const claimCall = rpc.mock.calls.find((c) => c[0] === "cc_claim_relay_dispatch");
    expect(claimCall?.[1]).toMatchObject({ p_lease_seconds: 600 });
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
