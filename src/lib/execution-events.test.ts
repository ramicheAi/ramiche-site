/**
 * Execution events (P06 Packet 3): the truth rules of telemetry. Each test states a rule that a wrong
 * implementation would break: unknown stays unknown, zeros from the Claude Max proxy are not measurements,
 * a missing total is never synthesized, the requested model is never replaced by the reported one, telemetry
 * can never alter or fail an execution, and nothing sensitive is persisted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { clientFiles, clientFilesReaching } from "./client-boundary.test-helper";

/* ── fakes ────────────────────────────────────────────────────────────── */
type Row = Record<string, unknown> & { id: string };
type DbMode = "ok" | "error" | "hang" | "throw" | "none";
const db: { mode: DbMode; rows: Map<string, Row>; calls: { table: string; row: Row; opts: Record<string, unknown>; aborted?: () => boolean }[] } = {
  mode: "ok",
  rows: new Map(),
  calls: [],
};
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => {
    if (db.mode === "none") return null;
    return {
      from: (table: string) => ({
        upsert: (row: Row, opts: Record<string, unknown>) => {
          if (db.mode === "throw") throw new Error("client exploded: sk-live-SECRET");
          let signal: AbortSignal | undefined;
          db.calls.push({ table, row, opts, aborted: () => Boolean(signal?.aborted) });
          const q = {
            abortSignal(s: AbortSignal) {
              signal = s;
              return q;
            },
            then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
              if (db.mode === "hang") return new Promise(() => {}).then(resolve, reject); // never settles
              if (db.mode === "error") {
                return Promise.resolve({ error: { code: "42P01", message: 'relation "execution_events" does not exist' } }).then(resolve, reject);
              }
              // Honour the idempotency contract the real database enforces: ON CONFLICT (id) DO NOTHING.
              if (opts.onConflict === "id" && opts.ignoreDuplicates === true) {
                if (!db.rows.has(row.id)) db.rows.set(row.id, row);
              } else {
                db.rows.set(row.id, row); // a non-idempotent write would overwrite, or in real SQL raise on duplicates
              }
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return q;
        },
      }),
    };
  },
}));

const gw = { calls: [] as unknown[][], result: { ok: false, error: "gateway down" } as { ok: boolean; reply?: string; error?: string }, throws: false };
vi.mock("@/lib/openclaw-gateway", async () => {
  const actual = await vi.importActual<typeof import("@/lib/openclaw-gateway")>("@/lib/openclaw-gateway");
  return {
    ...actual,
    isOpenClawGatewayConfigured: () => true,
    gatewaySessionsSend: async (...a: unknown[]) => {
      gw.calls.push(a);
      if (gw.throws) throw new Error("gateway blew up");
      return gw.result;
    },
  };
});

import {
  EXECUTION_PURPOSES,
  EXECUTION_PROVIDERS,
  USAGE_QUALITIES,
  BILLING_MODES,
  EXECUTION_OUTCOMES,
  EXECUTION_ERROR_CLASSES,
  CORRELATION_TYPES,
  EXECUTION_EVENT_WRITE_TIMEOUT_MS,
  normalizeUsage,
  billingModeFor,
  buildExecutionEvent,
  recordExecution,
  getExecutionTelemetryHealth,
  __resetExecutionTelemetryForTests,
  type ExecutionFacts,
} from "./execution-events";
import { executeCompletion, streamCompletion, executeOpenClaw } from "./provider-adapter";

