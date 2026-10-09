"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { InstrumentPage } from "@/components/command-center/po/Instrument";
import { fetchLiveLeads, type LiveLead } from "@/lib/leads-loader";

/* ══════════════════════════════════════════════════════════════════════════════
   LEADS — diagnose each lead's digital presence, get a value-priced service
   bundle, and turn it into a proposal. The bridge from Prospector → revenue.
   ══════════════════════════════════════════════════════════════════════════════ */

type LoadState =
  | { status: "loading" }
  | { status: "ready"; source: string; sourceCheckedAt: string }
  | { status: "error"; message: string };

/** Work-order: best targets first — high fit + low digital health (most need) +
 *  bigger winnable deals (ACV), with undiagnosed leads slightly boosted. */
function priority(l: LiveLead): number {
  const fit = l.meta?.fit?.fitScore ?? 55;
  const health = l.meta?.audit?.healthScore;
  const undiagBoost = l.meta?.audit ? 0 : 8;
  // Revenue weight: a $10k ACV deal ≈ +10, capped so it sharpens (not dominates) order.
  const acvBoost = typeof l.value === "number" ? Math.min(25, l.value / 1000) : 0;
  return fit - (health ?? 0) / 2 + undiagBoost + acvBoost;
}

const STAGE_COLOR: Record<string, string> = { lead: "#6b7280", qualified: "#f59e0b", proposal: "#818cf8", negotiation: "#06b6d4", closed: "#22c55e", lost: "#ef4444" };

function scoreColor(s: number): string { return s >= 70 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#ef4444"; }

export default function LeadsPage() {
  const [leads, setLeads] = useState<LiveLead[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [showLost, setShowLost] = useState(false);
  const activeRequest = useRef<{ id: number; controller: AbortController } | null>(null);
  const nextRequestId = useRef(0);

  const load = useCallback(() => {
    activeRequest.current?.controller.abort();
    const request = { id: ++nextRequestId.current, controller: new AbortController() };
    activeRequest.current = request;
    setLoadState({ status: "loading" });
    void fetchLiveLeads(fetch, { signal: request.controller.signal }).then((result) => {
      if (activeRequest.current?.id !== request.id || request.controller.signal.aborted) return;
      if (!result.ok) {
        setLoadState({ status: "error", message: result.message });
        return;
      }
      setLeads(result.leads);
      setLoadState({ status: "ready", source: result.source, sourceCheckedAt: result.sourceCheckedAt });
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      activeRequest.current?.controller.abort();
    };
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
        {loadState.status === "ready" ? <><span style={{ color: "var(--t-hi)", fontWeight: 700 }}>{visible.length} active</span> · {diagnosed} diagnosed</> : <span style={{ color: "var(--t-hi)", fontWeight: 700 }}>Live lead count unavailable</span>} — Best‑fit, highest‑need leads first. ⚡ Prep each to research → price → pitch. New leads arrive daily from the auto‑prospector. <Link href="/command-center/prospector" style={{ color: "var(--c-green)" }}>Find more →</Link>
      </p>

      {loadState.status === "loading" && <div role="status" style={{ color: "var(--t-lo)", fontSize: 14, padding: 40, textAlign: "center" }}>Loading live CRM leads…</div>}

      {loadState.status === "error" && <div role="alert" style={{ color: "#ef4444", fontSize: 14, padding: 40, textAlign: "center", border: "1px solid #ef444455", borderRadius: "var(--r-md)", marginTop: 20 }}>
        <div style={{ fontWeight: 700 }}>CRM data unavailable</div>
        <div style={{ marginTop: 6 }}>{loadState.message} No cached or sample leads are being shown.</div>
        <button type="button" onClick={load} style={{ ...btn("#ef4444", false), marginTop: 14 }}>Retry live CRM</button>
      </div>}

      {loadState.status === "ready" && <div style={{ color: "var(--t-lo)", fontSize: 11, marginTop: 8 }}>
        Source: {loadState.source} · Checked {new Date(loadState.sourceCheckedAt).toLocaleString()}
      </div>}

      {loadState.status === "ready" && leads.length === 0 && <div style={{ color: "var(--t-lo)", fontSize: 14, padding: 40, textAlign: "center" }}>No leads found in the live CRM. <Link href="/command-center/prospector" style={{ color: "var(--c-green)" }}>Run the Prospector →</Link></div>}

      {loadState.status === "ready" && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
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
      </div>}
    </InstrumentPage>
  );
}

function btn(color: string, busy: boolean): React.CSSProperties {
  return { padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: busy ? "default" : "pointer", whiteSpace: "nowrap", background: `${color}1a`, color, border: `1px solid ${color}55` };
}
