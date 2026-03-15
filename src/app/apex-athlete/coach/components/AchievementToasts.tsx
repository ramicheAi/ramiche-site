"use client";

import React from "react";

export interface AchievementToast {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  exiting: boolean;
}

interface AchievementToastsProps {
  toasts: AchievementToast[];
  onDismiss: (id: string) => void;
}

export default function AchievementToasts({ toasts, onDismiss }: AchievementToastsProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-4 z-[250] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: "320px" }}>
      {toasts.map((t, i) => (
        <div key={t.id}
          className={`relative overflow-hidden rounded-2xl border-2 pointer-events-auto achieve-shine ${t.exiting ? "achieve-toast-exit" : "achieve-toast-enter"}`}
          style={{
            borderColor: `${t.color}40`,
            background: `linear-gradient(135deg, rgba(6,2,15,0.95), rgba(6,2,15,0.85))`,
            boxShadow: `0 0 30px ${t.color}20, 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 ${t.color}15`,
            backdropFilter: "blur(20px)",
            animationDelay: `${i * 0.1}s`,
          }}
          onClick={() => onDismiss(t.id)}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="achieve-icon-pop text-2xl flex-shrink-0" style={{ filter: `drop-shadow(0 0 8px ${t.color})` }}>
              {t.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.3em] font-bold font-mono mb-0.5" style={{ color: `${t.color}90` }}>
                Achievement Unlocked
              </div>
              <div className="text-white font-bold text-sm leading-tight truncate">{t.title}</div>
              <div className="text-white/50 text-xs mt-0.5 truncate">{t.desc}</div>
            </div>
          </div>
          {/* progress bar accent */}
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${t.color}, ${t.color}40)` }} />
        </div>
      ))}
    </div>
  );
}
