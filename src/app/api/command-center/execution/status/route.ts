import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";
import { commandStatus, executionView, statusSnapshot } from "@/lib/execution/status";
import { supabaseJobsDb } from "@/lib/execution/supabase-jobs-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * GET /api/command-center/execution/status?jobId=  or  ?commandId=  (founder only, read-only).
 * jobId: the current attempt's state and result, as one consistent snapshot. commandId: the running job for that command,
 * from any browser tab (the palette resumes it); none running answers jobId null.
 */
export async function GET(req: Request) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;
  const q = new URL(req.url).searchParams;
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ data: null, error: { code: "not_configured", message: "Execution records are unavailable." } }, 503);
  const db = supabaseJobsDb(svc);
  const commandId = q.get("commandId");
  if (commandId !== null) {
    if (!UUID.test(commandId.toLowerCase())) return noStoreJson({ data: null, error: { code: "invalid", message: "commandId is invalid" } }, 400);
    const cur = await commandStatus(db, commandId.toLowerCase());
    if ("error" in cur) return noStoreJson({ data: null, error: { code: "store_error", message: `The execution record could not be read: ${cur.error}` } }, 503);
    if (!cur.jobId) return noStoreJson({ data: { jobId: null, state: "none" }, error: null }, 200);
    return noStoreJson({ data: { jobId: cur.jobId, ...cur.view }, error: null }, 200);
  }
  const jobId = (q.get("jobId") ?? "").toLowerCase();
  if (!UUID.test(jobId)) return noStoreJson({ data: null, error: { code: "invalid", message: "jobId is invalid" } }, 400);
  const snap = await statusSnapshot(db, jobId);
  if (snap.error) return noStoreJson({ data: null, error: { code: "store_error", message: `The execution record could not be read: ${snap.error}` } }, 503);
  if (!snap.row) return noStoreJson({ data: null, error: { code: "not_found", message: "No such execution." } }, 404);
  return noStoreJson({ data: { jobId, ...executionView(snap.row) }, error: null }, 200);
}
