"use client";

import { useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   MICRO-CELEBRATION — Dopamine hits on achievements

   Psychology: Variable ratio reinforcement + immediate feedback.
   Particle burst on XP gain, confetti shower on level-up,
   streak sparks on milestones. Every achievement FEELS earned.
   ══════════════════════════════════════════════════════════════ */

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  size: number; alpha: number;
  color: string; life: number;
  maxLife: number; gravity: number;
  rotation: number; rotSpeed: number;
  shape: "circle" | "star" | "rect";
}

type CelebrationType = "xp" | "levelup" | "streak" | "checkpoint" | "achievement";

const PALETTES: Record<CelebrationType, string[]> = {
  xp: ["#D4A843", "#E8C97A", "#FFD700", "#FBBF24"],
  levelup: ["#A78BFA", "#7C3AED", "#D4A843", "#FFD700", "#EF4444", "#60A5FA"],
  streak: ["#F97316", "#FBBF24", "#EF4444", "#FFD700"],
  checkpoint: ["#34D399", "#10B981", "#D4A843"],
  achievement: ["#A78BFA", "#C084FC", "#D4A843", "#FFD700", "#F472B6"],
};

const COUNTS: Record<CelebrationType, number> = {
  xp: 12,
  levelup: 60,
  streak: 25,
  checkpoint: 8,
  achievement: 40,
};

export function useCelebration() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<Spark[]>([]);
  const animRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9998;";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.remove();
    };
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    sparksRef.current = sparksRef.current.filter(s => {
      s.life++;
      const progress = s.life / s.maxLife;
      if (progress >= 1) return false;

      s.vy += s.gravity;
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.98;
      s.rotation += s.rotSpeed;
      s.alpha = 1 - Math.pow(progress, 0.6);

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;

      if (s.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, s.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.shape === "star") {
        drawStar(ctx, 0, 0, s.size);
      } else {
        ctx.fillRect(-s.size, -s.size * 0.4, s.size * 2, s.size * 0.8);
      }

      // Glow
      ctx.globalAlpha = s.alpha * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, s.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();

      ctx.restore();
      return true;
    });

    if (sparksRef.current.length > 0) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      activeRef.current = false;
    }
  }, []);

  const celebrate = useCallback((type: CelebrationType, originX?: number, originY?: number) => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cx = originX ?? window.innerWidth / 2;
    const cy = originY ?? window.innerHeight / 2;
    const palette = PALETTES[type];
    const count = COUNTS[type];
    const shapes: Spark["shape"][] = type === "levelup" || type === "achievement"
      ? ["circle", "star", "rect"]
      : ["circle", "star"];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = type === "levelup" ? 4 + Math.random() * 8 : 2 + Math.random() * 5;

      sparksRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (type === "levelup" ? 3 : 1),
        size: 1.5 + Math.random() * 3,
        alpha: 1,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 0,
        maxLife: 40 + Math.random() * 30,
        gravity: type === "levelup" ? 0.12 : 0.08,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }

    // Haptic feedback on mobile
    if (navigator.vibrate) {
      if (type === "levelup") navigator.vibrate([50, 30, 80, 30, 50]);
      else if (type === "streak") navigator.vibrate([30, 20, 40]);
      else navigator.vibrate(15);
    }

    if (!activeRef.current) {
      activeRef.current = true;
      animRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  return { celebrate };
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const outerX = x + Math.cos(angle) * r;
    const outerY = y + Math.sin(angle) * r;
    const innerAngle = angle + Math.PI / 5;
    const innerX = x + Math.cos(innerAngle) * r * 0.4;
    const innerY = y + Math.sin(innerAngle) * r * 0.4;
    if (i === 0) ctx.moveTo(outerX, outerY);
    else ctx.lineTo(outerX, outerY);
    ctx.lineTo(innerX, innerY);
  }
  ctx.closePath();
  ctx.fill();
}
