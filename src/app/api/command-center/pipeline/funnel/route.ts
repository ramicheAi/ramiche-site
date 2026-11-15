import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { computeFunnel } from "@/lib/funnel";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET -> the lead funnel (sourced → qualified → contacted → proposal → won) +
 *  dead-lead rate + $ pipeline. Read-only; safe to poll for the dashboard. */
async function GET_handler() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const [{ data: leads }, { data: events }] = await Promise.all([
    db.from("pipeline_leads").select("id,stage,value,source,meta").limit(5000),
    db.from("pipeline_events").select("lead_id,kind").limit(20000),
  ]);

  const funnel = computeFunnel(leads || [], events || []);
  return NextResponse.json({ funnel, generatedAt: new Date().toISOString() });
}

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const GET = ownerOnly(GET_handler);
