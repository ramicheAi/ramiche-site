/**
 * P06 M6H: what the founder's screen shows for one execution attempt, read from its durable job (never from a request
 * that may have gone away). Pure: the route supplies the job row.
 */
import type { ExecutionResult } from "./contract-core";

export type ExecutionView =
  | { state: "running"; executionId: string | null }
  | { state: "done" | "canceled" | "failed"; executionId: string | null; result: ExecutionResult | null; message: string | null };

export function executionView(row: { status: string; error: string | null; input: Record<string, unknown> | null; resultEvent: ExecutionResult | null }): ExecutionView {
  const executionId = typeof row.input?.executionId === "string" ? row.input.executionId : null;
  // The row describes the CURRENT attempt: a retry reopens it as running, so a finished result from an earlier attempt
  // is never shown while this one runs.
  if (row.status === "running" || row.status === "queued") return { state: "running", executionId };
  const r = row.resultEvent;
  if (r && (r.executionId === executionId || executionId === null)) {
    if (r.status === "succeeded") return { state: "done", executionId, result: r, message: null };
    if (r.status === "canceled") return { state: "canceled", executionId, result: r, message: null };
    return { state: "failed", executionId, result: r, message: r.failure?.message ?? r.summary };
  }
  // Ended without a result event (its process was reaped): say so, with the recorded reason.
  return { state: "failed", executionId, result: null, message: row.error ?? "This execution stopped without a recorded result." };
}
