"use client";

import { useState } from "react";
import TierBadge, { getTierForXP, getNextTier } from "./TierBadge";
import { getSportConfig } from "@/app/apex-athlete/lib/sport-config";

/* ══════════════════════════════════════════════════════════════
   GRIT POINTS BALANCE — Sweat Economy Points Display
   Balance · History · Redemption Slider
   Design: Apex dark theme · glassmorphism · neon accents
   ══════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────

interface GritTransaction {
  id: string;
  date: number;
  type: "earned" | "redeemed" | "bonus" | "penalty";
  amount: number;
  description: string;
  source: "practice" | "meet" | "quest" | "streak" | "shop" | "billing" | "bonus";
}

interface GritPointsBalanceProps {
  athleteName: string;
  totalGrit: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  transactions?: GritTransaction[];
  maxRedeemable?: number;
  onRedeem?: (amount: number) => void;
  compact?: boolean;
  sport?: string;
}

// ── Mock Transactions ──────────────────────────────────────

const MOCK_TRANSACTIONS: GritTransaction[] = [
  { id: "t1", date: Date.now() - 86400000 * 0, type: "earned", amount: 50, description: "Practice attendance — Platinum AM", source: "practice" },
  { id: "t2", date: Date.now() - 86400000 * 1, type: "earned", amount: 120, description: "Spring Classic — 100 Free PB drop", source: "meet" },
  { id: "t3", date: Date.now() - 86400000 * 2, type: "earned", amount: 75, description: "7-day streak bonus", source: "streak" },
  { id: "t4", date: Date.now() - 86400000 * 3, type: "redeemed", amount: -200, description: "Team hoodie — Contender tier", source: "shop" },
  { id: "t5", date: Date.now() - 86400000 * 4, type: "earned", amount: 100, description: "Quest: Hit all 3 practices this week", source: "quest" },
  { id: "t6", date: Date.now() - 86400000 * 5, type: "earned", amount: 50, description: "Practice attendance — Platinum AM", source: "practice" },
  { id: "t7", date: Date.now() - 86400000 * 7, type: "bonus", amount: 250, description: "Monthly MVP award", source: "bonus" },
  { id: "t8", date: Date.now() - 86400000 * 10, type: "redeemed", amount: -150, description: "Bill discount — March tuition", source: "billing" },
  { id: "t9", date: Date.now() - 86400000 * 12, type: "earned", amount: 50, description: "Practice attendance — Platinum PM", source: "practice" },
  { id: "t10", date: Date.now() - 86400000 * 14, type: "earned", amount: 80, description: "Dual meet — 200 IM improvement", source: "meet" },
];

const SOURCE_ICONS: Record<GritTransaction["source"], string> = {
  practice: "🏊",
  meet: "🏅",
  quest: "⚔️",
  streak: "🔥",
  shop: "🛍️",
  billing: "💰",
  bonus: "⭐",
};

// ── Helpers ────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatGrit(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function getGlowStyles(color: string) {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return {
    glow: `rgba(${r},${g},${b},0.15)`,
    bg: `rgba(${r},${g},${b},0.08)`,
    border: `rgba(${r},${g},${b},0.25)`,
  };
}

// ── Component ──────────────────────────────────────────────

export default function GritPointsBalance({
  athleteName,
  totalGrit,
  lifetimeEarned,
  lifetimeRedeemed,
  transactions = MOCK_TRANSACTIONS,
  maxRedeemable = Math.floor(totalGrit * 0.5),
  onRedeem,
  compact = false,
  sport = "swimming",
}: GritPointsBalanceProps) {
  const [redeemAmount, setRedeemAmount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [filter, setFilter] = useState<"all" | "earned" | "redeemed">("all");

  const currentTier = getTierForXP(sport, totalGrit);
  const nextTier = getNextTier(sport, totalGrit);
  const tierStyles = getGlowStyles(currentTier.color);
  const nextStyles = nextTier ? getGlowStyles(nextTier.color) : null;

  const progress = nextTier
    ? Math.min(100, Math.round(((totalGrit - currentTier.xpThreshold) / (nextTier.xpThreshold - currentTier.xpThreshold)) * 100))
    : 100;

  const filtered = transactions.filter((t) => {
    if (filter === "earned") return t.amount > 0;
    if (filter === "redeemed") return t.amount < 0;
    return true;
  });

  const redeemValue = (redeemAmount * 0.01).toFixed(2);

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <TierBadge sport={sport} xp={totalGrit} size="sm" showLabel={false} />
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-[#f8fafc]/40 uppercase tracking-wider">Grit</span>
          <span className="text-sm font-black tabular-nums" style={{ color: currentTier.color }}>
            {formatGrit(totalGrit)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Balance Card ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background: `linear-gradient(135deg, ${tierStyles.bg}, rgba(14,14,24,0.95))`,
          border: `2px solid ${tierStyles.border}`,
          boxShadow: `0 0 30px ${tierStyles.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        {/* Glow orb */}
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-3xl"
          style={{ background: currentTier.color }}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] text-[#f8fafc]/40 uppercase tracking-widest mb-1">
                Grit Balance
              </p>
              <p className="text-3xl font-black tabular-nums tracking-tight" style={{ color: currentTier.color }}>
                {totalGrit.toLocaleString()}
              </p>
            </div>
            <TierBadge sport={sport} xp={totalGrit} size="lg" showProgress />
          </div>

          {/* Stats row */}
          <div className="flex gap-4 mt-3">
            <div>
              <p className="text-[10px] text-[#f8fafc]/30 uppercase">Lifetime Earned</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums">+{formatGrit(lifetimeEarned)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#f8fafc]/30 uppercase">Redeemed</p>
              <p className="text-sm font-bold text-[#ec4899] tabular-nums">-{formatGrit(lifetimeRedeemed)}</p>
            </div>
            {nextTier && (
              <div className="ml-auto text-right">
                <p className="text-[10px] text-[#f8fafc]/30 uppercase">Next Tier</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: nextTier.color }}>
                  {(nextTier.xpThreshold - totalGrit).toLocaleString()} to go
                </p>
              </div>
            )}
          </div>

          {/* Tier progress bar */}
          {nextTier && (
            <div className="mt-3">
              <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier.color})`,
                    boxShadow: `0 0 8px ${currentTier.color}`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Redemption Slider ── */}
      {onRedeem && maxRedeemable > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "2px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#f8fafc]/60 uppercase tracking-wider">
              Apply to Bill
            </p>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-md"
              style={{ background: tierStyles.bg, color: currentTier.color }}
            >
              -${redeemValue}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={maxRedeemable}
            step={10}
            value={redeemAmount}
            onChange={(e) => setRedeemAmount(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(90deg, ${currentTier.color} ${(redeemAmount / maxRedeemable) * 100}%, rgba(255,255,255,0.06) ${(redeemAmount / maxRedeemable) * 100}%)`,
              accentColor: currentTier.color,
            }}
          />

          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[#f8fafc]/30 tabular-nums">0</span>
            <span className="text-[10px] text-[#f8fafc]/30 tabular-nums">{formatGrit(maxRedeemable)} max</span>
          </div>

          {redeemAmount > 0 && (
            <button
              onClick={() => onRedeem(redeemAmount)}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold text-[#0e0e18] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${currentTier.color}, ${currentTier.color}cc)`,
                boxShadow: `0 0 20px ${tierStyles.glow}`,
              }}
            >
              Redeem {formatGrit(redeemAmount)} Grit (-${redeemValue})
            </button>
          )}
        </div>
      )}

      {/* ── Transaction History ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "2px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <span className="text-xs font-bold text-[#f8fafc]/60 uppercase tracking-wider">
            Transaction History
          </span>
          <span className="text-xs text-[#f8fafc]/30">{showHistory ? "▲" : "▼"}</span>
        </button>

        {showHistory && (
          <div>
            {/* Filter tabs */}
            <div className="flex gap-1 px-4 pb-2">
              {(["all", "earned", "redeemed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                  style={{
                    background: filter === f ? "rgba(255,255,255,0.08)" : "transparent",
                    color: filter === f ? "#f8fafc" : "rgba(248,250,252,0.3)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Transaction list */}
            <div className="max-h-64 overflow-y-auto">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  style={{ contentVisibility: "auto", containIntrinsicSize: "0 44px" }}
                >
                  <span className="text-base shrink-0">{SOURCE_ICONS[t.source]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#f8fafc]/80 truncate">{t.description}</p>
                    <p className="text-[10px] text-[#f8fafc]/30">{formatDate(t.date)}</p>
                  </div>
                  <span
                    className="text-sm font-bold tabular-nums shrink-0"
                    style={{ color: t.amount > 0 ? "#34d399" : "#ec4899" }}
                  >
                    {t.amount > 0 ? "+" : ""}{formatGrit(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
