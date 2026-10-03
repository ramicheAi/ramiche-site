import { guardOwnerOrService } from "@/lib/server/service-caller";
import { jsonObject, missionContext, respond } from "@/lib/missions/http";
import { createMission, listMissions } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/command-center/missions?state=&owner=&before=&limit=  (founder or fleet agent) */
export async function GET(req: Request) {
  const auth = await guardOwnerOrService(req, "missions", "read");
  if (!auth.ok) return auth.response;
  const c = missionContext(auth, req);
  if (!c.ok) return c.response;
  const q = new URL(req.url).searchParams;
  return respond(await listMissions(c.ctx, { state: q.get("state"), owner: q.get("owner"), before: q.get("before"), limit: q.get("limit") }));
}

/** POST /api/command-center/missions  { objective, owner, ownerKind, agentIds?, successCriteria?, deliverables? } */
export async function POST(req: Request) {
  const auth = await guardOwnerOrService(req, "missions", "mutation");
  if (!auth.ok) return auth.response;
  const c = missionContext(auth, req);
  if (!c.ok) return c.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  return respond(await createMission(c.ctx, body));
}
