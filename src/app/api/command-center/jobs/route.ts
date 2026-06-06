import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { runJob } from "@/lib/jobs";
import { parseBody, sanitize, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";

const KINDS = ["generic", "dev", "design", "prospect", "outreach", "content", "analysis"] as const;

function svc() {
  const db = getSupabaseAdmin();
  if (!db) return { db: null, err: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  return { db, err: null as null };
}

/** GET /api/command-center/jobs?status=running&limit=50 */
export async function GET(req: Request) {
  const { db, err } = svc();
  if (err) return err;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  let q = db.from("jobs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status && ["queued", "running", "done", "failed", "canceled"].includes(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

/**
 * POST /api/command-center/jobs
 * body: { title, kind?, agent?, source?, input? }
 * Creates a queued job and dispatches it to an agent (fire-and-forget).
 */
export async function POST(req: Request) {
  const { db, err } = svc();
  if (err) return err;
  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");

  const title = sanitize(body.title, 500);
  if (!title) return badRequest("title required");
  const kind = (typeof body.kind === "string" && (KINDS as readonly string[]).includes(body.kind) ? body.kind : "generic") as string;

  const row = {
    title,
    kind,
    agent: sanitize(body.agent, 60) || null,
    source: sanitize(body.source, 60) || "command-bar",
    input: body.input && typeof body.input === "object" ? body.input : {},
    status: "queued",
  };

  const { data: job, error } = await db.from("jobs").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: this server is long-lived, so the dispatch continues after we respond.
  void runJob(job.id).catch(() => {});

  return NextResponse.json({ job });
}
