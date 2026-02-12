"use client";

import { useState, useEffect, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — BILLING & PRICING
   Stripe-powered subscription management
   Dark sci-fi game UI · Fortnite/Fallout aesthetic
   ══════════════════════════════════════════════════════════════ */

// ── SVG Icon Components ─────────────────────────────────────

function ShieldIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BoltIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function CrownIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20" />
      <path d="M4 20V9l4 3 4-7 4 7 4-3v11" />
    </svg>
  );
}

function DiamondIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z" />
    </svg>
  );
}

function UsersIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChartIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function RocketIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function ApiIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function CheckIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LockIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArrowLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ── Tier Definitions ────────────────────────────────────────

interface PlanTier {
  id: string;
  name: string;
  subtitle: string;
  price: number | null;
  priceLabel: string;
  priceId: string | null;
  color: string;
  glowColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
  featured: boolean;
  features: { text: string; included: boolean }[];
  limits: string;
  cta: string;
}

const TIERS: PlanTier[] = [
  {
    id: "free",
    name: "FREE",
    subtitle: "Starter Loadout",
    price: null,
    priceLabel: "$0",
    priceId: null,
    color: "#94a3b8",
    glowColor: "rgba(148,163,184,0.3)",
    borderColor: "rgba(148,163,184,0.2)",
    icon: ShieldIcon,
    featured: false,
    features: [
      { text: "1 team roster", included: true },
      { text: "Up to 15 athletes", included: true },
      { text: "XP & streak tracking", included: true },
      { text: "Basic checkpoints", included: true },
      { text: "Coach dashboard", included: true },
      { text: "Multi-team support", included: false },
      { text: "Analytics & reports", included: false },
      { text: "Recruiting features", included: false },
      { text: "API access", included: false },
    ],
    limits: "1 team / 15 athletes",
    cta: "Get Started",
  },
  {
    id: "pro",
    name: "PRO",
    subtitle: "Battle Pass",
    price: 29,
    priceLabel: "$29",
    priceId: "price_pro",
    color: "#00f0ff",
    glowColor: "rgba(0,240,255,0.3)",
    borderColor: "rgba(0,240,255,0.3)",
    icon: BoltIcon,
    featured: true,
    features: [
      { text: "1 team roster", included: true },
      { text: "Unlimited athletes", included: true },
      { text: "XP & streak tracking", included: true },
      { text: "All checkpoints & quests", included: true },
      { text: "Coach + parent portals", included: true },
      { text: "Firebase cloud sync", included: true },
      { text: "Schedule management", included: true },
      { text: "Multi-team support", included: false },
      { text: "API access", included: false },
    ],
    limits: "1 team / unlimited athletes",
    cta: "Subscribe",
  },
  {
    id: "club",
    name: "CLUB",
    subtitle: "Commander Tier",
    price: 99,
    priceLabel: "$99",
    priceId: "price_club",
    color: "#a855f7",
    glowColor: "rgba(168,85,247,0.3)",
    borderColor: "rgba(168,85,247,0.3)",
    icon: CrownIcon,
    featured: false,
    features: [
      { text: "Unlimited teams", included: true },
      { text: "Unlimited athletes", included: true },
      { text: "All Pro features", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Performance reports", included: true },
      { text: "Recruiting board", included: true },
      { text: "Multi-sport support", included: true },
      { text: "Priority email support", included: true },
      { text: "API access", included: false },
    ],
    limits: "Unlimited teams & athletes",
    cta: "Subscribe",
  },
  {
    id: "enterprise",
    name: "ENTERPRISE",
    subtitle: "Legendary Edition",
    price: 249,
    priceLabel: "$249",
    priceId: "price_enterprise",
    color: "#f59e0b",
    glowColor: "rgba(245,158,11,0.3)",
    borderColor: "rgba(245,158,11,0.3)",
    icon: DiamondIcon,
    featured: false,
    features: [
      { text: "Everything in Club", included: true },
      { text: "White-label branding", included: true },
      { text: "Full REST API access", included: true },
      { text: "Custom integrations", included: true },
      { text: "Dedicated onboarding", included: true },
      { text: "Priority support (24h)", included: true },
      { text: "Bulk data import/export", included: true },
      { text: "SSO & advanced security", included: true },
      { text: "Custom feature requests", included: true },
    ],
    limits: "Unlimited everything",
    cta: "Subscribe",
  },
];

// ── Feature category icons ──────────────────────────────────

function FeatureCategoryIcon({ tier }: { tier: PlanTier }) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    free: ShieldIcon,
    pro: BoltIcon,
    club: CrownIcon,
    enterprise: DiamondIcon,
  };
  const Icon = iconMap[tier.id] || ShieldIcon;
  return <Icon className="w-8 h-8" />;
}

