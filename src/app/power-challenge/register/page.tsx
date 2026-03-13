"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ParticleField from "../../../components/ParticleField";

export const dynamic = "force-dynamic";

const C = {
  navy: "#1a237e",
  navyLight: "#283593",
  navyDark: "#0d1452",
  gold: "#ffd700",
  goldDim: "#c9a800",
  white: "#ffffff",
  bg: "#060818",
  cardBg: "#0c1230",
};

const labelStyle: React.CSSProperties = {
  color: C.gold,
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  background: C.navyDark,
  border: `1px solid ${C.navy}`,
  color: C.white,
  borderRadius: 8,
  padding: "12px 16px",
  width: "100%",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

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
      }}
    >
      <ParticleField
        variant="gold"
        count={30}
        speed={0.3}
        opacity={0.3}
        connections
      />

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
            color: C.gold,
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

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p
            style={{
              color: C.gold,
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
              color: C.white,
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
            background: C.cardBg,
            border: `1px solid ${C.navy}`,
            borderRadius: 20,
            padding: 40,
            maxWidth: 600,
            margin: "0 auto",
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
                  colorScheme: "dark",
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
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffd700' stroke-width='2' fill='none'/%3E%3C/svg%3E\")",
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
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffd700' stroke-width='2' fill='none'/%3E%3C/svg%3E\")",
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
              background: C.navy,
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
              background: C.navy,
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
                color: C.white,
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
                  accentColor: C.gold,
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
                  ? `linear-gradient(135deg, ${C.goldDim}, #a08700)`
                  : `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                color: C.navyDark,
                fontWeight: 800,
                fontSize: 18,
                borderRadius: 50,
                padding: "16px 48px",
                boxShadow: `0 0 30px ${C.gold}44`,
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
