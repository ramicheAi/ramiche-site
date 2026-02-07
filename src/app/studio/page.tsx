import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   RAMICHE STUDIO — Creative Direction Service
   Dark sci-fi game UI · Tailwind inline classes
   ══════════════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: "GA Dock", href: "/", active: false },
  { label: "Command Center", href: "/command-center", active: false },
  { label: "Apex Athlete", href: "/apex-athlete", active: false },
  { label: "Studio", href: "/studio", active: true },
];

const SPRINT_DELIVERABLES = [
  { icon: "\u25C8", text: "Logo direction (2 concepts)" },
  { icon: "\u25C8", text: "Color system + palette lockfile" },
  { icon: "\u25C8", text: "Typography selection + hierarchy" },
  { icon: "\u25C8", text: "5 social media templates" },
  { icon: "\u25C8", text: "30-day content calendar" },
  { icon: "\u25C8", text: "Brand voice guide" },
];

const SPRINT_STEPS = [
  { step: "01", label: "Brief", desc: "You tell us your vision, audience, and goals." },
  { step: "02", label: "2 Directions", desc: "We deliver two distinct creative directions in 24h." },
  { step: "03", label: "Pick & Refine", desc: "You choose one. We refine every detail." },
  { step: "04", label: "Delivered", desc: "Full brand kit delivered within 48 hours." },
];

