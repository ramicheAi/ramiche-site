import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

export async function POST(req: NextRequest) {
  try {
    const { message, channelId, agentName, channelName, channelMembers } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // For DMs: use the specific agent. For team/project channels: pick a relevant member (not atlas unless alone)
    let target: string;
    if (agentName) {
      target = agentName.toLowerCase();
    } else if (channelMembers && Array.isArray(channelMembers) && channelMembers.length > 0) {
      // Pick a random non-atlas member to respond (or atlas if he's the only one)
      const nonAtlas = channelMembers.filter((m: string) => m !== "atlas");
      target = nonAtlas.length > 0
        ? nonAtlas[Math.floor(Math.random() * nonAtlas.length)]
        : "atlas";
    } else {
      target = "atlas";
    }
    const persona = AGENT_PERSONAS[target] || { role: "AI Agent", style: "Helpful and direct." };
    const displayName = target.charAt(0).toUpperCase() + target.slice(1);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No API key configured" }, { status: 500 });
    }

    // Model fallback chain — try each until one succeeds
    const MODELS = [
      "google/gemini-2.5-flash-preview",
      "deepseek/deepseek-chat-v3-0324",
      "anthropic/claude-sonnet-4",
    ];

    const chatMessages = [
      {
        role: "system",
        content: `You are ${displayName}. Role: ${persona.role}. Style: ${persona.style}${channelName ? `\nChannel: ${channelName}` : ""}\n\nRules:\n- Reply in plain text only. No timestamps, no metadata, no brackets, no system tags.\n- Keep responses under 100 words. Be concise and natural.\n- Talk like a real person — warm, helpful, direct.\n- The user's name is Ramon. You work at Parallax.`,
      },
      { role: "user", content: message },
    ];

    let agentResponse: string | null = null;

    for (const model of MODELS) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://ramiche-site.vercel.app",
            "X-Title": "Parallax Command Center",
          },
          body: JSON.stringify({
            model,
            messages: chatMessages,
            max_tokens: 500,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (res.ok) {
          const data = await res.json();
          agentResponse = data.choices?.[0]?.message?.content || null;
          if (agentResponse) break;
        } else {
          const errText = await res.text().catch(() => "unknown");
          console.error(`OpenRouter ${model} failed: ${res.status} ${errText}`);
        }
      } catch (err) {
        console.error(`OpenRouter ${model} timeout/error:`, err);
      }
    }

    if (!agentResponse) {
      agentResponse = `${displayName} is temporarily unavailable. Please try again in a moment.`;
    }

    // Write agent response to Supabase
    const supabase = getSupabase();
    if (supabase && channelId) {
      const agentUUID = AGENT_DM_UUID[target] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

      await supabase.from("messages").insert({
        channel_id: channelId,
        sender_agent_id: agentUUID,
        sender_type: "agent",
        content: agentResponse,
        tenant_id: "11111111-1111-1111-1111-111111111111",
        attachments: [],
      });
    }

    return NextResponse.json({ ok: true, response: agentResponse, agent: target });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
