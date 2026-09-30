/**
 * Execution events (P06 Packet 3): the SERVER-ONLY writer for AI execution telemetry.
 *
 * The Provider Adapter produces execution FACTS; this module turns them into one `execution_events` row and
 * persists it. It never does model I/O and the adapter never touches the database.
 *
 * DO NOT import this module from browser code (enforced by a test). It reaches Supabase only through the
 * service-role client in `supabase-admin.ts`.
 *
 * TRUTH RULES (each is also enforced by a database constraint, see the migration)
 * - Unknown is `null`, never zero, never estimated. Token counts are provider-supplied or absent.
 * - A total is never derived from input + output.
 * - Claude Max: the proxy turns missing token counts into zeros and synthesizes the total, so an all-zero usage
 *   object is recorded as UNKNOWN with `usage_quality = "ambiguous_proxy_zero"` and no numbers.
 * - `model_requested` is the exact model the app asked for. `model_reported` is what the provider said, verbatim;
 *   for the Claude Max proxy that is a normalized family label. The second never overwrites the first.
 * - OpenClaw's underlying model is unknown, so both model columns are null.
 * - `direct_cost_usd` is always null here: Claude Max is a subscription, LM Studio is local, and no other
 *   provider on this path reports real spend. Shadow (list-price) cost is computed at read time by a view.
 * - No prompt text, response text, credentials, authorization headers or upstream error bodies are stored.
 *
 * DURABILITY: `recordExecution` makes ONE bounded persistence attempt and never throws. The chosen design is a
 * strictly time-boxed awaited write. Comparison with the alternatives:
 *  - Next.js `after()`: documented for Route Handlers, Server Components and Server Functions, with `waitUntil` on
 *    serverless. It THROWS outside a request scope (verified: "`after` was called outside a request scope"), and the
 *    adapter is also called from detached background work (`void runJob(...)`, lead-gen's background generation),
 *    so it cannot be the one mechanism. Keeping it out also keeps the adapter free of framework coupling.
 *  - Fire-and-forget promise: works on the persistent `next start` server but silently loses events on any
 *    runtime that freezes or terminates after the response, and the loss would be invisible.
 *  - Bounded awaited write (chosen): the attempt finishes or times out before the adapter returns, on any runtime.
 *    Cost: normally one Supabase round trip on top of a multi-second model call; worst case
 *    EXECUTION_EVENT_WRITE_TIMEOUT_MS, and a circuit breaker stops paying that repeatedly when the database is down.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/* ── Vocabulary (derived mechanically from the existing call sites) ───── */

/** Every `context.purpose` in use at the call sites today. No future purposes yet. */
export const EXECUTION_PURPOSES = [
  "agent-reply",
  "strict-delegation-rewrite",
  "synthesis",
  "critique",
  "refine",
  "chat-stream",
  "approve-execution",
  "voice",
  "daily-verse",
  "job",
  "lead-gen",
] as const;
export type ExecutionPurpose = (typeof EXECUTION_PURPOSES)[number];

export const EXECUTION_PROVIDERS = ["claude-max", "lm-studio", "openclaw", "gemini", "deepseek", "openrouter"] as const;
export type ExecutionProvider = (typeof EXECUTION_PROVIDERS)[number];
export const USAGE_QUALITIES = ["provider_reported", "partial", "ambiguous_proxy_zero", "not_reported"] as const;
export type UsageQuality = (typeof USAGE_QUALITIES)[number];
export const BILLING_MODES = ["subscription", "local", "unknown"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];
export const EXECUTION_OUTCOMES = ["ok", "empty", "error"] as const;
export type ExecutionOutcome = (typeof EXECUTION_OUTCOMES)[number];
export const EXECUTION_ERROR_CLASSES = ["http", "timeout", "exception", "gateway"] as const;
export type ExecutionErrorClass = (typeof EXECUTION_ERROR_CLASSES)[number];
export const CORRELATION_TYPES = ["chat_message", "job", "lead"] as const;
export type CorrelationType = (typeof CORRELATION_TYPES)[number];

/** A typed pointer to what caused this execution. Never an untyped opaque id. */
export interface ExecutionCorrelation {
  type: CorrelationType;
  id: string;
}

/** Why a call is being made, and for whom. `purpose` is required so no execution is unattributable. */
export interface ExecutionContext {
  purpose: ExecutionPurpose;
  agentId?: string;
  correlation?: ExecutionCorrelation;
}

/** Token counts exactly as a provider supplied them; a field the provider did not send is undefined. */
export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/* ── Facts in, row out ───────────────────────────────────────────────── */

