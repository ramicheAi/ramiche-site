import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOpenClawGatewayConfigured, resolveChatSessionKey } from "@/lib/openclaw-gateway";
import { executeOpenClaw, streamCompletion } from "@/lib/provider-adapter";
import type { ExecutionCorrelation } from "@/lib/execution-events";
import { resolveChatTargets } from "@/lib/chat-routing";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";
import { personaMap, agentIdentityFrame } from "@/lib/agent-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * SSE chat endpoint.
 *
 * The non-streaming sibling at /api/command-center/chat orchestrates the same
 * provider chain (OpenClaw → Gemini → DeepSeek → OpenRouter) but waits for the
 * full reply before responding. This endpoint streams the reply back to the
 * UI as it is produced so users see typing instead of a 30-90s blank screen.
 *
 * Wire format (text/event-stream):
 *   event: meta            data: { agent, source, threadParentId? }
 *   event: chunk           data: { agent, delta }
 *   event: done            data: { agent, source, messageId? }
 *   event: error           data: { error }
 *
 * Single-target only. Multi-agent group fan-out still uses the non-stream
 * route — adding parallel streams to the same SSE channel would force the UI
 * to interleave on its own and isn't worth it yet.
 *
 * Behavior:
 * - When `OPENCLAW_CHAT_STRICT=1`, only OpenClaw is consulted.
 * - All persisted writes (user delivery status, agent reply row) use the
 *   service role key so RLS on `messages` cannot block them.
 */

type ReplySource = "openclaw" | "gemini" | "deepseek" | "openrouter" | "fallback";

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const AGENT_PERSONAS: Record<string, { role: string; style: string }> = personaMap();

function buildSystemPrompt(target: string, channelName: string | undefined) {
  const persona = AGENT_PERSONAS[target] || { role: "AI Agent", style: "Helpful and direct." };
  return `${agentIdentityFrame(target)}\n\nRole: ${persona.role}. Style: ${persona.style}${channelName ? `\nChannel: ${channelName}` : ""}\n\nRules:\n- Reply in plain text only.\n- Keep responses under 100 words.\n- Talk like a real person — warm, helpful, direct.\n- The user's name is Ramon. You work at Parallax.`;
}

