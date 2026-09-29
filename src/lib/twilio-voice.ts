// Twilio Voice plumbing for the Parallax line — click-to-call from the Command
// Center. Env-gated like the Vapi integration: every entry point answers
// { needsSetup: true } until the keys exist in .env.local, then it goes live
// without a code change.
//
// Required env (see PHONE-SETUP.md for where each comes from):
//   TWILIO_ACCOUNT_SID    — AC…
//   TWILIO_AUTH_TOKEN     — webhook signature validation
//   TWILIO_API_KEY_SID    — SK… (API key pair for browser access tokens)
//   TWILIO_API_KEY_SECRET
//   TWILIO_TWIML_APP_SID  — AP… (TwiML app whose Voice URL = /api/command-center/voice/twiml)
//   TWILIO_PHONE_NUMBER   — the Parallax number in E.164, e.g. +19545551234
import { createHmac, timingSafeEqual } from "node:crypto";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
  phoneNumber: string;
}

/** Read at call time (never module load — see the lead-gen 401 lesson). */
export function twilioConfig(): TwilioConfig | null {
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
  const cfg = {
    accountSid: clean(process.env.TWILIO_ACCOUNT_SID),
    authToken: clean(process.env.TWILIO_AUTH_TOKEN),
    apiKeySid: clean(process.env.TWILIO_API_KEY_SID),
    apiKeySecret: clean(process.env.TWILIO_API_KEY_SECRET),
    twimlAppSid: clean(process.env.TWILIO_TWIML_APP_SID),
    phoneNumber: clean(process.env.TWILIO_PHONE_NUMBER),
  };
  return cfg.accountSid && cfg.authToken && cfg.apiKeySid && cfg.apiKeySecret && cfg.twimlAppSid && cfg.phoneNumber ? cfg : null;
}

const b64url = (s: Buffer | string) => Buffer.from(s).toString("base64url");

/**
 * Twilio Voice access token for the browser SDK (@twilio/voice-sdk) — a plain
 * HS256 JWT with Twilio's grant shape, hand-rolled so we don't pull the whole
 * twilio SDK into the bundle. Shape per Twilio's access-token spec; verify
 * against a real account on first live call before trusting edge cases.
 */
