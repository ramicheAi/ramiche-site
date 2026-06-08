"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PARALLAX, parallaxAddressLine } from "@/lib/parallax-co";
import { InstrumentPage } from "@/components/command-center/po/Instrument";

/* Invoice document — generated once a client agrees. Parallax Ventures Inc. */

interface RecItem { id: string; name: string; billing: "one-time" | "monthly"; price: number; }
interface Lead {
  id: string; name: string | null; company: string | null; contact_email: string | null; contact_title: string | null; notes: string | null;
  meta: { recommendation?: { items: RecItem[]; oneTimeTotal: number; monthlyTotal: number } } | null;
}

export default function InvoiceDoc() {
  const { leadId } = useParams<{ leadId: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  useEffect(() => { (async () => { const r = await fetch(`/api/command-center/pipeline/leads?limit=500`, { cache: "no-store" }); if (r.ok) { const d = await r.json(); setLead((d.leads || []).find((l: Lead) => l.id === leadId) || null); } })(); }, [leadId]);

  if (!lead) return <Shell><div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading invoice…</div></Shell>;
  const rec = lead.meta?.recommendation;
  if (!rec) return <Shell><Bar leadId={leadId} /><div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No agreed bundle yet — diagnose the client first.</div></Shell>;

  const biz = lead.company || lead.name || "Client";
  const today = new Date(); const due = new Date(today.getTime() + 7 * 864e5);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const invNo = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}-${lead.id.slice(0, 4).toUpperCase()}`;
  const oneTime = rec.items.filter((i) => i.billing === "one-time");
  const monthly = rec.items.filter((i) => i.billing === "monthly");
  const deposit = Math.round(rec.oneTimeTotal * 0.5);
  const dueNow = deposit + rec.monthlyTotal; // 50% deposit + first month
  const balance = rec.oneTimeTotal - deposit;

  return (
    <Shell>
      <Bar leadId={leadId} />
      <div className="paper" style={{ background: "#fff", color: "#18181b", maxWidth: 760, margin: "0 auto", padding: "48px 54px", borderRadius: 6, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PARALLAX.logo} alt="Parallax" width={42} height={42} style={{ display: "block" }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{PARALLAX.legalName}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.7 }}>{PARALLAX.website} · {PARALLAX.email}{PARALLAX.phone ? ` · ${PARALLAX.phone}` : ""}<br />{parallaxAddressLine()}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "2px", color: PARALLAX.accent }}>INVOICE</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.8 }}>{invNo}<br />Issued {fmt(today)}<br /><b style={{ color: "#18181b" }}>Due {fmt(due)}</b></div>
          </div>
        </div>

        <div style={{ marginTop: 26, fontSize: 12.5 }}>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>Bill to</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{biz}</div>
          <div style={{ color: "#52525b" }}>{lead.name || ""}{lead.contact_title ? `, ${lead.contact_title}` : ""}{lead.contact_email ? ` · ${lead.contact_email}` : ""}</div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 24 }}>
          <thead><tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>
            <th style={{ padding: "8px 0" }}>Description</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            {oneTime.map((i) => <tr key={i.id} style={{ borderBottom: "1px solid #f3f4f6" }}><td style={{ padding: "9px 0" }}>{i.name}</td><td style={{ textAlign: "right" }}>${i.price.toLocaleString()}</td></tr>)}
            {monthly.map((i) => <tr key={i.id} style={{ borderBottom: "1px solid #f3f4f6" }}><td style={{ padding: "9px 0" }}>{i.name} <span style={{ color: "#9ca3af" }}>(month 1)</span></td><td style={{ textAlign: "right" }}>${i.price.toLocaleString()}</td></tr>)}
          </tbody>
        </table>

        <div style={{ marginTop: 16, marginLeft: "auto", maxWidth: 300, fontSize: 13 }}>
          <Row label="One-time subtotal" val={`$${rec.oneTimeTotal.toLocaleString()}`} />
          <Row label="Monthly (month 1)" val={`$${rec.monthlyTotal.toLocaleString()}`} />
          <Row label="Deposit (50% of build)" val={`$${deposit.toLocaleString()}`} />
          <div style={{ borderTop: "2px solid #18181b", marginTop: 8, paddingTop: 8 }}>
            <Row label="Amount due now" val={`$${dueNow.toLocaleString()}`} bold accent />
          </div>
          <Row label={`Balance on launch`} val={`$${balance.toLocaleString()}`} muted />
        </div>

        <div style={{ marginTop: 28, fontSize: 12, color: "#52525b", lineHeight: 1.7 }}>
          <b>Payment:</b> {PARALLAX.payment.methods}.{PARALLAX.payment.link ? <> Pay now: {PARALLAX.payment.link}</> : ""}<br />
          <b>Terms:</b> {PARALLAX.payment.terms} Recurring services renew monthly until cancelled with 30 days notice.
        </div>
        <div style={{ marginTop: 30, paddingTop: 12, borderTop: "1px solid #e5e7eb", fontSize: 10.5, color: "#9ca3af", textAlign: "center" }}>Thank you for your business · {PARALLAX.legalName} · {invNo}</div>
      </div>
    </Shell>
  );
}

function Row({ label, val, bold, accent, muted }: { label: string; val: string; bold?: boolean; accent?: boolean; muted?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: bold ? 800 : 400, color: muted ? "#9ca3af" : accent ? PARALLAX.accent : "#18181b", fontSize: bold ? 16 : 13 }}><span>{label}</span><span>{val}</span></div>;
}
function Bar({ leadId }: { leadId: string }) {
  return <div className="no-print" style={{ display: "flex", justifyContent: "space-between", maxWidth: 760, margin: "0 auto 18px" }}>
    <Link href={`/command-center/leads/${leadId}`} style={{ fontSize: 12, color: "var(--t-mid)", textDecoration: "none" }}>← Deal Room</Link>
    <button onClick={() => window.print()} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 700, borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", background: PARALLAX.accent, color: "#001b0c" }}>⤓ Print / Save PDF</button>
  </div>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return <InstrumentPage id="lead-invoice" title="Invoice" section="Business" icon="finance" accent="var(--c-gold)">
    <style>{`@media print { body{background:#fff!important;} .no-print{display:none!important;} .paper{box-shadow:none!important;border-radius:0!important;} }
      @media print { .po-shell .pg { position: static !important; overflow: visible !important; } .po-shell .pg-inner { max-width: none !important; padding: 0 !important; } }`}</style>{children}</InstrumentPage>;
}
