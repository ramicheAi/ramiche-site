import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { jsonObject, missionContext, respond } from "@/lib/missions/http";
import { transitionMission } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/command-center/missions/:id/transition  { to, expectedFrom?, note? }
 * Every transition except completed -> verified, which only /verify performs. Policy: src/lib/missions/principal.ts.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const c = missionContext(guard);
  if (!c.ok) return c.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  const { id } = await params;
  return respond(await transitionMission(c.ctx, id, body));
}
