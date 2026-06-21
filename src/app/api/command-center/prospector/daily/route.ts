import { NextResponse } from "next/server";

import { geocode, searchBusinesses } from "@/lib/prospector";
import { qualifyProspect, normalizeName } from "@/lib/lead-fit";
import { learnedTargets } from "@/lib/icp-learning";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The daily auto-prospector. Triggered by a scheduler (launchd/cron). Searches a
 * rotating set of (vertical × city) targets for NO-WEBSITE businesses, keeps only
 * the ones that fit our ICP (real, reachable, target vertical), dedupes against
 * existing leads, and imports up to ~40 fresh high-need leads into the pipeline.
 */
async function run() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const TARGET_COUNT = 50;

  // Pull existing leads once — for dedup AND for the ICP learning loop.
  const { data: existing } = await db.from("pipeline_leads").select("company,stage,value,tags,meta").limit(8000);
  // Robust dedup: stable osmId first, then normalized name+city — avoids both false
  // merges (same name, different city) and re-importing the same business.
  const seenOsm = new Set<string>();
  const seenNameCity = new Set<string>();
  for (const l of existing || []) {
    const m = (l.meta && typeof l.meta === "object" ? l.meta : {}) as Record<string, unknown>;
    if (m.osmId) seenOsm.add(String(m.osmId));
    const nm = normalizeName(l.company as string);
    if (nm) seenNameCity.add(`${nm}|${String(m.city || "").toLowerCase().trim()}`);
  }

  // Bias today's sourcing toward proven (vertical × city) winners; explore the rest (70/20/10).
  const targets = learnedTargets(existing || [], 14, dayIndex);

  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let scanned = 0;
  for (const t of targets) {
    if (rows.length >= TARGET_COUNT) break;
    try {
      const area = await geocode(t.city);
      if (!area) { errors.push(`geocode miss: ${t.city}`); continue; }
      const results = await searchBusinesses(t.vertical, area, { onlyNoWebsite: true, limit: 30 });
      for (const r of results) {
        scanned++;
        const fit = qualifyProspect(r);
        if (!fit.qualified) continue;
        const cityKey = `${normalizeName(r.name)}|${t.city.toLowerCase().trim()}`;
        if (r.osmId && seenOsm.has(r.osmId)) continue;
        if (seenNameCity.has(cityKey)) continue;
        if (r.osmId) seenOsm.add(r.osmId);
        seenNameCity.add(cityKey);
        rows.push({
          name: r.name, company: r.name, product: "Web Development", stage: "lead", source: "auto-prospect",
          contact_email: (r.email || null), tags: [r.category],
          notes: [r.address, r.phone ? `☎ ${r.phone}` : "", r.email ? `✉ ${r.email}` : "", "no website"].filter(Boolean).join(" · "),
          meta: { osmId: r.osmId, category: r.category, address: r.address, phone: r.phone, email: r.email, website: null, lat: r.lat, lon: r.lon, fit, city: t.city },
        });
        if (rows.length >= TARGET_COUNT) break;
      }
    } catch (e) { errors.push(`${t.vertical}·${t.city}: ${e instanceof Error ? e.message : "failed"}`); }
    // Respect Nominatim/Overpass rate limits (free shared APIs) — pace the loop.
    await new Promise((res) => setTimeout(res, 1100));
  }

  if (rows.length === 0) return NextResponse.json({ imported: 0, scanned, errors, message: errors.length ? "no imports — all targets errored (see errors)" : "no new qualified leads today" });

  const { data, error } = await db.from("pipeline_leads").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message, scanned, errors }, { status: 500 });

  try { await db.from("pipeline_events").insert({ lead_id: null, kind: "auto_prospect_run", detail: { imported: data?.length ?? 0, scanned, errors: errors.length, day: dayIndex } }); } catch { /* events.lead_id may be NOT NULL — non-critical */ }

  return NextResponse.json({ imported: data?.length ?? 0, scanned, errors, targets: targets.map((t) => `${t.vertical}·${t.city}`) });
}

export async function POST() { return run(); }
export async function GET() { return run(); }
