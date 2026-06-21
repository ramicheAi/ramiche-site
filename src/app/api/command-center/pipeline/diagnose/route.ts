import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { auditLead } from "@/lib/lead-audit";
import { recommendBundle } from "@/lib/services-catalog";
import { qualifyPostResearch } from "@/lib/lead-qualification";
import { isChain } from "@/lib/lead-fit";
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
  if (error) return NextResponse.json({ error: "database error (retryable)" }, { status: 503 });
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const meta = (lead.meta && typeof lead.meta === "object" ? lead.meta : {}) as Record<string, unknown>;
  const intel = meta.intel as { operating?: string; operatingEvidence?: string; contactEmail?: string | null; contactPhone?: string | null; onlinePresence?: { website?: string | null; websiteState?: string; google?: string | null; social?: string[] } } | undefined;
  const website = (intel?.onlinePresence?.website) || (typeof meta.website === "string" ? meta.website : null);

  const audit = await auditLead({ website });

  // Research-grounded refinement: don't sell them what they already have.
  let gaps = audit.gaps;
  let healthScore = audit.healthScore;
  if (intel?.onlinePresence) {
    const op = intel.onlinePresence;
    const goodSite = op.websiteState === "modern" && !!op.website;
    const outdated = op.websiteState === "outdated";
    const hasGoogle = !!op.google;
    const hasSocial = Array.isArray(op.social) && op.social.length > 0;
    gaps = gaps.filter((g) => {
      if (goodSite && ["no_website", "outdated_website", "not_mobile", "slow_site", "no_ssl"].includes(g)) return false;
      if (hasGoogle && g === "no_gbp") return false;
      if (hasSocial && g === "no_social") return false;
      return true;
    });
    if (outdated && !gaps.includes("outdated_website")) gaps.push("outdated_website");
    healthScore = Math.min(100, healthScore + (hasGoogle ? 12 : 0) + (hasSocial ? 8 : 0) + (goodSite ? 10 : 0));
  }

  // ── QUALIFICATION GATE ──────────────────────────────────────────────────
  // Only winnable leads pass: ALIVE (not closed/dissolved) + REACHABLE (phone or
  // email) + has NEED (not already high-health) + FIT (not a national chain). This
  // is what stops dead businesses (e.g. a dissolved LLC with no website) from being
  // priced + prepped + cold-called. Each kill logs a human-readable reason.
  // phone lives in meta.phone (OSM) — there is no lead.phone column. Use the real OSM
  // phone as the floor so a research miss can't falsely flag a reachable lead.
  const metaPhone = typeof meta.phone === "string" ? meta.phone : null;
  const phone = intel?.contactPhone || metaPhone || null;
  const email = (typeof lead.contact_email === "string" ? lead.contact_email : null) || intel?.contactEmail || audit.signals.email || null;

  // Guard against a hallucinated "closed": only honor it with cited evidence, and
  // NEVER when the site is verifiably live + fast (the audit is ground truth).
  const operatingRaw = String(intel?.operating || "").toLowerCase();
  const hasEvidence = !!(intel?.operatingEvidence && String(intel.operatingEvidence).trim().length >= 10);
  const siteLive = audit.signals.hasWebsite && audit.signals.reachable === true && (audit.signals.responseMs ?? 9999) < 3500;
  const operating = operatingRaw === "closed" && (!hasEvidence || siteLive) ? "uncertain" : operatingRaw;

  const verdict = qualifyPostResearch({
    operating,
    phone,
    email,
    healthScore,
    isChain: isChain((typeof lead.company === "string" && lead.company) || (typeof lead.name === "string" && lead.name) || ""),
    researched: !!intel,
  });
  if (!verdict.qualified) {
    const dqMeta = { ...meta, audit: { signals: audit.signals, healthScore, gaps }, recommendation: null, disqualified: true, disqualifyCode: verdict.code, disqualifyReason: verdict.reason, diagnosedAt: new Date().toISOString() };
    const { data: dqLead } = await db.from("pipeline_leads").update({ meta: dqMeta, stage: "lost", value: 0 }).eq("id", leadId).select().single();
    try { await db.from("pipeline_events").insert({ lead_id: leadId, kind: "disqualified", detail: { code: verdict.code, healthScore } }); } catch { /* non-critical */ }
    return NextResponse.json({ lead: dqLead, disqualified: true, reason: verdict.reason, code: verdict.code, audit: { healthScore, gaps } });
  }

  const rec = recommendBundle(gaps, 0.35);
  // Annual contract value = one-time + 12 months recurring.
  const acv = rec.oneTimeTotal + rec.monthlyTotal * 12;

  const newMeta = { ...meta, audit: { signals: audit.signals, healthScore, gaps }, recommendation: rec, diagnosedAt: new Date().toISOString() };

  // Enrich the contact email from research/scrape if we don't have one.
  const enrichedEmail = lead.contact_email || intel?.contactEmail || audit.signals.email || null;

  const { data: updated, error: upErr } = await db
    .from("pipeline_leads")
    .update({ meta: newMeta, value: acv, stage: lead.stage === "lead" ? "qualified" : lead.stage, contact_email: enrichedEmail })
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
