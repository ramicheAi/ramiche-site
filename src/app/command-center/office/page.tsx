"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   3D OFFICE v2 — Living Agent Workspace
   Isometric floor with live status from bridge API, ambient lighting,
   typing/thinking animations, room atmosphere
   ══════════════════════════════════════════════════════════════════════════════ */

interface Agent {
  name: string;
  role: string;
  model: string;
  status: "online" | "idle" | "busy" | "offline";
  task?: string;
  color: string;
  room: "engineering" | "strategy" | "creative" | "security" | "analytics" | "comms";
}

const FALLBACK_AGENTS: Agent[] = [
  { name: "Atlas", role: "Operations Lead", model: "Opus 4.6", status: "online", task: "Orchestrating squad", color: "#8B5CF6", room: "strategy" },
  { name: "SHURI", role: "Engineering", model: "Sonnet 4.5", status: "busy", task: "Building features", color: "#EC4899", room: "engineering" },
  { name: "TRIAGE", role: "Diagnostics", model: "Sonnet 4.5", status: "idle", color: "#EF4444", room: "engineering" },
  { name: "NOVA", role: "Fabrication", model: "Sonnet 4.5", status: "busy", task: "YOLO Build", color: "#F59E0B", room: "creative" },
  { name: "PROXIMON", role: "Architecture", model: "Sonnet 4.5", status: "idle", color: "#06B6D4", room: "strategy" },
  { name: "AETHERION", role: "Meta-Systems", model: "Gemini 3.1 Pro", status: "offline", color: "#A855F7", room: "strategy" },
  { name: "MERCURY", role: "Sales", model: "Sonnet 4.5", status: "idle", color: "#10B981", room: "analytics" },
  { name: "VEE", role: "Brand Strategy", model: "Kimi K2.5", status: "idle", color: "#F472B6", room: "creative" },
  { name: "INK", role: "Copywriting", model: "Sonnet 4.5", status: "idle", color: "#6366F1", room: "creative" },
  { name: "ECHO", role: "Community", model: "qwen3:14b", status: "idle", color: "#22D3EE", room: "comms" },
  { name: "HAVEN", role: "Support", model: "Sonnet 4.5", status: "idle", color: "#34D399", room: "comms" },
  { name: "WIDOW", role: "Security", model: "qwen3:14b", status: "online", task: "Perimeter scan", color: "#DC2626", room: "security" },
  { name: "DR STRANGE", role: "Forecasting", model: "Sonnet 4.5", status: "idle", color: "#7C3AED", room: "analytics" },
  { name: "KIYOSAKI", role: "Finance", model: "Sonnet 4.5", status: "idle", color: "#059669", room: "analytics" },
  { name: "SIMONS", role: "Data Analysis", model: "Sonnet 4.5", status: "idle", color: "#2563EB", room: "analytics" },
  { name: "MICHAEL", role: "Swim Coach", model: "qwen3:14b", status: "idle", color: "#0EA5E9", room: "strategy" },
  { name: "SELAH", role: "Psychology", model: "qwen3:14b", status: "idle", color: "#D946EF", room: "comms" },
  { name: "PROPHETS", role: "Wisdom", model: "Kimi K2.5", status: "idle", color: "#F59E0B", room: "comms" },
  { name: "TheMAESTRO", role: "Music", model: "qwen3:14b", status: "idle", color: "#E11D48", room: "creative" },
  { name: "THEMIS", role: "Governance", model: "Sonnet 4.5", status: "online", task: "Protocol watch", color: "#CA8A04", room: "security" },
];

const STATUS_COLORS: Record<string, string> = {
  online: "#22C55E",
  busy: "#F59E0B",
  idle: "#6B7280",
  offline: "#374151",
};

const ROOM_ICONS: Record<string, string> = {
  engineering: "⌨️",
  strategy: "🗺️",
  creative: "🎨",
  security: "🛡️",
  analytics: "📊",
  comms: "📡",
};

const ROOM_AMBIENT: Record<string, string> = {
  engineering: "rgba(139,92,246,0.04)",
  strategy: "rgba(6,182,212,0.04)",
  creative: "rgba(244,114,182,0.04)",
  security: "rgba(220,38,38,0.04)",
  analytics: "rgba(37,99,235,0.04)",
  comms: "rgba(34,211,238,0.04)",
};

