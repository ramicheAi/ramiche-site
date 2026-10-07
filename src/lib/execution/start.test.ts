/**
 * P06 M6H: a founder's approval returns once the run is durably recorded; the run continues on its own and its result
 * comes from the job. Real git and the fake CLI; the status view and its route are checked against the same records.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeCommand } from "@/lib/command/router";
import type { ShadowRecord } from "@/lib/command/types";
import { approvalKey } from "./approval";
import type { ExecutionResult } from "./contract-core";
import type { RepoEntry } from "./projects";
import { executionView } from "./status";
import { prepareExecution, startExecution, type ApproveDeps } from "./service";
import { executionJobId, JobsExecutionStore } from "./store";
import { memoryJobsDb } from "./__fixtures__/memory-jobs-db";

const FAKE = join(process.cwd(), "src/lib/execution/__fixtures__/fake-claude.mjs");
const OWNER = "owner-start";
const KEY = approvalKey("s".repeat(48))!;
const registry: RepoEntry[] = [{ slug: "mettle", origin: "test-owner/proj-a", checkouts: ["proj-a"], aliases: ["mettle"] }];
let root: string, bare: string, rec: string;
const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();
const tip = async (_e: RepoEntry, b: string) => { try { return g(bare, "rev-parse", "--verify", `refs/heads/${b}`); } catch { return null; } };
const shadow = (text: string, id: string): ShadowRecord => ({
  id, command: text, routedAt: "t", routerVersion: "m5-rules-1", shadow: true, executed: false,
  missionContext: null, supersedes: null, decision: routeCommand({ text }), linkedMissions: [],
});
const deps = (store: JobsExecutionStore, over: Partial<ApproveDeps["executor"]> = {}): ApproveDeps => ({
  surface: "harness", ownerUid: OWNER, approvalKey: KEY, remoteTip: tip, registry,
  executor: {
    roots: [join(root, "checkouts")], execRoot: join(root, "exec"), store, claudeBin: FAKE, registry, heartbeatMs: 100,
    remoteTip: async (_r, b) => tip(registry[0], b), freeBytes: () => 1e12, telemetry: async () => {}, extraEnv: { FAKE_CLAUDE_RECORD: rec }, ...over,
  },
});

beforeEach(() => {
  chmodSync(FAKE, 0o755);
  root = mkdtempSync(join(tmpdir(), "m6h-"));
  bare = join(root, "origin.git");
  mkdirSync(join(root, "checkouts"));
  g(root, "init", "-q", "--bare", "-b", "main", bare);
  const seed = join(root, "seed");
  g(root, "init", "-q", "-b", "main", seed);
  writeFileSync(join(seed, "README.md"), "x\n");
  g(seed, "add", "-A"); g(seed, "commit", "-qm", "init"); g(seed, "push", "-q", bare, "main");
  const repo = join(root, "checkouts", "proj-a");
  g(root, "clone", "-q", bare, repo);
  g(repo, "remote", "set-url", "origin", "https://github.com/test-owner/proj-a.git");
  rec = join(root, "record.json");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("start: the approval returns when the run is recorded, not when it finishes", () => {
  it("a slow analysis is accepted while it is still running, and its job shows running, then the result", async () => {
    const m = memoryJobsDb();
    const store = new JobsExecutionStore(m.db);
    // The fake CLI sleeps 1.5 s, so the run is genuinely still going when the approval returns.
    const text = "Claude Code, inspect METTLE and tell me what is blocking production. FAKE:" + JSON.stringify({ actions: [{ sleep: 1500 }], result: "Inspected." });
    const rs = shadow(text, "9e000000-0000-4000-8000-0000000000e1");
    const p = await prepareExecution({ record: rs, founderUid: OWNER, choices: { capability: "L1" } }, deps(store));
    if (!p.ok) throw new Error(p.message);
    const t0 = Date.now();
    const started = await startExecution({ record: rs, founderUid: OWNER, seenBindingHash: p.bindingHash, choices: { capability: "L1" } }, deps(store, { heartbeatMs: 100 }));
    const acceptedMs = Date.now() - t0;
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.jobId).toBe(executionJobId(p.request.idempotencyKey));
    // The job is running and the run is still going: the request did not wait for the Claude run.
    const runningRow = m.jobs.get(started.jobId)!;
    expect(runningRow.status).toBe("running");
    // The approval re-derives the attempt (its own execution id, outside the binding); the job names THAT attempt.
    expect(executionView({ status: "running", error: null, input: runningRow.input as Record<string, unknown>, resultEvent: null })).toMatchObject({ state: "running", executionId: started.executionId });
    // Then the run completes on its own and the job holds the result.
    await vi.waitFor(() => expect(m.jobs.get(started.jobId)!.status).not.toBe("running"), { timeout: 20_000, interval: 100 });
    expect(m.jobs.get(started.jobId)!.status).toBe("done");
    expect(acceptedMs).toBeLessThan(15_000);
  }, 30_000);

  it("a refusal (the gate, a bad binding) is returned as a refusal, not as a started run", async () => {
    const m = memoryJobsDb();
    const store = new JobsExecutionStore(m.db);
    const rs = shadow("Claude Code, inspect METTLE", "9e000000-0000-4000-8000-0000000000e2");
    const out = await startExecution({ record: rs, founderUid: OWNER, seenBindingHash: "0".repeat(64) }, deps(store));
    expect(out).toMatchObject({ ok: false, code: "changed_since_shown" });
    expect(m.jobs.size).toBe(0);
    expect(existsRec()).toBe(false);
  });
});

const existsRec = () => existsSync(rec);

describe("status view: the current attempt, never a stale result", () => {
  const base = { error: null, input: { executionId: "00000000-0000-4000-8000-0000000000b2" } } as const;
  const r = (over: Partial<ExecutionResult>): ExecutionResult => ({
    executionId: "00000000-0000-4000-8000-0000000000a1", executor: "claude_code", status: "failed", startedAt: null, completedAt: "2026-10-06T20:00:00Z",
    project: "mettle", repository: "x", branch: null, baseHead: "a".repeat(40), resultingHead: null, worktree: null, filesChanged: [], checks: [],
    summary: "s", evidence: { logPath: null, turns: null, modelReported: null }, usage: { inputTokens: null, outputTokens: null, billing: "subscription", reportedCostEstimateUsd: null },
    warnings: [], nextStep: null, failure: { code: "executor_failed", message: "boom" }, ...over,
  });
  it("a retry reopened as running shows running, not attempt A's failed result", () => {
    expect(executionView({ ...base, status: "running", resultEvent: r({}) })).toMatchObject({ state: "running", executionId: base.input.executionId });
  });
  it("a finished attempt shows its own result; canceled and failed are told apart; an unrecorded end says why", () => {
    expect(executionView({ ...base, status: "done", resultEvent: r({ executionId: base.input.executionId, status: "succeeded", failure: null }) })).toMatchObject({ state: "done" });
    expect(executionView({ ...base, status: "canceled", resultEvent: r({ executionId: base.input.executionId, status: "canceled" }) })).toMatchObject({ state: "canceled" });
    expect(executionView({ ...base, status: "failed", resultEvent: r({ executionId: base.input.executionId }) })).toMatchObject({ state: "failed", message: "boom" });
    expect(executionView({ ...base, status: "failed", error: "Abandoned: process gone", resultEvent: null })).toMatchObject({ state: "failed", result: null, message: "Abandoned: process gone" });
  });
});

describe("PR #57 Codex: the status read is one consistent snapshot", () => {
  it("a retry between the row read and the event read never yields a terminal view of the old attempt", async () => {
    const { statusSnapshot, executionView } = await import("./status");
    const A = "00000000-0000-4000-8000-0000000000a1", B = "00000000-0000-4000-8000-0000000000b2";
    const oldFailed = { executionId: A, status: "failed", failure: { code: "executor_failed", message: "old" }, summary: "old" } as unknown as ExecutionResult;
    // The first read sees attempt A finished; by the second read attempt B is running (a retry reopened the row).
    const reads = [
      { row: { status: "failed", error: "old", input: { executionId: A }, resultEvent: oldFailed }, error: null },
      { row: { status: "running", error: null, input: { executionId: B }, resultEvent: oldFailed }, error: null },
    ];
    let i = 0;
    const db = { getJob: async () => reads[Math.min(i++, reads.length - 1)] };
    const snap = await statusSnapshot(db as never, "job");
    expect(executionView(snap.row!)).toMatchObject({ state: "running", executionId: B });
  });
  it("a snapshot that cannot settle is reported as running, never as a stale failure", async () => {
    const { statusSnapshot, executionView } = await import("./status");
    const A = "00000000-0000-4000-8000-0000000000a1";
    const flip = { row: { status: "failed", error: "x", input: { executionId: A }, resultEvent: null }, error: null };
    const flop = { row: { status: "running", error: null, input: { executionId: A }, resultEvent: null }, error: null };
    let n = 0;
    const db = { getJob: async () => (n++ % 2 === 0 ? flip : flop) };
    expect(executionView((await statusSnapshot(db as never, "job")).row!)).toMatchObject({ state: "running" });
  });
});

describe("PR #57 Codex on d46d75a: a refusal that never recorded a run is not 'started'", () => {
  it("a run refused before its record exists (low disk) is returned as a refusal, never as a started job", async () => {
    const m = memoryJobsDb();
    const store = new JobsExecutionStore(m.db);
    const text = "Claude Code, inspect METTLE and tell me what is blocking production.";
    const rs = shadow(text, "9e000000-0000-4000-8000-0000000000f1");
    const p = await prepareExecution({ record: rs, founderUid: OWNER, choices: { capability: "L1" } }, deps(store));
    if (!p.ok) throw new Error(p.message);
    const out = await startExecution({ record: rs, founderUid: OWNER, seenBindingHash: p.bindingHash, choices: { capability: "L1" } }, deps(store, { freeBytes: () => 0 }));
    expect(out).toMatchObject({ ok: false, code: "disk_low" });
    expect(m.jobs.size).toBe(0);
  }, 30_000);
});

describe("PR #57 Codex on 9523c33: one active run per command, enforced at approval", () => {
  it("while a run for the command is running, a second approval is refused (even with a different branch head)", async () => {
    const { refuseIfRunning } = await import("./service");
    const m = memoryJobsDb();
    const store = new JobsExecutionStore(m.db);
    const text = "Claude Code, inspect METTLE and tell me what is blocking production.";
    const rs = shadow(text, "9e000000-0000-4000-8000-0000000000d1");
    expect(await refuseIfRunning(m.db, rs.id)).toEqual({ ok: true });
    const p = await prepareExecution({ record: rs, founderUid: OWNER, choices: { capability: "L1" } }, deps(store));
    if (!p.ok) throw new Error(p.message);
    const started = await startExecution({ record: rs, founderUid: OWNER, seenBindingHash: p.bindingHash, choices: { capability: "L1" } }, deps(store, { heartbeatMs: 100 }));
    expect(started.ok).toBe(true);
    const second = await refuseIfRunning(m.db, rs.id);
    expect(second).toMatchObject({ ok: false, code: "already_running" });
    await vi.waitFor(() => expect(m.jobs.get(executionJobId(p.request.idempotencyKey))!.status).not.toBe("running"), { timeout: 20_000, interval: 100 });
    expect(await refuseIfRunning(m.db, rs.id)).toEqual({ ok: true });
  }, 30_000);
});
