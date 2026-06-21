import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseBody, sanitize, badRequest } from "@/lib/api-security";
import { normalizeName } from "@/lib/lead-fit";
import { cityStateFromAddress } from "@/lib/geo-parse";

export const dynamic = "force-dynamic";

/**
 * POST { leads: [{ name, category, address, phone, email, website, osmId, ... }], product? }
 * Imports prospector results into pipeline_leads (stage=lead, source=prospector).
 * Dedupes against the EXISTING pipeline (osmId, then normalized name+city) AND within
 * the batch — so re-running a search never double-imports a business.
 */
export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");
  const leads = Array.isArray(body.leads) ? body.leads : [];
  if (leads.length === 0) return badRequest("leads array required");

  const product = sanitize(body.product, 120) || "Web Development";

  // DB-level dedup index (osmId + normalized name|city), same keys as the daily prospector.
  const { data: existing } = await db.from("pipeline_leads").select("company,meta").limit(8000);
  const seenOsm = new Set<string>();
  const seenNameCity = new Set<string>();
  for (const l of existing || []) {
    const m = (l.meta && typeof l.meta === "object" ? l.meta : {}) as Record<string, unknown>;
    if (m.osmId) seenOsm.add(String(m.osmId));
    const nm = normalizeName(l.company as string);
    if (nm) seenNameCity.add(`${nm}|${String(m.city || "").toLowerCase().trim()}`);
  }

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const l of leads as Record<string, unknown>[]) {
    const name = sanitize(l.name, 200);
    if (!name) { skipped++; continue; }
    const address = sanitize(l.address, 300) || null;
    const city = cityStateFromAddress(address);
    const osmId = l.osmId ? String(l.osmId) : null;
    const key = `${normalizeName(name)}|${String(city || "").toLowerCase().trim()}`;
    if (osmId && seenOsm.has(osmId)) { skipped++; continue; }
    if (seenNameCity.has(key)) { skipped++; continue; }
    if (osmId) seenOsm.add(osmId);
    seenNameCity.add(key);

    rows.push({
      name, company: name, product, stage: "lead", source: "prospector",
      contact_email: (typeof l.email === "string" && l.email) ? sanitize(l.email, 200) : null,
      tags: [String(l.category ?? "prospect")].filter(Boolean),
      notes: [address, l.phone ? `☎ ${sanitize(l.phone, 40)}` : "", l.email ? `✉ ${sanitize(String(l.email), 120)}` : "", l.website ? `web: ${sanitize(l.website, 200)}` : "no website"].filter(Boolean).join(" · "),
      meta: { osmId, category: l.category ?? null, address, phone: l.phone ?? null, email: l.email ?? null, website: l.website ?? null, lat: l.lat ?? null, lon: l.lon ?? null, city },
    });
  }

  if (rows.length === 0) return NextResponse.json({ imported: 0, skipped });

  const { data, error } = await db.from("pipeline_leads").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message, skipped }, { status: 500 });
  return NextResponse.json({ imported: data?.length ?? 0, skipped });
}
