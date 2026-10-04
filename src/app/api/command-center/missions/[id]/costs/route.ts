import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { missionContext, respond } from "@/lib/missions/http";
import { missionCosts } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/command-center/missions/:id/costs  -> cost and usage attributable to the mission (founder only, read-only).
 * Derived on read from execution_events_with_shadow_cost; see src/lib/missions/costs.ts for the attribution rules.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;
  const c = missionContext(guard);
  if (!c.ok) return c.response;
  const { id } = await params;
  return respond(await missionCosts(c.ctx, id));
}
