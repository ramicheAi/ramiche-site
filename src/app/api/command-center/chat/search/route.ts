import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENT_DM_UUID, AGENT_UUID_TO_SHORT_ID } from "@/lib/cc-agent-dm-uuids";

export const dynamic = "force-dynamic";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function parseDateBound(s: string, which: "start" | "end"): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return which === "start" ? `${t}T00:00:00.000Z` : `${t}T23:59:59.999Z`;
  }
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function normalizeAgentParam(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  let k = raw.trim().toLowerCase();
  if (k === "dr-strange") k = "drstrange";
  return AGENT_DM_UUID[k] ? k : null;
}

/**
 * Tenant-scoped message search (root timeline rows only — scrollable in main feed).
 * Query: optional text (min 2 chars when used alone) plus optional channel, agent, date range.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const rawQ = sp.get("q")?.trim() ?? "";
    const safe = sanitizeSearchFragment(rawQ);
    const hasText = safe.length >= 2;

    const channelId = sp.get("channelId")?.trim() ?? "";
    const channelOk = channelId && UUID_RE.test(channelId);

    const agentKey = normalizeAgentParam(sp.get("agentId"));
    const agentUuid = agentKey ? AGENT_DM_UUID[agentKey] : null;

    const fromIso = parseDateBound(sp.get("from") ?? "", "start");
    const toIso = parseDateBound(sp.get("to") ?? "", "end");

    const hasFilters = !!(channelOk || agentUuid || fromIso || toIso);
    if (!hasText && !hasFilters) {
      return NextResponse.json({ results: [], skipped: false, hint: "need_q_or_filters" });
    }

    const limit = Math.min(
      40,
      Math.max(1, parseInt(sp.get("limit") || "25", 10) || 25)
    );

    const svc = getSupabaseService();
    if (!svc) {
      return NextResponse.json({ results: [], skipped: true, reason: "no_service_role" });
    }

    let qy = svc
      .from("messages")
      .select("id, channel_id, content, created_at, sender_type, sender_agent_id")
      .eq("tenant_id", TENANT_ID)
      .is("thread_parent_id", null);

    if (hasText) {
      qy = qy.ilike("content", `%${safe}%`);
    }
    if (channelOk) {
      qy = qy.eq("channel_id", channelId);
    }
    if (agentUuid) {
      qy = qy.eq("sender_type", "agent").eq("sender_agent_id", agentUuid);
    }
    if (fromIso) {
      qy = qy.gte("created_at", fromIso);
    }
    if (toIso) {
      qy = qy.lte("created_at", toIso);
    }

    const { data, error } = await qy.order("created_at", { ascending: false }).limit(limit);

    if (error) {
      console.error("[chat/search]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = (data ?? []).map((r) => {
      const st = r.sender_type as string | undefined;
      const sid = r.sender_agent_id as string | undefined;
      const agentShort =
        st === "agent" && sid && AGENT_UUID_TO_SHORT_ID[sid] ? AGENT_UUID_TO_SHORT_ID[sid] : null;
      return {
        id: r.id as string,
        channelId: r.channel_id as string,
        content: typeof r.content === "string" ? r.content : "",
        createdAt: r.created_at as string,
        senderType: st ?? null,
        agentId: agentShort,
      };
    });

    return NextResponse.json({ results, skipped: false });
  } catch (e) {
    console.error("[chat/search]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
