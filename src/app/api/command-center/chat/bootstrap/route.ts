import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * P05-B2: owner-only chat bootstrap (channels + agent profiles), read with the
 * service role. Replaces the chat page's direct anon-key selects so that B3 can
 * revoke anon access to `channels` and `agent_profiles`.
 */
export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ channels: null, agents: null, error: { message: "Supabase not configured" } }, 503);
  const [ch, ag] = await Promise.all([
    svc.from("channels").select("*").order("last_activity_at", { ascending: false }),
    svc.from("agent_profiles").select("*").order("name"),
  ]);
  if (ch.error || ag.error) return noStoreJson({ channels: null, agents: null, error: { message: "bootstrap query failed" } }, 502);
  return noStoreJson({ channels: ch.data ?? [], agents: ag.data ?? [], error: null });
}
