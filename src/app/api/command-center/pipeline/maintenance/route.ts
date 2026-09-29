import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { cityStateFromAddress } from "@/lib/geo-parse";
import { isChain } from "@/lib/lead-fit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stages the franchise sweep may disqualify: pre-engagement prospects only.
 * `closed` (closed-won, counted as revenue by pipeline_metrics) and `lost` are never
 * touched; `proposal` / `negotiation` are live deals and are only flagged for review.
 * Any stage outside the live CHECK constraint is left alone.
 */
const SWEEPABLE_STAGES = ["lead", "qualified"] as const; // module-private: route files may only export handlers/config
const REVIEW_STAGES = new Set(["proposal", "negotiation"]);

/**
 * POST -> one-shot pipeline cleanups so the funnel + ICP loop run on clean data:
 *   1. FRANCHISE SWEEP — disqualify chain/franchise PROSPECTS (stage lead/qualified).
 *      Chains already in proposal/negotiation are reported in `flaggedForReview`, not
 *      changed. Closed-won and lost leads are never reclassified (P05-B4 preflight).
 *   2. CITY BACKFILL — fill meta.city from the address on legacy leads.
 * Idempotent and safe to re-run.
 */
export async function POST(req: Request) {
  const p03Guard = await guardProtectedMutation(req);
  if (!p03Guard.ok) return p03Guard.response;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: leads, error } = await db.from("pipeline_leads").select("id,company,name,stage,meta,notes").limit(8000);
  if (error) return NextResponse.json({ error: "database error (retryable)" }, { status: 503 });

  let scanned = 0, franchisesRemoved = 0, cityBackfilled = 0;
  const removed: string[] = [];
  const flaggedForReview: Array<{ id: string; name: string; stage: string }> = [];

  for (const l of leads || []) {
    scanned++;
    const meta = (l.meta && typeof l.meta === "object" ? l.meta : {}) as Record<string, unknown>;
    const name = ((typeof l.company === "string" && l.company) || (typeof l.name === "string" && l.name) || "") as string;
    // stage is NOT NULL (default lead) in the live schema; anything unexpected is left alone.
    const stage = typeof l.stage === "string" ? l.stage.toLowerCase() : "";
    const chain = isChain(name);

    // 1) Franchise sweep — corporate handles their marketing; we sell to independents.
    if (chain && (SWEEPABLE_STAGES as readonly string[]).includes(stage)) {
      const dq = { ...meta, disqualified: true, disqualifyCode: "chain", disqualifyReason: "National chain / franchise — corporate handles their marketing. Not a fit.", recommendation: null };
      // The stage condition is part of the UPDATE, so a lead that moved on (e.g. closed)
      // after the read above is not touched; `select` tells us whether a row changed.
      const { data: changed, error: e } = await db
        .from("pipeline_leads")
        .update({ meta: dq, stage: "lost", value: 0 })
        .eq("id", l.id)
        .in("stage", [...SWEEPABLE_STAGES])
        .select("id");
      if (!e && Array.isArray(changed) && changed.length === 1) {
        franchisesRemoved++;
        if (removed.length < 50) removed.push(name);
        try { await db.from("pipeline_events").insert({ lead_id: l.id, kind: "disqualified", detail: { code: "chain", via: "sweep" } }); } catch { /* non-critical */ }
        continue; // disqualified; skip the city backfill
      }
      // Not swept (the lead moved on since the read, or the update failed): leave this row
      // alone entirely rather than write anything from the stale snapshot.
      continue;
    } else if (chain && REVIEW_STAGES.has(stage)) {
      if (flaggedForReview.length < 50) flaggedForReview.push({ id: String(l.id), name, stage });
    }

    // 2) City backfill from address (sharpens the ICP loop + funnel segments).
    const hasCity = typeof meta.city === "string" && meta.city.trim() !== "" && meta.city.toLowerCase() !== "unknown";
    if (!hasCity) {
      const addr = (typeof meta.address === "string" ? meta.address : null) || (typeof l.notes === "string" ? l.notes : null);
      const city = cityStateFromAddress(addr);
      if (city) {
        // Conditioned on the stage read above, so a lead that changed stage meanwhile is not
        // overwritten from the stale snapshot.
        const { error: e } = await db.from("pipeline_leads").update({ meta: { ...meta, city } }).eq("id", l.id).eq("stage", l.stage);
        if (!e) cityBackfilled++;
      }
    }
  }

  return NextResponse.json({ scanned, franchisesRemoved, cityBackfilled, removed, flaggedForReview });
}
