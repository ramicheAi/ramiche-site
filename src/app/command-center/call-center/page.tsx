"use client";

import { useState, useEffect, useCallback } from "react";
import { InstrumentPage, Panel, PgBtn } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   CALL CENTER — Mercury's observe + approve seat.
   Ranked daily call list (who to call, compliance-gated) + the leading-indicator
   dashboard. Placing a call is a GATED action (the Call button = the approval).
   Wired to /api/command-center/voice/{call-list,metrics,call}.
   ══════════════════════════════════════════════════════════════════════════════ */

const CYAN = "var(--c-cyan, #00f0ff)";
const PURPLE = "var(--c-purple, #a855f7)";
const AMBER = "var(--c-amber, #f59e0b)";

interface Candidate {
  leadId: string;
  businessName: string;
  vertical: string;
  city: string;
  phone: string | null;
  score: number;
  warm: boolean;
  callable: boolean;
  reasons: string[];
  blockers: string[];
  gapCount: number;
}

interface Metrics {
  placed: number;
  connected: number;
  connectRate: number;
  booked: number;
  bookRate: number;
  callbacks: number;
  captureCompleteness: number;
  disclosureRate: number;
  avgScore: number;
  totalCost: number;
  costPerBooked: number | null;
  costPerCall: number | null;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function CallCenterPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [callableNow, setCallableNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [callableOnly, setCallableOnly] = useState(false);
  const [calling, setCalling] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [cl, mt] = await Promise.all([
        fetch(`/api/command-center/voice/call-list?limit=25${callableOnly ? "&callableOnly=1" : ""}`),
        fetch(`/api/command-center/voice/metrics`),
      ]);
      if (cl.ok) {
        const d = await cl.json();
        setCandidates(d.candidates || []);
        setCallableNow(d.callableNow || 0);
      } else {
        setErr("Couldn't load the call list — is Supabase configured?");
      }
      if (mt.ok) {
        const d = await mt.json();
        setMetrics(d.metrics || null);
      }
    } catch {
      setErr("Network error loading the call center.");
    } finally {
      setLoading(false);
    }
  }, [callableOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const placeCall = useCallback(async (c: Candidate) => {
    setCalling(c.leadId);
    setResult((p) => ({ ...p, [c.leadId]: "Calling…" }));
    try {
      const res = await fetch(`/api/command-center/voice/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: c.leadId }),
      });
      const d = await res.json();
      setResult((p) => ({
        ...p,
        [c.leadId]: d.placed
          ? `Placed · ${d.status || "queued"}`
          : d.needsSetup
            ? "Phone line not wired yet (Vapi/Twilio)"
            : d.error || "failed",
      }));
    } catch {
      setResult((p) => ({ ...p, [c.leadId]: "network error" }));
    } finally {
      setCalling(null);
    }
  }, []);

  const tile = (label: string, value: string, accent: string) => (
    <div style={{ flex: "1 1 120px", minWidth: 120, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );

  return (
    <InstrumentPage
      id="call-center"
      title="Call Center"
      section="Growth"
      icon="phone"
      accent={CYAN}
      actions={<PgBtn icon="refresh" onClick={load}>Refresh</PgBtn>}
    >
      {/* ── Leading indicators ─────────────────────────────────────────── */}
      <Panel title="Leading Indicators" icon="activity" badge={metrics ? `${metrics.placed} calls` : undefined}>
        {!metrics || metrics.placed === 0 ? (
          <p style={{ opacity: 0.6, fontSize: 13, margin: "6px 2px" }}>
            No calls logged yet. Metrics populate once Mercury starts dialing (connect rate · book rate · capture completeness · cost per booked).
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {tile("Connect rate", pct(metrics.connectRate), CYAN)}
            {tile("Book rate", pct(metrics.bookRate), PURPLE)}
            {tile("Booked", String(metrics.booked), PURPLE)}
            {tile("Callbacks", String(metrics.callbacks), AMBER)}
            {tile("Brief capture", pct(metrics.captureCompleteness), CYAN)}
            {tile("Disclosure", pct(metrics.disclosureRate), "#34d399")}
            {tile("Avg QA score", String(metrics.avgScore), AMBER)}
            {tile("Cost / booked", metrics.costPerBooked != null ? `$${metrics.costPerBooked}` : "—", "#34d399")}
          </div>
        )}
      </Panel>

      {/* ── The ranked call list ───────────────────────────────────────── */}
      <Panel
        title="Today's Call List"
        icon="target"
        badge={
          <button
            onClick={() => setCallableOnly((v) => !v)}
            style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, cursor: "pointer", border: `1px solid ${callableOnly ? CYAN : "rgba(255,255,255,0.15)"}`, background: callableOnly ? "rgba(0,240,255,0.12)" : "transparent", color: callableOnly ? CYAN : "inherit" }}
          >
            {callableOnly ? "Callable only ✓" : `Callable now: ${callableNow}`}
          </button>
        }
      >
        {loading ? (
          <p style={{ opacity: 0.6, fontSize: 13, margin: "6px 2px" }}>Loading the pipeline…</p>
        ) : err ? (
          <p style={{ color: AMBER, fontSize: 13, margin: "6px 2px" }}>{err}</p>
        ) : candidates.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: 13, margin: "6px 2px" }}>No open leads to call. Run the Prospector to refill the pipeline.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {candidates.map((c, i) => (
              <div
                key={c.leadId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${c.callable ? "rgba(0,240,255,0.18)" : "rgba(255,255,255,0.07)"}`,
                  opacity: c.callable ? 1 : 0.62,
                }}
              >
                <div style={{ width: 26, textAlign: "center", fontWeight: 700, opacity: 0.5, fontSize: 13 }}>{i + 1}</div>
                <div style={{ width: 46, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.warm ? PURPLE : CYAN }}>{c.score}</div>
                  <div style={{ fontSize: 9, opacity: 0.5 }}>score</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.businessName}</span>
                    {c.warm && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "rgba(168,85,247,0.18)", color: PURPLE }}>WARM</span>}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                    {c.vertical}{c.city ? ` · ${c.city}` : ""}{c.phone ? ` · ${c.phone}` : ""}{c.gapCount ? ` · ${c.gapCount} gaps` : ""}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                    {(c.callable ? c.reasons : c.blockers).slice(0, 2).join(" · ")}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 110 }}>
                  {result[c.leadId] ? (
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{result[c.leadId]}</div>
                  ) : (
                    <button
                      disabled={!c.callable || calling === c.leadId}
                      onClick={() => placeCall(c)}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "7px 14px",
                        borderRadius: 999,
                        cursor: c.callable ? "pointer" : "not-allowed",
                        border: "none",
                        background: c.callable ? CYAN : "rgba(255,255,255,0.08)",
                        color: c.callable ? "#08131a" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {calling === c.leadId ? "…" : "Call"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <p style={{ fontSize: 11, opacity: 0.45, margin: "4px 4px 24px" }}>
        Calls are gated — pressing Call is the approval. Mercury discloses it&apos;s an AI, runs the CLOSER script grounded in each lead&apos;s gaps, captures the brief, and writes it back to the lead. Compliance gate (consent · DNC · calling hours · dedup) runs before every dial.
      </p>
    </InstrumentPage>
  );
}
