"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   GAME BOOT SCREEN — Cinematic Loading Experience

   Psychology hooks:
   1. Progressive disclosure (Zeigarnik): boot phases create open loops
   2. Heartbeat entrainment: shield pulse at 72 BPM syncs nervous system
   3. Spatial presence: particles create depth = brain treats screen as place
   4. Dopamine anticipation: progress bar builds reward expectation
   5. Biophilia: organic particle motion = "alive" response
   6. Flow state: each phase slightly more complex than the last
   ══════════════════════════════════════════════════════════════ */

// ── Boot particle system ────────────────────────────────────

interface BootParticle {
  x: number; y: number;
  tx: number; ty: number;
  size: number; alpha: number;
  speed: number; phase: number;
  hue: "gold" | "cyan" | "purple" | "scarlet";
  layer: number; // 0=far, 1=mid, 2=near — depth layers
  born: number;
}

const HUES = {
  gold: [212, 168, 67],
  cyan: [0, 240, 255],
  purple: [168, 85, 247],
  scarlet: [239, 68, 68],
} as const;

// ── Main component ──────────────────────────────────────────

interface GameBootProps {
  onComplete: () => void;
  brandColor?: string;
  logoSrc?: string;
  title?: string;
  subtitle?: string;
}

type Phase = "void" | "ignition" | "particles" | "logo" | "title" | "ready" | "done";

