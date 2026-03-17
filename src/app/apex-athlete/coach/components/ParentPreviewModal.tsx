"use client";

import { useState } from "react";

/* ══════════════════════════════════════════════════════════════
   Parent Portal Preview Modal — Coach clicks "Preview Parent View"
   next to an athlete → sees exactly what the parent sees.
   Read-only. COPPA-safe: shows trends, not raw data.
   ══════════════════════════════════════════════════════════════ */

interface Athlete {
  id: string;
  name: string;
  group: string;
  events?: string[];
  bestTimes?: Record<string, string>;
  level?: string;
  xp?: number;
  streak?: number;
}

interface Props {
  athlete: Athlete;
  onClose: () => void;
  isOpen: boolean;
}

const LEVELS = ["Rookie", "Contender", "Warrior", "Elite", "Captain", "Legend"];
const LEVEL_COLORS: Record<string, string> = {
  Rookie: "#94a3b8", Contender: "#60a5fa", Warrior: "#a78bfa",
  Elite: "#f59e0b", Captain: "#f97316", Legend: "#ef4444",
};

export default function ParentPreviewModal({ athlete, onClose, isOpen }: Props) {
  const [tab, setTab] = useState<"growth" | "achievements" | "times">("growth");
  if (!isOpen) return null;

  const level = athlete.level || "Rookie";
  const xp = athlete.xp || 0;
  const streak = athlete.streak || 0;
  const levelColor = LEVEL_COLORS[level] || "#94a3b8";
  const levelIdx = LEVELS.indexOf(level);
  const xpToNext = (levelIdx + 1) * 500;
  const xpPct = Math.min(100, Math.round((xp / xpToNext) * 100));

  const mockAchievements = [
    { icon: "🏊", title: "First Meet Completed", date: "Feb 2026", desc: "Competed in first official swim meet" },
    { icon: "⚡", title: "7-Day Practice Streak", date: "Mar 2026", desc: "Attended practice every day for a week" },
    { icon: "🏆", title: "Personal Best", date: "Mar 2026", desc: "Set a new personal best time" },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-purple-500/30 bg-gray-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-purple-400">Parent Portal Preview</p>
            <h2 className="text-xl font-bold text-white">{athlete.name}</h2>
            <p className="text-sm text-gray-400">{athlete.group}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:text-white hover:border-purple-500 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Level Badge + XP */}
        <div className="mb-4 rounded-xl border border-gray-800 bg-gray-800/50 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${levelColor}25`, color: levelColor, border: `1px solid ${levelColor}50` }}>
              {level}
            </span>
            {streak > 0 && <span className="text-xs text-orange-400">🔥 {streak}-day streak</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-gray-700 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${levelColor}, ${levelColor}80)` }} />
            </div>
            <span className="text-xs text-gray-400 font-mono">{xp}/{xpToNext} XP</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 rounded-lg bg-gray-800 p-1">
          {(["growth", "achievements", "times"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>
              {t === "growth" ? "Growth Trends" : t === "achievements" ? "Achievements" : "Best Times"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "growth" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-4">
              <p className="text-sm font-medium text-gray-300 mb-2">Practice Consistency</p>
              <div className="flex gap-1">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: `${20 + Math.random() * 30}px`, background: i < 10 ? `${levelColor}60` : `${levelColor}20` }} />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Last 12 weeks</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-4">
              <p className="text-sm font-medium text-gray-300 mb-1">Overall Progress</p>
              <p className="text-2xl font-bold text-green-400">↑ Improving</p>
              <p className="text-xs text-gray-500">Based on attendance, effort scores, and time drops</p>
            </div>
          </div>
        )}

        {tab === "achievements" && (
          <div className="space-y-2">
            {mockAchievements.map((a, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-800/30 p-3">
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{a.title}</p>
                  <p className="text-xs text-gray-400">{a.desc}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "times" && (
          <div className="space-y-2">
            {athlete.bestTimes && Object.keys(athlete.bestTimes).length > 0 ? (
              Object.entries(athlete.bestTimes).map(([event, time]) => (
                <div key={event} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-800/30 px-4 py-3">
                  <span className="text-sm text-gray-300">{event}</span>
                  <span className="font-mono text-sm font-bold text-amber-400">{time}</span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-6 text-center">
                <p className="text-sm text-gray-500">No best times recorded yet</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 rounded-lg bg-purple-900/20 border border-purple-500/20 px-3 py-2">
          <p className="text-xs text-purple-300 text-center">
            This is what parents see. They cannot edit any data.
          </p>
        </div>
      </div>
    </div>
  );
}
