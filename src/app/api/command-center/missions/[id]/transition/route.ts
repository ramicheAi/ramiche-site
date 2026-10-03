import { guardOwnerOrService } from "@/lib/server/service-caller";
import { jsonObject, missionContext, respond } from "@/lib/missions/http";
import { transitionMission } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/command-center/missions/:id/transition  { to, expectedFrom?, note? }
 * Every transition except completed -> verified, which only /verify performs. Policy: src/lib/missions/principal.ts.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardOwnerOrService(req, "missions", "mutation");
  if (!auth.ok) return auth.response;
  const c = missionContext(auth, req);
  if (!c.ok) return c.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  const { id } = await params;
  return respond(await transitionMission(c.ctx, id, body));
}
