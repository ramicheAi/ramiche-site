"use client";
import { cockpitFetch } from '@/lib/cockpit-fetch';


import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CALL_OUTCOMES, outcomeMeta, agoLabel, type CallEntry, type CallOutcome } from "@/lib/call-outcomes";
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
  meta: { website?: string | null; audit?: { healthScore?: number; gaps?: string[] }; recommendation?: Recommendation; fit?: { fitScore?: number; qualified?: boolean }; disqualified?: boolean; calls?: CallEntry[]; lastCall?: CallEntry; callbackDue?: string | null } | null;
}

function callbackOverdue(l: Lead): boolean {
  const due = l.meta?.callbackDue;
  return typeof due === "string" && Date.parse(due) <= Date.now();
}

/** Work-order: best targets first — high fit + low digital health (most need) +
 *  bigger winnable deals (ACV), with undiagnosed leads slightly boosted. A due
 *  callback is a promise to a human — it outranks everything. */
function priority(l: Lead): number {
  const fit = l.meta?.fit?.fitScore ?? 55;
  const health = l.meta?.audit?.healthScore;
  const undiagBoost = l.meta?.audit ? 0 : 8;
  // Revenue weight: a $10k ACV deal ≈ +10, capped so it sharpens (not dominates) order.
  const acvBoost = typeof l.value === "number" ? Math.min(25, l.value / 1000) : 0;
  const callbackBoost = callbackOverdue(l) ? 1000 : 0;
  return fit - (health ?? 0) / 2 + undiagBoost + acvBoost + callbackBoost;
}

const STAGE_COLOR: Record<string, string> = { lead: "#6b7280", qualified: "#f59e0b", proposal: "#818cf8", negotiation: "#06b6d4", closed: "#22c55e", lost: "#ef4444" };

function scoreColor(s: number): string { return s >= 70 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#ef4444"; }

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showLost, setShowLost] = useState(false);
  const [callFor, setCallFor] = useState<string | null>(null); // lead id with the quick-log strip open
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await cockpitFetch("/api/command-center/pipeline/leads?limit=300", { cache: "no-store" });
      if (res.ok) { const d = await res.json(); setLeads(Array.isArray(d.leads) ? d.leads : []); }
    } catch { /* keep */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const quickLog = useCallback(async (leadId: string, outcome: CallOutcome) => {
    setLogging(true);
    setLogError(null);
    try {
      const res = await cockpitFetch("/api/command-center/leads/call", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId, outcome }) });
      if (res.ok) { setCallFor(null); await load(); }
      else setLogError(`Call not logged (HTTP ${res.status}). Try again.`);
    } catch {
      setLogError("Call not logged (network). Try again.");
    } finally { setLogging(false); }
  }, [load]);

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
          const lastCall = l.meta?.lastCall;
          const callCount = l.meta?.calls?.length ?? 0;
          const lo = lastCall ? outcomeMeta(lastCall.outcome) : null;
          return (
            <div key={l.id} style={{ borderRadius: "var(--r-md)", background: "var(--ink-1)", border: `1px solid ${color}22`, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px" }}>
                <Link href={`/command-center/leads/${l.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t-hi)" }}>{l.company || l.name || "Lead"}{callbackOverdue(l) ? <span style={{ fontSize: 10, color: "#f59e0b", marginLeft: 8, fontWeight: 800, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 9, padding: "2px 8px" }}>🔁 CALLBACK DUE</span> : null}{typeof fit === "number" && fit >= 60 ? <span style={{ fontSize: 10, color: "var(--c-green)", marginLeft: 8, fontWeight: 700 }}>🎯 strong fit</span> : null}</div>
                  <div style={{ fontSize: 11, color: "var(--t-lo)", marginTop: 3 }}>
                    <span style={{ color, textTransform: "uppercase", fontWeight: 700 }}>{l.stage}</span>
                    {l.source ? ` · ${l.source}` : ""}{l.value ? ` · $${l.value.toLocaleString()} ACV` : ""}
                    {typeof fit === "number" ? <> · fit <span style={{ color: fit >= 60 ? "var(--c-green)" : "var(--t-mid)", fontWeight: 700 }}>{fit}</span></> : ""}
                    {typeof score === "number" ? <> · health <span style={{ color: scoreColor(score), fontWeight: 700 }}>{score}</span></> : ""}
                    {lastCall && lo ? <> · 📞 {callCount > 1 ? `${callCount}× · ` : ""}<span style={{ color: lo.color, fontWeight: 700 }}>{lo.short}</span> {agoLabel(lastCall.at)}</> : ""}
                  </div>
                </Link>
                <button onClick={() => setCallFor(callFor === l.id ? null : l.id)} title="Log a call" style={{ ...btn(callFor === l.id ? "#f59e0b" : "#818cf8", false), padding: "7px 11px" }}>📞</button>
                {!l.meta?.audit ? (
                  <Link href={`/command-center/leads/${l.id}`} style={{ ...btn("#06b6d4", false), textDecoration: "none" }}>⚡ Prep →</Link>
                ) : (
                  <Link href={`/command-center/leads/${l.id}`} style={{ ...btn("#22c55e", false), textDecoration: "none" }}>Open Deal Room →</Link>
                )}
                <Link href={`/command-center/leads/${l.id}`} style={{ fontSize: 12, color: "var(--t-lo)", textDecoration: "none" }}>▸</Link>
              </div>
              {callFor === l.id && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 18px", borderTop: "1px solid var(--line)", background: "var(--ink-0)" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--t-mid)", whiteSpace: "nowrap" }}>I called —</span>
                  {CALL_OUTCOMES.map((o) => (
                    <button key={o.key} onClick={() => quickLog(l.id, o.key)} disabled={logging}
                      style={{ padding: "5px 11px", fontSize: 11.5, fontWeight: 700, borderRadius: 18, cursor: logging ? "default" : "pointer", whiteSpace: "nowrap", background: `${o.color}14`, color: o.color, border: `1px solid ${o.color}55`, opacity: logging ? 0.6 : 1 }}>
                      {o.label}
                    </button>
                  ))}
                  {logError ? <span role="alert" style={{ fontSize: 11, color: "var(--c-red)" }}>{logError}</span> : null}
                </div>
              )}
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
