"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   METTLE — Landing Page v2
   Clean. Professional. Gamified. Biblical palette.
   ══════════════════════════════════════════════════════════════ */

const emptySubscribe = () => () => {};

/* Biblical palette */
const C = {
  purple: "#6B21A8",
  scarlet: "#C0392B",
  gold: "#D4A843",
  blue: "#1E3A5F",
  dark: "#08060E",
  card: "#0C0A14",
} as const;

export default function MettleLanding() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.dark }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: `${C.gold}30`, borderTopColor: C.gold }} />
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: C.dark }}>
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px]"
          style={{ background: `radial-gradient(ellipse, ${C.purple}12 0%, transparent 70%)` }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5">
        {/* Nav — minimal */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-8 h-8" />
            <span className="text-xs font-mono tracking-[0.25em] font-bold" style={{ color: C.gold }}>METTLE</span>
          </div>
          <Link
            href="/apex-athlete/portal"
            className="text-xs font-mono tracking-widest transition-colors"
            style={{ color: `${C.gold}60` }}
          >
            SIGN IN →
          </Link>
        </nav>

        {/* Hero — logo-centered, clean */}
        <section className="pt-20 sm:pt-32 pb-16 sm:pb-24 text-center">
          {/* Logo large */}
          <div className="mb-10">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-6" />
            <img src="/mettle-brand/v5/mettle-wordmark.svg" alt="METTLE" className="h-8 sm:h-10 mx-auto" />
          </div>

          <p className="text-xl sm:text-2xl font-light text-white/70 mb-3 tracking-wide">
            Athlete Relations Manager
          </p>

          <p className="text-white/25 text-sm max-w-lg mx-auto mb-12 leading-relaxed">
            The platform that transforms how coaches develop athletes,
            how athletes chase greatness, and how parents stay connected.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/apex-athlete/portal"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm tracking-wider transition-all duration-300 hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${C.gold}, ${C.gold}CC)`,
                color: C.dark,
              }}
            >
              GET STARTED
            </Link>
            <a
              href="#waitlist"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm tracking-wider transition-all duration-300"
              style={{
                border: `1px solid ${C.gold}30`,
                color: `${C.gold}90`,
              }}
            >
              JOIN WAITLIST
            </a>
          </div>

          {/* Private beta badge */}
          <div className="mt-8 inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ border: `1px solid ${C.purple}25` }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.purple }} />
            <span className="text-[10px] font-mono tracking-widest" style={{ color: `${C.purple}80` }}>PRIVATE BETA</span>
          </div>
        </section>

        {/* Three portals — clean cards with gamified accents */}
        <section className="pb-20 sm:pb-28">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Coach */}
            <div className="rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
              style={{ background: C.card, border: `1px solid ${C.scarlet}15` }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${C.scarlet}, transparent)` }} />
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: `${C.scarlet}15` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.scarlet} strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2L15 8H9L12 2Z" /><circle cx="12" cy="14" r="4" /><path d="M6 22V20C6 17 9 15 12 15S18 17 18 20V22" />
                </svg>
              </div>
              <h3 className="text-white font-bold mb-1">Coach</h3>
              <p className="text-white/25 text-sm leading-relaxed">Run practice, manage meets, track every athlete&apos;s growth.</p>
            </div>

            {/* Athlete */}
            <div className="rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
              style={{ background: C.card, border: `1px solid ${C.purple}15` }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${C.purple}, transparent)` }} />
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: `${C.purple}15` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2" strokeLinecap="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                </svg>
              </div>
              <h3 className="text-white font-bold mb-1">Athlete</h3>
              <p className="text-white/25 text-sm leading-relaxed">Own your progress. Earn your rank. Chase personal bests.</p>
            </div>

            {/* Parent */}
            <div className="rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
              style={{ background: C.card, border: `1px solid ${C.gold}15` }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: `${C.gold}15` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h3 className="text-white font-bold mb-1">Parent</h3>
              <p className="text-white/25 text-sm leading-relaxed">Stay connected. Celebrate milestones. See the journey.</p>
            </div>
          </div>
        </section>

        {/* Single trust line */}
        <section className="pb-12 text-center">
          <p className="text-white/10 text-xs font-mono tracking-widest">DESIGNED FOR SWIM TEAMS · EXPANDING TO ALL SPORTS</p>
        </section>

        {/* Waitlist — minimal */}
        <section id="waitlist" className="pb-20 sm:pb-28">
          <div className="text-center max-w-sm mx-auto">
            <h2 className="text-white text-lg font-bold mb-2">Want early access?</h2>
            <p className="text-white/20 text-xs mb-6">
              We&apos;re onboarding select teams. Drop your email.
            </p>

            {submitted ? (
              <div className="rounded-xl p-4" style={{ background: `${C.purple}08`, border: `1px solid ${C.purple}20` }}>
                <p className="text-sm font-mono" style={{ color: `${C.purple}90` }}>You&apos;re on the list.</p>
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
                  placeholder="coach@yourteam.com"
                  className="flex-1 px-4 py-3 rounded-xl text-white text-sm placeholder:text-white/15 focus:outline-none transition-colors"
                  style={{ background: C.card, border: `1px solid ${C.gold}15` }}
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl font-bold text-xs tracking-wider transition-all hover:brightness-110"
                  style={{ background: C.gold, color: C.dark }}
                >
                  JOIN
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Footer — one line */}
        <footer className="pb-8 text-center">
          <p className="text-white/[0.06] text-[10px] font-mono">
            METTLE · Parallax Ventures · {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
