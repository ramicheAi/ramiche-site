import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { callProxyJSON } from "@/lib/lead-gen";
import type { CallDiscovery } from "@/lib/voice/discovery-schema";
import { isFounderGuardEnforced, MACHINE_ROUTES_ENV, MACHINE_SECRET_ENV } from "@/lib/server/founder-authority";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROUTE_KEY = "voice-call-webhook";
/**
 * CC-SECURITY-REMEDIATION-05 item 5: a credential dedicated to this one integration,
 * instead of the general-purpose `COMMAND_CENTER_MACHINE_SECRET` shared by every
 * machine caller. Compromise of that shared secret (via any other integration) would
 * otherwise also compromise this one, and vice versa. Setting this alone turns
 * enforcement on for this route -- the same self-gating pattern as
 * `TELEGRAM_WEBHOOK_SECRET` -- with no need to also touch `CC_FOUNDER_GUARD_ENFORCE`.
 */
const VAPI_SECRET_ENV = "VAPI_SERVER_SECRET";
const MIN_SECRET_LENGTH = 32;

function timingSafeCompare(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True once a dedicated secret is configured -- its presence alone is the opt-in. */
function dedicatedVapiSecretConfigured(): boolean {
  const dedicated = process.env[VAPI_SECRET_ENV]?.trim();
  return !!dedicated && dedicated.length >= MIN_SECRET_LENGTH;
}

/**
 * Vapi sends its webhook secret as `x-vapi-secret`, not `Authorization: Bearer` --
 * a different convention from `verifyMachineCredential`'s, so this checks it directly
 * rather than force-fitting the shared helper onto the wrong header.
 *
 * Prefers the dedicated `VAPI_SERVER_SECRET` when configured. Falls back to the
 * shared `COMMAND_CENTER_MACHINE_SECRET`/`CC_MACHINE_ROUTES` opt-in pair (the
 * original CC-SECURITY-RELEASE-GATE-03A mechanism) when it is not, so an existing
 * rollout that already set the shared secret for this route keeps working unchanged.
 */
function verifyVapiSecret(req: Request): boolean {
  const dedicated = process.env[VAPI_SECRET_ENV]?.trim();
  if (dedicated && dedicated.length >= MIN_SECRET_LENGTH) {
    return timingSafeCompare(req.headers.get("x-vapi-secret"), dedicated);
  }
  const secret = process.env[MACHINE_SECRET_ENV]?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;
  const routes = process.env[MACHINE_ROUTES_ENV]?.trim().toLowerCase().split(",").map((k) => k.trim()) ?? [];
  if (!routes.includes("all") && !routes.includes(ROUTE_KEY)) return false;
  return timingSafeCompare(req.headers.get("x-vapi-secret"), secret);
}

/**
 * Vapi end-of-call webhook. Vapi POSTs here when a call finishes (configured via
 * assistant.server.url in voice-provider.ts). We pull the transcript, extract the
 * structured discovery brief with the local proxy, and write it to the lead's meta
 * so the web-client-delivery skill can build from it. ALWAYS returns 200 so Vapi
 * doesn't retry-storm.
 *
 * CC-SECURITY-RELEASE-GATE-03A: no check existed here before. Opt-in, off by default --
 * this change alone rejects nothing. Two ways to enable, either is sufficient:
 *   (preferred) set `VAPI_SERVER_SECRET` (>=32 chars) and configure that same value as
 *     this assistant's `server.secret` in Vapi (voice-provider.ts). Enforcement turns
 *     on automatically the moment the env var is set -- no `CC_FOUNDER_GUARD_ENFORCE`
 *     entry needed, same self-gating pattern as the Telegram webhook secret.
 *   (legacy) set `COMMAND_CENTER_MACHINE_SECRET`, add "voice-call-webhook" to
 *     `CC_MACHINE_ROUTES`, AND list "voice-call-webhook" in `CC_FOUNDER_GUARD_ENFORCE`,
 *     using the same secret as `server.secret` in Vapi.
 * Either way, the code half alone does nothing without the matching Vapi-side
 * `server.secret` -- both must land together before enabling. Checked only on the
 * message that actually writes anything (below), not on every status callback Vapi
 * sends during a call, so enabling this never breaks the harmless ack path for message
 * types with no effect. A rejected call is acked with `captured: false`, never a
 * non-200, to preserve the no-retry-storm contract above.
 */
export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const msg = (raw.message && typeof raw.message === "object" ? raw.message : raw) as Record<string, unknown>;
    const type = (msg.type as string) || "";

    // Only act on the final report; ack everything else.
    if (type && type !== "end-of-call-report") return NextResponse.json({ ok: true });

    const enforced = dedicatedVapiSecretConfigured() || isFounderGuardEnforced(ROUTE_KEY);
    if (enforced && !verifyVapiSecret(req)) {
      return NextResponse.json({ ok: true, captured: false, reason: "unauthorized" });
    }

    const call = (msg.call && typeof msg.call === "object" ? msg.call : {}) as Record<string, unknown>;
    const artifact = (msg.artifact && typeof msg.artifact === "object" ? msg.artifact : {}) as Record<string, unknown>;
    const metadata = (call.metadata && typeof call.metadata === "object" ? call.metadata : {}) as Record<string, unknown>;
    const leadId = (metadata.leadId as string) || "";

    const transcript =
      (msg.transcript as string) ||
      (artifact.transcript as string) ||
      (Array.isArray(artifact.messages) ? (artifact.messages as Array<{ role?: string; message?: string }>).map((m) => `${m.role}: ${m.message}`).join("\n") : "") ||
      "";
    const recordingUrl = (msg.recordingUrl as string) || (artifact.recordingUrl as string) || undefined;
    const durationSec = Number(msg.durationSeconds || msg.duration || 0) || 0;

    const db = getSupabaseAdmin();
    if (!db || !leadId || !transcript) {
      // Nothing to persist (e.g. a test call with no leadId) — still ack.
      return NextResponse.json({ ok: true, captured: false });
    }

    // Extract the structured brief from the transcript (reuses the local proxy).
    let discovery: Partial<CallDiscovery> | null = null;
    try {
      discovery = (await callProxyJSON(
        `Extract a CallDiscovery JSON object from this phone-call transcript between an AI agent (Mercury) and a local business owner. Return ONLY JSON with keys: business{name,vertical,city,ownerName}, bestContact{phone,email,preferredChannel,bestTime}, language, servicesWanted[], budgetSignal, timeline, decisionMaker, brand{vibe,colorsLiked,competitorsAdmired,competitorsToBeat}, existingAssets{logo,photos,menu,domain,socials}, mustHaves[], outcome (one of booked|deposit_taken|callback|not_interested|no_answer|voicemail), objections[], consent{toCall,toRecord}. Use null/empty when unknown.`,
        transcript,
        { timeoutMs: 120_000, correlation: { type: "lead", id: leadId } },
      )) as Partial<CallDiscovery>;
    } catch {
      /* extraction is best-effort */
    }

    const { data: row } = await db.from("pipeline_leads").select("meta").eq("id", leadId).single();
    const meta = (row?.meta && typeof row.meta === "object" ? row.meta : {}) as Record<string, unknown>;
    await db
      .from("pipeline_leads")
      .update({
        meta: { ...meta, discovery: { ...(discovery || {}), recordingUrl, durationSec, callId: call.id }, callRecordingUrl: recordingUrl, lastCallAt: new Date().toISOString() },
        last_contact: new Date().toISOString(),
      })
      .eq("id", leadId);
    try {
      await db.from("pipeline_events").insert({ lead_id: leadId, kind: "call_completed", detail: { callId: call.id, outcome: discovery?.outcome || "unknown", durationSec } });
    } catch { /* non-critical */ }

    return NextResponse.json({ ok: true, captured: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
