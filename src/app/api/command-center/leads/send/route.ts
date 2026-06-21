import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PARALLAX } from "@/lib/parallax-co";
import { parseBody, badRequest, isValidEmail } from "@/lib/api-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { leadId, kind? } -> sends the generated cold email to the lead from the
 * Parallax Ventures domain address via SMTP. User-initiated (the Send button is
 * the approval gate). Degrades to { needsSetup:true } when SMTP env is absent so
 * the UI can fall back to draft/mailto.
 *
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM (e.g. hello@parallaxvinc.com)
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
  const kit = meta.kit as { coldEmail?: { subject?: string; body?: string } } | undefined;
  const intel = meta.intel as { contactEmail?: string | null } | undefined;
  const to = (lead.contact_email || intel?.contactEmail || "") as string;
  const subject = kit?.coldEmail?.subject;
  const text = kit?.coldEmail?.body;

  if (!subject || !text) return badRequest("No cold email yet — run Prep this Client first.");
  if (!to || !isValidEmail(to)) return NextResponse.json({ error: "No valid contact email for this lead.", noEmail: true }, { status: 400 });

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || PARALLAX.email;
  if (!host || !user || !pass) {
    return NextResponse.json({ needsSetup: true, error: "SMTP not configured — add SMTP_HOST/SMTP_USER/SMTP_PASS/EMAIL_FROM to send. Use the mail-app draft for now." }, { status: 200 });
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user, pass },
    });
    const htmlBody = text.split(/\n\n+/).map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1a1a1a">${p.replace(/\n/g, "<br/>")}</p>`).join("");
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px">${htmlBody}<table style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:14px"><tr><td style="padding-right:12px;vertical-align:middle"><img src="${PARALLAX.logoUrl}" width="40" height="40" alt="Parallax" style="display:block"/></td><td style="font-size:13px;color:#444;line-height:1.5;vertical-align:middle"><b>${PARALLAX.founder}</b> &middot; ${PARALLAX.legalName}<br/>${PARALLAX.website} &middot; ${from}</td></tr></table></div>`;
    const info = await transport.sendMail({ from: `${PARALLAX.brand} <${from}>`, to, subject, text, html, replyTo: from });

    const newMeta = { ...meta, lastOutreachAt: new Date().toISOString(), lastOutreachTo: to };
    await db.from("pipeline_leads").update({ meta: newMeta, stage: lead.stage === "qualified" ? "proposal" : lead.stage, last_contact: new Date().toISOString() }).eq("id", leadId);
    try { await db.from("pipeline_events").insert({ lead_id: leadId, kind: "email_sent", detail: { to, subject, messageId: info.messageId } }); } catch { /* non-critical */ }

    return NextResponse.json({ sent: true, to, messageId: info.messageId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "send failed" }, { status: 502 });
  }
}
