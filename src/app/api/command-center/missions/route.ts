import { guardPrivateRead, guardProtectedMutation } from "@/lib/server/protected-mutation";
import { jsonObject, missionContext, respond } from "@/lib/missions/http";
import { createMission, listMissions } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/command-center/missions?state=&owner=&before=&limit=  (founder only) */
export async function GET(req: Request) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;
  const c = missionContext(guard);
  if (!c.ok) return c.response;
  const q = new URL(req.url).searchParams;
  return respond(await listMissions(c.ctx, { state: q.get("state"), owner: q.get("owner"), before: q.get("before"), limit: q.get("limit") }));
}

/** POST /api/command-center/missions  { objective, owner, ownerKind, agentIds?, successCriteria?, deliverables? } */
export async function POST(req: Request) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const c = missionContext(guard);
  if (!c.ok) return c.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  return respond(await createMission(c.ctx, body));
}
