import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeDbError } from "@/lib/chat-persistence";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Owner-only: this is the authorized boundary that replaces the anon client's
// direct (and now permission-denied) reads of public.messages.
export const GET = ownerOnly(GET_handler);
