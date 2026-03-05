"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   3D OFFICE — Immersive Agent Workspace
   Isometric 3D office where each agent has a workstation with live status
   ══════════════════════════════════════════════════════════════════════════════ */

interface Agent {
  name: string;
  role: string;
  model: string;
  status: "online" | "idle" | "busy" | "offline";
  task?: string;
  avatar: string;
  color: string;
  deskType: "engineering" | "strategy" | "creative" | "security" | "analytics" | "comms";
}

const AGENTS: Agent[] = [
  { name: "Atlas", role: "Operations Lead", model: "Opus 4.6", status: "online", task: "Building 3D Office", avatar: "/agents/atlas-3d.png", color: "#8B5CF6", deskType: "strategy" },
  { name: "SHURI", role: "Engineering", model: "DeepSeek V3.2", status: "idle", task: "Awaiting task", avatar: "/agents/shuri-3d.png", color: "#EC4899", deskType: "engineering" },
  { name: "TRIAGE", role: "Diagnostics", model: "Sonnet 4.5", status: "idle", avatar: "/agents/triage-3d.png", color: "#EF4444", deskType: "engineering" },
  { name: "NOVA", role: "Fabrication", model: "Sonnet 4.5", status: "busy", task: "YOLO Build #33", avatar: "/agents/nova-3d.png", color: "#F59E0B", deskType: "creative" },
  { name: "PROXIMON", role: "Architecture", model: "Gemini 3 Pro", status: "idle", avatar: "/agents/proximon-3d.png", color: "#06B6D4", deskType: "strategy" },
  { name: "AETHERION", role: "Meta-Systems", model: "Gemini 3 Pro", status: "offline", avatar: "/agents/aetherion-3d.png", color: "#A855F7", deskType: "strategy" },
  { name: "MERCURY", role: "Sales", model: "Gemini 3 Pro", status: "idle", avatar: "/agents/mercury-3d.png", color: "#10B981", deskType: "analytics" },
  { name: "VEE", role: "Brand Strategy", model: "Kimi K2.5", status: "idle", avatar: "/agents/vee-3d.png", color: "#F472B6", deskType: "creative" },
  { name: "INK", role: "Copywriting", model: "DeepSeek V3.2", status: "idle", avatar: "/agents/ink-3d.png", color: "#6366F1", deskType: "creative" },
  { name: "ECHO", role: "Community", model: "Kimi K2.5", status: "idle", avatar: "/agents/echo-3d.png", color: "#22D3EE", deskType: "comms" },
  { name: "HAVEN", role: "Support", model: "DeepSeek V3.2", status: "idle", avatar: "/agents/haven-3d.png", color: "#34D399", deskType: "comms" },
  { name: "WIDOW", role: "Security", model: "Haiku 3.5", status: "online", task: "Perimeter scan", avatar: "/agents/widow-3d.png", color: "#DC2626", deskType: "security" },
  { name: "DR STRANGE", role: "Forecasting", model: "DeepSeek V3.2", status: "idle", avatar: "/agents/drstrange-3d.png", color: "#7C3AED", deskType: "analytics" },
  { name: "KIYOSAKI", role: "Finance", model: "DeepSeek V3.2", status: "idle", avatar: "/agents/kiyosaki-3d.png", color: "#059669", deskType: "analytics" },
  { name: "SIMONS", role: "Data Analysis", model: "DeepSeek V3.2", status: "idle", avatar: "/agents/simons-3d.png", color: "#2563EB", deskType: "analytics" },
  { name: "MICHAEL", role: "Swim Coach", model: "GLM 4.6", status: "idle", avatar: "/agents/michael-3d.png", color: "#0EA5E9", deskType: "strategy" },
  { name: "SELAH", role: "Psychology", model: "DeepSeek V3.2", status: "idle", avatar: "/agents/selah-3d.png", color: "#D946EF", deskType: "comms" },
  { name: "PROPHETS", role: "Wisdom", model: "Kimi K2.5", status: "idle", avatar: "/agents/prophets-3d.png", color: "#F59E0B", deskType: "comms" },
  { name: "TheMAESTRO", role: "Music", model: "DeepSeek V3.2", status: "idle", avatar: "/agents/themaestro-3d.png", color: "#E11D48", deskType: "creative" },
  { name: "THEMIS", role: "Governance", model: "Sonnet 4.5", status: "online", task: "Protocol watch", avatar: "/agents/themis-3d.png", color: "#CA8A04", deskType: "security" },
];

