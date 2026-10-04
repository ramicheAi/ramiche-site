import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { missionContext, respond } from "@/lib/missions/http";
import { previewTarget } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/command-center/missions/resolve?targetType=&targetId=&targetIndex=  -> canonical target + resolution. Read-only. */
export async function GET(req: Request) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;
  const c = missionContext(guard);
  if (!c.ok) return c.response;
  const q = new URL(req.url).searchParams;
  return respond(await previewTarget(c.ctx, { targetType: q.get("targetType"), targetId: q.get("targetId"), targetIndex: q.get("targetIndex") }));
}
