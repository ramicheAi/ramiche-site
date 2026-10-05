import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { jsonObject, respond } from "@/lib/missions/http";
import { commandContext } from "@/lib/command/http";
import { shadowRoute } from "@/lib/command/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/command-center/command/shadow  { text, missionId?, handlerHint?, supersedes? }  (founder only)
 * Records the SHADOW routing decision for a founder command. Nothing is executed, sent, approved, merged or deployed.
 */
export async function POST(req: Request) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;
  const c = commandContext(guard);
  if (!c.ok) return c.response;
  const body = await jsonObject(req);
  if (body instanceof Response) return body;
  return respond(await shadowRoute(c.ctx, body));
}
