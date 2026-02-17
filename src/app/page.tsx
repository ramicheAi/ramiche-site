"use client";

import { useState, useEffect, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════════════════════
   RAMICHE HQ — LIVE OPERATIONS DASHBOARD
   Auto-refreshes every 30 seconds from /status.json
   ══════════════════════════════════════════════════════════════════════════════ */

interface StatusData {
  lastUpdated: string;
  stats: { activeProjects: number; tasksShipped: number; agentsOnline: number; athletesBeta: string };
  agents: { name: string; model: string; role: string; status: string; task: string; color: string }[];
  projects: { name: string; status: string; priority: string; progress: number; accent: string; blockers: string[] }[];
  recentActivity: { time: string; text: string; color: string }[];
  blockers: { title: string; desc: string; severity: string }[];
  financial: { apexARR: string; apexTarget: string; gaProducts: number; studioRevenue: string; investmentReadiness: string };
}

export default function Home() {
  const [data, setData] = useState<StatusData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/status.json?t=${Date.now()}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
    } catch {}
  }, []);

  useEffect(() => { setMounted(true); fetchStatus(); }, [fetchStatus]);

  // Auto-refresh every 10 seconds for near real-time updates
  useEffect(() => {
    const id = setInterval(fetchStatus, 10000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Live clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const navLinks = [
    { label: "HQ", href: "/", active: true },
    { label: "Command Center", href: "/command-center" },
    { label: "Apex Athlete", href: "/apex-athlete" },
    { label: "Financial", href: "/financial" },
    { label: "Studio", href: "/studio" },
  ];

  const portals = [
    { title: "Command Center", description: "Mission control for all operations", href: "/command-center", accent: "cyan" as const, icon: "◈", status: "ONLINE" },
    { title: "Apex Athlete", description: "Athlete engagement & performance platform", href: "/apex-athlete", accent: "purple" as const, icon: "✦", status: "ACTIVE" },
    { title: "Financial", description: "ORACLE — Revenue & growth metrics", href: "/financial", accent: "gold" as const, icon: "◉", status: "LIVE" },
    { title: "Ramiche Studio", description: "Creative direction for the bold", href: "/studio", accent: "cyan" as const, icon: "♢", status: "LIVE" },
  ];

  const brands = [
    { name: "Parallax", role: "Parent Company" },
    { name: "RAMICHE", role: "Operations HQ" },
    { name: "Galactik Antics", role: "Product Line" },
    { name: "The Baba Studio", role: "Audio Division" },
    { name: "Apex Athlete", role: "SaaS Platform" },
  ];

  const stats = data
    ? [
        { label: "Active Projects", value: String(data.stats.activeProjects), accent: "cyan" as const },
        { label: "Tasks Shipped", value: String(data.stats.tasksShipped), accent: "purple" as const },
        { label: "Agents Online", value: String(data.stats.agentsOnline), accent: "gold" as const },
        { label: "Athletes (Beta)", value: data.stats.athletesBeta, accent: "cyan" as const },
      ]
    : [
        { label: "Active Projects", value: "8", accent: "cyan" as const },
        { label: "Tasks Shipped", value: "67", accent: "purple" as const },
        { label: "Agents Online", value: "19", accent: "gold" as const },
        { label: "Athletes (Beta)", value: "240+", accent: "cyan" as const },
      ];

  const accentColors = {
    cyan: {
      border: "border-[#00f0ff]/30", borderHover: "hover:border-[#00f0ff]/60",
      bg: "bg-[#00f0ff]/5", bgHover: "hover:bg-[#00f0ff]/10",
      text: "text-[#00f0ff]", shadow: "hover:shadow-[0_0_30px_rgba(0,240,255,0.15)]",
      glow: "rgba(0,240,255,0.4)", statusBg: "bg-[#00f0ff]/10",
      barBg: "bg-[#00f0ff]", dotBg: "bg-[#00f0ff]",
    },
    purple: {
      border: "border-[#a855f7]/30", borderHover: "hover:border-[#a855f7]/60",
      bg: "bg-[#a855f7]/5", bgHover: "hover:bg-[#a855f7]/10",
      text: "text-[#a855f7]", shadow: "hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
      glow: "rgba(168,85,247,0.4)", statusBg: "bg-[#a855f7]/10",
      barBg: "bg-[#a855f7]", dotBg: "bg-[#a855f7]",
    },
    gold: {
      border: "border-[#f59e0b]/30", borderHover: "hover:border-[#f59e0b]/60",
      bg: "bg-[#f59e0b]/5", bgHover: "hover:bg-[#f59e0b]/10",
      text: "text-[#f59e0b]", shadow: "hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
      glow: "rgba(245,158,11,0.4)", statusBg: "bg-[#f59e0b]/10",
      barBg: "bg-[#f59e0b]", dotBg: "bg-[#f59e0b]",
    },
  };

  if (!mounted) return null;

  const activeAgents = data?.agents.filter(a => a.status === "active") || [];
  const doneAgents = data?.agents.filter(a => a.status === "done") || [];
  const blockedAgents = data?.agents.filter(a => a.status === "blocked") || [];

  return (
    <main className="relative min-h-screen bg-[#06020f] text-white overflow-hidden">
      {/* ── animated background nebulae ─────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="nebula-1 absolute rounded-full blur-3xl" style={{ width: "600px", height: "600px", top: "-10%", left: "-5%", background: "radial-gradient(circle, rgba(0,240,255,0.08) 0%, transparent 70%)" }} />
        <div className="nebula-2 absolute rounded-full blur-3xl" style={{ width: "500px", height: "500px", top: "30%", right: "-10%", background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)" }} />
        <div className="nebula-3 absolute rounded-full blur-3xl" style={{ width: "400px", height: "400px", bottom: "5%", left: "20%", background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)" }} />
        <div className="scan-line absolute left-0 w-full h-px" style={{ background: "rgba(0,240,255,0.1)" }} />
      </div>

      {/* ── HUD navigation bar ─────────────────────────────────── */}
      <nav className="relative z-10 border-b border-white/5 bg-[#06020f]/80 backdrop-blur-md">
        <div className="mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="neon-text-cyan text-sm font-bold tracking-widest">RAMICHE</span>
              <span className="text-white/20 text-xs">|</span>
              <span className="text-white/30 text-[10px] tracking-wider uppercase">Systems HQ</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href}
                  className={`game-btn px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-all whitespace-nowrap flex-shrink-0 ${
                    link.active ? "bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30" : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent"
                  }`}>{link.label}</a>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* ── hero section ───────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-16 pb-10 px-4 sm:pt-24 sm:pb-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#00f0ff]/50" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-[#00f0ff]/60 font-medium">Systems Online</span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#00f0ff]/50" />
        </div>
        <h1 className="animated-gradient-text text-5xl sm:text-8xl md:text-9xl font-black tracking-tight text-center leading-none bg-clip-text text-transparent select-none"
          style={{ backgroundImage: "linear-gradient(135deg, #00f0ff 0%, #a855f7 40%, #f59e0b 70%, #00f0ff 100%)", backgroundSize: "200% 200%", WebkitBackgroundClip: "text", filter: "drop-shadow(0 0 40px rgba(0,240,255,0.2))" }}>
          RAMICHE
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-white/50 tracking-wide text-center font-light">Systems builder. Culture creator.</p>

        {/* live clock + refresh indicator */}
        <div className="mt-4 flex items-center gap-4">
          <span className="text-[10px] text-[#00f0ff]/60 tracking-wider font-mono">{time}</span>
          <span className="text-white/10">|</span>
          <span className="text-[10px] text-white/30 tracking-wider">LIVE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          {lastRefresh && <span className="text-[10px] text-white/20 tracking-wider">Refreshed: {lastRefresh}</span>}
        </div>
      </section>

      {/* ── portal cards ───────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 pb-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-[#00f0ff]/20 to-transparent" />
          <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">Mission Portals</h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[#00f0ff]/20 to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 xl:gap-6">
          {portals.map((portal) => {
            const colors = accentColors[portal.accent];
            return (
              <a key={portal.href} href={portal.href}
                className={`game-panel game-panel-border group relative flex flex-col ${colors.bg} ${colors.bgHover} border ${colors.border} ${colors.borderHover} ${colors.shadow} p-6 lg:p-8 transition-all duration-300 hover:-translate-y-1`}>
                <div className="flex items-center justify-between mb-5">
                  <span className={`${colors.text} text-3xl`}>{portal.icon}</span>
                  <span className={`${colors.statusBg} ${colors.text} text-[10px] tracking-widest font-bold px-3 py-1.5 rounded-sm uppercase`}>{portal.status}</span>
                </div>
                <h3 className={`text-xl font-bold ${colors.text} mb-2 tracking-wide`}>{portal.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed mb-5">{portal.description}</p>
                <div className="flex items-center gap-2 mt-auto">
                  <div className={`h-0.5 flex-1 ${colors.barBg} opacity-20 group-hover:opacity-40 transition-opacity`} />
                  <span className={`text-[10px] ${colors.text} opacity-50 group-hover:opacity-100 tracking-widest uppercase transition-opacity`}>Enter</span>
                  <span className={`${colors.text} text-xs opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all`}>&rarr;</span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── live stats ────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 pb-12">
        <div className="game-panel game-panel-border bg-white/[0.02] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
            <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">System Telemetry</h2>
            <span className="text-[10px] text-[#00ff88]/50 ml-auto tracking-wider">LIVE — 10s refresh</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6">
            {stats.map((stat) => {
              const colors = accentColors[stat.accent];
              return (
                <div key={stat.label} className={`relative border ${colors.border} ${colors.bg} rounded-sm p-5 lg:p-6`}>
                  <div className="text-[10px] tracking-widest uppercase text-white/30 mb-3">{stat.label}</div>
                  <div className={`text-4xl lg:text-5xl font-black ${colors.text} tracking-tight tabular-nums`}>{stat.value}</div>
                  <div className={`absolute top-0 right-0 w-3 h-3 border-t border-r ${colors.border} opacity-50`} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── active agents ─────────────────────────────────────── */}
      {data && (
        <section className="relative z-10 mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 pb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-[#00f0ff]/20 to-transparent" />
            <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">Agent Status</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#00f0ff]/20 to-transparent" />
          </div>

          {/* Active */}
          {activeAgents.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] tracking-widest uppercase text-[#00ff88]/60 mb-3">Active ({activeAgents.length})</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeAgents.map(a => (
                  <div key={a.name} className="border border-[#00ff88]/20 bg-[#00ff88]/5 rounded-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                      <span className="text-sm font-bold" style={{ color: a.color }}>{a.name}</span>
                      <span className="text-[10px] text-white/30 ml-auto">{a.model}</span>
                    </div>
                    <div className="text-[10px] text-white/50 tracking-wider uppercase mb-1">{a.role}</div>
                    <div className="text-xs text-white/40">{a.task}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {doneAgents.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] tracking-widest uppercase text-[#00f0ff]/60 mb-3">Completed ({doneAgents.length})</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {doneAgents.map(a => (
                  <div key={a.name} className="border border-[#00f0ff]/15 bg-[#00f0ff]/3 rounded-sm p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-[#00f0ff]/60" />
                      <span className="text-sm font-bold text-white/60">{a.name}</span>
                      <span className="text-[10px] text-white/20 ml-auto">{a.model}</span>
                    </div>
                    <div className="text-xs text-white/30">{a.task}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blocked */}
          {blockedAgents.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] tracking-widest uppercase text-[#f59e0b]/60 mb-3">Blocked ({blockedAgents.length})</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {blockedAgents.map(a => (
                  <div key={a.name} className="border border-[#f59e0b]/20 bg-[#f59e0b]/5 rounded-sm p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                      <span className="text-sm font-bold text-[#f59e0b]">{a.name}</span>
                    </div>
                    <div className="text-xs text-white/40">{a.task}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── project progress ──────────────────────────────────── */}
      {data && (
        <section className="relative z-10 mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 pb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-[#a855f7]/20 to-transparent" />
            <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">Project Progress</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#a855f7]/20 to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {data.projects.map(p => (
              <div key={p.name} className="border rounded-sm p-5 lg:p-6" style={{ borderColor: `${p.accent}30`, background: `${p.accent}08` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold" style={{ color: p.accent }}>{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm tracking-widest font-bold uppercase ${
                      p.status === "blocked" ? "bg-[#f59e0b]/20 text-[#f59e0b]" : p.status === "active" ? "bg-[#00ff88]/10 text-[#00ff88]" : "bg-white/5 text-white/30"
                    }`}>{p.priority}</span>
                  </div>
                </div>
                {/* progress bar */}
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.progress}%`, background: p.accent }} />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-white/30 tracking-wider">{p.progress}% complete</span>
                  <span className="text-[10px] tracking-wider uppercase" style={{ color: `${p.accent}80` }}>{p.status}</span>
                </div>
                {p.blockers.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {p.blockers.slice(0, 2).map((b, i) => (
                      <div key={i} className="text-[10px] text-white/25 flex items-center gap-1.5">
                        <span className="text-[#f59e0b]/40">▸</span> {b}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── blockers ──────────────────────────────────────────── */}
      {data && data.blockers.length > 0 && (
        <section className="relative z-10 mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 pb-12">
          <div className="game-panel game-panel-border border-[#f59e0b]/20 bg-[#f59e0b]/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[#f59e0b]">⚠</span>
              <h2 className="text-xs tracking-[0.25em] uppercase text-[#f59e0b]/60 font-medium">Needs Your Input</h2>
            </div>
            <div className="space-y-3">
              {data.blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1 ${b.severity === "high" ? "bg-[#ef4444]" : "bg-[#f59e0b]"}`} />
                  <div>
                    <div className="text-sm font-bold text-white/70">{b.title}</div>
                    <div className="text-xs text-white/30">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── recent activity ───────────────────────────────────── */}
      {data && (
        <section className="relative z-10 mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 pb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-[#00f0ff]/20 to-transparent" />
            <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">Recent Activity</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#00f0ff]/20 to-transparent" />
          </div>
          <div className="space-y-2">
            {data.recentActivity.slice(0, 8).map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-[10px] text-white/20 w-16 shrink-0 text-right font-mono">{item.time}</span>
                <span className="w-1 h-1 rounded-full" style={{ background: item.color }} />
                <span className="text-xs text-white/40">{item.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── brand ecosystem ────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 pb-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-[#a855f7]/20 to-transparent" />
          <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">Brand Ecosystem</h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[#a855f7]/20 to-transparent" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {brands.map((brand, i) => {
            const accentOrder = ["purple", "cyan", "gold", "purple", "cyan"] as const;
            const accent = accentOrder[i];
            const colors = accentColors[accent];
            return (
              <div key={brand.name} className={`game-panel-sm relative border ${colors.border} ${colors.bg} p-4 text-center transition-all duration-300 hover:border-opacity-60`}>
                <div className={`${colors.dotBg} w-1.5 h-1.5 rounded-full mx-auto mb-3 opacity-60`} />
                <div className="text-sm font-bold text-white/80 tracking-wide mb-1">{brand.name}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider">{brand.role}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 bg-[#06020f]/60 backdrop-blur-sm">
        <div className="mx-auto max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="neon-text-cyan text-xs font-bold tracking-widest">RAMICHE</span>
              <span className="text-white/10">|</span>
              <span className="text-white/20 text-[10px] tracking-wider">Operations Hub</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/command-center" className="text-[10px] text-white/20 hover:text-[#00f0ff]/60 tracking-wider uppercase transition-colors">Command Center</a>
              <a href="/apex-athlete" className="text-[10px] text-white/20 hover:text-[#a855f7]/60 tracking-wider uppercase transition-colors">Apex Athlete</a>
              <a href="/financial" className="text-[10px] text-white/20 hover:text-[#f59e0b]/60 tracking-wider uppercase transition-colors">Financial</a>
              <a href="/studio" className="text-[10px] text-white/20 hover:text-[#f59e0b]/60 tracking-wider uppercase transition-colors">Studio</a>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-white/15 tracking-widest uppercase">&copy; 2026 Ramiche Operations &middot; Auto-refreshes every 10s</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
