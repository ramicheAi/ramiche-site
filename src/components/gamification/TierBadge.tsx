"use client";

/* ══════════════════════════════════════════════════════════════
   TIER BADGE — Grit Economy Tier System
   Explorer → Voyager → Pioneer → Stellar → Cosmic
   Design: Apex dark theme · neon accents · glassmorphism
   ══════════════════════════════════════════════════════════════ */

export type TierLevel = "explorer" | "voyager" | "pioneer" | "stellar" | "cosmic";

interface TierConfig {
  label: string;
  icon: string;
  color: string;
  glow: string;
  bg: string;
  border: string;
  minGrit: number;
}

export const TIERS: Record<TierLevel, TierConfig> = {
  explorer: {
    label: "Explorer",
    icon: "🧭",
    color: "#94a3b8",
    glow: "rgba(148,163,184,0.15)",
    bg: "rgba(148,163,184,0.08)",
    border: "rgba(148,163,184,0.20)",
    minGrit: 0,
  },
  voyager: {
    label: "Voyager",
    icon: "🚀",
    color: "#00f0ff",
    glow: "rgba(0,240,255,0.15)",
    bg: "rgba(0,240,255,0.08)",
    border: "rgba(0,240,255,0.25)",
    minGrit: 500,
  },
  pioneer: {
    label: "Pioneer",
    icon: "⚡",
    color: "#a855f7",
    glow: "rgba(168,85,247,0.15)",
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.25)",
    minGrit: 1500,
  },
  stellar: {
    label: "Stellar",
    icon: "🌟",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.15)",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    minGrit: 3500,
  },
  cosmic: {
    label: "Cosmic",
    icon: "💎",
    color: "#ec4899",
    glow: "rgba(236,72,153,0.20)",
    bg: "rgba(236,72,153,0.10)",
    border: "rgba(236,72,153,0.30)",
    minGrit: 7500,
  },
};

export const TIER_ORDER: TierLevel[] = ["explorer", "voyager", "pioneer", "stellar", "cosmic"];

export function getTierForGrit(grit: number): TierLevel {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    if (grit >= TIERS[TIER_ORDER[i]].minGrit) return TIER_ORDER[i];
  }
  return "explorer";
}

export function getNextTier(current: TierLevel): TierLevel | null {
  const idx = TIER_ORDER.indexOf(current);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

interface TierBadgeProps {
  tier: TierLevel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  grit?: number;
  showProgress?: boolean;
}

export default function TierBadge({ tier, size = "md", showLabel = true, grit, showProgress = false }: TierBadgeProps) {
  const config = TIERS[tier];
  const next = getNextTier(tier);
  const nextConfig = next ? TIERS[next] : null;

  const sizes = {
    sm: { badge: "w-6 h-6 text-xs", text: "text-[10px]", gap: "gap-1" },
    md: { badge: "w-8 h-8 text-sm", text: "text-xs", gap: "gap-1.5" },
    lg: { badge: "w-12 h-12 text-xl", text: "text-sm", gap: "gap-2" },
  };

  const s = sizes[size];

  const progress = showProgress && grit !== undefined && nextConfig
    ? Math.min(100, Math.round(((grit - config.minGrit) / (nextConfig.minGrit - config.minGrit)) * 100))
    : null;

  return (
    <div className={`flex items-center ${s.gap}`}>
      <div
        className={`${s.badge} rounded-lg flex items-center justify-center font-black shrink-0`}
        style={{
          background: config.bg,
          border: `1.5px solid ${config.border}`,
          boxShadow: `0 0 12px ${config.glow}`,
        }}
      >
        {config.icon}
      </div>
      {showLabel && (
        <div className="flex flex-col min-w-0">
          <span className={`${s.text} font-bold truncate`} style={{ color: config.color }}>
            {config.label}
          </span>
          {progress !== null && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${config.color}, ${nextConfig!.color})`,
                  }}
                />
              </div>
              <span className="text-[9px] text-[#f8fafc]/30 tabular-nums">{progress}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
