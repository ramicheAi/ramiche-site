import { guardOwnerOrService } from "@/lib/server/service-caller";
import { jsonObject, missionContext, respond } from "@/lib/missions/http";
import { addLink } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/command-center/missions/:id/links  { targetType, targetId, targetIndex?, relation, criterionId? }
 * The target is resolved server-side and stored in canonical form (src/lib/missions/targets.ts).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardOwnerOrService(req, "missions", "mutation");
  if (!auth.ok) return auth.response;
  const c = missionContext(auth, req);
  if (!c.ok) return c.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  const { id } = await params;
  return respond(await addLink(c.ctx, id, body));
}
