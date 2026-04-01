import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Marks a user message as read (double blue check) after an agent reply exists.
 * Requires SUPABASE_SERVICE_ROLE_KEY — run migration in docs/supabase-cc-chat-migrations.sql first.
 */
export async function POST(req: NextRequest) {
  try {
    const { userMessageId } = (await req.json()) as { userMessageId?: string };
    if (!userMessageId) {
      return NextResponse.json({ error: "userMessageId required" }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
    }
    const supabase = createClient(url, key);
    await supabase
      .from("messages")
      .update({
        status: "read",
        read_at: new Date().toISOString(),
      })
      .eq("id", userMessageId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[chat/mark-read]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
