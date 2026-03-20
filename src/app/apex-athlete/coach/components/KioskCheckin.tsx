"use client";
import { useState, useEffect, useCallback, useMemo } from "react";

interface Athlete {
  id: string;
  name: string;
  pin?: string;
  group?: string;
  events?: string[];
  xp?: number;
  streak?: number;
  totalCheckins?: number;
}

interface KioskCheckinProps {
  roster: Athlete[];
}

const LEVELS = [
  { name: "Rookie", min: 0 },
  { name: "Contender", min: 200 },
  { name: "Warrior", min: 500 },
  { name: "Elite", min: 1000 },
  { name: "Captain", min: 2000 },
  { name: "Legend", min: 5000 },
];
const LEVEL_COLORS = ["#2563EB", "#4338CA", "#6B21A8", "#D97706", "#DC2626", "#6B21A8"];
const XP_CHECKIN = 15;
const XP_STREAK_BONUS = [0, 0, 5, 10, 15, 25, 35, 50];

function getLevel(xp: number) {
  let lv = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) lv = l;
  return lv;
}
function getLevelColor(xp: number) {
  const idx = LEVELS.findIndex((l) => l === getLevel(xp));
  return LEVEL_COLORS[idx] || LEVEL_COLORS[0];
}

type TabKey = "checkin" | "roster" | "leaderboard" | "stats";

