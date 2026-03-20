"use client";
import React, { useState, useMemo } from "react";

/* ── USA Swimming Motivational Time Standards (SCY, 2024-2028 quad) ── */
const STANDARDS: Record<string, Record<string, Record<string, string>>> = {
  "50 Free": {
    M: { AAAA: "19.99", AAA: "20.69", AA: "21.49", A: "22.39", BB: "23.39", B: "24.69" },
    F: { AAAA: "22.39", AAA: "23.19", AA: "24.09", A: "25.09", BB: "26.29", B: "27.79" },
  },
  "100 Free": {
    M: { AAAA: "43.69", AAA: "45.29", AA: "47.09", A: "49.09", BB: "51.39", B: "54.29" },
    F: { AAAA: "48.99", AAA: "50.79", AA: "52.79", A: "54.99", BB: "57.49", B: "60.79" },
  },
  "200 Free": {
    M: { AAAA: "1:36.49", AAA: "1:39.89", AA: "1:43.49", A: "1:47.49", BB: "1:51.99", B: "1:57.49" },
    F: { AAAA: "1:47.99", AAA: "1:51.79", AA: "1:55.89", A: "2:00.29", BB: "2:05.29", B: "2:11.19" },
  },
  "500 Free": {
    M: { AAAA: "4:22.99", AAA: "4:32.09", AA: "4:41.89", A: "4:52.69", BB: "5:04.69", B: "5:19.29" },
    F: { AAAA: "4:53.99", AAA: "5:04.09", AA: "5:14.99", A: "5:26.89", BB: "5:39.99", B: "5:55.79" },
  },
  "100 Back": {
    M: { AAAA: "47.69", AAA: "49.39", AA: "51.29", A: "53.39", BB: "55.79", B: "58.89" },
    F: { AAAA: "53.39", AAA: "55.29", AA: "57.39", A: "59.79", BB: "62.49", B: "66.09" },
  },
  "200 Back": {
    M: { AAAA: "1:44.09", AAA: "1:47.59", AA: "1:51.39", A: "1:55.49", BB: "1:59.99", B: "2:05.59" },
    F: { AAAA: "1:56.49", AAA: "2:00.29", AA: "2:04.49", A: "2:08.99", BB: "2:13.99", B: "2:19.99" },
  },
  "100 Breast": {
    M: { AAAA: "53.29", AAA: "55.19", AA: "57.29", A: "59.59", BB: "62.29", B: "65.79" },
    F: { AAAA: "59.69", AAA: "61.79", AA: "64.19", A: "66.79", BB: "69.79", B: "73.79" },
  },
  "200 Breast": {
    M: { AAAA: "1:55.49", AAA: "1:59.39", AA: "2:03.49", A: "2:07.99", BB: "2:12.99", B: "2:19.09" },
    F: { AAAA: "2:09.49", AAA: "2:13.69", AA: "2:18.19", A: "2:22.99", BB: "2:28.39", B: "2:34.79" },
  },
  "100 Fly": {
    M: { AAAA: "47.29", AAA: "48.99", AA: "50.89", A: "52.99", BB: "55.39", B: "58.49" },
    F: { AAAA: "53.09", AAA: "54.99", AA: "57.09", A: "59.49", BB: "62.19", B: "65.69" },
  },
  "200 Fly": {
    M: { AAAA: "1:44.49", AAA: "1:47.99", AA: "1:51.79", A: "1:55.89", BB: "2:00.39", B: "2:05.99" },
    F: { AAAA: "1:57.99", AAA: "2:01.79", AA: "2:05.99", A: "2:10.49", BB: "2:15.49", B: "2:21.49" },
  },
  "200 IM": {
    M: { AAAA: "1:47.49", AAA: "1:50.99", AA: "1:54.79", A: "1:58.89", BB: "2:03.39", B: "2:08.99" },
    F: { AAAA: "1:59.99", AAA: "2:03.79", AA: "2:07.99", A: "2:12.49", BB: "2:17.49", B: "2:23.49" },
  },
};

const CUT_COLORS: Record<string, string> = {
  AAAA: "#6B21A8", AAA: "#2563EB", AA: "#16A34A", A: "#F59E0B", BB: "#EA580C", B: "#78716C",
};

