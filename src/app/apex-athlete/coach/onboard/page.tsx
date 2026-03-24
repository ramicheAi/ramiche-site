"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROSTER_GROUPS, DAYS_OF_WEEK } from "../../constants";

/* ══════════════════════════════════════════════════════════════
   METTLE — Coach Onboarding (3 Decisions Only)
   Haven insight: 12 choices → 3 critical decisions = 34→81% completion

   Step 1: Confirm team name
   Step 2: Set practice schedule (days + times)
   Step 3: Select active groups

   Everything else configurable later in Settings.
   ══════════════════════════════════════════════════════════════ */

const TIME_SLOTS = [
  "5:00 AM", "5:30 AM", "6:00 AM", "6:30 AM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM",
  "7:00 PM",
];

export default function CoachOnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [teamName, setTeamName] = useState("Saint Andrew's Aquatics");
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<string[]>(["platinum", "gold"]);
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: string) => {
    setSchedule((prev) => {
      const next = { ...prev };
      if (next[day]) {
        delete next[day];
      } else {
        next[day] = "4:00 PM";
      }
      return next;
    });
  };

  const setTime = (day: string, time: string) => {
    setSchedule((prev) => ({ ...prev, [day]: time }));
  };

  const toggleGroup = (id: string) => {
    setGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Save to localStorage for now — Proximon will wire Firestore later
      localStorage.setItem(
        "mettle-coach-onboard",
        JSON.stringify({ teamName, schedule, groups, completedAt: new Date().toISOString() })
      );
      router.push("/apex-athlete/coach");
    } catch {
      setSaving(false);
    }
  };

  const activeDays = Object.keys(schedule);
  const canProceed = [
    teamName.trim().length > 0,
    activeDays.length >= 2,
    groups.length >= 1,
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e18",
        color: "#f8fafc",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: "-30%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80vw",
          height: "60vh",
          background: "radial-gradient(ellipse, rgba(0,240,255,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 20px", position: "relative" }}>
        {/* Progress bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 48 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? "#00f0ff" : "rgba(255,255,255,0.08)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {/* Step indicator */}
        <p style={{ fontSize: 13, color: "#00f0ff", fontWeight: 600, letterSpacing: 2, marginBottom: 8 }}>
          STEP {step + 1} OF 3
        </p>

        {/* ─── Step 0: Team Name ─── */}
        {step === 0 && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>
              What&#39;s your team called?
            </h1>
            <p style={{ color: "#94a3b8", marginBottom: 32 }}>
              This shows on athlete dashboards and meet reports.
            </p>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name"
              style={{
                width: "100%",
                padding: "16px 20px",
                fontSize: 18,
                fontWeight: 600,
                background: "rgba(255,255,255,0.04)",
                border: "2px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                color: "#f8fafc",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#00f0ff")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <button
              onClick={() => setStep(1)}
              disabled={!canProceed[0]}
              style={{
                marginTop: 32,
                width: "100%",
                padding: "16px",
                fontSize: 16,
                fontWeight: 700,
                background: canProceed[0] ? "linear-gradient(135deg, #00f0ff, #a855f7)" : "rgba(255,255,255,0.06)",
                color: canProceed[0] ? "#0e0e18" : "#475569",
                border: "none",
                borderRadius: 12,
                cursor: canProceed[0] ? "pointer" : "default",
                transition: "all 0.2s",
              }}
            >
              Next
            </button>
          </div>
        )}

        {/* ─── Step 1: Practice Schedule ─── */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>
              When does the team practice?
            </h1>
            <p style={{ color: "#94a3b8", marginBottom: 32 }}>
              Tap days your team trains. You can add more times later.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
              {DAYS_OF_WEEK.map((day) => {
                const active = !!schedule[day];
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    style={{
                      padding: "12px 20px",
                      fontSize: 15,
                      fontWeight: 700,
                      background: active ? "rgba(0,240,255,0.15)" : "rgba(255,255,255,0.04)",
                      border: `2px solid ${active ? "#00f0ff" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 10,
                      color: active ? "#00f0ff" : "#94a3b8",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time selectors for active days */}
            {activeDays.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {activeDays.map((day) => (
                  <div
                    key={day}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 10,
                      border: "2px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{day}</span>
                    <select
                      value={schedule[day]}
                      onChange={(e) => setTime(day, e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        color: "#f8fafc",
                        padding: "8px 12px",
                        fontSize: 14,
                      }}
                    >
                      {TIME_SLOTS.map((t) => (
                        <option key={t} value={t} style={{ background: "#1a1a2e" }}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              <button
                onClick={() => setStep(0)}
                style={{
                  flex: 1,
                  padding: "16px",
                  fontSize: 16,
                  fontWeight: 700,
                  background: "rgba(255,255,255,0.04)",
                  border: "2px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceed[1]}
                style={{
                  flex: 2,
                  padding: "16px",
                  fontSize: 16,
                  fontWeight: 700,
                  background: canProceed[1] ? "linear-gradient(135deg, #00f0ff, #a855f7)" : "rgba(255,255,255,0.06)",
                  color: canProceed[1] ? "#0e0e18" : "#475569",
                  border: "none",
                  borderRadius: 12,
                  cursor: canProceed[1] ? "pointer" : "default",
                  transition: "all 0.2s",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Active Groups ─── */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>
              Which groups do you coach?
            </h1>
            <p style={{ color: "#94a3b8", marginBottom: 32 }}>
              Select your active training groups. Add or remove anytime.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
              {ROSTER_GROUPS.map((g) => {
                const active = groups.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    style={{
                      padding: "16px",
                      background: active ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                      border: `2px solid ${active ? g.color : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 12,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{g.icon}</span>
                    <p style={{ fontWeight: 700, fontSize: 15, color: active ? g.color : "#94a3b8", marginTop: 8 }}>
                      {g.name}
                    </p>
                    <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {g.sport}
                    </p>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: "16px",
                  fontSize: 16,
                  fontWeight: 700,
                  background: "rgba(255,255,255,0.04)",
                  border: "2px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={!canProceed[2] || saving}
                style={{
                  flex: 2,
                  padding: "16px",
                  fontSize: 16,
                  fontWeight: 700,
                  background: canProceed[2] ? "linear-gradient(135deg, #00f0ff, #a855f7)" : "rgba(255,255,255,0.06)",
                  color: canProceed[2] ? "#0e0e18" : "#475569",
                  border: "none",
                  borderRadius: 12,
                  cursor: canProceed[2] ? "pointer" : "default",
                  transition: "all 0.2s",
                }}
              >
                {saving ? "Setting up..." : "Launch Dashboard"}
              </button>
            </div>
          </div>
        )}

        {/* Skip link */}
        <button
          onClick={() => router.push("/apex-athlete/coach")}
          style={{
            display: "block",
            margin: "24px auto 0",
            background: "none",
            border: "none",
            color: "#475569",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Skip setup — I&#39;ll configure later
        </button>
      </div>
    </div>
  );
}
