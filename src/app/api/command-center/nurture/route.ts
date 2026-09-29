/**
 * Stage 3 — the Nurture Agent (email). Walks every consented funnel lead through
 * the NURTURE_SEQUENCE automatically: when a lead is due for its next touch, draft
 * that touch into the approval gate (Ramon approves → it sends), then advance the
 * lead's step. Deterministic + idempotent + dry-runnable. Cron hits POST daily.
 *
 *  GET  -> dry-run: which leads are due for which touch right now (no writes)
 *  POST -> execute: draft due touches to the gate + advance each lead's step
 *
 * P05-B2.1 safety rules:
 *  - A lead advances ONLY after its draft for that step is confirmed to exist in the
 *    gate (just inserted without error, or found from an earlier run). A failed lookup,
 *    insert or advance leaves the step unchanged and records `meta.nurture.lastError`,
 *    so the next run retries; the response lists every failure.
 *  - The duplicate check matches this lead + step in ANY gate status (pending, approved,
 *    executed, rejected), so a retry after a partial failure can never draft, and
 *    therefore never send, the same touch twice.
 *  - The first touch delivers the audit findings actually on file. A lead with no
 *    audit findings is held at step 0 (`held` in the response) instead of being sent
 *    an email that promises an audit it does not contain.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NURTURE_SEQUENCE, stepDueMs, type NurtureLead } from "@/lib/nurture-sequence";
import { guardServiceCaller, guardOwnerOrService } from "@/lib/server/service-caller";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  company: string | null;
  name: string | null;
  contact_email: string | null;
  stage: string;
  value: number | null;
  created_at: string;
  meta: Record<string, unknown> | null;
};

function shape(l: Lead): NurtureLead {
  const m = (l.meta || {}) as Record<string, unknown>;
  const audit = (m.audit as { gaps?: unknown; healthScore?: unknown } | undefined) || undefined;
  const gaps = Array.isArray(audit?.gaps) ? audit.gaps.filter((g): g is string => typeof g === "string" && g.trim().length > 0) : [];
  return {
    business: l.company || "your business",
    name: l.name,
    gaps,
    healthScore: typeof audit?.healthScore === "number" && Number.isFinite(audit.healthScore) ? audit.healthScore : undefined,
    bookingUrl: process.env.BOOKING_URL || undefined,
  };
}

// Route modules may only export handlers and route config (Next.js build check), so these stay module-private.
const NURTURE_PAGE = 300;
const NURTURE_MAX_CANDIDATES = 10_000;

/**
 * Single-flight: overlapping executions (cron + owner, or two cron hits) in this
 * cockpit process could both miss the duplicate check and draft the same touch.
 * A database uniqueness key on (lead, step) is the durable fix and needs a schema
 * change in a later packet; until then only one execution runs at a time.
 */
let executing = false;

/** Title fragment that identifies a lead's draft for a step, in any gate status. */
const nurtureStepMarker = (key: string) => `· ${key} ·`;