export default function OfficePage() {
  const [agents, setAgents] = useState<Agent[]>(FALLBACK_AGENTS);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [tick, setTick] = useState(0);
  const [lastSync, setLastSync] = useState<string>("");

  // Heartbeat tick for animations
  useEffect(() => {
    const t = setInterval(() => setTick((p) => p + 1), 1500);
    return () => clearInterval(t);
  }, []);

  // Fetch live agent data from bridge API
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/bridge?type=agents", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?._syncedAt) setLastSync(data._syncedAt);
      if (data?.directory?.agents) {
        const dir = data.directory.agents;
        const updated = FALLBACK_AGENTS.map((fa) => {
          const key = fa.name.toLowerCase().replace(/\s+/g, "-");
          const live = dir[key];
          if (live) {
            return {
              ...fa,
              model: live.model || fa.model,
              role: live.role || fa.role,
              status: (live.status as Agent["status"]) || fa.status,
            };
          }
          return fa;
        });
        setAgents(updated);
      }
    } catch { /* fallback to static */ }
  }, []);

  useEffect(() => {
    const id = setInterval(fetchAgents, 30000);
    const t = setTimeout(fetchAgents, 0);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [fetchAgents]);

  const statusCounts = {
    online: agents.filter((a) => a.status === "online").length,
    busy: agents.filter((a) => a.status === "busy").length,
    idle: agents.filter((a) => a.status === "idle").length,
    offline: agents.filter((a) => a.status === "offline").length,
  };

  return (
    <div className="min-h-screen bg-[#060609] text-white relative overflow-hidden">
      <ParticleField />

      {/* Header — Linear-clean */}
      <div className="relative z-10 border-b border-[#1a1a24] bg-[#0a0a10]/95 backdrop-blur-md">
        <div className="px-4 py-3 flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/command-center" className="text-[#666] hover:text-white text-sm transition-colors duration-150">
              ← Command Center
            </Link>
            <span className="text-[#333]">|</span>
            <h1 className="text-sm font-semibold tracking-wide text-[#e5e5e5]">
              THE OFFICE
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#888]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
              {statusCounts.online}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
              {statusCounts.busy}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#555]" />
              {statusCounts.idle}
            </span>
            {lastSync && (
              <span className="text-[10px] text-[#444]">
                synced {new Date(lastSync).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3D Office Floor — Enhanced */}
      <div className="relative z-10 p-4 hidden md:block">
        <div
          className="mx-auto"
          style={{
            perspective: "1400px",
            perspectiveOrigin: "50% 25%",
            maxWidth: "1500px",
          }}
        >
          <div
            style={{
              transform: "rotateX(55deg) rotateZ(-45deg)",
              transformStyle: "preserve-3d",
              position: "relative",
              width: "100%",
              paddingBottom: "55%",
            }}
          >
            {/* Grid floor with ambient glow */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: `
                  radial-gradient(ellipse at 30% 30%, rgba(139,92,246,0.06) 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 70%, rgba(6,182,212,0.04) 0%, transparent 50%),
                  linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                `,
                backgroundSize: "100% 100%, 100% 100%, 35px 35px, 35px 35px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />

            {/* Room zone overlays */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 w-1/2 h-1/2 rounded-tl-xl" style={{ background: ROOM_AMBIENT.engineering }} />
              <div className="absolute top-0 right-0 w-1/2 h-1/2 rounded-tr-xl" style={{ background: ROOM_AMBIENT.strategy }} />
              <div className="absolute bottom-0 left-0 w-1/2 h-1/2 rounded-bl-xl" style={{ background: ROOM_AMBIENT.creative }} />
              <div className="absolute bottom-0 right-0 w-1/2 h-1/2 rounded-br-xl" style={{ background: ROOM_AMBIENT.security }} />
            </div>

            {/* Agent Workstations */}
            {agents.map((agent, i) => {
              const cols = 5;
              const row = Math.floor(i / cols);
              const col = i % cols;
              const xPct = 6 + col * 18;
              const yPct = 6 + row * 22;
              const isActive = agent.status === "online" || agent.status === "busy";
              const isTyping = isActive && tick % 3 !== 0;
              const breathe = isActive ? Math.sin(tick * 0.5) * 0.15 + 0.85 : 0.6;

              return (
                <div
                  key={agent.name}
                  onClick={() => setSelected(agent)}
                  className="absolute cursor-pointer group"
                  style={{
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    width: "15%",
                    transform: "rotateZ(45deg) rotateX(-55deg)",
                    transformStyle: "preserve-3d",
                    zIndex: 20 - row,
                    opacity: breathe,
                    transition: "opacity 1.5s ease-in-out",
                  }}
                >
                  {/* Desk with depth shadow */}
                  <div
                    className="rounded-lg p-2.5 transition-all duration-300 group-hover:scale-110 relative"
                    style={{
                      background: `linear-gradient(145deg, ${agent.color}18, ${agent.color}06)`,
                      border: `1px solid ${agent.color}${isActive ? "50" : "18"}`,
                      boxShadow: isActive
                        ? `0 4px 25px ${agent.color}20, 0 0 40px ${agent.color}08, inset 0 1px 0 ${agent.color}15`
                        : `0 2px 8px rgba(0,0,0,0.3)`,
                    }}
                  >
                    {/* Agent name + status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold tracking-tight truncate" style={{ color: agent.color }}>
                        {agent.name}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: STATUS_COLORS[agent.status],
                          boxShadow: isActive ? `0 0 8px ${STATUS_COLORS[agent.status]}, 0 0 16px ${STATUS_COLORS[agent.status]}40` : undefined,
                          animation: isActive ? "statusPulse 2s ease-in-out infinite" : undefined,
                        }}
                      />
                    </div>

                    {/* Room icon + role */}
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[9px]">{ROOM_ICONS[agent.room]}</span>
                      <span className="text-[8px] text-[#555] truncate">{agent.role}</span>
                    </div>

                    {/* Current task or typing indicator */}
                    {agent.task ? (
                      <div className="text-[7px] text-[#777] truncate bg-white/[0.03] rounded px-1.5 py-0.5 border border-white/[0.04]">
                        {agent.task}
                      </div>
                    ) : isActive ? (
                      <div className="flex gap-0.5 items-center h-3">
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className="w-1 h-1 rounded-full"
                            style={{
                              backgroundColor: agent.color,
                              opacity: isTyping && tick % 3 === dot ? 1 : 0.3,
                              transition: "opacity 0.3s",
                            }}
                          />
                        ))}
                      </div>
                    ) : null}

                    {/* Screen glow for active agents */}
                    {isActive && (
                      <div
                        className="absolute -top-2 left-1/4 right-1/4 h-3 rounded-t-md pointer-events-none"
                        style={{
                          background: `linear-gradient(to top, ${agent.color}25, transparent)`,
                          filter: "blur(3px)",
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Room labels — subtle */}
            {[
              { label: "Engineering Bay", pos: { left: "3%", top: "1%" }, color: "rgba(139,92,246,0.25)" },
              { label: "Strategy Wing", pos: { right: "3%", top: "1%" }, color: "rgba(6,182,212,0.25)" },
              { label: "Creative Lab", pos: { left: "3%", bottom: "6%" }, color: "rgba(244,114,182,0.25)" },
              { label: "Security Ops", pos: { right: "3%", bottom: "6%" }, color: "rgba(220,38,38,0.25)" },
            ].map((room) => (
              <div
                key={room.label}
                className="absolute text-[9px] font-mono uppercase tracking-[0.15em]"
                style={{
                  ...room.pos,
                  color: room.color,
                  transform: "rotateZ(45deg) rotateX(-55deg)",
                }}
              >
                {room.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile grid — compact 4-col */}
      <div className="relative z-10 px-3 pb-6 md:hidden">
        <h2 className="text-[10px] text-[#444] uppercase tracking-widest mb-3 text-center font-mono">
          Agent Grid
        </h2>
        <div className="grid grid-cols-4 gap-1.5">
          {agents.map((agent) => {
            const isActive = agent.status === "online" || agent.status === "busy";
            return (
              <div
                key={agent.name + "-m"}
                onClick={() => setSelected(agent)}
                className="rounded-md p-1.5 cursor-pointer transition-all duration-150 active:scale-95"
                style={{
                  background: `${agent.color}08`,
                  border: `1px solid ${agent.color}${isActive ? "40" : "15"}`,
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: STATUS_COLORS[agent.status],
                      boxShadow: isActive ? `0 0 4px ${STATUS_COLORS[agent.status]}` : undefined,
                    }}
                  />
                  <span className="text-[7px]">{ROOM_ICONS[agent.room]}</span>
                </div>
                <div className="text-[8px] font-semibold truncate" style={{ color: agent.color }}>
                  {agent.name}
                </div>
                <div className="text-[6px] text-[#555] truncate">{agent.role}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Room legend */}
      <div className="relative z-10 px-4 pb-4">
        <div className="max-w-[1500px] mx-auto flex flex-wrap gap-4 justify-center">
          {Object.entries(ROOM_ICONS).map(([room, icon]) => {
            const count = agents.filter((a) => a.room === room).length;
            const active = agents.filter((a) => a.room === room && (a.status === "online" || a.status === "busy")).length;
            return (
              <div key={room} className="flex items-center gap-1.5 text-[10px] text-[#555]">
                <span>{icon}</span>
                <span className="capitalize">{room}</span>
                <span className="text-[#333]">
                  {active}/{count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Detail Panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full sm:max-w-md bg-[#0d0d12] border rounded-t-2xl sm:rounded-2xl p-6"
            style={{ borderColor: `${selected.color}30` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${selected.color}20, ${selected.color}08)`,
                    color: selected.color,
                    border: `1px solid ${selected.color}30`,
                  }}
                >
                  {selected.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{selected.name}</h3>
                  <p className="text-xs text-[#666]">{selected.role} · {selected.model}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: STATUS_COLORS[selected.status],
                    boxShadow: `0 0 8px ${STATUS_COLORS[selected.status]}`,
                  }}
                />
                <span className="text-[11px] capitalize text-[#888]">{selected.status}</span>
              </div>
            </div>

            {selected.task && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 mb-4">
                <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">Active Task</p>
                <p className="text-sm text-[#ccc]">{selected.task}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                <p className="text-[10px] text-[#555] uppercase tracking-wider">Room</p>
                <p className="text-sm text-[#ccc] mt-0.5">{ROOM_ICONS[selected.room]} {selected.room}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                <p className="text-[10px] text-[#555] uppercase tracking-wider">Model</p>
                <p className="text-sm text-[#ccc] mt-0.5">{selected.model}</p>
              </div>
            </div>

            <button
              onClick={() => setSelected(null)}
              className="w-full py-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-sm text-[#888] transition-all duration-150 border border-white/[0.06]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes statusPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
