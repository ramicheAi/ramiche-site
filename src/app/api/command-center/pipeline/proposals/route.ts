import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseBody, sanitize, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const;

function svc() {
  const db = getSupabaseAdmin();
  if (!db) {
    return { db: null, err: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  }
  return { db, err: null as null };
}

/** GET /api/command-center/pipeline/proposals?lead_id=...&status=sent&limit=100 */
export async function GET(req: Request) {
  const { db, err } = svc();
  if (err) return err;

  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead_id");
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 1000);

  let q = db
    .from("pipeline_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (leadId) q = q.eq("lead_id", leadId);
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
}

/**
 * POST /api/command-center/pipeline/proposals
 * Persist a generated proposal. If `lead_id` is omitted but contact info is
 * present, create/link a lead first (the proposal generator path) and advance
 * its stage to 'proposal'.
 */
export async function POST(req: Request) {
  const { db, err } = svc();
  if (err) return err;

  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");

  const status = (typeof body.status === "string" && (STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "draft") as string;

  // 1. Resolve/create the lead.
  let leadId: string | null = typeof body.lead_id === "string" && body.lead_id ? body.lead_id : null;
  if (!leadId && (body.company || body.contact_email || body.email)) {
    const leadRow = {
      name: sanitize(body.contact_name ?? body.name, 200) || null,
      company: sanitize(body.company ?? body.team, 200) || null,
      contact_email: sanitize(body.contact_email ?? body.email, 254) || null,
      contact_title: sanitize(body.contact_title ?? body.title, 200) || null,
      product: sanitize(body.product, 200) || null,
      stage: "proposal",
      value: Number(body.annual_value) || Number(body.monthly_price) || 0,
      source: sanitize(body.source, 120) || "proposal-generator",
      owner: sanitize(body.owner, 60) || "mercury",
      meta: body.meta && typeof body.meta === "object" ? body.meta : {},
      last_contact: new Date().toISOString(),
    };
    const { data: lead, error: leadErr } = await db.from("pipeline_leads").insert(leadRow).select().single();
    if (leadErr) return NextResponse.json({ error: `lead create failed: ${leadErr.message}` }, { status: 500 });
    leadId = lead.id;
  }

  // 2. Insert the proposal.
  const proposalRow: Record<string, unknown> = {
    lead_id: leadId,
    product: sanitize(body.product, 200) || null,
    tier: sanitize(body.tier, 120) || null,
    monthly_price: body.monthly_price != null ? Number(body.monthly_price) : null,
    discount_pct: Number(body.discount_pct) || 0,
    projected_roi_pct: body.projected_roi_pct != null ? Number(body.projected_roi_pct) : null,
    annual_value: body.annual_value != null ? Number(body.annual_value) : null,
    valid_until: body.valid_until ? new Date(String(body.valid_until)).toISOString().slice(0, 10) : null,
    status,
    terms: body.terms && typeof body.terms === "object" ? body.terms : {},
  };

  const { data: proposal, error: propErr } = await db
    .from("pipeline_proposals")
    .insert(proposalRow)
    .select()
    .single();
  if (propErr) return NextResponse.json({ error: propErr.message }, { status: 500 });

  // 3. Best-effort timeline event.
  if (leadId) {
    try {
      await db
        .from("pipeline_events")
        .insert({ lead_id: leadId, kind: "proposal_sent", detail: { proposal_id: proposal.id, status } });
    } catch {
      /* timeline is non-critical */
    }
  }

  return NextResponse.json({ proposal, lead_id: leadId });
}
