"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  loginWithPin,
  loginCoach,
  loginParent,
  getSession,
  getRedirectForRole,
  registerCoach,
  registerParent,
  type AuthRole,
} from "../auth";

/* ══════════════════════════════════════════════════════════════
   METTLE — Login Page (Living Experience v1)

   Psychology-driven boot sequence:
   - Biophilia: Canvas particles mimic fireflies/underwater light
   - Heartbeat sync: Button pulses at 72 BPM (calm trust)
   - Progressive reveal: Elements stagger in, world "loads"
   - Warmth gradient: Cool cyan → warm gold progression
   - Competence signaling: Mission control aesthetic
   ══════════════════════════════════════════════════════════════ */

// ── SVG Icons ───────────────────────────────────────────────

const SvgShield = ({ size = 48, color = "#00f0ff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l8 4v5c0 5.5-3.8 10-8 11.5C7.8 21 4 16.5 4 11V6l8-4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={`${color}10`} />
    <rect x="9" y="11" width="6" height="5" rx="1" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <path d="M10 11v-2a2 2 0 014 0v2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SvgCoach = ({ size = 28, color = "#00f0ff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill={`${color}05`} />
    <path d="M15 3l2 2-2 2" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 5h4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SvgParent = ({ size = 28, color = "#f59e0b" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill={`${color}05`} />
    <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.3" fill={`${color}08`} />
    <path d="M14 19c0-2.21 1.343-4 3-4s3 1.79 3 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SvgKey = ({ size = 28, color = "#a855f7" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="15" r="5" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <circle cx="8" cy="15" r="2" stroke={color} strokeWidth="1" fill={`${color}20`} />
    <path d="M12 11l7-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M17 4l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15 6l2 2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SvgMail = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}08`} />
    <path d="M3 7l9 6 9-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgLock = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}08`} />
    <path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1.5" fill={color} />
  </svg>
);

const SvgHash = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 3L8 21M16 3l-2 18M3 8h18M3 16h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SvgArrowLeft = ({ size = 16, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 12H5M12 5l-7 7 7 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgUserPlus = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="8" r="4" stroke={color} strokeWidth="1.5" fill={`${color}08`} />
    <path d="M3 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M20 8v6M17 11h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Types ───────────────────────────────────────────────────

type LoginMode = "select" | "coach" | "parent" | "admin" | "register-coach" | "register-parent";

// ── Boot Sequence Canvas ────────────────────────────────────
// Particles emerge from center, scatter outward like a world loading.
// After boot, they settle into ambient drift.

interface BootParticle {
  x: number; y: number; tx: number; ty: number;
  vx: number; vy: number; size: number; alpha: number;
  alphaTarget: number; phase: number; hue: number;
  born: number;
}

const BootCanvas = ({ phase }: { phase: "boot" | "ambient" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<BootParticle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
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

    // Create particles — all start at center during boot
    const count = 80;
    particlesRef.current = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = Math.random() * Math.max(canvas.width, canvas.height) * 0.6;
      const hue = Math.random() > 0.6 ? 45 : (Math.random() > 0.5 ? 190 : 270); // gold, cyan, purple
      return {
        x: cx, y: cy,
        tx: cx + Math.cos(angle) * dist,
        ty: cy + Math.sin(angle) * dist,
        vx: 0, vy: 0,
        size: Math.random() * 2.5 + 0.8,
        alpha: 0,
        alphaTarget: Math.random() * 0.35 + 0.05,
        phase: Math.random() * Math.PI * 2,
        hue,
        born: Date.now() + Math.random() * 800, // stagger birth
      };
    });

    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    window.addEventListener("mousemove", onMouse);

    let t = 0;

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.008;
      const now = Date.now();
      const elapsed = (now - startTime.current) / 1000;

      for (const p of particlesRef.current) {
        if (now < p.born) continue; // not born yet — stagger effect

        // During boot: fly outward from center
        // After boot: gentle ambient drift
        if (phase === "boot" && elapsed < 2.5) {
          const progress = Math.min(1, (now - p.born) / 1500);
          const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          p.x = cx + (p.tx - cx) * ease;
          p.y = cy + (p.ty - cy) * ease;
          p.alpha = p.alphaTarget * ease;
        } else {
          // Ambient drift — organic sine/cosine motion
          const driftX = Math.sin(t + p.phase) * 0.2;
          const driftY = Math.cos(t * 0.7 + p.phase) * 0.15;
          p.x += driftX;
          p.y += driftY;

          // Breathing alpha
          p.alpha = p.alphaTarget * (0.6 + 0.4 * Math.sin(t * 0.5 + p.phase));

          // Wrap edges
          if (p.x < -20) p.x = canvas.width + 20;
          if (p.x > canvas.width + 20) p.x = -20;
          if (p.y < -20) p.y = canvas.height + 20;
          if (p.y > canvas.height + 20) p.y = -20;
        }

        // Mouse interaction — particles gently avoid cursor
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100 && dist > 0) {
          const force = (100 - dist) / 100 * 0.8;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }

        // Render particle
        const color = p.hue === 45
          ? `rgba(212,168,67,${p.alpha})`
          : p.hue === 190
            ? `rgba(0,240,255,${p.alpha})`
            : `rgba(168,85,247,${p.alpha})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Glow halo on larger particles
        if (p.size > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = p.hue === 45
            ? `rgba(212,168,67,${p.alpha * 0.12})`
            : p.hue === 190
              ? `rgba(0,240,255,${p.alpha * 0.12})`
              : `rgba(168,85,247,${p.alpha * 0.12})`;
          ctx.fill();
        }

        // Connecting lines between nearby particles (constellation effect)
        for (const q of particlesRef.current) {
          if (q === p || now < q.born) continue;
          const ddx = p.x - q.x;
          const ddy = p.y - q.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < 80) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(212,168,67,${0.03 * (1 - d / 80)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [phase]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
    />
  );
};

// ── Heartbeat Button ────────────────────────────────────────
// Pulses at ~72 BPM (833ms cycle) — syncs with human calm heart rate

const HeartbeatButton = ({
  onClick,
  disabled,
  loading,
  label,
  loadingLabel,
  accentColor,
  className = "",
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  label: string;
  loadingLabel: string;
  accentColor: string;
  className?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`relative w-full py-4 rounded-xl font-bold text-base tracking-wider uppercase transition-all active:scale-[0.97] min-h-[52px] border-2 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden ${className}`}
    style={{
      borderColor: `${accentColor}50`,
      color: accentColor,
      background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}08)`,
    }}
  >
    {/* Heartbeat glow — pulses behind the button */}
    {!loading && !disabled && (
      <span
        className="absolute inset-0 rounded-xl"
        style={{
          background: `radial-gradient(ellipse at center, ${accentColor}18, transparent 70%)`,
          animation: "heartbeat 1.667s ease-in-out infinite", // ~72 BPM (2 pulses per cycle = 833ms each)
        }}
      />
    )}
    <span className="relative z-10">
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span
            className="w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: `${accentColor}30`, borderTopColor: accentColor }}
          />
          {loadingLabel}
        </span>
      ) : label}
    </span>
  </button>
);

