import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { respond } from "@/lib/missions/http";
import { commandContext } from "@/lib/command/http";
import { getShadow } from "@/lib/command/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/command-center/command/shadow/:id  -> the recorded shadow decision and the Missions linking it (founder only). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;
  const c = commandContext(guard);
  if (!c.ok) return c.response;
  const { id } = await params;
  return respond(await getShadow(c.ctx, id));
}
