/**
 * Execution events (P06 Packet 3): the SERVER-ONLY writer for AI execution telemetry.
 *
 * The Provider Adapter produces execution FACTS; this module turns them into one `execution_events` row and
 * persists it. It never does model I/O and the adapter never touches the database.
 *
 * DO NOT import this module from browser code (enforced by a test). It reaches Supabase only through the
 * service-role client in `supabase-admin.ts`.
 *
 * TRUTH RULES. "[code]" = enforced by this module (and its tests); "[DB]" = also a CHECK constraint in the migration.
 * - Unknown is `null`, never zero, never estimated. Token counts are provider-supplied integers or absent. [code]
 * - A total is never derived from input + output. [code]
 * - Claude Max: the proxy turns a missing count into 0 and synthesizes `total_tokens` (verified in its source), so
 *   for claude-max a zero input/output is treated as unknown, the total is always null, and only non-zero
 *   input/output counts are kept. Nothing to keep => "ambiguous_proxy_zero" (a zero was seen) or "not_reported". [code]
 *   The database additionally refuses a claude-max row with a total or a zero input/output. [DB]
 * - `model_requested` is the exact model the app asked for. `model_reported` is what the provider said, verbatim;
 *   for the Claude Max proxy that is a normalized family label. The second never overwrites the first. [code]
 * - OpenClaw's underlying model is unknown, so both model columns are null. [code, DB]
 * - `direct_cost_usd` is always null here: Claude Max is a subscription, LM Studio is local, and no provider on
 *   this path reports real spend. The database refuses a direct cost for claude-max and lm-studio; it deliberately
 *   leaves it open for providers that could report real billing later. [code; DB for claude-max and lm-studio]
 * - Shadow (list-price) cost is computed at read time by a view, from the price in force at the event's start. [DB view]
 * - A correlation is a typed pair with a UUID id, or both null. Invalid ids are dropped, never truncated. [code, DB]
 * - Counts must be non-negative int4 integers or they become null (a bad count must not lose the whole row). [code]
 * - No prompt text, response text, credentials, authorization headers or upstream error bodies are stored. [code]
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

const INT4_MAX = 2147483647;
/** A token count the integer columns can hold: a non-negative int4. Anything else is treated as not supplied. */
const validCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= INT4_MAX;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A correlation is kept only if its type is known and its id is a non-empty string of at most 128 characters
 * that is a UUID (chat message, job and lead ids are all UUIDs). Otherwise BOTH fields are null. An id is never
 * truncated and a type is never stored without its id.
 */
function validCorrelation(c: ExecutionCorrelation | undefined): ExecutionCorrelation | null {
  if (!c || !(CORRELATION_TYPES as readonly string[]).includes(c.type)) return null;
  if (typeof c.id !== "string" || c.id.length === 0 || c.id.length > 128 || !UUID_RE.test(c.id)) return null;
  return c;
}

/**
 * Usage normalization rules.
 *  - Only non-negative int4 integers count as "supplied"; anything else (12.5, 5e10, -1, NaN, "12") is unknown.
 *  - Nothing supplied                                            -> all null, "not_reported".
 *  - claude-max: the proxy fabricates 0 for a missing count and synthesizes the total, so
 *      * a zero input or output is NOT a measurement and becomes null;
 *      * total_tokens is always null;
 *      * non-zero input/output are kept, and the result is "partial" (the total is never present);
 *      * if nothing trustworthy remains: "ambiguous_proxy_zero" when a zero was seen (every supplied field 0, or
 *        a zero input/output), otherwise "not_reported".
 *  - Other providers: all three present -> "provider_reported"; some -> "partial". A missing total is left null and
 *    is never computed from input + output. Zeros are kept as reported.
 */
export function normalizeUsage(provider: ExecutionProvider, usage: ProviderUsage | undefined): NormalizedUsage {
  const input = validCount(usage?.promptTokens) ? usage!.promptTokens! : null;
  const output = validCount(usage?.completionTokens) ? usage!.completionTokens! : null;
  const total = validCount(usage?.totalTokens) ? usage!.totalTokens! : null;
  const supplied = [input, output, total].filter((v): v is number => v !== null);
  if (supplied.length === 0) return { input: null, output: null, total: null, quality: "not_reported" };
  if (provider === "claude-max") {
    const i = input !== null && input > 0 ? input : null;
    const o = output !== null && output > 0 ? output : null;
    if (i === null && o === null) {
      const sawZero = supplied.every((v) => v === 0) || input === 0 || output === 0;
      return { input: null, output: null, total: null, quality: sawZero ? "ambiguous_proxy_zero" : "not_reported" };
    }
    return { input: i, output: o, total: null, quality: "partial" };
  }
  return { input, output, total, quality: supplied.length === 3 ? "provider_reported" : "partial" };
}

