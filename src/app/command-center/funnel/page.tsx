"use client";

import { useState, useEffect, useCallback } from "react";
import { InstrumentPage, Panel, PgBtn } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   FUNNEL — the leak map. sourced → researched → qualified → contacted → proposal →
   won, plus the DEAD-LEAD rate (the number the Qualification Engine drives down) and
   $ pipeline vs $ won. Read-only; wired to /api/command-center/pipeline/funnel.
   ══════════════════════════════════════════════════════════════════════════════ */

const CYAN = "var(--c-cyan, #00f0ff)";
const PURPLE = "var(--c-purple, #a855f7)";
const AMBER = "var(--c-amber, #f59e0b)";
const GREEN = "#22c55e";
const RED = "#ef4444";

interface Funnel {
  sourced: number; researched: number; qualified: number; contacted: number;
  proposals: number; won: number; disqualified: number;
  disqualifiedByCode: Record<string, number>;
  contactedByChannel: { call: number; email: number };
  bySource: Record<string, { sourced: number; qualified: number; won: number; wonValue: number }>;
  pipelineValue: number; wonValue: number;
  rates: { qualifyRate: number; deadLeadRate: number; contactRate: number; proposalRate: number; winRate: number };
}

interface Segment {
  vertical: string; city: string; sourced: number; researched: number;
  qualifyRate: number; winRate: number; effectiveScore: number; confidence: number;
}

const money = (n: number) => "$" + n.toLocaleString("en-US");

const STEP_META: { key: keyof Funnel; label: string; color: string; rate?: keyof Funnel["rates"]; rateLabel?: string }[] = [
  { key: "sourced", label: "Sourced", color: "#64748b" },
  { key: "researched", label: "Researched", color: CYAN, rate: "qualifyRate", rateLabel: "qualify" },
  { key: "qualified", label: "Qualified", color: GREEN },
  { key: "contacted", label: "Contacted", color: PURPLE, rate: "contactRate", rateLabel: "contact" },
  { key: "proposals", label: "Proposals", color: AMBER, rate: "proposalRate", rateLabel: "proposal" },
  { key: "won", label: "Won", color: "#fcd34d", rate: "winRate", rateLabel: "win" },
];

const DQ_LABELS: Record<string, string> = {
  closed: "Closed / dissolved",
  unreachable: "No contact (ghost)",
  chain: "National chain",
  self_sufficient: "Already self-sufficient",
  other: "Other / legacy",
};

