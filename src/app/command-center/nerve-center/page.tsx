"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   NERVE CENTER — Live Agent War Room
   Real-time agent network visualiser wired to /api/command-center/agents,
   /api/command-center/activity, and /api/command-center/yolo-builds
   ══════════════════════════════════════════════════════════════════════════════ */

interface LiveAgent {
  id: string;
  name: string;
  model: string;
  role: string;
  capabilities: string[];
  skills: string[];
  escalation_level: string;
  default_stance: string;
  status: string;
}

interface ActivityEvent {
  hash: string;
  date: string;
  author: string;
  message: string;
  type: string;
}

interface YoloBuild {
  name: string;
  date: string;
  agent: string;
  status: string;
}

/* ── Agent colours (deterministic from name) ──────────────────────────────── */
const AGENT_COLORS: Record<string, string> = {
  atlas: "#7C3AED", triage: "#22C55E", shuri: "#EF4444", proximon: "#3B82F6",
  aetherion: "#F59E0B", simons: "#8B5CF6", mercury: "#F97316", vee: "#EC4899",
  ink: "#14B8A6", echo: "#A78BFA", haven: "#34D399", "dr-strange": "#818CF8",
  kiyosaki: "#FBBF24", michael: "#06B6D4", selah: "#F472B6", prophets: "#FCD34D",
  themaestro: "#FB923C", widow: "#EF4444", themis: "#78716C", nova: "#06B6D4",
  archivist: "#9CA3AF",
};

const AGENT_EMOJIS: Record<string, string> = {
  atlas: "🧭", triage: "🔍", shuri: "⚡", proximon: "🏗️",
  aetherion: "🎨", simons: "📊", mercury: "💰", vee: "💎",
  ink: "✍️", echo: "📢", haven: "🏠", "dr-strange": "🔮",
  kiyosaki: "💵", michael: "🏊", selah: "🧘", prophets: "✨",
  themaestro: "🎵", widow: "🕷️", themis: "⚖️", nova: "🚀",
  archivist: "📚",
};

