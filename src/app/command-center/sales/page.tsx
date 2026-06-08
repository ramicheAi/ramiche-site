"use client";

import { useState, useEffect, useCallback } from "react";
import pipelineData from "@/data/sales-pipeline.json";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   SALES — MERCURY + HAVEN Revenue Ops & Customer Success
   ══════════════════════════════════════════════════════════════════════════════ */

interface AgentStatus { id: string; name: string; status: string; role: string; }
interface PipelineLead { id: string; name: string; company: string; product: string; stage: string; value: number; lastContact: string; notes: string; }

const STAGE_COLORS: Record<string, string> = { lead: "var(--t-lo)", qualified: "var(--c-amber)", proposal: "var(--c-indigo)", negotiation: "var(--c-cyan)", closed: "var(--c-green)" };

const PRODUCTS = [
  { name: "Claude Skills", price: "$149-499", type: "Agent Marketplace", active: true },
  { name: "Setup Service", price: "$299", type: "White-Glove", active: true },
  { name: "Ramiche Studio Sprint", price: "$400", type: "Creative Services", active: true },
  { name: "Ramiche Studio Starter", price: "$1,500", type: "Creative Services", active: true },
  { name: "Ramiche Studio Pro", price: "$3,000", type: "Creative Services", active: true },
  { name: "Ramiche Studio Elite", price: "$6,000+", type: "Creative Services", active: true },
  { name: "ClawGuard Scan", price: "$299", type: "Security", active: true },
  { name: "ClawGuard Team", price: "$799", type: "Security", active: true },
  { name: "ClawGuard Enterprise", price: "$1,499", type: "Security", active: true },
  { name: "METTLE Coach", price: "$149/mo", type: "SaaS", active: false },
  { name: "METTLE Team", price: "$349/mo", type: "SaaS", active: false },
  { name: "Verified Agents", price: "$100-500/hr", type: "Agent Rental", active: false },
];

const TEAM = [
  { id: "mercury", name: "MERCURY", role: "Sales & Revenue Ops", color: "var(--c-green)" },
  { id: "haven", name: "HAVEN", role: "Customer Success", color: "var(--c-cyan)" },
  { id: "kiyosaki", name: "KIYOSAKI", role: "Financial Intelligence", color: "var(--c-amber)" },
];

