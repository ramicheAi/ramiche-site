"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   LEADS — diagnose each lead's digital presence, get a value-priced service
   bundle, and turn it into a proposal. The bridge from Prospector → revenue.
   ══════════════════════════════════════════════════════════════════════════════ */

interface RecItem { id: string; name: string; billing: "one-time" | "monthly"; price: number; value: string; }
interface Recommendation { items: RecItem[]; oneTimeTotal: number; monthlyTotal: number; rationale: string[]; }
interface Lead {
  id: string; name: string | null; company: string | null; product: string | null;
  stage: string; source: string | null; value: number;
  notes: string | null;
  meta: { website?: string | null; audit?: { healthScore?: number; gaps?: string[] }; recommendation?: Recommendation } | null;
}

const STAGE_COLOR: Record<string, string> = { lead: "#6b7280", qualified: "#f59e0b", proposal: "#818cf8", negotiation: "#06b6d4", closed: "#22c55e", lost: "#ef4444" };

function scoreColor(s: number): string { return s >= 70 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#ef4444"; }

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/pipeline/leads?limit=300", { cache: "no-store" });
      if (res.ok) { const d = await res.json(); setLeads(Array.isArray(d.leads) ? d.leads : []); }
    } catch { /* keep */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const diagnose = useCallback(async (id: string) => {
    setBusy(id); setMsg(null);
    try {
      const res = await fetch("/api/command-center/pipeline/diagnose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId: id }) });
      if (!res.ok) { const d = await res.json(); setMsg(d.error || "Diagnose failed"); }
      else { setOpen(id); await load(); }
    } finally { setBusy(null); }
  }, [load]);

  const createProposal = useCallback(async (lead: Lead) => {
    const rec = lead.meta?.recommendation;
    if (!rec) return;
    setBusy(lead.id); setMsg(null);
    try {
      const acv = rec.oneTimeTotal + rec.monthlyTotal * 12;
      const res = await fetch("/api/command-center/pipeline/proposals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, product: "Web + Growth Bundle", tier: `${rec.items.length} services`, monthly_price: rec.monthlyTotal, annual_value: acv, status: "draft", terms: rec }),
      });
      if (res.ok) setMsg(`Proposal created for ${lead.company || lead.name}.`);
      else { const d = await res.json(); setMsg(d.error || "Proposal failed"); }
      await load();
    } finally { setBusy(null); }
  }, [load]);

  const diagnosed = leads.filter((l) => l.meta?.audit).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "32px 28px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none" }}>← COMMAND CENTER</Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 8 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Leads</h1>
          <span style={{ fontSize: 12, color: "#737373" }}>{leads.length} leads · {diagnosed} diagnosed</span>
        </div>
        <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>Diagnose a lead&apos;s digital presence → get a value-priced bundle → create the proposal. <Link href="/command-center/prospector" style={{ color: "#22c55e" }}>Find more leads →</Link></p>

        {msg && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", fontSize: 13 }}>{msg}</div>}

        {leads.length === 0 && <div style={{ color: "#52525b", fontSize: 14, padding: 40, textAlign: "center" }}>No leads yet. <Link href="/command-center/prospector" style={{ color: "#22c55e" }}>Run the Prospector →</Link></div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
          {leads.map((l) => {
            const color = STAGE_COLOR[l.stage] || "#6b7280";
            const isOpen = open === l.id;
            const score = l.meta?.audit?.healthScore;
            const rec = l.meta?.recommendation;
            return (
              <div key={l.id} style={{ borderRadius: 12, background: "rgba(0,0,0,0.6)", border: `1px solid ${color}22`, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px" }}>
                  <div onClick={() => setOpen(isOpen ? null : l.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{l.company || l.name || "Lead"}</div>
                    <div style={{ fontSize: 11, color: "#71717a", marginTop: 3 }}>
                      <span style={{ color, textTransform: "uppercase", fontWeight: 700 }}>{l.stage}</span>
                      {l.source ? ` · ${l.source}` : ""}{l.value ? ` · $${l.value.toLocaleString()} ACV` : ""}
                      {typeof score === "number" ? <> · health <span style={{ color: scoreColor(score), fontWeight: 700 }}>{score}</span></> : ""}
                    </div>
                  </div>
                  {!l.meta?.audit ? (
                    <button onClick={() => diagnose(l.id)} disabled={busy === l.id} style={btn("#7c3aed", busy === l.id)}>{busy === l.id ? "Diagnosing…" : "⚗ Diagnose"}</button>
                  ) : (
                    <button onClick={() => createProposal(l)} disabled={busy === l.id} style={btn("#22c55e", busy === l.id)}>{busy === l.id ? "…" : "→ Proposal"}</button>
                  )}
                  <span onClick={() => setOpen(isOpen ? null : l.id)} style={{ fontSize: 12, color: "#52525b", cursor: "pointer" }}>{isOpen ? "▾" : "▸"}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "4px 18px 18px 18px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    {!l.meta?.audit && <div style={{ color: "#71717a", fontSize: 13, marginTop: 12 }}>{l.notes || "Not yet diagnosed. Click Diagnose to audit their digital presence and build a quote."}</div>}
                    {l.meta?.audit && rec && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Gaps found</div>
                        <ul style={{ margin: "0 0 16px", paddingLeft: 18, color: "#a1a1aa", fontSize: 12.5, lineHeight: 1.7 }}>
                          {rec.rationale.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                        <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Recommended bundle</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {rec.items.map((it) => (
                            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <div><span style={{ fontWeight: 600 }}>{it.name}</span> <span style={{ fontSize: 11, color: "#71717a" }}>— {it.value}</span></div>
                              <div style={{ whiteSpace: "nowrap", color: it.billing === "monthly" ? "#a855f7" : "#22c55e", fontWeight: 700 }}>${it.price.toLocaleString()}{it.billing === "monthly" ? "/mo" : ""}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 22, marginTop: 12, fontSize: 13 }}>
                          <span>One-time: <b style={{ color: "#22c55e" }}>${rec.oneTimeTotal.toLocaleString()}</b></span>
                          <span>Recurring: <b style={{ color: "#a855f7" }}>${rec.monthlyTotal.toLocaleString()}/mo</b></span>
                          <span>ACV: <b style={{ color: "#fcd34d" }}>${(rec.oneTimeTotal + rec.monthlyTotal * 12).toLocaleString()}</b></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function btn(color: string, busy: boolean): React.CSSProperties {
  return { padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: busy ? "default" : "pointer", whiteSpace: "nowrap", background: `${color}1a`, color, border: `1px solid ${color}55` };
}
