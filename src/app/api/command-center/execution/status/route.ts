import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";
import { executionView } from "@/lib/execution/status";
import { EXECUTOR_SOURCE } from "@/lib/execution/store";
import { supabaseJobsDb } from "@/lib/execution/supabase-jobs-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** GET /api/command-center/execution/status?jobId=  (founder only, read-only): the current attempt's state and result. */
export async function GET(req: Request) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;
  const jobId = (new URL(req.url).searchParams.get("jobId") ?? "").toLowerCase();
  if (!UUID.test(jobId)) return noStoreJson({ data: null, error: { code: "invalid", message: "jobId is invalid" } }, 400);
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ data: null, error: { code: "not_configured", message: "Execution records are unavailable." } }, 503);
  const cur = await supabaseJobsDb(svc).getJob(jobId);
  if (cur.error) return noStoreJson({ data: null, error: { code: "store_error", message: `The execution record could not be read: ${cur.error}` } }, 503);
  if (!cur.row || cur.row.source !== EXECUTOR_SOURCE) return noStoreJson({ data: null, error: { code: "not_found", message: "No such execution." } }, 404);
  return noStoreJson({ data: executionView(cur.row), error: null }, 200);
}
