"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   METTLE — Landing Page v3
   Apple-inspired. Premium. Inviting. Biblical palette.
   Generous spacing, large typography, visual storytelling.
   ══════════════════════════════════════════════════════════════ */

const emptySubscribe = () => () => {};

/* Biblical palette — refined for premium feel */
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
  darkSurface: "#110E1D",
  cream: "#FAF5EB",
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

  return (
    <div className="min-h-screen" style={{ background: C.dark, color: "#fff" }}>

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top glow — purple haze */}
        <div className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] opacity-30"
          style={{ background: `radial-gradient(ellipse, ${C.purpleDeep}40 0%, transparent 65%)` }} />
        {/* Bottom gold warmth */}
        <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-15"
          style={{ background: `radial-gradient(ellipse, ${C.gold}30 0%, transparent 70%)` }} />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10">

        {/* ━━━ NAV ━━━ */}
        <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-8 h-8" />
            <span className="text-sm font-semibold tracking-[0.2em] uppercase" style={{ color: C.gold }}>
              METTLE
            </span>
          </div>
          <Link
            href="/apex-athlete/portal"
            className="px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 hover:brightness-110"
            style={{ border: `1px solid ${C.gold}35`, color: C.gold }}
          >
            Sign In
          </Link>
        </nav>

        {/* ━━━ HERO ━━━ */}
        <section className="max-w-6xl mx-auto px-6 pt-16 sm:pt-28 pb-24 sm:pb-40 text-center">
          {/* Logo — hero-sized */}
          <div className="mb-12 sm:mb-16">
            <div className="relative inline-block">
              <img
                src="/mettle-brand/v5/mettle-icon.svg"
                alt="METTLE"
                className="w-28 h-28 sm:w-40 sm:h-40 mx-auto"
                style={{ filter: "drop-shadow(0 0 60px rgba(212,168,67,0.15))" }}
              />
            </div>
          </div>

          {/* Headline — Apple-sized, confident */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="block text-white">Where athletes</span>
            <span className="block" style={{
              background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold}, ${C.goldDim})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              find their edge.
            </span>
          </h1>

          {/* Sub — warm and inviting */}
          <p className="text-lg sm:text-xl text-white/50 max-w-xl mx-auto mb-12 leading-relaxed font-light">
            The platform that transforms how teams train, compete, and grow — together.
          </p>

          {/* CTAs — prominent, warm */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/apex-athlete/portal"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full font-semibold text-sm tracking-wider transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                color: C.dark,
                boxShadow: `0 8px 32px ${C.gold}25`,
              }}
            >
              Get Started Free
            </Link>
            <a
              href="#waitlist"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full font-semibold text-sm tracking-wider transition-all duration-300 hover:bg-white/[0.04]"
              style={{ border: `1px solid rgba(255,255,255,0.1)`, color: "rgba(255,255,255,0.6)" }}
            >
              Learn More
            </a>
          </div>

          {/* Trust signal — subtle */}
          <div className="mt-14 flex items-center justify-center gap-6 text-[11px] font-medium tracking-wider uppercase text-white/20">
            <span>Private Beta</span>
            <span className="w-1 h-1 rounded-full bg-white/10" />
            <span>By Invitation</span>
          </div>
        </section>

        {/* ━━━ VALUE PROPOSITION — full-bleed sections ━━━ */}

        {/* Section 1: Coach */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 0%, ${C.darkSurface} 30%, ${C.darkSurface} 70%, transparent 100%)` }} />
          <div className="relative z-10 max-w-5xl mx-auto px-6">
            <div className="text-center mb-12 sm:mb-16">
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all"
                style={{ background: `linear-gradient(135deg, ${C.scarlet}18, ${C.scarlet}08)`, border: `1px solid ${C.scarlet}15` }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.scarlet} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 2L15 8H9L12 2Z" /><circle cx="12" cy="14" r="4" /><path d="M6 22V20C6 17 9 15 12 15S18 17 18 20V22" />
                </svg>
              </div>
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: C.scarlet }}>For Coaches</p>
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.15] mb-5">
                <span className="text-white">Your team.</span><br />
                <span className="text-white/40">Your system.</span>
              </h2>
              <p className="text-white/35 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
                Run practice, manage meets, and watch every athlete level up — all from one dashboard built for the way you coach.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3">
              {["Practice Check-In", "Meet Management", "Roster & Groups", "Analytics", "Quest Builder"].map((f) => (
                <div key={f} className="px-5 py-2.5 rounded-full text-xs font-medium tracking-wide"
                  style={{ background: `${C.scarlet}08`, border: `1px solid ${C.scarlet}12`, color: `${C.scarlet}CC` }}>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Athlete */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          <div className="relative z-10 max-w-5xl mx-auto px-6">
            <div className="text-center mb-12 sm:mb-16">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: `linear-gradient(135deg, ${C.purple}18, ${C.purple}08)`, border: `1px solid ${C.purple}15` }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                </svg>
              </div>
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: C.purple }}>For Athletes</p>
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.15] mb-5">
                <span className="text-white">Your journey.</span><br />
                <span className="text-white/40">Your legacy.</span>
              </h2>
              <p className="text-white/35 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
                Track your progress, earn your rank, complete challenges, and see exactly how far you&apos;ve come — every single day.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {["Personal Dashboard", "XP & Levels", "Race Prep", "Wellness Check-In", "Leaderboard"].map((f) => (
                <div key={f} className="px-5 py-2.5 rounded-full text-xs font-medium tracking-wide"
                  style={{ background: `${C.purple}08`, border: `1px solid ${C.purple}12`, color: `${C.purple}CC` }}>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Parent */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 0%, ${C.darkSurface} 30%, ${C.darkSurface} 70%, transparent 100%)` }} />
          <div className="relative z-10 max-w-5xl mx-auto px-6">
            <div className="text-center mb-12 sm:mb-16">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: `linear-gradient(135deg, ${C.gold}18, ${C.gold}08)`, border: `1px solid ${C.gold}15` }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: C.gold }}>For Parents</p>
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.15] mb-5">
                <span className="text-white">Their growth.</span><br />
                <span className="text-white/40">Your front row.</span>
              </h2>
              <p className="text-white/35 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
                Stay connected to your child&apos;s athletic journey. See milestones, celebrate wins, and watch them become who they&apos;re meant to be.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {["Growth Trends", "Badge Gallery", "Encouragement", "Activity Feed", "Meet Results"].map((f) => (
                <div key={f} className="px-5 py-2.5 rounded-full text-xs font-medium tracking-wide"
                  style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}12`, color: `${C.gold}CC` }}>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━ MISSION — centered statement ━━━ */}
        <section className="py-28 sm:py-40 text-center px-6">
          <div className="max-w-3xl mx-auto">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="" className="w-12 h-12 mx-auto mb-10 opacity-30" />
            <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-light text-white/70 leading-relaxed tracking-tight">
              &ldquo;Unlocking the greatness already inside every athlete — through the power of play.&rdquo;
            </blockquote>
          </div>
        </section>

        {/* ━━━ WAITLIST ━━━ */}
        <section id="waitlist" className="py-24 sm:py-32">
          <div className="max-w-md mx-auto px-6 text-center">
            {/* Decorative line */}
            <div className="w-12 h-[1px] mx-auto mb-10" style={{ background: `linear-gradient(90deg, transparent, ${C.gold}40, transparent)` }} />

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-white">
              Join the beta.
            </h2>
            <p className="text-white/30 text-sm mb-10 leading-relaxed">
              We&apos;re onboarding select teams for early access. Be one of the first.
            </p>

            {submitted ? (
              <div className="rounded-2xl p-6" style={{ background: `${C.purple}08`, border: `1px solid ${C.purple}15` }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: `${C.purple}15` }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: `${C.purple}BB` }}>You&apos;re on the list. We&apos;ll be in touch.</p>
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
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coach@yourteam.com"
                  className="flex-1 px-5 py-4 rounded-2xl text-white text-sm placeholder:text-white/15 focus:outline-none focus:ring-1 transition-all"
                  style={{
                    background: C.darkCard,
                    border: `1px solid rgba(255,255,255,0.06)`,
                  }}
                />
                <button
                  type="submit"
                  className="px-8 py-4 rounded-2xl font-semibold text-sm tracking-wider transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                    color: C.dark,
                    boxShadow: `0 4px 20px ${C.gold}20`,
                  }}
                >
                  Request Access
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ━━━ FOOTER ━━━ */}
        <footer className="pb-12 pt-8 text-center px-6">
          <div className="w-20 h-[1px] mx-auto mb-8" style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)` }} />
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="" className="w-5 h-5 opacity-20" />
            <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/15">METTLE</span>
          </div>
          <p className="text-white/[0.08] text-[10px] tracking-wider">
            Parallax Ventures · {new Date().getFullYear()}
          </p>
        </footer>

      </div>
    </div>
  );
}
