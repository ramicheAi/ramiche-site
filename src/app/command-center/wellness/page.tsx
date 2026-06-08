"use client";

import { useState, useEffect, useCallback } from "react";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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
    <InstrumentPage
      id="wellness"
      title="Wellness & Training"
      section="Specialist"
      icon="pulse"
      accent="var(--c-teal)"
    >
      <p className="mono" style={{ fontSize: 12, color: "var(--t-mid)", letterSpacing: "0.12em", margin: "0 0 20px" }}>
        SELAH · MICHAEL — Mental performance, sport psychology &amp; swim coaching
      </p>

      {/* Wellness Team */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
        {[
          { id: "selah", name: "SELAH", role: "Wellness & Sport Psychology", desc: "Mental performance, stress management, emotional clarity", color: "var(--c-cyan)", tier: "LOCAL" },
          { id: "michael", name: "MICHAEL", role: "Swim Training AI", desc: "Race strategy, training plans, technique analysis", color: "var(--c-green)", tier: "LOCAL" },
        ].map((agent) => {
          const live = agents.find((a) => a.id === agent.id);
          return (
            <Panel key={agent.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                <div
                  style={{ width: 56, height: 56, borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, backgroundColor: `color-mix(in srgb, ${agent.color} 14%, transparent)`, color: agent.color }}
                >
                  {agent.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--t-hi)" }}>{agent.name}</span>
                    <span className="mono" style={{ fontSize: 9, padding: "2px 8px", borderRadius: "var(--r-sm)", background: "color-mix(in srgb, var(--c-amber) 18%, transparent)", color: "var(--c-amber)", letterSpacing: "0.1em" }}>
                      {agent.tier}
                    </span>
                  </div>
                  <p style={{ color: "var(--t-mid)", fontSize: 12, margin: "2px 0 0" }}>{agent.role}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 12, height: 12, borderRadius: "50%",
                      backgroundColor: live?.status === "active" ? "var(--c-green)" : live?.status === "idle" ? "var(--c-amber)" : "var(--t-lo)",
                      boxShadow: live?.status === "active" ? "0 0 8px color-mix(in srgb, var(--c-green) 50%, transparent)" : "none",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--t-mid)" }}>{live?.status?.toUpperCase() || "OFFLINE"}</span>
                </div>
              </div>
              <p style={{ color: "var(--t-lo)", fontSize: 12, margin: 0 }}>{agent.desc}</p>
            </Panel>
          );
        })}
      </div>

      {/* METTLE Connection */}
      <Panel title="METTLE Integration" icon="gateway" style={{ marginBottom: 20, borderColor: "color-mix(in srgb, var(--c-teal) 22%, var(--line))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, marginTop: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--c-teal)", boxShadow: "0 0 8px color-mix(in srgb, var(--c-teal) 50%, transparent)" }} />
          <span className="mono" style={{ fontSize: 11, color: "var(--c-teal)", letterSpacing: "0.15em", fontWeight: 600 }}>BETA ACTIVE</span>
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: "var(--t-hi)" }}>Saint Andrew&apos;s Aquatics — 240+ Athletes</h3>
        <p style={{ color: "var(--t-mid)", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          MICHAEL powers swim-specific training within METTLE. SELAH provides mental performance coaching.
          Both agents support the ARM three-portal system.
        </p>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          {["Coach Portal", "Athlete Portal", "Parent Portal"].map((p) => (
            <span key={p} style={{ padding: "4px 8px", fontSize: 10, background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", letterSpacing: "0.1em", color: "var(--t-mid)" }}>
              {p}
            </span>
          ))}
        </div>
      </Panel>

      {/* Focus Areas */}
      <Panel title="Focus Areas" icon="command">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" style={{ marginTop: 6 }}>
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
              style={{ background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 16 }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t-hi)" }}>{item.area}</span>
              <p style={{ color: "var(--t-lo)", fontSize: 10, margin: "4px 0 0" }}>{item.desc}</p>
              <span className="mono" style={{ fontSize: 9, color: "color-mix(in srgb, var(--c-teal) 70%, transparent)", letterSpacing: "0.1em", marginTop: 8, display: "block" }}>{item.agent}</span>
            </div>
          ))}
        </div>
      </Panel>
    </InstrumentPage>
  );
}
