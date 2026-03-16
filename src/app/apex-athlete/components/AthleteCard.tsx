"use client";

import { useRef, useState } from "react";
import { getLevel, getNextLevel, getLevelProgress } from "../lib/game-engine";

/* ── Types ─── */
interface BestTime {
  event: string;
  time: string;
  place?: number;
}

interface AthleteCardProps {
  name: string;
  team: string;
  sport?: string;
  season?: string;
  level: string;
  levelIcon: string;
  levelColor: string;
  xp: number;
  streak: number;
  meets: number;
  bestTimes: BestTime[];
  avatarUrl?: string;
  onClose: () => void;
}

/* ── Themes ─── */
const THEMES = [
  { primary: "#6b21a8", secondary: "#dc2626", label: "Purple Fire" },
  { primary: "#1e40af", secondary: "#0ea5e9", label: "Ocean" },
  { primary: "#15803d", secondary: "#22d3ee", label: "Emerald" },
  { primary: "#b91c1c", secondary: "#f59e0b", label: "Scarlet Gold" },
  { primary: "#7c3aed", secondary: "#ec4899", label: "Violet Pink" },
  { primary: "#0f172a", secondary: "#f59e0b", label: "Midnight Gold" },
];

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function placeClass(p?: number): string {
  if (!p) return "";
  if (p === 1) return "bg-amber-500/30 text-amber-400";
  if (p === 2) return "bg-gray-400/30 text-gray-300";
  if (p === 3) return "bg-orange-700/30 text-orange-400";
  return "bg-white/10 text-white/50";
}

export default function AthleteCard({
  name, team, sport = "Swimming", season = "2025-26",
  level, levelIcon, levelColor, xp, streak, meets,
  bestTimes, avatarUrl, onClose,
}: AthleteCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(THEMES[0]);
  const [saving, setSaving] = useState(false);

  async function downloadPNG() {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `${name.replace(/\s+/g, "-").toLowerCase()}-mettle-card.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // silent fail
    }
    setSaving(false);
  }

  const topEvents = bestTimes.slice(0, 3);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
         onClick={onClose}>
      <div className="flex flex-col md:flex-row gap-6 max-w-[860px] w-full" onClick={e => e.stopPropagation()}>

        {/* ── Card Preview ── */}
        <div className="flex-shrink-0">
          <div ref={cardRef}
               className="w-[380px] h-[560px] rounded-[20px] overflow-hidden relative mx-auto"
               style={{
                 boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${theme.primary}33`,
                 background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
               }}>

            {/* Header */}
            <div className="flex justify-between items-start px-5 pt-[18px] relative z-10">
              <span className="text-[1.2rem] font-black tracking-[3px] text-white/90 drop-shadow-lg">METTLE</span>
              <span className="px-3 py-1 rounded-full text-[0.65rem] font-extrabold tracking-[1.5px] uppercase border-2 border-white/30 bg-black/30 text-white backdrop-blur-sm">
                {levelIcon} {level}
              </span>
            </div>

            {/* Avatar */}
            <div className="flex-1 flex items-center justify-center py-3 relative z-10">
              <div className="w-[160px] h-[160px] rounded-full border-4 border-white/30 flex items-center justify-center bg-black/25 backdrop-blur-sm overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="font-black text-white/70 text-[3.5rem] tracking-[2px]">
                    {getInitials(name)}
                  </span>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="text-center px-5 pb-2 relative z-10">
              <div className="text-[1.6rem] font-black tracking-[2px] uppercase text-white drop-shadow-lg leading-tight">
                {name}
              </div>
              <div className="text-[0.75rem] text-white/60 tracking-[2px] uppercase mt-[2px]">
                {team}
              </div>
              <span className="inline-block px-[10px] py-[2px] rounded-[10px] text-[0.65rem] font-bold tracking-[1px] uppercase bg-white/15 text-white/80 mt-1">
                {sport}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 border-t border-white/10 bg-black/40 backdrop-blur-sm relative z-10">
              {[
                { value: xp.toLocaleString(), label: "XP" },
                { value: streak, label: "STREAK" },
                { value: meets, label: "MEETS" },
              ].map((s, i) => (
                <div key={i} className="text-center py-[10px] px-2 border-r last:border-r-0 border-white/[0.08]">
                  <div className="text-[1.3rem] font-black text-white">{s.value}</div>
                  <div className="text-[0.55rem] text-white/50 tracking-[1.5px] uppercase mt-[1px]">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Events */}
            <div className="bg-black/50 px-4 py-[10px] flex flex-col gap-1 max-h-[80px] overflow-hidden relative z-10">
              {topEvents.map((ev, i) => (
                <div key={i} className="flex justify-between items-center text-[0.72rem]">
                  <span className="text-white/70 flex-1">{ev.event}</span>
                  <span className="text-amber-400 font-bold tabular-nums">{ev.time}</span>
                  {ev.place && (
                    <span className={`ml-2 px-2 py-[1px] rounded-[10px] font-extrabold text-[0.65rem] ${placeClass(ev.place)}`}>
                      #{ev.place}
                    </span>
                  )}
                </div>
              ))}
              {topEvents.length === 0 && (
                <div className="text-white/30 text-[0.72rem] text-center">No events recorded</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-4 py-[6px] pb-[10px] bg-black/50 relative z-10">
              <span className="text-[0.6rem] text-white/35 tracking-[1px]">{season} SEASON</span>
              <span className="text-[0.6rem] font-black tracking-[3px] text-white/25">METTLE</span>
            </div>

            {/* Holo shine */}
            <div className="absolute inset-0 z-20 pointer-events-none opacity-0 hover:opacity-100 transition-opacity"
                 style={{
                   background: "linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 55%, transparent 70%)",
                   mixBlendMode: "overlay",
                 }} />
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-col gap-4 min-w-[200px]">
          <h3 className="text-white font-bold tracking-[2px] uppercase text-sm">Card Theme</h3>
          <div className="flex flex-wrap gap-3">
            {THEMES.map((t, i) => (
              <button key={i}
                onClick={() => setTheme(t)}
                className={`w-9 h-9 rounded-lg border-[3px] transition-all ${
                  theme === t ? "border-white shadow-[0_0_12px_rgba(255,255,255,0.3)]" : "border-transparent"
                }`}
                style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})` }}
                title={t.label}
              />
            ))}
          </div>

          <button onClick={downloadPNG} disabled={saving}
            className="mt-4 px-5 py-3 bg-gradient-to-r from-purple-700 to-red-600 text-white font-bold tracking-[1px] uppercase rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50">
            {saving ? "Saving..." : "Save as PNG"}
          </button>

          <button onClick={onClose}
            className="px-5 py-3 border-2 border-white/20 text-white/60 rounded-xl hover:border-white/40 hover:text-white/80 transition-all text-sm tracking-[1px] uppercase">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
