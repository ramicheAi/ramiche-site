/** P06 M6B test double: an in-memory JobsDb with the same semantics as supabase-jobs-db.ts (conditional updates included). */
import type { ExecutionResult } from "../contract";
import type { JobsDb, RunningJob } from "../store";

export function memoryJobsDb() {
  const jobs = new Map<string, Record<string, unknown>>();
  const events: Record<string, unknown>[] = [];
  const fail: Partial<Record<keyof JobsDb, string>> = {};
  const db: JobsDb = {
    async insertJob(row) { if (fail.insertJob) return { conflict: false, error: fail.insertJob }; if (jobs.has(String(row.id))) return { conflict: true, error: null }; jobs.set(String(row.id), { ...row }); return { conflict: false, error: null }; },
    async getJob(id) {
      if (fail.getJob) return { row: null, error: fail.getJob };
      const j = jobs.get(id);
      if (!j) return { row: null, error: null };
      return { row: { input: j.input as Record<string, unknown>, status: String(j.status), error: (j.error as string) ?? null, resultEvent: ([...events].reverse().find((e) => e.job_id === id && e.kind === "execution_result")?.detail as ExecutionResult) ?? null }, error: null };
    },
    async updateJob(id, patch) { if (fail.updateJob) return { error: fail.updateJob }; Object.assign(jobs.get(id)!, patch); return { error: null }; },
    async insertEvent(row) { if (fail.insertEvent) return { error: fail.insertEvent }; events.push({ ...row }); return { error: null }; },
    async updateJobIf(id, expect, patch) {
      if (fail.updateJobIf) return { updated: false, error: fail.updateJobIf };
      const j = jobs.get(id);
      if (!j || j.status !== expect.status || (expect.updated_at !== null && j.updated_at !== expect.updated_at)) return { updated: false, error: null };
      Object.assign(j, patch);
      return { updated: true, error: null };
    },
    async hasEvent(jobId, kind) { if (fail.hasEvent) return { found: false, error: fail.hasEvent }; return { found: events.some((e) => e.job_id === jobId && e.kind === kind), error: null }; },
    async listRunning(source) {
      if (fail.listRunning) return { rows: [], error: fail.listRunning };
      return { rows: [...jobs.values()].filter((j) => j.status === "running" && j.source === source).map((j) => ({ id: String(j.id), input: j.input as Record<string, unknown>, started_at: (j.started_at as string) ?? null, updated_at: (j.updated_at as string) ?? null }) as RunningJob), error: null };
    },
  };
  return { db, jobs, events, fail };
}
