import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { jsonObject, missionContext, respond } from "@/lib/missions/http";
import { reassignMission } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/command-center/missions/:id/reassign  { owner, ownerKind, agentIds }  (founder only) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const c = missionContext({ ok: true, kind: "owner", uid: guard.uid }, req);
  if (!c.ok) return c.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  const { id } = await params;
  return respond(await reassignMission(c.ctx, id, body));
}