export default function KioskCheckin({ roster }: KioskCheckinProps) {
  const [tab, setTab] = useState<TabKey>("checkin");
  const [pinValue, setPinValue] = useState("");
  const [checkedIn, setCheckedIn] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem("mettle-kiosk-" + today);
    if (saved) { try { return new Set(JSON.parse(saved).checkedIn || []); } catch { /* ignore */ } }
    return new Set<string>();
  });
  const [successAthlete, setSuccessAthlete] = useState<Athlete | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activityLog, setActivityLog] = useState<{ name: string; time: string }[]>(() => {
    if (typeof window === "undefined") return [];
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem("mettle-kiosk-" + today);
    if (saved) { try { return JSON.parse(saved).activityLog || []; } catch { /* ignore */ } }
    return [];
  });
  const [clock, setClock] = useState("");

  // Save state
  const saveState = useCallback(
    (newCheckedIn: Set<string>, newLog: { name: string; time: string }[]) => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(
        "mettle-kiosk-" + today,
        JSON.stringify({ checkedIn: [...newCheckedIn], activityLog: newLog })
      );
    },
    []
  );

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours() % 12 || 12;
      const m = String(now.getMinutes()).padStart(2, "0");
      setClock(`${h}:${m}`);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  const enterPin = (digit: string) => {
    if (pinValue.length >= 4) return;
    const next = pinValue + digit;
    setPinValue(next);
    setError("");
  };
  const clearPin = () => { setPinValue(""); setError(""); };
  const backspace = () => { setPinValue((p) => p.slice(0, -1)); setError(""); };

  const doCheckin = () => {
    const athlete = roster.find((a) => a.pin === pinValue);
    if (!athlete) { setError("PIN not found. Try again."); clearPin(); return; }
    if (checkedIn.has(athlete.id)) { setError(`${athlete.name} already checked in.`); clearPin(); return; }
    const newCheckedIn = new Set(checkedIn);
    newCheckedIn.add(athlete.id);
    const now = new Date();
    const timeStr = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")} ${now.getHours() >= 12 ? "PM" : "AM"}`;
    const newLog = [{ name: athlete.name, time: timeStr }, ...activityLog];
    setCheckedIn(newCheckedIn);
    setActivityLog(newLog);
    setSuccessAthlete(athlete);
    setPinValue("");
    saveState(newCheckedIn, newLog);
  };

  const resetCheckin = () => { setSuccessAthlete(null); };

  const filteredRoster = useMemo(() => {
    if (!searchQuery) return roster;
    const q = searchQuery.toLowerCase();
    return roster.filter((a) => a.name.toLowerCase().includes(q));
  }, [roster, searchQuery]);

  const sortedByStreak = useMemo(
    () => [...roster].sort((a, b) => (b.streak || 0) - (a.streak || 0)).slice(0, 10),
    [roster]
  );

  const attendanceRate = roster.length ? Math.round((checkedIn.size / roster.length) * 100) : 0;
  const avgStreak = roster.length
    ? Math.round(roster.reduce((s, a) => s + (a.streak || 0), 0) / roster.length)
    : 0;
  const bestStreak = Math.max(...roster.map((a) => a.streak || 0), 0);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "checkin", label: "Check In" },
    { key: "roster", label: "Roster" },
    { key: "leaderboard", label: "Leaders" },
    { key: "stats", label: "Stats" },
  ];

  return (
    <div style={{ background: "#FAFAF9", borderRadius: 16, overflow: "hidden", border: "2px solid #E7E5E4" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #6B21A8, #7C3AED)",
          padding: "16px 20px",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>ATHLETE CHECK-IN</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Kiosk Mode</div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{clock}</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #E7E5E4", background: "#fff" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: "12px 0",
              fontSize: 13,
              fontWeight: 600,
              color: tab === t.key ? "#6B21A8" : "#78716C",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "3px solid #6B21A8" : "3px solid transparent",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 600, margin: "0 auto", minHeight: 400 }}>
        {/* CHECK-IN TAB */}
        {tab === "checkin" && !successAthlete && (
          <div>
            <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
              <div style={{ fontSize: 64 }}>🏊</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#6B21A8" }}>Enter Your PIN</h2>
              <p style={{ fontSize: 14, color: "#78716C", marginTop: 4 }}>4-digit athlete PIN to check in</p>
            </div>

            {/* PIN Display */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "20px 0" }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 52,
                    height: 60,
                    border: `2px solid ${pinValue[i] ? "#6B21A8" : "#E7E5E4"}`,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#6B21A8",
                    background: "#fff",
                  }}
                >
                  {pinValue[i] ? "●" : ""}
                </div>
              ))}
            </div>

            {/* Numpad */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, margin: "16px 0" }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === "C") clearPin();
                    else if (key === "⌫") backspace();
                    else enterPin(key);
                  }}
                  onTouchEnd={(e) => e.stopPropagation()}
                  style={{
                    padding: 16,
                    fontSize: key === "C" || key === "⌫" ? 14 : 22,
                    fontWeight: 600,
                    border: "2px solid #E7E5E4",
                    borderRadius: 12,
                    background: "#fff",
                    cursor: "pointer",
                    color: key === "C" ? "#DC2626" : "#1C1917",
                    touchAction: "manipulation",
                  }}
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              onClick={doCheckin}
              disabled={pinValue.length < 4}
              style={{
                display: "block",
                width: "100%",
                padding: 16,
                border: "none",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: pinValue.length < 4 ? "not-allowed" : "pointer",
                background: pinValue.length < 4 ? "#D6D3D1" : "#6B21A8",
                color: "#fff",
                opacity: pinValue.length < 4 ? 0.5 : 1,
                touchAction: "manipulation",
              }}
            >
              Check In
            </button>

            {error && (
              <div style={{ color: "#DC2626", textAlign: "center", fontSize: 13, marginTop: 8 }}>{error}</div>
            )}
          </div>
        )}

        {/* SUCCESS SCREEN */}
        {tab === "checkin" && successAthlete && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "#16A34A",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#16A34A" }}>Checked In!</h2>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{successAthlete.name}</div>
            <div
              style={{
                display: "inline-block",
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff",
                padding: "8px 20px",
                borderRadius: 20,
                fontSize: 16,
                fontWeight: 700,
                marginTop: 12,
                boxShadow: "0 0 20px rgba(245,158,11,0.4)",
              }}
            >
              +{XP_CHECKIN + (XP_STREAK_BONUS[Math.min((successAthlete.streak || 0), 7)] || 0)} XP
            </div>
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: "#F0FDF4",
                border: "2px solid #BBF7D0",
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 800, color: "#16A34A" }}>{(successAthlete.streak || 0) + 1}</div>
              <div style={{ fontSize: 12, color: "#78716C", textTransform: "uppercase", letterSpacing: 1 }}>Day Streak</div>
            </div>
            <div style={{ marginTop: 12, fontSize: 14, color: "#78716C" }}>
              Level: <strong style={{ color: getLevelColor(successAthlete.xp || 0) }}>{getLevel(successAthlete.xp || 0).name}</strong>
            </div>
            <button
              onClick={resetCheckin}
              style={{
                marginTop: 20,
                display: "block",
                width: "100%",
                padding: 16,
                border: "none",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                background: "#F3F0FF",
                color: "#6B21A8",
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* ROSTER TAB */}
        {tab === "roster" && (
          <div>
            <input
              type="text"
              placeholder="Search athletes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #E7E5E4",
                borderRadius: 12,
                fontSize: 14,
                marginBottom: 12,
                background: "#fff",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Today&apos;s Practice</h3>
              <span
                style={{
                  background: "#6B21A8",
                  color: "#fff",
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {checkedIn.size} / {roster.length}
              </span>
            </div>
            {filteredRoster.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  background: checkedIn.has(a.id) ? "#F0FDF4" : "#fff",
                  border: `2px solid ${checkedIn.has(a.id) ? "#BBF7D0" : "#E7E5E4"}`,
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: getLevelColor(a.xp || 0),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {a.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#78716C" }}>
                    {a.group || "—"} · 🔥 {a.streak || 0} streak
                  </div>
                </div>
                {checkedIn.has(a.id) && (
                  <div style={{ color: "#16A34A", fontWeight: 700, fontSize: 13 }}>✓ IN</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab === "leaderboard" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Attendance Streak Leaderboard</h3>
            {sortedByStreak.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  background: "#fff",
                  border: "2px solid #E7E5E4",
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: i < 3 ? ["#F59E0B", "#9CA3AF", "#CD7F32"][i] : "#E7E5E4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    color: i < 3 ? "#fff" : "#78716C",
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: "#78716C" }}>{getLevel(a.xp || 0).name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#6B21A8" }}>🔥 {a.streak || 0}</div>
                  <div style={{ fontSize: 11, color: "#78716C" }}>{a.xp || 0} XP</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STATS TAB */}
        {tab === "stats" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { val: checkedIn.size, label: "Check-ins Today" },
                { val: `${attendanceRate}%`, label: "Attendance Rate" },
                { val: avgStreak, label: "Avg Streak" },
                { val: bestStreak, label: "Best Streak" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: 16,
                    background: "#fff",
                    border: "2px solid #E7E5E4",
                    borderRadius: 12,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#6B21A8" }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#78716C" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Recent Activity</h4>
            {activityLog.length === 0 && (
              <div style={{ color: "#78716C", fontSize: 13, textAlign: "center", padding: 20 }}>
                No check-ins yet today
              </div>
            )}
            {activityLog.slice(0, 10).map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#fff",
                  border: "1px solid #E7E5E4",
                  borderRadius: 8,
                  marginBottom: 4,
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600 }}>{a.name}</span>
                <span style={{ color: "#78716C" }}>{a.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
