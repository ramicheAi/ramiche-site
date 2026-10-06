/**
 * P06 M6B: recover executions left "running" by a process that died (restart, crash). Conservative by design:
 *
 *  - Only jobs this executor created (source m6-executor) are considered.
 *  - Before the run's hard deadline (started + its own timeout + grace), a job is reaped only when its heartbeat is
 *    stale AND it ran on this host AND its process is gone. A run on another host is never judged by a clock alone.
 *  - After the deadline, a job whose process is still alive on this host is NOT reaped (it is reported instead): the
 *    executor kills runs at their timeout, so a live process past it is a bug to look at, not a failure to invent.
 *  - The update is conditional on the row still being running with the same updated_at, so a concurrent heartbeat
 *    or a second reaper wins; reaping twice is impossible. Each reap leaves a job_events "reaped" record.
 *  - Any database error stops the pass and is reported; nothing is changed on a partial read.
 */
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
    const up = await o.db.updateJobIf(j.id, { status: "running", updated_at: j.updated_at }, {
      status: "failed", error: `Abandoned: ${verdict.reason}`, progress: "reaped", finished_at: at, updated_at: at,
    });
    if (up.error) return { ...out, error: up.error };
    if (!up.updated) { out.skipped.push({ id: j.id, reason: "changed while being judged (heartbeat or another reaper)" }); continue; }
    const ev = await o.db.insertEvent({ job_id: j.id, kind: "reaped", detail: { reason: verdict.reason, observedUpdatedAt: j.updated_at, at, host: o.host } });
    if (ev.error) return { ...out, error: `reaped ${j.id} but could not record it: ${ev.error}` };
    out.reaped.push({ id: j.id, reason: verdict.reason });
  }
  return out;
}

function judge(j: RunningJob, o: { now: number; host: string; isAlive: (pid: number) => boolean }): { reap: boolean; reason: string } {
  const input = (j.input ?? {}) as { limits?: { timeoutMs?: unknown }; runner?: { host?: unknown; pid?: unknown } };
  const started = Date.parse(j.started_at ?? "");
  const beat = Date.parse(j.updated_at ?? "");
  const timeout = typeof input.limits?.timeoutMs === "number" ? input.limits.timeoutMs : null;
  if (Number.isNaN(started) || Number.isNaN(beat) || timeout === null) return { reap: false, reason: "missing timing facts; left for a person" };
  const local = input.runner?.host === o.host;
  const pid = typeof input.runner?.pid === "number" ? input.runner.pid : null;
  const alive = local && pid !== null ? o.isAlive(pid) : null;
  const deadline = started + timeout + DEADLINE_GRACE_MS;
  if (alive === true) return { reap: false, reason: o.now >= deadline ? "past its deadline but its process is alive; investigate" : "process alive" };
  if (o.now >= deadline) return { reap: true, reason: `no result ${Math.round((o.now - started) / 60_000)} min after start (deadline passed${local ? ", process gone" : ""})` };
  if (o.now - beat >= HEARTBEAT_STALE_MS && local && alive === false) return { reap: true, reason: "heartbeat stale and its process is gone" };
  return { reap: false, reason: local ? "heartbeat fresh or process unknown" : "runs on another host; waiting for its deadline" };
}
