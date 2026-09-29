import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { telegramAttachApproveButton } from "@/lib/telegram-cc-bot";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

export const dynamic = "force-dynamic";


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
 *
 * Body:
 *   { agentId, channelId, content, attachments?: unknown[]
 *     metadata?: Record<string, unknown>   // e.g. kind "synthesis" + plan for Phase C
 *     telegramChatId?: number              // Telegram chat id (numeric)
 *     telegramMessageId?: number           // message_id of the bot message Atlas sent
 *   }
 *
 * When metadata.kind === "synthesis" and telegram ids are present, calls
 * Telegram Bot API editMessageReplyMarkup to add [Approve & dispatch]
 * (requires TELEGRAM_BOT_TOKEN). Wire OpenClaw to POST here after sendMessage.
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
    const metadataRaw =
      body.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, unknown>)
        : undefined;

    if (!agentId || !channelId || !content) {
      return NextResponse.json({ error: "agentId, channelId, content required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const agentUUID = AGENT_DM_UUID[agentId] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    const insertPayload: Record<string, unknown> = {
      channel_id: channelId,
      sender_agent_id: agentUUID,
      sender_type: "agent",
      content,
      tenant_id: "11111111-1111-1111-1111-111111111111",
      attachments,
    };
    if (metadataRaw && Object.keys(metadataRaw).length > 0) {
      insertPayload.metadata = metadataRaw;
    }

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[chat/webhook]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rowId = inserted?.id as string | undefined;
    const tgChat =
      body.telegramChatId !== undefined && body.telegramChatId !== null
        ? Number(body.telegramChatId)
        : NaN;
    const tgMsg =
      body.telegramMessageId !== undefined && body.telegramMessageId !== null
        ? Number(body.telegramMessageId)
        : NaN;

    if (
      rowId &&
      metadataRaw?.kind === "synthesis" &&
      metadataRaw.plan &&
      typeof metadataRaw.plan === "object" &&
      Number.isFinite(tgChat) &&
      Number.isFinite(tgMsg)
    ) {
      const mergedTelegram = {
        ...metadataRaw,
        telegram: {
          chat_id: tgChat,
          message_id: tgMsg,
          ...(typeof metadataRaw.telegram === "object" && metadataRaw.telegram !== null
            ? (metadataRaw.telegram as Record<string, unknown>)
            : {}),
        },
      };
      await supabase.from("messages").update({ metadata: mergedTelegram }).eq("id", rowId);

      const att = await telegramAttachApproveButton(tgChat, tgMsg, rowId);
      if (!att.ok) {
        console.error("[chat/webhook] telegram attach failed:", att.error);
      }
    }

    return NextResponse.json({ ok: true, id: rowId });
  } catch (e) {
    console.error("[chat/webhook]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
