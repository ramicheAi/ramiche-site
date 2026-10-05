import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CC_TENANT_ID, clampInt, noStoreJson } from "@/lib/server/cockpit-chat-data";
import { commandChannelId } from "@/lib/command/channel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * P05-B2: owner-only data for the Outputs gallery: recent messages that carry
 * attachments, plus channel names. Replaces the gallery page's anon-key selects.
 * Image bytes still load from the public `agent-output` bucket URLs (unchanged).
 */
export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;
  const limit = clampInt(new URL(req.url).searchParams.get("limit"), 500, 1, 500);
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ messages: null, channels: null, error: { message: "Supabase not configured" } }, 503);
  const [msgs, chans] = await Promise.all([
    svc
      .from("messages")
      .select("id, channel_id, sender_agent_id, sender_type, content, attachments, created_at, metadata")
      .not("attachments", "is", null)
      .neq("channel_id", commandChannelId(CC_TENANT_ID))   // P06 M5: shadow command records are never gallery output
      .order("created_at", { ascending: false })
      .limit(limit),
    svc.from("channels").select("id, name, slug"),
  ]);
  if (msgs.error || chans.error) return noStoreJson({ messages: null, channels: null, error: { message: "gallery query failed" } }, 502);
  return noStoreJson({ messages: msgs.data ?? [], channels: chans.data ?? [], error: null });
}
