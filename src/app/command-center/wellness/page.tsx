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

export default function WellnessPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents");
      if (res.ok) {
        const data = await res.json();
        const wellnessAgents = (data.agents || []).filter(
          (a: AgentStatus) => ["selah", "michael"].includes(a.id)
        );
        setAgents(wellnessAgents);
      }
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500">WELLNESS</span>
              <span className="text-white/40 ml-2 text-lg font-light">& TRAINING</span>
            </h1>
            <p className="text-white/30 text-xs tracking-[0.15em] mt-1">
              SELAH · MICHAEL — Mental performance, sport psychology & swim coaching
            </p>
          </div>
        </div>

        {/* Wellness Team */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[
            { id: "selah", name: "SELAH", role: "Wellness & Sport Psychology", desc: "Mental performance, stress management, emotional clarity", color: "#06b6d4", tier: "LOCAL" },
            { id: "michael", name: "MICHAEL", role: "Swim Training AI", desc: "Race strategy, training plans, technique analysis", color: "#22c55e", tier: "LOCAL" },
          ].map((agent) => {
            const live = agents.find((a) => a.id === agent.id);
            return (
              <div
                key={agent.id}
                className="bg-white/[0.03] border-2 border-white/10 rounded-xl p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold"
                    style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
                  >
                    {agent.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">{agent.name}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 tracking-[0.1em]">
                        {agent.tier}
                      </span>
                    </div>
                    <p className="text-white/30 text-xs">{agent.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: live?.status === "active" ? "#22c55e" : live?.status === "idle" ? "#f59e0b" : "#6b7280",
                        boxShadow: live?.status === "active" ? "0 0 8px rgba(34,197,94,0.5)" : "none",
                      }}
                    />
                    <span className="text-xs text-white/30">{live?.status?.toUpperCase() || "OFFLINE"}</span>
                  </div>
                </div>
                <p className="text-white/20 text-xs">{agent.desc}</p>
              </div>
            );
          })}
        </div>

        {/* METTLE Connection */}
        <h2 className="text-xs text-white/40 tracking-[0.2em] font-medium mb-3">METTLE INTEGRATION</h2>
        <div className="bg-white/[0.03] border-2 border-teal-500/20 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
            <span className="text-xs text-teal-400 tracking-[0.15em] font-medium">BETA ACTIVE</span>
          </div>
          <h3 className="text-sm font-bold mb-1">Saint Andrew&apos;s Aquatics — 240+ Athletes</h3>
          <p className="text-white/30 text-xs">
            MICHAEL powers swim-specific training within METTLE. SELAH provides mental performance coaching.
            Both agents support the ARM three-portal system.
          </p>
          <div className="mt-3 flex gap-2">
            {["Coach Portal", "Athlete Portal", "Parent Portal"].map((p) => (
              <span key={p} className="px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded tracking-[0.1em] text-white/40">
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Focus Areas */}
        <h2 className="text-xs text-white/40 tracking-[0.2em] font-medium mb-3">FOCUS AREAS</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { area: "Mental Performance", agent: "SELAH", desc: "Pre-race mindset, competition anxiety, focus training" },
            { area: "Race Strategy", agent: "MICHAEL", desc: "Pacing, turns, starts, race-day preparation" },
            { area: "Recovery", agent: "SELAH", desc: "Post-competition debrief, burnout prevention" },
            { area: "Training Plans", agent: "MICHAEL", desc: "Periodization, volume tracking, taper protocols" },
            { area: "Goal Setting", agent: "SELAH", desc: "Season goals, milestone tracking, motivation" },
            { area: "Technique Analysis", agent: "MICHAEL", desc: "Stroke mechanics, efficiency metrics, video review" },
          ].map((item) => (
            <div
              key={item.area}
              className="bg-white/[0.03] border-2 border-white/10 rounded-xl p-4 hover:border-teal-500/20 transition-all"
            >
              <span className="text-sm font-semibold">{item.area}</span>
              <p className="text-white/25 text-[10px] mt-1">{item.desc}</p>
              <span className="text-[9px] text-teal-400/50 tracking-[0.1em] mt-2 block">{item.agent}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
