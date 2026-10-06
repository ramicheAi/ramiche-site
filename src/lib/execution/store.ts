/**
 * P06 M6 execution records. Idempotency lives here: the same idempotency key never runs twice, and a key reused for a
 * different binding is refused.
 *
 * JobsExecutionStore puts executions on the existing jobs / job_events backbone (no new table, no migration): one jobs
 * row per idempotency key (its id is a name-based UUID of the key, so a second insert conflicts), kind "dev", agent
 * "claude-code", source "m6-executor", the request facts in input, the summary in result, and the structured result
 * as a job_events detail. A row is only created after the approval verified, so jobs' existing statuses suffice.
 * The `job` mission-link type already resolves against jobs, so a founder can attach an execution to a Mission as
 * evidence through the existing Mission API; the executor itself never writes Missions.
 */
import { createHash } from "node:crypto";
import { hostname } from "node:os";
import type { ExecutionRequest, ExecutionResult, ExecutionStatus } from "./contract";

export type Begin = { state: "new" } | { state: "existing"; bindingHash: string; result: ExecutionResult | null };

export interface ExecutionStore {
  begin(r: ExecutionRequest, bindingHash: string): Promise<Begin>;
  finish(r: ExecutionRequest, result: ExecutionResult): Promise<void>;
  /** Liveness while running (the reaper's evidence that the run is not abandoned). Optional. */
  heartbeat?(r: ExecutionRequest): Promise<void>;
  /** Whether the founder asked to cancel this run. Optional; checked with each heartbeat. */
  cancelRequested?(r: ExecutionRequest): Promise<boolean>;
}

export class MemoryExecutionStore implements ExecutionStore {
  readonly rows = new Map<string, { bindingHash: string; result: ExecutionResult | null }>();
  async begin(r: ExecutionRequest, bindingHash: string): Promise<Begin> {
    const cur = this.rows.get(r.idempotencyKey);
    if (cur) return { state: "existing", bindingHash: cur.bindingHash, result: cur.result };
    this.rows.set(r.idempotencyKey, { bindingHash, result: null });
    return { state: "new" };
  }
  async finish(r: ExecutionRequest, result: ExecutionResult): Promise<void> {
    const cur = this.rows.get(r.idempotencyKey);
    if (cur) cur.result = result;
  }
}

