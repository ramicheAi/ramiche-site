"use client";

/* ══════════════════════════════════════════════════════════════
   TIER BADGE — METTLE Tier System (sport-aware)
   Swimming: Rookie → Contender → Warrior → Elite → Captain → Legend
   General:  Rookie → Starter → Captain → MVP → Hall of Fame → GOAT
   Source: getSportConfig(sport).levels
   Design: Apex dark theme · neon accents · glassmorphism
   ══════════════════════════════════════════════════════════════ */

import { getSportConfig } from "@/app/apex-athlete/lib/sport-config";

interface TierBadgeProps {
  sport?: string;
  xp: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showProgress?: boolean;
}

function getGlowStyles(color: string) {
  // Convert hex to rgba for glow/bg/border
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return {
    glow: `rgba(${r},${g},${b},0.15)`,
    bg: `rgba(${r},${g},${b},0.08)`,
    border: `rgba(${r},${g},${b},0.25)`,
  };
}

export default function TierBadge({ sport = "swimming", xp, size = "md", showLabel = true, showProgress = false }: TierBadgeProps) {
  const config = getSportConfig(sport);
  const levels = config.levels;

  // Find current tier (highest level where xp >= threshold)
  let tierIdx = 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i].xpThreshold) {
      tierIdx = i;
      break;
    }
  }

  const current = levels[tierIdx];
  const next = tierIdx < levels.length - 1 ? levels[tierIdx + 1] : null;
  const styles = getGlowStyles(current.color);

  const sizes = {
    sm: { badge: "w-6 h-6 text-xs", text: "text-[10px]", gap: "gap-1" },
    md: { badge: "w-8 h-8 text-sm", text: "text-xs", gap: "gap-1.5" },
    lg: { badge: "w-12 h-12 text-xl", text: "text-sm", gap: "gap-2" },
  };

  const s = sizes[size];

  const progress = showProgress && next
    ? Math.min(100, Math.round(((xp - current.xpThreshold) / (next.xpThreshold - current.xpThreshold)) * 100))
    : null;

  const nextStyles = next ? getGlowStyles(next.color) : null;

  return (
    <div className={`flex items-center ${s.gap}`}>
      <div
        className={`${s.badge} rounded-lg flex items-center justify-center font-black shrink-0`}
        style={{
          background: styles.bg,
          border: `1.5px solid ${styles.border}`,
          boxShadow: `0 0 12px ${styles.glow}`,
        }}
      >
        {current.icon}
      </div>
      {showLabel && (
        <div className="flex flex-col min-w-0">
          <span className={`${s.text} font-bold truncate`} style={{ color: current.color }}>
            {current.name}
          </span>
          {progress !== null && next && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${current.color}, ${next.color})`,
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

// Re-export for consumers that need tier info
export function getTierForXP(sport: string, xp: number) {
  const levels = getSportConfig(sport).levels;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i].xpThreshold) return levels[i];
  }
  return levels[0];
}

export function getNextTier(sport: string, xp: number) {
  const levels = getSportConfig(sport).levels;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i].xpThreshold) {
      return i < levels.length - 1 ? levels[i + 1] : null;
    }
  }
  return levels.length > 1 ? levels[1] : null;
}
