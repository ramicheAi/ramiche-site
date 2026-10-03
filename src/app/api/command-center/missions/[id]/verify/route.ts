import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { jsonObject, missionContext, respond } from "@/lib/missions/http";
import { verifyMission } from "@/lib/missions/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/command-center/missions/:id/verify  { note? }
 * Founder verification, completed -> verified. Owner session only (exact Origin, Firebase session = owner uid,
 * session-bound CSRF). There is no machine path to this route: it is not in the B2 policy, so the P03 coverage test
 * holds it to the human guard. The verifier identity is the session, never anything in the body.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const c = missionContext({ ok: true, kind: "owner", uid: guard.uid }, req);
  if (!c.ok) return c.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  const { id } = await params;
  return respond(await verifyMission(c.ctx, id, body));
}
