import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { executionRequestContext, checkoutRemoteTip, executionRoots } from "@/lib/execution/http";
import { prepareExecution } from "@/lib/execution/service";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/command-center/execution/prepare { commandId, project?, capability?, branch? }  (founder only)
 * The smallest decision for a shadow-routed command: what would run, where, at which capability. Nothing runs.
 * Disabled (403 production_dispatch_disabled) while PRODUCTION_DISPATCH_ENABLED is false.
 */
export async function POST(req: Request) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const c = await executionRequestContext(req, guard);
  if (!c.ok) return c.response;
  const p = await prepareExecution({ record: c.record, founderUid: c.uid, choices: c.choices }, { remoteTip: checkoutRemoteTip(executionRoots()) });
  return p.ok
    ? noStoreJson({ data: { sentence: p.sentence, bindingHash: p.bindingHash, details: p.details, capability: p.request.capability, project: p.request.project.slug }, error: null }, 200)
    : noStoreJson({ data: null, error: { code: p.code, message: p.message, question: p.question ?? null, candidates: p.candidates ?? [] } }, 422);
}
