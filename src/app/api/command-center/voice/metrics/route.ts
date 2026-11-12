import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { aggregateCallMetrics, type CallRecord } from "@/lib/voice/call-scorecard";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NON_CONNECT = new Set(["no_answer", "voicemail"]);

/**
 * GET /api/command-center/voice/metrics
 * Rolls call events into the leading-indicator dashboard (connect/book rate,
 * capture completeness, disclosure rate, cost per booked). See call-scorecard.ts.
 */
async function GET_handler() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: events, error } = await db
    .from("pipeline_events")
    .select("*")
    .in("kind", ["call_placed", "call_completed"])
    .limit(3000);
  if (error) return NextResponse.json({ error: "database error (retryable)" }, { status: 503 });

  // Collapse events into one record per call.
  const byCall = new Map<string, CallRecord>();
  for (const e of events || []) {
    const detail = (e.detail && typeof e.detail === "object" ? e.detail : {}) as Record<string, unknown>;
    const callId = (detail.callId as string) || `${e.lead_id}:${e.kind}:${e.id ?? ""}`;
    const rec: CallRecord = byCall.get(callId) || { placed: false, connected: false };
    if (e.kind === "call_placed") rec.placed = true;
    if (e.kind === "call_completed") {
      rec.placed = true;
      const outcome = (detail.outcome as string) || "unknown";
      rec.outcome = outcome as CallRecord["outcome"];
      rec.connected = !NON_CONNECT.has(outcome);
      rec.briefComplete = Boolean(detail.briefComplete);
      rec.disclosed = detail.disclosed !== false;
      if (typeof detail.durationSec === "number") rec.durationSec = detail.durationSec;
      if (typeof detail.cost === "number") rec.cost = detail.cost;
      if (typeof detail.score === "number") rec.score = detail.score;
    }
    byCall.set(callId, rec);
  }

  const metrics = aggregateCallMetrics([...byCall.values()]);
  return NextResponse.json({ metrics });
}

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const GET = ownerOnly(GET_handler);
