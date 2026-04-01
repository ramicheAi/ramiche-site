import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Same UUID map as chat/route.ts — agent messages resolve in UI */
const AGENT_DM_UUID: Record<string, string> = {
  atlas: "aa000001-0000-0000-0000-000000000000",
  triage: "aa000002-0000-0000-0000-000000000000",
  shuri: "aa000003-0000-0000-0000-000000000000",
  proximon: "aa000004-0000-0000-0000-000000000000",
  aetherion: "aa000005-0000-0000-0000-000000000000",
  simons: "aa000006-0000-0000-0000-000000000000",
  mercury: "aa000007-0000-0000-0000-000000000000",
  vee: "aa000008-0000-0000-0000-000000000000",
  ink: "aa000009-0000-0000-0000-000000000000",
  echo: "aa000010-0000-0000-0000-000000000000",
  haven: "aa000011-0000-0000-0000-000000000000",
  widow: "aa000012-0000-0000-0000-000000000000",
  drstrange: "aa000013-0000-0000-0000-000000000000",
  kiyosaki: "aa000014-0000-0000-0000-000000000000",
  michael: "aa000015-0000-0000-0000-000000000000",
  selah: "aa000016-0000-0000-0000-000000000000",
  prophets: "aa000017-0000-0000-0000-000000000000",
  themaestro: "aa000018-0000-0000-0000-000000000000",
  nova: "aa000019-0000-0000-0000-000000000000",
  themis: "aa000020-0000-0000-0000-000000000000",
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function authOk(req: NextRequest): boolean {
  const expected =
    process.env.OPENCLAW_CC_WEBHOOK_TOKEN ||
    process.env.OPENCLAW_GATEWAY_TOKEN ||
    "";
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7) === expected;
}

/**
 * POST — OpenClaw / automations push agent messages into CC Supabase.
 * Body: { agentId, channelId, content, attachments?: unknown[] }
 */
export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const agentId = String(body.agentId || "").toLowerCase().trim();
    const channelId = String(body.channelId || "").trim();
    const content = String(body.content || "").trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!agentId || !channelId || !content) {
      return NextResponse.json({ error: "agentId, channelId, content required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const agentUUID = AGENT_DM_UUID[agentId] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      sender_agent_id: agentUUID,
      sender_type: "agent",
      content,
      tenant_id: "11111111-1111-1111-1111-111111111111",
      attachments,
    });

    if (error) {
      console.error("[chat/webhook]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[chat/webhook]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
