import { runProspectorDaily } from "@/lib/server/prospector-daily";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Owner-triggered prospector run (Command Center button). POST only: a state-changing
 * GET is CSRF/prefetch/link-preview reachable, so GET is intentionally not exported (405).
 * The unattended scheduler uses /api/command-center/prospector/cron with its own secret.
 */
async function POST_handler() {
  return runProspectorDaily();
}

export const POST = ownerOnly(POST_handler);
