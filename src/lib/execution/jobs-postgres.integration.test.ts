/**
 * P06 M6F: the jobs store, executor and reaper on a REAL Postgres with the real jobs backbone migration (its CHECK
 * constraints, foreign key and updated_at trigger), never production. Opt-in: set M6F_PG_URL to a throwaway local
 * database (for example a cluster from `initdb` on a Unix socket); without it this file is skipped.
 *
 * The JobsDb below issues, through psql, the same filters the Supabase adapter sends through PostgREST
 * (supabase-jobs-db.ts; its exact query shapes are pinned in persistence.test.ts).
 */
import { execFile, execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { routeCommand } from "@/lib/command/router";
import type { ShadowRecord } from "@/lib/command/types";
import { approvalKey } from "./approval";
import type { ExecutionRequest, ExecutionResult } from "./contract";
import { processAlive, reapAbandoned, HEARTBEAT_STALE_MS } from "./reaper";
import { approveExecution, prepareExecution, type ApproveDeps } from "./service";
import { EXECUTOR_SOURCE, executionJobId, JobsExecutionStore, type JobsDb, type RunningJob } from "./store";
import type { RepoEntry } from "./projects";

const PG_URL = process.env.M6F_PG_URL ?? "";
const PSQL = process.env.M6F_PSQL ?? "psql";
const run = promisify(execFile);

/** One psql call; variables are passed with -v and quoted by psql (:'name'), never interpolated into SQL text. */
function sqlAt(text: string, vars: Record<string, string> = {}, url = PG_URL): Promise<{ out: string; err: string | null }> {
  const args = [url, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
  for (const [k, v] of Object.entries(vars)) args.push("-v", `${k}=${v}`);
  return new Promise((resolve) => {
    const c = spawn(PSQL, [...args, "-f", "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    c.stdout.on("data", (d) => { out += d; });
    c.stderr.on("data", (d) => { err += d; });
    c.on("error", (e) => resolve({ out: "", err: e.message }));
    c.on("close", (code) => resolve(code === 0 ? { out: out.trim(), err: null } : { out: "", err: err || `psql exit ${code}` }));
    c.stdin.end(text);
  });
}
const cols = (o: Record<string, unknown>) => Object.keys(o).map((c) => {
  if (!/^[a-z_]+$/.test(c)) throw new Error(`bad column ${c}`);
  return c;
});

/** JobsDb on Postgres with the Supabase adapter's semantics: errors as values, 23505 is a conflict. */
function pgJobsDb(url = PG_URL): JobsDb {
  const sql = (t: string, v: Record<string, string> = {}) => sqlAt(t, v, url);
  return {
    async insertJob(row) {
      const c = cols(row).join(", ");
      const r = await sql(`insert into jobs (${c}) select ${c} from jsonb_populate_record(null::jobs, :'row'::jsonb)`, { row: JSON.stringify(row) });
      if (r.err && /23505/.test(r.err)) return { conflict: true, error: null };
      return { conflict: false, error: r.err };
    },
    async getJob(id) {
      const r = await sql(`select json_build_object('input', j.input, 'status', j.status, 'error', j.error, 'source', j.source,
        'resultEvent', (select detail from job_events e where e.job_id = j.id and e.kind = 'execution_result' order by created_at desc limit 1))
        from jobs j where j.id = :'id'::uuid`, { id });
      if (r.err) return { row: null, error: r.err };
      return { row: r.out ? JSON.parse(r.out) : null, error: null };
    },
    async updateJob(id, patch) {
      const c = cols(patch).join(", ");
      const r = await sql(`update jobs set (${c}) = (select ${c} from jsonb_populate_record(null::jobs, :'patch'::jsonb)) where id = :'id'::uuid`, { id, patch: JSON.stringify(patch) });
      return { error: r.err };
    },
    async insertEvent(row) {
      const c = cols(row).join(", ");
      const r = await sql(`insert into job_events (${c}) select ${c} from jsonb_populate_record(null::job_events, :'row'::jsonb)`, { row: JSON.stringify(row) });
      return { error: r.err };
    },
    async updateJobIf(id, expect, patch) {
      const c = cols(patch).join(", ");
      const when = expect.updated_at !== null ? ` and updated_at = :'ts'::timestamptz` : "";
      const r = await sql(`with u as (update jobs set (${c}) = (select ${c} from jsonb_populate_record(null::jobs, :'patch'::jsonb))
        where id = :'id'::uuid and status = :'st'${when} returning id) select count(*) from u`,
      { id, st: expect.status, patch: JSON.stringify(patch), ...(expect.updated_at !== null ? { ts: expect.updated_at } : {}) });
      return { updated: !r.err && r.out === "1", error: r.err };
    },
    async hasEvent(jobId, kind, sinceAt) {
      const r = await sql(`select count(*) from job_events where job_id = :'id'::uuid and kind = :'k'${sinceAt ? ` and detail->>'at' >= :'since'` : ""}`, { id: jobId, k: kind, ...(sinceAt ? { since: sinceAt } : {}) });
      return { found: !r.err && Number(r.out) > 0, error: r.err };
    },
    async listRunning(source) {
      const r = await sql(`select coalesce(json_agg(x order by x.started_at), '[]') from (select id, input,
        to_json(started_at)#>>'{}' as started_at, to_json(updated_at)#>>'{}' as updated_at from jobs
        where status = 'running' and source = :'src' order by started_at limit 500) x`, { src: source });
      return { rows: r.err ? [] : (JSON.parse(r.out) as RunningJob[]), error: r.err };
    },
  };
}
const sql = (t: string, v: Record<string, string> = {}) => sqlAt(t, v);
const row = async (id: string) => JSON.parse((await sql(`select row_to_json(j) from jobs j where id = :'id'::uuid`, { id })).out || "null");
const events = async (id: string) => (await sql(`select coalesce(json_agg(kind order by created_at), '[]') from job_events where job_id = :'id'::uuid`, { id })).out;

const FAKE = join(process.cwd(), "src/lib/execution/__fixtures__/fake-claude.mjs");
const OWNER = "owner-uid-m6f";
const KEY = approvalKey("m".repeat(48))!;
const registry: RepoEntry[] = [{ slug: "mettle", origin: "test-owner/proj-a", checkouts: ["proj-a"], aliases: ["mettle"] }];
let root = "", bare = "";
const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();
const tip = async (_e: RepoEntry, b: string) => { try { return g(bare, "rev-parse", "--verify", `refs/heads/${b}`); } catch { return null; } };

const shadow = (text: string, id: string): ShadowRecord => ({
  id, command: text, routedAt: "t", routerVersion: "m5-rules-1", shadow: true, executed: false,
  missionContext: null, supersedes: null, decision: routeCommand({ text }), linkedMissions: [],
});
const deps = (store: JobsExecutionStore, rec: string, over: Partial<ApproveDeps["executor"]> = {}): ApproveDeps => ({
  surface: "harness", ownerUid: OWNER, approvalKey: KEY, remoteTip: tip, registry,
  executor: {
    roots: [join(root, "checkouts")], execRoot: join(root, "exec"), store, claudeBin: FAKE, registry, heartbeatMs: 150,
    remoteTip: async (_r, b) => tip(registry[0], b), freeBytes: () => 1e12, telemetry: vi.fn(async () => {}), extraEnv: { FAKE_CLAUDE_RECORD: rec }, ...over,
  },
});
const FIX = (n: number) => `Claude Code, fix the METTLE roster import (${n})`;
const plan = (p: object) => ` FAKE:${JSON.stringify(p)}`;

describe.skipIf(!PG_URL)("M6F jobs store on real Postgres (jobs backbone migration)", () => {
  beforeAll(async () => {
    const mig = readFileSync(join(process.cwd(), "supabase/migrations/20260606191729_jobs_backbone.sql"), "utf8");
    const reset = await sql("drop table if exists job_events; drop table if exists jobs;");
    if (reset.err) throw new Error(reset.err);
    const apply = await run(PSQL, [PG_URL, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", mig]).catch((e) => { throw new Error(String(e.stderr || e)); });
    void apply;
    chmodSync(FAKE, 0o755);
    root = mkdtempSync(join(tmpdir(), "m6f-pg-"));
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
  }, 60_000);
  afterAll(() => { if (root) rmSync(root, { recursive: true, force: true }); });

  it("the real schema accepts exactly what the store writes, and rejects a status outside its CHECK", async () => {
    const bad = await pgJobsDb().insertJob({ id: "00000000-0000-4000-8000-0000000000f1", title: "x", kind: "dev", status: "succeeded", source: EXECUTOR_SOURCE });
    expect(bad.error).toMatch(/23514|check constraint/);
    const orphan = await pgJobsDb().insertEvent({ job_id: "00000000-0000-4000-8000-0000000000f2", kind: "log", detail: {} });
    expect(orphan.error).toMatch(/23503|foreign key/);
  });

  it("prepare -> approve -> job row -> running -> heartbeats -> result event -> done; a duplicate approval never runs twice", async () => {
    const store = new JobsExecutionStore(pgJobsDb());
    const rec = join(root, "rec-1.json");
    const rs = shadow(FIX(1) + plan({ actions: [{ sleep: 900 }], result: "Inspected." }), "9e000000-0000-4000-8000-0000000000a1");
    const p = await prepareExecution({ record: rs, founderUid: OWNER }, deps(store, rec));
    if (!p.ok) throw new Error(p.message);
    const id = executionJobId(p.request.idempotencyKey);
    const pending = approveExecution({ record: rs, founderUid: OWNER, seenBindingHash: p.bindingHash }, deps(store, rec));
    await new Promise((r) => setTimeout(r, 450));
    const mid = await row(id);
    expect(mid).toMatchObject({ status: "running", kind: "dev", agent: "claude-code", source: EXECUTOR_SOURCE });
    expect(mid.input).toMatchObject({ bindingHash: p.bindingHash, capability: "L2", project: "mettle", founder: OWNER, runner: { host: hostname(), pid: process.pid } });
    expect(typeof mid.input.runner.cliPid).toBe("number");
    const firstBeat = mid.updated_at;
    await new Promise((r) => setTimeout(r, 400));
    expect(Date.parse((await row(id)).updated_at)).toBeGreaterThan(Date.parse(firstBeat));   // heartbeats move updated_at (trigger)
    const out = await pending;
    if (!out.ok) throw new Error(out.message);
    expect(out.result.status).toBe("succeeded");
    expect(await row(id)).toMatchObject({ status: "done", progress: "succeeded", error: null });
    expect(JSON.parse(await events(id))).toEqual(["execution_result"]);
    rmSync(rec);
    const again = await approveExecution({ record: rs, founderUid: OWNER, seenBindingHash: p.bindingHash }, deps(store, rec));
    expect(again.ok && again.result).toEqual(out.result);
    expect(existsSync(rec)).toBe(false);   // the CLI did not run again
    expect((await sql(`select count(*) from jobs where id = :'id'::uuid`, { id })).out).toBe("1");
  }, 60_000);

  it("running -> founder cancel -> canceled; the CLI process is gone and the row is terminal", async () => {
    const store = new JobsExecutionStore(pgJobsDb());
    const rec = join(root, "rec-2.json");
    const rs = shadow(FIX(2) + plan({ actions: [{ sleep: 20_000 }], result: "never" }), "9e000000-0000-4000-8000-0000000000a2");
    const p = await prepareExecution({ record: rs, founderUid: OWNER }, deps(store, rec));
    if (!p.ok) throw new Error(p.message);
    const id = executionJobId(p.request.idempotencyKey);
    const pending = approveExecution({ record: rs, founderUid: OWNER, seenBindingHash: p.bindingHash }, deps(store, rec));
    await new Promise((r) => setTimeout(r, 500));
    const cliPid = (await row(id)).input.runner.cliPid as number;
    expect(processAlive(cliPid)).toBe(true);
    await store.requestCancel(p.request.idempotencyKey, OWNER);
    const out = await pending;
    if (!out.ok) throw new Error(out.message);
    expect(out.result.status).toBe("canceled");
    expect(processAlive(cliPid)).toBe(false);
    expect(await row(id)).toMatchObject({ status: "canceled", progress: "canceled" });
    expect(JSON.parse(await events(id))).toEqual(["cancel_requested", "execution_result"]);
  }, 60_000);

  it("executor disappears -> reaper fails the row with an audit trail; concurrent reapers reap once; a live process is never reaped", async () => {
    const db = pgJobsDb();
    const store = new JobsExecutionStore(db);
    const mk = (n: number): ExecutionRequest => ({
      executionId: `00000000-0000-4000-8000-00000000c0${n}0`, commandId: null, missionId: null, founder: { uid: OWNER }, executor: "claude_code",
      project: { slug: "mettle" }, repository: { origin: "test-owner/proj-a", branch: "main", head: "a".repeat(40) },
      task: { instruction: "Inspect METTLE.", contextRefs: [] }, capability: "L1", limits: { timeoutMs: 10 * 60_000, maxTurns: 20, maxBudgetUsd: null },
      idempotencyKey: `m6f-reap-${n}`, createdAt: new Date().toISOString(),
    });
    // A real executor child that dies without finishing: its CLI pid is recorded, then the process is gone.
    const dead = mk(1), live = mk(2);
    expect((await store.begin(dead, "b".repeat(64))).state).toBe("new");
    const child = spawn("sleep", ["30"], { stdio: "ignore" });
    await store.recordProcess(dead, child.pid!);
    child.kill("SIGKILL");
    await new Promise((r) => child.once("exit", r));
    expect(processAlive(child.pid!)).toBe(false);
    expect((await store.begin(live, "c".repeat(64))).state).toBe("new");
    await store.recordProcess(live, process.pid);
    const later = Date.now() + HEARTBEAT_STALE_MS + 5_000;   // heartbeats stale for both
    const [a, b] = await Promise.all([1, 2].map(() => reapAbandoned({ db, now: later, host: hostname(), isAlive: processAlive })));
    const reaped = [...a.reaped, ...b.reaped].map((x) => x.id);
    expect(a.error).toBeNull(); expect(b.error).toBeNull();
    expect(reaped).toEqual([executionJobId(dead.idempotencyKey)]);   // exactly once across both reapers
    expect(await row(executionJobId(dead.idempotencyKey))).toMatchObject({ status: "failed", progress: "reaped" });
    const trail = JSON.parse(await events(executionJobId(dead.idempotencyKey))) as string[];
    expect(trail.filter((k) => k === "reaped")).toHaveLength(1);
    expect(trail[0]).toBe("reap_intent");
    expect(await row(executionJobId(live.idempotencyKey))).toMatchObject({ status: "running" });   // live process left alone
    // A retry under the reaped approval reports the abandoned result; it never runs again.
    const again = await store.begin(dead, "b".repeat(64));
    expect(again).toMatchObject({ state: "existing", result: { status: "failed", failure: { code: "abandoned" } } });
    // Clean up the live row as its executor would.
    const done: ExecutionResult = { ...(again.state === "existing" ? again.result! : ({} as ExecutionResult)), status: "succeeded", failure: null, summary: "ok" };
    await store.finish(live, done);
    expect((await sql(`select count(*) from jobs where status = 'running'`)).out).toBe("0");   // no stuck running rows
  }, 60_000);

  it("store unavailable fails closed: nothing runs and no row is created", async () => {
    const broken: JobsDb = { ...pgJobsDb(), insertJob: async () => ({ conflict: false, error: "connection refused" }) };
    const store = new JobsExecutionStore(broken);
    const rec = join(root, "rec-3.json");
    const rs = shadow(FIX(3) + plan({ actions: [], result: "x" }), "9e000000-0000-4000-8000-0000000000a3");
    const p = await prepareExecution({ record: rs, founderUid: OWNER }, deps(store, rec));
    if (!p.ok) throw new Error(p.message);
    const out = await approveExecution({ record: rs, founderUid: OWNER, seenBindingHash: p.bindingHash }, deps(store, rec));
    expect(out.ok && out.result.failure?.code).toBe("store_unavailable");
    expect(existsSync(rec)).toBe(false);
    expect((await sql(`select count(*) from jobs where id = :'id'::uuid`, { id: executionJobId(p.request.idempotencyKey) })).out).toBe("0");
    // And with the database itself unreachable (nothing listens there): the same refusal, from a real connection error.
    const rec4 = join(root, "rec-4.json");
    const down = new JobsExecutionStore(pgJobsDb("postgresql://127.0.0.1:1/none?connect_timeout=2"));
    const out2 = await approveExecution({ record: rs, founderUid: OWNER, seenBindingHash: p.bindingHash }, { ...deps(down, rec4) });
    expect(out2.ok && out2.result.failure?.code).toBe("store_unavailable");
    expect(existsSync(rec4)).toBe(false);
  }, 60_000);
});
