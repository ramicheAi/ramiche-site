"use client";

import { useState, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";

/* ══════════════════════════════════════════════════════════════
   XP FLOAT — Upward-floating XP numbers

   Psychology: Embodied Cognition + Variable Reward
   - Upward motion = positive emotion (brain associates up with good)
   - Size/color varies by amount (variable reward feel)
   - Fades out at top = completion without abruptness
   ══════════════════════════════════════════════════════════════ */

interface FloatingXP {
  id: number;
  amount: number;
  x: number;
  y: number;
  startTime: number;
}

const DURATION = 1800; // ms

export function useXPFloat() {
  const [floats, setFloats] = useState<FloatingXP[]>([]);
  const counter = useRef(0);

  const triggerXP = useCallback((amount: number, event?: ReactMouseEvent | { clientX: number; clientY: number }) => {
    const x = event ? event.clientX : window.innerWidth / 2;
    const y = event ? event.clientY : window.innerHeight / 2;

    const id = counter.current++;
    const newFloat: FloatingXP = { id, amount, x, y, startTime: Date.now() };

    setFloats(prev => [...prev, newFloat]);

    // Auto-cleanup
    setTimeout(() => {
      setFloats(prev => prev.filter(f => f.id !== id));
    }, DURATION + 100);
  }, []);

  return { floats, triggerXP };
}

export function XPFloatLayer({ floats }: { floats: FloatingXP[] }) {
  if (floats.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9990]">
      <style jsx>{`
        @keyframes xp-rise {
          0% {
            opacity: 1;
            transform: translateY(0) scale(0.5);
          }
          15% {
            opacity: 1;
            transform: translateY(-20px) scale(1.2);
          }
          30% {
            transform: translateY(-40px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-120px) scale(0.8);
          }
        }
      `}</style>
      {floats.map(f => {
        const isBig = f.amount >= 25;
        const isHuge = f.amount >= 50;
        return (
          <div
            key={f.id}
            className="absolute font-black font-mono"
            style={{
              left: f.x + (Math.random() - 0.5) * 40,
              top: f.y,
              fontSize: isHuge ? "28px" : isBig ? "22px" : "16px",
              color: isHuge ? "#FFD700" : isBig ? "#00f0ff" : "#C9A84C",
              textShadow: isHuge
                ? "0 0 20px rgba(255,215,0,0.8), 0 0 40px rgba(255,215,0,0.4)"
                : isBig
                ? "0 0 15px rgba(0,240,255,0.6), 0 0 30px rgba(0,240,255,0.3)"
                : "0 0 10px rgba(201,168,76,0.5)",
              animation: `xp-rise ${DURATION}ms ease-out forwards`,
              pointerEvents: "none",
            }}
          >
            +{f.amount} XP
          </div>
        );
      })}
    </div>
  );
}
