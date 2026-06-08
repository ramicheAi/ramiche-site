"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InstrumentPage } from "@/components/command-center/po/Instrument";

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
  meta: { website?: string | null; audit?: { healthScore?: number; gaps?: string[] }; recommendation?: Recommendation; fit?: { fitScore?: number; qualified?: boolean }; disqualified?: boolean } | null;
}

/** Work-order: best targets first — high fit + low digital health (most need), undiagnosed slightly boosted. */
function priority(l: Lead): number {
  const fit = l.meta?.fit?.fitScore ?? 55;
  const health = l.meta?.audit?.healthScore;
  const undiagBoost = l.meta?.audit ? 0 : 8;
  return fit - (health ?? 0) / 2 + undiagBoost;
}

const STAGE_COLOR: Record<string, string> = { lead: "#6b7280", qualified: "#f59e0b", proposal: "#818cf8", negotiation: "#06b6d4", closed: "#22c55e", lost: "#ef4444" };

function scoreColor(s: number): string { return s >= 70 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#ef4444"; }

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showLost, setShowLost] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/pipeline/leads?limit=300", { cache: "no-store" });
      if (res.ok) { const d = await res.json(); setLeads(Array.isArray(d.leads) ? d.leads : []); }
    } catch { /* keep */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const diagnosed = leads.filter((l) => l.meta?.audit).length;
  const lostCount = leads.filter((l) => l.stage === "lost" || l.meta?.disqualified).length;
  const visible = leads
    .filter((l) => showLost || (l.stage !== "lost" && !l.meta?.disqualified))
    .sort((a, b) => priority(b) - priority(a));

  return (
    <InstrumentPage
      id="leads" title="Leads" section="Business" icon="sales" accent="var(--c-green)"
      actions={lostCount > 0 ? <button onClick={() => setShowLost((v) => !v)} style={{ fontSize: 11, color: "var(--t-mid)", background: "transparent", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "6px 11px", cursor: "pointer" }}>{showLost ? "Hide" : "Show"} {lostCount} disqualified</button> : undefined}
    >
      <p style={{ fontSize: 13, color: "var(--t-mid)", margin: "0 0 4px" }}>
        <span style={{ color: "var(--t-hi)", fontWeight: 700 }}>{visible.length} active</span> · {diagnosed} diagnosed — Best‑fit, highest‑need leads first. ⚡ Prep each to research → price → pitch. New leads arrive daily from the auto‑prospector. <Link href="/command-center/prospector" style={{ color: "var(--c-green)" }}>Find more →</Link>
      </p>

      {leads.length === 0 && <div style={{ color: "var(--t-lo)", fontSize: 14, padding: 40, textAlign: "center" }}>No leads yet. <Link href="/command-center/prospector" style={{ color: "var(--c-green)" }}>Run the Prospector →</Link></div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
        {visible.map((l) => {
          const color = STAGE_COLOR[l.stage] || "#6b7280";
          const score = l.meta?.audit?.healthScore;
          const fit = l.meta?.fit?.fitScore;
          return (
            <div key={l.id} style={{ borderRadius: "var(--r-md)", background: "var(--ink-1)", border: `1px solid ${color}22`, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px" }}>
                <Link href={`/command-center/leads/${l.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t-hi)" }}>{l.company || l.name || "Lead"}{typeof fit === "number" && fit >= 60 ? <span style={{ fontSize: 10, color: "var(--c-green)", marginLeft: 8, fontWeight: 700 }}>🎯 strong fit</span> : null}</div>
                  <div style={{ fontSize: 11, color: "var(--t-lo)", marginTop: 3 }}>
                    <span style={{ color, textTransform: "uppercase", fontWeight: 700 }}>{l.stage}</span>
                    {l.source ? ` · ${l.source}` : ""}{l.value ? ` · $${l.value.toLocaleString()} ACV` : ""}
                    {typeof fit === "number" ? <> · fit <span style={{ color: fit >= 60 ? "var(--c-green)" : "var(--t-mid)", fontWeight: 700 }}>{fit}</span></> : ""}
                    {typeof score === "number" ? <> · health <span style={{ color: scoreColor(score), fontWeight: 700 }}>{score}</span></> : ""}
                  </div>
                </Link>
                {!l.meta?.audit ? (
                  <Link href={`/command-center/leads/${l.id}`} style={{ ...btn("#06b6d4", false), textDecoration: "none" }}>⚡ Prep →</Link>
                ) : (
                  <Link href={`/command-center/leads/${l.id}`} style={{ ...btn("#22c55e", false), textDecoration: "none" }}>Open Deal Room →</Link>
                )}
                <Link href={`/command-center/leads/${l.id}`} style={{ fontSize: 12, color: "var(--t-lo)", textDecoration: "none" }}>▸</Link>
              </div>
            </div>
          );
        })}
      </div>
    </InstrumentPage>
  );
}

function btn(color: string, busy: boolean): React.CSSProperties {
  return { padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: busy ? "default" : "pointer", whiteSpace: "nowrap", background: `${color}1a`, color, border: `1px solid ${color}55` };
}
