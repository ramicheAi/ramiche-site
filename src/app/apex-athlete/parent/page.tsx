"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ParentPortal() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.08)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(0,240,255,0.04)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f59e0b]/5 border border-[#f59e0b]/10 mb-6">
            <span className="text-[#f59e0b]/60 text-xs font-mono tracking-wider">PARENT PORTAL</span>
            <span className="text-white/20 text-xs font-mono">· Read Only</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">
            Watch Your <span className="bg-gradient-to-r from-[#f59e0b] via-[#a855f7] to-[#00f0ff] bg-clip-text text-transparent">Swimmer Grow</span>
          </h1>
          <p className="text-white/20 text-sm sm:text-base max-w-md mx-auto">
            View progress trends, milestones, and achievements — no raw data
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mb-12">
          {[
            {
              icon: "📈",
              title: "Growth Trends",
              desc: "Weekly/monthly progress visualizations for attendance, XP, and streaks",
              color: "#f59e0b",
            },
            {
              icon: "🎯",
              title: "Milestone Tracking",
              desc: "Celebrate level-ups, streaks, and achievement badges",
              color: "#a855f7",
            },
            {
              icon: "👨‍👩‍👧",
              title: "Team Culture",
              desc: "See how the team is building character and leadership skills",
              color: "#00f0ff",
            },
            {
              icon: "🏆",
              title: "Achievement Display",
              desc: "Showcase badges, awards, and recognition earned",
              color: "#34d399",
            },
          ].map((feat, idx) => (
            <div
              key={idx}
              className="relative rounded-2xl p-6 border backdrop-blur-xl bg-[#06020f]/70 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
              style={{
                borderColor: `${feat.color}25`,
                boxShadow: `0 0 30px ${feat.color}10`,
              }}
            >
              <div className="text-3xl mb-4">{feat.icon}</div>
              <h3 className="text-white text-lg font-bold mb-2">{feat.title}</h3>
              <p className="text-white/25 text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* COPPA Notice */}
        <div className="max-w-xl mx-auto mb-8 p-5 rounded-xl bg-[#06020f]/80 border border-[#00f0ff]/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl">🔒</div>
            <div>
              <h4 className="text-white font-bold text-sm mb-1">COPPA Compliant</h4>
              <p className="text-white/15 text-xs">
                Parent Portal shows only growth trends and achievements — no daily checkpoints,
                no raw data, no personal details. Coach manages all athlete accounts.
              </p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <Link
            href="/apex-athlete/portal"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#06020f]/70 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all duration-300"
          >
            <span>← Back to Portal Selector</span>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 sm:mt-16 text-white/[0.06] text-[10px] space-y-1">
          <p>Apex Athlete — Parent Portal</p>
          <p>Growth trends only · COPPA safe · Coach-managed data</p>
        </div>
      </div>
    </div>
  );
}