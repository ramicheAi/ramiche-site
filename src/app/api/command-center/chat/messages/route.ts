import { guardPrivateRead, guardProtectedMutation } from "@/lib/server/protected-mutation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CC_TENANT_ID, CC_USER_ID, UUID_RE, clampInt, noStoreJson, sanitizeAttachments } from "@/lib/server/cockpit-chat-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CONTENT = 20_000;

/**
 * P05-B2: owner-only message history for one channel.
 *   GET ?channelId=<uuid>&limit=1..200&order=asc|desc
 * Replaces the chat page's anon-key `messages` selects (initial load and the
 * polling fallback). Returns raw rows in the same shape the page already maps.
 */
export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;
  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId") ?? "";
  if (!UUID_RE.test(channelId)) return noStoreJson({ data: null, error: { message: "channelId must be a UUID" } }, 400);
  const limit = clampInt(url.searchParams.get("limit"), 100, 1, 200);
  const ascending = url.searchParams.get("order") !== "desc";
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ data: null, error: { message: "Supabase not configured" } }, 503);
  const { data, error } = await svc
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending })
    .limit(limit);
  if (error) return noStoreJson({ data: null, error: { message: "messages query failed" } }, 502);
  return noStoreJson({ data: data ?? [], error: null });
}

/**
 * P05-B2: owner-only insert of Ramon's own chat message (the page's primary
 * send path; previously a direct anon-key INSERT from the browser).
 * Identity fields (sender, tenant, status, source) are fixed server-side;
 * only content fields come from the request and are validated.
 */
export async function POST(req: Request) {
  const p03Guard = await guardProtectedMutation(req);
  if (!p03Guard.ok) return p03Guard.response;
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return noStoreJson({ data: null, error: { message: "invalid JSON body" } }, 400);
  }
  const channelId = typeof body.channelId === "string" ? body.channelId : "";
  if (!UUID_RE.test(channelId)) return noStoreJson({ data: null, error: { message: "channelId must be a UUID" } }, 400);
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim() || content.length > MAX_CONTENT) return noStoreJson({ data: null, error: { message: "content required (max 20000 chars)" } }, 400);
  const threadParentId = body.threadParentId === null || body.threadParentId === undefined ? null : body.threadParentId;
  if (threadParentId !== null && (typeof threadParentId !== "string" || !UUID_RE.test(threadParentId))) {
    return noStoreJson({ data: null, error: { message: "threadParentId must be a UUID or null" } }, 400);
  }
  const attachments = sanitizeAttachments(body.attachments, process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (attachments === null) return noStoreJson({ data: null, error: { message: "invalid attachments" } }, 400);
  const m = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? (body.metadata as Record<string, unknown>) : {};
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
  const metadata = {
    targetAgent: str(m.targetAgent, 64),
    isDM: m.isDM === true,
    dmChannelId: typeof m.dmChannelId === "string" && UUID_RE.test(m.dmChannelId) ? m.dmChannelId : undefined,
    channelName: str(m.channelName, 128),
    source: "command-center-ui",
  };
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ data: null, error: { message: "Supabase not configured" } }, 503);
  const { data, error } = await svc
    .from("messages")
    .insert({
      channel_id: channelId,
      sender_user_id: CC_USER_ID,
      sender_type: "user",
      content,
      tenant_id: CC_TENANT_ID,
      attachments,
      status: "sent",
      thread_parent_id: threadParentId,
      metadata,
    })
    .select("id")
    .single();
  if (error || !data) return noStoreJson({ data: null, error: { message: "insert failed" } }, 502);
  return noStoreJson({ data: { id: data.id as string }, error: null });
}