// ── Main Login Component ────────────────────────────────────

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [bootPhase, setBootPhase] = useState<"black" | "particles" | "logo" | "ready">("black");
  const [mode, setMode] = useState<LoginMode>("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Boot sequence timing ──────────────────────────────
  useEffect(() => {
    setMounted(true);

    // Nuclear cache clear — unregister stale service workers + purge all caches
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }

    // If already logged in, skip boot and redirect
    const session = getSession();
    if (session) {
      window.location.href = getRedirectForRole(session.role);
      return;
    }

    // Deep-link: ?role=coach|parent|admin skips the select screen
    const params = new URLSearchParams(window.location.search);
    const role = params.get("role");
    if (role === "coach") setMode("coach");
    else if (role === "parent") setMode("parent");
    else if (role === "admin") setMode("admin");

    // Boot sequence: black → particles emerge → logo fades in → UI ready
    const t1 = setTimeout(() => setBootPhase("particles"), 200);
    const t2 = setTimeout(() => setBootPhase("logo"), 1200);
    const t3 = setTimeout(() => setBootPhase("ready"), 2400);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const clearForm = () => {
    setEmail(""); setPassword(""); setCode(""); setPin(""); setName("");
    setError(""); setSuccess("");
  };

  const switchMode = (m: LoginMode) => { clearForm(); setMode(m); };

  // ── Handlers ────────────────────────────────────────────

  const handleCoachLogin = async () => {
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password.trim()) { setError("Password is required."); return; }
    setLoading(true);
    const result = await loginCoach(email.trim(), password);
    setLoading(false);
    if (result.success && result.session) {
      window.location.href = getRedirectForRole(result.session.role);
    } else {
      setError(result.error || "Login failed.");
    }
  };

  const handleParentLogin = () => {
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!code.trim()) { setError("Verification code is required."); return; }
    setLoading(true);
    setTimeout(() => {
      const result = loginParent(email.trim(), code.trim());
      setLoading(false);
      if (result.success && result.session) {
        window.location.href = getRedirectForRole(result.session.role);
      } else {
        setError(result.error || "Login failed.");
      }
    }, 400);
  };

  const handlePinLogin = async () => {
    setError("");
    if (!pin.trim()) { setError("PIN is required."); return; }
    setLoading(true);
    const result = await loginWithPin(pin.trim());
    setLoading(false);
    if (result.success && result.session) {
      window.location.href = getRedirectForRole(result.session.role);
    } else {
      setError(result.error || "Invalid PIN.");
    }
  };

  const handleCoachRegister = async () => {
    setError(""); setSuccess("");
    if (!name.trim()) { setError("Name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password.trim() || password.length < 4) { setError("Password must be at least 4 characters."); return; }
    const result = await registerCoach(email.trim(), password, name.trim());
    if (result.success) {
      setSuccess("Account created! You can now sign in.");
      setTimeout(() => switchMode("coach"), 1500);
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  const handleParentRegister = () => {
    setError(""); setSuccess("");
    if (!name.trim()) { setError("Name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (!code.trim() || code.length < 4) { setError("Enter the verification code from your coach."); return; }
    const result = registerParent(email.trim(), name.trim(), code.trim());
    if (result.success) {
      setSuccess("Account created! You can now sign in.");
      setTimeout(() => switchMode("parent"), 1500);
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  // ── Loading state (before hydration) ──────────────────
  if (!mounted) return (
    <div className="min-h-screen bg-[#030108]" />
  );

  // ── Shared UI helpers ─────────────────────────────────

  const inputClass = (hasError: boolean = false) =>
    `w-full px-4 py-4 lg:px-5 lg:py-5 bg-[#0a0518]/80 backdrop-blur-xl border-2 rounded-xl text-white text-base lg:text-lg placeholder:text-white/25 focus:outline-none transition-all duration-300 font-mono ${
      hasError
        ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        : "border-white/10 focus:border-[#C9A84C]/40 focus:shadow-[0_0_25px_rgba(201,168,76,0.12)]"
    }`;

  // ── Boot sequence rendering ───────────────────────────

  const showCanvas = bootPhase !== "black";
  const showLogo = bootPhase === "logo" || bootPhase === "ready";
  const showUI = bootPhase === "ready";

  return (
    <div className="min-h-screen bg-[#030108] relative overflow-hidden flex flex-col items-center justify-center px-5 py-8 lg:px-6 xl:px-8">

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes heartbeat {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          15% { opacity: 1; transform: scale(1.02); }
          30% { opacity: 0.4; transform: scale(1); }
          45% { opacity: 0.8; transform: scale(1.01); }
          60% { opacity: 0.3; transform: scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 30px rgba(201,168,76,0.2)); }
          50% { filter: drop-shadow(0 0 60px rgba(201,168,76,0.5)); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes typewriter {
          from { width: 0; }
          to { width: 100%; }
        }
        .boot-card {
          animation: fadeInUp 0.5s ease-out both;
        }
        .boot-card:nth-child(1) { animation-delay: 0ms; }
        .boot-card:nth-child(2) { animation-delay: 150ms; }
        .boot-card:nth-child(3) { animation-delay: 300ms; }
        .boot-card:nth-child(4) { animation-delay: 450ms; }
      `}</style>

      {/* Particle field — emerges from center during boot */}
      {showCanvas && (
        <BootCanvas phase={bootPhase === "ready" ? "ambient" : "boot"} />
      )}

      {/* Scanline effect during boot */}
      {bootPhase === "particles" && (
        <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden">
          <div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent"
            style={{ animation: "scanline 1.5s linear" }}
          />
        </div>
      )}

      {/* Ambient orbs — always present, subtle depth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[0]">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] lg:w-[900px] h-[600px] lg:h-[900px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.04)_0%,transparent_60%)]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[500px] lg:w-[800px] h-[500px] lg:h-[800px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.03)_0%,transparent_60%)]" />
        <div className="absolute top-[60%] right-[-10%] w-[400px] lg:w-[600px] h-[400px] lg:h-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.015)_0%,transparent_60%)]" />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 w-full max-w-sm lg:max-w-none lg:min-h-[600px] lg:mx-auto lg:grid lg:grid-cols-2 lg:items-center lg:gap-8 xl:gap-12 lg:px-8 xl:px-16 2xl:px-24">

        {/* ── Desktop branding panel (hidden on mobile) ── */}
        <div className="hidden lg:flex flex-col items-center justify-center">
          {showLogo && (
            <div style={{ animation: "scaleIn 0.8s ease-out both" }}>
              <img
                src="/mettle-brand/v5/mettle-icon.svg"
                alt="METTLE"
                className="w-40 h-40 xl:w-48 xl:h-48 mb-8"
                style={{ animation: "glowPulse 3s ease-in-out infinite" }}
              />
            </div>
          )}
          {showUI && (
            <>
              <h1
                className="text-5xl xl:text-6xl 2xl:text-7xl font-black tracking-tight text-white mb-4"
                style={{ animation: "fadeIn 0.6s ease-out both", animationDelay: "200ms" }}
              >
                METTLE
              </h1>
              <p
                className="text-xl xl:text-2xl text-white/25 text-center max-w-md"
                style={{ animation: "fadeIn 0.6s ease-out both", animationDelay: "400ms" }}
              >
                Unlocking the greatness already inside every athlete.
              </p>
              {/* System status line — competence signaling */}
              <div
                className="mt-6 flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase"
                style={{ animation: "fadeIn 0.6s ease-out both", animationDelay: "600ms" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400/50">Systems Online</span>
                <span className="text-white/10 mx-1">·</span>
                <span className="text-white/15">v5.0</span>
              </div>
            </>
          )}
        </div>

        {/* ── Form panel ── */}
        <div className="w-full max-w-sm mx-auto lg:max-w-lg xl:max-w-xl">

        {/* ── Role Selection Screen ── */}
        {mode === "select" && (
          <div className="text-center">
            {/* Logo + Title — mobile + boot animation */}
            {showLogo && (
              <div className="mb-8" style={{ animation: "scaleIn 0.6s ease-out both" }}>
                <div className="flex justify-center mb-4">
                  <img
                    src="/mettle-brand/v5/mettle-icon.svg"
                    alt="METTLE"
                    className="w-14 h-14 lg:w-20 lg:h-20"
                    style={{ animation: "glowPulse 3s ease-in-out infinite" }}
                  />
                </div>
                <div
                  className="text-[10px] tracking-[0.5em] uppercase font-mono mb-2"
                  style={{ color: "rgba(201,168,76,0.5)" }}
                >
                  INITIALIZING SECURE CONNECTION
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-2 lg:hidden">
                  METTLE
                </h1>
                <p className="text-white/20 text-sm font-mono">Select your access level to continue</p>
              </div>
            )}

            {/* Role Cards — staggered entrance */}
            {showUI && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => switchMode("coach")}
                  className="boot-card group relative w-full text-left p-5 rounded-2xl border-2 border-[#00f0ff]/15 bg-[#06020f]/70 backdrop-blur-xl hover:border-[#00f0ff]/40 hover:bg-[#0a0418]/90 transition-all duration-300 min-h-[72px] hover:shadow-[0_0_30px_rgba(0,240,255,0.08)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ background: "rgba(0,240,255,0.08)", border: "2px solid rgba(0,240,255,0.2)" }}>
                      <SvgCoach size={28} color="#00f0ff" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-base">Coach Login</div>
                      <div className="text-white/30 text-sm">Email + password</div>
                    </div>
                    <div className="text-[#00f0ff]/30 group-hover:text-[#00f0ff]/60 group-hover:translate-x-1 transition-all text-lg font-mono shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => switchMode("parent")}
                  className="boot-card group relative w-full text-left p-5 rounded-2xl border-2 border-[#f59e0b]/15 bg-[#06020f]/70 backdrop-blur-xl hover:border-[#f59e0b]/40 hover:bg-[#0a0418]/90 transition-all duration-300 min-h-[72px] hover:shadow-[0_0_30px_rgba(245,158,11,0.08)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ background: "rgba(245,158,11,0.08)", border: "2px solid rgba(245,158,11,0.2)" }}>
                      <SvgParent size={28} color="#f59e0b" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-base">Parent Login</div>
                      <div className="text-white/30 text-sm">Email + verification code</div>
                    </div>
                    <div className="text-[#f59e0b]/30 group-hover:text-[#f59e0b]/60 group-hover:translate-x-1 transition-all text-lg font-mono shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => switchMode("admin")}
                  className="boot-card group relative w-full text-left p-5 rounded-2xl border-2 border-[#00f0ff]/15 bg-[#06020f]/70 backdrop-blur-xl hover:border-[#00f0ff]/40 hover:bg-[#0a0418]/90 transition-all duration-300 min-h-[72px] hover:shadow-[0_0_30px_rgba(0,240,255,0.08)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ background: "rgba(0,240,255,0.08)", border: "2px solid rgba(0,240,255,0.2)" }}>
                      <SvgKey size={28} color="#00f0ff" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-base">Athlete Login</div>
                      <div className="text-white/30 text-sm">6-Digit Access PIN</div>
                    </div>
                    <div className="text-[#00f0ff]/30 group-hover:text-[#00f0ff]/60 group-hover:translate-x-1 transition-all text-lg font-mono shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => switchMode("admin")}
                  className="boot-card group relative w-full text-left p-5 rounded-2xl border-2 border-[#a855f7]/15 bg-[#06020f]/70 backdrop-blur-xl hover:border-[#a855f7]/40 hover:bg-[#0a0418]/90 transition-all duration-300 min-h-[72px] hover:shadow-[0_0_30px_rgba(168,85,247,0.08)] opacity-70"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ background: "rgba(168,85,247,0.08)", border: "2px solid rgba(168,85,247,0.2)" }}>
                      <SvgKey size={28} color="#a855f7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-base">Admin Access</div>
                      <div className="text-white/30 text-sm">Master PIN</div>
                    </div>
                    <div className="text-[#a855f7]/30 group-hover:text-[#a855f7]/60 group-hover:translate-x-1 transition-all text-lg font-mono shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Portal selector link */}
            {showUI && (
              <Link
                href="/apex-athlete/portal"
                className="inline-flex items-center gap-2 text-white/20 text-sm hover:text-white/40 transition-colors mt-8 min-h-[44px]"
                style={{ animation: "fadeIn 0.5s ease-out both", animationDelay: "600ms" }}
              >
                <SvgArrowLeft size={14} color="currentColor" />
                <span>Back to Portal Selector</span>
              </Link>
            )}
          </div>
        )}

        {/* ── Coach Login ── */}
        {mode === "coach" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out both" }}>
            <button onClick={() => switchMode("select")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgCoach size={40} color="#00f0ff" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Coach Sign In</h2>
              <p className="text-white/30 text-sm font-mono">Enter your credentials to access the coach portal</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgMail size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleCoachLogin()}
                  placeholder="coach@email.com"
                  autoComplete="email"
                  className={`${inputClass(!!error)} pl-11`}
                  autoFocus
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgLock size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleCoachLogin()}
                  placeholder="Password"
                  autoComplete="current-password"
                  className={`${inputClass(!!error)} pl-11`}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border-2 border-red-500/20 text-red-400 text-sm font-mono" style={{ animation: "fadeIn 0.3s ease-out" }}>
                  {error}
                </div>
              )}

              <HeartbeatButton
                onClick={handleCoachLogin}
                disabled={loading}
                loading={loading}
                label="Sign In"
                loadingLabel="Authenticating..."
                accentColor="#00f0ff"
              />

              <div className="flex items-center justify-between mt-1">
                <button onClick={() => switchMode("register-coach")} className="flex items-center gap-1.5 text-[#00f0ff]/40 text-sm hover:text-[#00f0ff]/70 transition-colors min-h-[44px]">
                  <SvgUserPlus size={14} color="currentColor" />
                  <span>Create Account</span>
                </button>
                <button className="text-white/20 text-sm hover:text-white/40 transition-colors min-h-[44px] cursor-default" title="Contact your administrator to reset your password">
                  Forgot Password?
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Parent Login ── */}
        {mode === "parent" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out both" }}>
            <button onClick={() => switchMode("select")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgParent size={40} color="#f59e0b" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Parent Sign In</h2>
              <p className="text-white/30 text-sm font-mono">Use the verification code from your enrollment email</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgMail size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleParentLogin()}
                  placeholder="parent@email.com"
                  autoComplete="email"
                  className={`${inputClass(!!error)} pl-11`}
                  autoFocus
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgHash size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleParentLogin()}
                  placeholder="6-digit verification code"
                  className={`${inputClass(!!error)} pl-11 tracking-[0.3em]`}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border-2 border-red-500/20 text-red-400 text-sm font-mono" style={{ animation: "fadeIn 0.3s ease-out" }}>
                  {error}
                </div>
              )}

              <HeartbeatButton
                onClick={handleParentLogin}
                disabled={loading}
                loading={loading}
                label="Verify & Enter"
                loadingLabel="Verifying..."
                accentColor="#f59e0b"
              />

              <div className="flex items-center justify-between mt-1">
                <button onClick={() => switchMode("register-parent")} className="flex items-center gap-1.5 text-[#f59e0b]/40 text-sm hover:text-[#f59e0b]/70 transition-colors min-h-[44px]">
                  <SvgUserPlus size={14} color="currentColor" />
                  <span>Register Account</span>
                </button>
                <button className="text-white/20 text-sm hover:text-white/40 transition-colors min-h-[44px] cursor-default" title="Contact your coach for a new verification code">
                  Forgot Code?
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Admin PIN Login ── */}
        {mode === "admin" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out both" }}>
            <button onClick={() => switchMode("select")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgKey size={40} color="#a855f7" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Enter PIN</h2>
              <p className="text-white/30 text-sm font-mono">Enter your access PIN to continue</p>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handlePinLogin()}
                placeholder="_ _ _ _"
                className={`${inputClass(!!error)} text-center text-2xl tracking-[0.5em]`}
                autoFocus
              />

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border-2 border-red-500/20 text-red-400 text-sm font-mono" style={{ animation: "fadeIn 0.3s ease-out" }}>
                  {error}
                </div>
              )}

              <HeartbeatButton
                onClick={handlePinLogin}
                disabled={loading}
                loading={loading}
                label="Authenticate"
                loadingLabel="Authenticating..."
                accentColor="#a855f7"
              />
            </div>
          </div>
        )}

        {/* ── Coach Registration ── */}
        {mode === "register-coach" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out both" }}>
            <button onClick={() => switchMode("coach")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back to Sign In</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgUserPlus size={36} color="#00f0ff" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Create Coach Account</h2>
              <p className="text-white/30 text-sm font-mono">Set up your coaching credentials</p>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(""); }}
                placeholder="Full name"
                autoComplete="name"
                className={inputClass(!!error)}
                autoFocus
              />
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgMail size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="coach@email.com"
                  autoComplete="email"
                  className={`${inputClass(!!error)} pl-11`}
                />
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgLock size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="Create a password (4+ characters)"
                  autoComplete="new-password"
                  className={`${inputClass(!!error)} pl-11`}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border-2 border-red-500/20 text-red-400 text-sm font-mono" style={{ animation: "fadeIn 0.3s ease-out" }}>
                  {error}
                </div>
              )}
              {success && (
                <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 text-sm font-mono" style={{ animation: "fadeIn 0.3s ease-out" }}>
                  {success}
                </div>
              )}

              <HeartbeatButton
                onClick={handleCoachRegister}
                disabled={loading}
                loading={loading}
                label="Create Account"
                loadingLabel="Creating..."
                accentColor="#00f0ff"
              />
            </div>
          </div>
        )}

        {/* ── Parent Registration ── */}
        {mode === "register-parent" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out both" }}>
            <button onClick={() => switchMode("parent")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back to Sign In</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgUserPlus size={36} color="#f59e0b" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Register Parent Account</h2>
              <p className="text-white/30 text-sm font-mono">Use the code provided by your coach</p>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(""); }}
                placeholder="Full name"
                autoComplete="name"
                className={inputClass(!!error)}
                autoFocus
              />
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgMail size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="parent@email.com"
                  autoComplete="email"
                  className={`${inputClass(!!error)} pl-11`}
                />
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgHash size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  placeholder="6-digit verification code"
                  className={`${inputClass(!!error)} pl-11 tracking-[0.3em]`}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border-2 border-red-500/20 text-red-400 text-sm font-mono" style={{ animation: "fadeIn 0.3s ease-out" }}>
                  {error}
                </div>
              )}
              {success && (
                <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 text-sm font-mono" style={{ animation: "fadeIn 0.3s ease-out" }}>
                  {success}
                </div>
              )}

              <HeartbeatButton
                onClick={handleParentRegister}
                disabled={loading}
                loading={loading}
                label="Register"
                loadingLabel="Registering..."
                accentColor="#f59e0b"
              />
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {showUI && (
          <div className="text-center mt-10" style={{ animation: "fadeIn 0.5s ease-out both", animationDelay: "500ms" }}>
            <p className="text-white/[0.06] text-[10px] font-mono tracking-wider">
              METTLE · Athlete Relations Manager · v5.0
            </p>
          </div>
        )}
        </div>{/* close form panel */}
      </div>
    </div>
  );
}
