import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const BUCKET = "chat-attachments";

/**
 * Multipart upload to Supabase Storage (public bucket).
 * Create bucket `chat-attachments` (public) in Supabase; see docs/supabase-cc-chat-migrations.sql.
 */
export async function POST(req: NextRequest) {
  try {
    const svc = getSupabaseService();
    if (!svc) {
      return NextResponse.json({ ok: false, skipped: true, reason: "no_service_role" }, { status: 200 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "upload";
    const path = `cc/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;

    const { error: upErr } = await svc.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      console.error("[chat/upload]", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e) {
    console.error("[chat/upload]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
