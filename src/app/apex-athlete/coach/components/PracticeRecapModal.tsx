"use client";

import React from "react";

export interface RecapData {
  group: string;
  date: string;
  attendance: number;
  total: number;
  xpAwarded: number;
  topEarners: { name: string; xp: number; level: string; color: string }[];
  streaksActive: number;
  longestStreak: { name: string; streak: number };
  mvp: { name: string; xp: number } | null;
  checkpointsChecked: number;
}

interface PracticeRecapModalProps {
  recapData: RecapData;
  onClose: () => void;
}

export default function PracticeRecapModal({ recapData, onClose }: PracticeRecapModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop with radial glow */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 30%, rgba(168,85,247,0.15), transparent 60%)" }} />

      <div className="relative w-full max-w-sm recap-enter" onClick={e => e.stopPropagation()}>
        {/* Top accent line */}
        <div className="h-[2px] rounded-full mb-1" style={{ background: "linear-gradient(90deg, transparent, #a855f7, #00f0ff, #a855f7, transparent)" }} />

        <div className="rounded-3xl overflow-hidden border-2 border-white/[0.08]" style={{
          background: "linear-gradient(180deg, rgba(6,2,15,0.97) 0%, rgba(15,5,30,0.97) 100%)",
          boxShadow: "0 0 60px rgba(168,85,247,0.1), 0 25px 50px rgba(0,0,0,0.5)",
        }}>
          {/* Header */}
          <div className="text-center pt-8 pb-4 px-6">
            <div className="text-[10px] uppercase tracking-[0.4em] font-bold font-mono text-[#a855f7]/60 mb-2">Practice Complete</div>
            <div className="text-2xl font-black text-white tracking-tight mb-1">Session Recap</div>
            <div className="text-white/30 text-xs font-mono">{recapData.group} — {new Date(recapData.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
          </div>

          {/* Key stats grid */}
          <div className="grid grid-cols-3 gap-px mx-6 mb-6 rounded-2xl overflow-hidden border border-white/[0.06]">
            <div className="bg-white/[0.03] p-4 text-center">
              <div className="text-2xl font-black text-[#00f0ff] tabular-nums">{recapData.total > 0 ? Math.round((recapData.attendance / recapData.total) * 100) : 0}%</div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider mt-1">Attendance</div>
              <div className="text-white/20 text-[10px] font-mono mt-0.5">{recapData.attendance}/{recapData.total}</div>
            </div>
            <div className="bg-white/[0.03] p-4 text-center">
              <div className="text-2xl font-black text-[#f59e0b] tabular-nums">{recapData.xpAwarded}</div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider mt-1">XP Awarded</div>
              <div className="text-white/20 text-[10px] font-mono mt-0.5">{recapData.checkpointsChecked} checks</div>
            </div>
            <div className="bg-white/[0.03] p-4 text-center">
              <div className="text-2xl font-black text-[#a855f7] tabular-nums">{recapData.streaksActive}</div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider mt-1">Streaks</div>
              <div className="text-white/20 text-[10px] font-mono mt-0.5">{recapData.longestStreak.streak > 0 ? `Best: ${recapData.longestStreak.streak}d` : "-"}</div>
            </div>
          </div>

          {/* MVP */}
          {recapData.mvp && (
            <div className="mx-6 mb-4 p-4 rounded-2xl border border-[#f59e0b]/20" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(168,85,247,0.05))" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.4 4.8L18 7.6l-4 3.9.9 5.5L10 14.5 5.1 17l.9-5.5-4-3.9 5.6-.8L10 2z" fill="#f59e0b"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#f59e0b]/60">MVP — Top Earner</div>
                  <div className="text-white font-bold text-sm truncate">{recapData.mvp.name}</div>
                </div>
                <div className="text-[#f59e0b] font-black text-lg tabular-nums">+{recapData.mvp.xp}</div>
              </div>
            </div>
          )}

          {/* Top 3 earners */}
          {recapData.topEarners.length > 1 && (
            <div className="mx-6 mb-6 space-y-1">
              <div className="text-white/30 text-[10px] uppercase tracking-[0.2em] font-bold mb-2 px-1">Top Earners</div>
              {recapData.topEarners.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02]">
                  <span className="text-white/30 text-xs font-bold font-mono w-5 text-center">{i + 1}</span>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color, boxShadow: `0 0 6px ${e.color}60` }} />
                  <span className="text-white/80 text-sm flex-1 truncate">{e.name}</span>
                  <span className="text-xs font-mono" style={{ color: e.color }}>{e.level}</span>
                  <span className="text-white/60 text-xs font-bold font-mono tabular-nums">+{e.xp}</span>
                </div>
              ))}
            </div>
          )}

          {/* Dismiss */}
          <div className="px-6 pb-6">
            <button onClick={onClose}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#a855f7]/15 to-[#00f0ff]/15 border border-white/[0.08] text-white/80 text-sm font-bold tracking-wider uppercase hover:from-[#a855f7]/25 hover:to-[#00f0ff]/25 transition-all active:scale-[0.98] min-h-[52px]">
              Done
            </button>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="h-[2px] rounded-full mt-1" style={{ background: "linear-gradient(90deg, transparent, #00f0ff, #a855f7, #00f0ff, transparent)" }} />
      </div>
    </div>
  );
}
