import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOpenClawGatewayConfigured, resolveChatSessionKey } from "@/lib/openclaw-gateway";
import { executeOpenClaw, streamCompletion } from "@/lib/provider-adapter";
import type { ExecutionCorrelation } from "@/lib/execution-events";
import { resolveChatTargets } from "@/lib/chat-routing";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";
import { personaMap } from "@/lib/agent-registry";
import { sanitizeDbError } from "@/lib/chat-persistence";
import { ownerOnly } from "@/lib/server/command-center-guard";
import {
  claimRelayDispatch,
  describeDuplicate,
  markRelayStatus,
  statusAfterEmptyDispatch,
  statusAfterTurn,
} from "@/lib/relay-dispatch";

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
 *   event: persist_error   data: { agent, message }   (only when the write failed)
 *   event: done            data: { agent, source, messageId?, persisted }
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
  const displayName = target.charAt(0).toUpperCase() + target.slice(1);
  return `You are ${displayName}. Role: ${persona.role}. Style: ${persona.style}${channelName ? `\nChannel: ${channelName}` : ""}\n\nRules:\n- Reply in plain text only.\n- Keep responses under 100 words.\n- Talk like a real person — warm, helpful, direct.\n- The user's name is Ramon. You work at Parallax.`;
}

function sseEvent(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function POST_handler(req: NextRequest) {
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

      // This route dispatches the same persisted message as /api/command-center/chat, so it must
      // take the same claim. Without it, this endpoint was a callable bypass around the relay:
      // the same message id could be dispatched twice with no dedup at all.
      let claimAttempt: number | null = null;
      let relaySettled = false;
      const settleRelay = async (status: "delivered" | "failed" | "unknown") => {
        if (relaySettled || !svc || !userMessageId) return;
        relaySettled = true;
        await markRelayStatus(svc, userMessageId, status, claimAttempt);
      };

      const finalize = async (text: string, source: ReplySource) => {
        let agentMessageId: string | null = null;
        let persisted = false;
        let persistError: string | null = null;
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
            persistError = sanitizeDbError(error).message;
          } else if (data?.id) {
            agentMessageId = data.id as string;
            persisted = true;
          } else {
            // No error and no id: never claim a message that cannot be found.
            console.error("[chat/stream] reply insert returned no id");
            persistError = "insert returned no row id";
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
        // The turn ran, so the relay must not stay 'claimed'. 'delivered' means the reply is on
        // disk. If it could not be saved (or no channelId was supplied, so there was nowhere to
        // save it), the turn ran but the outcome was not recorded: 'unknown', not 'failed', which
        // would assert the turn never ran. Both are retryable.
        // A reply that could not be saved is not a delivery. No channelId means there was nowhere
        // to save it, which is the same outcome, not a configuration success.
        await settleRelay(
          statusAfterTurn({ ok: persisted, attempted: svc && channelId ? 1 : 0 })
        );
        // Surfaced BEFORE done so a client cannot mistake an unsaved reply for a
        // persisted one. The text is still sent as chunks above; it just has to
        // be shown as unsaved until a reload confirms otherwise.
        if (persistError) {
          send("persist_error", { agent: target, message: persistError });
        }
        send("done", { agent: target, source, messageId: agentMessageId, persisted });
        controller.close();
      };

      try {
        send("meta", { agent: target, displayName, threadParentId: threadUuid ?? null });

        if (svc && userMessageId) {
          const claim = await claimRelayDispatch(svc, userMessageId);
          if (claim.state === "claimed") {
            claimAttempt = claim.attempt;
          } else if (claim.state === "duplicate") {
            // Same contract as the JSON route, from the same decision function: only a genuine
            // prior delivery is reported as already dispatched, and `retryable` is never true for
            // a terminal state. It used to be `status !== "failed_permanent"`, which told the
            // client to retry a `legacy` row that can never be claimed again.
            const dup = describeDuplicate(claim.status);
            if (dup.alreadyDispatched) {
              send("done", { agent: target, source: "relay", alreadyDispatched: true, persisted: true });
            } else {
              send("error", {
                error: "dispatch_in_progress_or_failed",
                detail: dup.detail,
                relayStatus: claim.status,
                retryable: dup.retryable,
              });
            }
            controller.close();
            return;
          }
        }

        // Did anything actually get sent? Only a run where nothing was attempted is a verified
        // non-delivery. Any attempt may have reached the agent.
        let attempted = false;

        // 1) OpenClaw — preferred. Gateway HTTP doesn't currently emit a
        //    streaming sessions_send response, so we await once and replay
        //    the result to the client as a single chunk + done. The UX is
        //    still better than the non-stream endpoint because we don't
        //    block on the unrelated provider fallbacks.
        if (isOpenClawGatewayConfigured()) {
          attempted = true;
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
            // A gateway error is ambiguous (it may have accepted the turn and failed to report),
            // so this is 'unknown', never 'failed'. statusAfterEmptyDispatch(true) says exactly
            // that, and the 'attempted' flag is already true on this path.
            await settleRelay(statusAfterEmptyDispatch(true));
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
          attempted = true;
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
          attempted = true;
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
          attempted = true;
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

        // Nothing worked. If a provider was attempted, its failure is ambiguous (an error string
        // cannot prove the turn did not run), so this is unknown. Only a run where nothing was even
        // tried is a verified non-delivery.
        await settleRelay(statusAfterEmptyDispatch(attempted));
        send("error", {
          error:
            "All chat providers failed or are not configured (OpenClaw, Gemini, DeepSeek, OpenRouter).",
          source: "fallback",
        });
        controller.close();
      } catch (err) {
        console.error("[chat/stream] fatal:", err);
        // Ambiguous: the gateway may already have run the turn before this threw. Recording
        // 'failed' here would assert a non-delivery we cannot prove.
        await settleRelay("unknown");
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

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const POST = ownerOnly(POST_handler);
