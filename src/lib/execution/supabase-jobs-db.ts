/**
 * P06 M6B: JobsDb on the existing Supabase jobs / job_events tables (no new table, no migration). Server-only: it
 * needs the service-role client. Every method returns errors as values; the store and reaper decide what fails closed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionResult } from "./contract";
import { EXECUTOR_SOURCE, type JobsDb, type RunningJob } from "./store";

const msg = (e: { message?: string } | null | undefined) => (e ? e.message ?? "database error" : null);

export function supabaseJobsDb(db: SupabaseClient): JobsDb {
  return {
    async insertJob(row) {
      const { error } = await db.from("jobs").insert(row);
      if (error && (error as { code?: string }).code === "23505") return { conflict: true, error: null };
      return { conflict: false, error: msg(error) };
    },
    async getJob(id) {
      // One request, one statement: the row and its execution_result events come from the same snapshot, so a retry
      // cannot land between a status read and a result read (PR #57 Codex).
      const job = await db.from("jobs").select("input, status, error, source, job_events(kind, detail, created_at)").eq("id", id).maybeSingle();
      if (job.error) return { row: null, error: msg(job.error) };
      if (!job.data) return { row: null, error: null };
      const events = ((job.data as unknown as { job_events?: { kind: string; detail: unknown; created_at: string }[] }).job_events ?? [])
        .filter((e) => e.kind === "execution_result")
        .sort((x, y) => (x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : 0));
      return {
        row: { input: (job.data.input as Record<string, unknown>) ?? null, status: String(job.data.status), error: (job.data.error as string | null) ?? null, source: (job.data.source as string | null) ?? null, resultEvent: ((events[0]?.detail as ExecutionResult | undefined) ?? null) },
        error: null,
      };
    },
    async updateJob(id, patch) {
      const { error } = await db.from("jobs").update(patch).eq("id", id);
      return { error: msg(error) };
    },
    async insertEvent(row) {
      const { error } = await db.from("job_events").insert(row);
      return { error: msg(error) };
    },
    async updateJobIf(id, expect, patch) {
      let q = db.from("jobs").update(patch).eq("id", id).eq("status", expect.status);
      if (expect.updated_at !== null) q = q.eq("updated_at", expect.updated_at);
      const { data, error } = await q.select("id");
      return { updated: !error && Array.isArray(data) && data.length === 1, error: msg(error) };
    },
    async hasEvent(jobId, kind, executionId) {
      let q = db.from("job_events").select("id").eq("job_id", jobId).eq("kind", kind);
      if (executionId) q = q.eq("detail->>executionId", executionId);
      const { data, error } = await q.limit(1);
      return { found: !error && Array.isArray(data) && data.length > 0, error: msg(error) };
    },
    async findRunningByCommand(commandId) {
      const { data, error } = await db.from("jobs").select("id").eq("source", EXECUTOR_SOURCE).eq("status", "running").eq("input->>commandId", commandId).order("started_at", { ascending: false }).limit(1);
      if (error) return { jobId: null, error: msg(error) };
      return { jobId: (data as { id: string }[] | null)?.[0]?.id ?? null, error: null };
    },
    async listRunning(source) {
      const { data, error } = await db.from("jobs").select("id, input, started_at, updated_at").eq("status", "running").eq("source", source).order("started_at", { ascending: true }).limit(500);
      return { rows: (data as RunningJob[] | null) ?? [], error: msg(error) };
    },
  };
}
