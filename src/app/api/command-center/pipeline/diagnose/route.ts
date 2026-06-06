import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { auditLead } from "@/lib/lead-audit";
import { recommendBundle } from "@/lib/services-catalog";
import { parseBody, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * POST { leadId } -> audits the lead's digital presence, builds a value-priced
 * service bundle, stores both on the lead, advances it to 'qualified'.
 */
export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!leadId) return badRequest("leadId required");

  const { data: lead, error } = await db.from("pipeline_leads").select("*").eq("id", leadId).single();
  if (error || !lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const meta = (lead.meta && typeof lead.meta === "object" ? lead.meta : {}) as Record<string, unknown>;
  const website = (typeof meta.website === "string" ? meta.website : null);

  const audit = await auditLead({ website });
  const rec = recommendBundle(audit.gaps, 0.35);
  // Annual contract value = one-time + 12 months recurring.
  const acv = rec.oneTimeTotal + rec.monthlyTotal * 12;

  const newMeta = { ...meta, audit: { signals: audit.signals, healthScore: audit.healthScore, gaps: audit.gaps }, recommendation: rec, diagnosedAt: new Date().toISOString() };

  const { data: updated, error: upErr } = await db
    .from("pipeline_leads")
    .update({ meta: newMeta, value: acv, stage: lead.stage === "lead" ? "qualified" : lead.stage })
    .eq("id", leadId)
    .select()
    .single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Best-effort timeline event.
  try {
    await db.from("pipeline_events").insert({ lead_id: leadId, kind: "diagnosed", detail: { healthScore: audit.healthScore, acv } });
  } catch { /* non-critical */ }

  return NextResponse.json({ lead: updated, audit, recommendation: rec, acv });
}
