import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OPENCLAW_URL = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:24511";
const OPENCLAW_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || "";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { message, channelId, agentName, channelName } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // Try to relay to OpenClaw agent
    let agentResponse = "";
    const target = agentName || "atlas";
    
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (OPENCLAW_TOKEN) headers["Authorization"] = `Bearer ${OPENCLAW_TOKEN}`;

      const res = await fetch(`${OPENCLAW_URL}/api/sessions/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionKey: target,
          message: `[Command Center Chat - ${channelName || "general"}] ${message}`,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (res.ok) {
        const data = await res.json();
        agentResponse = data.response || data.message || `Message relayed to ${target}. Response pending.`;
      } else {
        agentResponse = `Relayed to ${target}. Agent will respond shortly.`;
      }
    } catch {
      agentResponse = `Message queued for ${target}. Agent offline or busy.`;
    }

    // Write agent response to Supabase
    const supabase = getSupabase();
    if (supabase && channelId) {
      // Map agent name to UUID
      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .ilike("name", target)
        .limit(1)
        .single();

      const agentUUID = agentProfile?.id || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

      await supabase.from("messages").insert({
        channel_id: channelId,
        sender_agent_id: agentUUID,
        content: agentResponse,
        tenant_id: "11111111-1111-1111-1111-111111111111",
        attachments: [],
      });
    }

    return NextResponse.json({ ok: true, response: agentResponse, agent: target });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
