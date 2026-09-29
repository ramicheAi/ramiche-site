import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { guardServiceCaller } from "@/lib/server/service-caller";
import { pushSignature } from "@/lib/server/cockpit-chat-data";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
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
 * inline. `speak=true` is stored as metadata.speak and delivered to the owner's
 * layout-level toast through the owner-only SSE relay (P05-B2). It is no longer
 * broadcast on the public `cc-push` Realtime channel, which any anon-key holder
 * could subscribe to.
 *
 * Auth (P05-B2): machine only, `x-cc-push-secret` matching CC_PUSH_SECRET via
 *       guardServiceCaller("push"). The P03 owner-session requirement is removed
 *       (agents have no browser session); the Authorization: Bearer form is no longer accepted.
 */
export async function POST(req: NextRequest) {
  const p03Guard = await guardServiceCaller(req, "push");
  if (!p03Guard.ok) return p03Guard.response;

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

  // Lowercase: Postgres returns uuids in lowercase, and the push signature must match the stored row.
  let channelId = (body.channelId ?? "").trim().toLowerCase();
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

  // Pre-allocated so the push signature can bind to this exact row.
  const rowId = randomUUID();
  const pushTs = Date.now();
  const insert = {
    id: rowId,
    tenant_id: TENANT_ID,
    channel_id: channelId,
    sender_type: "agent" as const,
    // messages.sender_agent_id is a uuid column: store the agent's UUID (same map the
    // chat webhook uses) and keep the short name in metadata. Before P05-B2 the short
    // name went here and every push insert failed with a uuid syntax error.
    sender_agent_id: AGENT_DM_UUID[agentId === "dr-strange" ? "drstrange" : agentId] ?? null,
    content,
    thread_parent_id: threadParentId,
    // P05-B2: the speak request travels with the row. The owner-only SSE relay
    // (chat/events?scope=push) delivers it; nothing is broadcast on a public channel.
    metadata: {
      source: "cc-push",
      speak: !!body.speak,
      agentId,
      // Proof for the owner SSE relay that this row came through this authenticated route.
      ...(body.speak ? { pushTs, pushSig: pushSignature(rowId, channelId, agentId, content, pushTs) } : {}),
    },
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

  return NextResponse.json({
    ok: true,
    message: {
      id: data.id,
      channelId: data.channel_id,
      agentId,
      content: data.content,
      createdAt: data.created_at,
    },
    speakRequested: !!body.speak,
  });
}

/** Health check (no auth) so callers can verify the endpoint exists. */
export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;

  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/command-center/push",
    requires: ["x-cc-push-secret", "agentId", "content"],
    optional: ["channelId", "threadParentId", "speak"],
    configured: !!process.env.CC_PUSH_SECRET,
    serviceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