export default function SalesPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  // Live pipeline leads from the DB-backed API; null until loaded / on failure
  // we fall back to the static seed file so the page is never empty.
  const [dbLeads, setDbLeads] = useState<PipelineLead[] | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents((data.agents || []).filter((a: AgentStatus) => ["mercury", "haven", "kiyosaki"].includes(a.id)));
      }
    } catch { /* keep existing */ }
    finally { setLoading(false); }

    try {
      const pres = await fetch("/api/command-center/pipeline/leads?limit=500");
      if (pres.ok) {
        const pdata = await pres.json();
        const rows = Array.isArray(pdata.leads) ? pdata.leads : [];
        if (rows.length > 0) {
          setDbLeads(rows.map((r: Record<string, unknown>): PipelineLead => ({
            id: String(r.id),
            name: String(r.name ?? ""),
            company: String(r.company ?? ""),
            product: String(r.product ?? ""),
            stage: String(r.stage ?? "lead"),
            value: Number(r.value) || 0,
            lastContact: String(r.last_contact ?? r.updated_at ?? "").slice(0, 10),
            notes: String(r.notes ?? ""),
          })));
        }
      }
    } catch { /* fall back to seed */ }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30_000); return () => clearInterval(i); }, [fetchData]);

  // Live data when present, otherwise the static seed.
  const leads: PipelineLead[] = dbLeads && dbLeads.length > 0 ? dbLeads : pipelineData;
  const stageCounts = leads.reduce<Record<string, number>>((acc, lead) => { acc[lead.stage] = (acc[lead.stage] || 0) + 1; return acc; }, {});
  const totalPipelineValue = leads.reduce((sum, l) => sum + l.value, 0);

  const activeProducts = PRODUCTS.filter((p) => p.active);
  const upcomingProducts = PRODUCTS.filter((p) => !p.active);

  return (
    <InstrumentPage id="sales" title="Sales" section="Business" icon="sales" accent="var(--c-amber)">
      {/* Sales Team */}
      <Panel title="Sales Team" icon="agents" badge={<span className="mono">{TEAM.length}</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {TEAM.map((agent) => {
            const live = agents.find((a) => a.id === agent.id);
            const statusColor = live?.status === "active" ? "var(--c-green)" : live?.status === "idle" ? "var(--c-amber)" : "var(--t-lo)";
            return (
              <div key={agent.id} style={{ padding: 24, borderRadius: "var(--r-lg)", background: "var(--ink-2)", border: "1px solid var(--line)", boxShadow: `0 0 24px ${agent.color}12, 0 8px 32px rgba(0,0,0,0.4)` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${agent.color}18`, color: agent.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>{agent.name[0]}</div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t-hi)" }}>{agent.name}</span>
                      <p style={{ fontSize: 10, color: "var(--t-mid)", margin: "2px 0 0" }}>{agent.role}</p>
                    </div>
                  </div>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}80` }} />
                </div>
                <span className="mono" style={{ fontSize: 10, color: "var(--t-lo)", letterSpacing: "0.1em" }}>{live?.status?.toUpperCase() || "OFFLINE"}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Pipeline Stages */}
      <Panel title="Pipeline Stages" icon="dashboard">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {(["lead", "qualified", "proposal", "negotiation", "closed"] as const).map((stage) => (
            <div key={stage} style={{ padding: 20, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "1px solid var(--line)", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: STAGE_COLORS[stage], marginBottom: 4 }}>{stageCounts[stage] || 0}</div>
              <span className="mono" style={{ fontSize: 10, color: "var(--t-lo)", letterSpacing: "0.15em" }}>{stage.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Pipeline Leads */}
      <Panel
        title={`Pipeline Leads (${leads.length})`}
        icon="dispatch"
        badge={<span className="mono" style={{ color: "var(--c-green)", fontWeight: 700 }}>${totalPipelineValue.toLocaleString()} total value</span>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {leads.map((lead) => (
            <div key={lead.id} style={{ padding: 20, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: `1px solid ${STAGE_COLORS[lead.stage]}22`, boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 12px ${STAGE_COLORS[lead.stage]}08` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t-hi)" }}>{lead.name}</span>
                  <p style={{ fontSize: 11, color: "var(--t-mid)", margin: "2px 0 0" }}>{lead.company}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", padding: "3px 8px", borderRadius: 6, background: `${STAGE_COLORS[lead.stage]}18`, color: STAGE_COLORS[lead.stage], textTransform: "uppercase" }}>{lead.stage}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--t-mid)" }}>{lead.product}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-green)" }}>${lead.value.toLocaleString()}</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--t-lo)", margin: 0, lineHeight: 1.4 }}>{lead.notes}</p>
              <span style={{ fontSize: 9, color: "var(--t-dim)", marginTop: 8, display: "block" }}>Last contact: {lead.lastContact}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Active Products */}
      <Panel title={`Active Products (${activeProducts.length})`} icon="spark">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {activeProducts.map((product) => (
            <div key={product.name} style={{ padding: 20, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "1px solid var(--line)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", transition: "all 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t-hi)" }}>{product.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-green)" }}>{product.price}</span>
              </div>
              <span className="mono" style={{ fontSize: 10, color: "var(--t-lo)", letterSpacing: "0.1em" }}>{product.type.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Upcoming */}
      <Panel title={`Upcoming (${upcomingProducts.length})`} icon="clock">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {upcomingProducts.map((product) => (
            <div key={product.name} style={{ padding: 20, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "1px solid color-mix(in srgb, var(--c-amber) 15%, transparent)", opacity: 0.7, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t-hi)" }}>{product.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-amber)", opacity: 0.7 }}>{product.price}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--t-lo)", letterSpacing: "0.1em" }}>{product.type.toUpperCase()}</span>
                <span className="mono" style={{ fontSize: 9, color: "var(--c-amber)", opacity: 0.6, letterSpacing: "0.1em" }}>· BETA / COMING SOON</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Revenue Channels */}
      <Panel title="Revenue Channels" icon="finance">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { name: "Stripe", status: "Live", products: "Claude Skills, ClawGuard, Setup Service", color: "#635bff" },
            { name: "Upwork", status: "Active", products: "$150/hr — Creative Services", color: "#14a800" },
            { name: "Direct Sales", status: "Active", products: "Ramiche Studio packages", color: "var(--c-amber)" },
          ].map((channel) => (
            <div key={channel.name} style={{ padding: 24, borderRadius: "var(--r-lg)", background: "var(--ink-2)", border: "1px solid var(--line)", boxShadow: "0 0 24px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t-hi)" }}>{channel.name}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--c-green)", letterSpacing: "0.1em" }}>{channel.status.toUpperCase()}</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--t-mid)", margin: 0 }}>{channel.products}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Sales Intelligence Tools */}
      <Panel title="Sales Intelligence Tools" icon="spark">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { name: "APEX Sales Dashboard", desc: "Lead scoring, email sequences, pipeline projection for METTLE sales", url: "/api/command-center/yolo-builds/preview/2026-03-14-apex-sales-dashboard/index.html", accent: "#C9A84C" },
            { name: "ROI Calculator", desc: "Enterprise ROI calculator for Verified Agent Business — 5 verticals", url: "/api/command-center/yolo-builds/preview/2026-03-13-verified-agent-roi-calculator/index.html", accent: "#22d3ee" },
            { name: "Margin Simulator", desc: "Interactive pricing and margin simulator — MRR, token costs, break-even", url: "/api/command-center/yolo-builds/preview/2026-03-14-agent-margin-simulator/index.html", accent: "#a855f7" },
          ].map((tool) => (
            <div key={tool.name} className="rounded-xl border-2 p-5 transition-all hover:scale-[1.02]" style={{ borderColor: `${tool.accent}33`, background: `${tool.accent}08` }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--t-hi)", marginBottom: 4, marginTop: 0 }}>{tool.name}</h4>
              <p style={{ fontSize: 12, color: "var(--t-mid)", marginBottom: 12, marginTop: 0 }}>{tool.desc}</p>
              <a href={tool.url} target="_blank" rel="noopener noreferrer" className="rounded border-2 font-semibold tracking-wider transition-all" style={{ fontSize: 12, padding: "6px 12px", borderColor: `${tool.accent}66`, color: tool.accent, textDecoration: "none" }}>
                Launch Tool →
              </a>
            </div>
          ))}
        </div>
      </Panel>
    </InstrumentPage>
  );
}
