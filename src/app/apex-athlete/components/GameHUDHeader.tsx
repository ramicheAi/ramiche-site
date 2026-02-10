"use client";

import { useMemo } from "react";

interface GameHUDHeaderProps {
  view: "coach" | "parent" | "audit" | "analytics" | "schedule" | "wellness";
  setView: (view: GameHUDHeaderProps["view"]) => void;
  filteredRoster: any[];
  totalRoster: any[];
  sessionMode: "pool" | "weight" | "meet";
  currentSport: string;
  culture: {
    teamName: string;
    mission: string;
    seasonalGoal: string;
    goalTarget: number;
    goalCurrent: number;
    weeklyQuote: string;
  };
}

export function GameHUDHeader({
  view,
  setView,
  filteredRoster,
  totalRoster,
  sessionMode,
  currentSport,
  culture,
}: GameHUDHeaderProps) {
  const presentCount = useMemo(() => 
    filteredRoster.filter(a => 
      Object.values(a.checkpoints).some(Boolean) || 
      Object.values(a.weightCheckpoints).some(Boolean)
    ).length,
    [filteredRoster]
  );

  const today = new Date().toISOString().slice(0, 10);
  const xpToday = useMemo(() => 
    filteredRoster.reduce((s, a) => 
      s + (a.dailyXP?.date === today ? a.dailyXP.pool + a.dailyXP.weight + a.dailyXP.meet : 0), 0),
    [filteredRoster]
  );

  const sportLabels = {
    swimming: { pool: "🏊 Pool", weight: "🏋️ Weight Room", meet: "🏁 Meet Day" },
    diving: { pool: "🤿 Board", weight: "🏋️ Dryland", meet: "🏁 Meet Day" },
    waterpolo: { pool: "🤽 Pool", weight: "🏋️ Gym", meet: "🏁 Match Day" },
  };

  const icons = {
    coach: "◆",
    parent: "◇",
    audit: "□",
    analytics: "◈",
    schedule: "📅",
  };

  return (
    <div className="w-full relative mb-6">
      {/* Top gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff]/60 to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#00f0ff]/[0.03] to-transparent pointer-events-none" />

      <div className="pt-8 pb-2">
        {/* Title + Nav */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-[9px] tracking-[0.6em] uppercase font-bold text-[#00f0ff]/30 font-mono mb-1">{'<'} swim.training.system {'/'+'>'}</div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.04em] leading-[0.85]" style={{
              background: 'linear-gradient(135deg, #00f0ff 0%, #a855f7 40%, #00f0ff 60%, #e879f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 200%',
              animation: 'gradientShift 4s ease-in-out infinite',
              filter: 'drop-shadow(0 0 30px rgba(0,240,255,0.3))'
            }}>
              APEX ATHLETE
            </h1>
          </div>
          {/* Game HUD nav tabs */}
          <div className="flex flex-wrap">
            {(["coach", "parent", "audit", "analytics", "schedule"] as const).map((v, i) => {
              const active = view === v;
              return (
                <button key={v} onClick={() => setView(v)}
                  className={`relative px-4 sm:px-5 py-3 text-[10px] font-bold font-mono tracking-[0.25em] uppercase transition-all duration-300 ${
                    active
                      ? "text-[#00f0ff] bg-[#00f0ff]/[0.08]"
                      : "text-white/15 hover:text-[#00f0ff]/60 hover:bg-[#00f0ff]/[0.03]"
                  }`}
                  style={{
                    borderTop: active ? '2px solid rgba(0,240,255,0.6)' : '2px solid rgba(0,240,255,0.08)',
                    borderBottom: active ? 'none' : '1px solid rgba(0,240,255,0.05)',
                    boxShadow: active ? '0 -4px 20px rgba(0,240,255,0.15), inset 0 1px 15px rgba(0,240,255,0.05)' : 'none'
                  }}>
                  <span className={`mr-1.5 ${active ? "text-[#f59e0b]" : ""}`}>{icons[v]}</span>{v}
                  {active && <div className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-[#00f0ff]/40" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Team identity bar */}
        <div className="game-panel game-panel-border relative bg-[#06020f]/60 backdrop-blur-xl px-6 py-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 game-panel-sm bg-gradient-to-br from-[#f59e0b]/20 to-[#6b21a8]/20 border border-[#f59e0b]/30 flex items-center justify-center">
              <span className="text-[#f59e0b] text-lg font-black">SA</span>
            </div>
            <div className="flex-1">
              <h2 className="text-white/90 font-bold text-sm tracking-wide">{culture.teamName}</h2>
              <p className="text-[#f59e0b]/50 text-[11px] italic font-mono">{culture.mission}</p>
            </div>
          </div>
        </div>

        {/* Season goal progress */}
        <div className="flex items-center gap-4 px-2 mb-2">
          <span className="text-[#00f0ff]/20 text-[9px] font-mono uppercase tracking-wider shrink-0">{culture.seasonalGoal}</span>
          <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden xp-bar-segments">
            <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${Math.min(100, (culture.goalCurrent / culture.goalTarget) * 100)}%` }} />
          </div>
          <span className="text-[#f59e0b]/50 text-[9px] font-bold font-mono tabular-nums whitespace-nowrap shrink-0">{culture.goalCurrent}%<span className="text-white/10">/{culture.goalTarget}%</span></span>
        </div>
      </div>

      {/* Live HUD data strip */}
      <div className="relative border-y border-[#00f0ff]/10 bg-[#06020f]/90 backdrop-blur-xl">
        <div className="absolute inset-0 data-grid-bg opacity-30 pointer-events-none" />
        <div className="flex items-center gap-6 py-3 relative z-10 scan-sweep px-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${presentCount > 0 ? "bg-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.6)]" : "bg-white/10"}`} />
            <span className="neon-text-cyan text-sm font-bold font-mono tabular-nums whitespace-nowrap">{presentCount}<span className="text-white/15 font-normal">/{totalRoster.length}</span></span>
            <span className="text-[#00f0ff]/30 text-[10px] font-mono uppercase">present</span>
          </div>
          <div className="w-px h-4 bg-[#00f0ff]/10" />
          <div className="flex items-center gap-2">
            <span className="neon-text-gold text-sm font-bold font-mono tabular-nums whitespace-nowrap">{xpToday}</span>
            <span className="text-[#f59e0b]/30 text-[10px] font-mono uppercase">XP today</span>
          </div>
          <div className="w-px h-4 bg-[#00f0ff]/10" />
          <span className="text-[#00f0ff]/40 text-xs font-mono">{sessionMode === "pool" ? (currentSport === "diving" ? "🤿 BOARD" : currentSport === "waterpolo" ? "🤽 POOL" : "🏊 POOL") : sessionMode === "weight" ? "🏋️ WEIGHT" : "🏁 MEET"}</span>
          {culture.weeklyQuote && (
            <>
              <div className="w-px h-4 bg-[#00f0ff]/10" />
              <span className="text-[#a855f7]/30 text-[10px] italic truncate max-w-[200px] font-mono">&ldquo;{culture.weeklyQuote}&rdquo;</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}