const STATUS_COLORS: Record<string, string> = {
  online: "#22C55E",
  busy: "#F59E0B",
  idle: "#6B7280",
  offline: "#374151",
};

const DESK_ICONS: Record<string, string> = {
  engineering: "⌨️",
  strategy: "🗺️",
  creative: "🎨",
  security: "🛡️",
  analytics: "📊",
  comms: "📡",
};

export default function OfficePage() {
  const [selected, setSelected] = useState<Agent | null>(null);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTime((p) => p + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const statusCounts = {
    online: AGENTS.filter((a) => a.status === "online").length,
    busy: AGENTS.filter((a) => a.status === "busy").length,
    idle: AGENTS.filter((a) => a.status === "idle").length,
    offline: AGENTS.filter((a) => a.status === "offline").length,
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white relative overflow-hidden">
      <ParticleField />

      {/* Header */}
      <div className="relative z-10 border-b-2 border-purple-500/30 bg-[#0D0D15]/90 backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/command-center" className="text-gray-400 hover:text-white text-sm">
              ← Command Center
            </Link>
            <span className="text-[#555]">|</span>
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              THE OFFICE
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> {statusCounts.online} online</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> {statusCounts.busy} busy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#737373]" /> {statusCounts.idle} idle</span>
          </div>
        </div>
      </div>

      {/* 3D Office Floor */}
      <div className="relative z-10 p-4">
        <div
          className="mx-auto"
          style={{
            perspective: "1200px",
            perspectiveOrigin: "50% 30%",
            maxWidth: "1400px",
          }}
        >
          {/* Office Floor Plane */}
          <div
            style={{
              transform: "rotateX(55deg) rotateZ(-45deg)",
              transformStyle: "preserve-3d",
              position: "relative",
              width: "100%",
              paddingBottom: "60%",
            }}
          >
            {/* Grid floor */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: `
                  linear-gradient(rgba(139,92,246,0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(139,92,246,0.08) 1px, transparent 1px)
                `,
                backgroundSize: "40px 40px",
                border: "2px solid rgba(139,92,246,0.15)",
                boxShadow: "0 0 60px rgba(139,92,246,0.1)",
              }}
            />

            {/* Agent Workstations */}
            {AGENTS.map((agent, i) => {
              const cols = 5;
              const row = Math.floor(i / cols);
              const col = i % cols;
              const xPct = 8 + col * 18;
              const yPct = 8 + row * 22;
              const isActive = agent.status === "online" || agent.status === "busy";
              const pulse = isActive && time % 2 === 0;

              return (
                <div
                  key={agent.name}
                  onClick={() => setSelected(agent)}
                  className="absolute cursor-pointer group"
                  style={{
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    width: "14%",
                    transform: "rotateZ(45deg) rotateX(-55deg)",
                    transformStyle: "preserve-3d",
                    zIndex: 20 - row,
                  }}
                >
                  {/* Desk surface */}
                  <div
                    className="rounded-lg p-2 transition-all duration-300 group-hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, ${agent.color}15, ${agent.color}08)`,
                      border: `2px solid ${agent.color}${isActive ? "60" : "25"}`,
                      boxShadow: isActive
                        ? `0 0 20px ${agent.color}30, inset 0 0 15px ${agent.color}10`
                        : `0 0 8px ${agent.color}10`,
                      animation: pulse ? "pulse 2s ease-in-out infinite" : undefined,
                    }}
                  >
                    {/* Status dot */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] sm:text-[10px] font-bold truncate" style={{ color: agent.color }}>
                        {agent.name}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: STATUS_COLORS[agent.status],
                          boxShadow: isActive ? `0 0 6px ${STATUS_COLORS[agent.status]}` : undefined,
                        }}
                      />
                    </div>

                    {/* Desk icon + role */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]">{DESK_ICONS[agent.deskType]}</span>
                      <span className="text-[8px] text-gray-500 truncate">{agent.role}</span>
                    </div>

                    {/* Task (if active) */}
                    {agent.task && (
                      <div className="mt-1 text-[7px] text-gray-400 truncate bg-white/5 rounded px-1 py-0.5">
                        {agent.task}
                      </div>
                    )}

                    {/* Monitor glow effect */}
                    {isActive && (
                      <div
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-2 rounded-t-sm"
                        style={{
                          background: `linear-gradient(to top, ${agent.color}40, transparent)`,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Room labels */}
            <div
              className="absolute text-[10px] text-purple-400/40 font-mono uppercase tracking-widest"
              style={{ left: "3%", top: "2%", transform: "rotateZ(45deg) rotateX(-55deg)" }}
            >
              Engineering Bay
            </div>
            <div
              className="absolute text-[10px] text-cyan-400/40 font-mono uppercase tracking-widest"
              style={{ right: "3%", top: "2%", transform: "rotateZ(45deg) rotateX(-55deg)" }}
            >
              Strategy Wing
            </div>
            <div
              className="absolute text-[10px] text-pink-400/40 font-mono uppercase tracking-widest"
              style={{ left: "3%", bottom: "8%", transform: "rotateZ(45deg) rotateX(-55deg)" }}
            >
              Creative Lab
            </div>
            <div
              className="absolute text-[10px] text-red-400/40 font-mono uppercase tracking-widest"
              style={{ right: "3%", bottom: "8%", transform: "rotateZ(45deg) rotateX(-55deg)" }}
            >
              Security Ops
            </div>
          </div>
        </div>
      </div>

      {/* Flat grid fallback for mobile */}
      <div className="relative z-10 px-4 pb-6 md:hidden">
        <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">Agent Grid</h2>
        <div className="grid grid-cols-4 gap-2">
          {AGENTS.map((agent) => {
            const isActive = agent.status === "online" || agent.status === "busy";
            return (
              <div
                key={agent.name + "-mobile"}
                onClick={() => setSelected(agent)}
                className="rounded-lg p-2 cursor-pointer transition-all hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${agent.color}12, ${agent.color}06)`,
                  border: `2px solid ${agent.color}${isActive ? "50" : "20"}`,
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: STATUS_COLORS[agent.status],
                      boxShadow: isActive ? `0 0 4px ${STATUS_COLORS[agent.status]}` : undefined,
                    }}
                  />
                  <span className="text-[8px]">{DESK_ICONS[agent.deskType]}</span>
                </div>
                <div className="text-[9px] font-bold truncate" style={{ color: agent.color }}>
                  {agent.name}
                </div>
                <div className="text-[7px] text-gray-500 truncate">{agent.role}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full sm:max-w-md bg-[#12121A] border-2 rounded-t-2xl sm:rounded-2xl p-6"
            style={{ borderColor: `${selected.color}40` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ background: `${selected.color}20`, color: selected.color }}
                >
                  {selected.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-white">{selected.name}</h3>
                  <p className="text-xs text-gray-400">{selected.role} · {selected.model}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: STATUS_COLORS[selected.status],
                    boxShadow: `0 0 8px ${STATUS_COLORS[selected.status]}`,
                  }}
                />
                <span className="text-xs capitalize text-gray-400">{selected.status}</span>
              </div>
            </div>

            {selected.task && (
              <div className="bg-white/5 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Current Task</p>
                <p className="text-sm text-white">{selected.task}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-500">Desk Type</p>
                <p className="text-sm text-white">{DESK_ICONS[selected.deskType]} {selected.deskType}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-gray-500">Model</p>
                <p className="text-sm text-white">{selected.model}</p>
              </div>
            </div>

            <button
              onClick={() => setSelected(null)}
              className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-gray-300 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
