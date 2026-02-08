import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   RAMICHE STUDIO — Creative Direction Service
   Dark sci-fi game UI · Tailwind inline classes
   v2: + social proof, why section, 3D studio, form CTA
   ══════════════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: "GA Dock", href: "/", active: false },
  { label: "Command Center", href: "/command-center", active: false },
  { label: "Apex Athlete", href: "/apex-athlete", active: false },
  { label: "Studio", href: "/studio", active: true },
];

const SPRINT_DELIVERABLES = [
  { icon: "\u25C8", text: "2 custom creative directions (A/B)" },
  { icon: "\u25C8", text: "3 campaign-ready assets" },
  { icon: "\u25C8", text: "Written creative brief" },
  { icon: "\u25C8", text: "Style guide foundation" },
  { icon: "\u25C8", text: "Video walkthrough of each concept" },
  { icon: "\u25C8", text: "Full $400 credit toward any package" },
];

const SPRINT_STEPS = [
  { step: "01", label: "Inquiry", desc: "Fill out the form. We respond within 12 hours if it's a fit." },
  { step: "02", label: "Brief", desc: "15-minute qualification call. You share the vision, we diagnose." },
  { step: "03", label: "2 Directions", desc: "We deliver two distinct creative directions in 48 hours." },
  { step: "04", label: "Decision", desc: "Pick one and go. Or walk away with a clear brief to take anywhere." },
];

const PACKAGES = [
  {
    tier: "STARTER",
    price: "$1,500",
    accent: "cyan",
    timeline: "1-2 weeks",
    description: "New brands and single campaigns that need a solid visual foundation fast.",
    features: [
      "Visual direction session (60min)",
      "Core identity system (logo, colors, type)",
      "5 campaign assets (social, ads, email)",
      "Source files included",
      "2 revision rounds",
    ],
  },
  {
    tier: "PRO",
    price: "$3,000",
    accent: "purple",
    timeline: "2-3 weeks",
    description: "Product launches and repositions. Motion + web + social — the complete kit.",
    popular: true,
    features: [
      "Everything in Starter",
      "Motion graphics package (3-5 pieces)",
      "Website visual system (landing mockup)",
      "Social media kit (templates + 10 posts)",
      "Priority turnaround",
      "3 revision rounds",
    ],
  },
  {
    tier: "ELITE",
    price: "$6,000+",
    accent: "gold",
    timeline: "4-6 weeks",
    description: "Full rebrand or ongoing partnership. White-glove creative direction.",
    features: [
      "Everything in Pro",
      "3D animation & video (60-90sec hero piece)",
      "Ongoing creative direction (30 days)",
      "Unlimited support during engagement",
      "Custom scope (CRO, packaging, merch)",
    ],
  },
];

const WHY_REASONS = [
  {
    icon: "\u25C6",
    title: "Ship in days, not months",
    desc: "48-hour sprints and 1-2 week packages. You get results before your competitors finish their brief.",
  },
  {
    icon: "\u25C6",
    title: "AI-augmented, human-directed",
    desc: "We use AI to move at machine speed — but every creative decision is made by a real director with real taste.",
  },
  {
    icon: "\u25C6",
    title: "No risk entry",
    desc: "$400 sprint fee credits toward any package. If you don't see the vision, you walk away with a clear brief.",
  },
  {
    icon: "\u25C6",
    title: "Built for small brands",
    desc: "We make $500K-$2M brands look like they belong next to Nike — without Nike budgets.",
  },
];

const RESULTS = [
  { metric: "48h", label: "Average sprint delivery" },
  { metric: "2x", label: "Engagement lift (avg)" },
  { metric: "100%", label: "Sprint credit applied" },
  { metric: "<24h", label: "Response time" },
];

