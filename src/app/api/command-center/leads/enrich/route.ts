import { NextResponse } from "next/server";
import { resolveMx } from "node:dns/promises";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { callProxyJSON, startBackgroundGen, generationStale } from "@/lib/lead-gen";
import { parseBody, badRequest } from "@/lib/api-security";
import { guardProtectedMutation } from "@/lib/server/protected-mutation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { leadId, regenerate? } -> PERSON-level enrichment: identify the decision
 * maker (owner/principal) and their direct contact channels. Stage 2 of the
 * two-stage pipeline (discovery finds the COMPANY; this enriches the PERSON —
 * name, role, LinkedIn, email + provenance) so outreach greets a real human.
 * Fire-and-forget like intel/kit: poll meta.person / meta.personStatus.
 *
 * Deliverability rule: a FOUND email (site, registry, social, directory) is
 * promoted to lead.contact_email; a pattern GUESS is stored on meta.person only,
 * labeled, and never auto-used for sending.
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
  if (meta.person && body.regenerate !== true) return NextResponse.json({ person: meta.person, status: "done" });
  // Stale "generating" (a restart killed the in-process run) falls through and re-kicks.
  if (meta.personStatus === "generating" && body.regenerate !== true && !generationStale(meta, leadId, "person")) return NextResponse.json({ status: "generating" });
  if (meta.personStatus === "error" && body.regenerate !== true) return NextResponse.json({ status: "error", error: (meta.personError as string) || "enrichment failed" });

  const name = lead.company || lead.name || "the business";
  const category = lead.product || "local business";
  const location = lead.notes || "their area";
  const website = (typeof meta.website === "string" ? meta.website : null) || "none found";
  const intel = meta.intel ? JSON.stringify(meta.intel).slice(0, 4000) : "(no business research yet)";

  const sys = [
    "You are an elite B2B contact researcher. Your ONLY job: identify the real DECISION MAKER (owner/principal/GM) of one specific local business, and their direct contact channels. You HAVE web search and web fetch tools — USE THEM.",
    "Run this waterfall IN ORDER and cite what each step produced:",
    "1) STATE CORPORATE REGISTRY (most authoritative). For Florida businesses search Sunbiz (search.sunbiz.org) by entity name; read officers/authorized members/registered agent from the filing. Other states: that state's Secretary of State business search. An officer listed on a state filing = verified owner name.",
    "1b) LICENSING BOARDS (gold for licensed trades — often names the individual): Florida DBPR (myfloridalicense.com) for contractors/salons/restaurants, FL DOH (flhealthsource.gov) for dentists/medical, county business tax receipt / occupational license search. A license holder's name = verified.",
    "2) The business's own surfaces: website about/team/contact pages, Google Business Profile (owner replies to reviews are often signed), Facebook/Instagram page (page transparency, posts signed with a name), Yelp owner responses. If they have a domain, a WHOIS lookup sometimes names the registrant.",
    "3) LinkedIn: search the person's name + company, or company + owner + city. Capture the profile URL and stated role ONLY if you actually find it.",
    "4) EMAIL — provenance matters more than existence: report an email as found ONLY if it appears somewhere public (site, filing, social, directory). If none is public but the business has its own domain, you MAY construct ONE pattern guess (first@domain or owner-first-initial+lastname@domain) and label emailStatus='guessed'. No domain → email null, emailStatus='none'. NEVER label a guess as found.",
    "TIME BUDGET (hard): about 8 web tool calls / 4 minutes TOTAL. If a step comes up dry after 2 attempts, move to the next — state registries with form-only search may be unfetchable, skip them fast. A partial result with honest nulls beats running out of time. ALWAYS return the JSON before the budget runs out.",
    "HARD RULES: never invent a person, a role, a URL, or an email. null beats a guess everywhere except the explicitly-labeled email pattern guess. Every claim gets a one-line evidence entry saying where it came from.",
    "Return ONLY a JSON object (no markdown):",
    `{"person":{"name":"full name or null","role":"Owner|Co-owner|GM|Principal|unknown","confidence":"verified|likely|unknown","linkedin":"url or null","email":"address or null","emailStatus":"found|guessed|none","emailSource":"where it was found or how guessed, or null","phone":"direct/mobile if public, or null","evidence":["step: what was found"]},"altContacts":[{"name":"","role":"","channel":""}]}`,
  ].join("\n");
  const user = `Identify the decision maker for this real business now:\nBusiness: ${name}\nType: ${category}\nLocation: ${location}\nWebsite: ${website}\nExisting business research (context): ${intel}\n\nUse your web tools, run the waterfall, then return the JSON.`;

  await startBackgroundGen(db, leadId, "person", async () => {
    // The 4-step waterfall (registry → site → LinkedIn → email) browses more than
    // intel does. The prompt carries a hard ~4-min tool budget; 360s is the backstop.
    const result = (await callProxyJSON(sys, user, { timeoutMs: 360_000 })) as {
      person?: { email?: string | null; emailStatus?: string; mxValid?: boolean };
    };
    // Poor-man's deliverability check (DNS only — never SMTP-dial from our IP):
    // does the email's domain actually accept mail? Annotates found AND guessed.
    const email = typeof result?.person?.email === "string" && result.person.email.includes("@") ? result.person.email : null;
    if (email && result.person) {
      try {
        const mx = await resolveMx(email.split("@")[1]);
        result.person.mxValid = mx.length > 0;
      } catch {
        result.person.mxValid = false;
      }
    }
    // Promote a FOUND (never guessed) email with a mail-accepting domain to the
    // lead's send-address when the lead has none — unlocks one-click send.
    const found = result?.person?.emailStatus === "found" && email && result.person?.mxValid !== false;
    if (found && !lead.contact_email) {
      await db.from("pipeline_leads").update({ contact_email: email }).eq("id", leadId);
    }
    return result;
  });
  return NextResponse.json({ status: "generating" });
}
