import { homedir } from "node:os";
import { join } from "node:path";
import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { executionRequestContext, checkoutRemoteTip, executionRoots } from "@/lib/execution/http";
import { startExecution } from "@/lib/execution/service";
import { JobsExecutionStore } from "@/lib/execution/store";
import { supabaseJobsDb } from "@/lib/execution/supabase-jobs-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/command-center/execution/approve { commandId, project?, capability?, branch?, bindingHash }  (founder only)
 * Answers 202 with the job once the run is recorded (GET .../execution/status follows it).
 * Runs exactly what `prepare` showed, or nothing. Surface "production": refused while PRODUCTION_DISPATCH_ENABLED is
 * false (the gate answers before any read or write).
 */
export async function POST(req: Request) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const c = await executionRequestContext(req, guard);
  if (!c.ok) return c.response;
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ data: null, error: { code: "not_configured", message: "Execution records are unavailable." } }, 503);
  const roots = executionRoots();
  // M6H: the approval returns as soon as the run's durable record exists; the run continues on the server and the
  // founder's screen follows its job (status route). A request that goes away loses nothing.
  const out = await startExecution(
    { record: c.record, founderUid: c.uid, choices: c.choices, seenBindingHash: String(c.body.bindingHash ?? "") },
    {
      surface: "production", ownerUid: process.env.PARALLAX_OWNER_UID ?? "", remoteTip: checkoutRemoteTip(roots),
      executor: { roots, execRoot: join(homedir(), ".parallax", "executions"), store: new JobsExecutionStore(supabaseJobsDb(svc)), claudeBin: process.env.CC_CLAUDE_BIN ?? join(homedir(), ".local", "bin", "claude") },
    },
  );
  return out.ok
    ? noStoreJson({ data: { started: true, executionId: out.executionId, jobId: out.jobId }, error: null }, 202)
    : noStoreJson({ data: null, error: { code: out.code, message: out.message } }, out.code === "production_dispatch_disabled" ? 403 : 422);
}
