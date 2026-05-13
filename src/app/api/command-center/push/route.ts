import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.CC_PUSH_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-cc-push-secret") ?? req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token === expected;
}

interface PushBody {
  agentId?: string;
  channelId?: string;
  threadParentId?: string;
  content?: string;
  type?: "message" | "broadcast" | "alert";
  speak?: boolean;
}

/**
 * Inbound agent push webhook.
 *
 * Lets an agent (or any external system that holds CC_PUSH_SECRET) deliver a
 * proactive message into a Command Center channel without going through the
 * gateway round-trip. The message is inserted with sender_type='agent' so the
 * existing Supabase realtime subscription in `/command-center/chat` renders it
 * inline. `speak=true` is broadcast over a 'cc-push' realtime channel so the
 * layout-level toast can offer instant voice playback.
 *
 * Auth: requires `x-cc-push-secret` header (or `Authorization: Bearer <secret>`)
 *       matching `process.env.CC_PUSH_SECRET`.
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: PushBody;
  try {
    body = (await req.json()) as PushBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const agentId = (body.agentId ?? "").trim().toLowerCase();
  const content = (body.content ?? "").trim();
  if (!agentId || !content) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", required: ["agentId", "content"] },
      { status: 400 }
    );
  }
  if (content.length > 8000) {
    return NextResponse.json({ ok: false, error: "content_too_long" }, { status: 400 });
  }

  let channelId = (body.channelId ?? "").trim();
  if (!channelId) {
    const normalized = agentId === "dr-strange" ? "drstrange" : agentId;
    const dm = AGENT_DM_UUID[normalized];
    if (!dm) {
      return NextResponse.json(
        { ok: false, error: "no_channel_or_dm_resolved", agentId },
        { status: 400 }
      );
    }
    channelId = dm;
  }
  if (!UUID_RE.test(channelId)) {
    return NextResponse.json({ ok: false, error: "bad_channel_id" }, { status: 400 });
  }

  const threadParentId = (body.threadParentId ?? "").trim() || null;
  if (threadParentId && !UUID_RE.test(threadParentId)) {
    return NextResponse.json({ ok: false, error: "bad_thread_parent_id" }, { status: 400 });
  }

  const svc = getSupabaseService();
  if (!svc) {
    return NextResponse.json(
      { ok: false, error: "no_service_role" },
      { status: 503 }
    );
  }

  const insert = {
    tenant_id: TENANT_ID,
    channel_id: channelId,
    sender_type: "agent" as const,
    sender_agent_id: agentId,
    content,
    thread_parent_id: threadParentId,
  };

  const { data, error } = await svc
    .from("messages")
    .insert(insert)
    .select("id, channel_id, content, sender_type, sender_agent_id, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 }
    );
  }

  if (body.speak) {
    try {
      const ch = svc.channel("cc-push");
      await ch.send({
        type: "broadcast",
        event: "agent.speak",
        payload: {
          messageId: data.id,
          channelId: data.channel_id,
          agentId: data.sender_agent_id,
          content: data.content,
          createdAt: data.created_at,
        },
      });
    } catch {
      /* broadcast best-effort */
    }
  }

  return NextResponse.json({
    ok: true,
    message: {
      id: data.id,
      channelId: data.channel_id,
      agentId: data.sender_agent_id,
      content: data.content,
      createdAt: data.created_at,
    },
    speakRequested: !!body.speak,
  });
}

/** Health check (no auth) so callers can verify the endpoint exists. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/command-center/push",
    requires: ["x-cc-push-secret OR Authorization: Bearer", "agentId", "content"],
    optional: ["channelId", "threadParentId", "speak"],
    configured: !!process.env.CC_PUSH_SECRET,
    serviceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
