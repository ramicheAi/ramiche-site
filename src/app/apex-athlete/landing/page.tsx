"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   METTLE — Landing Page v5
   "Like a heartbeat getting ready for a race."
   Game energy. Belief in self. Drive. Elevation.
   ══════════════════════════════════════════════════════════════ */

const emptySubscribe = () => () => {};

const C = {
  gold: "#D4A843",
  goldLight: "#E8C97A",
  goldBright: "#FFD700",
  goldDim: "#A88430",
  purple: "#7C3AED",
  purpleDeep: "#4C1D95",
  scarlet: "#DC2626",
  scarletBright: "#EF4444",
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
      href: "/apex-athlete/login?role=coach",
      color: C.scarlet,
      brightColor: C.scarletBright,
      icon: (
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 2L15 8H9L12 2Z" /><circle cx="12" cy="14" r="4" /><path d="M6 22V20C6 17 9 15 12 15S18 17 18 20V22" />
        </svg>
      ),
    },
    {
      title: "Athlete",
      sub: "Own your journey",
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
      title: "Parent",
      sub: "Watch them rise",
      href: "/apex-athlete/parent",
      color: C.gold,
      brightColor: C.goldBright,
      icon: (
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: C.dark, color: "#fff" }}>

      {/* ── Keyframes ── */}
      <style jsx>{`
        @keyframes heartbeat-intense {
          0%, 100% {
            box-shadow: 0 0 15px var(--glow-color),
                        0 0 40px color-mix(in srgb, var(--glow-color) 30%, transparent),
                        0 0 80px color-mix(in srgb, var(--glow-color) 10%, transparent),
                        inset 0 0 15px color-mix(in srgb, var(--glow-color) 8%, transparent);
            border-color: color-mix(in srgb, var(--glow-color) 50%, transparent);
          }
          25% {
            box-shadow: 0 0 25px var(--glow-color),
                        0 0 60px color-mix(in srgb, var(--glow-color) 40%, transparent),
                        0 0 100px color-mix(in srgb, var(--glow-color) 15%, transparent),
                        inset 0 0 25px color-mix(in srgb, var(--glow-color) 15%, transparent);
            border-color: color-mix(in srgb, var(--glow-color) 80%, transparent);
          }
          50% {
            box-shadow: 0 0 15px var(--glow-color),
                        0 0 40px color-mix(in srgb, var(--glow-color) 30%, transparent),
                        0 0 80px color-mix(in srgb, var(--glow-color) 10%, transparent),
                        inset 0 0 15px color-mix(in srgb, var(--glow-color) 8%, transparent);
            border-color: color-mix(in srgb, var(--glow-color) 50%, transparent);
          }
          75% {
            box-shadow: 0 0 30px var(--glow-color),
                        0 0 70px color-mix(in srgb, var(--glow-color) 45%, transparent),
                        0 0 120px color-mix(in srgb, var(--glow-color) 18%, transparent),
                        inset 0 0 30px color-mix(in srgb, var(--glow-color) 18%, transparent);
            border-color: var(--glow-color);
          }
        }
        @keyframes heartbeat-cta {
          0%, 100% {
            box-shadow: 0 0 25px var(--glow-color),
                        0 0 60px color-mix(in srgb, var(--glow-color) 50%, transparent),
                        0 0 120px color-mix(in srgb, var(--glow-color) 20%, transparent);
            transform: scale(1);
          }
          12% {
            box-shadow: 0 0 50px var(--glow-color),
                        0 0 100px color-mix(in srgb, var(--glow-color) 65%, transparent),
                        0 0 180px color-mix(in srgb, var(--glow-color) 30%, transparent);
            transform: scale(1.05);
          }
          24% {
            box-shadow: 0 0 25px var(--glow-color),
                        0 0 60px color-mix(in srgb, var(--glow-color) 50%, transparent),
                        0 0 120px color-mix(in srgb, var(--glow-color) 20%, transparent);
            transform: scale(1);
          }
          40% {
            box-shadow: 0 0 60px var(--glow-color),
                        0 0 120px color-mix(in srgb, var(--glow-color) 70%, transparent),
                        0 0 200px color-mix(in srgb, var(--glow-color) 35%, transparent);
            transform: scale(1.06);
          }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shimmer-gold {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.6); }
        }
        @keyframes reveal {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow-ring {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.08); }
        }
        .heartbeat-card {
          animation: heartbeat-intense 2s ease-in-out infinite;
        }
        .heartbeat-cta {
          animation: heartbeat-cta 2s ease-in-out infinite;
        }
        .float-gentle {
          animation: float-up 4s ease-in-out infinite;
        }
        .shimmer-text {
          background-size: 200% 100%;
          animation: shimmer-gold 3s linear infinite;
        }
        .pulse-dot {
          animation: pulse-dot 1.5s ease-in-out infinite;
        }
        .reveal {
          animation: reveal 0.8s ease-out both;
        }
        .reveal-d1 { animation-delay: 0.1s; }
        .reveal-d2 { animation-delay: 0.2s; }
        .reveal-d3 { animation-delay: 0.35s; }
        .reveal-d4 { animation-delay: 0.5s; }
        .glow-ring {
          animation: glow-ring 3s ease-in-out infinite;
        }
        @keyframes live-pulse {
          0%, 100% { box-shadow: 0 0 4px var(--dot-color); opacity: 0.6; }
          50% { box-shadow: 0 0 12px var(--dot-color), 0 0 24px var(--dot-color); opacity: 1; }
        }
        .live-badge {
          animation: live-pulse 1.5s ease-in-out infinite;
        }
        .portal-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .portal-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
          }
        }
      `}</style>

      {/* ── Ambient glow backdrop — scales for desktop ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[900px] lg:w-[1400px] h-[900px] lg:h-[1200px] opacity-25"
          style={{ background: `radial-gradient(ellipse, ${C.purpleDeep}60 0%, transparent 55%)` }} />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[800px] lg:w-[1200px] h-[400px] lg:h-[600px] opacity-15"
          style={{ background: `radial-gradient(ellipse, ${C.gold}30 0%, transparent 60%)` }} />
        <div className="absolute top-[40%] right-[-10%] w-[400px] lg:w-[600px] h-[400px] lg:h-[600px] opacity-10"
          style={{ background: `radial-gradient(ellipse, ${C.scarlet}30 0%, transparent 60%)` }} />
      </div>

      <div className="relative z-10 flex flex-col items-center min-h-screen w-full">

        {/* ━━━ NAV ━━━ */}
        <nav style={{ width: "100%", maxWidth: "1200px", padding: "1.25rem 2rem" }} className="mx-auto flex items-center justify-between reveal">
          <div className="flex items-center gap-3">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-9 h-9 lg:w-11 lg:h-11" />
            <span className="text-sm lg:text-base font-bold tracking-[0.25em] uppercase" style={{ color: C.gold }}>
              METTLE
            </span>
          </div>
          <Link
            href="/apex-athlete/login"
            className="heartbeat-card px-6 py-2.5 lg:px-8 lg:py-3 rounded-full text-xs lg:text-sm font-bold tracking-wider uppercase transition-all duration-300 hover:scale-105 border-2"
            style={{
              "--glow-color": C.gold,
              borderColor: `${C.gold}60`,
              color: C.gold,
            } as React.CSSProperties}
          >
            Sign In
          </Link>
        </nav>

        {/* ━━━ HERO — takes full viewport on desktop ━━━ */}
        <section style={{ width: "100%", maxWidth: "1200px", padding: "3rem 2rem 2.5rem" }} className="flex-1 flex flex-col items-center justify-center mx-auto text-center">
          {/* Logo with glow ring */}
          <div className="mb-10 lg:mb-14 float-gentle reveal reveal-d1 relative inline-block">
            <div className="absolute inset-[-20px] rounded-full glow-ring"
              style={{ background: `radial-gradient(circle, ${C.gold}15 0%, transparent 70%)` }} />
            <img
              src="/mettle-brand/v5/mettle-icon.svg"
              alt="METTLE"
              className="w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 mx-auto relative"
              style={{ filter: `drop-shadow(0 0 50px ${C.gold}40)` }}
            />
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-8xl xl:text-9xl font-black tracking-tight leading-[1.05] mb-6 lg:mb-8 reveal reveal-d2">
            <span className="block text-white">Become</span>
            <span className="shimmer-text inline-block" style={{
              background: `linear-gradient(90deg, ${C.goldDim}, ${C.goldBright}, ${C.gold}, ${C.goldBright}, ${C.goldDim})`,
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Unstoppable.
            </span>
          </h1>

          <p className="text-lg sm:text-xl lg:text-2xl text-white/50 max-w-lg lg:max-w-2xl mx-auto mb-12 lg:mb-16 font-light reveal reveal-d3">
            The fire is already inside you. We just help you unleash it.
          </p>

          {/* CTA — BIG, THICK, GLOWING like a heartbeat before a race */}
          <div className="flex flex-col items-center gap-5 mb-6 reveal reveal-d4">
            <Link
              href="/apex-athlete/login"
              className="heartbeat-cta inline-flex items-center justify-center rounded-2xl font-black tracking-[0.15em] uppercase transition-all duration-300 hover:scale-[1.08]"
              style={{
                "--glow-color": C.goldBright,
                background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold}, ${C.goldDim})`,
                color: C.dark,
                borderColor: C.goldLight,
                borderWidth: "3px",
                borderStyle: "solid",
                padding: "clamp(1.5rem, 2.5vw, 2.5rem) clamp(4rem, 8vw, 10rem)",
                fontSize: "clamp(1.25rem, 2vw, 2rem)",
                minWidth: "clamp(280px, 40vw, 500px)",
              } as React.CSSProperties}
            >
              Get Started Free
            </Link>
            <span className="text-xs lg:text-sm text-white/20 tracking-[0.3em] uppercase font-medium">
              Private Beta
            </span>
          </div>
        </section>

        {/* ━━━ PORTAL CARDS — intense heartbeat glow ━━━ */}
        <section style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "4rem 2rem 5rem" }}>
          <div className="portal-grid">
            {portals.map((p, i) => (
              <Link
                key={p.title}
                href={p.href}
                className="heartbeat-card group relative flex flex-col items-center justify-center rounded-3xl border-2 transition-all duration-300 hover:-translate-y-3 hover:scale-[1.03] cursor-pointer"
                style={{
                  ...({
                    "--glow-color": p.color,
                    background: `linear-gradient(180deg, ${p.color}0A 0%, ${C.darkCard} 40%, ${p.color}05 100%)`,
                    borderColor: `${p.color}30`,
                    animationDelay: `${i * 0.4}s`,
                    padding: "clamp(2.5rem, 4vw, 5rem) clamp(2rem, 3vw, 3rem)",
                    minHeight: "clamp(260px, 30vw, 480px)",
                  } as React.CSSProperties)
                }}
              >
                {/* Status dot — glowing live badge */}
                <div className="absolute top-5 right-5 lg:top-7 lg:right-7 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full live-badge" style={{ background: p.brightColor, "--dot-color": p.brightColor, animationDelay: `${i * 0.3}s` } as React.CSSProperties} />
                  <span className="text-[10px] lg:text-xs tracking-[0.2em] uppercase font-bold" style={{ color: p.brightColor }}>LIVE</span>
                </div>

                {/* Icon — large, glowing */}
                <div className="mb-8 lg:mb-10 transition-all duration-300 group-hover:scale-110" style={{ color: p.brightColor, filter: `drop-shadow(0 0 20px ${p.color}60)` }}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-14 h-14 lg:w-20 lg:h-20">
                    {p.title === "Coach" && <><path d="M12 2L15 8H9L12 2Z" /><circle cx="12" cy="14" r="4" /><path d="M6 22V20C6 17 9 15 12 15S18 17 18 20V22" /></>}
                    {p.title === "Athlete" && <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />}
                    {p.title === "Parent" && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />}
                  </svg>
                </div>

                {/* Title */}
                <h3 className="text-3xl lg:text-4xl font-black tracking-wide mb-3" style={{ color: p.brightColor }}>
                  {p.title}
                </h3>
                <p className="text-base lg:text-lg text-white/40 tracking-wider font-medium">
                  {p.sub}
                </p>

                {/* Enter arrow — always visible on mobile, hover on desktop */}
                <div className="mt-8 lg:mt-10 flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                  <div className="h-[2px] w-10 lg:w-14 rounded-full" style={{ background: `${p.color}50` }} />
                  <span className="text-sm lg:text-base font-bold tracking-widest uppercase" style={{ color: p.brightColor }}>Enter</span>
                  <span className="text-base lg:text-lg font-bold group-hover:translate-x-1 transition-transform" style={{ color: p.brightColor }}>&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ━━━ MISSION — one powerful line ━━━ */}
        <section style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "5rem 2rem", textAlign: "center" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div className="flex items-center justify-center gap-4 mb-8 lg:mb-12">
              <div className="h-[2px] w-16 lg:w-24 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${C.gold}40)` }} />
              <img src="/mettle-brand/v5/mettle-icon.svg" alt="" className="w-8 h-8 lg:w-12 lg:h-12 opacity-40" />
              <div className="h-[2px] w-16 lg:w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${C.gold}40, transparent)` }} />
            </div>
            <p className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-light leading-relaxed tracking-tight" style={{ color: `${C.gold}90` }}>
              Unlocking the greatness already inside every athlete.
            </p>
          </div>
        </section>

        {/* ━━━ WAITLIST — compact, glowing ━━━ */}
        <section id="waitlist" style={{ width: "100%", maxWidth: "700px", margin: "0 auto", padding: "0 2rem 6rem", textAlign: "center" }}>
          <div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight mb-3 lg:mb-4 text-white">
              Ready to compete?
            </h2>
            <p className="text-white/30 text-sm lg:text-base mb-10 lg:mb-12">
              Request early access for your team.
            </p>

            {submitted ? (
              <div className="heartbeat-card rounded-2xl p-6 lg:p-8 border-2" style={{
                "--glow-color": C.purple,
                background: `${C.purple}0A`,
                borderColor: `${C.purple}30`,
              } as React.CSSProperties}>
                <p className="text-lg lg:text-xl font-bold" style={{ color: C.purple }}>You&apos;re in. We&apos;ll be in touch.</p>
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
                className="flex gap-3 lg:gap-4"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coach@team.com"
                  className="flex-1 px-5 py-4 lg:px-7 lg:py-5 rounded-2xl text-white text-base lg:text-lg placeholder:text-white/20 focus:outline-none transition-all"
                  style={{
                    background: C.darkCard,
                    border: `2px solid rgba(255,255,255,0.08)`,
                  }}
                />
                <button
                  type="submit"
                  className="heartbeat-cta px-12 py-5 lg:px-16 lg:py-5 rounded-2xl font-black text-lg lg:text-xl tracking-[0.15em] uppercase border-2 transition-all duration-300 hover:scale-110"
                  style={{
                    "--glow-color": C.goldBright,
                    background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold}, ${C.goldDim})`,
                    color: C.dark,
                    borderColor: C.goldLight,
                    minWidth: "140px",
                  } as React.CSSProperties}
                >
                  Join
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ━━━ FOOTER ━━━ */}
        <footer className="pb-10 lg:pb-14 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="" className="w-5 h-5 lg:w-6 lg:h-6 opacity-20" />
            <span className="text-xs lg:text-sm tracking-[0.25em] uppercase text-white/15 font-bold">METTLE</span>
          </div>
          <p className="text-white/[0.08] text-[10px] lg:text-xs tracking-wider">
            Parallax Ventures · {new Date().getFullYear()}
          </p>
        </footer>

      </div>
    </div>
  );
}
