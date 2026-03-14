"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
/* ParticleField removed — replaced by OceanBackground */

/* ── Brand Colors (from Piranhas Open Water logo) ── */
/* Logo: dark navy swimmer, green-teal waves, golden-yellow piranha, red buoy */
const C = {
  navy: "#0a1e3d",       /* dark navy — swimmer silhouette */
  navyLight: "#153060",
  teal: "#1a7a6d",       /* green-teal — ocean waves */
  tealLight: "#28a68e",
  tealMid: "#1f8f7e",
  green: "#2e8b57",      /* sea green — wave accent */
  red: "#d42b2b",        /* red — buoy / urgency */
  redLight: "#e74c3c",
  gold: "#e8b800",       /* golden-yellow — piranha body */
  goldDim: "#c99e00",
  goldBright: "#ffd700",
  white: "#ffffff",
  offWhite: "#f5f9fb",
  bg: "#ffffff",
  cardBg: "rgba(10, 30, 61, 0.03)",
  cardBgSolid: "#f0f5f9",
  text: "#0f1f2e",
  textLight: "#4a6272",
  heroGradStart: "#e6f0f6",
  heroGradEnd: "#ffffff",
} as const;

/* ── Ocean Water Background — dramatic open-water immersion ── */
function OceanBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let w = 0, h = 0;

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = document.documentElement.scrollHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    /* Bubbles — sparse, elegant */
    const bubbles: { x: number; y: number; r: number; speed: number; wobble: number; opacity: number; phase: number }[] = [];
    for (let i = 0; i < 80; i++) {
      bubbles.push({
        x: Math.random() * 2000,
        y: Math.random() * 5000,
        r: 1 + Math.random() * 10,
        speed: 0.2 + Math.random() * 1.1,
        wobble: Math.random() * Math.PI * 2,
        opacity: 0.08 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
      });
    }

    /* Light rays — gentle sun beams */
    const rays: { x: number; width: number; speed: number; opacity: number }[] = [];
    for (let i = 0; i < 10; i++) {
      rays.push({
        x: Math.random() * 2000,
        width: 80 + Math.random() * 280,
        speed: 0.05 + Math.random() * 0.25,
        opacity: 0.04 + Math.random() * 0.06,
      });
    }

    /* Swimmer silhouettes — subtle, few */
    const swimmers: { x: number; y: number; speed: number; size: number; strokePhase: number; direction: number; opacity: number }[] = [];
    for (let i = 0; i < 6; i++) {
      swimmers.push({
        x: Math.random() * 2000,
        y: 60 + Math.random() * 600,
        speed: 0.25 + Math.random() * 0.7,
        size: 8 + Math.random() * 20,
        strokePhase: Math.random() * Math.PI * 2,
        direction: Math.random() > 0.5 ? 1 : -1,
        opacity: 0.06 + Math.random() * 0.08,
      });
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);

      /* Layer 1: gentle ocean waves — light, clean feel */
      for (let i = 0; i < 6; i++) {
        ctx!.beginPath();
        const yBase = h * 0.08 + i * (h * 0.15);
        ctx!.moveTo(-10, yBase);
        for (let x = -10; x <= w + 10; x += 5) {
          const y = yBase
            + Math.sin(x * 0.0015 + t * 0.0007 + i * 1.3) * 20
            + Math.sin(x * 0.004 + t * 0.0005 + i * 0.8) * 10
            + Math.cos(x * 0.0008 + t * 0.0004 + i * 2.5) * 12;
          ctx!.lineTo(x, y);
        }
        ctx!.lineTo(w + 10, h + 10);
        ctx!.lineTo(-10, h + 10);
        ctx!.closePath();
        const alpha = 0.012 - i * 0.002;
        ctx!.fillStyle = `rgba(26, 122, 109, ${Math.max(0.002, alpha)})`;
        ctx!.fill();
      }

      /* Layer 2: subtle light pools — soft teal shimmer */
      ctx!.globalCompositeOperation = "lighter";
      for (let i = 0; i < 8; i++) {
        const cx = w * (0.05 + i * 0.12) + Math.sin(t * 0.0003 + i * 1.4) * 150;
        const cy = h * (0.1 + i * 0.1) + Math.cos(t * 0.00035 + i * 2.0) * 100;
        const radius = 200 + Math.sin(t * 0.0007 + i * 1.1) * 80;
        const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(26, 122, 109, 0.03)`);
        grad.addColorStop(0.5, `rgba(26, 138, 154, 0.015)`);
        grad.addColorStop(1, "rgba(26, 122, 109, 0)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, w, h);
      }
      ctx!.globalCompositeOperation = "source-over";

      /* Layer 3: gentle golden sun rays — barely-there warmth */
      for (const ray of rays) {
        const rx = ray.x + Math.sin(t * 0.00015 + ray.x * 0.001) * 40;
        const shimmer = 0.3 + 0.7 * Math.sin(t * 0.0006 + ray.x * 0.005);
        ctx!.save();
        ctx!.translate(rx, 0);
        ctx!.rotate(0.08 + Math.sin(t * 0.0001) * 0.02);
        const grad = ctx!.createLinearGradient(0, 0, 0, h * 0.5);
        grad.addColorStop(0, `rgba(232, 184, 0, ${ray.opacity * shimmer * 0.5})`);
        grad.addColorStop(0.4, `rgba(26, 138, 154, ${ray.opacity * 0.15 * shimmer})`);
        grad.addColorStop(1, "rgba(26, 138, 154, 0)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(-ray.width / 2, -20, ray.width, h * 0.5 + 40);
        ctx!.restore();
      }

      /* Layer 4: delicate bubbles — barely visible, light feel */
      for (const b of bubbles) {
        b.y -= b.speed;
        b.wobble += 0.01;
        const bx = b.x + Math.sin(b.wobble + b.phase) * 20;
        if (b.y < -30) { b.y = h + 30; b.x = Math.random() * w; }
        ctx!.beginPath();
        ctx!.arc(bx, b.y, b.r, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(26, 138, 154, ${b.opacity * 0.3})`;
        ctx!.lineWidth = 0.4;
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.arc(bx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(26, 138, 154, ${b.opacity * 0.15})`;
        ctx!.fill();
      }

      /* Layer 5: ghost swimmer silhouettes — very subtle */
      for (const s of swimmers) {
        s.x += s.speed * s.direction;
        s.strokePhase += 0.035;
        if (s.x > w + 100) { s.x = -100; s.y = 100 + Math.random() * 400; }
        if (s.x < -100) { s.x = w + 100; s.y = 100 + Math.random() * 400; }
        ctx!.save();
        ctx!.translate(s.x, s.y);
        if (s.direction < 0) ctx!.scale(-1, 1);
        ctx!.globalAlpha = s.opacity * 0.5;
        ctx!.fillStyle = `rgba(26, 122, 109, 0.6)`;
        ctx!.beginPath();
        ctx!.ellipse(0, 0, s.size * 1.8, s.size * 0.4, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(s.size * 1.6, -s.size * 0.1, s.size * 0.35, 0, Math.PI * 2);
        ctx!.fill();
        const armAngle = Math.sin(s.strokePhase) * 1.2;
        ctx!.save();
        ctx!.translate(s.size * 0.5, -s.size * 0.2);
        ctx!.rotate(armAngle);
        ctx!.fillRect(-1, -s.size * 1.2, 2, s.size * 1.2);
        ctx!.restore();
        ctx!.globalAlpha = 1;
        ctx!.restore();
      }

      /* Layer 6: surface ripple — very subtle golden shimmer */
      ctx!.beginPath();
      ctx!.moveTo(-10, 0);
      for (let x = -10; x <= w + 10; x += 4) {
        const y = 3
          + Math.sin(x * 0.006 + t * 0.0015) * 2
          + Math.sin(x * 0.015 + t * 0.002) * 1;
        ctx!.lineTo(x, y);
      }
      ctx!.lineTo(w + 10, 0);
      ctx!.lineTo(-10, 0);
      ctx!.closePath();
      ctx!.fillStyle = `rgba(232, 184, 0, 0.02)`;
      ctx!.fill();

      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0,
      }}
    />
  );
}

/* ── Piranha Logo SVG ── */
function PiranhaLogo({ size = 48, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Aggressive piranha profile — sharp teeth, fierce eye */}
      <path d="M8 32C8 32 14 18 28 16C34 15 40 16 46 20L56 26L48 30L56 34L46 38C40 44 34 46 28 46C14 44 8 32 8 32Z" fill={color} opacity="0.9"/>
      {/* Jaw with teeth */}
      <path d="M46 28L56 26L48 30L56 34L46 32Z" fill={C.gold}/>
      <path d="M38 27L41 30L38 30Z" fill={C.white}/>
      <path d="M34 26L37 30L34 29Z" fill={C.white}/>
      <path d="M30 27L33 30L30 29Z" fill={C.white}/>
      <path d="M38 33L41 30L38 30Z" fill={C.white}/>
      <path d="M34 34L37 30L34 31Z" fill={C.white}/>
      <path d="M30 33L33 30L30 31Z" fill={C.white}/>
      {/* Eye — fierce red */}
      <circle cx="22" cy="28" r="4" fill={C.white}/>
      <circle cx="23" cy="27.5" r="2.5" fill={C.red}/>
      <circle cx="23.8" cy="27" r="1" fill="#1a0000"/>
      {/* Fin */}
      <path d="M22 18L18 8L26 16Z" fill={color} opacity="0.7"/>
      {/* Tail */}
      <path d="M8 32L2 22L6 30L2 42L8 32Z" fill={color} opacity="0.6"/>
    </svg>
  );
}

/* ── Scroll-triggered reveal ── */
function ScrollSection({ children, style, delay = 0, id }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section
      id={id}
      ref={ref}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(30px)",
        transition: `opacity 0.7s ease-out ${delay}s, transform 0.7s ease-out ${delay}s`,
      }}
    >
      {children}
    </section>
  );
}

/* ── Parallax scroll hook ── */
function useParallax() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handle = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);
  return scrollY;
}

/* ── Countdown logic ── */
function useCountdown(target: Date) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return { days: 0, hours: 0, minutes: 0, seconds: 0, ready: false };
  const diff = Math.max(0, target.getTime() - now.getTime());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    ready: true,
  };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: C.white,
      border: `2px solid ${C.teal}20`,
      borderRadius: 14, padding: "18px 22px", minWidth: 82,
      boxShadow: "0 4px 20px rgba(10,30,61,0.08)",
    }}>
      <span style={{
        fontSize: 38, fontWeight: 800, color: C.navy,
        fontVariantNumeric: "tabular-nums", lineHeight: 1,
      }}>
        {String(value).padStart(2, "0")}
      </span>
      <span style={{ fontSize: 10, color: C.textLight, textTransform: "uppercase", letterSpacing: 2, marginTop: 8 }}>
        {label}
      </span>
    </div>
  );
}

/* ── Animated wave divider ── */
function WaveDivider({ flip = false, color = C.teal }: { flip?: boolean; color?: string }) {
  return (
    <div style={{
      position: "relative", zIndex: 1, width: "100%", overflow: "hidden",
      height: 60, marginTop: flip ? 0 : -1, marginBottom: flip ? -1 : 0,
      transform: flip ? "scaleY(-1)" : "none",
    }}>
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <path
          d="M0 30 Q120 5 240 25 T480 30 T720 20 T960 30 T1200 22 T1440 30 L1440 60 L0 60Z"
          fill={color} opacity="0.06"
        />
        <path
          d="M0 35 Q180 15 360 32 T720 28 T1080 35 T1440 28 L1440 60 L0 60Z"
          fill={color} opacity="0.04"
        />
      </svg>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      background: C.white,
      border: `2px solid ${C.teal}15`,
      borderRadius: 16, padding: "36px 28px", textAlign: "center" as const,
      flex: "1 1 200px", maxWidth: 260,
      boxShadow: "0 3px 16px rgba(10,30,61,0.05)",
    }}>
      <div style={{ fontSize: 44, fontWeight: 900, color: C.navy, lineHeight: 1 }}>{value}</div>
      <div style={{ width: 24, height: 2, background: C.gold, borderRadius: 1, margin: "12px auto" }} />
      <div style={{ fontSize: 14, color: C.textLight }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   POWER CHALLENGE — Open Water Swim Landing Page
   Jesse Vassallo's Pompano Beach Piranhas
   ══════════════════════════════════════════════════════════════ */

export default function PowerChallengePage() {
  const eventDate = new Date("2026-04-11T07:00:00-04:00");
  const countdown = useCountdown(eventDate);
  const scrollY = useParallax();

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      overflowX: "hidden" as const,
      position: "relative" as const,
    }}>
      {/* Ocean water effect */}
      <OceanBackground />

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 32px",
        background: C.white + "f2", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.teal}10`,
        boxShadow: "0 1px 12px rgba(10,30,61,0.04)",
      }}>
        <Link href="/power-challenge" style={{
          color: C.navy, fontWeight: 800, fontSize: 15, textDecoration: "none",
          letterSpacing: 2, display: "flex", alignItems: "center", gap: 8,
        }}>
          <Image src="/piranhas-team-logo.jpg" alt="Pompano Beach Piranhas" width={36} height={36} style={{ borderRadius: 6 }} />
          POWER CHALLENGE
        </Link>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {[
            { label: "Races", href: "#races" },
            { label: "Schedule", href: "#schedule" },
            { label: "FAQ", href: "#faq" },
          ].map((link) => (
            <a key={link.href} href={link.href} className="nav-link" style={{
              color: C.textLight, fontSize: 14, textDecoration: "none", fontWeight: 500,
              transition: "color 0.2s",
            }}>
              {link.label}
            </a>
          ))}
          <Link href="/power-challenge/register" style={{
            padding: "8px 22px", background: C.red, color: C.white,
            fontWeight: 700, fontSize: 13, borderRadius: 50, textDecoration: "none",
            boxShadow: `0 2px 10px ${C.red}25`,
          }}>
            Register
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="hero-animate" style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center" as const, padding: "80px 24px 60px",
        background: `linear-gradient(180deg, ${C.heroGradStart} 0%, ${C.bg} 100%)`,
        transform: `translateY(${scrollY * 0.15}px)`,
        willChange: "transform",
      }}>
        {/* Piranha Logo — hero centerpiece */}
        <div style={{ marginBottom: 12, filter: `drop-shadow(0 4px 20px rgba(10,30,61,0.2))` }}>
          <Image src="/piranhas-race-logo.jpg" alt="Piranhas Open Water Extreme Race" width={200} height={153} style={{ borderRadius: 12 }} />
        </div>

        <div style={{
          fontSize: 12, letterSpacing: 6, textTransform: "uppercase" as const,
          color: C.tealMid, marginBottom: 16, fontWeight: 600,
        }}>
          Jesse Vassallo&apos;s Pompano Beach Piranhas
        </div>

        {/* Gold accent line */}
        <div style={{
          width: 80, height: 3, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
          borderRadius: 2, marginBottom: 20,
        }} />

        <h1 style={{
          fontSize: "clamp(56px, 10vw, 120px)", fontWeight: 900,
          lineHeight: 0.9, margin: "0 0 4px",
          background: `linear-gradient(135deg, ${C.navy} 10%, ${C.teal} 50%, ${C.navy} 90%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: "-0.03em",
          textShadow: "none",
        }}>
          POWER<br />CHALLENGE
        </h1>

        <div style={{
          fontSize: "clamp(13px, 1.8vw, 17px)", letterSpacing: 8,
          textTransform: "uppercase" as const, color: C.red,
          fontWeight: 800, margin: "8px 0 6px",
        }}>
          Open Water Extreme Race
        </div>

        <div style={{
          width: 40, height: 2, background: C.gold, borderRadius: 1,
          margin: "0 auto 24px",
        }} />

        <p style={{
          fontSize: "clamp(16px, 2.2vw, 21px)", color: C.textLight,
          maxWidth: 500, margin: "0 auto 40px", lineHeight: 1.6,
          fontWeight: 400,
        }}>
          Pompano Beach, FL &bull; Saturday, April 11, 2026
        </p>

        {countdown.ready && (
          <div style={{
            display: "flex", gap: 14, flexWrap: "wrap" as const,
            justifyContent: "center", marginBottom: 48,
          }}>
            <CountdownBox value={countdown.days} label="Days" />
            <CountdownBox value={countdown.hours} label="Hours" />
            <CountdownBox value={countdown.minutes} label="Min" />
            <CountdownBox value={countdown.seconds} label="Sec" />
          </div>
        )}

        <Link href="/power-challenge/register" className="register-btn" style={{
          display: "inline-block", padding: "18px 56px",
          background: `linear-gradient(135deg, ${C.red}, ${C.redLight})`,
          color: C.white, fontWeight: 800, fontSize: 18,
          borderRadius: 50, textDecoration: "none",
          boxShadow: `0 6px 30px ${C.red}40`,
          transition: "transform 0.25s ease, box-shadow 0.25s ease",
          letterSpacing: "0.5px",
        }}>
          Register Now
        </Link>

        <div style={{
          position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)",
          color: C.teal + "33", fontSize: 28, animation: "bounce 2.5s infinite ease-in-out",
        }}>
          &#8595;
        </div>
      </header>

      <WaveDivider />

      {/* ── Event Details ── */}
      <ScrollSection id="races" style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{
          fontSize: 36, fontWeight: 800, textAlign: "center" as const,
          marginBottom: 48, color: C.navy,
        }}>
          The Races
        </h2>
        <div style={{
          display: "flex", gap: 24, justifyContent: "center",
          flexWrap: "wrap" as const,
        }}>
          {[
            { distance: "500m", label: "Sprint", price: "$45", desc: "Fast and fierce. Perfect for first-timers and competitive swimmers alike." },
            { distance: "1.5K", label: "Distance", price: "$65", desc: "Test your endurance in the open Atlantic. The ultimate power challenge." },
          ].map((race) => (
            <div key={race.distance} className="race-card" style={{
              flex: "1 1 340px", maxWidth: 420,
              background: C.white,
              border: `2px solid ${C.teal}18`,
              borderRadius: 20, padding: "48px 32px 40px",
              textAlign: "center" as const,
              boxShadow: "0 8px 32px rgba(10,30,61,0.08)",
              position: "relative" as const, overflow: "hidden" as const,
              transition: "transform 0.35s ease, box-shadow 0.35s ease",
              cursor: "pointer",
            }}>
              {/* Gold top accent bar */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${C.teal}, ${C.gold}, ${C.teal})` }} />
              {/* Animated water shimmer overlay */}
              <div className="card-shimmer" style={{
                position: "absolute", top: 0, left: "-100%", width: "200%", height: "100%",
                background: `linear-gradient(90deg, transparent 0%, rgba(26,122,109,0.04) 25%, rgba(241,196,15,0.06) 50%, rgba(26,122,109,0.04) 75%, transparent 100%)`,
                pointerEvents: "none",
              }} />
              {/* Water wave decoration at bottom */}
              <svg className="card-wave" style={{ position: "absolute", bottom: 0, left: 0, right: 0, opacity: 0.08 }} viewBox="0 0 400 40" preserveAspectRatio="none" height="40" width="100%">
                <path d="M0 20 Q50 5 100 20 T200 20 T300 20 T400 20 L400 40 L0 40Z" fill={C.teal}/>
              </svg>
              <Image src="/piranhas-team-logo.jpg" alt="Piranhas" width={36} height={40} style={{ borderRadius: 6 }} />
              <div style={{ fontSize: 40, fontWeight: 900, color: C.navy, marginTop: 8, marginBottom: 2 }}>{race.distance}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.tealLight, letterSpacing: 3, textTransform: "uppercase" as const, marginBottom: 14 }}>{race.label}</div>
              <p style={{ color: C.textLight, lineHeight: 1.7, fontSize: 15, marginBottom: 20 }}>{race.desc}</p>
              <div style={{
                fontSize: 26, fontWeight: 900, color: C.red,
                background: `${C.red}08`, borderRadius: 50, display: "inline-block",
                padding: "6px 28px",
              }}>{race.price}</div>
            </div>
          ))}
        </div>
      </ScrollSection>

      <WaveDivider flip />

      {/* ── Location ── */}
      <ScrollSection style={{ position: "relative", zIndex: 1, padding: "60px 24px 80px", textAlign: "center" as const }} delay={0.1}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          Pompano Beach, Florida
        </h2>
        <p style={{ color: C.textLight, maxWidth: 520, margin: "0 auto 24px", lineHeight: 1.6 }}>
          Race day morning on the beautiful Atlantic coast. Warm water, ocean swells, and the energy of South Florida&apos;s swim community.
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          background: C.white, border: `2px solid ${C.teal}20`,
          borderRadius: 50, padding: "14px 32px",
          color: C.navy, fontWeight: 700, fontSize: 15,
          boxShadow: "0 2px 16px rgba(10,30,61,0.06)",
        }}>
          <Image src="/piranhas-team-logo.jpg" alt="Piranhas" width={28} height={30} style={{ borderRadius: 4 }} />
          April 11, 2026 &bull; Race Start 7:00 AM
        </div>
      </ScrollSection>

      <WaveDivider />

      {/* ── 2024 Results ── */}
      <ScrollSection style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 900, margin: "0 auto" }} delay={0.1}>
        <h2 style={{
          fontSize: 36, fontWeight: 800, textAlign: "center" as const,
          marginBottom: 16, color: C.navy,
        }}>
          2024 Results
        </h2>
        <p style={{
          textAlign: "center" as const, color: C.textLight,
          marginBottom: 48, fontSize: 15,
        }}>
          Last year&apos;s event brought together an incredible field of open water athletes.
        </p>
        <div style={{
          display: "flex", gap: 24, justifyContent: "center",
          flexWrap: "wrap" as const,
        }}>
          <StatCard value="105" label="Athletes Competed" />
          <StatCard value="8" label="Teams Represented" />
          <StatCard value="2" label="Race Distances" />
        </div>
      </ScrollSection>

      <WaveDivider flip />

      {/* ── Sponsors ── */}
      <ScrollSection style={{ position: "relative", zIndex: 1, padding: "80px 24px 100px", textAlign: "center" as const }} delay={0.15}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 16 }}>
          Our Sponsors
        </h2>
        <p style={{ color: C.textLight, marginBottom: 40, fontSize: 15 }}>
          Proudly supported by the South Florida swimming community.
        </p>
        <div style={{
          display: "flex", gap: 24, justifyContent: "center",
          flexWrap: "wrap" as const, alignItems: "center",
        }}>
          <div style={{
            background: C.white, border: `2px solid ${C.teal}18`,
            borderRadius: 16, padding: "32px 48px", textAlign: "center" as const,
            boxShadow: "0 4px 20px rgba(10,30,61,0.06)",
            maxWidth: 400,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
              Sponsor This Event
            </div>
            <p style={{ color: C.textLight, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              Support local youth swimming and get your brand in front of the South Florida aquatics community.
            </p>
            <a href="mailto:info@pompanopiranhas.com" style={{
              display: "inline-block", padding: "10px 28px",
              background: C.teal, color: C.white, fontWeight: 700,
              fontSize: 13, borderRadius: 50, textDecoration: "none",
              boxShadow: `0 2px 12px ${C.teal}30`,
            }}>
              Get In Touch
            </a>
          </div>
        </div>
      </ScrollSection>

      {/* ── Race Day Schedule ── */}
      <ScrollSection id="schedule" style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: "center" as const, marginBottom: 48, color: C.navy }}>
          Race Day Schedule
        </h2>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          {[
            { time: "5:30 AM", event: "Check-in & Body Marking Opens" },

            { time: "6:15 AM", event: "Mandatory Safety Briefing" },
            { time: "6:45 AM", event: "Warm-Up Swim (Optional)" },
            { time: "7:00 AM", event: "500m Sprint — Wave Start" },
            { time: "7:30 AM", event: "1.5K Distance — Wave Start" },
            { time: "9:00 AM", event: "Awards Ceremony" },
            { time: "9:30 AM", event: "Post-Race Social & Refreshments" },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", gap: 20, padding: "18px 0",
              borderBottom: `1px solid ${C.teal}15`,
              alignItems: "baseline",
            }}>
              <span style={{ color: C.navy, fontWeight: 700, fontSize: 15, minWidth: 90, fontVariantNumeric: "tabular-nums" }}>
                {item.time}
              </span>
              <span style={{ color: C.text, fontSize: 15 }}>{item.event}</span>
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* ── FAQ ── */}
      <ScrollSection id="faq" style={{ position: "relative", zIndex: 1, padding: "80px 24px 100px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: "center" as const, marginBottom: 48, color: C.navy }}>
          FAQ
        </h2>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 24 }}>
          {[
            { q: "What are the race distances?", a: "500m Sprint and 1.5K Distance. Both are open water ocean swims in the Atlantic." },
            { q: "How much does registration cost?", a: "500m Sprint is $45, 1.5K Distance is $65. Online registration only." },
            { q: "Do I need to be on a swim team?", a: "No. The event is open to all swimmers aged 12 and older. Team affiliation is optional." },
            { q: "What safety measures are in place?", a: "Lifeguards, kayak support, and safety boats will be stationed along the entire course. A mandatory safety briefing is held before the race." },
            { q: "What should I bring?", a: "Swimsuit, goggles, and a positive attitude. Wetsuits are permitted. Body marking supplies are provided at check-in." },
            { q: "Is there parking available?", a: "Yes, free parking is available at Pompano Beach. Arrive early for best spots." },
            { q: "Can I get a refund?", a: "Refunds are available up to 14 days before the event. No refunds within 14 days of race day." },
          ].map((item, i) => (
            <div key={i} style={{
              background: C.white, border: `2px solid ${C.teal}10`,
              borderRadius: 14, padding: "24px 28px",
              boxShadow: "0 2px 10px rgba(10,30,61,0.03)",
            }}>
              <div style={{ color: C.navy, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{item.q}</div>
              <div style={{ color: C.textLight, fontSize: 14, lineHeight: 1.7 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* ── Footer ── */}
      <footer style={{
        position: "relative", zIndex: 1,
        borderTop: `2px solid ${C.teal}10`,
        padding: "48px 24px 36px", textAlign: "center" as const,
        color: C.textLight, fontSize: 13,
        background: C.offWhite,
      }}>
        <div style={{ marginBottom: 12, opacity: 0.7 }}>
          <Image src="/piranhas-team-logo.jpg" alt="Piranhas" width={48} height={52} style={{ borderRadius: 8 }} />
        </div>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6, fontSize: 14, letterSpacing: 2 }}>
          POMPANO BEACH PIRANHAS
        </div>
        <div style={{ width: 30, height: 2, background: C.gold, borderRadius: 1, margin: "0 auto 12px" }} />
        <div>
          &copy; {new Date().getFullYear()} Jesse Vassallo&apos;s POWER CHALLENGE
        </div>
        <div style={{ marginTop: 6 }}>
          <a href="https://www.pompanopiranhas.com" style={{ color: C.tealLight, textDecoration: "none", fontWeight: 500 }} target="_blank" rel="noopener noreferrer">
            pompanopiranhas.com
          </a>
        </div>
      </footer>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
        @keyframes shimmerSlide {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(50%); }
        }
        @keyframes waveFloat {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-20px); }
        }
        .race-card:hover {
          transform: translateY(-8px) !important;
          box-shadow: 0 16px 48px rgba(10,30,61,0.16) !important;
          border-color: rgba(10,30,61,0.2) !important;
        }
        .race-card:hover .card-shimmer {
          animation: shimmerSlide 2s ease-in-out infinite;
        }
        .race-card .card-wave {
          animation: waveFloat 4s ease-in-out infinite;
        }
        .register-btn:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 10px 40px rgba(212,43,43,0.5) !important;
        }
        .register-btn:active {
          transform: scale(0.97) !important;
        }
        .nav-link {
          position: relative;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #0a1e3d, #1a7a6d);
          border-radius: 1px;
          transition: width 0.3s ease;
        }
        .nav-link:hover {
          color: #0a1e3d !important;
        }
        .nav-link:hover::after {
          width: 100%;
        }
        @keyframes heroFadeIn {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .hero-animate > * {
          animation: heroFadeIn 0.8s ease-out both;
        }
        .hero-animate > *:nth-child(1) { animation-delay: 0.1s; }
        .hero-animate > *:nth-child(2) { animation-delay: 0.2s; }
        .hero-animate > *:nth-child(3) { animation-delay: 0.3s; }
        .hero-animate > *:nth-child(4) { animation-delay: 0.4s; }
        .hero-animate > *:nth-child(5) { animation-delay: 0.5s; }
        .hero-animate > *:nth-child(6) { animation-delay: 0.6s; }
        .hero-animate > *:nth-child(7) { animation-delay: 0.7s; }
        .hero-animate > *:nth-child(8) { animation-delay: 0.8s; }
        .hero-animate > *:nth-child(9) { animation-delay: 0.9s; }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 6px 30px rgba(212,43,43,0.4); }
          50% { box-shadow: 0 6px 50px rgba(212,43,43,0.65), 0 0 80px rgba(212,43,43,0.2); }
        }
        @keyframes cardBreathe {
          0%, 100% { box-shadow: 0 8px 32px rgba(10,30,61,0.08); }
          50% { box-shadow: 0 8px 40px rgba(10,30,61,0.14), 0 0 60px rgba(26,122,109,0.06); }
        }
        @keyframes floatUp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .register-btn {
          animation: pulseGlow 3s ease-in-out infinite !important;
        }
        .race-card {
          animation: cardBreathe 5s ease-in-out infinite;
        }
        .race-card:nth-child(2) {
          animation-delay: 1.5s;
        }
        @media (max-width: 640px) {
          nav {
            padding: 10px 16px !important;
          }
          nav > div:last-child {
            gap: 12px !important;
          }
          nav .nav-link {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