export default function FunnelPage() {
  const [f, setF] = useState<Funnel | null>(null);
  const [segs, setSegs] = useState<Segment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [fr, ir] = await Promise.all([
        fetch("/api/command-center/pipeline/funnel", { cache: "no-store" }),
        fetch("/api/command-center/pipeline/icp", { cache: "no-store" }),
      ]);
      const fd = await fr.json();
      if (!fr.ok) throw new Error(fd.error || "failed");
      setF(fd.funnel as Funnel);
      if (ir.ok) { const id = await ir.json(); setSegs((id.segments || []) as Segment[]); }
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const max = f ? Math.max(f.sourced, 1) : 1;

  return (
    <InstrumentPage id="funnel" title="Funnel" section="Business" icon="◎" accent={GREEN}
      actions={<PgBtn icon="↻" onClick={() => void load()}>Refresh</PgBtn>}>

      {loading && <Panel><div style={{ padding: 24, opacity: 0.6 }}>Loading funnel…</div></Panel>}
      {err && <Panel><div style={{ padding: 24, color: RED }}>Couldn’t load funnel: {err}</div></Panel>}

      {f && (
        <>
          {/* Headline numbers */}
          <Panel title="Pipeline at a glance" icon="◎">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, padding: 14 }}>
              <Stat label="$ in play" value={money(f.pipelineValue)} color={CYAN} />
              <Stat label="$ won" value={money(f.wonValue)} color="#fcd34d" />
              <Stat label="Dead-lead rate" value={`${f.rates.deadLeadRate}%`} color={f.rates.deadLeadRate > 40 ? RED : GREEN} sub={`${f.disqualified} of ${f.researched} researched`} />
              <Stat label="Win rate" value={`${f.rates.winRate}%`} color={GREEN} sub="won / proposals" />
            </div>
          </Panel>

          {/* The funnel bars */}
          <Panel title="The funnel" icon="▼">
            <div style={{ padding: "10px 16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {STEP_META.map((s) => {
                const n = f[s.key] as number;
                const w = Math.max(2, Math.round((n / max) * 100));
                return (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 96, fontSize: 13, opacity: 0.85, textAlign: "right" }}>{s.label}</div>
                    <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 6, height: 28, position: "relative", overflow: "hidden" }}>
                      <div style={{ width: `${w}%`, height: "100%", background: `linear-gradient(90deg, ${s.color}cc, ${s.color}55)`, borderRadius: 6, transition: "width .4s", boxShadow: `0 0 14px ${s.color}44` }} />
                      <span style={{ position: "absolute", left: 10, top: 5, fontWeight: 700, fontSize: 13 }}>{n.toLocaleString()}</span>
                    </div>
                    <div style={{ width: 92, fontSize: 12, opacity: 0.7 }}>
                      {s.rate ? `${f.rates[s.rate]}% ${s.rateLabel}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Dead-lead control — what the Qualification Engine is killing + why */}
          <Panel title="Dead-lead control" icon="✕" badge={`${f.disqualified} killed`}>
            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              {Object.keys(DQ_LABELS).map((code) => {
                const n = f.disqualifiedByCode[code] || 0;
                return (
                  <div key={code} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px", background: n ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: n ? RED : "#64748b" }}>{n}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{DQ_LABELS[code]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "0 16px 16px", fontSize: 12, opacity: 0.6 }}>
              These never reached pricing, prep, or outreach — saved cost + protected reputation. Drive this rate down by sharpening the prospector’s targeting (see ICP signals below).
            </div>
          </Panel>

          {/* By source — where do qualified leads + closes actually come from? */}
          {Object.keys(f.bySource).length > 0 && (
            <Panel title="By source" icon="◎" badge={`call ${f.contactedByChannel.call} · email ${f.contactedByChannel.email}`}>
              <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
                {Object.entries(f.bySource).sort((a, b) => b[1].sourced - a[1].sourced).map(([src, s]) => (
                  <div key={src} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: CYAN }}>{src}</div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      {s.sourced} sourced · {s.qualified} qualified · {s.won} won
                    </div>
                    {s.wonValue > 0 && <div style={{ fontSize: 12, color: "#fcd34d", marginTop: 2 }}>{money(s.wonValue)} won</div>}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Learned ICP — the prospector auto-biases tomorrow's sourcing to these */}
          {segs.length > 0 && (
            <Panel title="What's working — learned ICP" icon="◎" badge="prospector auto-biases here">
              <div style={{ padding: 14, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", opacity: 0.6, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <th style={{ padding: "6px 8px" }}>Segment</th>
                      <th style={{ padding: "6px 8px" }}>Sourced</th>
                      <th style={{ padding: "6px 8px" }}>Qualify%</th>
                      <th style={{ padding: "6px 8px" }}>Win%</th>
                      <th style={{ padding: "6px 8px" }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segs.slice(0, 8).map((s) => (
                      <tr key={`${s.vertical}|${s.city}`} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "8px" }}><strong>{s.vertical}</strong> <span style={{ opacity: 0.6 }}>· {s.city}</span></td>
                        <td style={{ padding: "8px", opacity: 0.85 }}>{s.sourced}</td>
                        <td style={{ padding: "8px", color: GREEN }}>{s.qualifyRate}%</td>
                        <td style={{ padding: "8px", color: "#fcd34d" }}>{s.winRate}%</td>
                        <td style={{ padding: "8px", fontWeight: 800, color: s.effectiveScore > 55 ? GREEN : s.effectiveScore < 45 ? RED : "#94a3b8" }}>{s.effectiveScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
                  The daily prospector now spends ~70% on proven winners, ~20% adjacent, ~10% exploring. Score blends qualify-rate now and win-rate as deals close (shrunk toward neutral until a segment has enough data).
                </div>
              </div>
            </Panel>
          )}
        </>
      )}
    </InstrumentPage>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px", background: "rgba(255,255,255,0.02)" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
