"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

interface AgentStatus {
  id: string;
  name: string;
  status: string;
  role: string;
}

const IP_PORTFOLIO = [
  { type: "Copyright", item: "METTLE Software", status: "Filed", date: "Feb 17, 2026", color: "#22c55e" },
  { type: "Patent", item: "METTLE ARM System", status: "Filing", date: "In progress", color: "#f59e0b" },
  { type: "Trademark", item: "METTLE (Class 9+41+42)", status: "Recommended", date: "Pending", color: "#818cf8" },
  { type: "Copyright", item: "OpenClaw Framework", status: "Protectable", date: "Not filed", color: "#6b7280" },
];

const COMPLIANCE_AREAS = [
  { area: "Data Privacy (CCPA/GDPR)", status: "Needs Review", risk: "medium" },
  { area: "AI Agent Liability", status: "Framework Needed", risk: "high" },
  { area: "Terms of Service", status: "Draft", risk: "medium" },
  { area: "Client Contracts", status: "Template Ready", risk: "low" },
  { area: "Stripe/Payment Compliance", status: "Active", risk: "low" },
  { area: "Apple App Store Guidelines", status: "Needs Review", risk: "medium" },
];

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
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
    <div className="relative min-h-screen text-white overflow-hidden" style={{ background: "#000000" }}>
      <ParticleField />

      <div className="relative z-10 px-4 sm:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/command-center" className="text-xs text-white/40 hover:text-white/70 tracking-[0.2em] transition-colors">
              ← COMMAND CENTER
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500">LEGAL</span>
              <span className="text-white/40 ml-2 text-lg font-light">& COMPLIANCE</span>
            </h1>
            <p className="text-white/30 text-xs tracking-[0.15em] mt-1">
              THEMIS — Legal governance, IP protection & regulatory compliance
            </p>
          </div>
        </div>

        {/* THEMIS Status */}
        <div className="bg-white/[0.03] border-2 border-amber-500/20 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold bg-amber-500/10 text-amber-400">
              T
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">THEMIS</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 tracking-[0.1em]">
                  APEX
                </span>
              </div>
              <p className="text-white/30 text-xs">Legal & Compliance Agent — Opus 4.6</p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: themis?.status === "active" ? "#22c55e" : themis?.status === "idle" ? "#f59e0b" : "#6b7280",
                  boxShadow: themis?.status === "active" ? "0 0 8px rgba(34,197,94,0.5)" : "none",
                }}
              />
              <span className="text-xs text-white/30">{themis?.status?.toUpperCase() || "OFFLINE"}</span>
            </div>
          </div>
        </div>

        {/* IP Portfolio */}
        <h2 className="text-xs text-white/40 tracking-[0.2em] font-medium mb-3">IP PORTFOLIO</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {IP_PORTFOLIO.map((ip) => (
            <div
              key={ip.item}
              className="bg-white/[0.03] border-2 border-white/10 rounded-xl p-4 hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{ip.item}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full tracking-[0.1em] font-medium"
                  style={{ backgroundColor: `${ip.color}20`, color: ip.color }}
                >
                  {ip.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/25 tracking-[0.1em]">{ip.type.toUpperCase()}</span>
                <span className="text-[10px] text-white/20">{ip.date}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Compliance Matrix */}
        <h2 className="text-xs text-white/40 tracking-[0.2em] font-medium mb-3">COMPLIANCE MATRIX</h2>
        <div className="space-y-2 mb-8">
          {COMPLIANCE_AREAS.map((item) => (
            <div
              key={item.area}
              className="bg-white/[0.03] border-2 border-white/10 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <span className="text-sm font-medium">{item.area}</span>
                <p className="text-white/25 text-[10px] mt-0.5">{item.status}</p>
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
      </div>
    </div>
  );
}
