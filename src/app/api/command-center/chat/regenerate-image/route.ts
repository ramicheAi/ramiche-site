/**
 * Regenerate a single image inline.
 *
 * Workflow: Ramon hovers an agent-generated image, clicks 🔁, and a fresh
 * variant of the same prompt is rendered + posted to the channel as a new
 * agent message. The agent never has to be in the loop — we skip the chat
 * turn and call image-gen directly. The new render uses the same prompt so
 * stylistic continuity is preserved; only the seed/sampling drift.
 *
 * POST body: { prompt, agentId, channelId, threadParentId? }
 *
 * Response: { ok, messageId, url, attachment, error? }
 *
 * Why a dedicated endpoint instead of @-mentioning the agent again:
 *   - No chat-turn latency (no LLM round-trip; just image-gen)
 *   - No noise in the channel from the agent re-acknowledging the request
 *   - Atomic UX: one button → one new image bubble
 *   - Channel cost stays minimal (one image-gen call vs full agent dispatch)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";
import { processImageMarkers } from "@/lib/image-gen/markers";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  return raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "") || undefined;
}

function getSupabaseService() {
  const url = cleanEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

export async function POST(req: NextRequest) {
  let body: {
    prompt?: string;
    agentId?: string;
    channelId?: string;
    threadParentId?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  const agentId = body.agentId?.trim().toLowerCase();
  const channelId = body.channelId?.trim();
  const threadParentId = body.threadParentId?.trim();

  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt required" }, { status: 400 });
  }
  if (!agentId) {
    return NextResponse.json({ ok: false, error: "agentId required" }, { status: 400 });
  }
  if (!channelId || !UUID_RE.test(channelId)) {
    return NextResponse.json({ ok: false, error: "channelId must be uuid" }, { status: 400 });
  }
  const threadUuid =
    threadParentId && UUID_RE.test(threadParentId) ? threadParentId : undefined;

  const svc = getSupabaseService();
  if (!svc) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role not configured" },
      { status: 500 }
    );
  }

  // Use the SAME marker processor the chat route uses so behaviour is
  // identical (same friendly filenames, same upload path, same metadata).
  const synthetic = `[GENERATE_IMAGE: ${prompt}]`;
  const processed = await processImageMarkers(synthetic, agentId);
  if (processed.attachments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "image-gen returned no attachments — provider failed or key missing" },
      { status: 502 }
    );
  }
  const attachment = processed.attachments[0];

  // Post a fresh message into the channel from the owner agent.
  const ownerUUID = AGENT_DM_UUID[agentId] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const { data: insertedRow, error: insertErr } = await svc
    .from("messages")
    .insert({
      channel_id: channelId,
      sender_agent_id: ownerUUID,
      sender_type: "agent",
      content: `*Regenerated:* ${attachment.name}`,
      tenant_id: TENANT_ID,
      attachments: processed.attachments,
      status: "sent",
      metadata: {
        kind: "regenerated_image",
        regenerated_from_prompt: prompt,
        generated_image_count: 1,
      },
      ...(threadUuid ? { thread_parent_id: threadUuid } : {}),
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[regenerate-image] insert failed:", insertErr);
    return NextResponse.json(
      { ok: false, error: `insert failed: ${insertErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: insertedRow?.id ?? null,
    url: attachment.url,
    attachment,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    accepts: ["POST"],
    requires: ["prompt", "agentId", "channelId"],
  });
}