export function voiceAccessToken(cfg: TwilioConfig, identity: string, ttlSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { cty: "twilio-fpa;v=1", typ: "JWT", alg: "HS256" };
  const payload = {
    jti: `${cfg.apiKeySid}-${now}`,
    iss: cfg.apiKeySid,
    sub: cfg.accountSid,
    nbf: now,
    exp: now + ttlSeconds,
    grants: {
      identity,
      voice: {
        outgoing: { application_sid: cfg.twimlAppSid },
        incoming: { allow: true },
      },
    },
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createHmac("sha256", cfg.apiKeySecret).update(signingInput).digest("base64url");
  return `${signingInput}.${sig}`;
}

/**
 * Validate X-Twilio-Signature on inbound webhooks (HMAC-SHA1 of the full URL +
 * form params sorted by key, keyed with the auth token). Rejecting unsigned
 * requests keeps the TwiML/recording endpoints from being driven by strangers.
 */
export function validTwilioSignature(cfg: TwilioConfig, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = Buffer.from(createHmac("sha1", cfg.authToken).update(data).digest("base64"), "utf8");
  const presented = Buffer.from(signature, "utf8");
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * TwiML for an outbound click-to-call leg. It NEVER records (P05-B2.1).
 *
 * Recording is a separate, explicit step taken mid-call only after the owner confirms
 * consent for that specific call: see startCallRecording() and
 * /api/command-center/voice/recording/start. Connecting a call is not consent.
 */
export function outboundDialTwiML(cfg: TwilioConfig, to: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${xmlEscape(cfg.phoneNumber)}" answerOnBridge="true">
    <Number>${xmlEscape(to)}</Number>
  </Dial>
</Response>`;
}

/** Twilio Call SID shape. */
export const CALL_SID_RE = /^CA[0-9a-f]{32}$/;
/** Browser identity the access token is minted for; the only caller allowed to record. */
export const DIALER_IDENTITY = "ramon";

type Fetcher = typeof fetch;

function restAuth(cfg: TwilioConfig): string {
  return `Basic ${Buffer.from(`${cfg.apiKeySid}:${cfg.apiKeySecret}`).toString("base64")}`;
}

function callUrl(cfg: TwilioConfig, callSid: string, suffix = ""): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Calls/${encodeURIComponent(callSid)}${suffix}.json`;
}

export type LiveCall = { sid: string; status: string; from: string };

/** Fetch a call's current state from Twilio. Null on any failure (callers fail closed). */
export async function fetchTwilioCall(cfg: TwilioConfig, callSid: string, fetcher: Fetcher = fetch): Promise<LiveCall | null> {
  if (!CALL_SID_RE.test(callSid)) return null;
  try {
    const res = await fetcher(callUrl(cfg, callSid), { headers: { authorization: restAuth(cfg) }, cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { sid?: unknown; status?: unknown; from?: unknown };
    if (typeof j.sid !== "string" || typeof j.status !== "string" || typeof j.from !== "string") return null;
    return { sid: j.sid, status: j.status, from: j.from };
  } catch {
    return null;
  }
}

/**
 * Outcome of asking Twilio to start recording:
 *   started   - Twilio returned a recording SID;
 *   rejected  - Twilio answered with a 4xx, so no recording was created;
 *   ambiguous - network failure, 5xx or unreadable reply: a recording MAY exist.
 * Never throws.
 */
export type StartRecordingOutcome = { kind: "started"; recordingSid: string } | { kind: "rejected" } | { kind: "ambiguous" };

export async function startCallRecording(
  cfg: TwilioConfig,
  callSid: string,
  statusCallbackUrl: string | undefined,
  fetcher: Fetcher = fetch,
): Promise<StartRecordingOutcome> {
  if (!CALL_SID_RE.test(callSid)) return { kind: "rejected" };
  const form = new URLSearchParams({ RecordingChannels: "dual" });
  if (statusCallbackUrl) {
    form.set("RecordingStatusCallback", statusCallbackUrl);
    form.set("RecordingStatusCallbackEvent", "completed");
  }
  let res: Response;
  try {
    res = await fetcher(callUrl(cfg, callSid, "/Recordings"), {
      method: "POST",
      headers: { authorization: restAuth(cfg), "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
  } catch {
    return { kind: "ambiguous" };
  }
  if (res.status >= 400 && res.status < 500) return { kind: "rejected" };
  if (!res.ok) return { kind: "ambiguous" };
  try {
    const j = (await res.json()) as { sid?: unknown };
    return typeof j.sid === "string" && /^RE[0-9a-f]{32}$/.test(j.sid) ? { kind: "started", recordingSid: j.sid } : { kind: "ambiguous" };
  } catch {
    return { kind: "ambiguous" };
  }
}

/** Recordings Twilio holds for a call. `null` means the list could not be read. Never throws. */
export async function listCallRecordings(
  cfg: TwilioConfig,
  callSid: string,
  fetcher: Fetcher = fetch,
): Promise<Array<{ sid: string; status: string }> | null> {
  if (!CALL_SID_RE.test(callSid)) return null;
  try {
    const res = await fetcher(callUrl(cfg, callSid, "/Recordings"), { headers: { authorization: restAuth(cfg) }, cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { recordings?: unknown };
    if (!Array.isArray(j.recordings)) return null;
    // Any malformed entry makes the whole list unreadable: dropping it could hide an active recording.
    const out: Array<{ sid: string; status: string }> = [];
    for (const r of j.recordings as unknown[]) {
      const o = (r ?? {}) as { sid?: unknown; status?: unknown };
      if (typeof o.sid !== "string" || typeof o.status !== "string" || !/^RE[0-9a-f]{32}$/.test(o.sid)) return null;
      if (!KNOWN_RECORDING_STATUSES.has(o.status)) return null;
      out.push({ sid: o.sid, status: o.status });
    }
    return out;
  } catch {
    return null;
  }
}

/** Twilio Recording statuses. Anything else makes a recording list unreadable (fail closed). */
export const KNOWN_RECORDING_STATUSES = new Set(["in-progress", "paused", "stopped", "processing", "completed", "absent", "failed"]);

/** A recording that is capturing (or can resume capturing) audio. */
export const isActiveRecording = (r: { status: string }) => r.status === "in-progress" || r.status === "paused";

/** Ends a call (last-resort fail-closed step when recording state cannot be established). Never throws. */
export async function endCall(cfg: TwilioConfig, callSid: string, fetcher: Fetcher = fetch): Promise<boolean> {
  if (!CALL_SID_RE.test(callSid)) return false;
  try {
    const res = await fetcher(callUrl(cfg, callSid), {
      method: "POST",
      headers: { authorization: restAuth(cfg), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ Status: "completed" }).toString(),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Loose E.164 check for dial targets. */
export function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+1\d{10}$/.test(digits)) return digits;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  return null;
}
