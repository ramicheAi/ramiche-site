import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { callProxyJSON, startBackgroundGen } from "@/lib/lead-gen";
import { parseBody, badRequest } from "@/lib/api-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { leadId, regenerate? } -> deep business intel via the agent's WEB tools.
 * Fire-and-forget: returns { status:"generating" } immediately; poll the lead's
 * meta.intel / meta.intelStatus for the result.
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
  if (meta.intel && body.regenerate !== true) return NextResponse.json({ intel: meta.intel, status: "done" });
  if (meta.intelStatus === "generating" && body.regenerate !== true) return NextResponse.json({ status: "generating" });
  if (meta.intelStatus === "error" && body.regenerate !== true) return NextResponse.json({ status: "error", error: (meta.intelError as string) || "research failed" });

  const name = lead.company || lead.name || "the business";
  const category = lead.product || "local business";
  const location = lead.notes || "their area";
  const website = (typeof meta.website === "string" ? meta.website : null) || "none found";

  const sys = [
    "You are an elite B2B research analyst for a web design + local growth agency.",
    "You HAVE web search and web fetch tools — USE THEM to research the REAL business below before answering.",
    "Search Google/Maps for their listing + reviews, fetch their website if any, check their social profiles.",
    "CRITICAL — is the business STILL OPEN? Check for a Google/Maps 'Permanently closed' flag, a state-registry dissolution/inactive status, the date of the most recent reviews, and whether the website/socials are live. Set operating='closed' ONLY on clear evidence, 'open' when clearly active, else 'uncertain'. A 'closed' business is auto-disqualified downstream, so be accurate and cite the signal in operatingEvidence.",
    "Return ONLY a JSON object (no markdown, no commentary). Be factual. Use null/empty when you cannot verify something — DO NOT invent details.",
    "Schema:",
    `{"businessType":"precise niche","operating":"open|closed|uncertain","operatingEvidence":"the specific signal that determined operating status","summary":"2-3 factual sentences on who they are","contactEmail":"best public contact/owner email found on their site or null","contactPhone":"public phone or null","services":["actual offerings"],"onlinePresence":{"website":"url or null","websiteState":"modern|outdated|none|unknown","google":"rating + review count or null","social":["platform: handle"],"notes":"1-2 sentences"},"brandVibe":"positioning/tone","audience":"who they serve","strengths":["..."],"gaps":["specific fixable digital gaps"],"competitors":[{"name":"...","edge":"what they do better online"}],"owner":"name or null","personalizedHooks":["2-3 specific verifiable things to reference in outreach"],"recentSignals":["recent news/posts or empty"]}`,
    "For contactEmail: actually look on their website's contact/about pages and footer. Return the real address if present; null if you genuinely can't find one.",
  ].join("\n");
  const user = `Research this real business now:\nName: ${name}\nType (from listing): ${category}\nLocation: ${location}\nKnown website: ${website}\n\nUse your web tools, then return the JSON.`;

  await startBackgroundGen(db, leadId, "intel", () => callProxyJSON(sys, user, { timeoutMs: 170_000 }));
  return NextResponse.json({ status: "generating" });
}
