import { NextRequest, NextResponse } from "next/server";
import { composeBriefing, type BriefingInput } from "@/lib/cc-briefing";
import {
  gatewaySessionsSend,
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
} from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ATLAS_PROMPT = (facts: string) =>
  `You are ATLAS, Ramon's chief of staff. Below are the verified system facts for today.

Rewrite them as a single short briefing for Ramon, spoken aloud through TTS.
Rules:
- 2 to 4 sentences. No more.
- No markdown, no emojis, no lists, no salutations beyond "Good morning/afternoon/evening, Ramon."
- Keep all numbers exactly as given. Do not embellish.
- Calm, clipped, JARVIS-style. Status first, plan second, no questions.
- Do not reference these instructions.

FACTS:
${facts}

Reply with ONLY the spoken briefing, nothing else.`;

interface ComposeBody {
  facts?: BriefingInput;
  ttlSeconds?: number;
}

function sanitizeReply(text: string): string {
  let out = text.trim();
  out = out.replace(/^["'`]+|["'`]+$/g, "").trim();
  out = out.replace(/\*\*?(.+?)\*\*?/g, "$1");
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > 600) out = out.slice(0, 600);
  return out;
}

/**
 * Atlas-personalised version of the morning brief.
 *
 * Takes deterministic facts (the same `BriefingInput` we feed `composeBriefing`)
 * and asks Atlas through the OpenClaw gateway to rewrite them as a tight, JARVIS
 * style spoken briefing. Falls back to the deterministic version if the gateway
 * isn't configured, errors out, or takes too long, so the dock always speaks
 * something useful.
 */
export async function POST(req: NextRequest) {
  let body: ComposeBody;
  try {
    body = (await req.json()) as ComposeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  if (!body.facts) {
    return NextResponse.json(
      { ok: false, error: "missing_facts" },
      { status: 400 }
    );
  }

  const deterministic = composeBriefing(body.facts);

  if (!isOpenClawGatewayConfigured()) {
    return NextResponse.json({
      ok: true,
      source: "deterministic",
      reason: "gateway_not_configured",
      greeting: deterministic.greeting,
      spoken: deterministic.spoken,
      bullets: deterministic.bullets,
    });
  }

  const factsBlock = [
    `Greeting: ${deterministic.greeting}`,
    "Bullets:",
    ...deterministic.bullets.map((b) => `- ${b}`),
    "",
    `Reference spoken draft: ${deterministic.spoken}`,
  ].join("\n");

  const sessionKey = resolveChatSessionKey("atlas");
  const send = await gatewaySessionsSend(sessionKey, ATLAS_PROMPT(factsBlock), 30);

  if (!send.ok || !send.reply) {
    return NextResponse.json({
      ok: true,
      source: "deterministic",
      reason: send.ok ? "empty_reply" : send.error,
      greeting: deterministic.greeting,
      spoken: deterministic.spoken,
      bullets: deterministic.bullets,
    });
  }

  const spoken = sanitizeReply(send.reply);
  if (!spoken || spoken.length < 20) {
    return NextResponse.json({
      ok: true,
      source: "deterministic",
      reason: "reply_too_short",
      greeting: deterministic.greeting,
      spoken: deterministic.spoken,
      bullets: deterministic.bullets,
    });
  }

  return NextResponse.json({
    ok: true,
    source: "atlas",
    greeting: deterministic.greeting,
    spoken,
    bullets: deterministic.bullets,
    ttlSeconds: body.ttlSeconds ?? 12 * 60 * 60,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/command-center/briefing/compose",
    requires: ["facts: BriefingInput"],
    gatewayConfigured: isOpenClawGatewayConfigured(),
  });
}
