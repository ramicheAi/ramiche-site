import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { cityStateFromAddress } from "@/lib/geo-parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST -> one-shot data cleanups so the funnel + ICP loop have clean inputs.
 * Currently: backfill meta.city from meta.address on legacy leads that are missing it.
 * Idempotent and safe to re-run.
 */
export async function POST() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: leads, error } = await db.from("pipeline_leads").select("id,meta,notes").limit(8000);
  if (error) return NextResponse.json({ error: "database error (retryable)" }, { status: 503 });

  let scanned = 0, backfilled = 0;
  for (const l of leads || []) {
    scanned++;
    const meta = (l.meta && typeof l.meta === "object" ? l.meta : {}) as Record<string, unknown>;
    const hasCity = typeof meta.city === "string" && meta.city.trim() && meta.city.toLowerCase() !== "unknown";
    if (hasCity) continue;
    const addr = (typeof meta.address === "string" ? meta.address : null) || (typeof l.notes === "string" ? l.notes : null);
    const city = cityStateFromAddress(addr);
    if (!city) continue;
    const { error: upErr } = await db.from("pipeline_leads").update({ meta: { ...meta, city } }).eq("id", l.id);
    if (!upErr) backfilled++;
  }

  return NextResponse.json({ scanned, backfilled });
}
