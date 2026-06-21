import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseBody, badRequest } from "@/lib/api-security";
import { placeVapiCall, vapiConfigured, toE164, type PlaceCallInput } from "@/lib/voice/voice-provider";
import type { LeadContext } from "@/lib/voice/call-script";
import type { GapId } from "@/lib/services-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { toNumber?, leadId? } -> places a real outbound AI call via Vapi.
 *
 * This endpoint IS the approval gate (user-initiated, like leads/send). It never
 * fires on its own. Degrades to { needsSetup:true } when Vapi env is absent.
 *
 * - { toNumber } alone  -> a TEST call (generic "how do I sound" script).
 * - { leadId }          -> loads the lead + its diagnose gaps and runs the full
 *                          CLOSER script grounded in that business.
 */
export async function POST(req: Request) {
  const { data: body, error: parseError } = await parseBody(req);
  if (parseError || !body) return badRequest(parseError || "Invalid request");

  const toNumberRaw = typeof body.toNumber === "string" ? body.toNumber : "";
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!toNumberRaw && !leadId) return badRequest("toNumber or leadId required");

  if (!vapiConfigured()) {
    return NextResponse.json(
      { needsSetup: true, error: "Vapi not configured — add VAPI_PRIVATE_KEY and VAPI_PHONE_NUMBER_ID to place calls." },
      { status: 200 },
    );
  }

  // Public URL for the end-of-call webhook (Vapi must reach it — the tunnel/prod
  // origin, NOT localhost). Optional: a missing one just skips capture, the call still rings.
  const publicBase = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const webhookUrl = publicBase ? `${publicBase.replace(/\/$/, "")}/api/command-center/voice/call/webhook` : undefined;

  const call: PlaceCallInput = { toNumber: toNumberRaw, webhookUrl };

  // Lead-grounded call: pull the business + its gaps so the agent runs the real script.
  const db = getSupabaseAdmin();
  if (leadId && db) {
    const { data: lead } = await db.from("pipeline_leads").select("*").eq("id", leadId).single();
    if (lead) {
      const meta = (lead.meta && typeof lead.meta === "object" ? lead.meta : {}) as Record<string, unknown>;
      const intel = (meta.intel && typeof meta.intel === "object" ? meta.intel : {}) as Record<string, unknown>;
      const diagnose = (meta.diagnose && typeof meta.diagnose === "object" ? meta.diagnose : {}) as Record<string, unknown>;
      const gaps = (Array.isArray(diagnose.gaps) ? diagnose.gaps : Array.isArray(meta.gaps) ? meta.gaps : []) as GapId[];
      const ctx: LeadContext = {
        businessName: (lead.company || lead.name || (intel.businessName as string) || "your business") as string,
        vertical: (lead.category || (intel.vertical as string) || "local business") as string,
        city: (lead.city || (intel.city as string) || "") as string,
        ownerName: (lead.contact_name as string) || undefined,
        gaps,
      };
      call.lead = ctx;
      call.leadId = leadId;
      if (!call.toNumber) call.toNumber = (lead.phone || intel.phone || "") as string;
    }
  }

  if (!call.toNumber) return badRequest("No phone number for this lead — pass toNumber.");

  const result = await placeVapiCall(call);

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "call failed", status: result.status }, { status: 502 });
  }

  // Log the gated action.
  if (db && leadId) {
    try {
      await db.from("pipeline_events").insert({ lead_id: leadId, kind: "call_placed", detail: { to: toE164(call.toNumber), callId: result.callId } });
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ placed: true, callId: result.callId, status: result.status, to: toE164(call.toNumber) });
}
