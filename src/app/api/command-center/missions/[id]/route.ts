import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { missionContext, respond } from "@/lib/missions/http";
import { getMission } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/command-center/missions/:id?includeRemoved=1  -> { mission, links, events }  (founder only) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;
  const c = missionContext(guard);
  if (!c.ok) return c.response;
  const { id } = await params;
  const includeRemoved = new URL(req.url).searchParams.get("includeRemoved") === "1";
  return respond(await getMission(c.ctx, id, { includeRemoved }));
}