async function run(dryRun: boolean) {
  const db = getSupabaseAdmin();
  if (!db) return { error: "Supabase not configured" };

  // Stable pagination over every candidate (P05-B2.1): completed or held leads can no
  // longer crowd later eligible leads out of a single fixed-size batch.
  const data: Lead[] = [];
  for (let from = 0; from < NURTURE_MAX_CANDIDATES; from += NURTURE_PAGE) {
    const { data: page, error } = await db
      .from("pipeline_leads")
      .select("id,company,name,contact_email,stage,value,created_at,meta")
      .eq("source", "consent-funnel")
      .not("contact_email", "is", null)
      .not("stage", "in", "(closed,lost)")
      // Finished sequences never occupy the candidate window (step values are single digits).
      .or(`meta->nurture->>step.is.null,meta->nurture->>step.lt.${NURTURE_SEQUENCE.length}`)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + NURTURE_PAGE - 1);
    if (error) return { error: error.message };
    const rows = (page as Lead[]) || [];
    data.push(...rows);
    if (rows.length < NURTURE_PAGE) break;
  }

  const now = Date.now();
  const due: Array<{ lead: string; step: string; subject: string }> = [];
  const held: Array<{ lead: string; step: string; reason: string }> = [];
  const failures: Array<{ lead: string; step: string; stage: string; error: string }> = [];
  let advanced = 0;

  for (const l of data) {
    const m = (l.meta || {}) as Record<string, unknown>;
    const consentAt = Date.parse((m.consentAt as string) || l.created_at || "");
    if (Number.isNaN(consentAt)) continue;
    const nurture = (m.nurture as { step?: number } | undefined) || { step: 0 };
    const step = nurture.step || 0;
    if (step >= NURTURE_SEQUENCE.length) continue; // sequence complete
    if (now < consentAt + stepDueMs(step)) continue; // not due yet

    const s = NURTURE_SEQUENCE[step];
    const sh = shape(l);
    const label = l.company || l.id;
    if (s.requiresAudit && !(sh.gaps && sh.gaps.length)) {
      held.push({ lead: label, step: s.key, reason: "no audit findings on file; run diagnose first" });
      continue;
    }
    const subject = s.subject(sh);
    const body = s.body(sh);
    due.push({ lead: label, step: s.key, subject });

    if (dryRun) continue;

    const recordFailure = async (stage: string, message: string) => {
      failures.push({ lead: label, step: s.key, stage, error: message.slice(0, 200) });
      // Best effort: keep the step, note the failure for the cockpit. The step is never advanced here.
      await db
        .from("pipeline_leads")
        .update({ meta: { ...m, nurture: { ...(m.nurture as object | undefined), step, lastError: { step: s.key, stage, at: new Date().toISOString() } } } })
        .eq("id", l.id)
        .then(() => undefined, () => undefined);
    };

    // Idempotent: any existing draft for this lead + step (any status) means the touch is handled.
    const { data: existing, error: lookupErr } = await db
      .from("pipeline_gate")
      .select("id,status")
      .eq("lead_id", l.id)
      .ilike("title", `%${nurtureStepMarker(s.key)}%`)
      .limit(1);
    if (lookupErr) {
      await recordFailure("lookup", lookupErr.message || "gate lookup failed");
      continue;
    }
    if (!existing || existing.length === 0) {
      const { error: insertErr } = await db.from("pipeline_gate").insert({
        feed: "agency",
        kind: "send",
        lead_id: l.id,
        title: `Nurture ${step + 1}/${NURTURE_SEQUENCE.length} ${nurtureStepMarker(s.key)} ${l.company}`,
        why: `Automated nurture touch ${step + 1} for a consented funnel lead (opted in ${(m.consentAt as string) || "?"}). Warm + legal.`,
        dollar_impact: l.value || 7490,
        payload: { subject, body, channel: "email", nurtureKey: `${l.id}:${s.key}` },
        requested_by: "nurture-engine",
      });
      if (insertErr) {
        await recordFailure("draft", insertErr.message || "draft insert failed");
        continue;
      }
    }
    // The draft is confirmed to exist: advance the lead to the next step.
    const { error: advanceErr } = await db
      .from("pipeline_leads")
      .update({ meta: { ...m, nurture: { step: step + 1, lastSentAt: new Date().toISOString() } } })
      .eq("id", l.id);
    if (advanceErr) {
      // The draft exists, so the next run finds it and advances without drafting again.
      failures.push({ lead: label, step: s.key, stage: "advance", error: (advanceErr.message || "advance failed").slice(0, 200) });
      continue;
    }
    advanced++;
  }

  return { dryRun, due: due.length, items: due, advanced, held, failures };
}

export async function GET(req: Request) {
  const p03Guard = await guardOwnerOrService(req, "cron", "read");
  if (!p03Guard.ok) return p03Guard.response;
  return NextResponse.json(await run(true));
}
export async function POST(req: Request) {
  const p03Guard = await guardOwnerOrService(req, "cron", "mutation");
  if (!p03Guard.ok) return p03Guard.response;
  if (executing) return NextResponse.json({ error: "nurture_run_in_progress" }, { status: 409 });
  executing = true;
  try {
    return NextResponse.json(await run(false));
  } finally {
    executing = false;
  }
}
