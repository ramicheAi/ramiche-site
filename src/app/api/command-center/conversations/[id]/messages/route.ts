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

  // Idempotency key (CC-RECOVERY-DELIVERY-CONVERGENCE-01): a client-generated
  // UUID identifying one logical send attempt. Optional only because the
  // migration that backs it (20261112180000_messages_client_idempotency_key)
  // is prepared but NOT YET APPLIED to production — see
  // ops-handoff/CC-CHAT-IDEMPOTENCY-MIGRATION-SAFETY-2026-11-12.md. Once
  // applied, the client always sends one; a caller that omits it gets no
  // duplicate protection, same as today's behavior. Validated before any
  // database call, same as every other input check above.
  let clientMessageId: string | undefined;
  if (body.clientMessageId !== undefined) {
    if (typeof body.clientMessageId !== "string" || !UUID_RE.test(body.clientMessageId)) {
      return NextResponse.json({ error: { message: "clientMessageId must be a UUID" } }, { status: 400 });
    }
    clientMessageId = body.clientMessageId;
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
  const finalContent = content || "(attachment)";

  const insertRow = {
    channel_id: id,
    sender_user_id: OWNER_USER_ID,
    sender_type: "user",
    content: finalContent,
    tenant_id: TENANT_ID,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    status: "sent",
    thread_parent_id: threadParentId,
    metadata,
  };

  let { data: inserted, error } = await db
    .from("messages")
    .insert(clientMessageId ? { ...insertRow, client_message_id: clientMessageId } : insertRow)
    .select("id, created_at")
    .single();

  // Migration not yet applied: the column doesn't exist yet (undefined_column).
  // Fall back to the pre-idempotency insert rather than hard-failing chat —
  // shipping this route must not depend on an unapproved schema change being
  // live. No duplicate protection until the migration lands; this is the
  // documented, approval-gated tradeoff, not a silent downgrade (logged).
  if (error?.code === "42703" && clientMessageId) {
    console.error("[chat] client_message_id column missing — idempotency migration not yet applied, inserting without a key");
    ({ data: inserted, error } = await db.from("messages").insert(insertRow).select("id, created_at").single());
  }

  if (error?.code === "23505" && clientMessageId) {
    // Unique violation on client_message_id: this exact send was already
    // persisted (our own prior attempt, or a concurrent retry that won the
    // race — Postgres's unique index is what actually makes "concurrent
    // retries cannot create duplicates" true, not any application-level
    // check). Look the existing row up and decide replay vs. reject.
    const { data: existing, error: lookupError } = await db
      .from("messages")
      .select("id, created_at, content")
      .eq("client_message_id", clientMessageId)
      .maybeSingle();

    if (lookupError || !existing) {
      // The insert failed on this exact constraint but the row can't be
      // found — report as a failure rather than silently proceeding.
      return NextResponse.json({ error: sanitizeDbError(lookupError ?? error) }, { status: 502 });
    }
    if (existing.content !== finalContent) {
      // Same idempotency key, different content: never silently keep the
      // first write or silently accept the second — reject explicitly.
      return NextResponse.json(
        { error: { code: "idempotency_key_reused", message: "clientMessageId was already used for different content" } },
        { status: 409 }
      );
    }
    // Same key, same content: this is a retry of an already-accepted send.
    // Return the original row's id, not a new one — and flag it as a replay
    // so the caller knows NOT to dispatch the agent relay a second time for
    // what is still the same logical turn.
    return NextResponse.json({ data: { id: existing.id, created_at: existing.created_at }, replay: true });
  }

  if (error) {
    return NextResponse.json({ error: sanitizeDbError(error) }, { status: 502 });
  }

  return NextResponse.json({ data: inserted, replay: false });
}

// Owner-only: this is the authorized boundary that replaces the anon client's
// direct (and now permission-denied) reads/writes of public.messages.
export const GET = ownerOnly(GET_handler);
export const POST = ownerOnly(POST_handler);
