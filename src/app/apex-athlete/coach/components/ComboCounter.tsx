"use client";

import React from "react";

interface ComboCounterProps {
  comboCount: number;
  comboExiting: boolean;
}

export default function ComboCounter({ comboCount, comboExiting }: ComboCounterProps) {
  if (comboCount < 3) return null;
  const tier = comboCount >= 10 ? 3 : comboCount >= 7 ? 2 : comboCount >= 5 ? 1 : 0;
  const colors = ["#00f0ff", "#a78bfa", "#f59e0b", "#ef4444"];
  const labels = ["COMBO", "MEGA COMBO", "ULTRA COMBO", "INSANE COMBO"];
  const color = colors[tier];
  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] pointer-events-none ${comboExiting ? "combo-exit" : "combo-enter"}`}>
      <div className="text-center">
        <div className="combo-pulse text-5xl font-black tabular-nums" style={{
          color,
          textShadow: `0 0 30px ${color}, 0 0 60px ${color}60`,
        }}>
          {comboCount}x
        </div>
        <div className="text-[10px] tracking-[0.4em] font-bold uppercase mt-1" style={{ color: `${color}90` }}>
          {labels[tier]}
        </div>
      </div>
    </div>
  );
}
