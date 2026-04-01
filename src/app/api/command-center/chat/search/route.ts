import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Strip ILIKE wildcards so user input cannot broaden the pattern. */
function sanitizeSearchFragment(raw: string): string {
  return raw.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Full-text style search across all CC chat messages (tenant-scoped).
 * Only root timeline rows (no thread_parent_id) so hits are scrollable in the main feed.
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const safe = sanitizeSearchFragment(raw);
    if (safe.length < 2) {
      return NextResponse.json({ results: [], skipped: false });
    }

    const limit = Math.min(
      40,
      Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "25", 10) || 25)
    );

    const svc = getSupabaseService();
    if (!svc) {
      return NextResponse.json({ results: [], skipped: true, reason: "no_service_role" });
    }

    const pattern = `%${safe}%`;
    const { data, error } = await svc
      .from("messages")
      .select("id, channel_id, content, created_at")
      .eq("tenant_id", TENANT_ID)
      .is("thread_parent_id", null)
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[chat/search]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = (data ?? []).map((r) => ({
      id: r.id as string,
      channelId: r.channel_id as string,
      content: typeof r.content === "string" ? r.content : "",
      createdAt: r.created_at as string,
    }));

    return NextResponse.json({ results, skipped: false });
  } catch (e) {
    console.error("[chat/search]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
