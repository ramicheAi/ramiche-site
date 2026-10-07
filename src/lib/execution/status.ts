/**
 * P06 M6H: what the founder's screen shows for one execution attempt, read from its durable job (never from a request
 * that may have gone away). Pure: the route supplies the job row.
 */
import type { ExecutionResult } from "./contract-core";
import type { JobsDb } from "./store";

type Row = { status: string; error: string | null; input: Record<string, unknown> | null; resultEvent: ExecutionResult | null };

/**
 * One consistent view of a job. The row and its latest result event are read in separate queries, so a retry can land
 * between them; the snapshot is accepted only when two reads agree on the attempt and status. If they never settle,
 * it is reported as still running (the client keeps following), never as a stale finished attempt.
 */
export async function statusSnapshot(db: Pick<JobsDb, "getJob">, jobId: string): Promise<{ row: Row | null; error: string | null }> {
  const attemptOf = (r: Row) => (typeof r.input?.executionId === "string" ? r.input.executionId : null);
  for (let i = 0; i < 3; i++) {
    const a = await db.getJob(jobId);
    if (a.error) return { row: null, error: a.error };
    if (!a.row) return { row: null, error: null };
    const b = await db.getJob(jobId);
    if (b.error) return { row: null, error: b.error };
    if (b.row && b.row.status === a.row.status && attemptOf(b.row) === attemptOf(a.row)) return { row: b.row, error: null };
  }
  return { row: { status: "running", error: null, input: null, resultEvent: null }, error: null };
}

export type ExecutionView =
  | { state: "running"; executionId: string | null }
  | { state: "done" | "canceled" | "failed"; executionId: string | null; result: ExecutionResult | null; message: string | null };

export function executionView(row: { status: string; error: string | null; input: Record<string, unknown> | null; resultEvent: ExecutionResult | null }): ExecutionView {
  const executionId = typeof row.input?.executionId === "string" ? row.input.executionId : null;
  // The row describes the CURRENT attempt: a retry reopens it as running, so a finished result from an earlier attempt
  // is never shown while this one runs.
  if (row.status === "running" || row.status === "queued") return { state: "running", executionId };
  const r = row.resultEvent;
  // A result event counts only for the attempt the row describes (a torn read can pair a row with another attempt's event).
  if (r && (r.executionId === executionId || executionId === null)) {
    if (r.status === "succeeded") return { state: "done", executionId, result: r, message: null };
    if (r.status === "canceled") return { state: "canceled", executionId, result: r, message: null };
    return { state: "failed", executionId, result: r, message: r.failure?.message ?? r.summary };
  }
  // Ended without a result event (its process was reaped): say so, with the recorded reason.
  return { state: "failed", executionId, result: null, message: row.error ?? "This execution stopped without a recorded result." };
}
