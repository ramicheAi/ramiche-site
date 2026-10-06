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

describe("leaderless groups are never signaled across passes (independent review + Codex on d747933)", () => {
  it("after a confirmed stop, a reused pid's leaderless group is never killed", async () => {
    const m = memoryJobsDb();
    const cwd = join(execRoot, "mettle", A);
    mkdirSync(cwd, { recursive: true });
    const cli = spawn(bin, ["300"], { cwd, detached: true, stdio: "ignore" });
    kids.push(cli);
    await new Promise((r) => setTimeout(r, 200));
    const id = executionJobId("m6f-reuse-key");
    const fresh = new Date().toISOString();   // fresh heartbeat: pass 1 stops the group but does not reap the row
    m.jobs.set(id, { id, status: "running", source: "m6-executor", started_at: fresh, updated_at: fresh, input: { executionId: A, project: "mettle", limits: { timeoutMs: 30 * 60_000 }, runner: { host: hostname(), pid: await deadPid(), cliPid: cli.pid } } });
    const one = await pass(m);
    expect(one).toMatchObject({ stopped: 1, reaped: 0 });
    expect(m.jobs.get(id)!.status).toBe("running");
    // Pass 2: the pid now names someone else's group whose leader exited (simulated: leader dead, group alive).
    const kills: [number, string][] = [];
    const two = await pass(m, { isAlive: (p: number) => (p === cli.pid ? false : processAlive(p)), isGroupAlive: (g: number) => g === cli.pid, kill: (p: number, s: string) => { kills.push([p, s]); } });
    expect(kills).toEqual([]);
    expect(two.ok).toBe(false);   // reported for a person, never killed
    expect(m.events.map((e) => e.kind)).toEqual(["orphan_stop", "orphan_stopped"]);
  }, 20_000);

  it("a leaderless group is not signaled even with an earlier unconfirmed orphan_stop for the same CLI (PR #55 Codex, d747933)", async () => {
    const m = memoryJobsDb();
    const id = executionJobId("m6f-proven-key");
    const old = new Date(Date.now() - HEARTBEAT_STALE_MS - 60_000).toISOString();
    const leader = 2 ** 22 + 777;
    m.jobs.set(id, { id, status: "running", source: "m6-executor", started_at: old, updated_at: old, input: { executionId: A, project: "mettle", limits: { timeoutMs: 30 * 60_000 }, runner: { host: hostname(), pid: await deadPid(), cliPid: leader } } });
    m.events.push({ job_id: id, kind: "orphan_stop", detail: { cliPid: leader, signal: "SIGTERM", at: old } });   // a pass that died after SIGTERM
    const kills: [number, string][] = [];
    const out = await pass(m, { isAlive: (p: number) => (p === leader ? false : processAlive(p)), isGroupAlive: (g: number) => g === leader, kill: (p: number, s: string) => { kills.push([p, s]); } });
    expect(kills).toEqual([]);
    expect(out).toMatchObject({ ok: false, reaped: 0, unstopped: 1 });
    expect(m.jobs.get(id)!.status).toBe("running");
  }, 20_000);

  it("a proof recorded for a different CLI pid is not proof", async () => {
    const m = memoryJobsDb();
    const id = executionJobId("m6f-otherpid-key");
    const old = new Date(Date.now() - HEARTBEAT_STALE_MS - 60_000).toISOString();
    const leader = 2 ** 22 + 778;
    m.jobs.set(id, { id, status: "running", source: "m6-executor", started_at: old, updated_at: old, input: { executionId: A, project: "mettle", limits: { timeoutMs: 30 * 60_000 }, runner: { host: hostname(), pid: await deadPid(), cliPid: leader } } });
    m.events.push({ job_id: id, kind: "orphan_stop", detail: { cliPid: leader + 1, signal: "SIGTERM", at: old } });
    const kills: [number, string][] = [];
    const out = await pass(m, { isAlive: (p: number) => (p === leader ? false : processAlive(p)), isGroupAlive: (g: number) => g === leader, kill: (p: number, s: string) => { kills.push([p, s]); } });
    expect(kills).toEqual([]);
    expect(out.ok).toBe(false);
  }, 20_000);
});

describe("PR #55 Codex on 262c477", () => {
  it("P1: a live CLI whose executor died but whose identity cannot be proven degrades the pass immediately", async () => {
    const m = memoryJobsDb();
    const cli = spawn(bin, ["300"], { cwd: (mkdirSync(join(root, "not-the-worktree"), { recursive: true }), join(root, "not-the-worktree")), detached: true, stdio: "ignore" });
    kids.push(cli);
    await new Promise((r) => setTimeout(r, 200));
    const id = executionJobId("m6f-unproven-key");
    const fresh = new Date().toISOString();   // before any deadline: the reaper alone would call it "process alive"
    m.jobs.set(id, { id, status: "running", source: "m6-executor", started_at: fresh, updated_at: fresh, input: { executionId: A, project: "mettle", limits: { timeoutMs: 30 * 60_000 }, runner: { host: hostname(), pid: await deadPid(), cliPid: cli.pid } } });
    const kills: number[] = [];
    const out = await pass(m, { kill: (p: number) => { kills.push(p); } });
    expect(kills).toEqual([]);   // never signaled: not provably ours
    expect(out).toMatchObject({ ok: false, unstopped: 1, reaped: 0 });
    expect(m.jobs.get(id)!.status).toBe("running");
  }, 20_000);

  it("P2: a cancel aimed at attempt A that lands after retry B started does not cancel B", async () => {
    const m = memoryJobsDb();
    const key = "m6f-cancel-race-key";
    const id = executionJobId(key);
    const rA = { ...req(A), idempotencyKey: key }, rB = { ...req(B), idempotencyKey: key };
    const storeA = new JobsExecutionStore(m.db);
    expect((await storeA.begin(rA, "h".repeat(64))).state).toBe("new");
    // The founder's cancel reads the row while A runs; before its event is written, A fails and B is restarted.
    let raced = false;
    const racing = { ...m.db, getJob: async (jid: string) => {
      const r = await m.db.getJob(jid);
      if (!raced) {
        raced = true;
        await storeA.finish(rA, failed(rA));
        const storeB = new JobsExecutionStore(m.db);
        await storeB.begin(rB, "h".repeat(64));
        await storeB.restart(rB, failed(rA), "h".repeat(64));
        (racing as unknown as { b: JobsExecutionStore }).b = storeB;
      }
      return r;
    } };
    expect((await new JobsExecutionStore(racing).requestCancelJob(id, "owner")).ok).toBe(true);
    const storeB = (racing as unknown as { b: JobsExecutionStore }).b;
    expect(m.jobs.get(id)!.status).toBe("running");
    expect(await storeB.cancelRequested(rB)).toBe(false);   // the cancel named attempt A, not B
    // A cancel made while B runs does apply to B.
    expect((await new JobsExecutionStore(m.db).requestCancelJob(id, "owner")).ok).toBe(true);
    expect(await storeB.cancelRequested(rB)).toBe(true);
  }, 20_000);
});
