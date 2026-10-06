/**
 * P06 M6B: recover executions left "running" by a process that died (restart, crash). Conservative by design:
 *
 *  - Only jobs this executor created (source m6-executor) are considered.
 *  - Before the run's hard deadline (started + its own timeout + grace), a job is reaped only when its heartbeat is
 *    stale AND it ran on this host AND its process is gone. A run on another host is never judged by a clock alone.
 *  - After the deadline, a job whose process is still alive on this host is NOT reaped (it is reported instead): the
 *    executor kills runs at their timeout, so a live process past it is a bug to look at, not a failure to invent.
 *  - Liveness is judged by the run's own process (the CLI pid, recorded when it spawns), falling back to the executor
 *    host's pid only before the CLI exists. A host that survives a failed finish no longer keeps a dead run "alive",
 *    and a CLI orphaned by a host restart is still seen as alive.
 *  - A durable "reap_intent" event is written BEFORE any status change (if it cannot be written, nothing changes).
 *    The update is then conditional on the row still being running with the same updated_at, so a concurrent
 *    heartbeat or a second reaper wins; a lost race is recorded as "reap_withdrawn", an applied one as "reaped".
 *  - Any database error stops the pass and is reported; nothing is changed on a partial read.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { EXECUTOR_SOURCE, type JobsDb, type RunningJob } from "./store";

export const HEARTBEAT_STALE_MS = 3 * 60_000;

/** Process evidence for this host. EPERM means the pid exists (owned by someone else): alive, never reaped. */
export function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }
}
export const DEADLINE_GRACE_MS = 10 * 60_000;

export interface ReapOutcome { reaped: { id: string; reason: string }[]; skipped: { id: string; reason: string }[]; error: string | null }

export async function reapAbandoned(o: { db: JobsDb; now: number; host: string; isAlive: (pid: number) => boolean }): Promise<ReapOutcome> {
  const out: ReapOutcome = { reaped: [], skipped: [], error: null };
  const list = await o.db.listRunning(EXECUTOR_SOURCE);
  if (list.error) return { ...out, error: list.error };
  for (const j of list.rows) {
    const verdict = judge(j, o);
    if (!verdict.reap) { out.skipped.push({ id: j.id, reason: verdict.reason }); continue; }
    const at = new Date(o.now).toISOString();
    const detail = { reason: verdict.reason, observedUpdatedAt: j.updated_at, at, host: o.host };
    const intent = await o.db.insertEvent({ job_id: j.id, kind: "reap_intent", detail });
    if (intent.error) return { ...out, error: `could not record the reap intent for ${j.id}, so nothing changed: ${intent.error}` };
    const up = await o.db.updateJobIf(j.id, { status: "running", updated_at: j.updated_at }, {
      status: "failed", error: `Abandoned: ${verdict.reason}`, progress: "reaped", finished_at: at, updated_at: at,
    });
    if (up.error) return { ...out, error: up.error };
    if (!up.updated) {
      await o.db.insertEvent({ job_id: j.id, kind: "reap_withdrawn", detail: { ...detail, why: "changed while being judged" } });
      out.skipped.push({ id: j.id, reason: "changed while being judged (heartbeat or another reaper)" });
      continue;
    }
    // The intent already records this reap durably; the confirmation is best effort.
    const ev = await o.db.insertEvent({ job_id: j.id, kind: "reaped", detail });
    out.reaped.push({ id: j.id, reason: verdict.reason });
    if (ev.error) return { ...out, error: `reaped ${j.id} (intent recorded) but the confirmation could not be written: ${ev.error}` };
  }
  return out;
}

function judge(j: RunningJob, o: { now: number; host: string; isAlive: (pid: number) => boolean }): { reap: boolean; reason: string } {
  const input = (j.input ?? {}) as { limits?: { timeoutMs?: unknown }; runner?: { host?: unknown; pid?: unknown; cliPid?: unknown } };
  const started = Date.parse(j.started_at ?? "");
  const beat = Date.parse(j.updated_at ?? "");
  const timeout = typeof input.limits?.timeoutMs === "number" ? input.limits.timeoutMs : null;
  if (Number.isNaN(started) || Number.isNaN(beat) || timeout === null) return { reap: false, reason: "missing timing facts; left for a person" };
  const local = input.runner?.host === o.host;
  const pid = typeof input.runner?.cliPid === "number" ? input.runner.cliPid : typeof input.runner?.pid === "number" ? input.runner.pid : null;
  const alive = local && pid !== null ? o.isAlive(pid) : null;
  const deadline = started + timeout + DEADLINE_GRACE_MS;
  if (alive === true) return { reap: false, reason: o.now >= deadline ? "past its deadline but its process is alive; investigate" : "process alive" };
  if (o.now >= deadline) return { reap: true, reason: `no result ${Math.round((o.now - started) / 60_000)} min after start (deadline passed${local ? ", process gone" : ""})` };
  if (o.now - beat >= HEARTBEAT_STALE_MS && local && alive === false) return { reap: true, reason: "heartbeat stale and its process is gone" };
  return { reap: false, reason: local ? "heartbeat fresh or process unknown" : "runs on another host; waiting for its deadline" };
}

