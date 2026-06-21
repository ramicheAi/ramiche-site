// /Users/admin/ramiche-site/src/lib/voice/voice-provider.ts
// Telephony adapter for the Mercury voice agent. Provider: Vapi (orchestrates the
// LLM + ElevenLabs + Deepgram over a real phone number). Verified against
// https://docs.vapi.ai/api-reference/calls/create (2026-06-13).
//
// This is the ONLY file that talks to the phone network. Everything above it
// (mercury-knowledge.ts brain, call-script.ts doctrine, discovery-schema.ts) is
// provider-agnostic.
//
// The defaults below are the config PROVEN on live calls on 2026-06-13 — change
// with care (see call-agent-beacon-voice memory):
//   • Model gpt-4o — Vapi's Anthropic path faulted mid-call (error-providerfault-
//     anthropic-llm-failed) and dropped calls; gpt-4o holds the whole conversation.
//   • Voice ElevenLabs "Eric" (cjVigY5qzO86Huf0OWal), warm + slightly slower.
//   • waitSeconds 0.8 so it doesn't cut the caller off; endCall on goodbye.
//
// Required env (Ramon provisions in Vapi): VAPI_PRIVATE_KEY, VAPI_PHONE_NUMBER_ID.
// Optional overrides: VAPI_MODEL_PROVIDER, VAPI_MODEL, VAPI_VOICE_ID, VAPI_BASE_URL.
import { DISCLOSURE_LINE, type LeadContext } from "./call-script";
import { buildMercurySystemPrompt } from "./mercury-knowledge";

const VAPI_BASE = process.env.VAPI_BASE_URL || "https://api.vapi.ai";

// ── Proven defaults (override via env) ──────────────────────────────────────
const MODEL_PROVIDER = process.env.VAPI_MODEL_PROVIDER || "openai";
const MODEL = process.env.VAPI_MODEL || "gpt-4o";
const VOICE_ID = process.env.VAPI_VOICE_ID || "cjVigY5qzO86Huf0OWal"; // ElevenLabs "Eric"
const TEST_FIRST_MESSAGE =
  "Hey — this is Mercury, your Parallax AI voice agent. How's the audio sounding on your end?";

export interface PlaceCallInput {
  toNumber: string;        // any format; normalized to E.164
  lead?: LeadContext;      // grounds Mercury in a real lead → outbound sales call
  leadId?: string;         // correlation id echoed back on the webhook
  webhookUrl?: string;     // end-of-call report sink
  customerName?: string;   // who Mercury is talking to
}

export interface PlaceCallResult {
  ok: boolean;
  callId?: string;
  status?: string;
  error?: string;
  needsSetup?: boolean;
}

export function vapiConfigured(): boolean {
  return Boolean(process.env.VAPI_PRIVATE_KEY && process.env.VAPI_PHONE_NUMBER_ID);
}

/** Best-effort E.164 normalizer (defaults to US +1 when no country code). */
export function toE164(raw: string): string {
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function placeVapiCall(input: PlaceCallInput): Promise<PlaceCallResult> {
  const key = process.env.VAPI_PRIVATE_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!key || !phoneNumberId) {
    return { ok: false, needsSetup: true, error: "Vapi not configured — set VAPI_PRIVATE_KEY and VAPI_PHONE_NUMBER_ID." };
  }

  // Mercury's brain: outbound (grounded in the lead's gaps + CLOSER) or a test call.
  const systemPrompt = input.lead
    ? buildMercurySystemPrompt({ mode: "outbound", lead: input.lead, customerName: input.customerName })
    : buildMercurySystemPrompt({ mode: "test", customerName: input.customerName });
  const firstMessage = input.lead ? DISCLOSURE_LINE : TEST_FIRST_MESSAGE;

  const assistant: Record<string, unknown> = {
    firstMessage,
    model: {
      provider: MODEL_PROVIDER,
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }],
      temperature: 0.6,
      maxTokens: 250,
    },
    voice: {
      provider: "11labs",
      voiceId: VOICE_ID,
      model: "eleven_turbo_v2_5",
      stability: 0.7,
      similarityBoost: 0.85,
      style: 0.15,
      useSpeakerBoost: true,
      speed: 0.9,
    },
    transcriber: { provider: "deepgram", model: "nova-3" },
    startSpeakingPlan: { waitSeconds: 0.8 },
    silenceTimeoutSeconds: 25,
    // The model decides when to end (via endCall) — NO endCallPhrases, which
    // substring-matched courtesy words mid-conversation and hung up prematurely.
    endCallFunctionEnabled: true,
  };
  // Wire end-of-call reporting if a webhook is provided.
  if (input.webhookUrl) {
    assistant.server = { url: input.webhookUrl };
    assistant.serverMessages = ["end-of-call-report", "status-update"];
  }

  const body = {
    phoneNumberId,
    customer: { number: toE164(input.toNumber) },
    ...(input.leadId ? { metadata: { leadId: input.leadId } } : {}),
    assistant,
  };

  try {
    const res = await fetch(`${VAPI_BASE}/call`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => ({}))) as { id?: string; status?: string; message?: unknown; error?: unknown };
    if (!res.ok) {
      const msg = typeof j.message === "string" ? j.message : Array.isArray(j.message) ? j.message.join("; ") : typeof j.error === "string" ? j.error : `Vapi HTTP ${res.status}`;
      return { ok: false, error: msg, status: String(res.status) };
    }
    return { ok: true, callId: j.id, status: j.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "call request failed" };
  }
}
