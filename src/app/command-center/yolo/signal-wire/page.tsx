'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface Agent {
  id: string;
  name: string;
  model: string;
  role: string;
  status: string;
}

interface Signal {
  from: number;
  to: number;
  progress: number;
  color: string;
}

const ROLE_COLORS: Record<string, string> = {
  operations: '#00ff88',
  debugging: '#ff4444',
  frontend: '#00ccff',
  architect: '#ffaa00',
  design: '#ff66ff',
  marketing: '#44ff44',
  security: '#ff0044',
  music: '#ff8800',
  analytics: '#00ffcc',
  indexer: '#666688',
  sales: '#ffdd00',
  fabrication: '#cc88ff',
  finance: '#00ff44',
  legal: '#8888ff',
};

function roleColor(role: string): string {
  const lower = role.toLowerCase();
  for (const [k, v] of Object.entries(ROLE_COLORS)) {
    if (lower.includes(k)) return v;
  }
  return '#4488ff';
}

export default function SignalWirePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [signalCount, setSignalCount] = useState(0);
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);

  // Refs for animation loop (avoid stale closures)
  const agentsRef = useRef<Agent[]>([]);
  const hoveredRef = useRef<number | null>(null);
  const posRef = useRef<{ x: number; y: number }[]>([]);
  const sigRef = useRef<Signal[]>([]);
  const sigIdRef = useRef(0);

  // Keep refs in sync via effects
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // Fetch live agent data
  useEffect(() => {
    const load = () => {
      fetch('/api/command-center/agents')
        .then(r => r.json())
        .then(d => { if (d.agents) setAgents(d.agents); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  // Layout agents in circle when count changes
  useEffect(() => {
    if (!agents.length) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const r = Math.min(cx, cy) * 0.65;
    posRef.current = agents.map((_, i) => {
      const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
  }, [agents]);

  // Simulate signals
  useEffect(() => {
    if (agents.length < 2) return;
    const iv = setInterval(() => {
      const n = agentsRef.current.length;
      if (n < 2) return;
      const from = Math.floor(Math.random() * n);
      let to = Math.floor(Math.random() * n);
      while (to === from) to = Math.floor(Math.random() * n);
      const color = roleColor(agentsRef.current[from].role);
      sigRef.current = [
        ...sigRef.current.filter(s => s.progress < 1),
        { from, to, progress: 0, color },
      ];
      sigIdRef.current++;
    }, 800 + Math.random() * 1200);
    return () => clearInterval(iv);
  }, [agents.length]);

  // Animation loop — all drawing inside useEffect
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
      const pos = posRef.current;
      const curAgents = agentsRef.current;
      const curHovered = hoveredRef.current;

      if (!pos.length) { raf = requestAnimationFrame(loop); return; }

      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, W, H);

      // Faint connection lines
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          ctx.beginPath();
          ctx.moveTo(pos[i].x, pos[i].y);
          ctx.lineTo(pos[j].x, pos[j].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Advance and draw signals
      sigRef.current = sigRef.current
        .map(s => ({ ...s, progress: s.progress + 0.012 }))
        .filter(s => s.progress <= 1.2);

      let activeCount = 0;
      for (const s of sigRef.current) {
        if (s.progress > 1) continue;
        activeCount++;
        const fp = pos[s.from];
        const tp = pos[s.to];
        if (!fp || !tp) continue;
        const x = fp.x + (tp.x - fp.x) * s.progress;
        const y = fp.y + (tp.y - fp.y) * s.progress;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, 18);
        grad.addColorStop(0, s.color + 'cc');
        grad.addColorStop(1, s.color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      setSignalCount(activeCount);

      // Draw agent nodes
      for (let i = 0; i < pos.length; i++) {
        const p = pos[i];
        const agent = curAgents[i];
        if (!agent) continue;
        const c = roleColor(agent.role);
        const isHov = curHovered === i;
        const nodeR = isHov ? 22 : 14;

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, nodeR * 2.5);
        g.addColorStop(0, c + '44');
        g.addColorStop(1, c + '00');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, nodeR * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, nodeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = c + '88';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, nodeR + 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = isHov ? '#ffffff' : '#aaaacc';
        ctx.font = isHov ? 'bold 13px monospace' : '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(agent.name.toUpperCase(), p.x, p.y + nodeR + 18);

        if (isHov) {
          ctx.fillStyle = '#666688';
          ctx.font = '10px monospace';
          ctx.fillText(agent.role, p.x, p.y + nodeR + 32);
          ctx.fillText(agent.model, p.x, p.y + nodeR + 44);
        }
      }

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('SIGNAL WIRE', 32, 48);
      ctx.fillStyle = '#444466';
      ctx.font = '12px monospace';
      ctx.fillText(
        `${curAgents.length} AGENTS  ·  LIVE NETWORK  ·  ${new Date().toLocaleTimeString()}`,
        32, 68
      );

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = posRef.current;
    let found: number | null = null;
    for (let i = 0; i < pos.length; i++) {
      const dx = e.clientX - pos[i].x;
      const dy = e.clientY - pos[i].y;
      if (dx * dx + dy * dy < 900) { found = i; break; }
    }
    hoveredRef.current = found;
    setHoveredAgent(found !== null ? agentsRef.current[found] ?? null : null);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050510] cursor-crosshair" onMouseMove={handleMouseMove}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <a
        href="/command-center/yolo"
        className="fixed top-6 right-6 text-xs text-gray-600 hover:text-white font-mono uppercase tracking-widest transition-colors"
      >
        ← YOLO Gallery
      </a>
      {hoveredAgent && (
        <div className="fixed top-6 left-6 bg-black/90 border border-gray-800 rounded px-4 py-3 font-mono text-xs">
          <div className="text-white text-sm font-bold mb-1">{hoveredAgent.name}</div>
          <div className="text-gray-400">{hoveredAgent.role}</div>
          <div className="text-gray-500">{hoveredAgent.model}</div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-black/80 border-t border-gray-800 flex items-center px-6 gap-8 text-xs font-mono text-gray-500">
        <span>NODES: <span className="text-white">{agents.length}</span></span>
        <span>ACTIVE SIGNALS: <span className="text-cyan-400">{signalCount}</span></span>
        <span>REFRESH: <span className="text-green-500">30s</span></span>
        <span className="ml-auto text-gray-700">PROXIMON // R&D ARCHITECT</span>
      </div>
    </div>
  );
}
