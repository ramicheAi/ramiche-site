"use client";

import { useEffect, useRef } from "react";

/**
 * ParticleField — Ambient floating particles for living UX.
 *
 * Canvas-based for performance. Renders softly glowing particles
 * that drift and respond subtly to viewport scroll position.
 *
 * Props:
 *  - count: number of particles (default 60)
 *  - color: base color as [r,g,b] (default matches METTLE gold)
 *  - speed: drift speed multiplier (default 1)
 *  - opacity: max particle opacity 0-1 (default 0.4)
 *  - variant: "gold" | "cyan" | "white" — preset color schemes
 *  - interactive: respond to mouse position (default false)
 */

interface Props {
  count?: number;
  color?: [number, number, number];
  speed?: number;
  opacity?: number;
  variant?: "gold" | "cyan" | "white" | "purple";
  interactive?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  alphaDir: number;
  phase: number;
}

const PRESETS: Record<string, [number, number, number]> = {
  gold: [212, 168, 67],
  cyan: [0, 240, 255],
  white: [255, 255, 255],
  purple: [168, 85, 247],
};

export default function ParticleField({
  count = 60,
  color,
  speed = 1,
  opacity = 0.4,
  variant = "gold",
  interactive = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse = useRef({ x: -1000, y: -1000 });
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseColor = color || PRESETS[variant] || PRESETS.gold;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles
    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3 * speed,
      vy: (Math.random() - 0.5) * 0.3 * speed,
      size: Math.random() * 2.5 + 0.5,
      alpha: Math.random() * opacity,
      alphaDir: (Math.random() - 0.5) * 0.005,
      phase: Math.random() * Math.PI * 2,
    }));

    // Mouse tracking for interactive mode
    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    if (interactive) window.addEventListener("mousemove", onMouseMove);

    let time = 0;

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.01;

      for (const p of particles.current) {
        // Organic drift — sine wave overlay for non-linear motion
        const driftX = Math.sin(time + p.phase) * 0.15;
        const driftY = Math.cos(time * 0.7 + p.phase) * 0.1;

        p.x += p.vx + driftX;
        p.y += p.vy + driftY;

        // Breathing alpha — particles fade in and out like they're alive
        p.alpha += p.alphaDir;
        if (p.alpha > opacity) { p.alpha = opacity; p.alphaDir = -Math.abs(p.alphaDir); }
        if (p.alpha < 0.02) { p.alpha = 0.02; p.alphaDir = Math.abs(p.alphaDir); }

        // Wrap around edges
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        // Interactive: particles gently repel from mouse
        if (interactive) {
          const dx = p.x - mouse.current.x;
          const dy = p.y - mouse.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const force = (120 - dist) / 120 * 0.5;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${p.alpha})`;
        ctx.fill();

        // Subtle glow halo on larger particles
        if (p.size > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${p.alpha * 0.15})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      if (interactive) window.removeEventListener("mousemove", onMouseMove);
    };
  }, [count, color, speed, opacity, variant, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