const NS = "3b1f6c2e-8d4a-4f7b-9c1e-2a5d7e9f0b13";
/** The jobs row id for an idempotency key (RFC 4122 version 5). */
export function executionJobId(idempotencyKey: string): string {
  const h = createHash("sha1").update(Buffer.concat([Buffer.from(NS.replace(/-/g, ""), "hex"), Buffer.from(idempotencyKey, "utf8")])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export const jobStatusFor = (s: ExecutionStatus): "done" | "failed" | "canceled" => (s === "succeeded" ? "done" : s === "canceled" ? "canceled" : "failed");

export interface RunningJob { id: string; input: Record<string, unknown> | null; started_at: string | null; updated_at: string | null }

/** The narrow slice of the Supabase client this store uses (supabase-jobs-db.ts implements it). */
export interface JobsDb {
  insertJob(row: Record<string, unknown>): Promise<{ conflict: boolean; error: string | null }>;
  /** The row (null when absent) with its latest execution_result; read errors come back as `error`, never as absence. */
  getJob(id: string): Promise<{ row: { input: Record<string, unknown> | null; status: string; error: string | null; resultEvent: ExecutionResult | null } | null; error: string | null }>;
  updateJob(id: string, patch: Record<string, unknown>): Promise<{ error: string | null }>;
  insertEvent(row: Record<string, unknown>): Promise<{ error: string | null }>;
  /** Update only if the row still has these values (optimistic concurrency); `updated` says whether it did. */
  updateJobIf(id: string, expect: { status: string; updated_at: string | null }, patch: Record<string, unknown>): Promise<{ updated: boolean; error: string | null }>;
  hasEvent(jobId: string, kind: string): Promise<{ found: boolean; error: string | null }>;
  listRunning(source: string): Promise<{ rows: RunningJob[]; error: string | null }>;
}

export const EXECUTOR_SOURCE = "m6-executor";

/** The result reported for a finished execution whose own result was never recorded (process died, then reaped). */
export function abandonedResult(r: ExecutionRequest, reason: string | null): ExecutionResult {
  const message = `This execution stopped without a recorded result${reason ? ` (${reason})` : ""}. Nothing further will run under this approval; approve a new run to retry.`;
  return {
    executionId: r.executionId, executor: r.executor, status: "failed", startedAt: null, completedAt: new Date().toISOString(),
    project: r.project.slug, repository: r.repository.origin, branch: null, baseHead: r.repository.head, resultingHead: null, worktree: null,
    filesChanged: [], checks: [], summary: message, evidence: { logPath: null, turns: null, modelReported: null },
    usage: { inputTokens: null, outputTokens: null, billing: "subscription", reportedCostEstimateUsd: null }, warnings: [], nextStep: null,
    failure: { code: "abandoned", message },
  };
}

export class JobsExecutionStore implements ExecutionStore {
  private readonly db: JobsDb;
  constructor(db: JobsDb) { this.db = db; }
  async begin(r: ExecutionRequest, bindingHash: string): Promise<Begin> {
    const id = executionJobId(r.idempotencyKey);
    const now = new Date().toISOString();
    const ins = await this.db.insertJob({
      id, title: r.task.instruction.slice(0, 200), kind: "dev", status: "running", agent: "claude-code", source: EXECUTOR_SOURCE,
      input: {
        executionId: r.executionId, bindingHash, commandId: r.commandId, missionId: r.missionId, project: r.project.slug,
        origin: r.repository.origin, branch: r.repository.branch, head: r.repository.head, capability: r.capability,
        contextRefs: r.task.contextRefs, limits: r.limits, founder: r.founder.uid,
        // Process evidence for the reaper: which host and process run this execution.
        runner: { host: hostname(), pid: process.pid },
      },
      progress: `approved ${r.capability}`, started_at: now, updated_at: now,
    });
    if (ins.error) throw new Error(`execution record could not be created: ${ins.error}`);   // fail closed: no record, no run
    if (!ins.conflict) return { state: "new" };
    const cur = await this.db.getJob(id);
    if (cur.error) throw new Error(`execution record could not be read: ${cur.error}`);   // never mistake a read failure for a conflict
    if (!cur.row) throw new Error("execution record conflicted but could not be found");
    const row = cur.row;
    // A finished row without a recorded result (reaped, or its result write was lost) is a failure, not "running".
    const result = row.resultEvent ?? (row.status !== "running" && row.status !== "queued" ? abandonedResult(r, row.error) : null);
    return { state: "existing", bindingHash: String(row.input?.bindingHash ?? ""), result };
  }
  async finish(r: ExecutionRequest, result: ExecutionResult): Promise<void> {
    const id = executionJobId(r.idempotencyKey);
    // The result event first, then the status: a retry that reads a finished row always finds its real result.
    const ev = await this.db.insertEvent({ job_id: id, kind: "execution_result", detail: result });
    if (ev.error) throw new Error(`execution result event could not be saved: ${ev.error}`);
    const up = await this.db.updateJob(id, {
      status: jobStatusFor(result.status), result: result.summary.slice(0, 4000), error: result.failure?.message ?? null,
      progress: result.status, finished_at: result.completedAt, updated_at: result.completedAt,
    });
    if (up.error) throw new Error(`execution result could not be saved: ${up.error}`);
  }
  async heartbeat(r: ExecutionRequest): Promise<void> {
    const now = new Date().toISOString();
    const up = await this.db.updateJobIf(executionJobId(r.idempotencyKey), { status: "running", updated_at: null }, { updated_at: now, progress: "running" });
    if (up.error) throw new Error(`heartbeat failed: ${up.error}`);
  }
  async cancelRequested(r: ExecutionRequest): Promise<boolean> {
    const ev = await this.db.hasEvent(executionJobId(r.idempotencyKey), "cancel_requested");
    if (ev.error) throw new Error(`cancel check failed: ${ev.error}`);
    return ev.found;
  }
  /** The founder asks to cancel (called from a founder-authenticated surface). The running executor stops at its next heartbeat. */
  async requestCancel(idempotencyKey: string, founderUid: string): Promise<void> {
    const ev = await this.db.insertEvent({ job_id: executionJobId(idempotencyKey), kind: "cancel_requested", detail: { by: founderUid, at: new Date().toISOString() } });
    if (ev.error) throw new Error(`cancel could not be recorded: ${ev.error}`);
  }
}
