import { guardOwnerOrService } from "@/lib/server/service-caller";
import { missionContext, respond } from "@/lib/missions/http";
import { previewTarget } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/command-center/missions/resolve?targetType=&targetId=&targetIndex=  -> canonical target + resolution. Read-only. */
export async function GET(req: Request) {
  const auth = await guardOwnerOrService(req, "missions", "read");
  if (!auth.ok) return auth.response;
  const c = missionContext(auth, req);
  if (!c.ok) return c.response;
  const q = new URL(req.url).searchParams;
  return respond(await previewTarget(c.ctx, { targetType: q.get("targetType"), targetId: q.get("targetId"), targetIndex: q.get("targetIndex") }));
}
