import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  gatewaySessionsSend,
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
} from "@/lib/openclaw-gateway";
import { resolveChatTargets } from "@/lib/chat-routing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/* Map agent short IDs to their DM channel UUIDs (used as sender_agent_id so the frontend resolves names) */
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

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Service role — updates user message delivery status (server-only). */
function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function isGroupNoResponse(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return /^\[NO_RESPONSE\]/i.test(t);
}

type ReplySource = "openclaw" | "gemini" | "deepseek" | "openrouter" | "fallback";

async function generateAgentReply(
  target: string,
  userMessage: string,
  channelName: string | undefined,
  groupMode: boolean,
  singleTargetStrict: boolean
): Promise<{ text: string; source: ReplySource; openClawError?: string }> {
  const persona = AGENT_PERSONAS[target] || { role: "AI Agent", style: "Helpful and direct." };
  const displayName = target.charAt(0).toUpperCase() + target.slice(1);
  const groupRules = groupMode
    ? `\n\nYou are in a shared channel with other agents. Only respond if the user's message is relevant to your role. If you should not reply, output exactly [NO_RESPONSE] and nothing else.`
    : "";

  const systemPrompt = `You are ${displayName}. Role: ${persona.role}. Style: ${persona.style}${channelName ? `\nChannel: ${channelName}` : ""}${groupRules}\n\nRules:\n- Reply in plain text only. No timestamps, no metadata, no brackets, no system tags — except the literal token [NO_RESPONSE] when you must stay silent in group mode.\n- Keep responses under 100 words. Be concise and natural.\n- Talk like a real person — warm, helpful, direct.\n- The user's name is Ramon. You work at Parallax.`;

  let agentResponse: string | null = null;
  let responseSource: ReplySource = "fallback";

  const openclawStrict =
    singleTargetStrict &&
    (process.env.OPENCLAW_CHAT_STRICT === "1" || process.env.OPENCLAW_CHAT_STRICT === "true");

  if (isOpenClawGatewayConfigured()) {
    const sessionKey = resolveChatSessionKey(target);
    const routed = `[CC chat → ${displayName} / session ${sessionKey}]\n${systemPrompt}\n\nUser:\n${userMessage}`;
    const gw = await gatewaySessionsSend(sessionKey, routed, 90);
    if (gw.ok && gw.reply) {
      agentResponse = gw.reply;
      responseSource = "openclaw";
    } else if (openclawStrict) {
      return {
        text: "",
        source: "openclaw",
        openClawError:
          !gw.ok && "error" in gw ? gw.error : "OpenClaw gateway did not return a reply",
      };
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!agentResponse && geminiKey) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        agentResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        if (agentResponse) responseSource = "gemini";
      }
    } catch (err) {
      console.error("Gemini direct timeout/error:", err);
    }
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!agentResponse && deepseekKey) {
    try {
      const res = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        agentResponse = data.choices?.[0]?.message?.content || null;
        if (agentResponse) responseSource = "deepseek";
      }
    } catch (err) {
      console.error("DeepSeek direct timeout/error:", err);
    }
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!agentResponse && openrouterKey) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterKey}`,
          "HTTP-Referer": "https://ramiche-site.vercel.app",
          "X-Title": "Parallax Command Center",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const data = await res.json();
        agentResponse = data.choices?.[0]?.message?.content || null;
        if (agentResponse) responseSource = "openrouter";
      }
    } catch (err) {
      console.error("OpenRouter fallback timeout/error:", err);
    }
  }

  if (!agentResponse) {
    agentResponse = `${displayName} is temporarily unavailable. Please try again in a moment.`;
    responseSource = "fallback";
  }

  return { text: agentResponse, source: responseSource };
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
    } = body as {
      message?: string;
      channelId?: string;
      agentName?: string;
      channelName?: string;
      channelMembers?: string[];
      mentionedAgents?: string[];
      /** Supabase UUID of the user row — mark delivered after relay completes */
      userMessageId?: string;
    };

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const targets = resolveChatTargets({ mentionedAgents, agentName, channelMembers });
    const groupMode = targets.length > 1;
    const singleTargetStrict = targets.length === 1;

    const results = await Promise.allSettled(
      targets.map((target) =>
        generateAgentReply(target, message, channelName, groupMode, singleTargetStrict)
      )
    );

    const responses: { agent: string; response: string; source: ReplySource }[] = [];
    const supabase = getSupabase();

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const settled = results[i];
      if (settled.status === "rejected") {
        console.error(`Chat target ${target} rejected:`, settled.reason);
        continue;
      }
      const r = settled.value;
      if (r.openClawError && singleTargetStrict) {
        return NextResponse.json(
          {
            ok: false,
            error: r.openClawError,
            source: "openclaw",
          },
          { status: 502 }
        );
      }
      const text = r.text;
      if (groupMode && isGroupNoResponse(text)) {
        continue;
      }
      responses.push({ agent: target, response: text, source: r.source });

      if (supabase && channelId) {
        const agentUUID = AGENT_DM_UUID[target] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        await supabase.from("messages").insert({
          channel_id: channelId,
          sender_agent_id: agentUUID,
          sender_type: "agent",
          content: text,
          tenant_id: "11111111-1111-1111-1111-111111111111",
          attachments: [],
        });
      }
    }

    const combined =
      responses.length === 0
        ? ""
        : responses.length === 1
          ? responses[0].response
          : responses.map((x) => `**${x.agent}:** ${x.response}`).join("\n\n");
    const first = responses[0];

    const svc = getSupabaseService();
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