const accentMap: Record<string, { border: string; glow: string; text: string; bg: string; pulse: string }> = {
  cyan: {
    border: "border-[#00f0ff]/30",
    glow: "shadow-[0_0_30px_rgba(0,240,255,0.15)]",
    text: "text-[#00f0ff]",
    bg: "bg-[#00f0ff]/10",
    pulse: "neon-pulse",
  },
  purple: {
    border: "border-[#a855f7]/30",
    glow: "shadow-[0_0_30px_rgba(168,85,247,0.15)]",
    text: "text-[#a855f7]",
    bg: "bg-[#a855f7]/10",
    pulse: "neon-pulse-purple",
  },
  gold: {
    border: "border-[#f59e0b]/30",
    glow: "shadow-[0_0_30px_rgba(245,158,11,0.15)]",
    text: "text-[#f59e0b]",
    bg: "bg-[#f59e0b]/10",
    pulse: "neon-pulse-gold",
  },
};

export default function StudioPage() {
  return (
    <main className="relative min-h-screen bg-[#06020f] text-white overflow-hidden">
      {/* ── animated background orbs ─────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="nebula-1 absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(0,240,255,0.12) 0%, transparent 70%)" }}
        />
        <div
          className="nebula-2 absolute top-[30%] right-[-10%] w-[700px] h-[700px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)" }}
        />
        <div
          className="nebula-3 absolute bottom-[-5%] left-[20%] w-[500px] h-[500px] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)" }}
        />
        <div
          className="nebula-drift absolute top-[60%] left-[50%] w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(232,121,249,0.1) 0%, transparent 70%)" }}
        />
        <div className="data-grid-bg absolute inset-0 opacity-30" />
      </div>

      {/* ── scan line effect ─────────────────────────────────── */}
      <div className="scan-line pointer-events-none fixed inset-0 z-[1] w-full h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff]/20 to-transparent" />

      {/* ══════════ CONTENT ══════════ */}
      <div className="relative z-10">

        {/* ── navigation HUD tabs ────────────────────────────── */}
        <nav className="w-full border-b border-white/[0.06] bg-[#06020f]/80 backdrop-blur-md">
          <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3">
            <span className="text-xs sm:text-sm tracking-[0.25em] uppercase text-white/30 font-mono">
              Ramiche // Studio
            </span>
            <div className="flex gap-1 sm:gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    game-btn px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-mono uppercase tracking-wider transition-all
                    ${link.active
                      ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]"
                      : "bg-white/[0.03] text-white/50 border border-white/[0.06] hover:text-white/80 hover:bg-white/[0.06]"
                    }
                  `}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* ── hero section ───────────────────────────────────── */}
        <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 sm:px-6 text-center">
          <div className="absolute top-8 left-4 sm:left-12 w-8 h-8 border-t-2 border-l-2 border-[#00f0ff]/30 pointer-events-none" />
          <div className="absolute top-8 right-4 sm:right-12 w-8 h-8 border-t-2 border-r-2 border-[#00f0ff]/30 pointer-events-none" />

          <div className="mx-auto max-w-4xl">
            <div className="mb-4 inline-block">
              <span className="text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#00f0ff]/60 font-mono border border-[#00f0ff]/20 px-4 py-1.5 game-btn">
                Creative Direction for Small Brands
              </span>
            </div>

            <h1
              className="animated-gradient-text text-5xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #00f0ff 0%, #a855f7 40%, #e879f9 70%, #00f0ff 100%)",
                backgroundSize: "200% 200%",
              }}
            >
              RAMICHE
              <br />
              STUDIO
            </h1>

            <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed font-light">
              Your product is premium. Your visuals should match.
              <br className="hidden sm:block" />
              We build brand systems that make small brands look like they&apos;ve been running for years.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#inquiry"
                className="game-btn inline-block bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] px-8 py-4 text-sm font-mono tracking-[0.2em] uppercase hover:brightness-125 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)] transition-all"
              >
                Start with a Sprint
              </a>
              <a
                href="#packages"
                className="game-btn inline-block bg-white/[0.03] border border-white/[0.08] text-white/50 px-8 py-4 text-sm font-mono tracking-[0.2em] uppercase hover:text-white/80 hover:bg-white/[0.06] transition-all"
              >
                View Packages
              </a>
            </div>

            {/* decorative XP bar */}
            <div className="mt-10 mx-auto max-w-md">
              <div className="h-[2px] w-full bg-white/[0.06] rounded-full overflow-hidden">
                <div className="xp-shimmer h-full w-3/5 rounded-full" />
              </div>
            </div>
          </div>
        </section>

        {/* ── results strip ────────────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {RESULTS.map((r) => (
                <div key={r.label} className="text-center py-6 px-4 bg-white/[0.02] border border-white/[0.06] game-panel">
                  <div className="text-2xl sm:text-3xl font-black neon-text-cyan mb-1">{r.metric}</div>
                  <div className="text-white/40 text-xs font-mono tracking-wider uppercase">{r.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── why ramiche section ──────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.3em] uppercase text-white/30 font-mono block mb-3">
                The Difference
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white/90">
                Why Ramiche
              </h2>
              <div className="mt-4 mx-auto w-16 h-[2px] bg-gradient-to-r from-[#a855f7]/0 via-[#a855f7]/60 to-[#a855f7]/0" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {WHY_REASONS.map((reason) => (
                <div
                  key={reason.title}
                  className="game-panel bg-white/[0.02] border border-white/[0.06] p-6 sm:p-8 transition-all duration-300 hover:border-[#a855f7]/20 hover:translate-y-[-2px] group"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-[#a855f7] text-sm mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      {reason.icon}
                    </span>
                    <div>
                      <h3 className="text-white/90 text-base sm:text-lg font-bold mb-2">{reason.title}</h3>
                      <p className="text-white/40 text-sm leading-relaxed">{reason.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── $400 sprint section ────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="game-panel game-panel-border bg-white/[0.02] border border-[#00f0ff]/20 p-6 sm:p-10 relative overflow-hidden">
              <div className="scan-sweep absolute inset-0 pointer-events-none" />

              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                  <div>
                    <span className="text-xs tracking-[0.3em] uppercase text-[#f59e0b]/70 font-mono block mb-2">
                      Start Here — Zero Risk
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">
                      <span className="neon-text-gold">$400</span>
                      <span className="text-white/90 ml-3">Creative Direction Sprint</span>
                    </h2>
                  </div>
                  <div className="game-btn bg-[#f59e0b]/10 border border-[#f59e0b]/30 px-4 py-2 text-[#f59e0b] text-xs font-mono tracking-wider uppercase text-center whitespace-nowrap">
                    48-Hour Delivery
                  </div>
                </div>

                <p className="text-white/50 text-sm sm:text-base max-w-2xl mb-3 leading-relaxed">
                  I&apos;ll show you exactly what premium looks like for your brand in 48 hours.
                  Two directions. You pick one. If you love it, we build it. If not, you have a clear brief to take anywhere.
                </p>
                <p className="text-[#f59e0b]/60 text-xs font-mono mb-10">
                  Full $400 credits toward any package if you move forward within 14 days.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                  <div>
                    <h3 className="text-xs tracking-[0.3em] uppercase text-[#00f0ff]/70 font-mono mb-5 flex items-center gap-2">
                      <span className="w-6 h-[1px] bg-[#00f0ff]/40" />
                      What You Get
                    </h3>
                    <div className="space-y-3">
                      {SPRINT_DELIVERABLES.map((item) => (
                        <div key={item.text} className="flex items-start gap-3 group">
                          <span className="text-[#00f0ff]/60 text-xs mt-1 group-hover:text-[#00f0ff] transition-colors">
                            {item.icon}
                          </span>
                          <span className="text-white/70 text-sm group-hover:text-white/90 transition-colors">
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs tracking-[0.3em] uppercase text-[#a855f7]/70 font-mono mb-5 flex items-center gap-2">
                      <span className="w-6 h-[1px] bg-[#a855f7]/40" />
                      How It Works
                    </h3>
                    <div className="space-y-5">
                      {SPRINT_STEPS.map((s, i) => (
                        <div key={s.step} className="flex items-start gap-4 group">
                          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] text-xs font-mono font-bold game-panel-sm">
                            {s.step}
                          </div>
                          <div>
                            <div className="text-white/90 text-sm font-semibold mb-0.5">{s.label}</div>
                            <div className="text-white/40 text-xs leading-relaxed">{s.desc}</div>
                          </div>
                          {i < SPRINT_STEPS.length - 1 && (
                            <div className="hidden lg:block absolute ml-5 mt-12 w-[1px] h-3 bg-[#a855f7]/20" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* sprint CTA */}
                <div className="mt-10 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-white/30 text-xs font-mono">
                    Only 4 sprints per month. Limited availability.
                  </div>
                  <a
                    href="#inquiry"
                    className="game-btn bg-gradient-to-r from-[#f59e0b]/20 to-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] px-8 py-3 text-xs font-mono tracking-[0.2em] uppercase hover:brightness-125 transition-all"
                  >
                    Book Your Sprint
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── packages section ───────────────────────────────── */}
        <section id="packages" className="px-4 sm:px-6 pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.3em] uppercase text-white/30 font-mono block mb-3">
                Select Your Tier
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white/90">
                Packages
              </h2>
              <div className="mt-4 mx-auto w-16 h-[2px] bg-gradient-to-r from-[#00f0ff]/0 via-[#00f0ff]/60 to-[#00f0ff]/0" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PACKAGES.map((pkg) => {
                const a = accentMap[pkg.accent];
                return (
                  <div
                    key={pkg.tier}
                    className={`
                      game-panel game-panel-border relative
                      bg-white/[0.02] border ${a.border}
                      ${pkg.popular ? `${a.glow} ${a.pulse}` : ""}
                      p-6 sm:p-8 flex flex-col
                      transition-all duration-300 hover:translate-y-[-4px]
                      hover:shadow-[0_8px_40px_rgba(0,240,255,0.1)]
                    `}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-px left-6 right-6">
                        <div className="bg-gradient-to-r from-[#a855f7] to-[#e879f9] text-white text-[10px] font-mono tracking-[0.2em] uppercase text-center py-1 px-3">
                          Most Popular
                        </div>
                      </div>
                    )}

                    <span className={`text-[10px] tracking-[0.4em] uppercase font-mono ${a.text} opacity-70 ${pkg.popular ? "mt-4" : ""}`}>
                      {pkg.tier}
                    </span>

                    <div className="mt-3 mb-2">
                      <span className={`text-4xl sm:text-5xl font-black ${a.text}`}>
                        {pkg.price}
                      </span>
                    </div>

                    <div className="text-white/25 text-xs font-mono mb-4">
                      {pkg.timeline}
                    </div>

                    <p className="text-white/40 text-sm leading-relaxed mb-6">
                      {pkg.description}
                    </p>

                    <div className={`w-full h-[1px] ${a.bg} mb-6`} />

                    <ul className="space-y-3 flex-1">
                      {pkg.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <span className={`${a.text} text-xs mt-0.5 opacity-60`}>{"\u25B8"}</span>
                          <span className="text-white/60 text-sm">{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <a
                      href="#inquiry"
                      className={`
                        game-btn mt-8 block text-center py-3 px-6
                        ${a.bg} border ${a.border}
                        ${a.text} text-xs font-mono tracking-[0.2em] uppercase
                        hover:brightness-125 transition-all
                      `}
                    >
                      Get Started
                    </a>
                  </div>
                );
              })}
            </div>

            {/* 3D Print Studio callout */}
            <div className="mt-8 game-panel bg-white/[0.02] border border-[#14b8a6]/20 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <span className="text-[10px] tracking-[0.4em] uppercase font-mono text-[#14b8a6] opacity-70">
                  3D Print Studio
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white/90 mt-2">
                  Physical products, trophies, collectibles
                </h3>
                <p className="text-white/40 text-sm mt-2 max-w-lg">
                  Action figure design, 3D modeling, prototype to production (Bambu A1), custom trophies, limited edition drops. Project-based pricing from $800.
                </p>
              </div>
              <a
                href="#inquiry"
                className="game-btn flex-shrink-0 bg-[#14b8a6]/10 border border-[#14b8a6]/30 text-[#14b8a6] px-6 py-3 text-xs font-mono tracking-[0.2em] uppercase hover:brightness-125 transition-all"
              >
                Inquire
              </a>
            </div>
          </div>
        </section>

        {/* ── inquiry / CTA section ────────────────────────────── */}
        <section id="inquiry" className="px-4 sm:px-6 pb-20">
          <div className="mx-auto max-w-4xl">
            <div className="game-panel game-panel-border relative bg-white/[0.02] border border-[#00f0ff]/15 p-8 sm:p-14 text-center overflow-hidden">
              <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{ background: "radial-gradient(ellipse at center, rgba(0,240,255,0.08) 0%, transparent 70%)" }}
              />

              <div className="relative z-10">
                <span className="text-xs tracking-[0.3em] uppercase text-[#00f0ff]/50 font-mono block mb-4">
                  Serious Inquiries Only
                </span>

                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">
                  <span className="text-white/90">Let&apos;s Build Your </span>
                  <span
                    className="animated-gradient-text bg-clip-text text-transparent"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #00f0ff, #a855f7, #e879f9)",
                      backgroundSize: "200% 200%",
                    }}
                  >
                    Brand
                  </span>
                </h2>

                <p className="text-white/40 text-sm sm:text-base max-w-lg mx-auto mb-4 leading-relaxed">
                  Tell us what you&apos;re building and where you want to go.
                  We review every submission and respond within 12 hours if it&apos;s a fit.
                </p>

                <p className="text-white/25 text-xs font-mono mb-8">
                  If approved, you&apos;ll book a 15-minute qualification call. If that goes well, we move to the Sprint.
                </p>

                <a
                  href="mailto:studio@ramiche.com?subject=Studio%20Inquiry"
                  className="game-btn inline-block bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] px-8 py-4 text-sm font-mono tracking-[0.2em] uppercase hover:brightness-125 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)] transition-all"
                >
                  studio@ramiche.com
                </a>

                <div className="mt-6 text-white/20 text-xs font-mono">
                  Response time: &lt; 12 hours
                </div>

                {/* qualification criteria hint */}
                <div className="mt-10 pt-6 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                  <div>
                    <div className="text-white/50 text-xs font-semibold mb-1">Best fit</div>
                    <div className="text-white/25 text-xs">Brands doing $500K-$2M+ with a product customers love</div>
                  </div>
                  <div>
                    <div className="text-white/50 text-xs font-semibold mb-1">Budget range</div>
                    <div className="text-white/25 text-xs">$1,000+/mo marketing spend. Sprint starts at $400.</div>
                  </div>
                  <div>
                    <div className="text-white/50 text-xs font-semibold mb-1">Timeline</div>
                    <div className="text-white/25 text-xs">Ready to move within 1-2 months. Not &quot;exploring for someday.&quot;</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── footer ─────────────────────────────────────────── */}
        <footer className="border-t border-white/[0.06] py-8 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-white/20 text-xs font-mono tracking-wider">
              &copy; 2026 Ramiche Studio
            </span>
            <div className="flex items-center gap-4">
              <a href="https://instagram.com/ramiche" className="text-white/20 text-xs font-mono hover:text-white/40 transition-colors">
                Instagram
              </a>
              <span className="text-white/10 text-[6px]">{"\u25C6"}</span>
              <a href="mailto:studio@ramiche.com" className="text-white/20 text-xs font-mono hover:text-white/40 transition-colors">
                studio@ramiche.com
              </a>
            </div>
          </div>
        </footer>

      </div>
    </main>
  );
}
