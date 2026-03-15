"use client";
import React, { useEffect, useState } from "react";

/* ── PB Notification Overlay ──────────────────────────────────────
   Full-screen celebration when an athlete sets a new personal best.
   Shows event, old time, new time, time dropped, and XP earned.
   Auto-dismisses after 6 seconds or on tap.
   ─────────────────────────────────────────────────────────────── */

interface PBNotification {
  event: string;      // e.g. "100 Free"
  oldTime: string;    // e.g. "1:02.34"
  newTime: string;    // e.g. "59.87"
  timeDrop: string;   // e.g. "-2.47"
  xpEarned: number;   // total XP from this PB
  meetName?: string;
}

interface PBOverlayProps {
  notification: PBNotification | null;
  onDismiss: () => void;
  athleteColor?: string;
}

const PARTICLE_DIRS = [
  { x: "-100px", y: "-110px" }, { x: "105px", y: "-100px" },
  { x: "-90px", y: "95px" }, { x: "95px", y: "100px" },
  { x: "-130px", y: "0px" }, { x: "130px", y: "-10px" },
  { x: "0px", y: "-130px" }, { x: "10px", y: "120px" },
  { x: "-60px", y: "-140px" }, { x: "70px", y: "130px" },
  { x: "-120px", y: "-60px" }, { x: "110px", y: "50px" },
  { x: "40px", y: "-100px" }, { x: "-40px", y: "100px" },
  { x: "80px", y: "-60px" }, { x: "-80px", y: "60px" },
];

export default function PBOverlay({ notification, onDismiss, athleteColor = "#00f0ff" }: PBOverlayProps) {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notification) { setVisible(false); setExiting(false); return; }
    setVisible(true);
    setExiting(false);
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => { setVisible(false); onDismiss(); }, 500);
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification || !visible) return null;

  const color = athleteColor;

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center ${exiting ? "animate-fade-out" : "animate-fade-in"}`}
      onClick={() => { setExiting(true); setTimeout(() => { setVisible(false); onDismiss(); }, 500); }}
      style={{ animation: exiting ? "pbExit 0.5s ease-in forwards" : "pbEnter 0.6s ease-out" }}
    >
      {/* Dark backdrop with radial glow */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-lg" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${color}20 0%, transparent 60%)` }} />

      {/* Expanding ring bursts */}
      {[160, 240, 320, 400].map((size, i) => (
        <div key={i} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 opacity-0"
          style={{
            width: size, height: size,
            borderColor: color,
            animation: `pbRing 1.2s ease-out ${i * 0.15}s forwards`,
          }} />
      ))}

      {/* Sparkle particles */}
      {PARTICLE_DIRS.map((d, i) => (
        <div key={i} className="absolute left-1/2 top-1/2 w-2.5 h-2.5 rounded-full opacity-0"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`,
            animation: `pbSparkle 1s ease-out ${0.3 + i * 0.04}s forwards`,
            ["--px" as string]: d.x,
            ["--py" as string]: d.y,
          } as React.CSSProperties} />
      ))}

      {/* Main card */}
      <div className="relative w-full max-w-sm mx-4 opacity-0"
        style={{ animation: "pbCardIn 0.7s ease-out 0.2s forwards" }}>
        <div className="relative overflow-hidden rounded-3xl"
          style={{ border: `2px solid ${color}50`, boxShadow: `0 0 80px ${color}30, inset 0 0 60px ${color}08` }}>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c0618] via-[#0c0618]/98 to-[#0c0618]" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${color}10 0%, transparent 40%, ${color}05 100%)` }} />

          <div className="relative px-8 py-12 text-center">
            {/* Trophy icon */}
            <div className="text-6xl mb-4 opacity-0" style={{ animation: "pbBounce 0.5s ease-out 0.5s forwards" }}>🏆</div>

            {/* Title */}
            <h2 className="text-2xl font-black tracking-wider mb-1 opacity-0"
              style={{ color, animation: "pbSlideUp 0.5s ease-out 0.6s forwards", textShadow: `0 0 30px ${color}40` }}>
              NEW BEST TIME
            </h2>

            {/* Event name */}
            <p className="text-white/60 text-sm font-mono tracking-widest mb-6 opacity-0"
              style={{ animation: "pbSlideUp 0.4s ease-out 0.7s forwards" }}>
              {notification.event}
            </p>

            {/* Time comparison */}
            <div className="flex items-center justify-center gap-4 mb-6 opacity-0"
              style={{ animation: "pbSlideUp 0.5s ease-out 0.8s forwards" }}>
              {/* Old time */}
              <div className="text-center">
                <span className="text-white/40 text-xs block mb-1">PREVIOUS</span>
                <span className="text-white/50 font-mono text-lg line-through">{notification.oldTime}</span>
              </div>
              {/* Arrow */}
              <div className="text-2xl" style={{ color }}>→</div>
              {/* New time */}
              <div className="text-center">
                <span className="text-xs block mb-1" style={{ color: color + "80" }}>NEW</span>
                <span className="font-mono text-2xl font-black" style={{ color }}>{notification.newTime}</span>
              </div>
            </div>

            {/* Time dropped */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 opacity-0"
              style={{
                background: `${color}15`,
                border: `1px solid ${color}30`,
                animation: "pbSlideUp 0.4s ease-out 0.9s forwards",
              }}>
              <span className="text-lg font-mono font-bold" style={{ color }}>
                {notification.timeDrop}s
              </span>
              <span className="text-white/60 text-sm">TIME DROP</span>
            </div>

            {/* XP earned */}
            <div className="opacity-0" style={{ animation: "pbSlideUp 0.4s ease-out 1s forwards" }}>
              <span className="text-3xl font-black" style={{ color }}>+{notification.xpEarned} XP</span>
            </div>

            {/* Meet name */}
            {notification.meetName && (
              <p className="text-white/30 text-xs mt-4 opacity-0"
                style={{ animation: "pbSlideUp 0.3s ease-out 1.1s forwards" }}>
                {notification.meetName}
              </p>
            )}

            {/* Tap to dismiss */}
            <p className="text-white/20 text-xs mt-6 opacity-0"
              style={{ animation: "pbSlideUp 0.3s ease-out 1.2s forwards" }}>
              Tap anywhere to continue
            </p>
          </div>
        </div>
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes pbEnter { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pbExit { from { opacity: 1; } to { opacity: 0; } }
        @keyframes pbRing {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        @keyframes pbSparkle {
          0% { transform: translate(0, 0) scale(0); opacity: 1; }
          100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
        }
        @keyframes pbCardIn {
          0% { transform: scale(0.8) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes pbBounce {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pbSlideUp {
          0% { transform: translateY(15px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
