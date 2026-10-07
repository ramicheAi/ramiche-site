import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { jsonObject } from "@/lib/missions/http";
import { JobsExecutionStore } from "@/lib/execution/store";
import { supabaseJobsDb } from "@/lib/execution/supabase-jobs-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * POST /api/command-center/execution/cancel { jobId, executionId? }  (founder only)
 * Asks a running execution to stop. Deliberately NOT behind the dispatch switch: stopping work must keep working when
 * dispatch is turned off (rollback). It only records the founder's request; it never starts anything.
 */
export async function POST(req: Request) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  const jobId = typeof body.jobId === "string" ? body.jobId.toLowerCase() : "";
  if (!UUID.test(jobId)) return noStoreJson({ data: null, error: { code: "invalid", message: "jobId is invalid" } }, 400);
  if (body.executionId !== undefined && typeof body.executionId !== "string") return noStoreJson({ data: null, error: { code: "invalid", message: "executionId is invalid" } }, 400);
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ data: null, error: { code: "not_configured", message: "Execution records are unavailable." } }, 503);
  const out = await new JobsExecutionStore(supabaseJobsDb(svc)).requestCancelJob(jobId, guard.uid, body.executionId as string | undefined);
  if (out.ok) return noStoreJson({ data: { cancelRequested: true }, error: null }, 202);
  return noStoreJson({ data: null, error: { code: out.code, message: out.message } }, out.code === "not_found" ? 404 : out.code === "not_running" || out.code === "attempt_changed" ? 409 : 503);
}
