/**
 * Consent funnel intake — the legal, warm alternative to cold outbound.
 *
 * A business voluntarily requests a free audit on the public /free-audit page.
 * Their submission IS consent to (a) receive the audit and (b) follow-up about it.
 * That flips cold→warm: we can now legally email/call them (they raised their hand),
 * and warm converts far better than cold. Each submission becomes a qualified,
 * consented pipeline_lead WITH an email — which the gate/loop can actually act on.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let b: Record<string, string>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = (b.email || "").trim().toLowerCase();
  const business = (b.business || "").trim();
  if (!business) return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });

  const meta = {
    website: (b.website || "").trim() || null,
    instagram: (b.instagram || "").trim() || null,
    city: (b.city || "").trim() || null,
    phone: (b.phone || "").trim() || null,
    consent: true,
    consentAt: new Date().toISOString(),
    optInSource: "free-audit-landing",
    requestedAudit: true,
  };

  try {
    // dedupe by email — update rather than create a second lead
    const { data: existing } = await db
      .from("pipeline_leads")
      .select("id")
      .eq("contact_email", email)
      .maybeSingle();

    let leadId: string;
    if (existing) {
      await db.from("pipeline_leads").update({ company: business, name: b.name || null, meta }).eq("id", existing.id);
      leadId = existing.id;
    } else {
      const { data: created, error } = await db
        .from("pipeline_leads")
        .insert({
          company: business,
          name: b.name || null,
          contact_email: email,
          stage: "qualified",
          source: "consent-funnel",
          feed: "agency",
          source_signal: "free-audit opt-in (consented)",
          value: 7490,
          meta,
        })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: "Could not save — please try again." }, { status: 500 });
      leadId = created.id;
    }

    // timeline event (best-effort)
    await db.from("pipeline_events").insert({
      lead_id: leadId,
      kind: "consent_optin",
      detail: { email, business, source: "free-audit-landing" },
    }).then(() => {}, () => {});

    return NextResponse.json({ ok: true, message: "Your free audit is on the way — check your inbox shortly." });
  } catch {
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
