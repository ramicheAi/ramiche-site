"use client";

import { useState, useEffect, useRef, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

export const dynamic = "force-dynamic";

/* ── Brand Colors (matching landing page) ── */
const C = {
  navy: "#0a1e3d",
  navyLight: "#153060",
  teal: "#1a7a6d",
  tealLight: "#28a68e",
  red: "#d42b2b",
  redLight: "#e74c3c",
  gold: "#e8b800",
  goldDim: "#c99e00",
  goldBright: "#ffd700",
  white: "#ffffff",
  offWhite: "#f5f9fb",
  bg: "#ffffff",
  cardBg: "rgba(10, 30, 61, 0.03)",
  text: "#0f1f2e",
  textLight: "#4a6272",
  heroGradStart: "#e6f0f6",
};

const labelStyle: React.CSSProperties = {
  color: C.navy,
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  background: C.offWhite,
  border: `2px solid ${C.teal}30`,
  color: C.text,
  borderRadius: 10,
  padding: "12px 16px",
  width: "100%",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease",
};

/* ── Simplified Ocean Background for registration ── */
function OceanBgReg() {
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
    const bubbles: { x: number; y: number; r: number; speed: number; wobble: number; opacity: number }[] = [];
    for (let i = 0; i < 60; i++) {
      bubbles.push({ x: Math.random() * 2000, y: Math.random() * 5000, r: 2 + Math.random() * 8, speed: 0.3 + Math.random() * 1.0, wobble: Math.random() * Math.PI * 2, opacity: 0.1 + Math.random() * 0.25 });
    }
    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        ctx!.beginPath();
        const yBase = h * 0.06 + i * (h * 0.15);
        ctx!.moveTo(-10, yBase);
        for (let x = -10; x <= w + 10; x += 4) {
          const y = yBase + Math.sin(x * 0.003 + t * 0.001 + i * 1.2) * 30 + Math.sin(x * 0.006 + t * 0.0008 + i * 0.7) * 15;
          ctx!.lineTo(x, y);
        }
        ctx!.lineTo(w + 10, h + 10);
        ctx!.lineTo(-10, h + 10);
        ctx!.closePath();
        ctx!.fillStyle = i % 2 === 0 ? `rgba(26, 122, 109, ${0.04 - i * 0.004})` : `rgba(46, 139, 87, ${0.03 - i * 0.003})`;
        ctx!.fill();
      }
      for (const b of bubbles) {
        b.y -= b.speed;
        b.wobble += 0.012;
        const bx = b.x + Math.sin(b.wobble) * 20;
        if (b.y < -20) { b.y = h + 20; b.x = Math.random() * w; }
        ctx!.beginPath();
        ctx!.arc(bx, b.y, b.r, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(26, 138, 154, ${b.opacity * 0.4})`;
        ctx!.lineWidth = 0.6;
        ctx!.stroke();
      }
      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
}

function PowerChallengeRegisterContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [race, setRace] = useState("");
  const [team, setTeam] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [medical, setMedical] = useState("");
  const [waiver, setWaiver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/power-challenge/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          dob,
          gender,
          race,
          team,
          emergencyName,
          emergencyPhone,
          medical,
          waiver: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Registration failed. Please try again.");
      }

      const data = await res.json();
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <OceanBgReg />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "40px 20px 80px",
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        {/* Back link */}
        <a
          href="/power-challenge"
          style={{
            color: C.teal,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 18 }}>&larr;</span> Back to Power Challenge
        </a>

        {/* Success banner */}
        {success && (
          <div
            style={{
              background: "linear-gradient(135deg, #1b5e20, #2e7d32)",
              border: "1px solid #43a047",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 24,
              color: C.white,
              fontSize: 16,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Registration successful! You are now registered for the POWER CHALLENGE 2026. Check your email for confirmation details.
          </div>
        )}

        {/* Canceled banner */}
        {canceled && (
          <div
            style={{
              background: "linear-gradient(135deg, #b71c1c, #c62828)",
              border: "1px solid #e53935",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 24,
              color: C.white,
              fontSize: 16,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Payment was canceled. You can try registering again below.
          </div>
        )}

        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Image src="/piranhas-race-logo.jpg" alt="Piranhas Open Water Extreme Race" width={180} height={120} style={{ objectFit: "contain", marginBottom: 12 }} />
          <p
            style={{
              color: C.teal,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            POWER CHALLENGE 2026
          </p>
          <h1
            style={{
              color: C.navy,
              fontSize: 48,
              fontWeight: 800,
              margin: 0,
              letterSpacing: -1,
            }}
          >
            Register
          </h1>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: `linear-gradient(180deg, ${C.white} 0%, rgba(26,122,109,0.03) 100%)`,
            border: `2px solid ${C.teal}25`,
            borderTop: `4px solid ${C.gold}`,
            borderRadius: 20,
            padding: 40,
            maxWidth: 600,
            margin: "0 auto",
            boxShadow: "0 8px 32px rgba(10,30,61,0.08)",
          }}
        >
          {/* First / Last name row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ flex: "1 1 calc(50% - 8px)", minWidth: 200 }}>
              <label style={labelStyle}>First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: "1 1 calc(50% - 8px)", minWidth: 200 }}>
              <label style={labelStyle}>Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={inputStyle}
            />
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Phone *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              style={inputStyle}
            />
          </div>

          {/* DOB / Gender row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ flex: "1 1 calc(50% - 8px)", minWidth: 200 }}>
              <label style={labelStyle}>Date of Birth *</label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                style={{
                  ...inputStyle,
                }}
              />
            </div>
            <div style={{ flex: "1 1 calc(50% - 8px)", minWidth: 200 }}>
              <label style={labelStyle}>Gender *</label>
              <select
                required
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                style={{
                  ...inputStyle,
                  appearance: "none",
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%230a1e3d' stroke-width='2' fill='none'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 16px center",
                  paddingRight: 40,
                }}
              >
                <option value="" disabled>
                  Select gender
                </option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Race Distance */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Race Distance *</label>
            <select
              required
              value={race}
              onChange={(e) => setRace(e.target.value)}
              style={{
                ...inputStyle,
                appearance: "none",
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%230a1e3d' stroke-width='2' fill='none'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 16px center",
                paddingRight: 40,
              }}
            >
              <option value="" disabled>
                Select race distance
              </option>
              <option value="500m">500m Sprint ($45)</option>
              <option value="1.5K">1.5K Distance ($65)</option>
            </select>
          </div>

          {/* Team / Club */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Team / Club Name (optional)</label>
            <input
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="Your team or club"
              style={inputStyle}
            />
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: `${C.teal}20`,
              margin: "28px 0",
            }}
          />

          {/* Emergency Contact Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Emergency Contact Name *</label>
            <input
              type="text"
              required
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="Emergency contact full name"
              style={inputStyle}
            />
          </div>

          {/* Emergency Contact Phone */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Emergency Contact Phone *</label>
            <input
              type="tel"
              required
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="(555) 987-6543"
              style={inputStyle}
            />
          </div>

          {/* Medical Conditions */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Medical Conditions (optional)</label>
            <textarea
              value={medical}
              onChange={(e) => setMedical(e.target.value)}
              placeholder="List any relevant medical conditions, allergies, or medications..."
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: `${C.teal}20`,
              margin: "28px 0",
            }}
          />

          {/* Waiver checkbox */}
          <div style={{ marginBottom: 28 }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
                color: C.text,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                required
                checked={waiver}
                onChange={(e) => setWaiver(e.target.checked)}
                style={{
                  width: 20,
                  height: 20,
                  minWidth: 20,
                  marginTop: 2,
                  accentColor: C.teal,
                  cursor: "pointer",
                }}
              />
              <span>
                I agree to the event waiver and release of liability *
              </span>
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                color: "#ff5252",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 20,
                padding: "12px 16px",
                background: "rgba(255, 82, 82, 0.1)",
                border: "1px solid rgba(255, 82, 82, 0.3)",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <div style={{ textAlign: "center" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading
                  ? `linear-gradient(135deg, ${C.red}88, ${C.redLight}88)`
                  : `linear-gradient(135deg, ${C.red}, ${C.redLight})`,
                color: C.white,
                fontWeight: 800,
                fontSize: 18,
                borderRadius: 50,
                padding: "16px 48px",
                boxShadow: `0 6px 30px ${C.red}40`,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.3s ease",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Processing..." : "Register & Pay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PowerChallengeRegisterPage() {
  return (
    <Suspense>
      <PowerChallengeRegisterContent />
    </Suspense>
  );
}
