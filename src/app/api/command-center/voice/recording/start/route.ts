import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { UUID_RE, noStoreJson } from "@/lib/server/cockpit-chat-data";
import {
  CALL_SID_RE,
  DIALER_IDENTITY,
  endCall,
  fetchTwilioCall,
  isActiveRecording,
  listCallRecordings,
  startCallRecording,
  twilioConfig,
} from "@/lib/twilio-voice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_ORIGIN = "https://command.parallaxvinc.com";

type ConsentRecord = {
  callSid: string;
  consentConfirmedAt: string;
  attestedBy: "owner";
  recordingSid: string | null;
  recordingStartedAt: string | null;
  /** failed: Twilio refused; call-ended: outcome ambiguous so the call was ended; unknown: could not even end it. */
  outcome: "started" | "failed" | "pending" | "call-ended" | "unknown";
};

/**
 * Response contract. `recording` is true only when Twilio confirmed a recording.
 * `definite` is true when the server KNOWS no recording is running (no provider
 * request was made, Twilio rejected it, Twilio's own list shows none, or the call was
 * ended). When `definite` is false the recording state is unknown; the dialer must
 * block retries and tell the owner the call may be recorded.
 */
const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  noStoreJson({ ok: false, recording: false, definite: true, error, ...extra }, status);
/** Not recording as far as THIS request knows, but a recording may exist: the dialer must treat it as unknown. */
const unknown = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  noStoreJson({ ok: false, recording: false, definite: false, error, ...extra }, status);

/** One start attempt per call at a time in this (single) cockpit process. */
const inFlight = new Set<string>();
/**
 * Calls whose recording state could not be established and could not be ended. No
 * further start is attempted for them in this process. (A durable claim would need a
 * schema change; the cockpit runs as a single `next start` process.)
 */
const unresolved = new Set<string>();

/**
 * POST { callSid, leadId, consentConfirmed: true }
 *
 * The ONLY way a Parallax dialer call starts recording (P05-B2.1). Connecting a call
 * never records. This route records the owner's attestation that consent was obtained
 * on this specific live call; it cannot independently verify consent. Order of checks,
 * every one failing closed:
 *   1. owner session + Origin + CSRF (P03);
 *   2. consentConfirmed === true; well-formed callSid and leadId;
 *   3. no other start attempt for this call in flight;
 *   4. Twilio reports the call in-progress and placed by this dialer's identity;
 *   5. Twilio's own recording list for the call is readable; an active recording is
 *      returned as-is (never a second one, whatever lead ID is supplied);
 *   6. consent evidence (identifiers and timestamps only) is saved twice and confirmed:
 *      an append-only pipeline_events row, and the lead's meta.recordingConsents;
 *   7. only then is Twilio asked to record. An ambiguous reply is reconciled against
 *      Twilio's recording list; if that is unreadable the call is ended. If even that
 *      fails the response says the state is unknown (definite: false).
 */