// ── Tier Card Component ─────────────────────────────────────

function TierCard({
  tier,
  currentPlan,
  loading,
  onSelect,
}: {
  tier: PlanTier;
  currentPlan: string | null;
  loading: string | null;
  onSelect: (tier: PlanTier) => void;
}) {
  const isCurrentPlan = currentPlan === tier.id;
  const isLoading = loading === tier.id;
  const TierIcon = tier.icon;

  return (
    <div
      className={`relative group flex flex-col h-full ${
        tier.featured ? "lg:-mt-4 lg:mb-4" : ""
      }`}
    >
      {/* Featured badge */}
      {tier.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <div
            className="px-4 py-1 text-[10px] font-bold font-mono tracking-[0.3em] uppercase"
            style={{
              background: `linear-gradient(135deg, ${tier.color}22, ${tier.color}44)`,
              border: `1px solid ${tier.color}66`,
              color: tier.color,
              clipPath:
                "polygon(8px 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0% 50%)",
            }}
          >
            Most Popular
          </div>
        </div>
      )}

      {/* Card */}
      <div
        className={`game-panel game-panel-border relative flex flex-col h-full bg-[#06020f]/90 backdrop-blur-xl transition-all duration-500 overflow-hidden ${
          tier.featured
            ? "shadow-[0_0_60px_rgba(0,240,255,0.15)]"
            : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
        } ${
          isCurrentPlan
            ? "ring-2 ring-offset-2 ring-offset-[#06020f]"
            : ""
        }`}
        style={{
          borderColor: isCurrentPlan ? tier.color : undefined,
          boxShadow: isCurrentPlan
            ? `0 0 40px ${tier.glowColor}, inset 0 0 20px ${tier.glowColor}`
            : undefined,
        }}
      >
        {/* Scan lines overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="data-grid-bg w-full h-full" />
        </div>

        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)`,
          }}
        />

        {/* Corner brackets */}
        <div
          className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 opacity-40"
          style={{ borderColor: tier.color }}
        />
        <div
          className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 opacity-40"
          style={{ borderColor: tier.color }}
        />
        <div
          className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 opacity-40"
          style={{ borderColor: tier.color }}
        />
        <div
          className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 opacity-40"
          style={{ borderColor: tier.color }}
        />

        {/* Content */}
        <div className="relative z-10 p-6 sm:p-8 flex flex-col h-full">
          {/* Header */}
          <div className="text-center mb-6">
            {/* Icon */}
            <div
              className="w-14 h-14 mx-auto mb-4 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${tier.color}15, ${tier.color}08)`,
                border: `1px solid ${tier.color}40`,
                clipPath:
                  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              }}
            >
              <TierIcon className={`w-6 h-6`} />
            </div>

            {/* Tier label */}
            <div
              className="text-[9px] font-mono tracking-[0.5em] uppercase mb-1 opacity-50"
              style={{ color: tier.color }}
            >
              {tier.subtitle}
            </div>

            {/* Tier name */}
            <h3
              className="text-2xl font-black tracking-wider mb-4"
              style={{ color: tier.color }}
            >
              {tier.name}
            </h3>

            {/* Price */}
            <div className="flex items-baseline justify-center gap-1">
              <span
                className="text-4xl sm:text-5xl font-black tabular-nums"
                style={{ color: tier.color }}
              >
                {tier.priceLabel}
              </span>
              {tier.price !== null && (
                <span className="text-white/20 text-sm font-mono">/mo</span>
              )}
            </div>
            {tier.price === null && (
              <span className="text-white/20 text-xs font-mono">forever free</span>
            )}

            {/* Limit badge */}
            <div
              className="inline-block mt-3 px-3 py-1 text-[10px] font-mono tracking-wider"
              style={{
                background: `${tier.color}10`,
                border: `1px solid ${tier.color}20`,
                color: `${tier.color}99`,
                clipPath:
                  "polygon(6px 0%, calc(100% - 6px) 0%, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0% 50%)",
              }}
            >
              {tier.limits}
            </div>
          </div>

          {/* Divider */}
          <div
            className="h-px mb-6 opacity-20"
            style={{
              background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)`,
            }}
          />

          {/* Features */}
          <div className="flex-1 space-y-3 mb-8">
            {tier.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                {feature.included ? (
                  <div
                    className="w-5 h-5 shrink-0 flex items-center justify-center mt-0.5"
                    style={{
                      background: `${tier.color}15`,
                      border: `1px solid ${tier.color}30`,
                      borderRadius: "2px",
                    }}
                  >
                    <CheckIcon
                      className="w-3 h-3"
                      style={{ color: tier.color } as React.CSSProperties}
                    />
                  </div>
                ) : (
                  <div className="w-5 h-5 shrink-0 flex items-center justify-center mt-0.5 border border-white/10 rounded-sm">
                    <LockIcon className="w-3 h-3 text-white/15" />
                  </div>
                )}
                <span
                  className={`text-sm font-mono ${
                    feature.included ? "text-white/70" : "text-white/20"
                  }`}
                >
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="mt-auto">
            {isCurrentPlan ? (
              <div
                className="w-full py-3.5 text-center text-sm font-bold font-mono tracking-[0.2em] uppercase"
                style={{
                  background: `${tier.color}15`,
                  border: `1px solid ${tier.color}40`,
                  color: tier.color,
                  clipPath:
                    "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <CheckIcon className="w-4 h-4" />
                  Current Plan
                </span>
              </div>
            ) : (
              <button
                onClick={() => onSelect(tier)}
                disabled={isLoading}
                className="w-full py-3.5 text-sm font-bold font-mono tracking-[0.2em] uppercase transition-all duration-300 hover:brightness-125 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${tier.color}30, ${tier.color}15)`,
                  border: `1px solid ${tier.color}50`,
                  color: tier.color,
                  clipPath:
                    "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
                  boxShadow: `0 0 20px ${tier.glowColor}, inset 0 1px 15px ${tier.color}08`,
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <RocketIcon className="w-4 h-4" />
                    {tier.cta}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-1/4 right-1/4 h-px opacity-40"
          style={{
            background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

// ── Feature Comparison Table ────────────────────────────────

function ComparisonTable() {
  const categories = [
    {
      name: "Team Management",
      icon: UsersIcon,
      features: [
        { name: "Teams", free: "1", pro: "1", club: "Unlimited", enterprise: "Unlimited" },
        { name: "Athletes per team", free: "15", pro: "Unlimited", club: "Unlimited", enterprise: "Unlimited" },
        { name: "Coach dashboard", free: true, pro: true, club: true, enterprise: true },
        { name: "Parent portal", free: false, pro: true, club: true, enterprise: true },
        { name: "Multi-sport support", free: false, pro: false, club: true, enterprise: true },
      ],
    },
    {
      name: "Training Features",
      icon: BoltIcon,
      features: [
        { name: "XP & streak tracking", free: true, pro: true, club: true, enterprise: true },
        { name: "Checkpoints & quests", free: "Basic", pro: "All", club: "All", enterprise: "All + Custom" },
        { name: "Schedule management", free: false, pro: true, club: true, enterprise: true },
        { name: "Cloud sync", free: false, pro: true, club: true, enterprise: true },
        { name: "Wellness tracking", free: false, pro: true, club: true, enterprise: true },
      ],
    },
    {
      name: "Analytics & Reporting",
      icon: ChartIcon,
      features: [
        { name: "Basic stats", free: true, pro: true, club: true, enterprise: true },
        { name: "Performance analytics", free: false, pro: false, club: true, enterprise: true },
        { name: "Custom reports", free: false, pro: false, club: true, enterprise: true },
        { name: "Recruiting board", free: false, pro: false, club: true, enterprise: true },
        { name: "Data export", free: false, pro: false, club: false, enterprise: true },
      ],
    },
    {
      name: "Platform & Support",
      icon: ApiIcon,
      features: [
        { name: "Email support", free: "Community", pro: "48h", club: "24h", enterprise: "Priority" },
        { name: "White-label branding", free: false, pro: false, club: false, enterprise: true },
        { name: "REST API access", free: false, pro: false, club: false, enterprise: true },
        { name: "SSO & security", free: false, pro: false, club: false, enterprise: true },
        { name: "Custom integrations", free: false, pro: false, club: false, enterprise: true },
      ],
    },
  ];

  const tierColors = {
    free: "#94a3b8",
    pro: "#00f0ff",
    club: "#a855f7",
    enterprise: "#f59e0b",
  };

  return (
    <div className="mt-20">
      {/* Section Header */}
      <div className="text-center mb-12">
        <div className="text-[9px] tracking-[0.6em] uppercase font-bold text-[#00f0ff]/30 font-mono mb-2">
          {"<"} feature.comparison {"/>"}
        </div>
        <h2
          className="text-3xl sm:text-4xl font-black tracking-tight"
          style={{
            background: "linear-gradient(135deg, #00f0ff, #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Full Feature Breakdown
        </h2>
      </div>

      {/* Table */}
      <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            {/* Header */}
            <thead>
              <tr className="border-b border-[#00f0ff]/10">
                <th className="text-left p-4 sm:p-5 text-white/30 text-xs font-mono uppercase tracking-wider w-[200px]">
                  Feature
                </th>
                {(["free", "pro", "club", "enterprise"] as const).map((tid) => (
                  <th
                    key={tid}
                    className="p-4 sm:p-5 text-center text-xs font-bold font-mono uppercase tracking-[0.2em]"
                    style={{ color: tierColors[tid] }}
                  >
                    {tid}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, ci) => (
                <React.Fragment key={ci}>
                  {/* Category header */}
                  <tr className="border-t border-[#00f0ff]/10">
                    <td
                      colSpan={5}
                      className="p-4 sm:p-5"
                      style={{
                        background: "linear-gradient(90deg, rgba(0,240,255,0.04), transparent)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <cat.icon className="w-4 h-4 text-[#00f0ff]/50" />
                        <span className="text-white/50 text-xs font-bold font-mono uppercase tracking-[0.2em]">
                          {cat.name}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* Features */}
                  {cat.features.map((feat, fi) => (
                    <tr
                      key={fi}
                      className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-4 sm:p-5 text-white/40 text-sm font-mono">
                        {feat.name}
                      </td>
                      {(["free", "pro", "club", "enterprise"] as const).map((tid) => {
                        const val = feat[tid];
                        return (
                          <td key={tid} className="p-4 sm:p-5 text-center">
                            {val === true ? (
                              <CheckIcon
                                className="w-4 h-4 mx-auto"
                                style={{ color: tierColors[tid] } as React.CSSProperties}
                              />
                            ) : val === false ? (
                              <span className="text-white/10 text-sm">-</span>
                            ) : (
                              <span
                                className="text-xs font-mono font-bold"
                                style={{ color: tierColors[tid] }}
                              >
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Import React for Fragment ───────────────────────────────
import React from "react";

// ── Main Billing Page ───────────────────────────────────────

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Read current plan from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("apex-billing-plan");
      if (stored) setCurrentPlan(stored);
    } catch {
      // localStorage not available
    }
  }, []);

  const handleSelectPlan = useCallback(
    async (tier: PlanTier) => {
      // Free tier: set directly
      if (tier.id === "free") {
        try {
          localStorage.setItem("apex-billing-plan", "free");
          setCurrentPlan("free");
        } catch {
          // ignore
        }
        return;
      }

      // Paid tiers: redirect to Stripe Checkout
      setLoading(tier.id);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId: tier.priceId, planId: tier.id }),
        });

        const data = await res.json();

        if (data.url) {
          window.location.href = data.url;
        } else {
          console.error("No checkout URL returned:", data);
          setLoading(null);
        }
      } catch (err) {
        console.error("Checkout error:", err);
        setLoading(null);
      }
    },
    []
  );

  // Read success/cancel from URL params
  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    const planFromSuccess = params.get("plan");
    if (params.get("success") === "true" && planFromSuccess) {
      try {
        localStorage.setItem("apex-billing-plan", planFromSuccess);
        setCurrentPlan(planFromSuccess);
      } catch {
        // ignore
      }
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-hidden">
      {/* ── Ambient background ─────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Nebula orbs */}
        <div
          className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full nebula-1 opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(0,240,255,0.15) 0%, rgba(168,85,247,0.08) 40%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[20%] right-[10%] w-[600px] h-[600px] rounded-full nebula-2 opacity-15"
          style={{
            background:
              "radial-gradient(circle, rgba(168,85,247,0.12) 0%, rgba(245,158,11,0.06) 40%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-[50%] left-[50%] w-[400px] h-[400px] rounded-full nebula-3 opacity-10"
          style={{
            background:
              "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 60%)",
          }}
        />
        {/* Scan line */}
        <div className="absolute inset-0 scan-line bg-gradient-to-b from-transparent via-[#00f0ff]/[0.02] to-transparent h-[200px]" />
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Back nav */}
        <a
          href="/apex-athlete"
          className="inline-flex items-center gap-2 text-[#00f0ff]/40 hover:text-[#00f0ff]/80 text-xs font-mono tracking-wider uppercase transition-colors mb-8"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Dashboard
        </a>

        {/* ── Page Header ──────────────────────────────────────── */}
        <div className="text-center mb-12 sm:mb-16">
          {/* HUD tag */}
          <div className="text-[9px] tracking-[0.6em] uppercase font-bold text-[#00f0ff]/30 font-mono mb-3">
            {"<"} billing.system {"/>"}
          </div>

          {/* Title */}
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] leading-[0.85] mb-4"
            style={{
              background:
                "linear-gradient(135deg, #00f0ff 0%, #a855f7 40%, #00f0ff 60%, #e879f9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundSize: "200% 200%",
              animation: "gradientShift 4s ease-in-out infinite",
              filter: "drop-shadow(0 0 30px rgba(0,240,255,0.3))",
            }}
          >
            CHOOSE YOUR TIER
          </h1>

          <p className="text-white/30 text-sm sm:text-base font-mono max-w-xl mx-auto leading-relaxed">
            Unlock the full power of Apex Athlete. Every tier includes core
            gamification. Upgrade to expand your roster, unlock analytics, and
            dominate the competition.
          </p>

          {/* Current plan indicator */}
          {currentPlan && (
            <div className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 game-panel-sm bg-[#06020f]/80 border border-[#00f0ff]/20">
              <div className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.6)]" />
              <span className="text-[#00f0ff]/60 text-xs font-mono uppercase tracking-wider">
                Active Plan:
              </span>
              <span className="text-[#00f0ff] text-sm font-bold font-mono uppercase tracking-wider">
                {currentPlan}
              </span>
            </div>
          )}
        </div>

        {/* ── Pricing Grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 xl:gap-6">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              currentPlan={currentPlan}
              loading={loading}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>

        {/* ── Trust bar ────────────────────────────────────────── */}
        <div className="mt-12 sm:mt-16 text-center">
          <div className="inline-flex items-center gap-6 sm:gap-8 flex-wrap justify-center">
            <div className="flex items-center gap-2 text-white/20 text-xs font-mono">
              <LockIcon className="w-4 h-4" />
              <span>256-bit SSL</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2 text-white/20 text-xs font-mono">
              <ShieldIcon className="w-4 h-4" />
              <span>PCI Compliant</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2 text-white/20 text-xs font-mono">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span>Cancel anytime</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="text-white/20 text-xs font-mono">
              Powered by{" "}
              <span className="text-[#635bff] font-bold">Stripe</span>
            </div>
          </div>
        </div>

        {/* ── Comparison Table ─────────────────────────────────── */}
        <ComparisonTable />

        {/* ── FAQ Section ──────────────────────────────────────── */}
        <div className="mt-20 mb-16">
          <div className="text-center mb-12">
            <div className="text-[9px] tracking-[0.6em] uppercase font-bold text-[#a855f7]/30 font-mono mb-2">
              {"<"} intel.brief {"/>"}
            </div>
            <h2
              className="text-3xl sm:text-4xl font-black tracking-tight"
              style={{
                background: "linear-gradient(135deg, #a855f7, #e879f9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Questions & Answers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              {
                q: "Can I switch plans at any time?",
                a: "Yes. Upgrade or downgrade anytime. When upgrading, you only pay the prorated difference. Downgrades take effect at the end of your billing cycle.",
              },
              {
                q: "Is there a contract or commitment?",
                a: "No. All plans are month-to-month. Cancel anytime from your billing portal -- no questions asked, no cancellation fees.",
              },
              {
                q: "What happens to my data if I downgrade?",
                a: "Your data is never deleted. If you exceed the free tier limits, roster management is read-only until you upgrade or reduce your roster.",
              },
              {
                q: "Do you offer discounts for annual billing?",
                a: "Coming soon. Annual plans will include 2 months free. Contact us for early access to annual pricing.",
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="game-panel game-panel-border bg-[#06020f]/60 backdrop-blur-xl p-5 sm:p-6"
              >
                <h4 className="text-[#00f0ff]/80 text-sm font-bold font-mono mb-2">
                  {faq.q}
                </h4>
                <p className="text-white/30 text-sm font-mono leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
