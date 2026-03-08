"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

// ── Mock data ──────────────────────────────────────────────
const LEVELS = [
  { name: "Rookie", xp: 0, color: "#94a3b8" },
  { name: "Contender", xp: 300, color: "#a78bfa" },
  { name: "Warrior", xp: 600, color: "#60a5fa" },
  { name: "Elite", xp: 1000, color: "#f59e0b" },
  { name: "Captain", xp: 1500, color: "#f97316" },
  { name: "Legend", xp: 2500, color: "#ef4444" },
];

const mockAthletes = [
  { name: "Sarah J.", level: "Captain", xp: 1699, maxXP: 2500, color: "#f97316", streak: 28 },
  { name: "Marcus C.", level: "Captain", xp: 1629, maxXP: 2500, color: "#f97316", streak: 22 },
  { name: "Alexandra R.", level: "Captain", xp: 1572, maxXP: 2500, color: "#f97316", streak: 18 },
  { name: "Tyler W.", level: "Elite", xp: 1280, maxXP: 1500, color: "#f59e0b", streak: 14 },
  { name: "Emma D.", level: "Elite", xp: 1150, maxXP: 1500, color: "#f59e0b", streak: 11 },
  { name: "Jamal K.", level: "Warrior", xp: 820, maxXP: 1000, color: "#60a5fa", streak: 7 },
  { name: "Sophia M.", level: "Contender", xp: 480, maxXP: 600, color: "#a78bfa", streak: 4 },
  { name: "Liam A.", level: "Rookie", xp: 180, maxXP: 300, color: "#94a3b8", streak: 2 },
];

const mockCheckpoints = [
  { id: "on-deck", name: "On Deck Early", xp: 10 },
  { id: "gear-ready", name: "Gear Ready", xp: 5 },
  { id: "warmup", name: "Warm-Up Complete", xp: 15 },
  { id: "practice", name: "Practice Complete", xp: 25 },
  { id: "helped", name: "Helped a Teammate", xp: 15 },
  { id: "attitude", name: "Positive Attitude", xp: 10 },
];

const mockQuests = [
  { title: "Break 60s in 100m Free", progress: 92, participants: 12 },
  { title: "10,000m This Week", progress: 72, participants: 8 },
  { title: "Perfect March Attendance", progress: 82, participants: 15 },
];

const mockTimes = [
  { event: "100m Freestyle", time: "58.42s", trend: "down" },
  { event: "200m IM", time: "2:18.67", trend: "down" },
  { event: "50m Butterfly", time: "28.91s", trend: "down" },
  { event: "100m Backstroke", time: "1:04.23", trend: "up" },
];

const mockAchievements = [
  { text: "Broke 60s in 100m Free", xp: 500 },
  { text: "Perfect attendance February", xp: 200 },
  { text: "Personal best 200m IM", xp: 150 },
];

const features = [
  { title: "Level System", desc: "Gamified progression from Rookie → Legend keeps athletes engaged", icon: "levels" },
  { title: "Meet Management", desc: "Import Hy-Tek files, assign heats & lanes, record results and splits", icon: "meet" },
  { title: "Checkpoints", desc: "Daily habits tracked with XP rewards — build culture through consistency", icon: "check" },
  { title: "Quests & Goals", desc: "Team-wide or individual challenges with real-time progress tracking", icon: "quest" },
  { title: "Three Portals", desc: "Coach, Athlete, and Parent — each sees exactly what they need", icon: "portal" },
  { title: "Analytics", desc: "Performance trends, attendance rates, XP distribution, and team health", icon: "chart" },
];

// ── SVG Icons ──────────────────────────────────────────────
function Icon({ type, className = "w-5 h-5" }: { type: string; className?: string }) {
  const paths: Record<string, string> = {
    levels: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    meet: "M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z",
    check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    quest: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
    portal: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    chart: "M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z",
    fire: "M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z",
    trophy: "M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z",
    arrow: "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d={paths[type] || paths.check} />
    </svg>
  );
}

// ── Animated XP Bar ────────────────────────────────────────
function XPBar({ percent, color, height = "h-2", delay = 0 }: { percent: number; color: string; height?: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), 100 + delay);
    return () => clearTimeout(t);
  }, [percent, delay]);
  return (
    <div className={`${height} rounded-full bg-white/[0.06] overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${width}%`,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          boxShadow: `0 0 12px ${color}40`,
        }}
      />
    </div>
  );
}

