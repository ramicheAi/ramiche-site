/**
 * P06 M6B: executions persisted on the existing jobs / job_events tables. Heartbeat, founder cancel, the reaper's
 * conservative criteria, and the Supabase adapter's exact queries.
 */
import { hostname } from "node:os";
import { describe, expect, it } from "vitest";
import type { ExecutionRequest } from "./contract";
import { processAlive, reapAbandoned, DEADLINE_GRACE_MS, HEARTBEAT_STALE_MS } from "./reaper";
import { EXECUTOR_SOURCE, executionJobId, JobsExecutionStore } from "./store";
import { supabaseJobsDb } from "./supabase-jobs-db";
import { memoryJobsDb } from "./__fixtures__/memory-jobs-db";

const req = (over: Partial<ExecutionRequest> = {}): ExecutionRequest => ({
  executionId: "00000000-0000-4000-8000-000000000001", commandId: null, missionId: null, founder: { uid: "owner" }, executor: "claude_code",
  project: { slug: "mettle" }, repository: { origin: "ramicheAi/mettle", branch: "main", head: "a".repeat(40) },
  task: { instruction: "Inspect METTLE.", contextRefs: [] }, capability: "L1", limits: { timeoutMs: 10 * 60_000, maxTurns: 20, maxBudgetUsd: null },
  idempotencyKey: "idem-persist-1", createdAt: "2026-10-06T03:00:00Z", ...over,
});

describe("jobs store: identity, heartbeat and founder cancel", () => {
  it("the jobs row carries founder, binding, project, repository, capability, limits and process evidence; no prompt history or secrets", async () => {
    const { db, jobs } = memoryJobsDb();
    await new JobsExecutionStore(db).begin(req(), "bind-1");
    const row = jobs.get(executionJobId("idem-persist-1"))!;
    expect(row).toMatchObject({ source: EXECUTOR_SOURCE, status: "running", agent: "claude-code", input: { founder: "owner", bindingHash: "bind-1", project: "mettle", origin: "ramicheAi/mettle", branch: "main", capability: "L1", limits: { timeoutMs: 600000 } } });
    expect((row.input as { runner: { pid: number; host: string } }).runner).toMatchObject({ pid: process.pid, host: expect.any(String) });
    expect(Object.keys(row.input as object)).not.toContain("instruction");
    expect(JSON.stringify(row)).not.toMatch(/secret|token|password|history/i);
  });

  it("a heartbeat touches only a running row; a founder cancel is recorded and then seen", async () => {
    const { db, jobs, events } = memoryJobsDb();
    const s = new JobsExecutionStore(db);
    await s.begin(req(), "b");
    const id = executionJobId("idem-persist-1");
    jobs.get(id)!.updated_at = "2026-10-06T03:00:00.000Z";
    await s.heartbeat(req());
    expect(jobs.get(id)!.updated_at).not.toBe("2026-10-06T03:00:00.000Z");
    expect(await s.cancelRequested(req())).toBe(false);
    await s.requestCancel("idem-persist-1", "owner", req().executionId);
    expect(await s.cancelRequested(req())).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ job_id: id, kind: "cancel_requested", detail: expect.objectContaining({ by: "owner" }) }));
    jobs.get(id)!.status = "done";
    const before = jobs.get(id)!.updated_at;
    await s.heartbeat(req());
    expect(jobs.get(id)!.updated_at).toBe(before);   // finished rows are never touched by a late heartbeat
  });

  it("store errors are loud", async () => {
    const m = memoryJobsDb();
    const s = new JobsExecutionStore(m.db);
    m.fail.updateJobIf = "down"; m.fail.hasEvent = "down"; m.fail.insertEvent = "down";
    await expect(s.heartbeat(req())).rejects.toThrow(/heartbeat failed/);
    await expect(s.cancelRequested(req())).rejects.toThrow(/cancel check failed/);
    await expect(s.requestCancel("k", "owner", "e")).rejects.toThrow(/could not be recorded/);
  });
});

