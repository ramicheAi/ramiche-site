import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messageId?: string; pinned?: boolean };
    const messageId = body.messageId?.trim();
    if (!messageId || typeof body.pinned !== "boolean") {
      return NextResponse.json({ error: "messageId and pinned boolean required" }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
      return NextResponse.json({ error: "invalid messageId" }, { status: 400 });
    }

    const svc = getSupabaseService();
    if (!svc) {
      return NextResponse.json({ ok: false, skipped: true, reason: "no_service_role" }, { status: 200 });
    }

    const { error } = await svc.from("messages").update({ pinned: body.pinned }).eq("id", messageId);
    if (error) {
      console.error("[chat/pin]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[chat/pin]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
