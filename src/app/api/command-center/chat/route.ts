import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  gatewaySessionsSend,
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
} from "@/lib/openclaw-gateway";
import { resolveChatTargets } from "@/lib/chat-routing";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lightweight reachability probe. The Command Center health dashboard pings
// every API endpoint to render service uptime; without this, the chat route
// would return 405 to those GET pings and clutter the browser console with
// red "method not allowed" errors despite the service being healthy.
export async function GET() {
  return NextResponse.json({ ok: true, accepts: ["POST"] });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

/**
 * Architecture: Ramon's Parallax stack only uses two backends for chat —
 *   1. Claude Max proxy — OpenAI-compatible bridge to his Claude Max
 *                          subscription (no API spend). Default URL
 *                          http://127.0.0.1:3456/v1/chat/completions.
 *   2. LM Studio       — locally loaded models, OpenAI-compatible server
 *                          exposed by LM Studio's "Local Server" tab.
 *                          Default URL http://127.0.0.1:1234/v1/chat/completions.
 *                          Used as fallback when the Claude proxy is down.
 * No cloud LLM APIs (Gemini, DeepSeek, OpenRouter, OpenAI direct). OpenClaw
 * gateway `sessions_send` is kept for future agent-orchestration but is
 * opt-in via OPENCLAW_CHAT_PRIMARY=1 because the Mac gateway is flaky.
 */
const CLAUDE_MAX_DEFAULT_URL = "http://127.0.0.1:3456/v1/chat/completions";
const LM_STUDIO_DEFAULT_URL = "http://127.0.0.1:1234/v1/chat/completions";

/**
 * Trim whitespace + ALL control chars (incl. trailing \n / \r) from an env
 * value. Vercel's env-vars UI occasionally stores values pasted from a
 * terminal or chat app with a trailing newline; node's strict fetch then
 * rejects the resulting Authorization header / URL with "Invalid header
 * value" and every provider call silently fails. cleanEnv() is the single
 * choke-point so a malformed secret can never break the chat again.
 */
function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "");
  return cleaned || undefined;
}

/** Per-agent Claude model tier. ATLAS gets Opus (orchestrator). Specialists
 *  that do real reasoning get Sonnet. Lightweight assistants (TRIAGE, NOVA,
 *  community/social agents) get Haiku for speed + cost. Tier overrideable
 *  via env: CC_CLAUDE_MODEL_ATLAS, CC_CLAUDE_MODEL_DEFAULT, etc. */
const AGENT_MODEL_TIER: Record<string, "opus" | "sonnet" | "haiku"> = {
  atlas: "opus",
  themis: "sonnet",
  drstrange: "sonnet",
  simons: "sonnet",
  kiyosaki: "sonnet",
  proximon: "sonnet",
  widow: "sonnet",
  shuri: "sonnet",
  aetherion: "sonnet",
  selah: "sonnet",
  prophets: "sonnet",
  michael: "haiku",
  themaestro: "haiku",
  mercury: "haiku",
  vee: "haiku",
  ink: "haiku",
  echo: "haiku",
  haven: "haiku",
  nova: "haiku",
  triage: "haiku",
};

function modelForAgent(agentId: string): string {
  const tier = AGENT_MODEL_TIER[agentId.toLowerCase()] ?? "sonnet";
  const overrideOpus = cleanEnv("CC_CLAUDE_MODEL_OPUS");
  const overrideSonnet = cleanEnv("CC_CLAUDE_MODEL_SONNET");
  const overrideHaiku = cleanEnv("CC_CLAUDE_MODEL_HAIKU");
  if (tier === "opus") return overrideOpus || "claude-opus-4-6";
  if (tier === "sonnet") return overrideSonnet || "claude-sonnet-4-6";
  return overrideHaiku || "claude-haiku-4-5";
}

/** LM Studio loads whatever model the user has selected in the desktop app,
 *  and that model id is what /v1/chat/completions expects. When this env is
 *  unset we omit the field and most LM Studio builds respond with the active
 *  loaded model regardless; setting CC_LMSTUDIO_MODEL pins a specific one. */
