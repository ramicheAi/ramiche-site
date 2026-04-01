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

/**
 * Toggle a reaction for the CC user on a message (insert or delete).
 * Requires `message_reactions` table — see docs/supabase-cc-chat-migrations.sql
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messageId?: string; emoji?: string };
    const messageId = body.messageId?.trim();
    const emoji = body.emoji?.trim();
    if (!messageId || !emoji) {
      return NextResponse.json({ error: "messageId and emoji required" }, { status: 400 });
    }
    if (!isAllowedReactionEmoji(emoji)) {
      return NextResponse.json({ error: "emoji not allowed" }, { status: 400 });
    }

    const svc = getSupabaseService();
    if (!svc) {
      return NextResponse.json({ ok: false, skipped: true, reason: "no_service_role" }, { status: 200 });
    }

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