/* ── helpers ──────────────────────────────────────────────────────────── */
const rows = () => [...db.rows.values()];
const only = () => {
  expect(rows()).toHaveLength(1);
  return rows()[0];
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const ok = (content: string, extra: object = {}) => json({ choices: [{ message: { content }, finish_reason: "stop" }], ...extra });
let lastFetchBody = "";
function mockFetch(responder: () => Response | Error | "hang") {
  vi.stubGlobal("fetch", async (_u: string, init?: RequestInit) => {
    lastFetchBody = String(init?.body ?? "");
    const r = responder();
    if (r === "hang") return new Promise(() => {});
    if (r instanceof Error) throw r;
    return r;
  });
}
const msgs = [
  { role: "system" as const, content: "SYSTEM-PROMPT-CONFIDENTIAL" },
  { role: "user" as const, content: "USER-PROMPT-CONFIDENTIAL" },
];
const call = (over: Record<string, unknown> = {}) =>
  executeCompletion({ provider: "claude-max", model: "claude-opus-4-6", messages: msgs, maxTokens: 10, temperature: 0, timeoutMs: 5000, context: { purpose: "agent-reply", agentId: "atlas" }, ...over } as never);
const facts = (over: Partial<ExecutionFacts> = {}): ExecutionFacts => ({
  executionId: "11111111-1111-4111-8111-111111111111",
  startedAtMs: Date.UTC(2026, 8, 30, 12, 0, 0),
  latencyMs: 120,
  provider: "claude-max",
  context: { purpose: "agent-reply", agentId: "atlas" },
  modelRequested: "claude-opus-4-6",
  hasText: true,
  ...over,
});

beforeEach(() => {
  db.mode = "ok";
  db.rows = new Map();
  db.calls = [];
  gw.calls = [];
  gw.throws = false;
  gw.result = { ok: false, error: "gateway down" };
  process.env.CC_EXECUTION_EVENTS = "1";
  __resetExecutionTelemetryForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.CC_EXECUTION_EVENTS;
});

/* ═══ usage normalization ═════════════════════════════════════════════════ */
describe("usage normalization", () => {
  it("Claude Max all-zero usage is UNKNOWN, not measured", () => {
    expect(normalizeUsage("claude-max", { promptTokens: 0, completionTokens: 0, totalTokens: 0 })).toEqual({
      input: null,
      output: null,
      total: null,
      quality: "ambiguous_proxy_zero",
    });
  });

  it("a proxy zero is only ambiguous for claude-max; zeros from other providers are kept as reported", () => {
    expect(normalizeUsage("lm-studio", { promptTokens: 0, completionTokens: 0, totalTokens: 0 })).toEqual({ input: 0, output: 0, total: 0, quality: "provider_reported" });
  });

  it("real Claude Max usage is preserved exactly as supplied", () => {
    expect(normalizeUsage("claude-max", { promptTokens: 1200, completionTokens: 340, totalTokens: 1540 })).toEqual({ input: 1200, output: 340, total: 1540, quality: "provider_reported" });
  });

  it("partial usage stays partial and a missing total is NEVER derived", () => {
    expect(normalizeUsage("lm-studio", { promptTokens: 9 })).toEqual({ input: 9, output: null, total: null, quality: "partial" });
    expect(normalizeUsage("claude-max", { promptTokens: 30, completionTokens: 12 })).toEqual({ input: 30, output: 12, total: null, quality: "partial" });
    expect(normalizeUsage("gemini", { totalTokens: 44 })).toEqual({ input: null, output: null, total: 44, quality: "partial" });
  });

  it("absent or non-numeric usage is not_reported with no numbers", () => {
    for (const u of [undefined, {}, { promptTokens: undefined }, { promptTokens: NaN }, { promptTokens: -1 }, { promptTokens: "12" as unknown as number }]) {
      expect(normalizeUsage("claude-max", u), JSON.stringify(u)).toEqual({ input: null, output: null, total: null, quality: "not_reported" });
    }
  });

  it("a zero mixed with real counts is kept as reported (only an ALL-zero object is ambiguous)", () => {
    expect(normalizeUsage("claude-max", { promptTokens: 0, completionTokens: 7, totalTokens: 7 })).toMatchObject({ input: 0, output: 7, quality: "provider_reported" });
  });
});

/* ═══ event building ═════════════════════════════════════════════════════ */
describe("buildExecutionEvent", () => {
  it("records the requested model exactly and the reported family label separately", () => {
    const r = buildExecutionEvent(facts({ modelRequested: "claude-opus-4-6", modelReported: "claude-sonnet-4" }));
    expect(r.model_requested).toBe("claude-opus-4-6");
    expect(r.model_reported).toBe("claude-sonnet-4");
  });

  it("OpenClaw's model stays unknown even if something claims one", () => {
    const r = buildExecutionEvent(facts({ provider: "openclaw", modelRequested: "claude-opus-4-6", modelReported: "claude-opus-4" }));
    expect(r.model_requested).toBeNull();
    expect(r.model_reported).toBeNull();
    expect(r.usage_quality).toBe("not_reported");
    expect(r.billing_mode).toBe("unknown");
  });

  it("direct cost is null for every provider, including Claude Max and LM Studio", () => {
    for (const provider of EXECUTION_PROVIDERS) {
      const r = buildExecutionEvent(facts({ provider, usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 } }));
      expect(r.direct_cost_usd, provider).toBeNull();
    }
    expect(billingModeFor("claude-max")).toBe("subscription");
    expect(billingModeFor("lm-studio")).toBe("local");
    expect(billingModeFor("gemini")).toBe("unknown");
  });

  it("classifies outcomes: ok, empty, error with class and status", () => {
    expect(buildExecutionEvent(facts()).outcome).toBe("ok");
    expect(buildExecutionEvent(facts({ hasText: false })).outcome).toBe("empty");
    const http = buildExecutionEvent(facts({ hasText: false, failure: { kind: "http", httpStatus: 502 } }));
    expect(http).toMatchObject({ outcome: "error", error_class: "http", http_status: 502 });
    const timeout = buildExecutionEvent(facts({ hasText: false, failure: { kind: "timeout" } }));
    expect(timeout).toMatchObject({ outcome: "error", error_class: "timeout", http_status: null });
    expect(buildExecutionEvent(facts()).error_class).toBeNull();
  });

  it("typed correlation is a pair, and absent correlation is a pair of nulls", () => {
    const withC = buildExecutionEvent(facts({ context: { purpose: "job", correlation: { type: "job", id: "job-1" } } }));
    expect([withC.correlation_type, withC.correlation_id]).toEqual(["job", "job-1"]);
    const without = buildExecutionEvent(facts());
    expect([without.correlation_type, without.correlation_id]).toEqual([null, null]);
    expect(without.mission_id).toBeNull();
  });

  it("carries only facts: no message, body or error text can exist on the row", () => {
    const r = buildExecutionEvent(facts({ streamed: true, finishReason: "stop", usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } }));
    expect(Object.keys(r).sort()).toEqual(
      [
        "agent_id", "billing_mode", "correlation_id", "correlation_type", "direct_cost_usd", "error_class", "http_status", "id",
        "input_tokens", "latency_ms", "metadata", "mission_id", "model_reported", "model_requested", "outcome", "output_tokens",
        "provider", "purpose", "started_at", "total_tokens", "usage_quality",
      ].sort(),
    );
    expect(r.metadata).toEqual({ streamed: true, finish_reason: "stop" });
  });
});

