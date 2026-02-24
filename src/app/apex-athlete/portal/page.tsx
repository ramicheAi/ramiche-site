"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   METTLE — Portal Selector (desktop + mobile optimized)
   Biblical palette: purple, scarlet, gold, blue
   ══════════════════════════════════════════════════════════════ */

const C = {
  gold: "#D4A843",
  goldLight: "#E8C97A",
  goldBright: "#FFD700",
  purple: "#7C3AED",
  purpleDeep: "#4C1D95",
  scarlet: "#DC2626",
  scarletBright: "#EF4444",
  dark: "#060410",
  darkCard: "#0D0919",
} as const;

const PORTALS = [
  {
    id: "coach",
    title: "Coach",
    desc: "Command your team",
    href: "/apex-athlete",
    color: C.scarlet,
    brightColor: C.scarletBright,
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2L15 8H9L12 2Z" /><circle cx="12" cy="14" r="4" /><path d="M6 22V20C6 17 9 15 12 15S18 17 18 20V22" />
      </svg>
    ),
  },
  {
    id: "athlete",
    title: "Athlete",
    desc: "Own your journey",
    href: "/apex-athlete/athlete",
    color: C.purple,
    brightColor: "#A78BFA",
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
      </svg>
    ),
  },
  {
    id: "parent",
    title: "Parent",
    desc: "Watch them rise",
    href: "/apex-athlete/parent",
    color: C.gold,
    brightColor: C.goldBright,
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
] as const;

const emptySubscribe = () => () => {};

export default function PortalSelector() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [rosterCount, setRosterCount] = useState(0);

  useEffect(() => {
    try {
      const roster = JSON.parse(localStorage.getItem("apex_roster") || "[]");
      setRosterCount(Array.isArray(roster) ? roster.length : 0); // eslint-disable-line react-hooks/set-state-in-effect -- localStorage read on mount
    } catch { setRosterCount(0); }
  }, []);

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.dark }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin"
        style={{ borderColor: `${C.gold}20`, borderTopColor: C.gold }} />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: C.dark, color: "#fff" }}>

      <style jsx>{`
        @keyframes heartbeat-intense {
          0%, 100% {
            box-shadow: 0 0 15px var(--glow-color),
                        0 0 40px color-mix(in srgb, var(--glow-color) 30%, transparent),
                        0 0 80px color-mix(in srgb, var(--glow-color) 10%, transparent);
            border-color: color-mix(in srgb, var(--glow-color) 50%, transparent);
          }
          25% {
            box-shadow: 0 0 25px var(--glow-color),
                        0 0 60px color-mix(in srgb, var(--glow-color) 40%, transparent),
                        0 0 100px color-mix(in srgb, var(--glow-color) 15%, transparent);
            border-color: color-mix(in srgb, var(--glow-color) 80%, transparent);
          }
          50% {
            box-shadow: 0 0 15px var(--glow-color),
                        0 0 40px color-mix(in srgb, var(--glow-color) 30%, transparent),
                        0 0 80px color-mix(in srgb, var(--glow-color) 10%, transparent);
            border-color: color-mix(in srgb, var(--glow-color) 50%, transparent);
          }
          75% {
            box-shadow: 0 0 30px var(--glow-color),
                        0 0 70px color-mix(in srgb, var(--glow-color) 45%, transparent),
                        0 0 120px color-mix(in srgb, var(--glow-color) 18%, transparent);
            border-color: var(--glow-color);
          }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.6); }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .heartbeat-card { animation: heartbeat-intense 2s ease-in-out infinite; }
        .pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
        .float-gentle { animation: float-up 4s ease-in-out infinite; }
      `}</style>

      {/* ── Ambient glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] lg:w-[1200px] h-[800px] lg:h-[1000px] opacity-20"
          style={{ background: `radial-gradient(ellipse, ${C.purpleDeep}60 0%, transparent 55%)` }} />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[600px] lg:w-[1000px] h-[300px] lg:h-[500px] opacity-12"
          style={{ background: `radial-gradient(ellipse, ${C.gold}30 0%, transparent 60%)` }} />
      </div>

      {/* ── Content — centered vertically on desktop ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-4 lg:px-8 xl:px-10 2xl:px-12 py-12 sm:py-16 lg:py-0">

        {/* Header */}
        <div className="text-center mb-10 lg:mb-16">
          <div className="float-gentle mb-6 lg:mb-8">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-16 h-16 lg:w-24 lg:h-24 mx-auto"
              style={{ filter: `drop-shadow(0 0 30px ${C.gold}40)` }} />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-black tracking-tight mb-3 lg:mb-4">
            Choose Your Portal
          </h1>
          {rosterCount > 0 && (
            <p className="text-sm lg:text-base font-mono" style={{ color: `${C.gold}50` }}>{rosterCount} athletes registered</p>
          )}
        </div>

        {/* Portal cards — full width on desktop */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-8 xl:gap-10 mb-12 lg:mb-16">
          {PORTALS.map((p, i) => (
            <Link
              key={p.id}
              href={p.href}
              className="heartbeat-card group relative flex flex-col items-center rounded-3xl border-2 p-8 lg:p-12 xl:p-14 transition-all duration-300 hover:-translate-y-3 hover:scale-[1.03] cursor-pointer"
              style={{
                "--glow-color": p.color,
                background: `linear-gradient(180deg, ${p.color}0A 0%, ${C.darkCard} 40%, ${p.color}05 100%)`,
                borderColor: `${p.color}30`,
                animationDelay: `${i * 0.4}s`,
              } as React.CSSProperties}
            >
              {/* Status dot */}
              <div className="absolute top-5 right-5 lg:top-7 lg:right-7 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: p.brightColor, animationDelay: `${i * 0.3}s` }} />
                <span className="text-[10px] lg:text-xs tracking-[0.2em] uppercase font-bold" style={{ color: p.brightColor }}>LIVE</span>
              </div>

              {/* Icon */}
              <div className="mb-5 lg:mb-8 transition-all duration-300 group-hover:scale-110" style={{ color: p.brightColor }}>
                <div className="w-11 h-11 lg:w-16 lg:h-16">{p.icon}</div>
              </div>

              {/* Title */}
              <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-wide mb-2" style={{ color: p.brightColor }}>
                {p.title}
              </h2>
              <p className="text-sm lg:text-base text-white/40 tracking-wider font-medium">
                {p.desc}
              </p>

              {/* Enter arrow */}
              <div className="mt-6 lg:mt-10 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                <div className="h-[2px] w-10 lg:w-14 rounded-full" style={{ background: `${p.color}50` }} />
                <span className="text-sm lg:text-base font-bold tracking-widest uppercase" style={{ color: p.brightColor }}>Enter</span>
                <span className="text-base lg:text-lg font-bold group-hover:translate-x-1 transition-transform" style={{ color: p.brightColor }}>&rarr;</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Mission */}
        <div className="text-center">
          <p className="text-sm lg:text-lg font-light tracking-tight" style={{ color: `${C.gold}40` }}>
            Unlocking the greatness already inside every athlete.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 pb-8 lg:pb-10 text-center">
        <p className="text-white/[0.08] text-[10px] lg:text-xs tracking-wider">
          Parallax Ventures · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
