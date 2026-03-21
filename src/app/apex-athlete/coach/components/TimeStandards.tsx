"use client";
import { useState, useMemo } from "react";

// USA Swimming Motivational Time Standards (SCY) — 2024-2028 cycle
const STANDARDS: Record<string, Record<string, Record<string, string>>> = {
  "10 & Under": {
    "50 Free": { B: "35.09", BB: "32.59", A: "30.49", AA: "28.59", AAA: "26.89", AAAA: "25.19" },
    "100 Free": { B: "1:17.59", BB: "1:12.09", A: "1:07.39", AA: "1:03.19", AAA: "59.39", AAAA: "55.69" },
    "50 Back": { B: "40.69", BB: "37.79", A: "35.29", AA: "33.09", AAA: "31.09", AAAA: "29.19" },
    "100 Back": { B: "1:27.49", BB: "1:21.09", A: "1:15.69", AA: "1:10.99", AAA: "1:06.69", AAAA: "1:02.59" },
    "50 Breast": { B: "44.79", BB: "41.59", A: "38.89", AA: "36.39", AAA: "34.19", AAAA: "32.09" },
    "50 Fly": { B: "38.59", BB: "35.89", A: "33.49", AA: "31.39", AAA: "29.49", AAAA: "27.69" },
    "100 IM": { B: "1:24.59", BB: "1:18.49", A: "1:13.29", AA: "1:08.69", AAA: "1:04.49", AAAA: "1:00.49" },
  },
  "11-12": {
    "50 Free": { B: "30.59", BB: "28.39", A: "26.49", AA: "24.89", AAA: "23.39", AAAA: "21.89" },
    "100 Free": { B: "1:06.59", BB: "1:01.79", A: "57.69", AA: "54.09", AAA: "50.79", AAAA: "47.69" },
    "200 Free": { B: "2:24.09", BB: "2:13.79", A: "2:04.99", AA: "1:57.19", AAA: "1:50.09", AAAA: "1:43.59" },
    "50 Back": { B: "35.59", BB: "33.09", A: "30.89", AA: "28.89", AAA: "27.19", AAAA: "25.49" },
    "100 Back": { B: "1:16.69", BB: "1:11.19", A: "1:06.39", AA: "1:02.29", AAA: "58.49", AAAA: "54.89" },
    "50 Breast": { B: "39.79", BB: "36.89", A: "34.49", AA: "32.29", AAA: "30.39", AAAA: "28.49" },
    "100 Breast": { B: "1:24.59", BB: "1:18.49", A: "1:13.29", AA: "1:08.69", AAA: "1:04.49", AAAA: "1:00.49" },
    "50 Fly": { B: "33.39", BB: "31.09", A: "28.99", AA: "27.19", AAA: "25.49", AAAA: "23.99" },
    "100 Fly": { B: "1:14.49", BB: "1:09.09", A: "1:04.49", AA: "1:00.49", AAA: "56.79", AAAA: "53.29" },
    "200 IM": { B: "2:44.99", BB: "2:33.39", A: "2:23.29", AA: "2:14.29", AAA: "2:06.09", AAAA: "1:58.49" },
  },
  "13-14": {
    "50 Free": { B: "27.29", BB: "25.29", A: "23.69", AA: "22.19", AAA: "20.89", AAAA: "19.59" },
    "100 Free": { B: "59.69", BB: "55.39", A: "51.69", AA: "48.49", AAA: "45.59", AAAA: "42.79" },
    "200 Free": { B: "2:09.69", BB: "2:00.29", A: "1:52.19", AA: "1:44.89", AAA: "1:38.29", AAAA: "1:32.19" },
    "500 Free": { B: "5:53.09", BB: "5:27.49", A: "5:05.29", AA: "4:45.89", AAA: "4:28.69", AAAA: "4:12.89" },
    "100 Back": { B: "1:08.39", BB: "1:03.49", A: "59.29", AA: "55.59", AAA: "52.19", AAAA: "48.99" },
    "200 Back": { B: "2:26.99", BB: "2:16.09", A: "2:06.49", AA: "1:57.99", AAA: "1:50.49", AAAA: "1:43.79" },
    "100 Breast": { B: "1:15.69", BB: "1:10.19", A: "1:05.49", AA: "1:01.39", AAA: "57.69", AAAA: "54.09" },
    "200 Breast": { B: "2:43.69", BB: "2:31.69", A: "2:21.19", AA: "2:11.79", AAA: "2:03.29", AAAA: "1:55.59" },
    "100 Fly": { B: "1:05.69", BB: "1:00.99", A: "56.89", AA: "53.29", AAA: "50.09", AAAA: "46.99" },
    "200 IM": { B: "2:27.09", BB: "2:16.69", A: "2:07.49", AA: "1:59.29", AAA: "1:51.89", AAAA: "1:45.09" },
  },
  "15-16": {
    "50 Free": { B: "25.29", BB: "23.49", A: "21.89", AA: "20.59", AAA: "19.29", AAAA: "18.09" },
    "100 Free": { B: "54.99", BB: "51.09", A: "47.69", AA: "44.69", AAA: "42.09", AAAA: "39.49" },
    "200 Free": { B: "1:59.79", BB: "1:51.09", A: "1:43.49", AA: "1:36.79", AAA: "1:30.69", AAAA: "1:25.19" },
    "500 Free": { B: "5:26.09", BB: "5:02.49", A: "4:42.19", AA: "4:24.09", AAA: "4:07.89", AAAA: "3:53.19" },
    "100 Back": { B: "1:02.69", BB: "58.19", A: "54.29", AA: "50.89", AAA: "47.79", AAAA: "44.89" },
    "100 Breast": { B: "1:10.89", BB: "1:05.69", A: "1:01.29", AA: "57.39", AAA: "53.89", AAAA: "50.59" },
    "100 Fly": { B: "1:00.09", BB: "55.69", A: "51.99", AA: "48.69", AAA: "45.79", AAAA: "42.99" },
    "200 IM": { B: "2:15.79", BB: "2:06.29", A: "1:57.79", AA: "1:50.29", AAA: "1:43.39", AAAA: "1:37.09" },
  },
};

