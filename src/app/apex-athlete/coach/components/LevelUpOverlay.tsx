"use client";
import React from "react";

interface LevelUpOverlayProps {
  name: string | null;
  level: string;
  color: string;
  exiting: boolean;
  onDismiss: () => void;
}

const SPARKLE_DIRS = [
  { sx: "-90px", sy: "-100px" }, { sx: "95px", sy: "-90px" },
  { sx: "-80px", sy: "85px" }, { sx: "85px", sy: "90px" },
  { sx: "-120px", sy: "0px" }, { sx: "120px", sy: "-10px" },
  { sx: "0px", sy: "-120px" }, { sx: "10px", sy: "110px" },
  { sx: "-50px", sy: "-130px" }, { sx: "60px", sy: "120px" },
  { sx: "-110px", sy: "-50px" }, { sx: "100px", sy: "40px" },
];

export default function LevelUpOverlay({ name, level, color, exiting, onDismiss }: LevelUpOverlayProps) {
  if (!name) return null;
  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center ${exiting ? "level-up-exit" : ""}`}
      onClick={onDismiss}>
      {/* cinematic flash */}
      <div className="absolute inset-0 level-up-screen-flash" style={{ background: `radial-gradient(circle, ${color}40, transparent 70%)` }} />
      {/* dark backdrop with radial glow */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-lg" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${color}15 0%, transparent 60%)` }} />

      <div className="relative level-up-enter text-center w-full max-w-sm mx-4">
        {/* expanding ring bursts */}
        {[160, 224, 288, 352].map((size, i) => (
          <div key={i} className="ring-burst-pro absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: size, height: size, borderColor: color, animationDelay: `${i * 0.15}s` }} />
        ))}
        {/* sparkle particles */}
        {SPARKLE_DIRS.map((d, i) => (
          <div key={i} className="sparkle-pro absolute left-1/2 top-1/2 w-3 h-3 rounded-full"
            style={{ "--sx": d.sx, "--sy": d.sy, animationDelay: `${i * 0.04}s`, backgroundColor: color, boxShadow: `0 0 8px ${color}` } as React.CSSProperties} />
        ))}

        {/* main card */}
        <div className="relative overflow-hidden rounded-3xl"
          style={{ border: `2px solid ${color}50`, boxShadow: `0 0 60px ${color}30, inset 0 0 60px ${color}08` }}>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c0618] via-[#0c0618]/98 to-[#0c0618]" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${color}08 0%, transparent 40%, ${color}05 100%)` }} />

          <div className="relative px-8 py-14">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-0.5 level-up-accent-line" style={{ backgroundColor: color }} />

            <div className="level-icon-explode mx-auto mb-6" style={{ filter: `drop-shadow(0 0 30px ${color}) drop-shadow(0 0 60px ${color}80)` }}>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <path d="M40 4L12 18V38C12 56 24 70 40 76C56 70 68 56 68 38V18L40 4Z"
                  fill={`${color}20`} stroke={color} strokeWidth="2.5"/>
                <path d="M40 12L18 23V38C18 52 28 64 40 69C52 64 62 52 62 38V23L40 12Z"
                  fill={`${color}15`}/>
                <path d="M40 24L44.5 33.5L55 35L47.5 42L49.5 52.5L40 47.5L30.5 52.5L32.5 42L25 35L35.5 33.5Z"
                  fill={color} fillOpacity="0.9"/>
              </svg>
            </div>

            <div className="level-text-slide mb-2" style={{ animationDelay: "0.2s" }}>
              <div className="text-[10px] tracking-[0.5em] uppercase font-bold opacity-60" style={{ color }}>
                Achievement Unlocked
              </div>
            </div>
            <div className="level-text-slide mb-5" style={{ animationDelay: "0.35s" }}>
              <div className="text-4xl font-black tracking-tight bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(180deg, white 30%, ${color})` }}>
                LEVEL UP
              </div>
            </div>

            <div className="w-16 h-px mx-auto mb-5 level-text-slide" style={{ backgroundColor: `${color}40`, animationDelay: "0.45s" }} />

            <div className="text-white/90 text-xl font-bold tracking-wide mb-2 level-text-slide" style={{ animationDelay: "0.55s" }}>
              {name}
            </div>

            <div className="level-text-slide" style={{ animationDelay: "0.7s" }}>
              <div className="text-3xl font-black tracking-tight bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, ${color}, #f59e0b, ${color})` }}>
                {level}
              </div>
            </div>

            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-0.5 level-up-accent-line" style={{ backgroundColor: color, animationDelay: "0.3s" }} />
          </div>
        </div>

        <div className="text-white/30 text-xs mt-4 level-text-slide" style={{ animationDelay: "1.2s" }}>
          Tap to dismiss
        </div>
      </div>
    </div>
  );
}
