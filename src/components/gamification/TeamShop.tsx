"use client";

import { useState } from "react";
import TierBadge, { getTierForXP } from "./TierBadge";
import { getSportConfig } from "@/app/apex-athlete/lib/sport-config";

/* ══════════════════════════════════════════════════════════════
   TEAM SHOP — Embedded Tier-Locked Merch Store
   Fortnite-style item grid · Grit Economy · Apex dark theme
   ══════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────

interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: "apparel" | "gear" | "digital" | "experience";
  price: number; // in Grit
  requiredTierIndex: number; // index into sport levels array
  image?: string;
  emoji: string;
  limited?: boolean;
  stock?: number;
  soldOut?: boolean;
}

interface TeamShopProps {
  athleteGrit: number;
  athleteName: string;
  teamName?: string;
  onPurchase?: (item: ShopItem) => void;
  sport?: string;
}

// ── Helpers ────────────────────────────────────────────────

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

// ── Mock Items (tier index: 0=Rookie, 1=Contender, 2=Warrior, 3=Elite, 4=Captain, 5=Legend) ──

const SHOP_ITEMS: ShopItem[] = [
  // Rookie tier (0)
  { id: "s1", name: "Team Sticker Pack", description: "5 holographic team stickers", category: "gear", price: 50, requiredTierIndex: 0, emoji: "🏷️" },
  { id: "s2", name: "Digital Badge", description: "Profile badge — show your team pride", category: "digital", price: 75, requiredTierIndex: 0, emoji: "🎖️" },
  { id: "s3", name: "Swim Cap", description: "Team-branded silicone cap", category: "gear", price: 150, requiredTierIndex: 0, emoji: "🧢" },
  // Contender tier (1)
  { id: "s4", name: "Team Hoodie", description: "Premium cotton-blend hoodie", category: "apparel", price: 400, requiredTierIndex: 1, emoji: "🧥" },
  { id: "s5", name: "Mesh Bag", description: "Team mesh equipment bag", category: "gear", price: 300, requiredTierIndex: 1, emoji: "🎒" },
  { id: "s6", name: "Custom Goggles", description: "Anti-fog team-color goggles", category: "gear", price: 350, requiredTierIndex: 1, emoji: "🥽" },
  // Warrior tier (2)
  { id: "s7", name: "Gold Parka", description: "Limited warmup parka — warrior exclusive", category: "apparel", price: 800, requiredTierIndex: 2, emoji: "🧥", limited: true, stock: 20 },
  { id: "s8", name: "Tech Suit Discount", description: "$50 off next tech suit purchase", category: "digital", price: 600, requiredTierIndex: 2, emoji: "💳" },
  { id: "s9", name: "Private Lesson", description: "30-min 1-on-1 with head coach", category: "experience", price: 1000, requiredTierIndex: 2, emoji: "🏊", limited: true, stock: 5 },
  // Elite tier (3)
  { id: "s10", name: "Platinum Jacket", description: "Embroidered team jacket — elite only", category: "apparel", price: 1500, requiredTierIndex: 3, emoji: "🥇", limited: true, stock: 10 },
  { id: "s11", name: "Meet Entry Waiver", description: "Free entry to next invitational", category: "experience", price: 2000, requiredTierIndex: 3, emoji: "🎫" },
  // Legend tier (5)
  { id: "s12", name: "Legend Bundle", description: "Full branded kit — cap, suit, parka, bag", category: "apparel", price: 3000, requiredTierIndex: 5, emoji: "✨", limited: true, stock: 3 },
];

const CATEGORY_LABELS: Record<ShopItem["category"], { label: string; icon: string }> = {
  apparel: { label: "Apparel", icon: "👕" },
  gear: { label: "Gear", icon: "🎽" },
  digital: { label: "Digital", icon: "💎" },
  experience: { label: "Experiences", icon: "⚡" },
};

// ── Component ──────────────────────────────────────────────

export default function TeamShop({
  athleteGrit,
  athleteName,
  teamName = "Mettle Aquatics",
  onPurchase,
  sport = "swimming",
}: TeamShopProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | ShopItem["category"]>("all");
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [confirmPurchase, setConfirmPurchase] = useState(false);

  const levels = getSportConfig(sport).levels;
  const currentTier = getTierForXP(sport, athleteGrit);

  // Find current tier index
  let currentTierIdx = 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (athleteGrit >= levels[i].xpThreshold) {
      currentTierIdx = i;
      break;
    }
  }

  const tierStyles = getGlowStyles(currentTier.color);

  const filtered = SHOP_ITEMS.filter((item) => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    return true;
  });

  function isUnlocked(item: ShopItem): boolean {
    return item.requiredTierIndex <= currentTierIdx;
  }

  function canAfford(item: ShopItem): boolean {
    return athleteGrit >= item.price;
  }

  function handlePurchase(item: ShopItem) {
    if (!isUnlocked(item) || !canAfford(item) || item.soldOut) return;
    if (!confirmPurchase) {
      setConfirmPurchase(true);
      return;
    }
    onPurchase?.(item);
    setConfirmPurchase(false);
    setSelectedItem(null);
  }

  function getItemTierStyles(item: ShopItem) {
    const level = levels[Math.min(item.requiredTierIndex, levels.length - 1)];
    return { ...getGlowStyles(level.color), color: level.color, name: level.name };
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(0,240,255,0.05))",
          border: "2px solid rgba(168,85,247,0.15)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#f8fafc]/40 uppercase tracking-widest">{teamName}</p>
            <h3 className="text-lg font-black text-[#f8fafc] tracking-tight">Team Shop</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-[#f8fafc]/30 uppercase">Balance</p>
              <p className="text-sm font-black tabular-nums" style={{ color: currentTier.color }}>
                {athleteGrit.toLocaleString()} Grit
              </p>
            </div>
            <TierBadge sport={sport} xp={athleteGrit} size="sm" />
          </div>
        </div>
      </div>

      {/* ── Category Filter ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory("all")}
          className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
          style={{
            background: selectedCategory === "all" ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)",
            color: selectedCategory === "all" ? "#c4b5fd" : "rgba(248,250,252,0.4)",
            border: selectedCategory === "all" ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent",
          }}
        >
          All
        </button>
        {(Object.keys(CATEGORY_LABELS) as ShopItem["category"][]).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: selectedCategory === cat ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)",
              color: selectedCategory === cat ? "#c4b5fd" : "rgba(248,250,252,0.4)",
              border: selectedCategory === cat ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent",
            }}
          >
            {CATEGORY_LABELS[cat].icon} {CATEGORY_LABELS[cat].label}
          </button>
        ))}
      </div>

      {/* ── Item Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((item) => {
          const unlocked = isUnlocked(item);
          const affordable = canAfford(item);
          const itemTier = getItemTierStyles(item);
          const isSelected = selectedItem?.id === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setSelectedItem(isSelected ? null : item);
                setConfirmPurchase(false);
              }}
              className="relative text-left rounded-xl p-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${itemTier.bg}, rgba(14,14,24,0.95))`
                  : "rgba(255,255,255,0.03)",
                border: isSelected
                  ? `2px solid ${itemTier.color}40`
                  : "2px solid rgba(255,255,255,0.06)",
                opacity: unlocked ? 1 : 0.5,
                filter: unlocked ? "none" : "grayscale(0.6)",
              }}
            >
              {/* Lock overlay */}
              {!unlocked && (
                <div className="absolute inset-0 rounded-xl flex items-center justify-center z-10">
                  <div
                    className="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: itemTier.bg, color: itemTier.color, border: `1px solid ${itemTier.border}` }}
                  >
                    🔒 {itemTier.name}
                  </div>
                </div>
              )}

              {/* Limited badge */}
              {item.limited && !item.soldOut && (
                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                  {item.stock} left
                </div>
              )}
              {item.soldOut && (
                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                  Sold Out
                </div>
              )}

              {/* Item content */}
              <div className="text-2xl mb-2">{item.emoji}</div>
              <p className="text-xs font-bold text-[#f8fafc]/90 truncate">{item.name}</p>
              <p className="text-[10px] text-[#f8fafc]/40 truncate mt-0.5">{item.description}</p>

              {/* Price */}
              <div className="flex items-center gap-1 mt-2">
                <span
                  className="text-xs font-black tabular-nums"
                  style={{ color: affordable && unlocked ? "#34d399" : "#f8fafc40" }}
                >
                  {item.price.toLocaleString()}
                </span>
                <span className="text-[9px] text-[#f8fafc]/30 uppercase">Grit</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Purchase Panel ── */}
      {selectedItem && isUnlocked(selectedItem) && (() => {
        const selTier = getItemTierStyles(selectedItem);
        return (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: `linear-gradient(135deg, ${selTier.bg}, rgba(14,14,24,0.98))`,
              border: `2px solid ${selTier.border}`,
              boxShadow: `0 0 20px ${selTier.glow}`,
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{selectedItem.emoji}</span>
              <div className="flex-1">
                <h4 className="text-sm font-black text-[#f8fafc]">{selectedItem.name}</h4>
                <p className="text-xs text-[#f8fafc]/50 mt-0.5">{selectedItem.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-lg font-black tabular-nums" style={{ color: selTier.color }}>
                    {selectedItem.price.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#f8fafc]/30 uppercase">Grit</span>
                </div>
              </div>
            </div>

            {canAfford(selectedItem) && !selectedItem.soldOut ? (
              <button
                onClick={() => handlePurchase(selectedItem)}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: confirmPurchase
                    ? "linear-gradient(135deg, #f59e0b, #f59e0bcc)"
                    : `linear-gradient(135deg, ${selTier.color}, ${selTier.color}cc)`,
                  color: "#0e0e18",
                  boxShadow: `0 0 20px ${confirmPurchase ? "rgba(245,158,11,0.3)" : selTier.glow}`,
                }}
              >
                {confirmPurchase ? "Tap Again to Confirm" : `Purchase for ${selectedItem.price.toLocaleString()} Grit`}
              </button>
            ) : selectedItem.soldOut ? (
              <div className="w-full py-2.5 rounded-xl text-sm font-bold text-center text-red-400/60 bg-red-500/10 border border-red-500/20">
                Sold Out
              </div>
            ) : (
              <div className="w-full py-2.5 rounded-xl text-sm font-bold text-center text-[#f8fafc]/30 bg-white/[0.03] border border-white/[0.06]">
                Need {(selectedItem.price - athleteGrit).toLocaleString()} more Grit
              </div>
            )}

            {/* Balance after purchase */}
            {canAfford(selectedItem) && !selectedItem.soldOut && (
              <p className="text-[10px] text-[#f8fafc]/30 text-center">
                Balance after: {(athleteGrit - selectedItem.price).toLocaleString()} Grit
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
