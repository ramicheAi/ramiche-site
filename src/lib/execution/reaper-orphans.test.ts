/**
 * P06 M6F: a run orphaned by a cockpit restart (executor gone, CLI still running in its own group) is stopped only when
 * the live pid is provably that run's CLI, then reaped. Real processes: a symlink to /bin/sleep stands in for the CLI
 * binary so `ps` and `lsof` see a real executable, process group and working directory.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectProcess, processAlive, reaperPass, stopOrphans, HEARTBEAT_STALE_MS } from "./reaper";
import { EXECUTOR_SOURCE } from "./store";
import { memoryJobsDb } from "./__fixtures__/memory-jobs-db";

let root: string, bin: string, execRoot: string;
const kids: ChildProcess[] = [];
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "m6f-orphan-")));
  bin = join(root, "bin", "claude");
  mkdirSync(join(root, "bin"));
  symlinkSync("/bin/sleep", bin);
  execRoot = join(root, "exec");
});
afterEach(() => { for (const k of kids) { try { process.kill(-k.pid!, "SIGKILL"); } catch { /* gone */ } } kids.length = 0; rmSync(root, { recursive: true, force: true }); });

const deadPid = async () => { const c = spawn("true"); await new Promise((r) => c.once("exit", r)); return c.pid!; };
const startCli = (cwd: string, exe = bin) => { mkdirSync(cwd, { recursive: true }); const c = spawn(exe, ["30"], { cwd, detached: true, stdio: "ignore" }); kids.push(c); return c; };
const seed = (m: ReturnType<typeof memoryJobsDb>, id: string, executionId: string, runner: Record<string, unknown>) => {
  const old = new Date(Date.now() - HEARTBEAT_STALE_MS - 60_000).toISOString();
  m.jobs.set(id, { id, status: "running", source: EXECUTOR_SOURCE, started_at: old, updated_at: old, input: { executionId, project: "mettle", limits: { timeoutMs: 30 * 60_000 }, runner } });
};
const opts = (m: ReturnType<typeof memoryJobsDb>, kill = (pid: number, sig: NodeJS.Signals) => process.kill(pid, sig)) => ({
  db: m.db, host: hostname(), isAlive: processAlive, inspect: inspectProcess, kill, claudeBin: bin, execRoot, now: Date.now(),
});

describe("orphaned CLI after a cockpit restart", () => {
  it("is stopped (whole group) and then reaped, with an orphan_stop event first", async () => {
    const m = memoryJobsDb();
    const cli = startCli(join(execRoot, "mettle", "exec-1"));
    await new Promise((r) => setTimeout(r, 200));
    expect(inspectProcess(cli.pid!)).toMatchObject({ pgid: cli.pid, cwd: join(execRoot, "mettle", "exec-1") });
    seed(m, "job-1", "exec-1", { host: hostname(), pid: await deadPid(), cliPid: cli.pid });
    const first = await reaperPass(opts(m));
    expect(first.stopped).toBe(1);
    expect(m.events.map((e) => e.kind)).toEqual(["orphan_stop"]);
    await new Promise((r) => cli.once("exit", r));
    expect(processAlive(cli.pid!)).toBe(false);
    const second = await reaperPass({ ...opts(m), now: Date.now() });
    expect(second).toMatchObject({ reaped: 1, ok: true, error: null });
    expect(m.jobs.get("job-1")).toMatchObject({ status: "failed", progress: "reaped" });
  }, 20_000);

  it("is never stopped when the pid is not provably this run's CLI (other binary, other directory) or its executor is alive", async () => {
    const m = memoryJobsDb();
    const wrongDir = startCli(join(root, "elsewhere"));
    symlinkSync("/bin/sleep", join(root, "bin", "other"));
    const wrongBin = startCli(join(execRoot, "mettle", "exec-3"), join(root, "bin", "other"));
    const watched = startCli(join(execRoot, "mettle", "exec-4"));
    await new Promise((r) => setTimeout(r, 200));
    seed(m, "job-2", "exec-2", { host: hostname(), pid: await deadPid(), cliPid: wrongDir.pid });
    seed(m, "job-3", "exec-3", { host: hostname(), pid: await deadPid(), cliPid: wrongBin.pid });
    seed(m, "job-4", "exec-4", { host: hostname(), pid: process.pid, cliPid: watched.pid });
    seed(m, "job-5", "exec-5", { host: "another-host", pid: 1, cliPid: watched.pid });
    const kills: number[] = [];
    const out = await stopOrphans(opts(m, (pid) => { kills.push(pid); }));
    expect(out.stopped).toEqual([]);
    expect(kills).toEqual([]);
    expect([wrongDir, wrongBin, watched].every((c) => processAlive(c.pid!))).toBe(true);
    // A live CLI keeps its row running: the reaper reports it rather than inventing a failure.
    const pass = await reaperPass(opts(m, () => {}));
    expect(pass.reaped).toBe(0);
    expect([...m.jobs.values()].every((j) => j.status === "running")).toBe(true);
  }, 20_000);

  it("a database error stops the pass before any signal", async () => {
    const m = memoryJobsDb();
    const cli = startCli(join(execRoot, "mettle", "exec-6"));
    await new Promise((r) => setTimeout(r, 200));
    seed(m, "job-6", "exec-6", { host: hostname(), pid: await deadPid(), cliPid: cli.pid });
    m.fail.insertEvent = "connection reset";
    const kills: number[] = [];
    const out = await reaperPass(opts(m, (pid) => { kills.push(pid); }));
    expect(out).toMatchObject({ ok: false, stopped: 0 });
    expect(out.error).toMatch(/nothing was stopped/);
    expect(kills).toEqual([]);
    expect(processAlive(cli.pid!)).toBe(true);
  }, 20_000);
});