describe("reaper: only demonstrably abandoned executions", () => {
  const NOW = Date.parse("2026-10-06T05:00:00Z");
  const iso = (ms: number) => new Date(ms).toISOString();
  function seed(over: { started: number; beat: number; host?: string; pid?: number; timeoutMs?: number; source?: string; status?: string }) {
    const m = memoryJobsDb();
    m.jobs.set("j1", {
      id: "j1", status: over.status ?? "running", source: over.source ?? EXECUTOR_SOURCE, started_at: iso(over.started), updated_at: iso(over.beat),
      input: { limits: { timeoutMs: over.timeoutMs ?? 10 * 60_000 }, runner: { host: over.host ?? "imac", pid: over.pid ?? 4242 } },
    });
    return m;
  }
  const reap = (m: ReturnType<typeof memoryJobsDb>, alive: boolean, host = "imac") => reapAbandoned({ db: m.db, now: NOW, host, isAlive: () => alive });

  it("process evidence: this process is alive, an unused pid is not, and a pid owned by another user (EPERM) counts as alive", () => {
    expect(processAlive(process.pid)).toBe(true);
    expect(processAlive(2 ** 22 + 12345)).toBe(false);
    expect(processAlive(1)).toBe(true);   // launchd/init: exists but not ours (EPERM)
  });

  it("a live process is never reaped, before or after its deadline", async () => {
    for (const started of [NOW - 60_000, NOW - 10 * 60_000 - DEADLINE_GRACE_MS - 1]) {
      const m = seed({ started, beat: started });
      const out = await reap(m, true);
      expect(out.reaped).toEqual([]);
      expect(m.jobs.get("j1")!.status).toBe("running");
    }
  });

  it("before the deadline: a stale heartbeat on this host with its process gone is reaped, with an auditable event", async () => {
    const m = seed({ started: NOW - 5 * 60_000, beat: NOW - HEARTBEAT_STALE_MS - 1 });
    const out = await reap(m, false);
    expect(out.reaped).toEqual([{ id: "j1", reason: "heartbeat stale and its process is gone" }]);
    expect(m.jobs.get("j1")).toMatchObject({ status: "failed", progress: "reaped" });
    expect(m.events).toContainEqual(expect.objectContaining({ job_id: "j1", kind: "reaped" }));
  });

  it("before the deadline: a fresh heartbeat, or a run on another host, is left alone", async () => {
    expect((await reap(seed({ started: NOW - 5 * 60_000, beat: NOW - 30_000 }), false)).reaped).toEqual([]);
    expect((await reap(seed({ started: NOW - 5 * 60_000, beat: NOW - HEARTBEAT_STALE_MS - 1, host: "macbook" }), false)).reaped).toEqual([]);
  });

  it("after the deadline, a run whose process is gone (or on another host) is reaped", async () => {
    const late = NOW - 10 * 60_000 - DEADLINE_GRACE_MS - 1;
    expect((await reap(seed({ started: late, beat: late }), false)).reaped).toHaveLength(1);
    expect((await reap(seed({ started: late, beat: late, host: "macbook" }), false)).reaped).toHaveLength(1);
  });

  it("is idempotent and race-safe: a second pass changes nothing; a heartbeat between list and update wins", async () => {
    const m = seed({ started: NOW - 5 * 60_000, beat: NOW - HEARTBEAT_STALE_MS - 1 });
    await reap(m, false);
    const again = await reap(m, false);
    expect(again.reaped).toEqual([]);
    expect(m.events.filter((e) => e.kind === "reaped")).toHaveLength(1);
    const r = seed({ started: NOW - 5 * 60_000, beat: NOW - HEARTBEAT_STALE_MS - 1 });
    const list = r.db.listRunning.bind(r.db);
    r.db.listRunning = async (s) => { const out = await list(s); r.jobs.get("j1")!.updated_at = iso(NOW); return out; };   // heartbeat lands mid-pass
    const raced = await reap(r, false);
    expect(raced.reaped).toEqual([]);
    expect(raced.skipped[0].reason).toMatch(/changed while being judged/);
    expect(r.jobs.get("j1")!.status).toBe("running");
  });

  it("only this executor's jobs, only running ones, never on missing facts; a database error stops the pass", async () => {
    expect((await reap(seed({ started: 0, beat: 0, source: "jobs-page" }), false)).reaped).toEqual([]);
    expect((await reap(seed({ started: 0, beat: 0, status: "done" }), false)).reaped).toEqual([]);
    const missing = seed({ started: 0, beat: 0 }); (missing.jobs.get("j1")!.input as Record<string, unknown>).limits = {};
    expect((await reap(missing, false)).skipped[0].reason).toMatch(/missing timing facts/);
    const broken = seed({ started: 0, beat: 0 }); broken.fail.listRunning = "down";
    expect(await reap(broken, false)).toMatchObject({ error: "down", reaped: [] });
    const halfway = seed({ started: 0, beat: 0 }); halfway.fail.updateJobIf = "write failed";
    expect((await reap(halfway, false)).error).toBe("write failed");
    expect(halfway.jobs.get("j1")!.status).toBe("running");
  });
});

