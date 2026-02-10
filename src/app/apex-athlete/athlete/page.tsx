"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AthletePortal() {
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.08)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(0,240,255,0.04)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#a855f7]/5 border border-[#a855f7]/10 mb-6">
            <span className="text-[#a855f7]/60 text-xs font-mono tracking-wider">ATHLETE PORTAL</span>
            <span className="text-white/20 text-xs font-mono">· Coming Soon</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">
            Your <span className="bg-gradient-to-r from-[#a855f7] via-[#00f0ff] to-[#f59e0b] bg-clip-text text-transparent">Personal Dashboard</span>
          </h1>
          <p className="text-white/20 text-sm sm:text-base max-w-md mx-auto">
            Track XP, level up, submit quests, view streaks
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mb-12">
          {[
            {
              icon: "📊",
              title: "XP Dashboard",
              desc: "Track your experience points, level progression, and streak multipliers",
              color: "#a855f7",
            },
            {
              icon: "🎯",
              title: "Attribute Radar",
              desc: "Visualize your growth across attendance, effort, improvement, consistency, leadership",
              color: "#00f0ff",
            },
            {
              icon: "📝",
              title: "Training Journal",
              desc: "Log reflections, track progress, and set personal goals",
              color: "#f59e0b",
            },
            {
              icon: "🏆",
              title: "Quest Submissions",
              desc: "Submit photo/text proof for coach approval and earn XP bonuses",
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
          <p>Apex Athlete — Athlete Portal</p>
          <p>Personal XP tracking · Quest submissions · Training journal</p>
        </div>
      </div>
    </div>
  );
}