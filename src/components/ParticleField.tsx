"use client";

import { useEffect, useRef } from "react";

/**
 * ParticleField — Ambient floating particles for living UX.
 *
 * Canvas-based. Renders softly glowing particles that drift organically,
 * respond to mouse position, and draw faint constellation lines.
 *
 * Supports both dark and light backgrounds via `theme` prop.
 */

interface Props {
  count?: number;
  color?: [number, number, number];
  speed?: number;
  opacity?: number;
  variant?: "gold" | "cyan" | "white" | "purple" | "scarlet";
  interactive?: boolean;
  theme?: "dark" | "light";
  connections?: boolean;
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
  layer: number; // 0=far, 1=mid, 2=near — depth perception
}

const PRESETS: Record<string, [number, number, number]> = {
  gold: [212, 168, 67],
  cyan: [0, 200, 220],
  white: [180, 180, 200],
  purple: [140, 70, 220],
  scarlet: [210, 60, 60],
};

export default function ParticleField({
  count = 60,
  color,
  speed = 1,
  opacity = 0.4,
  variant = "gold",
  interactive = true,
  theme = "dark",
  connections = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse = useRef({ x: -1000, y: -1000 });
  const scroll = useRef(0);
  const gyro = useRef({ x: 0, y: 0 });
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseColor = color || PRESETS[variant] || PRESETS.gold;
    // Light backgrounds need lower opacity so particles are subtle, not distracting
    const maxAlpha = theme === "light" ? Math.min(opacity, 0.18) : opacity;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles with depth layers
    const mobileCount = window.innerWidth < 768 ? Math.floor(count * 0.6) : count;
    particles.current = Array.from({ length: mobileCount }, () => {
      const layer = Math.random() < 0.3 ? 0 : Math.random() < 0.6 ? 1 : 2;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3 * speed * [0.4, 0.7, 1][layer],
        vy: (Math.random() - 0.5) * 0.3 * speed * [0.4, 0.7, 1][layer],
        size: [0.5 + Math.random() * 0.5, 1 + Math.random(), 1.5 + Math.random() * 2][layer],
        alpha: Math.random() * maxAlpha * [0.4, 0.7, 1][layer],
        alphaDir: (Math.random() - 0.5) * 0.004,
        phase: Math.random() * Math.PI * 2,
        layer,
      };
    });

    // Mouse tracking — always active for spatial presence
    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    window.addEventListener("mousemove", onMouseMove);

    // Scroll tracking — parallax depth illusion
    const onScroll = () => { scroll.current = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Gyroscope — phone tilt moves particles (proprioceptive bond)
    const onGyro = (e: DeviceOrientationEvent) => {
      gyro.current.x = (e.gamma || 0) * 0.5;
      gyro.current.y = (e.beta || 0) * 0.3;
    };
    window.addEventListener("deviceorientation", onGyro);

    let time = 0;

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.008;

      const pts = particles.current;

      for (const p of pts) {
        // Organic drift — depth-scaled sine waves + gyroscope parallax
        const layerSpeed = [0.5, 0.8, 1.2][p.layer];
        const gyroScale = [0.1, 0.3, 0.6][p.layer];
        const driftX = Math.sin(time * layerSpeed + p.phase) * 0.15 + gyro.current.x * gyroScale * 0.015;
        const driftY = Math.cos(time * 0.7 * layerSpeed + p.phase) * 0.1 + gyro.current.y * gyroScale * 0.015;

        p.x += p.vx + driftX;
        p.y += p.vy + driftY;

        // Breathing alpha
        p.alpha += p.alphaDir;
        const layerMax = maxAlpha * [0.4, 0.7, 1][p.layer];
        if (p.alpha > layerMax) { p.alpha = layerMax; p.alphaDir = -Math.abs(p.alphaDir); }
        if (p.alpha < 0.01) { p.alpha = 0.01; p.alphaDir = Math.abs(p.alphaDir); }

        // Wrap edges
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        // Mouse interaction: particles gently move away
        if (interactive) {
          const dx = p.x - mouse.current.x;
          const dy = p.y - mouse.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 0) {
            const force = (150 - dist) / 150 * 0.3 * (p.layer + 1) * 0.3;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }

        // Scroll parallax — each layer scrolls at a different rate
        const scrollOffset = scroll.current * [0.02, 0.05, 0.1][p.layer];
        const drawY = ((p.y - scrollOffset) % (canvas.height + 20) + canvas.height + 20) % (canvas.height + 20) - 10;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, drawY, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor[0]},${baseColor[1]},${baseColor[2]},${p.alpha})`;
        ctx.fill();

        // Glow halo on mid/near particles
        if (p.layer >= 1 && p.size > 1.2) {
          ctx.beginPath();
          ctx.arc(p.x, drawY, p.size * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${baseColor[0]},${baseColor[1]},${baseColor[2]},${p.alpha * 0.08})`;
          ctx.fill();
        }
      }

      // Constellation lines — faint connections between nearby particles
      if (connections) {
        const sc = scroll.current;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (p.layer < 1) continue;
          const pyAdj = ((p.y - sc * [0.02, 0.05, 0.1][p.layer]) % (canvas.height + 20) + canvas.height + 20) % (canvas.height + 20) - 10;
          for (let j = i + 1; j < pts.length; j++) {
            const q = pts[j];
            if (q.layer < 1) continue;
            const qyAdj = ((q.y - sc * [0.02, 0.05, 0.1][q.layer]) % (canvas.height + 20) + canvas.height + 20) % (canvas.height + 20) - 10;
            const dx = p.x - q.x;
            const dy = pyAdj - qyAdj;
            const d = dx * dx + dy * dy;
            if (d < 12000) {
              const strength = 1 - Math.sqrt(d) / 110;
              ctx.beginPath();
              ctx.moveTo(p.x, pyAdj);
              ctx.lineTo(q.x, qyAdj);
              ctx.strokeStyle = `rgba(${baseColor[0]},${baseColor[1]},${baseColor[2]},${strength * 0.04})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("deviceorientation", onGyro);
    };
  }, [count, color, speed, opacity, variant, interactive, theme, connections]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{ mixBlendMode: theme === "light" ? "multiply" : "screen" }}
    />
  );
}
