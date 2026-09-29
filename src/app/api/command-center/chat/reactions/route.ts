import { guardPrivateRead, guardProtectedMutation } from "@/lib/server/protected-mutation";
import { noStoreJson, parseUuidList } from "@/lib/server/cockpit-chat-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CC_REACTION_USER_ID, isAllowedReactionEmoji } from "@/lib/chat-reactions";

export const dynamic = "force-dynamic";

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Toggle a reaction on a message (insert or delete).
 * The reacting user is always the verified owner (CC commander UUID); a body
 * `userId` is ignored (P05-B2).
 * Requires `message_reactions` table — see docs/supabase-cc-chat-migrations.sql
 */
export async function POST(req: NextRequest) {
  const p03Guard = await guardProtectedMutation(req);
  if (!p03Guard.ok) return p03Guard.response;

  try {
    const body = (await req.json()) as { messageId?: string; emoji?: string };
    const messageId = body.messageId?.trim();
    const emoji = body.emoji?.trim();
    if (!messageId || !emoji) {
      return NextResponse.json({ error: "messageId and emoji required" }, { status: 400 });
    }
    if (!UUID_RE.test(messageId)) {
      return NextResponse.json({ error: "messageId must be a uuid" }, { status: 400 });
    }
    if (!isAllowedReactionEmoji(emoji)) {
      return NextResponse.json({ error: "emoji not allowed" }, { status: 400 });
    }

    const svc = getSupabaseService();
    if (!svc) {
      return NextResponse.json({ ok: false, skipped: true, reason: "no_service_role" }, { status: 200 });
    }

    // P05-B2: identity comes from the verified owner session, never from the request body.
    const userId = CC_REACTION_USER_ID;

    const { data: existing } = await svc
      .from("message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .maybeSingle();

    if (existing?.id) {
      await svc.from("message_reactions").delete().eq("id", existing.id);
      return NextResponse.json({ ok: true, action: "removed" as const });
    }

    const { error } = await svc.from("message_reactions").insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    });
    if (error) {
      console.error("[chat/reactions] insert", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "added" as const });
  } catch (e) {
    console.error("[chat/reactions]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * P05-B2: owner-only read of reactions for up to 200 messages
 * (`?messageIds=<uuid>,<uuid>`). Replaces the browser's anon-key select.
 */
export async function GET(req: NextRequest) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;
  const ids = parseUuidList(new URL(req.url).searchParams.get("messageIds"), 200);
  if (ids === null) return noStoreJson({ data: null, error: { message: "invalid messageIds" } }, 400);
  if (ids.length === 0) return noStoreJson({ data: [], error: null });
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ data: null, error: { message: "Supabase not configured" } }, 503);
  const { data, error } = await svc.from("message_reactions").select("message_id, emoji, user_id").in("message_id", ids);
  if (error) return noStoreJson({ data: null, error: { message: "reactions query failed" } }, 502);
  return noStoreJson({ data: data ?? [], error: null });
}
