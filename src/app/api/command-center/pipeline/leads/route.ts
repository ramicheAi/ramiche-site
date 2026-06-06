import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseBody, sanitize, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";

const STAGES = ["lead", "qualified", "proposal", "negotiation", "closed", "lost"] as const;
type Stage = (typeof STAGES)[number];

function svc() {
  const db = getSupabaseAdmin();
  if (!db) {
    return { db: null, err: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  }
  return { db, err: null as null };
}

/** GET /api/command-center/pipeline/leads?stage=qualified&limit=100 */
export async function GET(req: Request) {
  const { db, err } = svc();
  if (err) return err;

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 1000);

  let q = db.from("pipeline_leads").select("*").order("created_at", { ascending: false }).limit(limit);
  if (stage && (STAGES as readonly string[]).includes(stage)) q = q.eq("stage", stage);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}

/**
 * POST /api/command-center/pipeline/leads
 * Create (or upsert by id) a lead. Logs a stage_change / created event.
 */
export async function POST(req: Request) {
  const { db, err } = svc();
  if (err) return err;

  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");

  const stage = (typeof body.stage === "string" && (STAGES as readonly string[]).includes(body.stage)
    ? body.stage
    : "lead") as Stage;

  const row: Record<string, unknown> = {
    name: sanitize(body.name, 200) || null,
    company: sanitize(body.company, 200) || null,
    contact_email: sanitize(body.contact_email ?? body.email, 254) || null,
    contact_title: sanitize(body.contact_title ?? body.title, 200) || null,
    product: sanitize(body.product, 200) || null,
    stage,
    value: Number(body.value) || 0,
    source: sanitize(body.source, 120) || "manual",
    owner: sanitize(body.owner, 60) || null,
    tags: Array.isArray(body.tags) ? body.tags.map((t: unknown) => sanitize(String(t), 60)).filter(Boolean) : [],
    notes: sanitize(body.notes, 4000) || null,
    meta: body.meta && typeof body.meta === "object" ? body.meta : {},
    last_contact: body.last_contact ? new Date(String(body.last_contact)).toISOString() : null,
  };
  if (typeof body.id === "string" && body.id) row.id = body.id;

  const { data, error } = await db
    .from("pipeline_leads")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort timeline event (don't fail the request if this fails).
  try {
    await db.from("pipeline_events").insert({ lead_id: data.id, kind: "stage_change", detail: { stage } });
  } catch {
    /* timeline is non-critical */
  }

  return NextResponse.json({ lead: data });
}
