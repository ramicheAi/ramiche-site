import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseBody, sanitize, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * POST { leads: [{ name, category, address, phone, website, osmId, ... }], product? }
 * Imports prospector results into pipeline_leads (stage=lead, source=prospector).
 * Dedupes within the batch by osmId.
 */
export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");
  const leads = Array.isArray(body.leads) ? body.leads : [];
  if (leads.length === 0) return badRequest("leads array required");

  const product = sanitize(body.product, 120) || "Web Development";
  const seen = new Set<string>();
  const rows = leads
    .filter((l: Record<string, unknown>) => {
      const k = String(l.osmId ?? l.name ?? "");
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((l: Record<string, unknown>) => ({
      name: sanitize(l.name, 200) || null,
      company: sanitize(l.name, 200) || null,
      product,
      stage: "lead",
      source: "prospector",
      // Seed contact_email from OSM email when present so the email/send channel
      // works without a separate intel pass.
      contact_email: (typeof l.email === "string" && l.email) ? sanitize(l.email, 200) : null,
      tags: [String(l.category ?? "prospect")].filter(Boolean),
      notes: [sanitize(l.address, 300), l.phone ? `☎ ${sanitize(l.phone, 40)}` : "", l.email ? `✉ ${sanitize(String(l.email), 120)}` : "", l.website ? `web: ${sanitize(l.website, 200)}` : "no website"].filter(Boolean).join(" · "),
      meta: { osmId: l.osmId ?? null, category: l.category ?? null, address: l.address ?? null, phone: l.phone ?? null, email: l.email ?? null, website: l.website ?? null, lat: l.lat ?? null, lon: l.lon ?? null },
    }));

  const { data, error } = await db.from("pipeline_leads").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length ?? 0 });
}
