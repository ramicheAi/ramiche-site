"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Portal Selector
   Three-portal architecture: Coach · Athlete · Parent
   ══════════════════════════════════════════════════════════════ */

const PORTALS = [
  {
    id: "coach",
    title: "Coach Portal",
    icon: "🏋️",
    desc: "Full access — check-ins, roster, analytics, schedule builder",
    href: "/apex-athlete",
    accent: "#00f0ff",
    glow: "rgba(0,240,255,0.3)",
    badge: "PIN Required",
    badgeColor: "#00f0ff",
  },
  {
    id: "athlete",
    title: "Athlete Portal",
    icon: "🏊",
    desc: "Your personal dashboard — XP, level, quests, streaks",
    href: "/apex-athlete/athlete",
    accent: "#a855f7",
    glow: "rgba(168,85,247,0.3)",
    badge: "PIN Required",
    badgeColor: "#a855f7",
  },
  {
    id: "parent",
    title: "Parent Portal",
    icon: "👨‍👩‍👧",
    desc: "Watch your swimmer grow — trends, milestones, encouragement",
    href: "/apex-athlete/parent",
    accent: "#f59e0b",
    glow: "rgba(245,158,11,0.3)",
    badge: "PIN Required",
    badgeColor: "#f59e0b",
  },
] as const;

export default function PortalSelector() {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [rosterCount, setRosterCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      const roster = JSON.parse(localStorage.getItem("apex_roster") || "[]");
      setRosterCount(Array.isArray(roster) ? roster.length : 0);
    } catch { setRosterCount(0); }
  }, []);

  if (!mounted) return (
    <div className="min-h-screen bg-[#06020f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06020f] relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.08)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(0,240,255,0.04)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00f0ff]/5 border border-[#00f0ff]/10 mb-6">
            <span className="text-[#00f0ff]/60 text-xs font-mono tracking-wider">APEX ATHLETE</span>
            {rosterCount > 0 && (
              <span className="text-[#f59e0b]/50 text-xs font-mono">· {rosterCount} athletes</span>
            )}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">
            Choose Your <span className="bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#f59e0b] bg-clip-text text-transparent">Portal</span>
          </h1>
          <p className="text-white/20 text-sm sm:text-base max-w-md mx-auto">
            Athlete Relations Manager — Gamified Training System
          </p>
        </div>

        {/* Portal cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          {PORTALS.map((p) => {
            const isHovered = hovered === p.id;
            return (
              <Link
                key={p.id}
                href={p.href}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                className="group relative block"
              >
                {/* Glow effect */}
                <div
                  className="absolute -inset-[1px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                  style={{ background: `radial-gradient(circle, ${p.glow}, transparent 70%)` }}
                />

                <div
                  className={`relative rounded-3xl p-6 sm:p-8 transition-all duration-300 border backdrop-blur-xl ${
                    isHovered
                      ? "bg-[#0a0418]/90 scale-[1.02] shadow-2xl"
                      : "bg-[#06020f]/70 scale-100"
                  }`}
                  style={{
                    borderColor: isHovered ? `${p.accent}40` : `${p.accent}15`,
                    boxShadow: isHovered ? `0 0 60px ${p.glow.replace("0.3", "0.15")}, inset 0 0 30px ${p.glow.replace("0.3", "0.03")}` : "none",
                  }}
                >
                  {/* Badge */}
                  <div
                    className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase mb-5 font-mono"
                    style={{
                      color: `${p.badgeColor}90`,
                      background: `${p.badgeColor}10`,
                      border: `1px solid ${p.badgeColor}20`,
                    }}
                  >
                    {p.badge}
                  </div>

                  {/* Icon */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${p.accent}20, ${p.accent}05)`,
                      border: `2px solid ${p.accent}25`,
                      boxShadow: isHovered ? `0 0 30px ${p.accent}15` : "none",
                    }}
                  >
                    {p.icon}
                  </div>

                  {/* Title */}
                  <h2 className="text-white text-xl font-bold mb-2">{p.title}</h2>

                  {/* Description */}
                  <p className="text-white/25 text-sm leading-relaxed">{p.desc}</p>

                  {/* Arrow */}
                  <div
                    className={`mt-6 flex items-center gap-2 text-sm font-mono tracking-wider transition-all duration-300 ${
                      isHovered ? "translate-x-1" : ""
                    }`}
                    style={{ color: `${p.accent}60` }}
                  >
                    <span>ENTER</span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Mission Statement */}
        <div className="text-center mt-12 sm:mt-16 space-y-2">
          <p className="text-white/10 text-xs italic">&ldquo;Unlocking the greatness already inside every athlete — through the power of play.&rdquo;</p>
          <p className="text-white/[0.06] text-[10px]">Every rep counts. Every streak matters. Every athlete has a story.</p>
        </div>
      </div>
    </div>
  );
}
