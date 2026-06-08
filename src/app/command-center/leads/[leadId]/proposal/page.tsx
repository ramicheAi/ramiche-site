"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PARALLAX, parallaxAddressLine } from "@/lib/parallax-co";
import { deliveryFor } from "@/lib/delivery-playbook";
import { InstrumentPage } from "@/components/command-center/po/Instrument";

/* Full, branded, print/PDF-ready proposal document for one client. */

interface RecItem { id: string; name: string; billing: "one-time" | "monthly"; price: number; value: string; }
interface Intel { businessType?: string; summary?: string; services?: string[]; personalizedHooks?: string[]; competitors?: { name: string; edge: string }[]; brandVibe?: string }
interface Lead {
  id: string; name: string | null; company: string | null; product: string | null; contact_email: string | null; notes: string | null;
  meta: { audit?: { healthScore?: number }; recommendation?: { items: RecItem[]; oneTimeTotal: number; monthlyTotal: number; rationale: string[] }; intel?: Intel } | null;
}

export default function ProposalDoc() {
  const { leadId } = useParams<{ leadId: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  useEffect(() => { (async () => { const r = await fetch(`/api/command-center/pipeline/leads?limit=500`, { cache: "no-store" }); if (r.ok) { const d = await r.json(); setLead((d.leads || []).find((l: Lead) => l.id === leadId) || null); } })(); }, [leadId]);

  if (!lead) return <Shell><div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading proposal…</div></Shell>;
  const rec = lead.meta?.recommendation; const intel = lead.meta?.intel;
  const biz = lead.company || lead.name || "Your Business";
  const today = new Date(); const valid = new Date(today.getTime() + 30 * 864e5);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const acv = rec ? rec.oneTimeTotal + rec.monthlyTotal * 12 : 0;
  const propNo = `PVI-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}-${(lead.id.slice(0, 4)).toUpperCase()}`;
  const oneTimeItems = rec?.items.filter((i) => i.billing === "one-time") || [];
  const monthlyItems = rec?.items.filter((i) => i.billing === "monthly") || [];

  if (!rec) return <Shell><Bar leadId={leadId} /><div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Diagnose this client first to generate the proposal.</div></Shell>;

  return (
    <Shell>
      <Bar leadId={leadId} />
      <div className="paper" style={{ background: "#fff", color: "#18181b", maxWidth: 820, margin: "0 auto", padding: "56px 60px", borderRadius: 6, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        {/* Letterhead */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${PARALLAX.accent}`, paddingBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PARALLAX.logo} alt="Parallax" width={48} height={48} style={{ display: "block" }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}>{PARALLAX.legalName}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{PARALLAX.division} · {PARALLAX.tagline}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
            {PARALLAX.website}<br />{PARALLAX.email}{PARALLAX.phone ? <> · {PARALLAX.phone}</> : null}<br />{parallaxAddressLine()}
          </div>
        </div>

        {/* Title block */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: "2px", color: PARALLAX.accent, fontWeight: 700 }}>PROPOSAL</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: "6px 0 0", letterSpacing: "-1px" }}>Growth Plan for {biz}</h1>
          <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 10, display: "flex", gap: 22, flexWrap: "wrap" }}>
            <span>Prepared for <b style={{ color: "#18181b" }}>{biz}</b>{lead.notes ? ` · ${lead.notes}` : ""}</span>
            <span>No. {propNo}</span><span>Date {fmt(today)}</span><span>Valid until {fmt(valid)}</span>
          </div>
        </div>

        {/* Executive summary */}
        <Section title="Executive Summary">
          <p>{intel?.summary ? `${intel.summary} ` : `${biz} is a ${intel?.businessType || lead.product || "local business"} in ${lead.notes || "the area"}. `}
          Today, potential customers searching online can&apos;t easily find or trust you — which means business is walking to competitors who show up first. This plan fixes that, end to end, and turns your online presence into a steady source of new customers.</p>
        </Section>

        {/* Opportunity */}
        <Section title="The Opportunity">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>{rec.rationale.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {intel?.competitors?.length ? <p style={{ marginTop: 12, color: "#6b7280", fontSize: 12.5 }}><b>Competitive note:</b> {intel.competitors.map((c) => `${c.name} (${c.edge})`).join("; ")}.</p> : null}
        </Section>

        {/* Solution */}
        <Section title="Our Solution">
          {rec.items.map((it) => { const d = deliveryFor(it.id); return (
            <div key={it.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <b style={{ fontSize: 14 }}>{it.name}</b>
                <span style={{ whiteSpace: "nowrap", fontWeight: 700, color: it.billing === "monthly" ? "#7c3aed" : PARALLAX.accent }}>${it.price.toLocaleString()}{it.billing === "monthly" ? "/mo" : ""}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "#52525b", marginTop: 3 }}>{it.value}{d ? ` — delivered via our ${d.system} (${d.timeline}).` : ""}</div>
            </div>
          ); })}
        </Section>

        {/* Investment */}
        <Section title="Investment">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {oneTimeItems.length > 0 && <tr><td colSpan={2} style={{ paddingTop: 6, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>One-time build</td></tr>}
              {oneTimeItems.map((i) => <tr key={i.id}><td style={{ padding: "5px 0" }}>{i.name}</td><td style={{ textAlign: "right" }}>${i.price.toLocaleString()}</td></tr>)}
              {monthlyItems.length > 0 && <tr><td colSpan={2} style={{ paddingTop: 12, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>Monthly growth services</td></tr>}
              {monthlyItems.map((i) => <tr key={i.id}><td style={{ padding: "5px 0" }}>{i.name}</td><td style={{ textAlign: "right" }}>${i.price.toLocaleString()}/mo</td></tr>)}
            </tbody>
          </table>
          <div style={{ borderTop: "2px solid #e5e7eb", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontWeight: 700 }}>
            <span>One-time: ${rec.oneTimeTotal.toLocaleString()}</span>
            <span style={{ color: "#7c3aed" }}>Monthly: ${rec.monthlyTotal.toLocaleString()}/mo</span>
            <span style={{ color: PARALLAX.accent }}>First-year value: ${acv.toLocaleString()}</span>
          </div>
          <p style={{ fontSize: 11.5, color: "#6b7280", marginTop: 10 }}>Terms: {PARALLAX.payment.terms} Payment: {PARALLAX.payment.methods}.</p>
        </Section>

        {/* Why us */}
        <Section title={`Why ${PARALLAX.brand}`}>
          <p>We&apos;re a creative technology studio that ships fast and proves it. You see a live preview before anything goes public, your first win lands in days (not months), and everything is done-for-you. No long contracts — earn-your-business, month to month.</p>
        </Section>

        {/* Acceptance */}
        <Section title="Acceptance">
          <p style={{ marginBottom: 26 }}>To get started, sign below or reply to {PARALLAX.email}. We&apos;ll send a secure invoice and begin within 48 hours.</p>
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            {[biz, PARALLAX.legalName].map((who) => (
              <div key={who} style={{ flex: 1, minWidth: 220 }}>
                <div style={{ borderTop: "1px solid #18181b", paddingTop: 6, fontSize: 12 }}>{who}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Signature · Date</div>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ marginTop: 36, paddingTop: 14, borderTop: "1px solid #e5e7eb", fontSize: 10.5, color: "#9ca3af", textAlign: "center" }}>
          {PARALLAX.legalName} · {PARALLAX.website} · Proposal {propNo}
        </div>
      </div>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginTop: 26 }}><div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: PARALLAX.accent, marginBottom: 10 }}>{title}</div><div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#27272a" }}>{children}</div></div>;
}
function Bar({ leadId }: { leadId: string }) {
  return (
    <div className="no-print" style={{ display: "flex", justifyContent: "space-between", maxWidth: 820, margin: "0 auto 18px", alignItems: "center" }}>
      <Link href={`/command-center/leads/${leadId}`} style={{ fontSize: 12, color: "var(--t-mid)", textDecoration: "none" }}>← Deal Room</Link>
      <button onClick={() => window.print()} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 700, borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", background: PARALLAX.accent, color: "#001b0c" }}>⤓ Print / Save PDF</button>
    </div>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return <InstrumentPage id="lead-proposal" title="Proposal" section="Business" icon="proposals" accent="var(--c-amber)">
    <style>{`@media print { body { background:#fff !important; } .no-print{display:none!important;} .paper{box-shadow:none!important;border-radius:0!important;margin:0!important;} }
      @media print { .po-shell .pg { position: static !important; overflow: visible !important; } .po-shell .pg-inner { max-width: none !important; padding: 0 !important; } }`}</style>
    {children}
  </InstrumentPage>;
}
