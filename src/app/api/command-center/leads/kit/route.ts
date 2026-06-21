import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { GAP_LABEL, type GapId } from "@/lib/services-catalog";
import { callProxyJSON, startBackgroundGen } from "@/lib/lead-gen";
import { parseBody, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { leadId, regenerate? } -> a full, client-specific sales kit, grounded in
 * the deep business intel + diagnosis + the proven CLOSER/AAA doctrine.
 * Fire-and-forget: returns { status:"generating" }; poll meta.kit / meta.kitStatus.
 */
export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!leadId) return badRequest("leadId required");

  const { data: lead, error } = await db.from("pipeline_leads").select("*").eq("id", leadId).single();
  if (error) return NextResponse.json({ error: "database error (retryable)" }, { status: 503 });
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const meta = (lead.meta && typeof lead.meta === "object" ? lead.meta : {}) as Record<string, unknown>;
  if (meta.kit && body.regenerate !== true) return NextResponse.json({ kit: meta.kit, status: "done" });
  if (meta.kitStatus === "generating" && body.regenerate !== true) return NextResponse.json({ status: "generating" });
  if (meta.kitStatus === "error" && body.regenerate !== true) return NextResponse.json({ status: "error", error: (meta.kitError as string) || "kit failed" });

  const rec = (meta.recommendation ?? null) as { items?: Array<{ name: string; billing: string; price: number }>; oneTimeTotal?: number; monthlyTotal?: number } | null;
  const audit = (meta.audit ?? null) as { gaps?: GapId[]; healthScore?: number } | null;
  const intel = meta.intel ?? null;
  const gaps = (audit?.gaps ?? []).map((g) => GAP_LABEL[g] || g);
  const bundle = (rec?.items ?? []).map((i) => `${i.name} — $${i.price}${i.billing === "monthly" ? "/mo" : ""}`).join("; ");
  const biz = lead.company || lead.name || "the business";

  const sys = [
    "You are MERCURY, an elite closer for a web design + local growth agency. You write sales assets that actually close local small businesses.",
    "Ground EVERYTHING in the RESEARCH PROFILE provided — reference their real services, brand, owner, competitors, and the personalized hooks. Never generic.",
    "Doctrine you MUST apply: CLOSER (Clarify; Label the gap; Overview pain + cost of inaction; Sell the outcome not the work; Explain concerns; Reinforce). Objections = AAA (Acknowledge, Associate, Ask). Proof>Promise. Damaging admissions build trust. 5th-grade reading level. Specific moments not jargon. Value Equation: big dream, proven likelihood, fast first win (<7 days), done-for-you.",
    "Output ONLY valid JSON (no markdown), exactly this shape:",
    `{"threePillarPitch":["","",""],"talkingPoints":["..."],"discoveryQuestions":["..."],"callScript":{"clarify":"","label":"","overview":"","sell":"","explainAndClose":""},"objections":[{"objection":"","rebuttal":""}],"coldEmail":{"subject":"","body":""},"followUps":[{"when":"Day 3","channel":"email|sms|call","message":""}]}`,
    "5-7 objections incl: 'too expensive', 'I have a guy/nephew', 'no time', 'I'll think about it', 'I don't need a website'. 3-4 follow-ups. The cold email MUST open with a specific personalized hook from the research.",
  ].join("\n");
  const user = [
    `CLIENT: ${biz}  ·  Location: ${lead.notes || "their area"}`,
    `RESEARCH PROFILE (use this — it's real): ${intel ? JSON.stringify(intel) : "(not researched yet — infer from category)"}`,
    `Diagnosis health: ${audit?.healthScore ?? "?"}/100. Gaps: ${gaps.join("; ") || "weak online presence"}`,
    `Bundle we're selling: ${bundle || "Website + Local SEO + Reviews + Hosting"}  ·  One-time $${rec?.oneTimeTotal ?? 0}, recurring $${rec?.monthlyTotal ?? 0}/mo`,
    "Write the full, research-grounded sales kit as JSON now.",
  ].join("\n");

  await startBackgroundGen(db, leadId, "kit", () => callProxyJSON(sys, user, { timeoutMs: 170_000 }));
  return NextResponse.json({ status: "generating" });
}