const EVENTS = Object.keys(STANDARDS);

function parseTime(t: string): number {
  const parts = t.split(":");
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(parts[0]);
}

function fmtTime(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(2).padStart(5, "0");
    return `${m}:${sec}`;
  }
  return s.toFixed(2);
}

/* SCY ↔ LCM conversion factors (approximate) */
const SCY_TO_LCM: Record<string, number> = {
  "50 Free": 1.11, "100 Free": 1.11, "200 Free": 1.11, "500 Free": 1.11,
  "100 Back": 1.11, "200 Back": 1.11, "100 Breast": 1.11, "200 Breast": 1.11,
  "100 Fly": 1.11, "200 Fly": 1.11, "200 IM": 1.11,
};

interface Props {
  GameHUDHeader: React.ComponentType<{ title: string; icon?: string }>;
}

export default function TimeStandards({ GameHUDHeader }: Props) {
  const [gender, setGender] = useState<"M" | "F">("M");
  const [selectedEvent, setSelectedEvent] = useState(EVENTS[0]);
  const [inputTime, setInputTime] = useState("");
  const [converterEvent, setConverterEvent] = useState(EVENTS[0]);
  const [converterCourse, setConverterCourse] = useState<"SCY" | "LCM">("SCY");
  const [converterTime, setConverterTime] = useState("");
  const [tab, setTab] = useState<"standards" | "converter" | "lookup">("standards");

  const eventStandards = useMemo(() => {
    const ev = STANDARDS[selectedEvent];
    if (!ev) return [];
    const cuts = ev[gender] || {};
    return Object.entries(cuts).map(([cut, time]) => ({ cut, time, seconds: parseTime(time) }));
  }, [selectedEvent, gender]);

  const athleteLevel = useMemo(() => {
    if (!inputTime || !STANDARDS[selectedEvent]?.[gender]) return null;
    const secs = parseTime(inputTime);
    const cuts = STANDARDS[selectedEvent][gender];
    const levels = Object.entries(cuts).sort((a, b) => parseTime(a[1]) - parseTime(b[1]));
    for (const [cut, time] of levels) {
      if (secs <= parseTime(time)) return { cut, time, achieved: true };
    }
    const lastCut = levels[levels.length - 1];
    const diff = secs - parseTime(lastCut[1]);
    return { cut: `${diff.toFixed(2)}s from ${lastCut[0]}`, time: lastCut[1], achieved: false };
  }, [inputTime, selectedEvent, gender]);

  const convertedTime = useMemo(() => {
    if (!converterTime) return null;
    const secs = parseTime(converterTime);
    const factor = SCY_TO_LCM[converterEvent] || 1.11;
    if (converterCourse === "SCY") {
      return { from: "SCY", to: "LCM", time: fmtTime(secs * factor) };
    }
    return { from: "LCM", to: "SCY", time: fmtTime(secs / factor) };
  }, [converterTime, converterEvent, converterCourse]);

  return (
    <div style={{ width: "100%", padding: "0 16px" }}>
      <GameHUDHeader title="Time Standards" icon="⏱️" />

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #E7E5E4", marginBottom: 24 }}>
        {(["standards", "converter", "lookup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "12px 24px", border: "none", background: "transparent", cursor: "pointer",
              fontWeight: 600, fontSize: 14, color: tab === t ? "#6B21A8" : "#78716C",
              borderBottom: tab === t ? "3px solid #6B21A8" : "3px solid transparent",
            }}
          >
            {t === "standards" ? "📊 Standards" : t === "converter" ? "🔄 Converter" : "🔍 Lookup"}
          </button>
        ))}
      </div>

      {/* Standards Tab */}
      {tab === "standards" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 8, border: "2px solid #E7E5E4", fontSize: 14, fontWeight: 600 }}
            >
              {EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <div style={{ display: "flex", gap: 4 }}>
              {(["M", "F"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  style={{
                    padding: "10px 20px", borderRadius: 8, border: "2px solid",
                    borderColor: gender === g ? "#6B21A8" : "#E7E5E4",
                    background: gender === g ? "#6B21A8" : "#fff",
                    color: gender === g ? "#fff" : "#78716C",
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}
                >
                  {g === "M" ? "♂ Male" : "♀ Female"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {eventStandards.map(({ cut, time }) => (
              <div
                key={cut}
                style={{
                  padding: "16px 12px", borderRadius: 12, border: `2px solid ${CUT_COLORS[cut] || "#E7E5E4"}`,
                  background: "#fff", textAlign: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: CUT_COLORS[cut] || "#78716C", marginBottom: 4 }}>
                  {cut}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1917", fontVariantNumeric: "tabular-nums" }}>
                  {time}
                </div>
              </div>
            ))}
          </div>

          {/* Check athlete time */}
          <div style={{ marginTop: 24, padding: 20, background: "#F5F3FF", borderRadius: 12, border: "2px solid #DDD6FE" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#6B21A8", marginBottom: 12 }}>
              Check Athlete Time
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="e.g. 25.43 or 1:05.20"
                value={inputTime}
                onChange={(e) => setInputTime(e.target.value)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "2px solid #E7E5E4", fontSize: 14 }}
              />
            </div>
            {athleteLevel && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#fff", border: `2px solid ${athleteLevel.achieved ? CUT_COLORS[athleteLevel.cut] || "#16A34A" : "#E7E5E4"}` }}>
                {athleteLevel.achieved ? (
                  <div style={{ fontWeight: 700, color: CUT_COLORS[athleteLevel.cut] || "#16A34A" }}>
                    ✅ Achieved <strong>{athleteLevel.cut}</strong> cut ({athleteLevel.time})
                  </div>
                ) : (
                  <div style={{ fontWeight: 600, color: "#78716C" }}>
                    {athleteLevel.cut}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Converter Tab */}
      {tab === "converter" && (
        <div style={{ maxWidth: 500 }}>
          <div style={{ padding: 24, background: "#fff", borderRadius: 12, border: "2px solid #E7E5E4" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🔄 Course Converter</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <select
                value={converterEvent}
                onChange={(e) => setConverterEvent(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "2px solid #E7E5E4", fontSize: 14 }}
              >
                {EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                {(["SCY", "LCM"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setConverterCourse(c)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 8, border: "2px solid",
                      borderColor: converterCourse === c ? "#6B21A8" : "#E7E5E4",
                      background: converterCourse === c ? "#6B21A8" : "#fff",
                      color: converterCourse === c ? "#fff" : "#78716C",
                      fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Enter time (e.g. 25.43 or 1:05.20)"
                value={converterTime}
                onChange={(e) => setConverterTime(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "2px solid #E7E5E4", fontSize: 14 }}
              />
              {convertedTime && (
                <div style={{ padding: 16, background: "linear-gradient(135deg, #F3E8FF, #EDE9FE)", borderRadius: 12, border: "2px solid #6B21A8", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B21A8", marginBottom: 4 }}>
                    {convertedTime.from} → {convertedTime.to}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#6B21A8", fontVariantNumeric: "tabular-nums" }}>
                    {convertedTime.time}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lookup Tab */}
      {tab === "lookup" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#78716C", marginBottom: 16 }}>
            All events · {gender === "M" ? "Male" : "Female"}
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {(["M", "F"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "2px solid",
                  borderColor: gender === g ? "#6B21A8" : "#E7E5E4",
                  background: gender === g ? "#6B21A8" : "#fff",
                  color: gender === g ? "#fff" : "#78716C",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                {g === "M" ? "♂ Male" : "♀ Female"}
              </button>
            ))}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E7E5E4" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#78716C" }}>Event</th>
                  {["AAAA", "AAA", "AA", "A", "BB", "B"].map((c) => (
                    <th key={c} style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: CUT_COLORS[c] }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EVENTS.map((ev) => (
                  <tr key={ev} style={{ borderBottom: "1px solid #F5F5F4" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{ev}</td>
                    {["AAAA", "AAA", "AA", "A", "BB", "B"].map((c) => (
                      <td key={c} style={{ padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                        {STANDARDS[ev]?.[gender]?.[c] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
