import Link from "next/link";

/* ─── design tokens (mirrors globals.css / AGENTS.md) ─────────────── */
const CYAN = "#00f0ff";
const PURPLE = "#a855f7";
const AMBER = "#f59e0b";
const BG = "#0a0a0a";

/* ─── data ─────────────────────────────────────────────────────────── */
const STATS = [
  { value: "240+", label: "Athletes on METTLE", color: PURPLE },
  { value: "19", label: "AI Agents in Production", color: CYAN },
  { value: "16K+", label: "Instagram Followers", color: AMBER },
  { value: "50+", label: "Projects Shipped", color: CYAN },
] as const;

const TESTIMONIALS = [
  {
    quote: "Parallax delivered our full brand identity in under two weeks. The AI-powered workflow is unlike anything we've worked with before.",
    name: "Saint Andrew's Aquatics",
    role: "METTLE Beta Partner",
    accent: PURPLE,
  },
  {
    quote: "From logo to live website — they shipped everything faster than agencies charging 5x more. The quality speaks for itself.",
    name: "Early Client",
    role: "Ramiche Studio",
    accent: CYAN,
  },
  {
    quote: "The art drops are incredible. Every piece feels collectible. Galactik Antics is building something special.",
    name: "Community Member",
    role: "Galactik Antics Collector",
    accent: AMBER,
  },
] as const;

const TIERS = [
  {
    name: "Starter",
    price: "$400",
    accent: CYAN,
    features: [
      "Single deliverable",
      "Logo, landing page, or brand asset",
      "One round of revisions",
      "Delivered in 5-7 days",
    ],
    cta: "Get Started",
    href: "https://calendly.com",
  },
  {
    name: "Growth",
    price: "$1,500",
    accent: PURPLE,
    featured: true,
    features: [
      "Full brand package",
      "Identity, website, and launch assets",
      "Two rounds of revisions",
      "Delivered in 2-3 weeks",
    ],
    cta: "Get Started",
    href: "https://calendly.com",
  },
  {
    name: "Scale",
    price: "$3,000",
    accent: AMBER,
    features: [
      "Complete product build",
      "Design, development, and deployment",
      "Priority support channel",
      "Delivered in 4-6 weeks",
    ],
    cta: "Get Started",
    href: "https://calendly.com",
  },
  {
    name: "Enterprise",
    price: "$6,000+",
    accent: CYAN,
    features: [
      "Ongoing partnership",
      "Dedicated AI-powered creative team",
      "Unlimited revisions",
      "Monthly retainer with SLA",
    ],
    cta: "Contact Us",
    href: "mailto:hello@ramiche.com",
  },
];