export async function POST(req: Request) {
  const p03Guard = await guardProtectedMutation(req);
  if (!p03Guard.ok) return p03Guard.response;

  let body: { callSid?: unknown; leadId?: unknown; consentConfirmed?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return refuse(400, "bad_json");
  }
  if (body.consentConfirmed !== true) return refuse(400, "consent_not_confirmed");
  const callSid = typeof body.callSid === "string" ? body.callSid : "";
  const leadId = typeof body.leadId === "string" ? body.leadId.toLowerCase() : "";
  if (!CALL_SID_RE.test(callSid)) return refuse(400, "bad_call_sid");
  if (!UUID_RE.test(leadId)) return refuse(400, "bad_lead_id");

  const cfg = twilioConfig();
  if (!cfg) return refuse(503, "twilio_not_configured");
  const db = getSupabaseAdmin();
  if (!db) return refuse(503, "db_not_configured");

  // Another request for this call may be starting a recording right now.
  if (inFlight.has(callSid)) return unknown(409, "recording_request_in_flight");
  if (unresolved.has(callSid)) return unknown(409, "recording_state_unresolved");
  inFlight.add(callSid);
  try {
    const call = await fetchTwilioCall(cfg, callSid);
    // A failed lookup proves nothing about an earlier attempt on this call: unknown, not "off".
    if (!call || call.sid !== callSid) return unknown(502, "call_state_unreadable");
    if (call.status !== "in-progress") return refuse(409, "call_not_in_progress");
    if (call.from !== `client:${DIALER_IDENTITY}`) return refuse(409, "call_not_from_dialer");

    // Twilio is the source of truth for "is this call already recording".
    const existing = await listCallRecordings(cfg, callSid);
    if (!existing) return unknown(503, "recording_state_unreadable");
    const active = existing.find(isActiveRecording);
    if (active) return noStoreJson({ ok: true, recording: true, definite: true, recordingSid: active.sid, repeat: true });

    const { data: lead, error: leadErr } = await db.from("pipeline_leads").select("id,meta").eq("id", leadId).maybeSingle();
    if (leadErr || !lead) return refuse(409, "lead_not_found");
    const meta = (lead.meta && typeof lead.meta === "object" ? lead.meta : {}) as Record<string, unknown>;
    const consents = (Array.isArray(meta.recordingConsents) ? meta.recordingConsents : []) as ConsentRecord[];

    const entry: ConsentRecord = {
      callSid,
      consentConfirmedAt: new Date().toISOString(),
      attestedBy: "owner",
      recordingSid: null,
      recordingStartedAt: null,
      outcome: "pending",
    };

    // Evidence 1: append-only event row (not affected by later meta rewrites). Must be acknowledged.
    const { data: ev, error: evErr } = await db
      .from("pipeline_events")
      .insert({ lead_id: leadId, kind: "recording_consent", detail: { callSid, consentConfirmedAt: entry.consentConfirmedAt, attestedBy: "owner" } })
      .select("id")
      .single();
    if (evErr || !ev) return refuse(503, "consent_evidence_not_saved");

    // Evidence 2: on the lead. Must update exactly this lead.
    const { data: upd, error: updErr } = await db
      .from("pipeline_leads")
      .update({ meta: { ...meta, recordingConsents: [...consents.filter((c) => c && c.callSid !== callSid), entry] } })
      .eq("id", leadId)
      .select("id");
    if (updErr || !Array.isArray(upd) || upd.length !== 1) return refuse(503, "consent_evidence_not_saved");

    let outcome = await startCallRecording(cfg, callSid, `${PUBLIC_ORIGIN}/api/command-center/voice/recording?leadId=${leadId}`);
    let callEnded = false;
    if (outcome.kind === "ambiguous") {
      // An empty list now does not prove the in-flight create will not still complete,
      // so an ambiguous attempt is only resolved by seeing the recording, or by ending the call.
      const after = await listCallRecordings(cfg, callSid);
      const found = after?.find(isActiveRecording);
      if (found) outcome = { kind: "started", recordingSid: found.sid };
      else callEnded = await endCall(cfg, callSid);
    }

    const final: ConsentRecord =
      outcome.kind === "started"
        ? { ...entry, recordingSid: outcome.recordingSid, recordingStartedAt: new Date().toISOString(), outcome: "started" }
        : { ...entry, outcome: outcome.kind === "rejected" ? "failed" : callEnded ? "call-ended" : "unknown" };
    // Re-read before writing so a recording saved meanwhile by the status webhook is kept.
    // If that read fails, skip the meta write rather than write stale data: the outcome is
    // still recorded in the append-only event below. (A read-to-write race remains without an
    // atomic DB operation; the event row is the durable record.)
    const { data: fresh, error: freshErr } = await db.from("pipeline_leads").select("id,meta").eq("id", leadId).maybeSingle();
    if (!freshErr && fresh) {
      const freshMeta = (fresh.meta && typeof fresh.meta === "object" ? fresh.meta : {}) as Record<string, unknown>;
      const freshConsents = (Array.isArray(freshMeta.recordingConsents) ? freshMeta.recordingConsents : []) as ConsentRecord[];
      await db
        .from("pipeline_leads")
        .update({ meta: { ...freshMeta, recordingConsents: [...freshConsents.filter((c) => c && c.callSid !== callSid), final] } })
        .eq("id", leadId)
        .then(() => undefined, () => undefined);
    }
    await db
      .from("pipeline_events")
      .insert({ lead_id: leadId, kind: `recording_${final.outcome}`, detail: { callSid, recordingSid: final.recordingSid } })
      .then(() => undefined, () => undefined);

    if (outcome.kind === "started") {
      return noStoreJson({ ok: true, recording: true, definite: true, recordingSid: outcome.recordingSid, startedAt: final.recordingStartedAt });
    }
    if (outcome.kind === "rejected") return refuse(502, "recording_not_started");
    if (callEnded) return refuse(502, "recording_state_unknown_call_ended", { callEnded: true });
    unresolved.add(callSid);
    return unknown(502, "recording_state_unknown");
  } finally {
    inFlight.delete(callSid);
  }
}
