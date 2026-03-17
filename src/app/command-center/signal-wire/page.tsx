"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   SIGNAL WIRE — Live Agent Communication Visualiser
   Wired to /api/command-center/agents + /api/command-center/activity
   Built by PROXIMON · R&D Architect · RAMICHE OS
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

interface Signal {
  from: string;
  to: string;
  type: string;
  msg: string;
  time: string;
}

interface Particle {
  from: string;
  to: string;
  t: number;
  speed: number;
  color: string;
}

/* ── Agent colours ───────────────────────────────────────────────────────── */
const COLORS: Record<string, string> = {
  atlas: "#C9A84C", proximon: "#22d3ee", aetherion: "#a855f7", shuri: "#3b82f6",
  simons: "#f59e0b", widow: "#ef4444", maestro: "#ec4899", themaestro: "#ec4899",
  mercury: "#f97316", nova: "#8b5cf6", kiyosaki: "#06b6d4", themis: "#64748b",
  ink: "#e879f9", haven: "#2dd4bf", echo: "#818cf8", triage: "#fb923c",
  strange: "#c084fc", swimelite: "#38bdf8", selah: "#4ade80", chatbot: "#fbbf24",
  vee: "#34d399", main: "#C9A84C", prophets: "#FCD34D",
};
const ICONS: Record<string, string> = {
  task: "⚡", result: "✓", handoff: "→", decision: "◆",
  error: "✕", broadcast: "◉", escalation: "▲", deploy: "🚀",
  build: "🔧", commit: "•", agent: "🤖", milestone: "🏁", alert: "⚠",
};
const CORE_AGENTS = ["atlas", "proximon", "aetherion", "shuri", "simons", "widow"];

function agentColor(id: string): string {
  return COLORS[id.toLowerCase()] || "#64748b";
}

/* ── Convert git activity → signals ──────────────────────────────────────── */
function activityToSignals(events: ActivityEvent[], agents: LiveAgent[]): Signal[] {
  const agentIds = agents.map(a => a.id.toLowerCase());
  return events.map(ev => {
    const authorLower = ev.author.toLowerCase();
    const from = agentIds.find(id => authorLower.includes(id)) || "atlas";
    let to = "atlas";
    for (const id of agentIds) {
      if (id !== from && ev.message.toLowerCase().includes(id)) {
        to = id;
        break;
      }
    }
    if (to === from) to = from === "atlas" ? "proximon" : "atlas";
    const type = ev.type === "deploy" ? "task" : ev.type === "build" ? "result" :
      ev.type === "alert" ? "error" : ev.type === "agent" ? "handoff" :
      ev.type === "milestone" ? "decision" : "result";
    const d = new Date(ev.date);
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    return { from, to, type, msg: ev.message, time };
  });
}