/* ═══ the recorder: bounded, idempotent, never throws ═════════════════════ */
describe("recordExecution", () => {
  it("writes nothing unless explicitly enabled", async () => {
    delete process.env.CC_EXECUTION_EVENTS;
    await recordExecution(facts());
    expect(db.calls).toHaveLength(0);
    expect(getExecutionTelemetryHealth()).toMatchObject({ enabled: false, skippedDisabled: 1, attempted: 0 });
  });

  it("persists the exact row, once, through an idempotent upsert on the primary key", async () => {
    await recordExecution(facts({ usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 } }));
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].table).toBe("execution_events");
    expect(db.calls[0].opts).toEqual({ onConflict: "id", ignoreDuplicates: true });
    expect(only()).toMatchObject({ id: "11111111-1111-4111-8111-111111111111", provider: "claude-max", input_tokens: 5, output_tokens: 2, total_tokens: 7, usage_quality: "provider_reported" });
    expect(getExecutionTelemetryHealth()).toMatchObject({ attempted: 1, persisted: 1, failed: 0 });
  });

  it("a second attempt with the same execution id cannot create a second event", async () => {
    await recordExecution(facts());
    await recordExecution(facts({ hasText: false })); // same id, different content: the first write wins
    expect(db.calls).toHaveLength(1); // in-process guard
    expect(rows()).toHaveLength(1);
    // and even if the in-process guard were gone (fresh process), the database contract still refuses a duplicate
    __resetExecutionTelemetryForTests();
    await recordExecution(facts({ hasText: false }));
    expect(db.calls).toHaveLength(2);
    expect(rows()).toHaveLength(1);
    expect(only().outcome).toBe("ok");
  });

  it("a failing database is observable and never throws", async () => {
    db.mode = "error";
    await expect(recordExecution(facts())).resolves.toBeUndefined();
    const h = getExecutionTelemetryHealth();
    expect(h).toMatchObject({ attempted: 1, persisted: 0, failed: 1 });
    expect(h.lastError).toContain("42P01");
    expect(console.error).toHaveBeenCalled();
  });

  it("a client that throws synchronously never throws out of telemetry, and its message is not stored", async () => {
    db.mode = "throw";
    await expect(recordExecution(facts())).resolves.toBeUndefined();
    expect(getExecutionTelemetryHealth().failed).toBe(1);
  });

  it("a missing database client is a no-op, not an error", async () => {
    db.mode = "none";
    await expect(recordExecution(facts())).resolves.toBeUndefined();
    expect(getExecutionTelemetryHealth()).toMatchObject({ skippedNoClient: 1, failed: 0 });
  });

  it("a hung database is cut off at the bound and aborted", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    db.mode = "hang";
    let done = false;
    const p = recordExecution(facts()).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(EXECUTION_EVENT_WRITE_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    expect(getExecutionTelemetryHealth()).toMatchObject({ timedOut: 1, persisted: 0 });
    expect(db.calls[0].aborted?.()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(EXECUTION_EVENT_WRITE_TIMEOUT_MS).toBeLessThanOrEqual(1000);
  });

  it("makes ONE attempt, never retries, and opens a circuit after repeated failures", async () => {
    db.mode = "error";
    for (let i = 0; i < 3; i++) await recordExecution(facts({ executionId: `00000000-0000-4000-8000-00000000000${i}` }));
    expect(db.calls).toHaveLength(3); // exactly one attempt per event
    expect(getExecutionTelemetryHealth().circuitOpen).toBe(true);
    await recordExecution(facts({ executionId: "00000000-0000-4000-8000-000000000009" }));
    expect(db.calls).toHaveLength(3); // circuit open: no further attempts, no waiting
    expect(getExecutionTelemetryHealth().skippedCircuitOpen).toBe(1);
  });

  it("a success closes the failure streak", async () => {
    db.mode = "error";
    await recordExecution(facts({ executionId: "00000000-0000-4000-8000-000000000001" }));
    await recordExecution(facts({ executionId: "00000000-0000-4000-8000-000000000002" }));
    db.mode = "ok";
    await recordExecution(facts({ executionId: "00000000-0000-4000-8000-000000000003" }));
    db.mode = "error";
    await recordExecution(facts({ executionId: "00000000-0000-4000-8000-000000000004" }));
    await recordExecution(facts({ executionId: "00000000-0000-4000-8000-000000000005" }));
    expect(getExecutionTelemetryHealth().circuitOpen).toBe(false);
  });
});

