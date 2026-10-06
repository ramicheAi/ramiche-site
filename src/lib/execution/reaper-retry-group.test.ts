/**
 * P06 M6F final-head review (PR #55 Codex P1 + P2). Real processes throughout.
 *
 * P1: a retry under the same approval must record the CURRENT attempt (execution id, runner host and pid), so that a
 *     cockpit death during the retry leaves the reaper looking at the retry's worktree and executor, not attempt A's.
 * P2: an orphaned group whose leader exits on SIGTERM while a helper ignores it must be escalated to SIGKILL, recorded,
 *     and never reaped while any member survives.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExecutionRequest, ExecutionResult } from "./contract";
import { inspectProcess, processAlive, reaperPass, HEARTBEAT_STALE_MS } from "./reaper";
import { executionJobId, JobsExecutionStore } from "./store";
import { memoryJobsDb } from "./__fixtures__/memory-jobs-db";

let root: string, bin: string, execRoot: string;
const kids: ChildProcess[] = [];
const groups: number[] = [];
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "m6f-retry-")));
  bin = join(root, "bin", "claude");
  mkdirSync(join(root, "bin"));
  symlinkSync("/bin/sleep", bin);
  execRoot = join(root, "exec");
});
afterEach(() => {
  for (const g of groups) { try { process.kill(-g, "SIGKILL"); } catch { /* gone */ } }
  for (const k of kids) { try { process.kill(-k.pid!, "SIGKILL"); } catch { /* gone */ } }
  kids.length = 0; groups.length = 0;
  rmSync(root, { recursive: true, force: true });
});