describe("supabase JobsDb adapter: exact queries on the existing tables", () => {
  function client(result: { data?: unknown; error?: unknown }) {
    const calls: unknown[][] = [];
    const chain: Record<string, (...a: unknown[]) => unknown> = {};
    for (const m of ["from", "insert", "update", "select", "eq", "gte", "order", "limit", "maybeSingle"]) chain[m] = (...a: unknown[]) => { calls.push([m, ...a]); return chain; };
    (chain as { then?: unknown }).then = (res: (v: unknown) => unknown) => res(result);
    return { db: chain as never, calls };
  }
  it("conditional update filters on status and the observed updated_at; a duplicate insert is a conflict, not an error", async () => {
    const c = client({ data: [{ id: "j1" }], error: null });
    expect(await supabaseJobsDb(c.db).updateJobIf("j1", { status: "running", updated_at: "t0" }, { status: "failed" })).toEqual({ updated: true, error: null });
    expect(c.calls).toEqual([["from", "jobs"], ["update", { status: "failed" }], ["eq", "id", "j1"], ["eq", "status", "running"], ["eq", "updated_at", "t0"], ["select", "id"]]);
    const dup = client({ error: { code: "23505", message: "duplicate key" } });
    expect(await supabaseJobsDb(dup.db).insertJob({ id: "x" })).toEqual({ conflict: true, error: null });
    const zero = client({ data: [], error: null });
    expect((await supabaseJobsDb(zero.db).updateJobIf("j1", { status: "running", updated_at: null }, {})).updated).toBe(false);
  });
  it("a cancel check matches the attempt's execution id (PR #55 Codex P2 on 262c477)", async () => {
    const c = client({ data: [], error: null });
    await supabaseJobsDb(c.db).hasEvent("j1", "cancel_requested", "00000000-0000-4000-8000-0000000000b2");
    expect(c.calls).toEqual([["from", "job_events"], ["select", "id"], ["eq", "job_id", "j1"], ["eq", "kind", "cancel_requested"], ["eq", "detail->>executionId", "00000000-0000-4000-8000-0000000000b2"], ["limit", 1]]);
  });
  it("lists only running executor jobs", async () => {
    const c = client({ data: [], error: null });
    await supabaseJobsDb(c.db).listRunning(EXECUTOR_SOURCE);
    expect(c.calls).toContainEqual(["eq", "status", "running"]);
    expect(c.calls).toContainEqual(["eq", "source", EXECUTOR_SOURCE]);
  });
});