function modelForLMStudio(): string | undefined {
  return cleanEnv("CC_LMSTUDIO_MODEL");
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

/**
 * Service role — used for ALL server-side inserts and updates so RLS on the
 * messages table can't reject agent replies or delivery-status writes.
 * The anon key is intentionally unused here.
 */
function getSupabaseService() {
  const url = cleanEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isGroupNoResponse(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return /^\[NO_RESPONSE\]/i.test(t);
}

type ReplySource = "openclaw" | "claude-max" | "lm-studio" | "fallback";

/** Per-provider attempt diagnostic. Surfaced in the 502 payload + server logs
 *  so every "all providers failed" event has the exact failure reasons. */
type ProviderAttempt = {
  provider: Exclude<ReplySource, "fallback">;
  /** "skipped" → key not set; "ok" → returned a reply; "error" → tried but failed */
  status: "skipped" | "ok" | "error";
  /** HTTP status when available, "exception" for thrown errors */
  detail?: string;
};

async function generateAgentReply(
  target: string,
  userMessage: string,
  channelName: string | undefined,
  groupMode: boolean,
  singleTargetStrict: boolean,
  groupRoster: string[]
): Promise<{
  text: string;
  source: ReplySource;
  openClawError?: string;
  attempts: ProviderAttempt[];
}> {
  const persona = AGENT_PERSONAS[target] || { role: "AI Agent", style: "Helpful and direct." };
  const displayName = target.charAt(0).toUpperCase() + target.slice(1);
  // Group mode = multi-agent channel. Each member must contribute from their
  // own domain so Ramon gets a coordinated multi-perspective answer (the whole
  // point of group chats). We previously told agents to stay silent unless
  // "relevant" — but every specialist is relevant from their angle, and the
  // result was Atlas talking alone. Now every agent participates with a tight,
  // role-specific take. The [NO_RESPONSE] filter below is kept as a graceful
  // catch for older models that still emit it.
  const otherMembers = groupRoster
    .filter((id) => id.toLowerCase() !== target.toLowerCase())
    .map((id) => `@${id}`);
  const rosterLine = otherMembers.length > 0 ? otherMembers.join(", ") : "(no one else)";
  // pick a sensible default hand-off target for the example below
  const handoffExample = otherMembers[0] ?? "@atlas";
  const groupRules = groupMode
    ? `\n\nYou are in a shared channel with these agents: ${rosterLine}. Every agent contributes — including you. Ramon is asking the room, not just one of you.\n\nHow to participate:\n1. Open with ONE short sentence (max ~15 words) framing your take from YOUR role only — do NOT speak for other agents.\n2. Stay strictly in your lane: ${persona.role}. If the question barely touches your domain, give one short observation from that angle anyway (e.g. "From a ${persona.role.toLowerCase()} angle, …"). Never go silent.\n3. Don't repeat what another agent would obviously say. Add the angle only YOU can bring.\n4. If you need another agent to handle a piece, name them, e.g. "${handoffExample} should take the build." Keep it short.\n5. Total reply ≤ 60 words. Crisp. No headers, no bullets unless absolutely needed.`
    : "";

  const systemPrompt = `You are ${displayName}. Role: ${persona.role}. Style: ${persona.style}${channelName ? `\nChannel: ${channelName}` : ""}${groupRules}\n\nRules:\n- Reply in plain text only. No timestamps, no metadata, no brackets, no system tags.\n- Keep ${groupMode ? "your reply under 60 words" : "responses under 100 words"}. Be concise and natural.\n- Talk like a real person — warm, helpful, direct.\n- The user's name is Ramon. You work at Parallax.`;

  let agentResponse: string | null = null;
  let responseSource: ReplySource = "fallback";
  const attempts: ProviderAttempt[] = [];

  // OpenClaw `sessions_send` is opt-in (OPENCLAW_CHAT_PRIMARY=1) because
  // the Mac gateway has a known timeout issue (see project rules). Kept here
  // so when Ramon wires real OpenClaw agent orchestration he can flip the
  // switch without re-deploying. Default chat path goes straight to
  // Claude Max proxy + LM Studio.
  const openclawPrimary =
    process.env.OPENCLAW_CHAT_PRIMARY === "1" ||
    process.env.OPENCLAW_CHAT_PRIMARY === "true";
  const openclawStrict =
    singleTargetStrict &&
    (process.env.OPENCLAW_CHAT_STRICT === "1" || process.env.OPENCLAW_CHAT_STRICT === "true");

  if (openclawPrimary && isOpenClawGatewayConfigured()) {
    const sessionKey = resolveChatSessionKey(target);
    const routed = `[CC chat → ${displayName} / session ${sessionKey}]\n${systemPrompt}\n\nUser:\n${userMessage}`;
    const gw = await gatewaySessionsSend(sessionKey, routed, 90);
    if (gw.ok && gw.reply) {
      agentResponse = gw.reply;
      responseSource = "openclaw";
      attempts.push({ provider: "openclaw", status: "ok" });
    } else {
      attempts.push({
        provider: "openclaw",
        status: "error",
        detail: !gw.ok && "error" in gw ? gw.error : "no reply",
      });
      if (openclawStrict) {
        return {
          text: "",
          source: "openclaw",
          openClawError:
            !gw.ok && "error" in gw ? gw.error : "OpenClaw gateway did not return a reply",
          attempts,
        };
      }
    }
  } else {
    attempts.push({
      provider: "openclaw",
      status: "skipped",
      detail: openclawPrimary ? "gateway not configured" : "OPENCLAW_CHAT_PRIMARY != 1",
    });
  }

  // ── Claude Max proxy (primary). OpenAI-compatible.
  //    Locally  : Ramon's Claude Max bridge at http://127.0.0.1:3456 (no token).
  //    Publicly : token-auth proxy at https://claude.parallaxvinc.com (port 9999
  //               behind cloudflared) so Vercel-hosted parallaxvinc.com can also
  //               reach the same Claude Max subscription.
  //    CLAUDE_MAX_PROXY_TOKEN is sent as Bearer when set; if empty we fall
  //    back to "not-needed" which the local bridge accepts.
  const claudeUrl = cleanEnv("CLAUDE_MAX_PROXY_URL") || CLAUDE_MAX_DEFAULT_URL;
  const claudeToken = cleanEnv("CLAUDE_MAX_PROXY_TOKEN") || "not-needed";
  if (!agentResponse) {
    try {
      const res = await fetch(claudeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${claudeToken}`,
        },
        body: JSON.stringify({
          model: modelForAgent(target),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) {
        const data = await res.json();
        agentResponse = data.choices?.[0]?.message?.content || null;
        if (agentResponse) {
          responseSource = "claude-max";
          attempts.push({ provider: "claude-max", status: "ok" });
        } else {
          attempts.push({ provider: "claude-max", status: "error", detail: "empty choices" });
        }
      } else {
        const body = await res.text().catch(() => "");
        attempts.push({
          provider: "claude-max",
          status: "error",
          detail: `HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        });
      }
    } catch (err) {
      attempts.push({
        provider: "claude-max",
        status: "error",
        detail: `exception: ${err instanceof Error ? err.message : err}`,
      });
      console.error("[chat] Claude Max proxy error:", err);
    }
  }

  // ── LM Studio (fallback). Loaded model whatever the user picked in the
  //    LM Studio "Local Server" tab. Used only if Claude Max proxy fails.
  const lmStudioUrl = cleanEnv("LM_STUDIO_URL") || LM_STUDIO_DEFAULT_URL;
  if (!agentResponse) {
    try {
      const lmModel = modelForLMStudio();
      const lmBody: Record<string, unknown> = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 300,
        temperature: 0.7,
      };
      if (lmModel) lmBody.model = lmModel;
      const res = await fetch(lmStudioUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lmBody),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = await res.json();
        agentResponse = data.choices?.[0]?.message?.content || null;
        if (agentResponse) {
          responseSource = "lm-studio";
          attempts.push({ provider: "lm-studio", status: "ok" });
        } else {
          attempts.push({ provider: "lm-studio", status: "error", detail: "empty choices" });
        }
      } else {
        const body = await res.text().catch(() => "");
        attempts.push({
          provider: "lm-studio",
          status: "error",
          detail: `HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        });
      }
    } catch (err) {
      // Most common: LM Studio's Local Server isn't started → ECONNREFUSED.
      // We treat this as a soft skip so it doesn't dominate the diagnostic.
      const msg = err instanceof Error ? err.message : String(err);
      const econnrefused = /ECONNREFUSED|fetch failed/i.test(msg);
      attempts.push({
        provider: "lm-studio",
        status: econnrefused ? "skipped" : "error",
        detail: econnrefused
          ? "LM Studio Local Server not running (start it in LM Studio → Local Server tab)"
          : `exception: ${msg}`,
      });
    }
  }

  if (!agentResponse) {
    console.error(`[chat] all providers failed for ${target}:`, JSON.stringify(attempts));
    // We deliberately do NOT mint a soothing "temporarily unavailable" line
    // here. The chat UI now shows the real attempt log so Ramon sees exactly
    // which backend died and why. The `responseSource` stays "fallback" so
    // the POST handler returns 502 instead of pretending everything is fine.
    agentResponse = "";
    responseSource = "fallback";
  }

  return { text: agentResponse, source: responseSource, attempts };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      channelId,
      agentName,
      channelName,
      channelMembers,
      mentionedAgents,
      userMessageId,
      threadParentId,
    } = body as {
      message?: string;
      channelId?: string;
      agentName?: string;
      channelName?: string;
      channelMembers?: string[];
      mentionedAgents?: string[];
      /** Supabase UUID of the user row — mark delivered after relay completes */
      userMessageId?: string;
      /** When set, agent replies are stored as thread children of this message */
      threadParentId?: string;
    };

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const threadUuid =
      threadParentId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadParentId)
        ? threadParentId
        : undefined;

    const targets = resolveChatTargets({ mentionedAgents, agentName, channelMembers });
    const groupMode = targets.length > 1;
    const singleTargetStrict = targets.length === 1;

    const results = await Promise.allSettled(
      targets.map((target) =>
        generateAgentReply(
          target,
          message,
          channelName,
          groupMode,
          singleTargetStrict,
          targets
        )
      )
    );

    const responses: { agent: string; response: string; source: ReplySource }[] = [];
    const svc = getSupabaseService();
    const fallbackOnlyTargets: string[] = [];
    const rejectedTargets: string[] = [];
    const allAttempts: Record<string, ProviderAttempt[]> = {};

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const settled = results[i];
      if (settled.status === "rejected") {
        console.error(`Chat target ${target} rejected:`, settled.reason);
        rejectedTargets.push(target);
        continue;
      }
      const r = settled.value;
      allAttempts[target] = r.attempts;
      if (r.openClawError && singleTargetStrict) {
        return NextResponse.json(
          {
            ok: false,
            error: r.openClawError,
            source: "openclaw",
            attempts: r.attempts,
          },
          { status: 502 }
        );
      }
      const text = r.text;
      if (groupMode && isGroupNoResponse(text)) {
        continue;
      }
      // Skip empty fallback replies — they happen when every backend failed.
      // We DO still track them in fallbackOnlyTargets so the POST below knows
      // to return 502 with the attempt log instead of silently dropping the
      // user's message.
      if (r.source === "fallback" || !text) {
        fallbackOnlyTargets.push(target);
        continue;
      }
      responses.push({ agent: target, response: text, source: r.source });

      if (svc && channelId) {
        const agentUUID = AGENT_DM_UUID[target] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        const { error: insertErr } = await svc.from("messages").insert({
          channel_id: channelId,
          sender_agent_id: agentUUID,
          sender_type: "agent",
          content: text,
          tenant_id: "11111111-1111-1111-1111-111111111111",
          attachments: [],
          status: "sent",
          ...(threadUuid ? { thread_parent_id: threadUuid } : {}),
        });
        if (insertErr) {
          console.error(`[chat] agent reply insert failed for ${target}:`, insertErr);
        }
      }
    }

    // If NO agent produced a real reply (all fallback / rejected), return
    // 502 with the structured attempt log so the chat UI can render the
    // actual reason (which backend died) instead of a soothing lie.
    if (
      responses.length === 0 &&
      (fallbackOnlyTargets.length > 0 || rejectedTargets.length > 0)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No chat backend responded. Check that the Claude Max proxy is running on http://127.0.0.1:3456, or start LM Studio's Local Server.",
          source: "fallback",
          targets,
          attempts: allAttempts,
          rejected: rejectedTargets,
        },
        { status: 502 }
      );
    }

    const combined =
      responses.length === 0
        ? ""
        : responses.length === 1
          ? responses[0].response
          : responses.map((x) => `**${x.agent}:** ${x.response}`).join("\n\n");
    const first = responses[0];

    if (userMessageId && svc) {
      await svc
        .from("messages")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", userMessageId);
    }

    return NextResponse.json({
      ok: true,
      responses,
      response: combined,
      agent: first?.agent ?? targets[0],
      source: first?.source ?? "fallback",
      targets,
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
