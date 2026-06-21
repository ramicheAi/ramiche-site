import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { rankCallList, type PriorityLead } from "@/lib/voice/call-priority";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLOSED_STAGES = new Set(["won", "lost", "closed", "archived", "dead"]);

/**
 * GET /api/command-center/voice/call-list?limit=20&callableOnly=1
 * Returns today's ranked call list — who Mercury should call, in order, with the
 * compliance gate applied. Powers the call-center cockpit.
 */
export async function GET(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const callableOnly = url.searchParams.get("callableOnly") === "1";
  // For real outbound we require consent (Option A); a disclosed-B2B mode can override.
  const requireConsent = url.searchParams.get("requireConsent") !== "0";

  const { data, error } = await db.from("pipeline_leads").select("*").limit(500);
  if (error) return NextResponse.json({ error: "database error (retryable)" }, { status: 503 });

  const leads: PriorityLead[] = (data || [])
    .filter((r: Record<string, unknown>) => !CLOSED_STAGES.has(String(r.stage || "").toLowerCase()))
    .map((r: Record<string, unknown>) => {
      // phone/city/category/website/address live in meta (no top-level columns) —
      // reading them off the row returns undefined and silently kills the call list.
      const m = (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>;
      const pick = (k: string) => (r[k] as string) ?? (m[k] as string) ?? null;
      return {
        id: String(r.id),
        name: (r.name as string) ?? null,
        company: (r.company as string) ?? null,
        category: pick("category"),
        city: pick("city"),
        phone: pick("phone"),
        website: pick("website"),
        address: pick("address"),
        meta: (r.meta as PriorityLead["meta"]) ?? null,
      };
    });

  const candidates = rankCallList(leads, { limit, callableOnly, requireConsent });
  const callableNow = candidates.filter((c) => c.callable).length;
  return NextResponse.json({ count: candidates.length, callableNow, requireConsent, candidates });
}
