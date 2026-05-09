import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  gatewaySessionsSend,
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
} from "@/lib/openclaw-gateway";
import { resolveChatTargets } from "@/lib/chat-routing";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

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

const GEMINI_STREAM_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const AGENT_PERSONAS: Record<string, { role: string; style: string }> = {
  atlas: { role: "Operations Lead & Strategic Command", style: "Calm, sharp, direct. Systems thinker." },
  triage: { role: "Debugging & Log Analysis", style: "Methodical, detail-oriented. Asks clarifying questions." },
  shuri: { role: "Frontend Engineering & Code Generation", style: "Fast-moving, practical. Code-first answers." },
  proximon: { role: "Systems Architecture & Infrastructure", style: "Thoughtful, architectural. Considers scale." },
  aetherion: { role: "Creative Director & Visual Design", style: "Visionary, aesthetic-focused. Thinks in imagery." },
  simons: { role: "Data Analysis & Quantitative Strategy", style: "Numbers-driven, precise. Evidence-based." },
  mercury: { role: "Sales Strategy & Revenue", style: "Persuasive, results-oriented. Revenue-focused." },
  vee: { role: "Brand Strategy & Marketing", style: "Brand-aware, strategic. Audience-first thinking." },
  ink: { role: "Copywriting & Content Creation", style: "Creative writer, concise. Words matter." },
  echo: { role: "Community Engagement & Social", style: "Friendly, community-minded. Engagement-focused." },
  haven: { role: "Support & Client Onboarding", style: "Warm, helpful, patient. Customer success." },
  widow: { role: "Cybersecurity & Threat Analysis", style: "Vigilant, security-first. Trust nothing." },
  drstrange: { role: "Strategic Forecasting & Scenarios", style: "Forward-looking, probabilistic. Maps futures." },
  kiyosaki: { role: "Financial Strategy & Capital", style: "Wealth-minded, asset-focused. Cash flow thinking." },
  michael: { role: "Swim Coaching & Athlete Development", style: "Motivating, technical. Performance-driven." },
  selah: { role: "Psychology & Wellness", style: "Empathetic, insightful. Mental performance." },
  prophets: { role: "Spiritual Counsel & Wisdom", style: "Thoughtful, grounded in faith. Purpose-driven." },
  themaestro: { role: "Music Production & Audio", style: "Creative, technical. Sound-obsessed." },
  nova: { role: "3D Fabrication & Overnight Builds", style: "Maker mindset, iterative. Build-test-iterate." },
  themis: { role: "Legal, Governance & Compliance", style: "Precise, careful. Risk-aware." },
};

function buildSystemPrompt(target: string, channelName: string | undefined) {
  const persona = AGENT_PERSONAS[target] || { role: "AI Agent", style: "Helpful and direct." };
  const displayName = target.charAt(0).toUpperCase() + target.slice(1);
  return `You are ${displayName}. Role: ${persona.role}. Style: ${persona.style}${channelName ? `\nChannel: ${channelName}` : ""}\n\nRules:\n- Reply in plain text only.\n- Keep responses under 100 words.\n- Talk like a real person — warm, helpful, direct.\n- The user's name is Ramon. You work at Parallax.`;
}

function sseEvent(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function* geminiStream(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${GEMINI_STREAM_URL}&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok || !res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const txt = j.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) yield txt;
      } catch {
        /* ignore partial */
      }
    }
  }
}

async function* openaiStyleStream(
  url: string,
  headers: Record<string, string>,
  bodyJson: Record<string, unknown>
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ ...bodyJson, stream: true }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok || !res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const txt = j.choices?.[0]?.delta?.content;
        if (txt) yield txt;
      } catch {
        /* ignore */
      }
    }
  }
}

export async function POST(req: NextRequest) {
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
          const gw = await gatewaySessionsSend(sessionKey, routed, 90);
          if (gw.ok && gw.reply) {
            send("chunk", { agent: target, delta: gw.reply });
            await finalize(gw.reply, "openclaw");
            return;
          }
          if (openclawStrict) {
            send("error", {
              error:
                !gw.ok && "error" in gw
                  ? gw.error
                  : "OpenClaw gateway did not return a reply",
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
            for await (const delta of geminiStream(systemPrompt, message, geminiKey)) {
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
            for await (const delta of openaiStyleStream(
              DEEPSEEK_URL,
              { Authorization: `Bearer ${deepseekKey}` },
              {
                model: "deepseek-chat",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: message },
                ],
                max_tokens: 500,
                temperature: 0.7,
              }
            )) {
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
            for await (const delta of openaiStyleStream(
              OPENROUTER_URL,
              {
                Authorization: `Bearer ${openrouterKey}`,
                "HTTP-Referer": "https://ramiche-site.vercel.app",
                "X-Title": "Parallax Command Center",
              },
              {
                model: "anthropic/claude-sonnet-4",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: message },
                ],
                max_tokens: 500,
                temperature: 0.7,
              }
            )) {
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
