import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface RecentRow {
  id: string;
  channel_id: string | null;
  content: string | null;
  sender_type: string | null;
  sender_agent_id: string | null;
  created_at: string;
  pinned?: boolean | null;
}

/**
 * Lightweight "what's going on in chat right now" rollup for the HUD pulse pill.
 *
 * Returns an unread count since `?since=<ISO>`, the latest pinned messages, and a
 * preview of the 5 most recent root messages. Read receipts are tracked
 * client-side via localStorage so this endpoint stays stateless.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sinceRaw = sp.get("since") ?? "";
  let sinceIso: string | null = null;
  if (sinceRaw) {
    const ms = Date.parse(sinceRaw);
    if (!Number.isNaN(ms)) sinceIso = new Date(ms).toISOString();
  }

  const svc = getSupabaseService();
  if (!svc) {
    return NextResponse.json(
      { available: false, reason: "no_service_role" },
      { status: 200 }
    );
  }

  try {
    const recentQuery = svc
      .from("messages")
      .select(
        "id, channel_id, content, sender_type, sender_agent_id, created_at, pinned"
      )
      .eq("tenant_id", TENANT_ID)
      .is("thread_parent_id", null)
      .order("created_at", { ascending: false })
      .limit(8);

    const pinnedQuery = svc
      .from("messages")
      .select("id, channel_id, content, sender_type, sender_agent_id, created_at, pinned")
      .eq("tenant_id", TENANT_ID)
      .eq("pinned", true)
      .order("created_at", { ascending: false })
      .limit(6);

    const unreadQuery = sinceIso
      ? svc
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", TENANT_ID)
          .is("thread_parent_id", null)
          .gt("created_at", sinceIso)
      : null;

    const [recentRes, pinnedRes, unreadRes] = await Promise.all([
      recentQuery,
      pinnedQuery,
      unreadQuery ?? Promise.resolve(null),
    ]);

    if (recentRes.error) {
      return NextResponse.json(
        { available: false, reason: "query_failed", error: recentRes.error.message },
        { status: 200 }
      );
    }

    const recent = ((recentRes.data ?? []) as RecentRow[]).map((r) => ({
      id: r.id,
      channelId: r.channel_id,
      content: (r.content ?? "").slice(0, 240),
      senderType: r.sender_type,
      agentId: r.sender_agent_id,
      createdAt: r.created_at,
      pinned: r.pinned ?? false,
    }));

    const pinned = ((pinnedRes.data ?? []) as RecentRow[]).map((r) => ({
      id: r.id,
      channelId: r.channel_id,
      content: (r.content ?? "").slice(0, 200),
      agentId: r.sender_agent_id,
      createdAt: r.created_at,
    }));

    const unread =
      unreadRes && !unreadRes.error && typeof unreadRes.count === "number"
        ? unreadRes.count
        : 0;

    const latestAt = recent[0]?.createdAt ?? null;

    return NextResponse.json({
      available: true,
      unread,
      recent,
      pinned,
      pinnedCount: pinned.length,
      latestAt,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { available: false, reason: "exception", error: String(e) },
      { status: 200 }
    );
  }
}
