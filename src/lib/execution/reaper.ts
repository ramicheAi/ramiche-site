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
/** Whether any process is still in this process group (the CLI leads its own group, so pgid = its pid). A pid is never
 *  reused while a process group with that id exists, so a live group here is still the group the CLI started. */
export function processGroupAlive(pgid: number): boolean {
  try { process.kill(-pgid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }
}
export const DEADLINE_GRACE_MS = 10 * 60_000;

export interface ReapOutcome { reaped: { id: string; reason: string }[]; skipped: { id: string; reason: string }[]; error: string | null }

export async function reapAbandoned(o: { db: JobsDb; now: number; host: string; isAlive: (pid: number) => boolean; isGroupAlive?: (pgid: number) => boolean }): Promise<ReapOutcome> {
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

function judge(j: RunningJob, o: { now: number; host: string; isAlive: (pid: number) => boolean; isGroupAlive?: (pgid: number) => boolean }): { reap: boolean; reason: string } {
  const input = (j.input ?? {}) as { limits?: { timeoutMs?: unknown }; runner?: { host?: unknown; pid?: unknown; cliPid?: unknown } };
  const started = Date.parse(j.started_at ?? "");
  const beat = Date.parse(j.updated_at ?? "");
  const timeout = typeof input.limits?.timeoutMs === "number" ? input.limits.timeoutMs : null;
  if (Number.isNaN(started) || Number.isNaN(beat) || timeout === null) return { reap: false, reason: "missing timing facts; left for a person" };
  const local = input.runner?.host === o.host;
  const cli = typeof input.runner?.cliPid === "number" ? input.runner.cliPid : null;
  const pid = cli ?? (typeof input.runner?.pid === "number" ? input.runner.pid : null);
  // Once a CLI exists, the run is alive while ANY member of its process group is: a helper that outlived the CLI is
  // still this run's work, and its row must not turn terminal while it runs.
  const alive = local && pid !== null ? o.isAlive(pid) || (cli !== null && (o.isGroupAlive ?? processGroupAlive)(cli)) : null;
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

export interface OrphanOutcome {
  stopped: { id: string; cliPid: number; escalated: boolean }[];
  skipped: { id: string; reason: string }[];
  /** Groups that could not be confirmed stopped, or cannot be safely judged: actionable, never silently reaped. */
  unstopped: { id: string; reason: string }[];
  error: string | null;
}

/** The normal runner's grace before SIGKILL (claude-code.ts KILL_GRACE_MS). */
export const ORPHAN_KILL_GRACE_MS = 5_000;
const KILL_CONFIRM_MS = 2_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function groupGoneWithin(alive: (pgid: number) => boolean, pgid: number, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  for (;;) { if (!alive(pgid)) return true; if (Date.now() >= until) return false; await sleep(50); }
}

/**
 * A Claude Code run whose executor died (a cockpit restart or rollback) keeps running in its own process group with
 * nobody watching its limits. On this host only, stop such a run's WHOLE group, mirroring the runner's containment:
 * SIGTERM, a bounded wait, then SIGKILL if any member survives, then confirm the group is empty.
 *
 * Identity, so a reused pid can never be hit: the executor's process is gone; the CLI pid is alive, leads its own
 * process group, runs the configured CLI binary, and its working directory is exactly this execution's worktree. If the
 * CLI already exited but members of its group survive, the group is never signaled (its identity cannot be proven
 * across passes, since a pid is reusable once its group empties): it is reported, and never reaped (the reaper treats a
 * live group as alive).
 * Every step is a durable event first: orphan_stop, orphan_kill (escalation), orphan_stopped or orphan_stop_failed.
 */
export async function stopOrphans(o: {
  db: JobsDb; host: string; isAlive: (pid: number) => boolean; inspect: (pid: number) => ProcessFacts | null;
  kill: (pid: number, sig: NodeJS.Signals) => void; claudeBin: string; execRoot: string; now: number;
  isGroupAlive?: (pgid: number) => boolean; graceMs?: number;
}): Promise<OrphanOutcome> {
  const out: OrphanOutcome = { stopped: [], skipped: [], unstopped: [], error: null };
  const groupAlive = o.isGroupAlive ?? processGroupAlive;
  const grace = o.graceMs ?? ORPHAN_KILL_GRACE_MS;
  const list = await o.db.listRunning(EXECUTOR_SOURCE);
  if (list.error) return { ...out, error: list.error };
  const record = async (jobId: string, kind: string, detail: Record<string, unknown>) => {
    const ev = await o.db.insertEvent({ job_id: jobId, kind, detail: { ...detail, host: o.host, at: new Date().toISOString() } });
    return ev.error;
  };
  for (const j of list.rows) {
    const input = (j.input ?? {}) as { executionId?: unknown; project?: unknown; runner?: { host?: unknown; pid?: unknown; cliPid?: unknown } };
    const cli = typeof input.runner?.cliPid === "number" ? input.runner.cliPid : null;
    const host = typeof input.runner?.pid === "number" ? input.runner.pid : null;
    if (input.runner?.host !== o.host || cli === null || host === null) { out.skipped.push({ id: j.id, reason: "not a local run with process evidence" }); continue; }
    if (o.isAlive(host)) { out.skipped.push({ id: j.id, reason: "its executor is alive" }); continue; }
    const leader = o.isAlive(cli);
    if (!leader && !groupAlive(cli)) { out.skipped.push({ id: j.id, reason: "nothing left running" }); continue; }
    if (leader) {
      const facts = o.inspect(cli);
      // The path comes from database values: only a plain slug and a UUID may form it (no "..", no "/").
      const valid = typeof input.project === "string" && /^[a-z0-9-]{1,64}$/.test(input.project)
        && typeof input.executionId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.executionId);
      const worktree = valid ? join(/*turbopackIgnore: true*/ o.execRoot, input.project as string, input.executionId as string) : null;
      const same = !!facts && facts.pgid === cli && facts.args.startsWith(o.claudeBin) && !!worktree && facts.cwd === worktree;
      if (!same) { out.skipped.push({ id: j.id, reason: "the live pid is not provably this run's CLI; left for a person" }); continue; }
    } else {
      // The CLI is gone but its group lives on. A pid can be reused once its group has emptied, and nothing proves this
      // group never emptied since an earlier pass, so a leaderless group is never signaled here: it is reported for a
      // person, and the reaper keeps its row running (a live group counts as alive). Escalation happens only inside the
      // same pass that proved the CLI's identity, while the group is watched continuously.
      out.unstopped.push({ id: j.id, reason: "its process group survives without the CLI; it cannot be proven to be this run's, so it was not signaled; left for a person" });
      continue;
    }
    const e1 = await record(j.id, "orphan_stop", { cliPid: cli, executorPid: host, signal: "SIGTERM" });
    if (e1) return { ...out, error: `could not record the orphan stop for ${j.id}, so nothing was stopped: ${e1}` };
    try { o.kill(-cli, "SIGTERM"); } catch { /* already gone */ }
    let escalated = false;
    if (!(await groupGoneWithin(groupAlive, cli, grace))) {
      const e2 = await record(j.id, "orphan_kill", { cliPid: cli, signal: "SIGKILL", why: `group still alive ${grace} ms after SIGTERM` });
      if (e2) return { ...out, error: `could not record the SIGKILL escalation for ${j.id}, so it was not sent: ${e2}` };
      try { o.kill(-cli, "SIGKILL"); } catch { /* already gone */ }
      escalated = true;
    }
    if (escalated && !(await groupGoneWithin(groupAlive, cli, KILL_CONFIRM_MS))) {
      await record(j.id, "orphan_stop_failed", { cliPid: cli });
      out.unstopped.push({ id: j.id, reason: "its process group could not be stopped (still alive after SIGKILL)" });
      continue;
    }
    const e3 = await record(j.id, "orphan_stopped", { cliPid: cli, escalated });
    out.stopped.push({ id: j.id, cliPid: cli, escalated });
    if (e3) return { ...out, error: `stopped ${j.id} but the confirmation could not be written: ${e3}` };
  }
  return out;
}

export interface ReaperStatus { at: string; host: string; ok: boolean; stopped: number; reaped: number; stuck: number; unstopped: number; skipped: { id: string; reason: string }[]; error: string | null }

/** One scheduled pass: stop orphans, then reap. `stuck` counts rows still running past their deadline afterwards; any
 *  group that could not be stopped or judged makes the pass not ok, and its row is never reaped (its group is alive). */
export async function reaperPass(o: Parameters<typeof stopOrphans>[0]): Promise<ReaperStatus> {
  const orphans = await stopOrphans(o);
  const reap = orphans.error ? null : await reapAbandoned({ db: o.db, now: o.now, host: o.host, isAlive: o.isAlive, isGroupAlive: o.isGroupAlive });
  const skipped = [...orphans.skipped, ...orphans.unstopped, ...(reap?.skipped ?? [])];
  const stuck = (reap?.skipped ?? []).filter((s) => s.reason.startsWith("past its deadline")).length;
  const error = orphans.error ?? reap?.error ?? (orphans.unstopped.length ? `${orphans.unstopped.length} orphaned process group(s) could not be stopped or safely judged` : null);
  return { at: new Date(o.now).toISOString(), host: o.host, ok: !error && stuck === 0, stopped: orphans.stopped.length, reaped: reap?.reaped.length ?? 0, stuck, unstopped: orphans.unstopped.length, skipped, error };
}
