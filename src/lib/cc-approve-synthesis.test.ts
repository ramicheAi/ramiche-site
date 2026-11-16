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

const { executeOpenClaw } = vi.hoisted(() => ({ executeOpenClaw: vi.fn() }));
vi.mock("@/lib/provider-adapter", () => ({
  executeOpenClaw,
  executeCompletion: vi.fn(async () => ({ ok: false, text: "" })),
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

function makeSvc(rpc: ReturnType<typeof vi.fn>, metadata: Record<string, unknown>) {
  const chain: Record<string, unknown> = {};
  for (const m of ["insert", "update", "upsert", "eq", "select", "in", "is", "order", "limit"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: row(metadata), error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return { rpc, from: vi.fn(() => chain) };
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

  async function run(claimData: unknown) {
    const rpc = vi.fn((...args: unknown[]) => {
      if (args[0] === "cc_claim_relay_dispatch") return Promise.resolve({ data: claimData, error: null });
      if (args[0] === "cc_mark_relay_status") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    createClient.mockReturnValue(makeSvc(rpc, PLAN));
    vi.resetModules();
    const { approveSynthesisMessage } = await import("./cc-approve-synthesis");
    const result = await approveSynthesisMessage(SYNTHESIS_ID);
    return { result, rpc };
  }

  it("refuses to execute a plan that another approval is already running", async () => {
    const { result } = await run([{ claimed: false, attempts: 1, status: "claimed" }]);
    expect(result.ok).toBe(false);
    expect((result as { status?: number }).status).toBe(409);
    expect(String((result as { error?: string }).error)).toMatch(/already executing/i);
    expect(executeOpenClaw).not.toHaveBeenCalled();
  });

  it("refuses a plan the relay already delivered instead of running it twice", async () => {
    const { result } = await run([{ claimed: false, attempts: 1, status: "delivered" }]);
    expect(result.ok).toBe(false);
    expect((result as { status?: number }).status).toBe(409);
    expect(executeOpenClaw).not.toHaveBeenCalled();
  });

  it("claims before dispatching when the lease is won", async () => {
    const { result, rpc } = await run([{ claimed: true, attempts: 1, status: "claimed" }]);
    expect(rpc).toHaveBeenCalledWith("cc_claim_relay_dispatch", expect.objectContaining({ p_message_id: SYNTHESIS_ID }));
    expect(result.ok).toBe(true);
  });
});
