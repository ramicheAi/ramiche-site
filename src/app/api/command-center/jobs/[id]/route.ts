import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { runJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

function svc() {
  const db = getSupabaseAdmin();
  if (!db) return { db: null, err: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  return { db, err: null as null };
}

/** GET /api/command-center/jobs/[id] -> job + recent events */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { db, err } = svc();
  if (err) return err;
  const { id } = await params;

  const { data: job, error } = await db.from("jobs").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: events } = await db
    .from("job_events")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  return NextResponse.json({ job, events: events ?? [] });
}

/**
 * POST /api/command-center/jobs/[id] -> re-run a finished job (sets it back to queued + dispatches).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { db, err } = svc();
  if (err) return err;
  const { id } = await params;

  const { data: job, error } = await db.from("jobs").select("*").eq("id", id).single();
  if (error || !job) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (job.status === "running" || job.status === "queued") {
    return NextResponse.json({ error: "job is already active" }, { status: 409 });
  }

  await db.from("jobs").update({ status: "queued", result: null, error: null, progress: "re-queued", started_at: null, finished_at: null }).eq("id", id);
  void runJob(id).catch(() => {});
  return NextResponse.json({ ok: true, id });
}