/** What the operating system says about a pid (null when it does not exist). */
export interface ProcessFacts { pgid: number; args: string; cwd: string | null }

/** ps for the group and command line, lsof for the working directory. Read-only. */
export function inspectProcess(pid: number): ProcessFacts | null {
  try {
    const line = execFileSync("ps", ["-o", "pgid=,args=", "-p", String(pid)], { encoding: "utf8" }).trim();
    const m = line.match(/^(\d+)\s+(.*)$/);
    if (!m) return null;
    let cwd: string | null = null;
    try { cwd = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8" }).split("\n").find((l) => l.startsWith("n"))?.slice(1) ?? null; } catch { /* unknown */ }
    return { pgid: Number(m[1]), args: m[2], cwd };
  } catch { return null; }
}

export interface OrphanOutcome { stopped: { id: string; cliPid: number }[]; skipped: { id: string; reason: string }[]; error: string | null }

/**
 * A Claude Code run whose executor died (a cockpit restart or rollback) keeps running in its own process group with
 * nobody watching its limits. On this host only, stop such a run when ALL of these hold, so a reused pid can never be
 * hit: the executor's process is gone; the CLI pid is alive, leads its own process group, runs the configured CLI
 * binary, and its working directory is exactly this execution's worktree. A durable "orphan_stop" event is written
 * first; the reaper then fails the row on a later pass once the heartbeat is stale.
 */
export async function stopOrphans(o: {
  db: JobsDb; host: string; isAlive: (pid: number) => boolean; inspect: (pid: number) => ProcessFacts | null;
  kill: (pid: number, sig: NodeJS.Signals) => void; claudeBin: string; execRoot: string; now: number;
}): Promise<OrphanOutcome> {
  const out: OrphanOutcome = { stopped: [], skipped: [], error: null };
  const list = await o.db.listRunning(EXECUTOR_SOURCE);
  if (list.error) return { ...out, error: list.error };
  for (const j of list.rows) {
    const input = (j.input ?? {}) as { executionId?: unknown; project?: unknown; runner?: { host?: unknown; pid?: unknown; cliPid?: unknown } };
    const cli = typeof input.runner?.cliPid === "number" ? input.runner.cliPid : null;
    const host = typeof input.runner?.pid === "number" ? input.runner.pid : null;
    if (input.runner?.host !== o.host || cli === null || host === null) { out.skipped.push({ id: j.id, reason: "not a local run with process evidence" }); continue; }
    if (o.isAlive(host)) { out.skipped.push({ id: j.id, reason: "its executor is alive" }); continue; }
    if (!o.isAlive(cli)) { out.skipped.push({ id: j.id, reason: "nothing left running" }); continue; }
    const facts = o.inspect(cli);
    const worktree = typeof input.project === "string" && typeof input.executionId === "string" ? join(/*turbopackIgnore: true*/ o.execRoot, input.project, input.executionId) : null;
    const same = !!facts && facts.pgid === cli && facts.args.startsWith(o.claudeBin) && !!worktree && facts.cwd === worktree;
    if (!same) { out.skipped.push({ id: j.id, reason: "the live pid is not provably this run's CLI; left for a person" }); continue; }
    const ev = await o.db.insertEvent({ job_id: j.id, kind: "orphan_stop", detail: { cliPid: cli, executorPid: host, host: o.host, at: new Date(o.now).toISOString() } });
    if (ev.error) return { ...out, error: `could not record the orphan stop for ${j.id}, so nothing was stopped: ${ev.error}` };
    try { o.kill(-cli, "SIGTERM"); } catch { /* already gone */ }
    out.stopped.push({ id: j.id, cliPid: cli });
  }
  return out;
}

export interface ReaperStatus { at: string; host: string; ok: boolean; stopped: number; reaped: number; stuck: number; skipped: { id: string; reason: string }[]; error: string | null }

/** One scheduled pass: stop orphans, then reap. `stuck` counts rows still running past their deadline afterwards. */
export async function reaperPass(o: Parameters<typeof stopOrphans>[0]): Promise<ReaperStatus> {
  const orphans = await stopOrphans(o);
  const reap = orphans.error ? null : await reapAbandoned({ db: o.db, now: o.now, host: o.host, isAlive: o.isAlive });
  const skipped = [...orphans.skipped, ...(reap?.skipped ?? [])];
  const stuck = (reap?.skipped ?? []).filter((s) => s.reason.startsWith("past its deadline")).length;
  const error = orphans.error ?? reap?.error ?? null;
  return { at: new Date(o.now).toISOString(), host: o.host, ok: !error && stuck === 0, stopped: orphans.stopped.length, reaped: reap?.reaped.length ?? 0, stuck, skipped, error };
}
