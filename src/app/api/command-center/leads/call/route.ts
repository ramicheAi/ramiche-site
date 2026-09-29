import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseBody, sanitize, badRequest, isOneOf } from "@/lib/api-security";
import { CALL_OUTCOME_KEYS } from "@/lib/call-outcomes";
import { guardProtectedMutation } from "@/lib/server/protected-mutation";

export const dynamic = "force-dynamic";

/**
 * POST { leadId, outcome, note? } — log a call attempt + its outcome on a lead.
 * One click from the Leads list or Deal Room. Appends to meta.calls, stamps
 * last_contact, writes a pipeline_events row, and moves the stage where the
 * outcome makes it obvious:
 *   interested | booked  -> qualified (only upgrades from "lead")
 *   turned_down          -> lost (+ lostReason; NOT disqualified — that flag
 *                           means "bad fit from diagnosis", this is "they said no")
 *   no_answer | voicemail | callback -> no stage change
 */

export async function POST(req: Request) {
  const p03Guard = await guardProtectedMutation(req);
  if (!p03Guard.ok) return p03Guard.response;
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");

  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!leadId) return badRequest("leadId required");
  if (!isOneOf(body.outcome, [...CALL_OUTCOME_KEYS])) return badRequest(`outcome must be one of: ${CALL_OUTCOME_KEYS.join(", ")}`);
  const outcome = body.outcome;
  const note = sanitize(body.note, 500) || null;

  const { data: lead, error } = await db.from("pipeline_leads").select("id,stage,meta").eq("id", leadId).single();
  if (error) return NextResponse.json({ error: "database error (retryable)" }, { status: 503 });
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const meta = (lead.meta && typeof lead.meta === "object" ? lead.meta : {}) as Record<string, unknown>;
  const calls = Array.isArray(meta.calls) ? (meta.calls as unknown[]) : [];
  const at = new Date().toISOString();
  const entry = { at, outcome, ...(note ? { note } : {}) };

  // Stage effect — conservative: only the outcomes that unambiguously imply one.
  let stage = lead.stage as string;
  const extraMeta: Record<string, unknown> = {};
  if ((outcome === "interested" || outcome === "booked") && stage === "lead") stage = "qualified";
  if (outcome === "turned_down" && stage !== "closed") {
    stage = "lost";
    extraMeta.lostReason = note || "turned us down on a call";
  }

  // Callback discipline: "call back later" is a commitment, not a shrug — schedule
  // it (caller-supplied ISO, else tomorrow 10:00 server-local) so the Leads list
  // surfaces it when due. Any other outcome means the callback happened → clear.
  if (outcome === "callback") {
    const due = typeof body.callbackAt === "string" && !Number.isNaN(Date.parse(body.callbackAt)) ? new Date(body.callbackAt) : null;
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(10, 0, 0, 0);
    extraMeta.callbackDue = (due ?? fallback).toISOString();
  } else if (meta.callbackDue) {
    extraMeta.callbackDue = null;
  }

  const newMeta = { ...meta, ...extraMeta, calls: [...calls, entry], lastCall: entry };
  const { error: upErr } = await db
    .from("pipeline_leads")
    .update({ meta: newMeta, stage, last_contact: at })
    .eq("id", leadId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  try {
    await db.from("pipeline_events").insert({ lead_id: leadId, kind: "call", detail: { outcome, note, stage } });
  } catch {
    /* timeline is non-critical */
  }

  return NextResponse.json({ logged: true, outcome, stage, calls: calls.length + 1 });
}
