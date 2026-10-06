/**
 * P06 M6B: JobsDb on the existing Supabase jobs / job_events tables (no new table, no migration). Server-only: it
 * needs the service-role client. Every method returns errors as values; the store and reaper decide what fails closed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionResult } from "./contract";
import type { JobsDb, RunningJob } from "./store";

const msg = (e: { message?: string } | null | undefined) => (e ? e.message ?? "database error" : null);

export function supabaseJobsDb(db: SupabaseClient): JobsDb {
  return {
    async insertJob(row) {
      const { error } = await db.from("jobs").insert(row);
      if (error && (error as { code?: string }).code === "23505") return { conflict: true, error: null };
      return { conflict: false, error: msg(error) };
    },
    async getJob(id) {
      const job = await db.from("jobs").select("input").eq("id", id).maybeSingle();
      if (job.error || !job.data) return null;
      const ev = await db.from("job_events").select("detail").eq("job_id", id).eq("kind", "execution_result").order("created_at", { ascending: false }).limit(1);
      return { input: (job.data.input as Record<string, unknown>) ?? null, resultEvent: ((ev.data?.[0]?.detail as ExecutionResult | undefined) ?? null) };
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
    async hasEvent(jobId, kind) {
      const { data, error } = await db.from("job_events").select("id").eq("job_id", jobId).eq("kind", kind).limit(1);
      return { found: !error && Array.isArray(data) && data.length > 0, error: msg(error) };
    },
    async listRunning(source) {
      const { data, error } = await db.from("jobs").select("id, input, started_at, updated_at").eq("status", "running").eq("source", source).limit(500);
      return { rows: (data as RunningJob[] | null) ?? [], error: msg(error) };
    },
  };
}