export default function SignalWirePage() {
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ signals: 0, tasks: 0, handoffs: 0, errors: 0 });
  const [clock, setClock] = useState("--:--:--");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const animFrameRef = useRef<number>(0);
  const feedRef = useRef<HTMLDivElement>(null);

  /* ── Clock ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  /* ── Fetch live data ───────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, activityRes] = await Promise.allSettled([
        fetch("/api/command-center/agents"),
        fetch("/api/command-center/activity?limit=60"),
      ]);
      let liveAgents: LiveAgent[] = [];
      if (agentsRes.status === "fulfilled" && agentsRes.value.ok) {
        const data = await agentsRes.value.json();
        liveAgents = data.agents || [];
        setAgents(liveAgents);
      }
      if (activityRes.status === "fulfilled" && activityRes.value.ok) {
        const data = await activityRes.value.json();
        const events: ActivityEvent[] = data.events || [];
        const newSignals = activityToSignals(events, liveAgents.length ? liveAgents : agents);
        setSignals(newSignals);
        const s = { signals: newSignals.length, tasks: 0, handoffs: 0, errors: 0 };
        for (const sig of newSignals) {
          if (sig.type === "task") s.tasks++;
          if (sig.type === "handoff") s.handoffs++;
          if (sig.type === "error") s.errors++;
        }
        setStats(s);
        const active = new Set<string>();
        newSignals.slice(0, 8).forEach(sig => { active.add(sig.from); active.add(sig.to); });
        setActiveAgents(active);
      }
    } finally {
      setLoading(false);
    }
  }, [agents]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Canvas layout ─────────────────────────────────────────────────────── */
  const layoutNodes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w / 2, cy = h / 2;
    const innerR = Math.min(w, h) * 0.2;
    const outerR = Math.min(w, h) * 0.38;
    const pos: Record<string, { x: number; y: number }> = {};
    const core = agents.filter(a => CORE_AGENTS.includes(a.id.toLowerCase()));
    const outer = agents.filter(a => !CORE_AGENTS.includes(a.id.toLowerCase()));
    core.forEach((a, i) => {
      const angle = (i / Math.max(core.length, 1)) * Math.PI * 2 - Math.PI / 2;
      pos[a.id.toLowerCase()] = { x: cx + Math.cos(angle) * innerR, y: cy + Math.sin(angle) * innerR };
    });
    outer.forEach((a, i) => {
      const angle = (i / Math.max(outer.length, 1)) * Math.PI * 2 - Math.PI / 2;
      pos[a.id.toLowerCase()] = { x: cx + Math.cos(angle) * outerR, y: cy + Math.sin(angle) * outerR };
    });
    nodePositionsRef.current = pos;
  }, [agents]);

  /* ── Canvas draw loop ──────────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      layoutNodes();
    }
    ctx.clearRect(0, 0, w, h);
    const pos = nodePositionsRef.current;

    // Faint connections from core
    ctx.strokeStyle = "rgba(34,211,238,0.03)";
    ctx.lineWidth = 0.5;
    for (const cid of CORE_AGENTS) {
      const p = pos[cid];
      if (!p) continue;
      for (const a of agents) {
        const q = pos[a.id.toLowerCase()];
        if (!q || a.id.toLowerCase() === cid) continue;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
    }

    // Active connection lines (recent signals)
    const recent = signals.slice(0, 8);
    recent.forEach((sig, i) => {
      const f = pos[sig.from]; const t = pos[sig.to];
      if (!f || !t) return;
      const alpha = 0.1 + (i / recent.length) * 0.25;
      ctx.strokeStyle = agentColor(sig.from) + Math.round(alpha * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    });

    // Particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.t += p.speed;
      if (p.t > 1) return false;
      const f = pos[p.from]; const t = pos[p.to];
      if (!f || !t) return false;
      const x = f.x + (t.x - f.x) * p.t;
      const y = f.y + (t.y - f.y) * p.t;
      const a = p.t < 0.1 ? p.t * 10 : p.t > 0.8 ? (1 - p.t) * 5 : 1;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(a * 60).toString(16).padStart(2, "0");
      ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(a * 255).toString(16).padStart(2, "0");
      ctx.fill();
      for (let j = 1; j <= 4; j++) {
        const tt = p.t - j * 0.02;
        if (tt < 0) continue;
        const tx = f.x + (t.x - f.x) * tt;
        const ty = f.y + (t.y - f.y) * tt;
        const ta = a * (1 - j * 0.2);
        ctx.beginPath(); ctx.arc(tx, ty, 1.5 - j * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(ta * 100).toString(16).padStart(2, "0");
        ctx.fill();
      }
      return true;
    });

    // Nodes
    for (const a of agents) {
      const id = a.id.toLowerCase();
      const p = pos[id];
      if (!p) continue;
      const isActive = activeAgents.has(id);
      const col = agentColor(id);
      if (isActive) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = col + "15"; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, isActive ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? col : col + "60"; ctx.fill();
      if (isActive) {
        ctx.strokeStyle = col + "40"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.font = '9px "SF Mono","Fira Code",monospace';
      ctx.fillStyle = isActive ? col : "rgba(100,116,139,0.6)";
      ctx.textAlign = "center";
      ctx.fillText(a.name.toUpperCase(), p.x, p.y + (isActive ? 22 : 18));
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [agents, signals, activeAgents, layoutNodes]);

  useEffect(() => {
    layoutNodes();
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw, layoutNodes]);

  /* ── Spawn particles on signal change ──────────────────────────────────── */
  const prevSignalCountRef = useRef(0);
  useEffect(() => {
    if (signals.length > prevSignalCountRef.current) {
      const newSigs = signals.slice(0, signals.length - prevSignalCountRef.current);
      for (const sig of newSigs.slice(0, 5)) {
        particlesRef.current.push({
          from: sig.from, to: sig.to,
          t: 0, speed: 0.008 + Math.random() * 0.006,
          color: agentColor(sig.from),
        });
      }
    }
    prevSignalCountRef.current = signals.length;
  }, [signals]);

  /* ── Filtered signals ──────────────────────────────────────────────────── */
  const filteredSignals = useMemo(() =>
    activeFilter === "all" ? signals : signals.filter(s => s.type === activeFilter),
    [signals, activeFilter]
  );

  const filters = ["all", "task", "result", "handoff", "decision", "error"];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#050508", color: "#22d3ee", fontSize: 14, fontFamily: "monospace" }}>
        SIGNAL WIRE — Connecting to live data…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050508", color: "#e2e8f0", fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace", overflow: "hidden" }}>
      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", borderBottom: "1px solid #151520", background: "rgba(5,5,8,0.9)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/command-center" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#22d3ee,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#000", boxShadow: "0 0 20px rgba(34,211,238,0.3)" }}>SW</div>
        </Link>
        <div>
          <h1 style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase" as const, color: "#22d3ee", margin: 0 }}>SIGNAL WIRE</h1>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2 }}>Live Agent Communication</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 10, letterSpacing: 2, color: "#22c55e" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", display: "inline-block", animation: "livePulse 1.5s ease-in-out infinite" }} />
          LIVE
        </div>
        <div style={{ fontSize: 20, fontWeight: 200, color: "#C9A84C", letterSpacing: 1, marginLeft: 16 }}>{clock}</div>
      </div>

      {/* ── STATS STRIP ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid #151520", background: "#0c0c14" }}>
        {[
          { val: stats.signals, lbl: "SIGNALS", color: "#22d3ee" },
          { val: agents.filter(a => activeAgents.has(a.id.toLowerCase())).length + "/" + agents.length, lbl: "AGENTS", color: "#C9A84C" },
          { val: stats.tasks, lbl: "TASKS", color: "#22c55e" },
          { val: stats.handoffs, lbl: "HANDOFFS", color: "#f59e0b" },
          { val: stats.errors, lbl: "ERRORS", color: "#ef4444" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: "12px 16px", textAlign: "center", borderRight: i < 4 ? "1px solid #151520" : undefined }}>
            <div style={{ fontSize: 22, fontWeight: 200, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: "#475569", textTransform: "uppercase" as const, marginTop: 2 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN SPLIT ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", flex: 1, overflow: "hidden", height: "calc(100vh - 120px)" }}>

        {/* ── LEFT ROSTER ──────────────────────────────────────────────────── */}
        <div style={{ borderRight: "1px solid #151520", overflowY: "auto", background: "#0c0c14" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#475569", padding: "16px 16px 8px", textTransform: "uppercase" as const }}>Agent Roster — {agents.length}</div>
          {agents.map(a => {
            const id = a.id.toLowerCase();
            const isActive = activeAgents.has(id);
            const col = agentColor(id);
            const signal = isActive ? 5 : 1;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #151520", borderLeft: isActive ? `2px solid ${col}` : "2px solid transparent", background: isActive ? "rgba(34,211,238,0.06)" : undefined, transition: "all 0.15s" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? "#22c55e" : "#f59e0b", boxShadow: isActive ? "0 0 6px #22c55e" : undefined, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: col }}>{a.name.toUpperCase()}</div>
                  <div style={{ fontSize: 9, color: "#475569" }}>{a.role}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 1, alignItems: "flex-end", height: 12 }}>
                  {[1, 2, 3, 4, 5].map(j => (
                    <div key={j} style={{ width: 3, height: j * 2 + 2, borderRadius: 1, background: j <= signal ? col : "#151520", transition: "all 0.3s" }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── RIGHT ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* ── NETWORK CANVAS ──────────────────────────────────────────────── */}
          <div style={{ position: "relative", height: "45%", minHeight: 250, background: "#050508", borderBottom: "1px solid #151520", overflow: "hidden" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
          </div>

          {/* ── FEED HEADER ────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #151520", background: "#0c0c14", position: "sticky", top: 0, zIndex: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#475569", textTransform: "uppercase" as const }}>Signal Feed</div>
            <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
              {filters.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)} style={{
                  fontSize: 9, letterSpacing: 1, padding: "3px 8px", borderRadius: 4,
                  border: activeFilter === f ? "1px solid #22d3ee" : "1px solid #151520",
                  background: activeFilter === f ? "rgba(34,211,238,0.05)" : "transparent",
                  color: activeFilter === f ? "#22d3ee" : "#475569",
                  cursor: "pointer", fontFamily: "inherit",
                }}>{f.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* ── FEED ───────────────────────────────────────────────────────── */}
          <div ref={feedRef} style={{ flex: 1, overflowY: "auto" }}>
            {filteredSignals.slice(0, 60).map((sig, i) => {
              const fromCol = agentColor(sig.from);
              const toCol = agentColor(sig.to);
              const fromAgent = agents.find(a => a.id.toLowerCase() === sig.from);
              const toAgent = agents.find(a => a.id.toLowerCase() === sig.to);
              const typeColors: Record<string, string> = {
                task: "#22d3ee", result: "#22c55e", error: "#ef4444",
                decision: "#a855f7", handoff: "#C9A84C", broadcast: "#ec4899",
                escalation: "#f97316",
              };
              const tc = typeColors[sig.type] || "#475569";
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 40px 1fr 60px", alignItems: "start", gap: 12, padding: "10px 20px", borderBottom: "1px solid rgba(21,21,32,0.5)" }}>
                  <div style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap", paddingTop: 2 }}>{sig.time}</div>
                  <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, background: tc + "18", color: tc }}>{ICONS[sig.type] || "•"}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>
                      <span style={{ color: fromCol }}>{fromAgent?.name.toUpperCase() || sig.from.toUpperCase()}</span>
                      {" → "}
                      <span style={{ color: toCol }}>{toAgent?.name.toUpperCase() || sig.to.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, wordBreak: "break-word" as const }}>{sig.msg}</div>
                  </div>
                  <div style={{ fontSize: 8, letterSpacing: 1, textTransform: "uppercase" as const, padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap", justifySelf: "end", marginTop: 2, background: tc + "1f", color: tc }}>{sig.type}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── KEYFRAMES ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#151520;border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:#475569}
      `}</style>
    </div>
  );
}
