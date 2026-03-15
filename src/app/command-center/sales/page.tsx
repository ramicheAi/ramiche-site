"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";
import pipelineData from "@/data/sales-pipeline.json";

/* ══════════════════════════════════════════════════════════════════════════════
   SALES — MERCURY + HAVEN Revenue Ops & Customer Success
   ══════════════════════════════════════════════════════════════════════════════ */

interface AgentStatus { id: string; name: string; status: string; role: string; }
interface PipelineLead { id: string; name: string; company: string; product: string; stage: string; value: number; lastContact: string; notes: string; }

const STAGE_COLORS: Record<string, string> = { lead: "#6b7280", qualified: "#f59e0b", proposal: "#818cf8", negotiation: "#06b6d4", closed: "#22c55e" };

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
  { id: "mercury", name: "MERCURY", role: "Sales & Revenue Ops", color: "#22c55e" },
  { id: "haven", name: "HAVEN", role: "Customer Success", color: "#06b6d4" },
  { id: "kiyosaki", name: "KIYOSAKI", role: "Financial Intelligence", color: "#f59e0b" },
];

export default function SalesPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents((data.agents || []).filter((a: AgentStatus) => ["mercury", "haven", "kiyosaki"].includes(a.id)));
      }
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30_000); return () => clearInterval(i); }, [fetchData]);

  const leads: PipelineLead[] = pipelineData;
  const stageCounts = leads.reduce<Record<string, number>>((acc, lead) => { acc[lead.stage] = (acc[lead.stage] || 0) + 1; return acc; }, {});
  const totalPipelineValue = leads.reduce((sum, l) => sum + l.value, 0);

  const activeProducts = PRODUCTS.filter((p) => p.active);
  const upcomingProducts = PRODUCTS.filter((p) => !p.active);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 800px 600px at 30% 15%, rgba(34,197,94,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 70% 85%, rgba(6,182,212,0.06) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(34,197,94,0.3)" }}>Sales & Revenue</h1>
          <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>MERCURY · HAVEN · KIYOSAKI — Pipeline, products & customer success</p>
        </div>

        {/* Sales Team */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Sales Team</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          {TEAM.map((agent) => {
            const live = agents.find((a) => a.id === agent.id);
            const statusColor = live?.status === "active" ? "#22c55e" : live?.status === "idle" ? "#f59e0b" : "#6b7280";
            return (
              <div key={agent.id} style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: `0 0 24px ${agent.color}12, 0 8px 32px rgba(0,0,0,0.4)` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${agent.color}18`, color: agent.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>{agent.name[0]}</div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{agent.name}</span>
                      <p style={{ fontSize: 10, color: "#737373", margin: "2px 0 0" }}>{agent.role}</p>
                    </div>
                  </div>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}80` }} />
                </div>
                <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.1em" }}>{live?.status?.toUpperCase() || "OFFLINE"}</span>
              </div>
            );
          })}
        </div>

        {/* Pipeline Stages */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Pipeline Stages</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 32 }}>
          {(["lead", "qualified", "proposal", "negotiation", "closed"] as const).map((stage) => (
            <div key={stage} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: STAGE_COLORS[stage], marginBottom: 4 }}>{stageCounts[stage] || 0}</div>
              <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.15em" }}>{stage.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Pipeline Leads */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", margin: 0, textTransform: "uppercase" }}>Pipeline Leads ({leads.length})</h2>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>${totalPipelineValue.toLocaleString()} total value</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12, marginBottom: 32 }}>
          {leads.map((lead) => (
            <div key={lead.id} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: `1px solid ${STAGE_COLORS[lead.stage]}22`, boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 12px ${STAGE_COLORS[lead.stage]}08` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5" }}>{lead.name}</span>
                  <p style={{ fontSize: 11, color: "#737373", margin: "2px 0 0" }}>{lead.company}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", padding: "3px 8px", borderRadius: 6, background: `${STAGE_COLORS[lead.stage]}18`, color: STAGE_COLORS[lead.stage], textTransform: "uppercase" }}>{lead.stage}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#a3a3a3" }}>{lead.product}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>${lead.value.toLocaleString()}</span>
              </div>
              <p style={{ fontSize: 11, color: "#525252", margin: 0, lineHeight: 1.4 }}>{lead.notes}</p>
              <span style={{ fontSize: 9, color: "#404040", marginTop: 8, display: "block" }}>Last contact: {lead.lastContact}</span>
            </div>
          ))}
        </div>

        {/* Active Products */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Active Products ({activeProducts.length})</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 32 }}>
          {activeProducts.map((product) => (
            <div key={product.name} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", transition: "all 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{product.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>{product.price}</span>
              </div>
              <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.1em" }}>{product.type.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Upcoming */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Upcoming ({upcomingProducts.length})</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 32 }}>
          {upcomingProducts.map((product) => (
            <div key={product.name} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(245,158,11,0.15)", opacity: 0.7, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{product.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(245,158,11,0.6)" }}>{product.price}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.1em" }}>{product.type.toUpperCase()}</span>
                <span style={{ fontSize: 9, color: "rgba(245,158,11,0.5)", letterSpacing: "0.1em" }}>· BETA / COMING SOON</span>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Channels */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Revenue Channels</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { name: "Stripe", status: "Live", products: "Claude Skills, ClawGuard, Setup Service", color: "#635bff" },
            { name: "Upwork", status: "Active", products: "$150/hr — Creative Services", color: "#14a800" },
            { name: "Direct Sales", status: "Active", products: "Ramiche Studio packages", color: "#f59e0b" },
          ].map((channel) => (
            <div key={channel.name} style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 24px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{channel.name}</span>
                <span style={{ fontSize: 10, color: "#22c55e", letterSpacing: "0.1em" }}>{channel.status.toUpperCase()}</span>
              </div>
              <p style={{ fontSize: 12, color: "#737373", margin: 0 }}>{channel.products}</p>
            </div>
          ))}
        </div>

        {/* Sales Intelligence Tools */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", marginBottom: 16, marginTop: 32, textTransform: "uppercase" }}>Sales Intelligence Tools</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { name: "APEX Sales Dashboard", desc: "Lead scoring, email sequences, pipeline projection for METTLE sales", url: "/yolo-builds/2026-03-14-apex-sales-dashboard/index.html", accent: "#C9A84C" },
            { name: "ROI Calculator", desc: "Enterprise ROI calculator for Verified Agent Business — 5 verticals", url: "/yolo-builds/2026-03-13-verified-agent-roi-calculator/index.html", accent: "#22d3ee" },
            { name: "Margin Simulator", desc: "Interactive pricing and margin simulator — MRR, token costs, break-even", url: "/yolo-builds/2026-03-14-agent-margin-simulator/index.html", accent: "#a855f7" },
          ].map((tool) => (
            <div key={tool.name} className="rounded-xl border-2 p-5 transition-all hover:scale-[1.02]" style={{ borderColor: `${tool.accent}33`, background: `${tool.accent}08` }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 4, marginTop: 0 }}>{tool.name}</h4>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12, marginTop: 0 }}>{tool.desc}</p>
              <a href={tool.url} target="_blank" rel="noopener noreferrer" className="rounded border-2 font-semibold tracking-wider transition-all" style={{ fontSize: 12, padding: "6px 12px", borderColor: `${tool.accent}66`, color: tool.accent, textDecoration: "none" }}>
                Launch Tool →
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
