import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { guardTwilioWebhook } from "@/lib/server/twilio-webhook-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Twilio recordingStatusCallback (completed) — attach the recording to the
 * lead's call history so booked-call recordings land next to the outcome log
 * and feed coaching + client intel.
 */
export async function POST(req: Request) {
  const twilio = await guardTwilioWebhook(req, { includeQuery: true });
  if (!twilio.ok) return twilio.response;
  const params = twilio.params;
  const leadId = (twilio.url.searchParams.get("leadId") || "").replace(/[^a-z0-9-]/gi, "");
  if (!leadId || !params.RecordingUrl) return new NextResponse("ok", { status: 200 });

  // P05-B2.1: only acknowledge (200) once the recording is actually saved; storage
  // failures return a retryable 5xx instead of silently dropping the recording.
  const db = getSupabaseAdmin();
  if (!db) return new NextResponse("storage unavailable", { status: 503 });

  const { data: lead, error: readErr } = await db.from("pipeline_leads").select("id,meta").eq("id", leadId).maybeSingle();
  if (readErr) return new NextResponse("storage error", { status: 500 });
  if (!lead) return new NextResponse("ok", { status: 200 }); // unknown lead: nothing to attach

  const meta = (lead.meta && typeof lead.meta === "object" ? lead.meta : {}) as Record<string, unknown>;
  const recordings = Array.isArray(meta.recordings) ? (meta.recordings as unknown[]) : [];
  // P05-B2.1: every legitimate recording has a consent entry written before it started.
  // Anything else is kept (it exists at Twilio regardless) but flagged for review.
  // The append-only pipeline_events row (written before recording) is the durable proof;
  // lead meta is a secondary copy that later meta rewrites can lose.
  const consents = Array.isArray(meta.recordingConsents) ? (meta.recordingConsents as Array<Record<string, unknown>>) : [];
  let consented = consents.some((c) => c && c.callSid === params.CallSid && c.outcome === "started");
  if (!consented && params.CallSid) {
    const { data: ev, error: evErr } = await db
      .from("pipeline_events")
      .select("id")
      .eq("lead_id", leadId)
      .eq("kind", "recording_consent")
      .eq("detail->>callSid", params.CallSid)
      .limit(1);
    // Unknown is not "unconsented": ask Twilio to retry rather than mislabel the recording.
    if (evErr) return new NextResponse("storage error", { status: 500 });
    consented = Array.isArray(ev) && ev.length > 0;
  }
  // Retried callbacks must not duplicate the entry.
  if (params.RecordingSid && recordings.some((r) => (r as { sid?: unknown })?.sid === params.RecordingSid)) {
    return new NextResponse("ok", { status: 200 });
  }
  recordings.push({
    consented,
    at: new Date().toISOString(),
    url: params.RecordingUrl,
    sid: params.RecordingSid || null,
    durationSec: params.RecordingDuration ? Number(params.RecordingDuration) : null,
    callSid: params.CallSid || null,
  });
  const { data: saved, error: writeErr } = await db.from("pipeline_leads").update({ meta: { ...meta, recordings } }).eq("id", leadId).select("id");
  if (writeErr || !Array.isArray(saved) || saved.length !== 1) return new NextResponse("storage error", { status: 500 });

  return new NextResponse("ok", { status: 200 });
}