/* ═══ through the Provider Adapter ════════════════════════════════════════ */
describe("adapter emits truthful events", () => {
  it("Claude Max: proxy all-zero usage on a non-empty reply is stored as unknown with provenance", async () => {
    mockFetch(() => ok("a real answer", { model: "claude-sonnet-4", usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }));
    const r = await call();
    expect(r.ok && r.text).toBe("a real answer");
    expect(only()).toMatchObject({
      provider: "claude-max", outcome: "ok", input_tokens: null, output_tokens: null, total_tokens: null,
      usage_quality: "ambiguous_proxy_zero", direct_cost_usd: null, billing_mode: "subscription",
    });
  });

  it("Claude Max: real usage is persisted accurately", async () => {
    mockFetch(() => ok("hi", { model: "claude-opus-4", usage: { prompt_tokens: 812, completion_tokens: 96, total_tokens: 908 } }));
    await call();
    expect(only()).toMatchObject({ input_tokens: 812, output_tokens: 96, total_tokens: 908, usage_quality: "provider_reported", latency_ms: expect.any(Number) });
  });

  it("partial usage stays partial and a missing total stays null", async () => {
    mockFetch(() => ok("hi", { usage: { prompt_tokens: 50, completion_tokens: 7 } }));
    await call({ provider: "lm-studio", model: undefined });
    expect(only()).toMatchObject({ input_tokens: 50, output_tokens: 7, total_tokens: null, usage_quality: "partial", provider: "lm-studio", billing_mode: "local", direct_cost_usd: null });
  });

  it("absent usage is unknown, never zero", async () => {
    mockFetch(() => ok("hi"));
    await call();
    expect(only()).toMatchObject({ input_tokens: null, output_tokens: null, total_tokens: null, usage_quality: "not_reported" });
  });

  it("the reported family label never overwrites the exact requested model", async () => {
    mockFetch(() => ok("hi", { model: "claude-sonnet-4", usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
    await call({ model: "claude-opus-4-6" });
    expect(only()).toMatchObject({ model_requested: "claude-opus-4-6", model_reported: "claude-sonnet-4" });
  });

  it("an unpinned model stays unknown (LM Studio), and a missing reported model stays null", async () => {
    mockFetch(() => ok("hi"));
    await call({ provider: "lm-studio", model: undefined });
    expect(only()).toMatchObject({ model_requested: null, model_reported: null });
  });

  it("OpenClaw: model unknown, no usage, gateway failure classified as such", async () => {
    gw.result = { ok: true, reply: "from claw" };
    const good = await executeOpenClaw({ sessionKey: "k", message: "m", timeoutSeconds: 5, context: { purpose: "agent-reply", agentId: "shuri" } });
    expect(good.ok && good.text).toBe("from claw");
    expect(only()).toMatchObject({ provider: "openclaw", model_requested: null, model_reported: null, usage_quality: "not_reported", outcome: "ok", agent_id: "shuri", billing_mode: "unknown" });
    db.rows = new Map();
    gw.result = { ok: false, error: "ws timeout" };
    await executeOpenClaw({ sessionKey: "k", message: "m", timeoutSeconds: 5, context: { purpose: "agent-reply" } });
    expect(only()).toMatchObject({ outcome: "error", error_class: "gateway" });
  });

  it("OpenClaw: a throwing gateway is recorded, and the same error still reaches the caller", async () => {
    gw.throws = true;
    await expect(executeOpenClaw({ sessionKey: "k", message: "m", timeoutSeconds: 5, context: { purpose: "agent-reply" } })).rejects.toThrow("gateway blew up");
    expect(only()).toMatchObject({ outcome: "error", error_class: "exception" });
  });

  it("failed calls produce truthful failure events", async () => {
    mockFetch(() => new Response("upstream said SECRET-UPSTREAM-BODY", { status: 502 }));
    await call({ captureErrorBody: true });
    expect(only()).toMatchObject({ outcome: "error", error_class: "http", http_status: 502, input_tokens: null, usage_quality: "not_reported" });
    db.rows = new Map();
    mockFetch(() => new Error("ECONNREFUSED sk-ant-SECRET-KEY"));
    await call();
    expect(only()).toMatchObject({ outcome: "error", error_class: "exception", http_status: null });
    db.rows = new Map();
    mockFetch(() => Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    await call();
    expect(only()).toMatchObject({ outcome: "error", error_class: "timeout" });
    db.rows = new Map();
    mockFetch(() => ok(""));
    await call();
    expect(only()).toMatchObject({ outcome: "empty", error_class: null });
  });

  it("agent, purpose and typed correlation reach the row", async () => {
    mockFetch(() => ok("hi"));
    await call({ context: { purpose: "synthesis", agentId: "atlas", correlation: { type: "chat_message", id: "msg-42" } } });
    expect(only()).toMatchObject({ purpose: "synthesis", agent_id: "atlas", correlation_type: "chat_message", correlation_id: "msg-42", mission_id: null });
  });

  it("NO prompt, response, credential or upstream error text is ever persisted", async () => {
    const secrets = ["SYSTEM-PROMPT-CONFIDENTIAL", "USER-PROMPT-CONFIDENTIAL", "RESPONSE-CONFIDENTIAL", "SECRET-UPSTREAM-BODY", "sk-ant-SECRET-KEY", "sk-live-SECRET", "Bearer"];
    mockFetch(() => ok("RESPONSE-CONFIDENTIAL", { usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } }));
    await call();
    mockFetch(() => new Response("SECRET-UPSTREAM-BODY", { status: 500 }));
    await call({ captureErrorBody: true });
    mockFetch(() => new Error("failed with sk-ant-SECRET-KEY"));
    await call();
    db.mode = "throw"; // and the failing-client path must not leak its message into anything stored either
    await call();
    expect(db.rows.size).toBeGreaterThanOrEqual(3);
    const stored = JSON.stringify([...db.rows.values()]) + JSON.stringify(getExecutionTelemetryHealth());
    for (const s of secrets) expect(stored, s).not.toContain(s);
    expect(lastFetchBody).toContain("USER-PROMPT-CONFIDENTIAL"); // the prompt did go to the provider, just not to telemetry
  });

  it("execution results are IDENTICAL whether telemetry is on, off, failing or hung", async () => {
    const strip = (r: Record<string, unknown>) => {
      const { latencyMs, executionId, ...rest } = r;
      void latencyMs;
      void executionId;
      return rest;
    };
    mockFetch(() => ok("same answer", { model: "claude-opus-4", usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 } }));
    delete process.env.CC_EXECUTION_EVENTS;
    const off = strip((await call()) as never);
    process.env.CC_EXECUTION_EVENTS = "1";
    const on = strip((await call()) as never);
    db.mode = "error";
    __resetExecutionTelemetryForTests();
    const failing = strip((await call()) as never);
    db.mode = "throw";
    __resetExecutionTelemetryForTests();
    const throwing = strip((await call()) as never);
    expect(on).toEqual(off);
    expect(failing).toEqual(off);
    expect(throwing).toEqual(off);
    expect(off).toMatchObject({ ok: true, text: "same answer", usage: { promptTokens: 11, completionTokens: 3, totalTokens: 14 } });
    // failures are unchanged too
    mockFetch(() => new Response("nope", { status: 500 }));
    db.mode = "ok";
    delete process.env.CC_EXECUTION_EVENTS;
    const badOff = strip((await call()) as never);
    process.env.CC_EXECUTION_EVENTS = "1";
    __resetExecutionTelemetryForTests();
    db.mode = "throw";
    const badOn = strip((await call()) as never);
    expect(badOn).toEqual(badOff);
  });

  it("a hung telemetry write delays the result by at most the bound and never changes it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    db.mode = "hang";
    mockFetch(() => ok("answer despite hung telemetry"));
    let result: Awaited<ReturnType<typeof call>> | undefined;
    const p = call().then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(EXECUTION_EVENT_WRITE_TIMEOUT_MS + 1);
    await p;
    expect(result?.ok && result.text).toBe("answer despite hung telemetry");
    expect(getExecutionTelemetryHealth().timedOut).toBe(1);
  });
});

/* ═══ streaming ═══════════════════════════════════════════════════════════ */
const enc = new TextEncoder();
const gem = (text: string, usage?: object) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], ...(usage ? { usageMetadata: usage } : {}) })}\n\n`;
const oai = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
const sreq = (provider: "gemini" | "deepseek" | "openrouter") => ({ provider, apiKey: "KEY", systemPrompt: "SYSTEM-PROMPT-CONFIDENTIAL", userMessage: "USER-PROMPT-CONFIDENTIAL", context: { purpose: "chat-stream" as const, agentId: "vee" } });

describe("streaming events", () => {
  it("records one streamed event with provider usage exactly as supplied", async () => {
    mockFetch(() => new Response(gem("Hel") + gem("lo", { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 }), { status: 200 }));
    const h = streamCompletion(sreq("gemini"));
    const got: string[] = [];
    for await (const d of h.deltas) got.push(d);
    expect(got).toEqual(["Hel", "lo"]);
    expect(only()).toMatchObject({ id: h.outcome.executionId, provider: "gemini", model_requested: "gemini-2.0-flash", model_reported: null, outcome: "ok", input_tokens: 5, output_tokens: 2, total_tokens: 7, metadata: { streamed: true }, agent_id: "vee" });
  });

  it("no usage in the stream means unknown, and no text means an empty outcome", async () => {
    mockFetch(() => new Response(oai("a"), { status: 200 }));
    for await (const d of streamCompletion(sreq("deepseek")).deltas) void d;
    expect(only()).toMatchObject({ usage_quality: "not_reported", input_tokens: null, outcome: "ok", provider: "deepseek", model_requested: "deepseek-chat" });
    db.rows = new Map();
    mockFetch(() => new Response("", { status: 200 }));
    for await (const d of streamCompletion(sreq("openrouter")).deltas) void d;
    expect(only()).toMatchObject({ outcome: "empty", model_requested: "anthropic/claude-sonnet-4" });
  });

  it("a non-2xx stream is a truthful http failure and yields nothing", async () => {
    mockFetch(() => new Response("SECRET-UPSTREAM-BODY", { status: 429 }));
    const got: string[] = [];
    for await (const d of streamCompletion(sreq("openrouter")).deltas) got.push(d);
    expect(got).toEqual([]);
    expect(only()).toMatchObject({ outcome: "error", error_class: "http", http_status: 429 });
    expect(JSON.stringify(rows())).not.toContain("SECRET-UPSTREAM-BODY");
  });

  it("a network error is recorded and STILL thrown to the caller", async () => {
    mockFetch(() => new Error("dns"));
    await expect((async () => { for await (const d of streamCompletion(sreq("deepseek")).deltas) void d; })()).rejects.toThrow("dns");
    expect(only()).toMatchObject({ outcome: "error", error_class: "exception" });
  });

  it("a consumer that stops early still produces exactly one event", async () => {
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode(oai("one"))); c.enqueue(enc.encode(oai("two"))); c.close(); } });
    mockFetch(() => new Response(body, { status: 200 }));
    for await (const d of streamCompletion(sreq("deepseek")).deltas) { void d; break; }
    expect(rows()).toHaveLength(1);
    expect(only()).toMatchObject({ outcome: "ok" });
  });
});

/* ═══ call-site context (agent + correlation) ═════════════════════════════ */
describe("call sites pass the right context", () => {
  it("jobs correlate to their job id", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/jobs.ts"), "utf8");
    expect(src).toMatch(/context: \{ purpose: "job", correlation: \{ type: "job", id: jobId \} \}/);
  });

  it("lead-gen callers correlate to the lead id; atlas, verse and approve helpers do not invent one", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(read("src/app/api/command-center/leads/intel/route.ts")).toMatch(/correlation: \{ type: "lead", id: leadId \}/);
    expect(read("src/app/api/command-center/leads/kit/route.ts")).toMatch(/correlation: \{ type: "lead", id: leadId \}/);
    expect(read("src/app/api/command-center/voice/call/webhook/route.ts")).toMatch(/correlation: \{ type: "lead", id: leadId \}/);
    expect(read("src/lib/lead-gen.ts")).toMatch(/context: \{ purpose: "lead-gen", correlation: opts.correlation \}/);
    for (const f of ["src/app/api/command-center/voice/atlas/route.ts", "src/app/api/command-center/wellness/verse/route.ts", "src/lib/cc-approve-synthesis.ts"]) {
      expect(read(f), f).not.toMatch(/correlation/);
    }
  });

  it("chat and stream correlate to the user's message id only when the client sent one", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    for (const f of ["src/app/api/command-center/chat/route.ts", "src/app/api/command-center/chat/stream/route.ts"]) {
      expect(read(f), f).toMatch(/userMessageId\s*\?\s*\{ type: "chat_message", id: userMessageId \}\s*:\s*undefined/);
    }
  });
});

/* ═══ vocabulary is derived from reality and matches the database ═════════ */
describe("vocabulary", () => {
  const walk = (dir: string, acc: string[] = []): string[] => {
    for (const n of readdirSync(join(process.cwd(), dir))) {
      const rel = join(dir, n);
      if (statSync(join(process.cwd(), rel)).isDirectory()) walk(rel, acc);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) && !/test-helper/.test(n)) acc.push(rel);
    }
    return acc;
  };

  it("the purpose set is exactly the set of purposes the call sites use (no invented future purposes)", () => {
    const used = new Set<string>();
    for (const f of walk("src")) {
      if (f === "src/lib/execution-events.ts") continue;
      for (const m of readFileSync(join(process.cwd(), f), "utf8").matchAll(/purpose: "([a-z-]+)"/g)) used.add(m[1]);
    }
    expect([...used].sort()).toEqual([...EXECUTION_PURPOSES].sort());
  });

  it("the TypeScript vocabulary matches the SQL CHECK constraints exactly", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260930000000_execution_events.sql"), "utf8");
    const listAfter = (column: string): string[] => {
      const re = new RegExp(`${column}\\s+(?:text\\s+(?:not null\\s+)?)?check \\(${column} in \\(([^)]*)\\)`, "s");
      const m = sql.match(re);
      if (!m) throw new Error(`no check list for ${column}`);
      return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    };
    expect(listAfter("provider")).toEqual([...EXECUTION_PROVIDERS].sort());
    expect(listAfter("purpose")).toEqual([...EXECUTION_PURPOSES].sort());
    expect(listAfter("outcome")).toEqual([...EXECUTION_OUTCOMES].sort());
    expect(listAfter("error_class")).toEqual([...EXECUTION_ERROR_CLASSES].sort());
    expect(listAfter("usage_quality")).toEqual([...USAGE_QUALITIES].sort());
    expect(listAfter("billing_mode")).toEqual([...BILLING_MODES].sort());
    expect(listAfter("correlation_type")).toEqual([...CORRELATION_TYPES].sort());
  });

  it("the migration keeps its access and truth guarantees (RLS, no policies, revokes, constraints)", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260930000000_execution_events.sql"), "utf8");
    for (const must of [
      "enable row level security", "revoke all on table public.execution_events from anon, authenticated",
      "revoke all on table public.model_pricing from anon, authenticated", "security_invoker = true",
      "execution_events_no_direct_cost_for_subscription_or_local", "execution_events_proxy_zero_is_claude_max_only",
      "execution_events_usage_quality_matches_tokens", "execution_events_openclaw_model_unknown",
      "source_url                  text not null", "retrieved_on                date not null",
    ]) expect(sql, must).toContain(must);
    expect(sql).not.toMatch(/create policy/i);
    expect(readFileSync(join(process.cwd(), "supabase/rollbacks/20260930000000_execution_events.rollback.sql"), "utf8")).toMatch(/drop view if exists[\s\S]*drop table if exists public\.model_pricing[\s\S]*drop table if exists public\.execution_events/);
  });
});

/* ═══ boundary ════════════════════════════════════════════════════════════ */
describe("server-only boundary", () => {
  it("no 'use client' file can reach the telemetry writer, the adapter or the service-role client", () => {
    expect(clientFiles().length).toBeGreaterThan(10);
    expect(clientFilesReaching("src/lib/execution-events.ts")).toEqual([]);
    expect(clientFilesReaching("src/lib/provider-adapter.ts")).toEqual([]);
    expect(clientFilesReaching("src/lib/supabase-admin.ts")).toEqual([]);
  });

  it("the adapter reaches the database only through the writer", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/provider-adapter.ts"), "utf8");
    expect(src).not.toMatch(/supabase/i);
    expect(src).toMatch(/@\/lib\/execution-events/);
    expect(readFileSync(join(process.cwd(), "src/lib/execution-events.ts"), "utf8")).not.toMatch(/from "@\/lib\/provider-adapter"/);
  });
});
