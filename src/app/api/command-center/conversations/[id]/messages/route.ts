import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeDbError } from "@/lib/chat-persistence";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fixed owner identity for the single-tenant Command Center chat (matches the
// value already used elsewhere in this app for the owner's own messages).
const OWNER_USER_ID = "00000000-0000-0000-0000-000000000001";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const MAX_CONTENT_LENGTH = 20_000;

/**
 * GET /api/command-center/conversations/[id]/messages
 *
 * The owner-gated server-side history read the Command Center chat page must
 * use instead of the browser anon Supabase client. anon/authenticated have
 * had zero table privileges on public.messages since the P05-B3 lockdown
 * migration (RLS enabled, no policies, defense in depth) — confirmed live on
 * the command-center-hq project. The anon client doesn't throw on that denial
 * (supabase-js resolves with `data: null, error: {code: "42501", ...}`), so a
 * browser read of this table can only ever render an empty channel, never
 * distinguish "no messages" from "denied." This endpoint uses the service-role
 * client (which bypasses RLS under explicit owner authorization) and always
 * reports a read failure as a failure, never as an empty array.
 */
async function GET_handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: { message: "invalid channel id" } }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Supabase service role not configured" } },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const requestedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 200)
    : 100;
  // "desc" supports the polling fallback's "most recent N" tail fetch
  // (it reverses client-side); any other value, including unset, is the
  // normal ascending history order.
  const ascending = searchParams.get("order") !== "desc";

  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("channel_id", id)
    .order("created_at", { ascending })
    .limit(limit);

  if (error) {
    // A real read failure (table missing, RLS misconfig, connection error) —
    // reported as a failure, never silently coerced to an empty history.
    return NextResponse.json({ error: sanitizeDbError(error) }, { status: 502 });
  }

  return NextResponse.json({ data: data ?? [] });
}

/**
 * POST /api/command-center/conversations/[id]/messages
 *
 * The owner-gated server-side send the chat page must use instead of the
 * browser anon Supabase client's direct insert. Independent review of the
 * read-side fix above (CC-RECOVERY-INTEGRATION-01) found the write side had
 * the identical exposure: anon/authenticated have zero INSERT privilege on
 * public.messages (same P05-B3 lockdown), so a browser insert with the anon
 * key fails with a permission error — on the OLD production build, which
 * predates this fix, a chat send would fail silently into the existing
 * `if (error) { ...; return; }` branch with no relay and no visible error
 * beyond a console.error. This endpoint performs the write server-side with
 * the service-role client under explicit owner authorization.
 */
async function POST_handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: { message: "invalid channel id" } }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "invalid JSON body" } }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim() && !(Array.isArray(body.attachments) && body.attachments.length > 0)) {
    return NextResponse.json({ error: { message: "content or attachments required" } }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: { message: "content too long" } }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Supabase service role not configured" } },
      { status: 503 }
    );
  }

  const threadParentId = typeof body.threadParentId === "string" ? body.threadParentId : null;
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  const { data: inserted, error } = await db
    .from("messages")
    .insert({
      channel_id: id,
      sender_user_id: OWNER_USER_ID,
      sender_type: "user",
      content: content || "(attachment)",
      tenant_id: TENANT_ID,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      status: "sent",
      thread_parent_id: threadParentId,
      metadata,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: sanitizeDbError(error) }, { status: 502 });
  }

  return NextResponse.json({ data: inserted });
}

// Owner-only: this is the authorized boundary that replaces the anon client's
// direct (and now permission-denied) reads/writes of public.messages.
export const GET = ownerOnly(GET_handler);
export const POST = ownerOnly(POST_handler);