/* ── Canvas: animated particle network ────────────────────────────────────── */
function NeuralCanvas({ agents }: { agents: LiveAgent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<{ x: number; y: number; vx: number; vy: number; agent: LiveAgent; pulse: number }[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialise nodes if empty or agents changed
    if (nodesRef.current.length !== agents.length) {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      nodesRef.current = agents.map((a) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        agent: a,
        pulse: Math.random() * Math.PI * 2,
      }));
    }

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;

      // Update positions
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.02;
        if (n.x < 30 || n.x > w - 30) n.vx *= -1;
        if (n.y < 30 || n.y > h - 30) n.vy *= -1;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.15;
            ctx.strokeStyle = `rgba(124, 58, 237, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();

            // Travelling particle
            if (Math.random() > 0.995) {
              const t = (Date.now() % 3000) / 3000;
              const px = nodes[i].x + (nodes[j].x - nodes[i].x) * t;
              const py = nodes[i].y + (nodes[j].y - nodes[i].y) * t;
              ctx.fillStyle = "rgba(124, 58, 237, 0.6)";
              ctx.beginPath();
              ctx.arc(px, py, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const color = AGENT_COLORS[n.agent.id] || "#7C3AED";
        const isActive = n.agent.status === "active";
        const pulseSize = isActive ? 3 + Math.sin(n.pulse) * 2 : 0;

        // Glow ring for active agents
        if (isActive) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 16 + pulseSize, 0, Math.PI * 2);
          ctx.fillStyle = color.replace(")", ", 0.1)").replace("rgb", "rgba").replace("#", "");
          const grad = ctx.createRadialGradient(n.x, n.y, 8, n.x, n.y, 20 + pulseSize);
          grad.addColorStop(0, `${color}33`);
          grad.addColorStop(1, `${color}00`);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Core circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.font = "600 9px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(n.agent.name.slice(0, 3).toUpperCase(), n.x, n.y + 3);

        // Name below
        ctx.font = "500 8px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(n.agent.name.charAt(0).toUpperCase() + n.agent.name.slice(1), n.x, n.y + 22);
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [agents]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: 320,
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(10,10,10,0.95) 100%)",
        border: "1px solid rgba(124,58,237,0.15)",
      }}
    />
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function NerveCenterPage() {
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [yoloBuilds, setYoloBuilds] = useState<YoloBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"network" | "fleet" | "feed" | "stats">("network");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  /* ── Fetch live data ────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, activityRes, yoloRes] = await Promise.allSettled([
        fetch("/api/command-center/agents"),
        fetch("/api/command-center/activity?limit=30"),
        fetch("/api/command-center/yolo-builds"),
      ]);

      if (agentsRes.status === "fulfilled" && agentsRes.value.ok) {
        const data = await agentsRes.value.json();
        setAgents(data.agents || []);
      }
      if (activityRes.status === "fulfilled" && activityRes.value.ok) {
        const data = await activityRes.value.json();
        setActivity(data.events || []);
      }
      if (yoloRes.status === "fulfilled" && yoloRes.value.ok) {
        const data = await yoloRes.value.json();
        setYoloBuilds(data.builds || []);
      }
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  /* ── Computed stats ─────────────────────────────────────────────────────── */
  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalAgents = agents.length;
  const yoloCount = yoloBuilds.length;
  const recentCommits = activity.length;
  const escalators = agents.filter((a) => a.escalation_level === "strategic" || a.escalation_level === "command").length;

  /* ── Clock ──────────────────────────────────────────────────────────────── */
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  /* ── YOLO leaderboard ───────────────────────────────────────────────────── */
  const agentBuildCounts = yoloBuilds.reduce<Record<string, number>>((acc, b) => {
    const name = (b.agent || "unknown").toLowerCase();
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const leaderboard = Object.entries(agentBuildCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#7C3AED", fontSize: 14, fontFamily: "monospace" }}>
        NERVE CENTER — Connecting to live data…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e7e5e4", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 40%, #4F46E5 100%)",
        padding: "40px 28px 32px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-50%", right: "-20%", width: 400, height: 400, background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, letterSpacing: 0.5, color: "#fff" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", animation: "pulseRing 2s infinite", display: "inline-block" }} />
            SYSTEMS ONLINE
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.9, fontVariantNumeric: "tabular-nums", color: "#fff" }}>{clock}</div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1, color: "#fff", position: "relative", zIndex: 1 }}>Nerve Center</div>
        <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.7, marginTop: 6, color: "#fff", position: "relative", zIndex: 1 }}>
          RAMICHE Agent War Room — {totalAgents} Units · Live
        </div>
        <Link href="/command-center" style={{ position: "absolute", top: 12, right: 16, color: "rgba(255,255,255,0.6)", fontSize: 12, textDecoration: "none", zIndex: 2 }}>← Back</Link>
      </div>

      {/* ── METRICS STRIP ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, margin: "-20px 16px 0", position: "relative", zIndex: 10 }}>
        {[
          { val: activeCount, label: "Active", color: "#22C55E" },
          { val: totalAgents, label: "Total Agents", color: "#7C3AED" },
          { val: yoloCount, label: "YOLO Builds", color: "#F59E0B" },
          { val: recentCommits, label: "Recent Commits", color: "#3B82F6" },
        ].map((m, i) => (
          <div key={i} style={{
            background: "#111", padding: "16px 12px", textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,.3)",
            borderRadius: i === 0 ? "16px 0 0 16px" : i === 3 ? "0 16px 16px 0" : 0,
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: m.color }}>{m.val}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#78716C", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── TAB BAR ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, padding: "20px 20px 16px", overflowX: "auto" }}>
        {(["network", "fleet", "feed", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 18px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              border: tab === t ? "2px solid #7C3AED" : "2px solid #333",
              background: tab === t ? "#7C3AED" : "#111",
              color: tab === t ? "#fff" : "#78716C",
              transition: "all 0.2s",
            }}
          >
            {t === "network" ? "Neural Network" : t === "fleet" ? "Agent Fleet" : t === "feed" ? "Live Feed" : "Deep Stats"}
          </button>
        ))}
      </div>

      {/* ── NEURAL NETWORK TAB ───────────────────────────────────────────── */}
      {tab === "network" && (
        <div style={{ padding: "0 16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#78716C" }}>AGENT NETWORK</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#555", background: "#1a1a1a", padding: "4px 10px", borderRadius: 100 }}>
              Refreshed {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </div>
          </div>
          <NeuralCanvas agents={agents} />

          {/* Connection legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, padding: "12px 16px", background: "#111", borderRadius: 12, border: "1px solid #222" }}>
            {agents.slice(0, 12).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: AGENT_COLORS[a.id] || "#7C3AED", display: "inline-block" }} />
                <span style={{ fontWeight: 600, color: "#ccc" }}>{a.name.charAt(0).toUpperCase() + a.name.slice(1)}</span>
                <span style={{ color: "#555" }}>{a.role.split(" ").slice(0, 2).join(" ")}</span>
              </div>
            ))}
            {agents.length > 12 && <span style={{ fontSize: 11, color: "#555" }}>+{agents.length - 12} more</span>}
          </div>
        </div>
      )}

      {/* ── AGENT FLEET TAB ──────────────────────────────────────────────── */}
      {tab === "fleet" && (
        <div style={{ padding: "0 16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#78716C" }}>AGENT FLEET</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#555", background: "#1a1a1a", padding: "4px 10px", borderRadius: 100 }}>{activeCount} active</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {agents.map((a) => {
              const color = AGENT_COLORS[a.id] || "#7C3AED";
              const emoji = AGENT_EMOJIS[a.id] || "⚙️";
              return (
                <div
                  key={a.id}
                  style={{
                    background: "#111",
                    borderRadius: 16,
                    padding: 18,
                    border: `2px solid ${a.status === "active" ? color + "66" : "#222"}`,
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.2s",
                  }}
                >
                  {a.status === "active" && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, #06B6D4)` }} />
                  )}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{emoji}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#e7e5e4" }}>{a.name.charAt(0).toUpperCase() + a.name.slice(1)}</div>
                        <div style={{ fontSize: 11, color: "#78716C" }}>{a.model} · {a.role}</div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8,
                      padding: "4px 10px", borderRadius: 100,
                      background: a.status === "active" ? "rgba(34,197,94,0.15)" : "#1a1a1a",
                      color: a.status === "active" ? "#22C55E" : "#78716C",
                    }}>
                      {a.status === "active" ? "● LIVE" : "IDLE"}
                    </div>
                  </div>

                  {/* Capabilities */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {a.capabilities.slice(0, 4).map((c) => (
                      <span key={c} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#1a1a1a", color: "#78716C" }}>{c}</span>
                    ))}
                    {a.capabilities.length > 4 && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#1a1a1a", color: "#555" }}>+{a.capabilities.length - 4}</span>
                    )}
                  </div>

                  {/* Skills */}
                  {a.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {a.skills.slice(0, 3).map((s) => (
                        <span key={s} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: `${color}15`, color: color }}>{s}</span>
                      ))}
                      {a.skills.length > 3 && (
                        <span style={{ fontSize: 9, color: "#555" }}>+{a.skills.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Escalation level bar */}
                  <div style={{ marginTop: 12, height: 4, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: `linear-gradient(90deg, ${color}, #06B6D4)`,
                      width: a.escalation_level === "command" ? "100%" : a.escalation_level === "strategic" ? "75%" : a.escalation_level === "tactical" ? "50%" : "25%",
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: "#555", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.escalation_level}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LIVE FEED TAB ────────────────────────────────────────────────── */}
      {tab === "feed" && (
        <div style={{ padding: "0 16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#78716C" }}>OPERATIONS FEED</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#555", background: "#1a1a1a", padding: "4px 10px", borderRadius: 100 }}>Live</div>
          </div>
          <div style={{ background: "#111", borderRadius: 16, border: "1px solid #222", overflow: "hidden" }}>
            {activity.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>No recent activity</div>
            ) : (
              activity.map((e, i) => {
                const d = new Date(e.date);
                const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                const typeColor = e.type === "deploy" ? "#22C55E" : e.type === "build" ? "#F59E0B" : e.type === "agent" ? "#7C3AED" : e.type === "alert" ? "#EF4444" : "#78716C";
                return (
                  <div
                    key={e.hash}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
                      borderBottom: i < activity.length - 1 ? "1px solid #1a1a1a" : "none",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#555", fontVariantNumeric: "tabular-nums", minWidth: 44, flexShrink: 0, marginTop: 2 }}>{time}</div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColor, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#ccc" }}>{e.author}</div>
                      <div style={{ fontSize: 12, color: "#78716C", marginTop: 1 }}>{e.message}</div>
                    </div>
                    <code style={{ fontSize: 10, color: "#555", fontFamily: "monospace", flexShrink: 0 }}>{e.hash}</code>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── DEEP STATS TAB ───────────────────────────────────────────────── */}
      {tab === "stats" && (
        <div style={{ padding: "0 16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#78716C" }}>SYSTEM METRICS</div>
          </div>

          {/* Key stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
            {[
              { val: totalAgents, label: "Total Agents", color: "#7C3AED", pct: 100 },
              { val: activeCount, label: "Active Now", color: "#22C55E", pct: totalAgents ? (activeCount / totalAgents) * 100 : 0 },
              { val: escalators, label: "Strategic+", color: "#F59E0B", pct: totalAgents ? (escalators / totalAgents) * 100 : 0 },
              { val: yoloCount, label: "YOLO Builds", color: "#06B6D4", pct: Math.min((yoloCount / 30) * 100, 100) },
              { val: recentCommits, label: "Commits (30)", color: "#3B82F6", pct: Math.min((recentCommits / 30) * 100, 100) },
              { val: agents.filter((a) => a.skills.length > 0).length, label: "With Skills", color: "#EC4899", pct: totalAgents ? (agents.filter((a) => a.skills.length > 0).length / totalAgents) * 100 : 0 },
            ].map((s, i) => (
              <div key={i} style={{ background: "#111", borderRadius: 12, padding: 14, border: "1px solid #222" }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#78716C", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>{s.label}</div>
                <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: s.color, width: `${Math.min(s.pct, 100)}%`, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </div>

          {/* YOLO Leaderboard */}
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#78716C", marginBottom: 12 }}>YOLO BUILD LEADERBOARD</div>
          <div style={{ background: "#111", borderRadius: 16, border: "1px solid #222", overflow: "hidden" }}>
            {leaderboard.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>No YOLO builds yet</div>
            ) : (
              leaderboard.map(([name, count], i) => {
                const color = AGENT_COLORS[name] || "#7C3AED";
                const emoji = AGENT_EMOJIS[name] || "⚙️";
                const maxCount = leaderboard[0]?.[1] || 1;
                const pct = Math.max((count / maxCount) * 100, 3);
                const rankLabel = i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                return (
                  <div key={name} style={{ borderBottom: i < leaderboard.length - 1 ? "1px solid #1a1a1a" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 14 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 14, flexShrink: 0,
                        background: i === 0 ? "linear-gradient(135deg, #F59E0B, #EAB308)" : i < 3 ? `${color}22` : "#1a1a1a",
                        color: i === 0 ? "#fff" : i < 3 ? color : "#78716C",
                      }}>{rankLabel}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: color }}>{emoji} {name.charAt(0).toUpperCase() + name.slice(1)}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#7C3AED" }}>{count}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#78716C", textTransform: "uppercase", letterSpacing: 0.5 }}>Builds</div>
                      </div>
                    </div>
                    <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, margin: "0 16px 12px", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${color}, #06B6D4)`, width: `${pct}%`, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Model distribution */}
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#78716C", marginTop: 20, marginBottom: 12 }}>MODEL DISTRIBUTION</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {Object.entries(
              agents.reduce<Record<string, number>>((acc, a) => {
                acc[a.model] = (acc[a.model] || 0) + 1;
                return acc;
              }, {})
            )
              .sort(([, a], [, b]) => b - a)
              .map(([model, count]) => (
                <div key={model} style={{ background: "#111", borderRadius: 12, padding: 14, border: "1px solid #222" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#ccc" }}>{model}</div>
                  <div style={{ fontSize: 10, color: "#78716C", marginTop: 2 }}>{count} agent{count > 1 ? "s" : ""}</div>
                  <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: "#7C3AED", width: `${(count / totalAgents) * 100}%`, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Animations ───────────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulseRing { 0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } }
      `}</style>
    </div>
  );
}