export default function GameBootScreen({
  onComplete,
  brandColor = "#D4A843",
  logoSrc = "/mettle-brand/v5/mettle-icon.svg",
  title = "METTLE",
  subtitle = "Forged in fire. Proven in practice.",
}: GameBootProps) {
  const [phase, setPhase] = useState<Phase>("void");
  const [progress, setProgress] = useState(0);
  const [skipVisible, setSkipVisible] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<BootParticle[]>([]);
  const animRef = useRef(0);
  const startTime = useRef(0);
  const completed = useRef(false);
  const gyro = useRef({ x: 0, y: 0 }); // device tilt for proprioceptive response

  // Check reduced motion preference
  const prefersReduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setPhase("done");
    cancelAnimationFrame(animRef.current);
    setTimeout(onComplete, 400);
  }, [onComplete]);

  // ── Phase timing ─────────────────────────────────────────
  useEffect(() => {
    if (prefersReduced) { finish(); return; }

    // Check if user has seen boot before in this session
    const seen = sessionStorage.getItem("mettle_boot_seen");
    if (seen) { finish(); return; }

    startTime.current = Date.now();

    // Narrative boot lines — typed sequentially like a game world initializing
    const BOOT_NARRATIVE = [
      "Syncing athlete data...",
      "Calibrating level engine...",
      "Loading arena systems...",
      "Establishing secure connection...",
      "Arena ready.",
    ];

    const timers = [
      setTimeout(() => setPhase("ignition"), 300),
      setTimeout(() => setPhase("particles"), 800),
      setTimeout(() => setPhase("logo"), 2000),
      setTimeout(() => setPhase("title"), 3200),
      setTimeout(() => setPhase("ready"), 4500),
      setTimeout(() => setSkipVisible(true), 1500),
      // Narrative lines appear during boot — staggered typewriter
      ...BOOT_NARRATIVE.map((line, i) =>
        setTimeout(() => setBootLines(prev => [...prev, line]), 600 + i * 700)
      ),
    ];

    // Haptic rhythm — subtle heartbeat vibration during boot (72 BPM = 833ms)
    const hapticTimer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }, 4500);
    const hapticInterval = setInterval(() => {
      if (navigator.vibrate && !completed.current) navigator.vibrate([15, 80, 15]);
    }, 833);

    // Gyroscope — particles respond to phone tilt (proprioceptive connection)
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      gyro.current.x = (e.gamma || 0) * 0.5; // left-right tilt
      gyro.current.y = (e.beta || 0) * 0.3;  // front-back tilt
    };
    window.addEventListener("deviceorientation", onDeviceOrientation);

    // Progress bar: 0 → 100 over 4.5s
    const progInterval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const pct = Math.min(100, (elapsed / 4500) * 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(progInterval);
    }, 30);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(hapticTimer);
      clearInterval(hapticInterval);
      clearInterval(progInterval);
      window.removeEventListener("deviceorientation", onDeviceOrientation);
    };
  }, [prefersReduced, finish]);

  // ── Canvas particle system ───────────────────────────────
  useEffect(() => {
    if (phase === "void" || phase === "done" || prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const count = window.innerWidth < 768 ? 50 : 120;
    const hueKeys: BootParticle["hue"][] = ["gold", "cyan", "purple", "scarlet"];

    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 60 + Math.random() * Math.max(canvas.width, canvas.height) * 0.5;
        const layer = Math.random() < 0.3 ? 0 : Math.random() < 0.6 ? 1 : 2;
        return {
          x: cx, y: cy,
          tx: cx + Math.cos(angle) * dist,
          ty: cy + Math.sin(angle) * dist,
          size: layer === 0 ? 0.5 + Math.random() : layer === 1 ? 1 + Math.random() * 1.5 : 2 + Math.random() * 2,
          alpha: 0,
          speed: [0.15, 0.25, 0.4][layer],
          phase: Math.random() * Math.PI * 2,
          hue: hueKeys[Math.floor(Math.random() * (Math.random() > 0.5 ? 2 : 4))], // bias toward gold/cyan
          layer,
          born: Date.now() + Math.random() * 600,
        };
      });
    }

    let t = 0;

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.006;
      const now = Date.now();
      const elapsed = (now - startTime.current) / 1000;

      for (const p of particlesRef.current) {
        if (now < p.born) continue;

        // Phase-dependent behavior
        if (elapsed < 2.5) {
          // SCATTER: particles fly outward from center
          const progress = Math.min(1, (now - p.born) / 1200);
          const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart — fast start, gentle land
          p.x = cx + (p.tx - cx) * ease;
          p.y = cy + (p.ty - cy) * ease;
          p.alpha = Math.min(0.6, ease * 0.6);
        } else {
          // AMBIENT: organic drift with depth-based speed + gyroscope response
          const gyroScale = [0.1, 0.3, 0.6][p.layer]; // near particles react more
          const driftX = Math.sin(t * p.speed + p.phase) * (0.2 + p.layer * 0.1) + gyro.current.x * gyroScale * 0.02;
          const driftY = Math.cos(t * 0.7 * p.speed + p.phase) * (0.15 + p.layer * 0.08) + gyro.current.y * gyroScale * 0.02;
          p.x += driftX;
          p.y += driftY;

          // Breathing alpha — different rates per layer (depth illusion)
          p.alpha = (0.1 + p.layer * 0.15) * (0.5 + 0.5 * Math.sin(t * 0.4 + p.phase));

          // Wrap edges
          if (p.x < -20) p.x = canvas.width + 20;
          if (p.x > canvas.width + 20) p.x = -20;
          if (p.y < -20) p.y = canvas.height + 20;
          if (p.y > canvas.height + 20) p.y = -20;
        }

        // Render
        const [r, g, b] = HUES[p.hue];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`;
        ctx.fill();

        // Glow halo on near-layer particles
        if (p.layer >= 1 && p.size > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha * 0.1})`;
          ctx.fill();
        }

        // Constellation lines — only between same-hue nearby particles
        if (p.layer >= 1) {
          for (const q of particlesRef.current) {
            if (q === p || now < q.born || q.hue !== p.hue) continue;
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 100) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.strokeStyle = `rgba(${r},${g},${b},${0.04 * (1 - d / 100)})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      // Center ignition flash — brief bright core during scatter
      if (elapsed < 1.5 && elapsed > 0.3) {
        const flash = Math.max(0, 1 - (elapsed - 0.3) / 1.2);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
        grad.addColorStop(0, `rgba(212,168,67,${flash * 0.3})`);
        grad.addColorStop(0.5, `rgba(0,240,255,${flash * 0.1})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(cx - 120, cy - 120, 240, 240);
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [phase, prefersReduced]);

  // ── Skip / tap to enter ──────────────────────────────────
  const handleSkip = useCallback(() => {
    sessionStorage.setItem("mettle_boot_seen", "1");
    finish();
  }, [finish]);

  const handleEnter = useCallback(() => {
    if (phase === "ready") {
      sessionStorage.setItem("mettle_boot_seen", "1");
      finish();
    }
  }, [phase, finish]);

  if (phase === "done") return null;
  if (prefersReduced) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden cursor-pointer"
      style={{ background: "#030108" }}
      onClick={phase === "ready" ? handleEnter : undefined}
    >
      {/* ── Keyframes ── */}
      <style jsx>{`
        @keyframes shield-pulse {
          0%, 100% {
            filter: drop-shadow(0 0 20px ${brandColor}40) drop-shadow(0 0 60px ${brandColor}10);
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 40px ${brandColor}70) drop-shadow(0 0 100px ${brandColor}25);
            transform: scale(1.03);
          }
        }
        @keyframes breathing-bg {
          0%, 100% { background: #030108; }
          50% { background: #050210; }
        }
        @keyframes title-reveal {
          from {
            opacity: 0;
            letter-spacing: 0.8em;
            filter: blur(8px);
          }
          to {
            opacity: 1;
            letter-spacing: 0.35em;
            filter: blur(0);
          }
        }
        @keyframes subtitle-fade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 0.5; transform: translateY(0); }
        }
        @keyframes enter-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes progress-glow {
          0%, 100% { box-shadow: 0 0 8px ${brandColor}60; }
          50% { box-shadow: 0 0 20px ${brandColor}90, 0 0 40px ${brandColor}30; }
        }
        @keyframes aurora-sweep {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(200%) skewX(-15deg); }
        }
        @keyframes boot-line-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* Breathing background */}
      <div
        className="absolute inset-0"
        style={{ animation: "breathing-bg 4s ease-in-out infinite" }}
      />

      {/* Canvas — particle system */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* ── Center content ── */}
      <div className="relative z-10 flex flex-col items-center justify-center">

        {/* IGNITION: brief radial flash */}
        {phase === "ignition" && (
          <div
            className="absolute w-[200px] h-[200px] rounded-full"
            style={{
              background: `radial-gradient(circle, ${brandColor}30 0%, transparent 70%)`,
              animation: "shield-pulse 0.833s ease-in-out infinite",
            }}
          />
        )}

        {/* LOGO: materializes from particles */}
        {(phase === "logo" || phase === "title" || phase === "ready") && (
          <img
            src={logoSrc}
            alt={title}
            className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 mb-6 lg:mb-8"
            style={{
              animation: "shield-pulse 1.667s ease-in-out infinite", // 72 BPM (2 beats)
              opacity: phase === "logo" ? 0.8 : 1,
              transition: "opacity 0.5s ease",
            }}
          />
        )}

        {/* TITLE: letter-spaced reveal with blur-to-sharp */}
        {(phase === "title" || phase === "ready") && (
          <h1
            className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-[0.35em] uppercase mb-3"
            style={{
              color: brandColor,
              animation: "title-reveal 1s ease-out both",
              textShadow: `0 0 40px ${brandColor}40`,
            }}
          >
            {title}
          </h1>
        )}

        {/* SUBTITLE */}
        {(phase === "title" || phase === "ready") && (
          <p
            className="text-sm sm:text-base lg:text-lg tracking-[0.2em] uppercase font-light mb-12"
            style={{
              color: `${brandColor}80`,
              animation: "subtitle-fade 0.8s 0.3s ease-out both",
            }}
          >
            {subtitle}
          </p>
        )}

        {/* READY: "Press to Enter" — pulses at heartbeat rate with ring pulse */}
        {phase === "ready" && (
          <div className="relative flex items-center justify-center">
            {/* Expanding ring pulse — creates spatial "gateway" feel */}
            <span
              className="absolute w-[200px] h-[60px] sm:w-[280px] sm:h-[70px] rounded-2xl pointer-events-none"
              style={{
                border: `1px solid ${brandColor}20`,
                animation: "enter-pulse 1.667s ease-in-out infinite",
              }}
            />
            <button
              onClick={handleEnter}
              className="relative px-10 py-4 sm:px-16 sm:py-5 rounded-2xl border-2 font-bold text-sm sm:text-base tracking-[0.3em] uppercase transition-all hover:scale-105 active:scale-95"
              style={{
                borderColor: `${brandColor}50`,
                color: brandColor,
                background: `${brandColor}08`,
                animation: "enter-pulse 1.667s ease-in-out infinite",
              }}
            >
              Press to Enter
            </button>
          </div>
        )}
      </div>

      {/* ── Narrative boot lines — typewriter system checks ── */}
      {bootLines.length > 0 && phase !== "ready" && (
        <div className="absolute bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 w-[280px] sm:w-[400px]">
          <div className="flex flex-col gap-1">
            {bootLines.map((line, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[10px] sm:text-xs font-mono tracking-wider"
                style={{
                  color: i === bootLines.length - 1 ? `${brandColor}70` : `${brandColor}25`,
                  animation: "boot-line-in 0.3s ease-out both",
                }}
              >
                <span
                  className="w-1 h-1 rounded-full shrink-0"
                  style={{
                    background: line.includes("ready") || line.includes("Ready")
                      ? "#34d399"
                      : i === bootLines.length - 1
                        ? brandColor
                        : `${brandColor}40`,
                  }}
                />
                <span>{line}</span>
                {i === bootLines.length - 1 && !line.toLowerCase().includes("ready") && (
                  <span
                    className="w-[6px] h-[12px] inline-block"
                    style={{
                      background: `${brandColor}60`,
                      animation: "cursor-blink 0.8s step-end infinite",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Progress bar — bottom of screen ── */}
      {progress < 100 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[200px] sm:w-[300px]">
          <div
            className="h-[2px] rounded-full overflow-hidden"
            style={{ background: `${brandColor}15` }}
          >
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${brandColor}60, ${brandColor})`,
                animation: "progress-glow 1.5s ease-in-out infinite",
              }}
            />
          </div>
          <p className="text-center mt-2 text-[10px] sm:text-xs tracking-[0.3em] uppercase"
            style={{ color: `${brandColor}40` }}>
            {progress < 30 ? "Initializing..." : progress < 60 ? "Loading systems..." : progress < 90 ? "Preparing arena..." : "Ready"}
          </p>
        </div>
      )}

      {/* ── Skip button ── */}
      {skipVisible && phase !== "ready" && (
        <button
          onClick={handleSkip}
          className="absolute bottom-12 right-8 text-xs tracking-wider uppercase transition-opacity hover:opacity-80"
          style={{ color: `rgba(255,255,255,0.15)` }}
        >
          Skip &rarr;
        </button>
      )}

      {/* ── Aurora sweep on logo reveal ── */}
      {phase === "logo" && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ opacity: 0.15 }}
        >
          <div
            className="absolute top-0 left-0 w-[50%] h-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${brandColor}30, transparent)`,
              animation: "aurora-sweep 1.5s ease-out both",
            }}
          />
        </div>
      )}
    </div>
  );
}
