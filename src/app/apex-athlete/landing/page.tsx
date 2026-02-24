"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   METTLE — Beta Landing Page
   Compelling but guarded. Show the value, not the playbook.
   ══════════════════════════════════════════════════════════════ */

const emptySubscribe = () => () => {};

const PILLARS = [
  {
    title: "For Coaches",
    subtitle: "Run practice like a pro",
    points: [
      "Real-time check-ins and attendance",
      "Team analytics at a glance",
      "Meet management built in",
    ],
    accent: "#00f0ff",
  },
  {
    title: "For Athletes",
    subtitle: "Own your progress",
    points: [
      "Personal dashboard with streaks",
      "Set goals and track growth",
      "Earn recognition for effort",
    ],
    accent: "#a855f7",
  },
  {
    title: "For Parents",
    subtitle: "Stay connected",
    points: [
      "See your child's development",
      "Milestone celebrations",
      "Peace of mind, built in",
    ],
    accent: "#f59e0b",
  },
] as const;

export default function MettleLanding() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.03)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-9 h-9" />
            <img src="/mettle-brand/v5/mettle-wordmark.svg" alt="METTLE" className="h-5" />
            <span className="text-[#00f0ff]/40 text-[10px] font-mono tracking-widest border border-[#00f0ff]/15 px-2 py-0.5 rounded-full">BETA</span>
          </div>
          <Link
            href="/apex-athlete/portal"
            className="text-white/40 text-sm font-mono tracking-wider hover:text-white/70 transition-colors"
          >
            SIGN IN
          </Link>
        </nav>

        {/* Hero */}
        <section className="pt-16 sm:pt-24 pb-20 sm:pb-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#a855f7]/5 border border-[#a855f7]/10 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />
            <span className="text-[#a855f7]/70 text-xs font-mono tracking-wider">NOW IN PRIVATE BETA</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tight leading-[0.95]">
            Where athletes<br />
            <span className="bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#f59e0b] bg-clip-text text-transparent">find their edge</span>
          </h1>

          <p className="text-white/30 text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            The training platform that connects coaches, athletes, and parents —
            designed to make every practice count.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/apex-athlete/portal"
              className="group relative inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, #00f0ff15, #a855f715)",
                border: "1px solid rgba(0,240,255,0.2)",
                color: "#00f0ff",
              }}
            >
              <span>GET STARTED</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">&#8594;</span>
            </Link>
          </div>
        </section>

        {/* Three Pillars */}
        <section className="pb-20 sm:pb-28">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="rounded-3xl p-6 sm:p-8 bg-[#06020f]/70 backdrop-blur-xl transition-all duration-300 hover:bg-[#0a0418]/90"
                style={{
                  border: `1px solid ${p.accent}15`,
                }}
              >
                <h3 className="text-white text-lg font-bold mb-1">{p.title}</h3>
                <p className="text-sm mb-5" style={{ color: `${p.accent}60` }}>{p.subtitle}</p>
                <ul className="space-y-3">
                  {p.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <svg
                        className="mt-0.5 flex-shrink-0"
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={p.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        style={{ opacity: 0.5 }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-white/30 text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Social proof / trust */}
        <section className="pb-20 sm:pb-28 text-center">
          <div className="rounded-3xl p-8 sm:p-12 bg-[#0a0418]/40 border border-white/[0.04]">
            <p className="text-white/15 text-xs font-mono tracking-widest mb-4">BUILT FOR</p>
            <p className="text-white/50 text-xl sm:text-2xl font-bold mb-2">
              Swim teams. Clubs. Aquatic programs.
            </p>
            <p className="text-white/15 text-sm max-w-md mx-auto">
              Expanding to all sports. Currently in closed beta with select programs.
            </p>
          </div>
        </section>

        {/* Waitlist */}
        <section className="pb-20 sm:pb-28">
          <div className="text-center max-w-md mx-auto">
            <h2 className="text-white text-2xl sm:text-3xl font-bold mb-3">Want early access?</h2>
            <p className="text-white/20 text-sm mb-8">
              We&apos;re onboarding teams one at a time to get it right. Drop your email and we&apos;ll reach out.
            </p>

            {submitted ? (
              <div className="rounded-2xl p-6 bg-[#a855f7]/5 border border-[#a855f7]/15">
                <p className="text-[#a855f7]/70 font-mono text-sm">You&apos;re on the list. We&apos;ll be in touch.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) {
                    // Store locally for now — Firestore integration later
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
                  className="flex-1 px-5 py-3.5 rounded-2xl bg-[#06020f] border border-white/10 text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#00f0ff]/30 transition-colors"
                />
                <button
                  type="submit"
                  className="px-8 py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, #00f0ff20, #a855f720)",
                    border: "1px solid rgba(0,240,255,0.25)",
                    color: "#00f0ff",
                  }}
                >
                  JOIN WAITLIST
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="pb-12 text-center space-y-3">
          <p className="text-white/10 text-xs italic">
            &ldquo;Unlocking the greatness already inside every athlete.&rdquo;
          </p>
          <p className="text-white/[0.06] text-[10px]">
            METTLE &middot; By Parallax Ventures &middot; {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
