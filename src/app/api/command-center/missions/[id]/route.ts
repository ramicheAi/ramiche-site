import { guardOwnerOrService } from "@/lib/server/service-caller";
import { missionContext, respond } from "@/lib/missions/http";
import { getMission } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/command-center/missions/:id?includeRemoved=1  -> { mission, links, events }  (founder or fleet agent) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardOwnerOrService(req, "missions", "read");
  if (!auth.ok) return auth.response;
  const c = missionContext(auth, req);
  if (!c.ok) return c.response;
  const { id } = await params;
  const includeRemoved = new URL(req.url).searchParams.get("includeRemoved") === "1";
  return respond(await getMission(c.ctx, id, { includeRemoved }));
}