// ── Tab type ───────────────────────────────────────────────
type DemoTab = "coach" | "athlete" | "parent";

// ── Staggered fade-in hook ────────────────────────────────
function useFadeIn(delay = 0) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return {
    className: `transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`,
  };
}

// ── Animated Counter ──────────────────────────────────────
function AnimCounter({ to, duration = 1200, prefix = "", suffix = "", delay = 0 }: { to: number; duration?: number; prefix?: string; suffix?: string; delay?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setVal(Math.round(eased * to));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timeout);
  }, [to, duration, delay]);
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

// ── micro sound effects ───────────────────────────────────
const SFX = {
  tick: () => { try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 1200; o.type = "sine"; g.gain.setValueAtTime(0.12, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08); o.start(); o.stop(c.currentTime + 0.08); } catch {} },
  untick: () => { try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 600; o.type = "sine"; g.gain.setValueAtTime(0.06, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06); o.start(); o.stop(c.currentTime + 0.06); } catch {} },
  tabSwitch: () => { try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; o.type = "sine"; g.gain.setValueAtTime(0.05, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05); o.start(); o.stop(c.currentTime + 0.05); } catch {} },
};

export default function DemoPage() {
  const [tab, setTab] = useState<DemoTab>("coach");
  const [checkedCPs, setCheckedCPs] = useState<Set<string>>(new Set(["on-deck", "gear-ready", "warmup"]));

  const toggleCP = (id: string) => {
    setCheckedCPs(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); SFX.untick(); } else { next.add(id); SFX.tick(); }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-hidden">
      <ParticleField />

      {/* ── Top Bar ── */}
      <div className="relative z-10 border-b border-[#00f0ff]/10 bg-[#06020f]/90 backdrop-blur-xl">
        <div className="w-full px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link href="/apex-athlete" className="text-[#00f0ff]/60 hover:text-[#00f0ff] transition-colors text-sm font-mono flex items-center gap-1">
            <Icon type="arrow" className="w-4 h-4 rotate-180" /> METTLE
          </Link>
          <div className="text-[9px] tracking-[0.4em] uppercase text-[#C9A84C]/30 font-mono">DEMO MODE</div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="relative z-10 border-b border-[#00f0ff]/10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00f0ff]/[0.02] to-transparent pointer-events-none" />
        <div className="w-full px-4 sm:px-8 py-16 sm:py-24 text-center relative">
          <div className="text-[9px] tracking-[0.6em] uppercase font-bold text-[#C9A84C]/30 font-mono mb-4 animate-[fadeInUp_0.8s_ease-out_both]">{"<"} athlete.relations.manager {"/"+">"}</div>
          <h1
            className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-[-0.04em] leading-[0.85] mb-6 animate-[fadeInUp_1s_ease-out_0.2s_both]"
            style={{
              background: "linear-gradient(135deg, #C9A84C 0%, #FFD700 30%, #C9A84C 60%, #B8860B 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(201,168,76,0.3))",
            }}
          >
            METTLE
          </h1>
          <p className="text-white/50 text-lg sm:text-xl font-light animate-[fadeInUp_1s_ease-out_0.4s_both]">
            Where athletic development becomes a game worth playing
          </p>

          {/* Live HUD stats strip */}
          <div className="mt-10 inline-flex items-center gap-4 sm:gap-6 border-2 border-[#00f0ff]/15 rounded-xl bg-[#06020f]/60 backdrop-blur px-6 py-4 animate-[fadeInUp_1s_ease-out_0.6s_both]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.6)] animate-pulse" />
              <span className="text-[#00f0ff] text-sm font-mono font-bold"><AnimCounter to={24} delay={400} /><span className="text-white/15">/30</span></span>
              <span className="text-[#00f0ff]/30 text-[10px] font-mono uppercase">present</span>
            </div>
            <div className="w-px h-4 bg-[#00f0ff]/10" />
            <div className="flex items-center gap-2">
              <span className="text-[#f59e0b] text-sm font-mono font-bold"><AnimCounter to={1847} delay={600} prefix="" /></span>
              <span className="text-[#f59e0b]/30 text-[10px] font-mono uppercase">XP today</span>
            </div>
            <div className="w-px h-4 bg-[#00f0ff]/10" />
            <span className="text-[#00f0ff]/40 text-xs font-mono">🏊 POOL</span>
          </div>
        </div>
      </section>

      {/* ── Portal Tabs ── */}
      <div className="relative z-10 border-b border-[#00f0ff]/10 bg-[#06020f]/90 backdrop-blur-xl">
        <div className="w-full px-4 sm:px-8 flex">
          {(["coach", "athlete", "parent"] as const).map(v => {
            const active = tab === v;
            const labels = { coach: "COACH VIEW", athlete: "ATHLETE VIEW", parent: "PARENT VIEW" };
            return (
              <button
                key={v}
                onClick={() => { setTab(v); SFX.tabSwitch(); }}
                className={`relative flex-1 py-4 text-[11px] font-bold font-mono tracking-[0.25em] uppercase transition-all duration-300 ${
                  active ? "text-[#00f0ff] bg-[#00f0ff]/[0.08]" : "text-white/15 hover:text-[#00f0ff]/60"
                }`}
                style={{
                  borderTop: active ? "2px solid rgba(0,240,255,0.6)" : "2px solid transparent",
                  boxShadow: active ? "0 -4px 20px rgba(0,240,255,0.15), inset 0 1px 15px rgba(0,240,255,0.05)" : "none",
                }}
              >
                {labels[v]}
                {active && <div className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-[#00f0ff]/40" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-10 sm:py-12 space-y-8 sm:space-y-10">
        {tab === "coach" && <CoachView checkedCPs={checkedCPs} toggleCP={toggleCP} />}
        {tab === "athlete" && <AthleteView />}
        {tab === "parent" && <ParentView />}
      </div>

      {/* ── Features Grid ── */}
      <section className="relative z-10 border-t border-[#00f0ff]/10 bg-[#06020f]/80">
        <div className="w-full px-4 sm:px-8 py-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center font-mono tracking-wide">Platform Features</h2>
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="border-2 border-[#00f0ff]/10 rounded-xl p-8 sm:p-10 bg-[#06020f]/60 hover:border-[#00f0ff]/30 hover:shadow-[0_0_40px_rgba(0,240,255,0.08)] hover:-translate-y-1 transition-all duration-300 group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-lg border-2 border-[#00f0ff]/20 bg-[#00f0ff]/[0.05] flex items-center justify-center text-[#00f0ff] group-hover:bg-[#00f0ff]/10 group-hover:border-[#00f0ff]/40 transition-all duration-300">
                    <Icon type={f.icon} className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-white text-base">{f.title}</h3>
                </div>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Level Progression ── */}
      <section className="relative z-10 border-t border-[#00f0ff]/10">
        <div className="w-full px-4 sm:px-8 py-16">
          <h2 className="text-2xl font-bold text-white mb-3 text-center font-mono tracking-wide">Level Progression</h2>
          <p className="text-white/25 text-sm text-center mb-10 font-mono">Rookie → Legend — earn XP through consistency, effort, and leadership</p>
          <div className="relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-1/2 left-[8%] right-[8%] h-px bg-gradient-to-r from-[#94a3b8]/20 via-[#f59e0b]/30 to-[#ef4444]/20" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
              {LEVELS.map((lv, i) => (
                <div
                  key={i}
                  className="border-2 rounded-xl px-4 py-6 text-center transition-all duration-500 hover:scale-110 relative group"
                  style={{
                    borderColor: `${lv.color}40`,
                    background: `${lv.color}08`,
                    boxShadow: `0 0 20px ${lv.color}10`,
                    animationDelay: `${i * 0.15}s`,
                    animation: `fadeInUp 0.6s ease-out ${i * 0.15}s both`,
                  }}
                >
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: `0 0 50px ${lv.color}30, inset 0 0 30px ${lv.color}10` }} />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-2 mx-auto mb-3 flex items-center justify-center" style={{ borderColor: `${lv.color}60`, background: `${lv.color}15` }}>
                      <div className="text-2xl font-black" style={{ color: lv.color }}>{i + 1}</div>
                    </div>
                    <div className="text-sm font-bold text-white">{lv.name}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-1">{lv.xp}+ XP</div>
                    {i === 4 && <div className="mt-2 text-[9px] font-mono px-2 py-0.5 rounded bg-[#f97316]/10 text-[#f97316] inline-block">DEMO</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 border-t border-[#00f0ff]/10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(201,168,76,0.04) 0%, transparent 60%)" }} />
        <div className="w-full px-4 sm:px-8 py-24 text-center relative">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">Ready to transform your program?</h2>
          <p className="text-white/40 text-lg mb-12 max-w-xl mx-auto">
            Join coaches who use METTLE to build culture, track progress, and engage parents.
          </p>
          <a
            href="mailto:ramichehq@gmail.com?subject=METTLE Demo Request"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-xl font-bold text-lg text-[#06020f] transition-all duration-300 hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #C9A84C, #FFD700, #C9A84C)",
              boxShadow: "0 0 40px rgba(201,168,76,0.3), 0 0 80px rgba(201,168,76,0.1)",
              animation: "heartbeat 2.4s ease-in-out infinite",
            }}
          >
            Get Started
            <Icon type="arrow" className="w-5 h-5" />
          </a>
          <style>{`
            @keyframes heartbeat {
              0%, 100% { transform: scale(1); }
              14% { transform: scale(1.04); }
              28% { transform: scale(1); }
              42% { transform: scale(1.06); }
              56% { transform: scale(1); }
            }
            @keyframes levelPulse {
              0%, 100% { box-shadow: 0 0 40px rgba(249,115,22,0.15), 0 0 80px rgba(249,115,22,0.05); }
              50% { box-shadow: 0 0 50px rgba(249,115,22,0.25), 0 0 100px rgba(249,115,22,0.1); }
            }
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes glowPulse {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COACH VIEW
// ═══════════════════════════════════════════════════════════
function CoachView({ checkedCPs, toggleCP }: { checkedCPs: Set<string>; toggleCP: (id: string) => void }) {
  return (
    <div className="space-y-8">
      {/* Leaderboard */}
      <div className="border-2 border-[#00f0ff]/10 rounded-xl bg-[#06020f]/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#00f0ff]/10 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm font-mono tracking-wide">TEAM LEADERBOARD</h3>
          <span className="text-[#00f0ff]/30 text-[10px] font-mono">{mockAthletes.length} ATHLETES</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {mockAthletes.map((a, i) => (
            <div key={i} className={`flex items-center gap-4 px-6 py-4 transition-all duration-200 ${i < 3 ? "bg-[#f59e0b]/[0.02] hover:bg-[#f59e0b]/[0.05]" : "hover:bg-white/[0.02]"}`}>
              <div className="w-8 text-center">
                {i < 3 ? (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm" style={{ background: i === 0 ? "linear-gradient(135deg, #FFD700, #C9A84C)" : i === 1 ? "linear-gradient(135deg, #C0C0C0, #8A8A8A)" : "linear-gradient(135deg, #CD7F32, #8B4513)", color: "#06020f" }}>{i + 1}</div>
                ) : (
                  <span className="text-white/20 font-mono text-sm">{i + 1}</span>
                )}
              </div>
              <div className="w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold" style={{ borderColor: `${a.color}40`, color: a.color, background: `${a.color}10` }}>
                {a.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm truncate">{a.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: a.color, background: `${a.color}15` }}>{a.level}</span>
                </div>
                <div className="mt-1.5">
                  <XPBar percent={(a.xp / a.maxXP) * 100} color={a.color} delay={i * 80} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold font-mono tabular-nums" style={{ color: a.color }}>{a.xp.toLocaleString()}</div>
                <div className="text-[10px] text-white/20 font-mono">{a.streak}d streak</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checkpoints */}
      <div className="border-2 border-[#00f0ff]/10 rounded-xl bg-[#06020f]/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#00f0ff]/10">
          <h3 className="font-bold text-white text-sm font-mono tracking-wide">DAILY CHECKPOINTS</h3>
          <p className="text-white/20 text-xs mt-1">Tap to toggle — each awards XP</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.04]">
          {mockCheckpoints.map(cp => {
            const checked = checkedCPs.has(cp.id);
            return (
              <button
                key={cp.id}
                onClick={() => toggleCP(cp.id)}
                className={`px-5 py-4 text-left transition-all duration-200 ${checked ? "bg-[#00f0ff]/[0.06]" : "bg-[#06020f]/80 hover:bg-white/[0.02]"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${checked ? "border-[#00f0ff] bg-[#00f0ff]/20" : "border-white/10"}`}>
                    {checked && <Icon type="check" className="w-3 h-3 text-[#00f0ff]" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{cp.name}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#f59e0b]/60">+{cp.xp} XP</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Quests */}
      <div className="border-2 border-[#00f0ff]/10 rounded-xl bg-[#06020f]/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#00f0ff]/10">
          <h3 className="font-bold text-white text-sm font-mono tracking-wide">ACTIVE QUESTS</h3>
        </div>
        <div className="p-6 space-y-4">
          {mockQuests.map((q, i) => (
            <div key={i} className="border border-[#00f0ff]/10 rounded-lg p-4 bg-[#06020f]/40">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-white text-sm">{q.title}</h4>
                <span className="text-[#00f0ff]/30 text-[10px] font-mono">{q.participants} athletes</span>
              </div>
              <XPBar percent={q.progress} color="#a855f7" height="h-3" delay={i * 120} />
              <div className="text-right mt-1 text-[10px] font-mono text-white/20">{q.progress}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ATHLETE VIEW
// ═══════════════════════════════════════════════════════════
function AthleteView() {
  return (
    <div className="space-y-8">
      {/* Level Badge */}
      <div className="border-2 border-[#f97316]/20 rounded-xl bg-[#06020f]/60 p-10 sm:p-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.08) 0%, transparent 60%)" }} />
        <div className="relative">
          <div
            className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 mb-5"
            style={{
              borderColor: "#f97316",
              background: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)",
              boxShadow: "0 0 40px rgba(249,115,22,0.15), 0 0 80px rgba(249,115,22,0.05)",
              animation: "levelPulse 3s ease-in-out infinite",
            }}
          >
            <div>
              <div className="text-4xl font-black text-[#f97316]">5</div>
              <div className="text-[10px] font-mono tracking-wider text-[#f97316]/60 uppercase">Captain</div>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white">Sarah Johnson</h3>
          <p className="text-white/30 text-sm font-mono mt-1">1,699 / 2,500 XP to Legend</p>
          <div className="mt-5 max-w-md mx-auto">
            <XPBar percent={68} color="#f97316" height="h-4" />
          </div>
        <div className="mt-8 flex justify-center gap-8">
          <div className="text-center">
            <div className="text-3xl font-black text-[#f59e0b]"><AnimCounter to={28} delay={800} /></div>
            <div className="text-[10px] text-white/20 font-mono uppercase mt-1">Day Streak</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-3xl font-black text-[#00f0ff]"><AnimCounter to={96} delay={1000} suffix="%" /></div>
            <div className="text-[10px] text-white/20 font-mono uppercase mt-1">Attendance</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-3xl font-black text-[#a855f7]"><AnimCounter to={3} delay={1200} /></div>
            <div className="text-[10px] text-white/20 font-mono uppercase mt-1">Quests Done</div>
          </div>
        </div>
        </div>
      </div>

      {/* Recent Times */}
      <div className="border-2 border-[#00f0ff]/10 rounded-xl bg-[#06020f]/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#00f0ff]/10">
          <h3 className="font-bold text-white text-sm font-mono tracking-wide">RECENT TIMES</h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {mockTimes.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4">
              <span className="text-white/60 text-sm">{t.event}</span>
              <div className="flex items-center gap-2">
                <span className="text-[#00f0ff] font-bold font-mono">{t.time}</span>
                <span className={`text-[10px] font-mono ${t.trend === "down" ? "text-green-400" : "text-red-400"}`}>
                  {t.trend === "down" ? "▼ PR" : "▲"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Checkpoints */}
      <div className="border-2 border-[#00f0ff]/10 rounded-xl bg-[#06020f]/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#00f0ff]/10">
          <h3 className="font-bold text-white text-sm font-mono tracking-wide">TODAY&apos;S CHECKPOINTS</h3>
        </div>
        <div className="p-6 space-y-3">
          {mockCheckpoints.slice(0, 4).map((cp, i) => {
            const done = i < 3;
            return (
              <div key={cp.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg ${done ? "bg-[#00f0ff]/[0.04] border border-[#00f0ff]/10" : "border border-white/5"}`}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${done ? "border-[#00f0ff] bg-[#00f0ff]/20" : "border-white/10"}`}>
                  {done && <Icon type="check" className="w-3 h-3 text-[#00f0ff]" />}
                </div>
                <span className={`text-sm flex-1 ${done ? "text-white" : "text-white/40"}`}>{cp.name}</span>
                <span className="text-[10px] font-mono text-[#f59e0b]/40">+{cp.xp} XP</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PARENT VIEW
// ═══════════════════════════════════════════════════════════
function ParentView() {
  return (
    <div className="space-y-8">
      {/* Child Summary */}
      <div className="border-2 border-[#a855f7]/20 rounded-xl bg-[#06020f]/60 p-10 sm:p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(ellipse at 0% 50%, rgba(168,85,247,0.06) 0%, transparent 60%)" }} />
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full border-2 border-[#f97316] flex items-center justify-center" style={{ background: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)" }}>
            <span className="text-[#f97316] font-black text-lg">SJ</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Sarah Johnson</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f97316]/10 text-[#f97316]">Captain</span>
              <span className="text-white/20 text-xs font-mono">Level 5 • 1,699 XP</span>
            </div>
          </div>
        </div>
        <XPBar percent={68} color="#f97316" height="h-3" />
        <div className="text-right text-[10px] text-white/20 font-mono mt-1">801 XP to Legend</div>
      </div>

      {/* Weekly Summary */}
      <div className="border-2 border-[#00f0ff]/10 rounded-xl bg-[#06020f]/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#00f0ff]/10">
          <h3 className="font-bold text-white text-sm font-mono tracking-wide">THIS WEEK</h3>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
          <div className="p-6 text-center">
            <div className="text-3xl font-black text-[#00f0ff]"><AnimCounter to={5} delay={400} />/5</div>
            <div className="text-[10px] text-white/20 font-mono uppercase mt-1">Practices</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl font-black text-[#f59e0b]">+<AnimCounter to={340} delay={600} /></div>
            <div className="text-[10px] text-white/20 font-mono uppercase mt-1">XP Earned</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl font-black text-[#a855f7]"><AnimCounter to={2} delay={800} /></div>
            <div className="text-[10px] text-white/20 font-mono uppercase mt-1">PRs Set</div>
          </div>
        </div>
      </div>

      {/* Recent Achievements */}
      <div className="border-2 border-[#00f0ff]/10 rounded-xl bg-[#06020f]/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#00f0ff]/10">
          <h3 className="font-bold text-white text-sm font-mono tracking-wide">RECENT ACHIEVEMENTS</h3>
        </div>
        <div className="p-6 space-y-3">
          {mockAchievements.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#f59e0b]/10 bg-[#f59e0b]/[0.03]">
              <Icon type="trophy" className="w-5 h-5 text-[#f59e0b] shrink-0" />
              <span className="text-white text-sm flex-1">{a.text}</span>
              <span className="text-[10px] font-mono font-bold text-[#f59e0b]">+{a.xp} XP</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coach Communication */}
      <div className="border-2 border-[#00f0ff]/10 rounded-xl bg-[#06020f]/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#00f0ff]/10">
          <h3 className="font-bold text-white text-sm font-mono tracking-wide">COACH NOTES</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="border-l-2 border-[#a855f7] pl-4 py-2">
            <p className="text-white/70 text-sm italic">&ldquo;Incredible 200 IM today! That&apos;s a 5-second PR!&rdquo;</p>
            <p className="text-white/20 text-xs font-mono mt-2">Coach Martinez • 2 hours ago</p>
          </div>
          <div className="border-l-2 border-[#00f0ff] pl-4 py-2">
            <p className="text-white/70 text-sm italic">&ldquo;Great leadership — helped three rookies with their starts today.&rdquo;</p>
            <p className="text-white/20 text-xs font-mono mt-2">Coach Martinez • Yesterday</p>
          </div>
        </div>
      </div>
    </div>
  );
}
