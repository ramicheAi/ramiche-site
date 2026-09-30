import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { GAP_LABEL, type GapId } from "@/lib/services-catalog";
import { callProxyJSON, startBackgroundGen, generationStale } from "@/lib/lead-gen";
import { humanizeDeep } from "@/lib/humanize";
import { parseBody, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { leadId, regenerate? } -> a full, client-specific sales kit, grounded in
 * the deep business intel + diagnosis + the proven CLOSER/AAA doctrine.
 * Fire-and-forget: returns { status:"generating" }; poll meta.kit / meta.kitStatus.
 */
export async function POST(req: Request) {
  const p03Guard = await guardProtectedMutation(req);
  if (!p03Guard.ok) return p03Guard.response;

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
  // Stale "generating" (a restart killed the in-process run) falls through and re-kicks.
  if (meta.kitStatus === "generating" && body.regenerate !== true && !generationStale(meta, leadId, "kit")) return NextResponse.json({ status: "generating" });
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
    "Doctrine you MUST apply: this is OUTBOUND COLD outreach, not an inbound sales meeting. Objections = AAA (Acknowledge, Associate, Ask). Proof>Promise. Damaging admissions build trust. 5th-grade reading level. Specific moments not jargon. Value Equation: big dream, proven likelihood, fast first win (<7 days), done-for-you.",
    "The callScript is a COLD CALL to a busy owner who did NOT ask for this call. Short SPOKEN sentences, real turn-taking, assume interruptions. Each stage is a few sentences max, not a paragraph essay:",
    "callScript.clarify = THE OPENER, spoken in 10 seconds: first name + company, the honest admission that this is a sales call, and a permission ask (give me 30 seconds, if it is not for you tell me and I am gone). Never open with 'I appreciate you taking a minute' — they did not give you a minute yet.",
    "callScript.label = THE HOOK: one or two SPECIFIC verified facts from the research that prove homework (who outranks them on Google, the brands or services buyers search that they cannot be found for). No pitch yet, just the gap.",
    "callScript.overview = ONE discovery question, then listen. Write the single question plus one line on what to listen for. Their answer labels the pain for you.",
    "callScript.sell = sell the 15 MINUTE MEETING, not the website. BAMFAM: the only goal of a cold call is booking the next meeting. Offer something concrete to walk through (a one-page look at what buyers see when they search).",
    "callScript.explainAndClose = close a concrete time slot with an either-or choice, plus the price pivot: NEVER quote prices on a cold call. If asked what it costs, bracket it against a number from THEIR world (one job, one sale, one patient) and pivot to the meeting.",
    "callScript.voicemail = a 25-second voicemail: the single strongest hook, callback ask, and when you will try again. Most cold calls hit voicemail — this one matters.",
    "Output ONLY valid JSON (no markdown), exactly this shape:",
    `{"threePillarPitch":["","",""],"talkingPoints":["..."],"discoveryQuestions":["..."],"callScript":{"clarify":"","label":"","overview":"","sell":"","explainAndClose":"","voicemail":""},"objections":[{"objection":"","rebuttal":""}],"coldEmail":{"subject":"","body":""},"followUps":[{"when":"Day 3","channel":"email|sms|call","message":""}]}`,
    "5-7 objections incl: 'too expensive', 'I have a guy/nephew', 'no time', 'I'll think about it', 'I don't need a website'. 3-4 follow-ups. The cold email MUST open with a specific personalized hook from the research.",
    "WRITE LIKE A REAL PERSON TYPED IT IN 60 SECONDS, never like AI or a template. HARD BANS (these get the email deleted on sight): NO dashes of any kind (no em-dash, no en-dash; use a comma or split into two sentences). NO parentheses, brackets, or placeholders of ANY kind. You have the real business name, USE it. Never write things like '(business) team', '[Name]', or '[your number]'. NO semicolons. NO quotation marks around buzzwords. NO formula scaffolding ('Here is the gap', 'The difference between X and Y is', 'We work with X on exactly this:'). NO colon-led pitches. NO emoji, NO markdown. Short sentences, plain 5th-grade words, slightly imperfect and human. Greet with the real business name or just 'Hi there'. Never invent an owner's name. NEVER invent a phone number, email, or any contact detail (no fake '555' numbers). The only callback is replying to the email, so the ask is to reply. Do NOT write a signature, a sign-off name, a 'Sent from my phone' line, or any contact line in the body — the system appends the real signature automatically. End the body on your closing question.",
    "Only name a competitor that ACTUALLY appears in the RESEARCH PROFILE's competitors list. NEVER invent competitor names or business names — a made-up competitor that isn't really near them destroys credibility. If research lists no competitors, refer to them generically ('the bigger chains nearby', 'other shops in town'), never with a specific made-up name.",
  ].join("\n");
  const person = (meta.person as { person?: { name?: string | null; role?: string; confidence?: string } } | null)?.person;
  const decisionMaker = person?.name && person.confidence !== "unknown"
    ? `${person.name} (${person.role || "Owner"}) — a real verified name: greet THEM by first name in the call opener and cold email.`
    : "unknown — never invent one; greet with the business name or 'Hi there'.";
  const user = [
    `CLIENT: ${biz}  ·  Location: ${lead.notes || "their area"}`,
    `DECISION MAKER: ${decisionMaker}`,
    `RESEARCH PROFILE (use this — it's real): ${intel ? JSON.stringify(intel) : "(not researched yet — infer from category)"}`,
    `Diagnosis health: ${audit?.healthScore ?? "?"}/100. Gaps: ${gaps.join("; ") || "weak online presence"}`,
    `Bundle we're selling: ${bundle || "Website + Local SEO + Reviews + Hosting"}  ·  One-time $${rec?.oneTimeTotal ?? 0}, recurring $${rec?.monthlyTotal ?? 0}/mo`,
    "Write the full, research-grounded sales kit as JSON now.",
  ].join("\n");

  // Deterministically strip AI tells (dashes, bracket placeholders, etc.) from the
  // whole kit — the prompt asks, this enforces.
  await startBackgroundGen(db, leadId, "kit", async () =>
    humanizeDeep(await callProxyJSON(sys, user, { timeoutMs: 170_000, correlation: { type: "lead", id: leadId } })),
  );
  return NextResponse.json({ status: "generating" });
}
