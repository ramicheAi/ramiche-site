/* ═══════════════════════════════════════════════════════════════════
   SHARED CONFIG — Single source of truth for all dashboards
   When pricing, tiers, or company info changes, update HERE.
   All pages import from this file.
   ═══════════════════════════════════════════════════════════════════ */

// ── APEX ATHLETE PRICING (current: Feb 2026) ───────────────────

export const APEX_PRICING = {
  tiers: [
    {
      id: "starter",
      name: "Starter",
      price: 149,
      priceLabel: "$149/mo",
      athletes: "Up to 50 athletes",
      support: "Email support (48h response)",
      color: "#22d3ee",
      features: "All core features included",
    },
    {
      id: "club",
      name: "Club",
      price: 349,
      priceLabel: "$349/mo",
      athletes: "Up to 150 athletes",
      support: "Priority support (24h response)",
      color: "#00f0ff",
      featured: true,
      features: "All core features + priority support",
    },
    {
      id: "program",
      name: "Program",
      price: 549,
      priceLabel: "$549/mo",
      athletes: "Up to 300 athletes",
      support: "Dedicated success manager",
      color: "#a855f7",
      features: "All core features + dedicated manager",
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: null,
      priceLabel: "Custom",
      athletes: "300+ athletes",
      support: "Full onboarding + custom SLA",
      color: "#fcd34d",
      features: "Contact us for custom pricing",
    },
  ],
  philosophy: "Full features at every tier. Scale by team size & support.",
  arpu: {
    starter: 149,
    club: 349,
    program: 549,
    blended: 310, // weighted average estimate
  },
} as const;

// ── ARR PROJECTIONS (updated for new pricing) ────────────────────

export const APEX_PROJECTIONS = [
  { year: "Y1 (Conservative)", arr: "$1.86M", teams: "500", arpu: "$310", churn: "5%", color: "#60a5fa" },
  { year: "Y1 (Base)", arr: "$3.72M", teams: "1,000", arpu: "$310", churn: "4%", color: "#f59e0b" },
  { year: "Y1 (Aggressive)", arr: "$9.3M", teams: "2,500", arpu: "$310", churn: "3%", color: "#ef4444" },
  { year: "Y3 (Base)", arr: "$14.9M", teams: "4,000", arpu: "$310", churn: "3%", color: "#a855f7" },
] as const;

// ── BRAND HIERARCHY ─────────────────────────────────────────────

export const BRANDS = [
  { name: "Parallax", role: "Parent Company", accent: "#e879f9" },
  { name: "RAMICHE", role: "Operations HQ", accent: "#fcd34d" },
  { name: "Apex Athlete", role: "SaaS Platform", accent: "#f59e0b" },
  { name: "Galactik Antics", role: "AI Art + Merch", accent: "#00f0ff" },
  { name: "Ramiche Studio", role: "Creative Services", accent: "#a855f7" },
  { name: "The Baba Studio", role: "Audio Division", accent: "#e879f9" },
] as const;

// ── KEY METRICS ─────────────────────────────────────────────────

export const KEY_METRICS = {
  activeAgents: 19,
  athletesBeta: "240+",
  betaPartner: "Saint Andrew's Aquatics — 7 groups",
  gaProducts: 23,
  gaProductsBreakdown: "13 cases + 5 posters + 5 tees",
} as const;

// ── NAV LINKS ───────────────────────────────────────────────────

export const NAV_LINKS = [
  { label: "HQ", href: "/", icon: "\u25C8" },
  { label: "COMMAND", href: "/command-center", icon: "\u25C7" },
  { label: "APEX", href: "/apex-athlete", icon: "\u2726" },
  { label: "FINANCE", href: "/financial", icon: "\u25C9" },
  { label: "STUDIO", href: "/studio", icon: "\u2662" },
] as const;