export function billingModeFor(provider: ExecutionProvider): BillingMode {
  if (provider === "claude-max") return "subscription";
  if (provider === "lm-studio") return "local";
  return "unknown";
}

const clip = (s: string | null | undefined, n = 200): string | null => (typeof s === "string" && s.length > 0 ? s.slice(0, n) : null);

/** What validation discarded while building a row; surfaced through the health counters. */
export interface DroppedFields {
  correlation: boolean;
  /** Count fields the provider sent that were not valid int4 integers. */
  tokens: number;
}

/** Pure: facts -> the exact row that will be persisted, plus a note of anything validation discarded. */
export function buildExecutionEventWithNotes(f: ExecutionFacts): { row: ExecutionEventRow; dropped: DroppedFields } {
  const row = buildRow(f);
  const u = f.usage;
  const sent = [u?.promptTokens, u?.completionTokens, u?.totalTokens].filter((v) => v !== undefined && v !== null);
  const dropped: DroppedFields = {
    correlation: Boolean(f.context.correlation) && row.correlation_type === null,
    tokens: sent.filter((v) => !validCount(v)).length,
  };
  return { row, dropped };
}

/** Pure: facts -> the exact row that will be persisted. */
export function buildExecutionEvent(f: ExecutionFacts): ExecutionEventRow {
  return buildRow(f);
}

function buildRow(f: ExecutionFacts): ExecutionEventRow {
  const usage = normalizeUsage(f.provider, f.usage);
  const correlation = validCorrelation(f.context.correlation);
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
    correlation_type: correlation ? correlation.type : null,
    correlation_id: correlation ? correlation.id : null,
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
  /** Rows written with a correlation dropped because its id was not a valid UUID. */
  correlationDropped: number;
  /** Token fields dropped because they were not non-negative int4 integers. */
  tokensDropped: number;
  circuitOpen: boolean;
  lastError: string | null;
  /**
   * How long database writes actually take (ms), so the real cost of awaiting them is measurable. `count` is all
   * attempts; `latestMs`, `p95Ms` and `maxMs` come from a bounded sample of the most recent
   * WRITE_DURATION_SAMPLE attempts. A timed-out attempt is recorded at the timeout bound.
   */
  writeDuration: { count: number; latestMs: number | null; p95Ms: number | null; maxMs: number | null; sampleSize: number };
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
  correlationDropped: 0,
  tokensDropped: 0,
  lastError: null as string | null,
};
const WRITE_DURATION_SAMPLE = 50;
const durationSample: number[] = [];
let durationCount = 0;
let durationLatest: number | null = null;

function noteDuration(ms: number): void {
  const v = Math.max(0, Math.round(ms));
  durationCount++;
  durationLatest = v;
  durationSample.push(v);
  if (durationSample.length > WRITE_DURATION_SAMPLE) durationSample.shift();
}

function summarizeDurations(): ExecutionTelemetryHealth["writeDuration"] {
  if (durationSample.length === 0) return { count: durationCount, latestMs: null, p95Ms: null, maxMs: null, sampleSize: 0 };
  const s = [...durationSample].sort((a, b) => a - b);
  return {
    count: durationCount,
    latestMs: durationLatest,
    p95Ms: s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)],
    maxMs: s[s.length - 1],
    sampleSize: s.length,
  };
}
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const recentIds = new Set<string>();

/** Telemetry is opt-in: it writes nothing until CC_EXECUTION_EVENTS is set, i.e. after the table exists. */
export function executionEventsEnabled(): boolean {
  const v = process.env.CC_EXECUTION_EVENTS?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export function getExecutionTelemetryHealth(): ExecutionTelemetryHealth {
  return { enabled: executionEventsEnabled(), circuitOpen: Date.now() < circuitOpenUntil, ...health, writeDuration: summarizeDurations() };
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
  health.correlationDropped = 0;
  health.tokensDropped = 0;
  health.lastError = null;
  durationSample.length = 0;
  durationCount = 0;
  durationLatest = null;
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
    const { row, dropped } = buildExecutionEventWithNotes(facts);
    if (dropped.correlation) health.correlationDropped++;
    health.tokensDropped += dropped.tokens;
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
    const startedAt = performance.now();
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
      // A timed-out attempt is recorded at the bound it was cut off at; others at their measured duration.
      noteDuration(winner === "timeout" ? EXECUTION_EVENT_WRITE_TIMEOUT_MS : performance.now() - startedAt);
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