const A = "00000000-0000-4000-8000-0000000000a1", B = "00000000-0000-4000-8000-0000000000b2";
const deadPid = async () => { const c = spawn("true"); await new Promise((r) => c.once("exit", r)); return c.pid!; };
const groupMembers = (pgid: number) => { try { process.kill(-pgid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; } };
const req = (executionId: string): ExecutionRequest => ({
  executionId, commandId: null, missionId: null, founder: { uid: "owner" }, executor: "claude_code",
  project: { slug: "mettle" }, repository: { origin: "ramicheAi/mettle", branch: "main", head: "a".repeat(40) },
  task: { instruction: "Inspect METTLE.", contextRefs: [] }, capability: "L1", limits: { timeoutMs: 30 * 60_000, maxTurns: 5, maxBudgetUsd: null },
  idempotencyKey: "m6f-retry-key", createdAt: new Date().toISOString(),
});
const failed = (r: ExecutionRequest): ExecutionResult => ({
  executionId: r.executionId, executor: "claude_code", status: "failed", startedAt: null, completedAt: new Date().toISOString(), project: "mettle",
  repository: r.repository.origin, branch: null, baseHead: r.repository.head, resultingHead: null, worktree: null, filesChanged: [], checks: [],
  summary: "failed", evidence: { logPath: null, turns: null, modelReported: null }, usage: { inputTokens: null, outputTokens: null, billing: "subscription", reportedCostEstimateUsd: null },
  warnings: [], nextStep: null, failure: { code: "executor_failed", message: "failed" },
});
const age = (m: ReturnType<typeof memoryJobsDb>, id: string) => {
  const old = new Date(Date.now() - HEARTBEAT_STALE_MS - 60_000).toISOString();
  Object.assign(m.jobs.get(id)!, { started_at: old, updated_at: old });
};
const pass = (m: ReturnType<typeof memoryJobsDb>, over: Record<string, unknown> = {}) => reaperPass({
  db: m.db, host: hostname(), isAlive: processAlive, inspect: inspectProcess, kill: (pid, sig) => process.kill(pid, sig),
  claudeBin: bin, execRoot, now: Date.now(), graceMs: 400, ...over,
} as Parameters<typeof reaperPass>[0]);

describe("P1: a retry records the current attempt", () => {
  it("attempt A fails; retry B (new execution id, new cockpit process) is what the row and the reaper see", async () => {
    const m = memoryJobsDb();
    const id = executionJobId("m6f-retry-key");
    const cockpitA = await deadPid(), cockpitB = await deadPid();
    const storeA = new JobsExecutionStore(m.db, { runner: () => ({ host: hostname(), pid: cockpitA }) });
    expect((await storeA.begin(req(A), "h".repeat(64))).state).toBe("new");
    await storeA.finish(req(A), failed(req(A)));
    // The cockpit restarts; the founder retries under the same approval: same job row, new execution id and worktree.
    const storeB = new JobsExecutionStore(m.db, { runner: () => ({ host: hostname(), pid: cockpitB }) });
    expect((await storeB.begin(req(B), "h".repeat(64))).state).toBe("existing");
    expect(await storeB.restart(req(B), failed(req(A)), "h".repeat(64))).toBe(true);
    // Immediately after restart (before any CLI exists) the row already describes attempt B, with no stale CLI pid.
    expect((m.jobs.get(id)!.input as { executionId: string; runner: unknown }).executionId).toBe(B);
    expect((m.jobs.get(id)!.input as { runner: unknown }).runner).toEqual({ host: hostname(), pid: cockpitB });
    mkdirSync(join(execRoot, "mettle", B), { recursive: true });
    const cli = spawn(bin, ["300"], { cwd: join(execRoot, "mettle", B), detached: true, stdio: "ignore" });
    kids.push(cli);
    await new Promise((r) => setTimeout(r, 150));
    await storeB.recordProcess(req(B), cli.pid!);
    // Cockpit B died during the retry: the reaper must find and stop the retry's CLI, then fail the row.
    age(m, id);
    const first = await pass(m);
    const input = m.jobs.get(id)!.input as { executionId: string; runner: { host: string; pid: number; cliPid: number } };
    expect({ executionId: input.executionId, runner: input.runner, stopped: first.stopped, skipped: first.skipped.map((x) => x.reason) })
      .toEqual({ executionId: B, runner: { host: hostname(), pid: cockpitB, cliPid: cli.pid }, stopped: 1, skipped: [] });
    expect(processAlive(cli.pid!)).toBe(false);
    // The group is confirmed gone inside the pass, so the same pass fails the row; nothing is left running.
    expect(first.reaped).toBe(1);
    expect(m.jobs.get(id)!.status).toBe("failed");
  }, 20_000);
});

describe("P2: orphan shutdown escalates and never leaves a terminal row with a live group", () => {
  const adversarialGroup = (cwd: string) => {
    mkdirSync(cwd, { recursive: true });
    // Leader: the CLI binary, default SIGTERM (exits). Helper in the same group: started with SIGTERM ignored.
    const c = spawn("/bin/sh", ["-c", `trap "" TERM; /bin/sleep 300 & trap - TERM; exec "${bin}" 300`], { cwd, detached: true, stdio: "ignore" });
    kids.push(c); groups.push(c.pid!);
    return c;
  };
  const seed = async (m: ReturnType<typeof memoryJobsDb>, cliPid: number) => {
    const id = executionJobId("m6f-group-key");
    const old = new Date(Date.now() - HEARTBEAT_STALE_MS - 60_000).toISOString();
    m.jobs.set(id, { id, status: "running", source: "m6-executor", started_at: old, updated_at: old, input: { executionId: A, project: "mettle", limits: { timeoutMs: 30 * 60_000 }, runner: { host: hostname(), pid: await deadPid(), cliPid } } });
    return id;
  };

  it("leader exits on SIGTERM, helper ignores it: the group is SIGKILLed, the escalation is recorded, then reaped", async () => {
    const m = memoryJobsDb();
    const g = adversarialGroup(join(execRoot, "mettle", A));
    await new Promise((r) => setTimeout(r, 300));
    expect(inspectProcess(g.pid!)?.args.startsWith(bin)).toBe(true);
    const id = await seed(m, g.pid!);
    const out = await pass(m);
    expect(out.stopped).toBe(1);
    expect(groupMembers(g.pid!)).toBe(false);   // nothing in the group survives
    // Escalation is recorded before the SIGKILL, the stop is confirmed, and only then is the row failed.
    expect(m.events.map((e) => e.kind)).toEqual(["orphan_stop", "orphan_kill", "orphan_stopped", "reap_intent", "reaped"]);
    expect(m.events.find((e) => e.kind === "orphan_stopped")?.detail).toMatchObject({ escalated: true });
    expect(out.reaped).toBe(1);
    expect(m.jobs.get(id)!.status).toBe("failed");
    void id;
  }, 20_000);

  it("if the group cannot be confirmed stopped, nothing is reaped and the pass reports it", async () => {
    const m = memoryJobsDb();
    const g = adversarialGroup(join(execRoot, "mettle", A));
    await new Promise((r) => setTimeout(r, 300));
    const id = await seed(m, g.pid!);
    const out = await pass(m, { kill: () => {} });   // signals that do nothing: a group that will not stop
    expect(out.ok).toBe(false);
    expect(out.error ?? "").toMatch(/could not be stopped/);
    expect(m.events.map((e) => e.kind)).toContain("orphan_stop_failed");
    expect(m.jobs.get(id)!.status).toBe("running");   // never terminal while the group lives
    expect(groupMembers(g.pid!)).toBe(true);
  }, 20_000);

  it("a leaderless surviving group is never reaped (the row stays running and is reported)", async () => {
    const m = memoryJobsDb();
    const g = adversarialGroup(join(execRoot, "mettle", A));
    await new Promise((r) => setTimeout(r, 300));
    process.kill(g.pid!, "SIGTERM");   // the leader exits; the helper lives on in its group
    await new Promise((r) => setTimeout(r, 300));
    expect(processAlive(g.pid!)).toBe(false);
    expect(groupMembers(g.pid!)).toBe(true);
    const id = await seed(m, g.pid!);
    const out = await reaperPass({ db: m.db, host: hostname(), isAlive: processAlive, inspect: inspectProcess, kill: () => {}, claudeBin: bin, execRoot, now: Date.now() + 2 * 60 * 60_000, graceMs: 400 } as Parameters<typeof reaperPass>[0]);
    expect(out.reaped).toBe(0);
    expect(out.ok).toBe(false);
    expect(m.jobs.get(id)!.status).toBe("running");
  }, 20_000);
});