function sseEvent(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const p03Guard = await guardProtectedMutation(req);
  if (!p03Guard.ok) return p03Guard.response;

  let body: {
    message?: string;
    channelId?: string;
    agentName?: string;
    channelName?: string;
    channelMembers?: string[];
    mentionedAgents?: string[];
    userMessageId?: string;
    threadParentId?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return new Response("message required", { status: 400 });
  }

  const targets = resolveChatTargets({
    mentionedAgents: body.mentionedAgents,
    agentName: body.agentName,
    channelMembers: body.channelMembers,
  });
  // Streaming endpoint is single-target by design.
  const target = targets[0] ?? "atlas";
  const channelId = body.channelId;
  const channelName = body.channelName;
  const userMessageId = body.userMessageId;
  // The user's message id, when the client sent one.
  const correlation: ExecutionCorrelation | undefined = userMessageId
    ? { type: "chat_message", id: userMessageId }
    : undefined;
  const threadParentId = body.threadParentId;
  const threadUuid =
    threadParentId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadParentId)
      ? threadParentId
      : undefined;

  const systemPrompt = buildSystemPrompt(target, channelName);
  const displayName = target.charAt(0).toUpperCase() + target.slice(1);
  const svc = getSupabaseService();
  const openclawStrict =
    process.env.OPENCLAW_CHAT_STRICT === "1" || process.env.OPENCLAW_CHAT_STRICT === "true";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (name: string, data: unknown) =>
        controller.enqueue(enc.encode(sseEvent(name, data)));

      const finalize = async (text: string, source: ReplySource) => {
        let agentMessageId: string | null = null;
        if (svc && channelId && text.trim()) {
          const agentUUID =
            AGENT_DM_UUID[target] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
          const { data, error } = await svc
            .from("messages")
            .insert({
              channel_id: channelId,
              sender_agent_id: agentUUID,
              sender_type: "agent",
              content: text,
              tenant_id: "11111111-1111-1111-1111-111111111111",
              attachments: [],
              status: source === "fallback" ? "failed" : "sent",
              ...(threadUuid ? { thread_parent_id: threadUuid } : {}),
            })
            .select("id")
            .single();
          if (error) {
            console.error("[chat/stream] reply insert failed:", error);
          } else if (data?.id) {
            agentMessageId = data.id as string;
          }
        }
        if (svc && userMessageId) {
          await svc
            .from("messages")
            .update({
              status: "delivered",
              delivered_at: new Date().toISOString(),
            })
            .eq("id", userMessageId);
        }
        send("done", { agent: target, source, messageId: agentMessageId });
        controller.close();
      };

      try {
        send("meta", { agent: target, displayName, threadParentId: threadUuid ?? null });

        // 1) OpenClaw — preferred. Gateway HTTP doesn't currently emit a
        //    streaming sessions_send response, so we await once and replay
        //    the result to the client as a single chunk + done. The UX is
        //    still better than the non-stream endpoint because we don't
        //    block on the unrelated provider fallbacks.
        if (isOpenClawGatewayConfigured()) {
          const sessionKey = resolveChatSessionKey(target);
          const routed = `[CC chat → ${displayName} / session ${sessionKey}]\n${systemPrompt}\n\nUser:\n${message}`;
          const gw = await executeOpenClaw({
            sessionKey,
            message: routed,
            timeoutSeconds: 90,
            context: { agentId: target, purpose: "chat-stream", correlation },
          });
          if (gw.ok) {
            send("chunk", { agent: target, delta: gw.text });
            await finalize(gw.text, "openclaw");
            return;
          }
          if (openclawStrict) {
            send("error", {
              error: gw.error,
              source: "openclaw",
            });
            controller.close();
            return;
          }
        }

        // 2) Gemini streaming
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey) {
          let acc = "";
          try {
            const s = streamCompletion({
              provider: "gemini",
              apiKey: geminiKey,
              systemPrompt,
              userMessage: message,
              context: { agentId: target, purpose: "chat-stream", correlation },
            });
            for await (const delta of s.deltas) {
              acc += delta;
              send("chunk", { agent: target, delta });
            }
          } catch (err) {
            console.error("[chat/stream] gemini error:", err);
          }
          if (acc.trim()) {
            await finalize(acc, "gemini");
            return;
          }
        }

        // 3) DeepSeek streaming
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        if (deepseekKey) {
          let acc = "";
          try {
            const s = streamCompletion({
              provider: "deepseek",
              apiKey: deepseekKey,
              systemPrompt,
              userMessage: message,
              context: { agentId: target, purpose: "chat-stream", correlation },
            });
            for await (const delta of s.deltas) {
              acc += delta;
              send("chunk", { agent: target, delta });
            }
          } catch (err) {
            console.error("[chat/stream] deepseek error:", err);
          }
          if (acc.trim()) {
            await finalize(acc, "deepseek");
            return;
          }
        }

        // 4) OpenRouter streaming
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        if (openrouterKey) {
          let acc = "";
          try {
            const s = streamCompletion({
              provider: "openrouter",
              apiKey: openrouterKey,
              systemPrompt,
              userMessage: message,
              context: { agentId: target, purpose: "chat-stream", correlation },
            });
            for await (const delta of s.deltas) {
              acc += delta;
              send("chunk", { agent: target, delta });
            }
          } catch (err) {
            console.error("[chat/stream] openrouter error:", err);
          }
          if (acc.trim()) {
            await finalize(acc, "openrouter");
            return;
          }
        }

        // Nothing worked.
        send("error", {
          error:
            "All chat providers failed or are not configured (OpenClaw, Gemini, DeepSeek, OpenRouter).",
          source: "fallback",
        });
        controller.close();
      } catch (err) {
        console.error("[chat/stream] fatal:", err);
        send("error", { error: String(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
