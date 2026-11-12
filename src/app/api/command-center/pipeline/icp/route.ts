import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { scoreSegments, rankSegments } from "@/lib/icp-learning";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET -> per-(vertical × city) performance, best first. The learned ICP — what the
 *  prospector should source more of. Read-only. */
async function GET_handler() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: leads } = await db.from("pipeline_leads").select("stage,value,tags,meta").limit(8000);
  const segments = rankSegments(scoreSegments(leads || []));
  return NextResponse.json({ segments, generatedAt: new Date().toISOString() });
}

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const GET = ownerOnly(GET_handler);
