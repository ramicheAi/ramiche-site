/**
 * The Approval Gate — Ramon's one-click queue for the autonomous Growth Loop.
 *
 * Agents draft irreversible actions (send / publish / spend / price / close) into
 * pipeline_gate as status='pending'. NOTHING fires until Ramon approves here.
 *
 *  GET  -> pending drafts (highest $ first), each joined to its lead's contact info.
 *  POST { id, action:'approve'|'reject' }
 *     - reject  -> status='rejected'
 *     - approve + kind='send' -> actually sends the email (SMTP), status='executed'
 *                                (or status='approved' + warning if the lead has no email)
 *     - approve + other kinds -> status='approved' (execution wired per-kind later)
 *
 * This is the human checkpoint on the 4 irreversibles. The loop is autonomous up to
 * this line and never past it.
 */
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type GateLead = { contact_email?: string | null; company?: string | null; name?: string | null };
type GateItem = {
  id: string;
  kind: string;
  title: string;
  payload?: { subject?: string; body?: string; channel?: string } | null;
  status: string;
  pipeline_leads?: GateLead | null;
};

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const { data, error } = await db
    .from("pipeline_gate")
    .select("*, pipeline_leads(company, contact_email, name)")
    .eq("status", "pending")
    .order("dollar_impact", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], count: (data ?? []).length });
}

export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { id, action } = body;
  if (!id || (action !== "approve" && action !== "reject"))
    return NextResponse.json({ error: "need {id, action:'approve'|'reject'}" }, { status: 400 });

  const { data: item, error: fErr } = await db
    .from("pipeline_gate")
    .select("*, pipeline_leads(company, contact_email, name)")
    .eq("id", id)
    .single<GateItem>();
  if (fErr || !item) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  if (item.status !== "pending")
    return NextResponse.json({ error: `already ${item.status}` }, { status: 409 });

  const stamp = { decided_at: new Date().toISOString(), decided_by: "ramon" };

  if (action === "reject") {
    await db.from("pipeline_gate").update({ status: "rejected", ...stamp }).eq("id", id);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // ── APPROVE ──
  if (item.kind === "send") {
    const to = item.pipeline_leads?.contact_email;
    if (!to) {
      await db.from("pipeline_gate").update({ status: "approved", ...stamp }).eq("id", id);
      return NextResponse.json({
        ok: true,
        status: "approved",
        warning: "Approved, but the lead has NO contact_email — nothing was sent. Enrich the lead with an email to deliver.",
      });
    }
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.EMAIL_FROM || user;
    if (!host || !user || !pass)
      return NextResponse.json({ error: "SMTP not configured (SMTP_HOST/USER/PASS)" }, { status: 503 });

    const p = item.payload || {};
    try {
      const transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user, pass },
      });
      const info = await transport.sendMail({
        from: `Parallax Ventures <${from}>`,
        to,
        subject: p.subject || item.title,
        text: p.body || "",
        replyTo: from,
      });
      await db.from("pipeline_gate").update({ status: "executed", ...stamp }).eq("id", id);
      // log a pipeline event so it shows in the lead timeline
      await db.from("pipeline_events").insert({
        lead_id: (item as { lead_id?: string }).lead_id ?? null,
        kind: "outreach_sent",
        detail: { to, subject: p.subject || item.title, messageId: info.messageId, via: "gate" },
      });
      return NextResponse.json({ ok: true, status: "executed", sentTo: to, messageId: info.messageId });
    } catch (e) {
      return NextResponse.json({ error: `send failed: ${(e as Error).message}` }, { status: 502 });
    }
  }

  // other kinds (publish/spend/price/close) — record approval; execution wired per-kind later
  await db.from("pipeline_gate").update({ status: "approved", ...stamp }).eq("id", id);
  return NextResponse.json({
    ok: true,
    status: "approved",
    note: `${item.kind} approved. Auto-execution for '${item.kind}' is not wired yet — handle it, then it's done.`,
  });
}