const VENTURES = [
  {
    name: "Ramiche Studio",
    tagline: "AI-powered creative services from concept to launch.",
    color: CYAN,
    href: "#pricing",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    name: "METTLE",
    tagline: "Gamified athlete platform that turns practice into play.",
    color: PURPLE,
    href: "/apex-athlete/landing",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    name: "Galactik Antics",
    tagline: "AI-generated art, collectibles, and merch drops.",
    color: AMBER,
    href: "https://instagram.com/galactikantics",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    name: "The Baba Studio",
    tagline: "Music production, beats, and sonic experiments.",
    color: "#e879f9",
    href: "/studio",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e879f9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
] as const;

/* ═══════════════════════════════════════════════════════════════════════
   PAGE COMPONENT — server component, no "use client"
   ═══════════════════════════════════════════════════════════════════════ */
export default function Home() {
  return (
    <main
      className="min-h-screen font-[family-name:var(--font-geist-sans)]"
      style={{ backgroundColor: BG, color: "#ededed" }}
    >
      {/* ─── HERO ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% -20%, rgba(0,240,255,0.15) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 80% 50%, rgba(168,85,247,0.1) 0%, transparent 60%),
              radial-gradient(ellipse 60% 60% at 20% 80%, rgba(245,158,11,0.08) 0%, transparent 60%)
            `,
          }}
        />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,240,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,240,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Animated scan line */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute left-0 right-0 h-px scan-line"
            style={{
              background: `linear-gradient(90deg, transparent 0%, rgba(0,240,255,0.3) 20%, rgba(0,240,255,0.6) 50%, rgba(0,240,255,0.3) 80%, transparent 100%)`,
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest uppercase mb-8 font-[family-name:var(--font-geist-mono)]"
            style={{
              border: `1px solid rgba(0,240,255,0.2)`,
              background: `rgba(0,240,255,0.05)`,
              color: CYAN,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: CYAN,
                boxShadow: `0 0 6px ${CYAN}`,
              }}
            />
            AI-Powered Creative Studio
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
          >
            <span className="block">Your Brand, Built</span>
            <span
              className="block animated-gradient-text"
              style={{
                background: `linear-gradient(135deg, ${CYAN}, ${PURPLE}, ${AMBER}, ${CYAN})`,
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              and Shipped in Weeks.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl md:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "rgba(237,237,237,0.65)" }}>
            We design logos, build websites, and launch full brands — powered by 19 AI agents and a team that ships fast. Starting at $400.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Primary CTA */}
            <a
              href="https://calendly.com"
              className="game-btn btn-ripple group relative inline-flex items-center justify-center px-8 py-4 text-base font-semibold tracking-wide transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
                color: "#0a0a0a",
                minWidth: "200px",
              }}
            >
              Book a Free Consultation
              <svg className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>

            {/* Secondary CTA */}
            <a
              href="#pricing"
              className="group inline-flex items-center justify-center px-8 py-4 text-base font-medium tracking-wide rounded-lg transition-all duration-200"
              style={{
                color: "rgba(237,237,237,0.7)",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              See Pricing
              <svg className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: CYAN }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="text-xs tracking-widest uppercase font-[family-name:var(--font-geist-mono)]" style={{ color: CYAN }}>
            Scroll
          </span>
          <div
            className="w-px h-8"
            style={{
              background: `linear-gradient(to bottom, ${CYAN}, transparent)`,
            }}
          />
        </div>
      </section>

      {/* ─── SOCIAL PROOF ───────────────────────────────────────── */}
      <section className="relative py-20 px-6">
        {/* Top divider line */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(0,240,255,0.3) 50%, transparent 100%)`,
          }}
        />

        <div className="max-w-6xl mx-auto">
          <p
            className="text-center text-sm tracking-[0.2em] uppercase mb-12 font-[family-name:var(--font-geist-mono)]"
            style={{ color: "rgba(237,237,237,0.4)" }}
          >
            Built &amp; Trusted
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="relative rounded-xl p-6 md:p-8 text-center transition-all duration-300 hover:translate-y-[-2px]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                {/* Subtle top accent */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-px"
                  style={{ background: stat.color }}
                />
                <div
                  className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 font-[family-name:var(--font-geist-mono)]"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-xs sm:text-sm leading-snug"
                  style={{ color: "rgba(237,237,237,0.5)" }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p
            className="text-center text-sm tracking-[0.2em] uppercase mb-12 font-[family-name:var(--font-geist-mono)]"
            style={{ color: "rgba(237,237,237,0.4)" }}
          >
            What People Are Saying
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="relative rounded-xl p-6 transition-all duration-300 hover:translate-y-[-2px]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                {/* Quote mark */}
                <div
                  className="text-4xl font-bold mb-3 leading-none font-[family-name:var(--font-geist-mono)]"
                  style={{ color: t.accent, opacity: 0.4 }}
                >
                  &ldquo;
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(237,237,237,0.65)" }}>
                  {t.quote}
                </p>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "#ededed" }}>
                    {t.name}
                  </div>
                  <div className="text-xs" style={{ color: t.accent }}>
                    {t.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ────────────────────────────────────────────── */}
      <section id="pricing" className="relative py-24 px-6 scroll-mt-8">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span style={{ color: "#ededed" }}>Ship Faster with </span>
              <span
                className="animated-gradient-text"
                style={{
                  background: `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
                  backgroundSize: "200% 200%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Ramiche Studio
              </span>
            </h2>
            <p className="text-base sm:text-lg max-w-xl mx-auto" style={{ color: "rgba(237,237,237,0.5)" }}>
              AI-powered creative services. Choose your tier, tell us what you need, and we handle the rest.
            </p>
          </div>

          {/* Pricing grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="relative group rounded-xl p-6 flex flex-col transition-all duration-300 hover:translate-y-[-4px]"
                style={{
                  background: tier.featured
                    ? "rgba(168,85,247,0.06)"
                    : "rgba(255,255,255,0.02)",
                  border: tier.featured
                    ? `1px solid rgba(168,85,247,0.25)`
                    : "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                {/* Featured badge */}
                {tier.featured && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
                    style={{
                      background: `linear-gradient(135deg, ${PURPLE}, ${CYAN})`,
                      color: "#0a0a0a",
                    }}
                  >
                    Most Popular
                  </div>
                )}

                {/* Tier name */}
                <div
                  className="text-xs font-bold tracking-[0.15em] uppercase mb-4 font-[family-name:var(--font-geist-mono)]"
                  style={{ color: tier.accent }}
                >
                  {tier.name}
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl md:text-5xl font-bold tracking-tight" style={{ color: "#ededed" }}>
                    {tier.price}
                  </span>
                </div>

                {/* Divider */}
                <div
                  className="h-px w-full mb-6"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${tier.accent}40, transparent)`,
                  }}
                />

                {/* Features */}
                <ul className="flex-1 space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm" style={{ color: "rgba(237,237,237,0.65)" }}>
                      <svg
                        className="w-4 h-4 mt-0.5 shrink-0"
                        fill="none"
                        stroke={tier.accent}
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <a
                  href={tier.href}
                  className="game-btn btn-ripple inline-flex items-center justify-center px-6 py-3 text-sm font-semibold tracking-wide transition-all duration-200 text-center"
                  style={{
                    background:
                      tier.cta === "Contact Us"
                        ? "transparent"
                        : `linear-gradient(135deg, ${tier.accent}dd, ${tier.accent})`,
                    color:
                      tier.cta === "Contact Us"
                        ? tier.accent
                        : "#0a0a0a",
                    border:
                      tier.cta === "Contact Us"
                        ? `1px solid ${tier.accent}40`
                        : "none",
                  }}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── VENTURES ───────────────────────────────────────────── */}
      <section className="relative py-24 px-6">
        {/* Top divider line */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.3) 50%, transparent 100%)`,
          }}
        />

        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
              The Ecosystem
            </h2>
            <p className="text-base sm:text-lg max-w-lg mx-auto" style={{ color: "rgba(237,237,237,0.5)" }}>
              Multiple ventures. One vision. Everything ships under Parallax.
            </p>
          </div>

          {/* Ventures grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VENTURES.map((venture) => (
              <a
                key={venture.name}
                href={venture.href}
                className="game-card group relative rounded-xl p-6 flex items-start gap-5 transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  textDecoration: "none",
                }}
              >
                {/* Icon container */}
                <div
                  className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{
                    background: `${venture.color}10`,
                    border: `1px solid ${venture.color}25`,
                  }}
                >
                  {venture.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold mb-1 flex items-center gap-2" style={{ color: "#ededed" }}>
                    {venture.name}
                    <svg
                      className="w-4 h-4 transition-transform group-hover:translate-x-1 opacity-0 group-hover:opacity-100"
                      fill="none"
                      stroke={venture.color}
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(237,237,237,0.5)" }}>
                    {venture.tagline}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────── */}
      <footer className="relative py-12 px-6">
        {/* Top divider */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)`,
          }}
        />

        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Copyright */}
          <p
            className="text-sm font-[family-name:var(--font-geist-mono)]"
            style={{ color: "rgba(237,237,237,0.35)" }}
          >
            &copy; 2026 Parallax Ventures
          </p>

          {/* Social links */}
          <div className="flex items-center gap-6">
            <a
              href="https://x.com/PARALLAXVINC"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-200 hover:opacity-100"
              style={{ color: "rgba(237,237,237,0.4)" }}
              aria-label="Parallax on X (Twitter)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://instagram.com/PARALLAXVINC"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-200 hover:opacity-100"
              style={{ color: "rgba(237,237,237,0.4)" }}
              aria-label="Parallax on Instagram"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            <Link
              href="/command-center"
              className="transition-colors duration-200 hover:opacity-100 text-xs tracking-widest uppercase font-[family-name:var(--font-geist-mono)]"
              style={{ color: "rgba(237,237,237,0.3)" }}
            >
              HQ
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
