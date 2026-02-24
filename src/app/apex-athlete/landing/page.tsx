"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   METTLE — Landing Page v4
   Parallax-style glowing heartbeat cards. Minimal text.
   Game HUD energy meets biblical colors. Converts.
   ══════════════════════════════════════════════════════════════ */

const emptySubscribe = () => () => {};

const C = {
  gold: "#D4A843",
  goldLight: "#E8C97A",
  goldDim: "#A88430",
  purple: "#7C3AED",
  purpleDeep: "#4C1D95",
  scarlet: "#DC2626",
  blue: "#1E3A5F",
  dark: "#060410",
  darkCard: "#0D0919",
} as const;

export default function MettleLanding() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.dark }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin"
        style={{ borderColor: `${C.gold}20`, borderTopColor: C.gold }} />
    </div>
  );

  const portals = [
    {
      title: "Coach",
      sub: "Command your team",
      href: "/apex-athlete/portal",
      color: C.scarlet,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.scarlet} strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 2L15 8H9L12 2Z" /><circle cx="12" cy="14" r="4" /><path d="M6 22V20C6 17 9 15 12 15S18 17 18 20V22" />
        </svg>
      ),
    },
    {
      title: "Athlete",
      sub: "Own your journey",
      href: "/apex-athlete/portal",
      color: C.purple,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
        </svg>
      ),
    },
    {
      title: "Parent",
      sub: "Watch them rise",
      href: "/apex-athlete/portal",
      color: C.gold,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: C.dark, color: "#fff" }}>

      {/* ── Keyframes ── */}
      <style jsx>{`
        @keyframes heartbeat {
          0%, 100% {
            box-shadow: 0 0 8px var(--glow-color), 0 0 24px color-mix(in srgb, var(--glow-color) 40%, transparent),
                        inset 0 0 6px color-mix(in srgb, var(--glow-color) 8%, transparent);
            border-color: color-mix(in srgb, var(--glow-color) 35%, transparent);
          }
          50% {
            box-shadow: 0 0 16px var(--glow-color), 0 0 48px color-mix(in srgb, var(--glow-color) 25%, transparent),
                        inset 0 0 12px color-mix(in srgb, var(--glow-color) 12%, transparent);
            border-color: color-mix(in srgb, var(--glow-color) 60%, transparent);
          }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        .heartbeat-card {
          animation: heartbeat 3s ease-in-out infinite;
        }
        .float-gentle {
          animation: float-up 4s ease-in-out infinite;
        }
        .shimmer-text {
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
        .pulse-dot {
          animation: pulse-dot 2s ease-in-out infinite;
        }
      `}</style>

      {/* ── Ambient ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] opacity-20"
          style={{ background: `radial-gradient(ellipse, ${C.purpleDeep}50 0%, transparent 60%)` }} />
        <div className="absolute bottom-[-15%] left-1/2 -translate-x-1/2 w-[700px] h-[350px] opacity-12"
          style={{ background: `radial-gradient(ellipse, ${C.gold}25 0%, transparent 65%)` }} />
      </div>

      <div className="relative z-10">

        {/* ━━━ NAV ━━━ */}
        <nav className="max-w-5xl mx-auto px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-8 h-8" />
            <span className="text-sm font-semibold tracking-[0.2em] uppercase" style={{ color: C.gold }}>
              METTLE
            </span>
          </div>
          <Link
            href="/apex-athlete/portal"
            className="px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 hover:brightness-110"
            style={{ border: `1px solid ${C.gold}40`, color: C.gold }}
          >
            Sign In
          </Link>
        </nav>

        {/* ━━━ HERO ━━━ */}
        <section className="max-w-5xl mx-auto px-5 pt-14 sm:pt-24 pb-16 sm:pb-24 text-center">
          {/* Logo — floating */}
          <div className="mb-10 float-gentle">
            <img
              src="/mettle-brand/v5/mettle-icon.svg"
              alt="METTLE"
              className="w-24 h-24 sm:w-32 sm:h-32 mx-auto"
              style={{ filter: "drop-shadow(0 0 40px rgba(212,168,67,0.2))" }}
            />
          </div>

          {/* Headline — bold, minimal */}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            <span className="text-white">Where athletes</span>{" "}
            <span className="shimmer-text" style={{
              background: `linear-gradient(90deg, ${C.goldDim}, ${C.goldLight}, ${C.gold}, ${C.goldLight}, ${C.goldDim})`,
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              find their edge.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-white/40 max-w-md mx-auto mb-14 font-light">
            Train. Compete. Level up. Together.
          </p>

          {/* ━━━ PORTAL CARDS — glowing heartbeat ━━━ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto mb-16">
            {portals.map((p, i) => (
              <Link
                key={p.title}
                href={p.href}
                className="heartbeat-card group relative flex flex-col items-center rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] cursor-pointer"
                style={{
                  "--glow-color": p.color,
                  background: `linear-gradient(180deg, ${p.color}08 0%, ${C.darkCard} 100%)`,
                  borderColor: `${p.color}25`,
                  animationDelay: `${i * 0.5}s`,
                } as React.CSSProperties}
              >
                {/* Status dot */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: p.color, animationDelay: `${i * 0.3}s` }} />
                  <span className="text-[9px] tracking-widest uppercase font-bold" style={{ color: `${p.color}90` }}>LIVE</span>
                </div>

                {/* Icon */}
                <div className="mb-5 opacity-80 group-hover:opacity-100 transition-opacity">
                  {p.icon}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold tracking-wide mb-1" style={{ color: p.color }}>
                  {p.title}
                </h3>
                <p className="text-xs text-white/30 tracking-wider uppercase">
                  {p.sub}
                </p>

                {/* Enter indicator */}
                <div className="mt-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="h-[1px] w-8" style={{ background: `${p.color}40` }} />
                  <span className="text-[10px] tracking-widest uppercase" style={{ color: `${p.color}70` }}>Enter</span>
                  <span className="text-xs group-hover:translate-x-1 transition-transform" style={{ color: `${p.color}70` }}>&rarr;</span>
                </div>
              </Link>
            ))}
          </div>

          {/* CTA — glowing gold heartbeat button */}
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/apex-athlete/portal"
              className="heartbeat-card inline-flex items-center justify-center gap-2 px-12 py-4 rounded-full font-bold text-sm tracking-[0.15em] uppercase transition-all duration-300 hover:scale-[1.05] border"
              style={{
                "--glow-color": C.gold,
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                color: C.dark,
                borderColor: `${C.gold}60`,
              } as React.CSSProperties}
            >
              Get Started Free
            </Link>
            <span className="text-[10px] text-white/15 tracking-widest uppercase">Private Beta · By Invitation</span>
          </div>
        </section>

        {/* ━━━ MISSION — minimal ━━━ */}
        <section className="py-20 sm:py-28 text-center px-5">
          <div className="max-w-2xl mx-auto">
            <div className="w-10 h-[1px] mx-auto mb-10" style={{ background: `linear-gradient(90deg, transparent, ${C.gold}30, transparent)` }} />
            <p className="text-xl sm:text-2xl font-light text-white/50 leading-relaxed tracking-tight italic">
              &ldquo;Unlocking the greatness already inside every athlete — through the power of play.&rdquo;
            </p>
            <div className="w-10 h-[1px] mx-auto mt-10" style={{ background: `linear-gradient(90deg, transparent, ${C.gold}30, transparent)` }} />
          </div>
        </section>

        {/* ━━━ WAITLIST — compact ━━━ */}
        <section id="waitlist" className="pb-24 sm:pb-32">
          <div className="max-w-sm mx-auto px-5 text-center">
            <h2 className="text-xl font-bold tracking-tight mb-2 text-white">
              Join the beta.
            </h2>
            <p className="text-white/25 text-xs mb-8 tracking-wide">
              Early access for select teams.
            </p>

            {submitted ? (
              <div className="heartbeat-card rounded-2xl p-5 border" style={{
                "--glow-color": C.purple,
                background: `${C.purple}08`,
                borderColor: `${C.purple}20`,
              } as React.CSSProperties}>
                <p className="text-sm font-medium" style={{ color: `${C.purple}CC` }}>You&apos;re on the list.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) {
                    const waitlist = JSON.parse(localStorage.getItem("mettle_waitlist") || "[]");
                    waitlist.push({ email: email.trim(), ts: Date.now() });
                    localStorage.setItem("mettle_waitlist", JSON.stringify(waitlist));
                    setSubmitted(true);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coach@team.com"
                  className="flex-1 px-4 py-3 rounded-xl text-white text-sm placeholder:text-white/15 focus:outline-none transition-all"
                  style={{
                    background: C.darkCard,
                    border: `1px solid rgba(255,255,255,0.06)`,
                  }}
                />
                <button
                  type="submit"
                  className="heartbeat-card px-6 py-3 rounded-xl font-semibold text-xs tracking-wider border transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    "--glow-color": C.gold,
                    background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                    color: C.dark,
                    borderColor: `${C.gold}50`,
                  } as React.CSSProperties}
                >
                  Join
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ━━━ FOOTER ━━━ */}
        <footer className="pb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="" className="w-4 h-4 opacity-15" />
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/10">METTLE</span>
          </div>
          <p className="text-white/[0.06] text-[10px] tracking-wider">
            Parallax Ventures · {new Date().getFullYear()}
          </p>
        </footer>

      </div>
    </div>
  );
}