/** What the adapter observed about one execution. Deliberately contains no prompt or response text. */
export interface ExecutionFacts {
  executionId: string;
  startedAtMs: number;
  latencyMs?: number;
  provider: ExecutionProvider;
  context: ExecutionContext;
  modelRequested?: string | null;
  modelReported?: string | null;
  /** Whether the call produced a non-empty completion. */
  hasText: boolean;
  /** Present when the call failed. Only the class and status: never a message or body. */
  failure?: { kind: ExecutionErrorClass; httpStatus?: number };
  usage?: ProviderUsage;
  streamed?: boolean;
  finishReason?: string;
}

export interface ExecutionEventRow {
  id: string;
  started_at: string;
  latency_ms: number | null;
  provider: ExecutionProvider;
  model_requested: string | null;
  model_reported: string | null;
  agent_id: string | null;
  purpose: ExecutionPurpose;
  outcome: ExecutionOutcome;
  error_class: ExecutionErrorClass | null;
  http_status: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  usage_quality: UsageQuality;
  direct_cost_usd: null;
  billing_mode: BillingMode;
  correlation_type: CorrelationType | null;
  correlation_id: string | null;
  mission_id: null;
  metadata: { streamed?: true; finish_reason?: string };
}

export interface NormalizedUsage {
  input: number | null;
  output: number | null;
  total: number | null;
  quality: UsageQuality;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Usage normalization rules.
 *  - No usage, or no numeric field                              -> all null, "not_reported".
 *  - claude-max and EVERY supplied field is 0                    -> all null, "ambiguous_proxy_zero"
 *    (the proxy fabricates zeros for missing counts, so a zero is not a measurement; nothing is substituted).
 *  - All three present                                           -> as supplied, "provider_reported".
 *  - Some but not all present                                    -> as supplied, "partial". A missing total is
 *    left null; it is never computed from input + output.
 */
export function normalizeUsage(provider: ExecutionProvider, usage: ProviderUsage | undefined): NormalizedUsage {
  const input = isNum(usage?.promptTokens) ? usage!.promptTokens! : null;
  const output = isNum(usage?.completionTokens) ? usage!.completionTokens! : null;
  const total = isNum(usage?.totalTokens) ? usage!.totalTokens! : null;
  const supplied = [input, output, total].filter((v): v is number => v !== null);
  if (supplied.length === 0) return { input: null, output: null, total: null, quality: "not_reported" };
  if (provider === "claude-max" && supplied.every((v) => v === 0)) {
    return { input: null, output: null, total: null, quality: "ambiguous_proxy_zero" };
  }
  return { input, output, total, quality: supplied.length === 3 ? "provider_reported" : "partial" };
}

export function billingModeFor(provider: ExecutionProvider): BillingMode {
  if (provider === "claude-max") return "subscription";
  if (provider === "lm-studio") return "local";
  return "unknown";
}

const clip = (s: string | null | undefined, n = 200): string | null => (typeof s === "string" && s.length > 0 ? s.slice(0, n) : null);

/** Pure: facts -> the exact row that will be persisted. */
export function buildExecutionEvent(f: ExecutionFacts): ExecutionEventRow {
  const usage = normalizeUsage(f.provider, f.usage);
  const failed = f.failure !== undefined;
  const metadata: ExecutionEventRow["metadata"] = {};
  if (f.streamed) metadata.streamed = true;
  const finish = clip(f.finishReason, 64);
  if (finish) metadata.finish_reason = finish;
  return {
    id: f.executionId,
    started_at: new Date(f.startedAtMs).toISOString(),
    latency_ms: typeof f.latencyMs === "number" && f.latencyMs >= 0 ? Math.round(f.latencyMs) : null,
    provider: f.provider,
    // OpenClaw's underlying model is unknown: never record one.
    model_requested: f.provider === "openclaw" ? null : clip(f.modelRequested),
    model_reported: f.provider === "openclaw" ? null : clip(f.modelReported),
    agent_id: clip(f.context.agentId, 64),
    purpose: f.context.purpose,
    outcome: failed ? "error" : f.hasText ? "ok" : "empty",
    error_class: failed ? f.failure!.kind : null,
    http_status: failed && f.failure!.kind === "http" && typeof f.failure!.httpStatus === "number" ? f.failure!.httpStatus : null,
    input_tokens: usage.input,
    output_tokens: usage.output,
    total_tokens: usage.total,
    usage_quality: usage.quality,
    direct_cost_usd: null,
    billing_mode: billingModeFor(f.provider),
    correlation_type: f.context.correlation ? f.context.correlation.type : null,
    correlation_id: f.context.correlation ? clip(f.context.correlation.id, 128) : null,
    mission_id: null,
    metadata,
  };
}

/* ── Persistence: one bounded attempt, never throws ──────────────────── */

/** Hard ceiling on how long an execution may wait for its telemetry write. */
export const EXECUTION_EVENT_WRITE_TIMEOUT_MS = 1000;
const CIRCUIT_FAILURES = 3;
const CIRCUIT_OPEN_MS = 60_000;
const RECENT_ID_CAP = 500;

export interface ExecutionTelemetryHealth {
  enabled: boolean;
  attempted: number;
  persisted: number;
  failed: number;
  timedOut: number;
  skippedDisabled: number;
  skippedNoClient: number;
  skippedCircuitOpen: number;
  skippedDuplicate: number;
  circuitOpen: boolean;
  lastError: string | null;
}

const health = {
  attempted: 0,
  persisted: 0,
  failed: 0,
  timedOut: 0,
  skippedDisabled: 0,
  skippedNoClient: 0,
  skippedCircuitOpen: 0,
  skippedDuplicate: 0,
  lastError: null as string | null,
};
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const recentIds = new Set<string>();

/** Telemetry is opt-in: it writes nothing until CC_EXECUTION_EVENTS is set, i.e. after the table exists. */
export function executionEventsEnabled(): boolean {
  const v = process.env.CC_EXECUTION_EVENTS?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export function getExecutionTelemetryHealth(): ExecutionTelemetryHealth {
  return { enabled: executionEventsEnabled(), circuitOpen: Date.now() < circuitOpenUntil, ...health };
}

/** Test helper: reset module state. */
export function __resetExecutionTelemetryForTests(): void {
  health.attempted = 0;
  health.persisted = 0;
  health.failed = 0;
  health.timedOut = 0;
  health.skippedDisabled = 0;
  health.skippedNoClient = 0;
  health.skippedCircuitOpen = 0;
  health.skippedDuplicate = 0;
  health.lastError = null;
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
  recentIds.clear();
}

function remember(id: string): void {
  recentIds.add(id);
  if (recentIds.size > RECENT_ID_CAP) {
    const oldest = recentIds.values().next().value;
    if (oldest !== undefined) recentIds.delete(oldest);
  }
}

/**
 * A secret-free description of a failure: ONLY a structured code (e.g. a Postgres error code) or the error's
 * name. Free-text messages are deliberately dropped, because an exception message can carry a key, a URL or an
 * upstream body, and this value is logged and exposed through the health function.
 */
function describeError(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { code?: unknown; name?: unknown };
    const pick = typeof o.code === "string" ? o.code : typeof o.name === "string" ? o.name : "error";
    return /^[A-Za-z0-9_.:-]{1,40}$/.test(pick) ? pick : "error";
  }
  return "error";
}

function noteFailure(kind: "failed" | "timedOut", e: unknown): void {
  health[kind]++;
  health.lastError = describeError(e);
  consecutiveFailures++;
  console.error(`[execution-events] write ${kind === "timedOut" ? "timed out" : "failed"}: ${health.lastError}`);
  if (consecutiveFailures >= CIRCUIT_FAILURES) {
    circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    consecutiveFailures = 0;
  }
}

/**
 * Persist one execution. Makes at most ONE attempt, bounded by EXECUTION_EVENT_WRITE_TIMEOUT_MS, and resolves in
 * every case: a slow, failing or absent database can only cost the bound, and can never turn a successful model
 * call into a failure. The execution id is generated by the caller before this runs, so the insert is idempotent
 * (in-process duplicate guard plus `upsert ... ignoreDuplicates` on the primary key).
 */
export async function recordExecution(facts: ExecutionFacts): Promise<void> {
  try {
    if (!executionEventsEnabled()) {
      health.skippedDisabled++;
      return;
    }
    const row = buildExecutionEvent(facts);
    if (recentIds.has(row.id)) {
      health.skippedDuplicate++;
      return;
    }
    remember(row.id);
    if (Date.now() < circuitOpenUntil) {
      health.skippedCircuitOpen++;
      return;
    }
    const db = getSupabaseAdmin();
    if (!db) {
      health.skippedNoClient++;
      return;
    }
    health.attempted++;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => {
        ctrl.abort();
        resolve("timeout");
      }, EXECUTION_EVENT_WRITE_TIMEOUT_MS);
    });
    try {
      const write = Promise.resolve(
        db.from("execution_events").upsert(row, { onConflict: "id", ignoreDuplicates: true }).abortSignal(ctrl.signal),
      ).then((res: { error?: unknown }) => ({ error: res?.error ?? null }));
      const winner = await Promise.race([write, timeout]);
      if (winner === "timeout") {
        // The write may still land late; the primary-key upsert keeps that harmless.
        write.catch(() => {});
        noteFailure("timedOut", { name: "TimeoutError" });
      } else if (winner.error) {
        noteFailure("failed", winner.error);
      } else {
        health.persisted++;
        consecutiveFailures = 0;
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  } catch (e) {
    // Building the row or talking to the client threw. Telemetry must not propagate that.
    try {
      noteFailure("failed", e);
    } catch {
      /* never throw from telemetry */
    }
  }
}
