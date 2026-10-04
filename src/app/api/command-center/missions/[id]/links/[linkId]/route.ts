import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { missionContext, respond } from "@/lib/missions/http";
import { removeLink } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** DELETE /api/command-center/missions/:id/links/:linkId  -> tombstones the link (founder only). Nothing is hard-deleted. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const c = missionContext(guard);
  if (!c.ok) return c.response;
  const { id, linkId } = await params;
  return respond(await removeLink(c.ctx, id, linkId));
}