describe("idempotent retries after abandonment or read failure (PR #50 review)", () => {
  it("a reaped execution retried with the same key reports a failed, abandoned result, never 'running'", async () => {
    const m = memoryJobsDb();
    const s = new JobsExecutionStore(m.db);
    await s.begin(req(), "b");
    const id = executionJobId("idem-persist-1");
    Object.assign(m.jobs.get(id)!, { started_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" });
    await reapAbandoned({ db: m.db, now: Date.parse("2026-10-06T00:00:00Z"), host: "other", isAlive: () => false });
    const again = await s.begin(req(), "b");
    expect(again).toMatchObject({ state: "existing", bindingHash: "b", result: { status: "failed", failure: { code: "abandoned" } } });
    expect((again as { result: { summary: string } }).result.summary).toMatch(/Abandoned/);
  });

  it("a still-running row is reported as running (result null); a read failure throws instead of posing as a conflict", async () => {
    const m = memoryJobsDb();
    const s = new JobsExecutionStore(m.db);
    await s.begin(req(), "b");
    expect(await s.begin(req(), "b")).toEqual({ state: "existing", bindingHash: "b", result: null });
    m.fail.getJob = "read timeout";
    await expect(s.begin(req(), "b")).rejects.toThrow(/could not be read: read timeout/);
  });

  it("the adapter surfaces job and event read errors", async () => {
    const mk = (results: { data?: unknown; error?: unknown }[]) => {
      let i = 0; const chain: Record<string, (...a: unknown[]) => unknown> = {};
      for (const m of ["from", "select", "eq", "order", "limit", "maybeSingle"]) chain[m] = () => chain;
      (chain as { then?: unknown }).then = (res: (v: unknown) => unknown) => res(results[i++]);
      return chain as never;
    };
    expect(await supabaseJobsDb(mk([{ data: null, error: { message: "boom" } }])).getJob("j")).toEqual({ row: null, error: "boom" });
    // The row and its events are one request: an events failure is the request's failure.
    expect(await supabaseJobsDb(mk([{ data: null, error: { message: "events down" } }])).getJob("j")).toEqual({ row: null, error: "events down" });
    expect(await supabaseJobsDb(mk([{ data: null, error: null }])).getJob("j")).toEqual({ row: null, error: null });
  });
});

describe("reaper evidence and atomicity (PR #50 Codex)", () => {
  const NOW = Date.parse("2026-10-06T00:00:00Z");
  async function begun() {
    const m = memoryJobsDb(); const s = new JobsExecutionStore(m.db);
    await s.begin(req({ idempotencyKey: "codex-50" }), "b");
    const id = executionJobId("codex-50");
    Object.assign(m.jobs.get(id)!, { started_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" });
    return { m, s, id };
  }

  it("liveness follows the CLI's own pid once recorded: a live host with a dead CLI is reaped; a live CLI is not", async () => {
    const { m, s, id } = await begun();
    await s.recordProcess(req({ idempotencyKey: "codex-50" }), 2 ** 22 + 4242);   // a pid that does not exist
    expect((m.jobs.get(id)!.input as { runner: { cliPid: number; pid: number } }).runner).toMatchObject({ cliPid: 2 ** 22 + 4242, pid: process.pid });
    const out = await reapAbandoned({ db: m.db, now: NOW, host: hostname(), isAlive: processAlive });
    expect(out.reaped).toHaveLength(1);   // the host (this process) is alive, but the run's own process is gone
    const live = await begun();
    await live.s.recordProcess(req({ idempotencyKey: "codex-50" }), process.pid);
    expect((await reapAbandoned({ db: live.m.db, now: NOW, host: hostname(), isAlive: processAlive })).reaped).toEqual([]);
  });

  it("an intent is recorded before any status change: if it cannot be written nothing changes; a lost race is withdrawn", async () => {
    const a = await begun();
    a.m.fail.insertEvent = "down";
    const failed = await reapAbandoned({ db: a.m.db, now: NOW, host: "other", isAlive: () => false });
    expect(failed.error).toMatch(/so nothing changed/);
    expect(a.m.jobs.get(a.id)!.status).toBe("running");
    a.m.fail.insertEvent = undefined;
    const ok = await reapAbandoned({ db: a.m.db, now: NOW, host: "other", isAlive: () => false });
    expect(ok.reaped).toHaveLength(1);
    expect(a.m.events.filter((e) => e.job_id === a.id).map((e) => e.kind)).toEqual(["reap_intent", "reaped"]);
    const b = await begun();
    const upd = b.m.db.updateJobIf.bind(b.m.db);
    b.m.db.updateJobIf = async (id, expect, patch) => { b.m.jobs.get(id)!.updated_at = new Date(NOW).toISOString(); return upd(id, expect, patch); };   // heartbeat wins
    await reapAbandoned({ db: b.m.db, now: NOW, host: "other", isAlive: () => false });
    expect(b.m.jobs.get(b.id)!.status).toBe("running");
    expect(b.m.events.filter((e) => e.job_id === b.id).map((e) => e.kind)).toEqual(["reap_intent", "reap_withdrawn"]);
  });
});

describe("supabase JobsDb getJob: one statement, newest result (PR #57 Codex)", () => {
  it("reads the row and its execution_result events in one request, and returns the newest result", async () => {
    function client(result: { data?: unknown; error?: unknown }) {
      const calls: unknown[][] = [];
      const chain: Record<string, (...a: unknown[]) => unknown> = {};
      for (const m of ["from", "select", "eq", "order", "limit", "maybeSingle"]) chain[m] = (...a: unknown[]) => { calls.push([m, ...a]); return chain; };
      (chain as { then?: unknown }).then = (res: (v: unknown) => unknown) => res(result);
      return { db: chain as never, calls };
    }
    const older = { kind: "execution_result", detail: { executionId: "old" }, created_at: "2026-10-06T10:00:00Z" };
    const newer = { kind: "execution_result", detail: { executionId: "new" }, created_at: "2026-10-06T11:00:00Z" };
    const other = { kind: "cancel_requested", detail: {}, created_at: "2026-10-06T12:00:00Z" };
    const c = client({ data: { input: { executionId: "new" }, status: "done", error: null, source: EXECUTOR_SOURCE, job_events: [older, other, newer] }, error: null });
    const got = await supabaseJobsDb(c.db).getJob("j1");
    expect(got.row?.resultEvent).toEqual({ executionId: "new" });
    expect(c.calls.filter((x) => x[0] === "from")).toEqual([["from", "jobs"]]);   // a single request
    expect(c.calls).toContainEqual(["select", "input, status, error, source, job_events(kind, detail, created_at)"]);
  });
});

describe("requestCancelJob is bound to the attempt the founder saw (PR #57 Codex final)", () => {
  it("refuses when the row's current attempt no longer matches the one named in the request", async () => {
    const m = memoryJobsDb();
    const s = new JobsExecutionStore(m.db);
    const id = "3b1f6c2e-8d4a-4f7b-9c1e-2a5d7e9f0bcc";
    m.jobs.set(id, { id, status: "running", source: EXECUTOR_SOURCE, input: { executionId: "attempt-b", bindingHash: "h".repeat(64) } });
    expect(await s.requestCancelJob(id, "owner", "attempt-a")).toMatchObject({ ok: false, code: "attempt_changed" });
    expect(m.events).toEqual([]);
    expect(await s.requestCancelJob(id, "owner", "attempt-b")).toEqual({ ok: true });
    expect(m.events).toHaveLength(1);
  });
});
