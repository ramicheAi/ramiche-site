/**
 * POST /api/atlas/chat
 * GET  /api/atlas/chat?action=status|messages|unanswered
 *
 * RAMICHE OS — ATLAS Command Center Endpoint
 * ─────────────────────────────────────────────────────────────────
 * Handles all Command Center chat operations:
 *
 * POST actions:
 *   { action: "send",    message, channelId, agentName, channelName, userId }
 *   { action: "pin",     messageId, pinned }
 *   { action: "delete",  messageId }
 *   { action: "restart-bridge" }  ← proxies to Mac bridge endpoint
 *
 * GET actions (via ?action=):
 *   status       → bridge health + system status
 *   messages     → recent messages (?channelId=&limit=)
 *   unanswered   → messages awaiting agent response
 *   summary      → channel activity summary (?channelId=)
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic    = "force-dynamic";
export const maxDuration = 15;

const TENANT_ID   = process.env.RAMICHE_TENANT_ID || "11111111-1111-1111-1111-111111111111";
// Bridge control endpoint — a lightweight Express server on your Mac
// exposed via ngrok or Tailscale. See bridge-control-server.js.
const BRIDGE_CTRL = process.env.BRIDGE_CONTROL_URL || "";
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET;

// Agent name → sessionKey
const AGENT_SESSIONS: Record<string, string> = {
  atlas:           "atlas",
  oracle:          "oracle",
  simons:          "simons",
  "rich dad":      "rich-dad",
  "rich-dad":      "rich-dad",
  richdad:         "rich-dad",
  themis:          "themis",
  maestro:         "maestro",
  selah:           "selah",
  nova:            "nova",
  triage:          "triage",
  "the architect": "architect",
  architect:       "architect",
};

// Routing classifier — mirrors ATLAS Pillar 7
function classifyAgent(message: string): string {
  const m = message.toLowerCase();
  if (/trading|options|0dte|quant|spx|ticker|pattern|calls|puts/i.test(m))      return "simons";
  if (/cash flow|passive income|assets|liabilities|wealth|quadrant/i.test(m))    return "rich-dad";
  if (/legal|contract|ip |copyright|trademark|compliance|liability|llc/i.test(m)) return "themis";
  if (/strategy|vision|scale|product|systems|company|culture|build/i.test(m))    return "architect";
  if (/music|beat|loop|mix|daw|sample|producer|mastering|bpm/i.test(m))          return "maestro";
  if (/wellness|therapy|mindset|stress|healing|emotion|trauma|clarity/i.test(m)) return "selah";
  if (/3d print|bambu|meshy|fabrication|filament|nova|customer/i.test(m))        return "nova";
  if (/bug|error|crash|gateway|openclaw|debug|health|triage/i.test(m))           return "triage";
  if (/oracle|macro|historical|legend|synthesis|multi.perspective/i.test(m))     return "oracle";
  return "atlas";
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── GET ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action    = searchParams.get("action") || "status";
  const channelId = searchParams.get("channelId");
  const limit     = parseInt(searchParams.get("limit") || "20");

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    // ── status ──────────────────────────────────────────────────
    if (action === "status") {
      // Ping bridge control server if configured
      let bridgeStatus: Record<string, unknown> = { configured: !!BRIDGE_CTRL };
      if (BRIDGE_CTRL) {
        try {
          const res = await fetch(`${BRIDGE_CTRL}/health`, {
            headers: { "x-bridge-secret": BRIDGE_SECRET || "" },
            signal:  AbortSignal.timeout(5000),
          });
          bridgeStatus = { ...bridgeStatus, ...(await res.json()), reachable: res.ok };
        } catch {
          bridgeStatus.reachable = false;
        }
      }

      // Last message
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("id, content, sender_type, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        ok:          true,
        atlas:       "online",
        bridge:      bridgeStatus,
        supabase:    true,
        lastMessage: lastMsg,
        timestamp:   new Date().toISOString(),
      });
    }

    // ── messages ─────────────────────────────────────────────────
    if (action === "messages") {
      let query = supabase
        .from("messages")
        .select("id, content, sender_type, created_at, metadata, agent_profiles(name)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (channelId) query = query.eq("channel_id", channelId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return NextResponse.json({ ok: true, messages: (data || []).reverse() });
    }

    // ── unanswered ───────────────────────────────────────────────
    if (action === "unanswered") {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: userMsgs } = await supabase
        .from("messages")
        .select("*")
        .eq("sender_type", "user")
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      const unanswered = [];
      for (const msg of userMsgs || []) {
        const { data: replies } = await supabase
          .from("messages")
          .select("id")
          .eq("thread_parent_id", msg.id)
          .eq("sender_type", "agent")
          .limit(1);

        if (!replies?.length) unanswered.push(msg);
      }

      return NextResponse.json({ ok: true, unanswered, count: unanswered.length });
    }

    // ── summary ──────────────────────────────────────────────────
    if (action === "summary") {
      if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("messages")
        .select("sender_type, created_at, agent_profiles(name)")
        .eq("channel_id", channelId)
        .gte("created_at", since);

      const summary = {
        total:    data?.length || 0,
        user:     data?.filter(m => m.sender_type === "user").length || 0,
        agent:    data?.filter(m => m.sender_type === "agent").length || 0,
        system:   data?.filter(m => m.sender_type === "system").length || 0,
        agents:   {} as Record<string, number>,
      };

      for (const m of (data || []).filter(m => m.sender_type === "agent")) {
        const name = (m.agent_profiles as any)?.name || "unknown";
        summary.agents[name] = (summary.agents[name] || 0) + 1;
      }

      return NextResponse.json({ ok: true, summary });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { action = "send" } = body;

    // ── send ─────────────────────────────────────────────────────
    if (action === "send") {
      const { message, channelId, agentName, channelName, userId } = body;

      if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });
      if (!channelId)        return NextResponse.json({ error: "channelId required" }, { status: 400 });

      // Resolve agent — explicit pick or auto-classify
      const resolvedAgent = agentName
        ? (AGENT_SESSIONS[agentName.toLowerCase()] || agentName.toLowerCase())
        : classifyAgent(message);

      // Write user message — bridge picks this up via Realtime
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          channel_id:     channelId,
          sender_user_id: userId || null,
          sender_type:    "user",
          content:        message.trim(),
          tenant_id:      TENANT_ID,
          attachments:    [],
          metadata: {
            targetAgent: resolvedAgent,
            channelName: channelName || "general",
            source:      "atlas-chat",
            classified:  !agentName, // true if auto-routed
          },
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      return NextResponse.json({
        ok:           true,
        messageId:    inserted.id,
        routedTo:     resolvedAgent,
        autoClassified: !agentName,
        status:       "queued",
        note:         "ATLAS bridge will deliver agent response via Realtime",
      });
    }

    // ── pin ───────────────────────────────────────────────────────
    if (action === "pin") {
      const { messageId, pinned = true } = body;
      if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

      const { error } = await supabase
        .from("messages")
        .update({ is_pinned: pinned })
        .eq("id", messageId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, pinned });
    }

    // ── delete ────────────────────────────────────────────────────
    if (action === "delete") {
      const { messageId } = body;
      if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    // ── restart-bridge ────────────────────────────────────────────
    if (action === "restart-bridge") {
      if (!BRIDGE_CTRL) {
        return NextResponse.json({
          error: "BRIDGE_CONTROL_URL not set. Add it to Vercel env vars.",
        }, { status: 503 });
      }

      const res = await fetch(`${BRIDGE_CTRL}/restart`, {
        method:  "POST",
        headers: { "x-bridge-secret": BRIDGE_SECRET || "" },
        signal:  AbortSignal.timeout(10000),
      });

      const data = await res.json();
      return NextResponse.json({ ok: res.ok, ...data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (e) {
    console.error("[atlas/chat] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
