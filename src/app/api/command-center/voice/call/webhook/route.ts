import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { callProxyJSON } from "@/lib/lead-gen";
import type { CallDiscovery } from "@/lib/voice/discovery-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vapi end-of-call webhook. Vapi POSTs here when a call finishes (configured via
 * assistant.server.url in voice-provider.ts). We pull the transcript, extract the
 * structured discovery brief with the local proxy, and write it to the lead's meta
 * so the web-client-delivery skill can build from it. ALWAYS returns 200 so Vapi
 * doesn't retry-storm.
 */
export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const msg = (raw.message && typeof raw.message === "object" ? raw.message : raw) as Record<string, unknown>;
    const type = (msg.type as string) || "";

    // Only act on the final report; ack everything else.
    if (type && type !== "end-of-call-report") return NextResponse.json({ ok: true });

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
        { timeoutMs: 120_000 },
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
