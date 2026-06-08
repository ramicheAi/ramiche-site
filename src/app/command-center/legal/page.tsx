"use client";

import { useState, useEffect, useCallback } from "react";
import { IP_PORTFOLIO, COMPLIANCE_AREAS } from "@/data/legal-status";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

interface AgentStatus {
  id: string;
  name: string;
  status: string;
  role: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "var(--c-green)",
  medium: "var(--c-amber)",
  high: "var(--c-red)",
};

export default function LegalPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents");
      if (res.ok) {
        const data = await res.json();
        const legalAgents = (data.agents || []).filter(
          (a: AgentStatus) => ["themis"].includes(a.id)
        );
        setAgents(legalAgents);
      }
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const themis = agents.find((a) => a.id === "themis");

  return (
    <InstrumentPage id="legal" title="Legal" section="Business" icon="legal" accent="var(--c-indigo)">
      {/* THEMIS Status */}
      <Panel title="THEMIS" icon="legal">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: "color-mix(in srgb, var(--c-indigo) 12%, transparent)", color: "var(--c-indigo)" }}>
            T
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold" style={{ color: "var(--t-hi)" }}>THEMIS</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full tracking-[0.1em]" style={{ background: "color-mix(in srgb, var(--c-indigo) 20%, transparent)", color: "var(--c-indigo)" }}>
                APEX
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--t-mid)" }}>Legal &amp; Compliance Agent — Opus 4.6</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: themis?.status === "active" ? "var(--c-green)" : themis?.status === "idle" ? "var(--c-amber)" : "var(--t-lo)",
                boxShadow: themis?.status === "active" ? "0 0 8px rgba(34,197,94,0.5)" : "none",
              }}
            />
            <span className="text-xs mono" style={{ color: "var(--t-mid)" }}>{themis?.status?.toUpperCase() || "OFFLINE"}</span>
          </div>
        </div>
      </Panel>

      {/* IP Portfolio */}
      <Panel title="IP Portfolio" icon="spark">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {IP_PORTFOLIO.map((ip) => (
            <div
              key={ip.item}
              className="rounded-xl p-4 transition-all"
              style={{ background: "var(--ink-2)", border: "1px solid var(--line)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: "var(--t-hi)" }}>{ip.item}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full tracking-[0.1em] font-medium"
                  style={{ backgroundColor: `${ip.color}20`, color: ip.color }}
                >
                  {ip.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.1em]" style={{ color: "var(--t-lo)" }}>{ip.type.toUpperCase()}</span>
                <span className="text-[10px]" style={{ color: "var(--t-dim)" }}>{ip.date}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Compliance Matrix */}
      <Panel title="Compliance Matrix" icon="check">
        <div className="space-y-2">
          {COMPLIANCE_AREAS.map((item) => (
            <div
              key={item.area}
              className="rounded-lg p-4 flex items-center justify-between"
              style={{ background: "var(--ink-2)", border: "1px solid var(--line)" }}
            >
              <div>
                <span className="text-sm font-medium" style={{ color: "var(--t-hi)" }}>{item.area}</span>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--t-mid)" }}>{item.status}</p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: RISK_COLORS[item.risk] }}
                />
                <span
                  className="text-[10px] tracking-[0.1em] font-medium"
                  style={{ color: RISK_COLORS[item.risk] }}
                >
                  {item.risk.toUpperCase()} RISK
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </InstrumentPage>
  );
}