const PACKAGES = [
  {
    tier: "STARTER",
    price: "$1,500",
    accent: "cyan",
    description: "Basic brand identity for founders launching fast.",
    features: [
      "Logo design (1 concept + refinement)",
      "Core color palette (3-5 colors)",
      "Primary + secondary typeface selection",
      "Basic brand guidelines PDF",
      "Social media profile assets",
      "1 round of revisions",
    ],
  },
  {
    tier: "PRO",
    price: "$3,000",
    accent: "purple",
    description: "Full brand system + templates for scaling teams.",
    popular: true,
    features: [
      "Logo suite (primary, icon, wordmark)",
      "Extended color system + usage rules",
      "Typography hierarchy + web fonts",
      "10 social media templates",
      "Pitch deck template",
      "Brand voice + messaging framework",
      "60-day content calendar",
      "3 rounds of revisions",
    ],
  },
  {
    tier: "ELITE",
    price: "$6,000+",
    accent: "gold",
    description: "Complete creative direction + ongoing strategy.",
    features: [
      "Everything in Pro",
      "Full brand strategy document",
      "Competitive landscape analysis",
      "Website design direction (wireframes)",
      "Motion graphics / animation guidelines",
      "Product packaging direction",
      "90-day content + launch strategy",
      "Dedicated creative director",
      "Unlimited revisions for 30 days",
    ],
  },
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
        {/* subtle grid overlay */}
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
              Ramiche // Systems
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
          {/* decorative corner brackets */}
          <div className="absolute top-8 left-4 sm:left-12 w-8 h-8 border-t-2 border-l-2 border-[#00f0ff]/30 pointer-events-none" />
          <div className="absolute top-8 right-4 sm:right-12 w-8 h-8 border-t-2 border-r-2 border-[#00f0ff]/30 pointer-events-none" />

          <div className="mx-auto max-w-4xl">
            <div className="mb-4 inline-block">
              <span className="text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#00f0ff]/60 font-mono border border-[#00f0ff]/20 px-4 py-1.5 game-btn">
                Creative Direction Service
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

            <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-white/60 max-w-xl mx-auto leading-relaxed font-light">
              Creative direction for the bold. Built to ship.
            </p>

            {/* decorative XP bar */}
            <div className="mt-10 mx-auto max-w-md">
              <div className="h-[2px] w-full bg-white/[0.06] rounded-full overflow-hidden">
                <div className="xp-shimmer h-full w-3/5 rounded-full" />
              </div>
            </div>
          </div>
        </section>

        {/* ── $400 sprint section ────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="game-panel game-panel-border bg-white/[0.02] border border-[#00f0ff]/20 p-6 sm:p-10 relative overflow-hidden">
              {/* scan sweep */}
              <div className="scan-sweep absolute inset-0 pointer-events-none" />

              <div className="relative z-10">
                {/* header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                  <div>
                    <span className="text-xs tracking-[0.3em] uppercase text-[#f59e0b]/70 font-mono block mb-2">
                      Flagship Offering
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

                <p className="text-white/50 text-sm sm:text-base max-w-2xl mb-10 leading-relaxed">
                  A complete brand identity system delivered in 48 hours. Two directions. One winner.
                  Everything you need to look like you have been running for years -- shipped before the weekend.
                </p>

                {/* two-column: deliverables + process */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                  {/* what you get */}
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

                  {/* how it works */}
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
              </div>
            </div>
          </div>
        </section>

        {/* ── packages section ───────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-20">
          <div className="mx-auto max-w-6xl">
            {/* section header */}
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.3em] uppercase text-white/30 font-mono block mb-3">
                Select Your Tier
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white/90">
                Packages
              </h2>
              <div className="mt-4 mx-auto w-16 h-[2px] bg-gradient-to-r from-[#00f0ff]/0 via-[#00f0ff]/60 to-[#00f0ff]/0" />
            </div>

            {/* package cards */}
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
                    {/* popular badge */}
                    {pkg.popular && (
                      <div className="absolute -top-px left-6 right-6">
                        <div className="bg-gradient-to-r from-[#a855f7] to-[#e879f9] text-white text-[10px] font-mono tracking-[0.2em] uppercase text-center py-1 px-3">
                          Most Popular
                        </div>
                      </div>
                    )}

                    {/* tier label */}
                    <span className={`text-[10px] tracking-[0.4em] uppercase font-mono ${a.text} opacity-70 ${pkg.popular ? "mt-4" : ""}`}>
                      {pkg.tier}
                    </span>

                    {/* price */}
                    <div className="mt-3 mb-4">
                      <span className={`text-4xl sm:text-5xl font-black ${a.text}`}>
                        {pkg.price}
                      </span>
                    </div>

                    {/* description */}
                    <p className="text-white/40 text-sm leading-relaxed mb-6">
                      {pkg.description}
                    </p>

                    {/* divider */}
                    <div className={`w-full h-[1px] ${a.bg} mb-6`} />

                    {/* features */}
                    <ul className="space-y-3 flex-1">
                      {pkg.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <span className={`${a.text} text-xs mt-0.5 opacity-60`}>{"\u25B8"}</span>
                          <span className="text-white/60 text-sm">{feat}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA button */}
                    <a
                      href={`mailto:studio@ramiche.com?subject=${encodeURIComponent(pkg.tier + " Package Inquiry")}`}
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
          </div>
        </section>

        {/* ── CTA section ────────────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-20">
          <div className="mx-auto max-w-4xl">
            <div className="game-panel game-panel-border relative bg-white/[0.02] border border-[#00f0ff]/15 p-8 sm:p-14 text-center overflow-hidden">
              {/* background glow */}
              <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{ background: "radial-gradient(ellipse at center, rgba(0,240,255,0.08) 0%, transparent 70%)" }}
              />

              <div className="relative z-10">
                <span className="text-xs tracking-[0.3em] uppercase text-[#00f0ff]/50 font-mono block mb-4">
                  Ready to Launch?
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

                <p className="text-white/40 text-sm sm:text-base max-w-lg mx-auto mb-8 leading-relaxed">
                  Drop us a line. Tell us what you are building and where you want to go.
                  We will get back to you within 24 hours.
                </p>

                <a
                  href="mailto:studio@ramiche.com?subject=Studio%20Inquiry"
                  className="game-btn inline-block bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] px-8 py-4 text-sm font-mono tracking-[0.2em] uppercase hover:brightness-125 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)] transition-all"
                >
                  studio@ramiche.com
                </a>

                <div className="mt-6 text-white/20 text-xs font-mono">
                  Response time: &lt; 24 hours
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
              <span className="text-white/10 text-xs font-mono">No auto-publish</span>
              <span className="text-white/10 text-[6px]">{"\u25C6"}</span>
              <span className="text-white/10 text-xs font-mono">Signal-first</span>
              <span className="text-white/10 text-[6px]">{"\u25C6"}</span>
              <span className="text-white/10 text-xs font-mono">Built different</span>
            </div>
          </div>
        </footer>

      </div>
    </main>
  );
}