const CUTS = ["B", "BB", "A", "AA", "AAA", "AAAA"];
const CUT_COLORS: Record<string, string> = { B: "#6B7280", BB: "#2563EB", A: "#10B981", AA: "#F59E0B", AAA: "#DC2626", AAAA: "#6B21A8" };

function parseTime(t: string): number {
  const parts = t.split(":");
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(t);
}

function formatTime(s: number): string {
  if (s >= 60) { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0")}`; }
  return s.toFixed(2);
}

// Course conversion factors (approximate SCY ↔ LCM ↔ SCM)
function convertCourse(time: number, from: string, to: string): number {
  if (from === to) return time;
  const factors: Record<string, Record<string, number>> = {
    SCY: { LCM: 1.11, SCM: 1.02 },
    LCM: { SCY: 0.90, SCM: 0.92 },
    SCM: { SCY: 0.98, LCM: 1.09 },
  };
  return time * (factors[from]?.[to] ?? 1);
}

export default function TimeStandards() {
  const [ageGroup, setAgeGroup] = useState("13-14");
  const [course, setCourse] = useState("SCY");
  const [converterEvent, setConverterEvent] = useState("100 Free");
  const [converterCourse, setConverterCourse] = useState("SCY");
  const [converterTarget, setConverterTarget] = useState("LCM");
  const [converterMin, setConverterMin] = useState("");
  const [converterSec, setConverterSec] = useState("");
  const [converterMs, setConverterMs] = useState("");
  const [result, setResult] = useState<{ scy: string; lcm: string; scm: string } | null>(null);
  const [tab, setTab] = useState<"standards" | "converter" | "compare">("standards");

  const events = useMemo(() => Object.keys(STANDARDS[ageGroup] || {}), [ageGroup]);

  const doConvert = () => {
    const totalSec = (parseInt(converterMin || "0") * 60) + parseInt(converterSec || "0") + parseInt(converterMs || "0") / 100;
    if (totalSec <= 0) return;
    setResult({
      scy: formatTime(convertCourse(totalSec, converterCourse, "SCY")),
      lcm: formatTime(convertCourse(totalSec, converterCourse, "LCM")),
      scm: formatTime(convertCourse(totalSec, converterCourse, "SCM")),
    });
  };

  const tabs = [
    { id: "standards" as const, label: "Standards", icon: "🏅" },
    { id: "converter" as const, label: "Converter", icon: "🔄" },
  ];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="rounded-xl p-5 mb-4" style={{ background: "linear-gradient(135deg, #6B21A8, #4C1D95)" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">Time Standards & Converter</h2>
            <p className="text-xs text-white/70 mt-0.5">USA Swimming Motivational Times</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#f59e0b] text-[#1a1a2e]">2024-2028</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-white/10 mb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-all border-b-2 ${
              tab === t.id ? "text-[#a855f7] border-[#a855f7]" : "text-[#f8fafc]/40 border-transparent hover:text-[#f8fafc]/60"
            }`}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* STANDARDS TAB */}
      {tab === "standards" && (
        <div>
          <div className="flex gap-3 flex-wrap mb-4">
            <div>
              <label className="block text-xs font-semibold text-[#f8fafc]/40 mb-1">Age Group</label>
              <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)}
                className="px-3 py-2 rounded-lg border-2 border-white/10 bg-white/5 text-[#f8fafc] text-sm focus:border-[#a855f7]/50 outline-none">
                {Object.keys(STANDARDS).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border-2 border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #6B21A8, #4C1D95)" }}>
                  <th className="py-3 px-4 text-left text-white font-bold text-xs">Event</th>
                  {CUTS.map(c => <th key={c} className="py-3 px-3 text-center text-white font-bold text-xs">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={ev} className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"} hover:bg-white/[0.04]`}>
                    <td className="py-2.5 px-4 font-semibold text-[#f8fafc]">{ev}</td>
                    {CUTS.map(c => {
                      const t = STANDARDS[ageGroup]?.[ev]?.[c];
                      return (
                        <td key={c} className="py-2.5 px-3 text-center tabular-nums">
                          {t ? (
                            <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: `${CUT_COLORS[c]}20`, color: CUT_COLORS[c] }}>
                              {t}
                            </span>
                          ) : <span className="text-[#f8fafc]/20">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONVERTER TAB */}
      {tab === "converter" && (
        <div className="max-w-md">
          <div className="p-5 rounded-xl border-2 border-white/10">
            <h3 className="text-base font-bold text-[#f8fafc] mb-4 flex items-center gap-2">🔄 Course Converter</h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-[#f8fafc]/40 mb-1">From</label>
                <select value={converterCourse} onChange={e => setConverterCourse(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-white/10 bg-white/5 text-[#f8fafc] text-sm focus:border-[#a855f7]/50 outline-none">
                  <option value="SCY">SCY (Short Course Yards)</option>
                  <option value="LCM">LCM (Long Course Meters)</option>
                  <option value="SCM">SCM (Short Course Meters)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#f8fafc]/40 mb-1">To</label>
                <select value={converterTarget} onChange={e => setConverterTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-white/10 bg-white/5 text-[#f8fafc] text-sm focus:border-[#a855f7]/50 outline-none">
                  <option value="SCY">SCY</option>
                  <option value="LCM">LCM</option>
                  <option value="SCM">SCM</option>
                </select>
              </div>
            </div>

            <label className="block text-xs font-semibold text-[#f8fafc]/40 mb-1">Time</label>
            <div className="flex items-center gap-2 mb-4">
              <input value={converterMin} onChange={e => setConverterMin(e.target.value)} placeholder="0" type="number"
                className="w-16 px-3 py-2 rounded-lg border-2 border-white/10 bg-white/5 text-[#f8fafc] text-center text-sm focus:border-[#a855f7]/50 outline-none" />
              <span className="text-[#f8fafc]/40 font-bold">:</span>
              <input value={converterSec} onChange={e => setConverterSec(e.target.value)} placeholder="00" type="number"
                className="w-16 px-3 py-2 rounded-lg border-2 border-white/10 bg-white/5 text-[#f8fafc] text-center text-sm focus:border-[#a855f7]/50 outline-none" />
              <span className="text-[#f8fafc]/40 font-bold">.</span>
              <input value={converterMs} onChange={e => setConverterMs(e.target.value)} placeholder="00" type="number"
                className="w-16 px-3 py-2 rounded-lg border-2 border-white/10 bg-white/5 text-[#f8fafc] text-center text-sm focus:border-[#a855f7]/50 outline-none" />
            </div>

            <button onClick={doConvert}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #6B21A8, #7C3AED)" }}>
              Convert
            </button>

            {result && (
              <div className="mt-4 p-4 rounded-xl border-2 border-[#a855f7]/30 bg-[#a855f7]/5">
                <h4 className="text-xs font-bold text-[#a855f7] mb-3">Converted Times</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "SCY", val: result.scy, active: converterCourse === "SCY" },
                    { label: "LCM", val: result.lcm, active: converterCourse === "LCM" },
                    { label: "SCM", val: result.scm, active: converterCourse === "SCM" },
                  ].map(r => (
                    <div key={r.label} className={`text-center p-3 rounded-lg border-2 ${r.active ? "border-[#f59e0b]/50 bg-[#f59e0b]/10" : "border-white/10"}`}>
                      <div className="text-[10px] font-bold text-[#f8fafc]/40 uppercase">{r.label}{r.active ? " (input)" : ""}</div>
                      <div className="text-lg font-extrabold text-[#a855f7] tabular-nums mt-1">{r.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
