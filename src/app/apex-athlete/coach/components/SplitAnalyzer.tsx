"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import BgOrbs from "./BgOrbs";

const PURPLE = "#7C3AED";
const SCARLET = "#DC2626";
const GOLD = "#F59E0B";
const BLUE = "#2563EB";

interface SplitAnalyzerProps {
  GameHUDHeader: React.ComponentType;
}

interface EventConfig {
  splits: number;
  labels: string[];
  dist: number;
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  "50":    { splits: 2,  labels: ["1st 25", "2nd 25"], dist: 50 },
  "100":   { splits: 4,  labels: ["1st 25", "2nd 25", "3rd 25", "4th 25"], dist: 100 },
  "200":   { splits: 4,  labels: ["1st 50", "2nd 50", "3rd 50", "4th 50"], dist: 200 },
  "400":   { splits: 8,  labels: ["50", "100", "150", "200", "250", "300", "350", "400"], dist: 400 },
  "500":   { splits: 10, labels: ["50", "100", "150", "200", "250", "300", "350", "400", "450", "500"], dist: 500 },
  "100IM": { splits: 4,  labels: ["Fly 25", "Back 25", "Breast 25", "Free 25"], dist: 100 },
  "200IM": { splits: 4,  labels: ["Fly 50", "Back 50", "Breast 50", "Free 50"], dist: 200 },
  "200BR": { splits: 4,  labels: ["1st 50", "2nd 50", "3rd 50", "4th 50"], dist: 200 },
  "200BK": { splits: 4,  labels: ["1st 50", "2nd 50", "3rd 50", "4th 50"], dist: 200 },
  "200FL": { splits: 4,  labels: ["1st 50", "2nd 50", "3rd 50", "4th 50"], dist: 200 },
};

const DEMOS: Record<string, { name: string; splits: number[]; athlete: string }> = {
  "100":   { name: "Katie Ledecky Style", splits: [11.89, 12.34, 12.67, 12.41], athlete: "Demo Swimmer" },
  "200":   { name: "Negative Split 200", splits: [27.45, 28.12, 27.89, 26.94], athlete: "Demo Swimmer" },
  "200IM": { name: "IM Race", splits: [27.12, 31.45, 35.67, 28.34], athlete: "Demo Swimmer" },
  "500":   { name: "Distance Grind", splits: [27.2, 29.8, 30.1, 30.4, 30.6, 30.8, 30.5, 30.2, 29.9, 28.6], athlete: "Demo Swimmer" },
};

const EVENT_OPTIONS = [
  { value: "50", label: "50 Free" },
  { value: "100", label: "100 Free" },
  { value: "200", label: "200 Free" },
  { value: "400", label: "400 Free" },
  { value: "500", label: "500 Free" },
  { value: "100IM", label: "100 IM" },
  { value: "200IM", label: "200 IM" },
  { value: "200BR", label: "200 Breast" },
  { value: "200BK", label: "200 Back" },
  { value: "200FL", label: "200 Fly" },
];

function formatTime(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(2);
    return `${m}:${s.padStart(5, "0")}`;
  }
  return seconds.toFixed(2);
}

interface AnalysisResult {
  splits: number[];
  total: number;
  avg: number;
  fastest: number;
  slowest: number;
  range: number;
  splitDiff: number;
  cv: number;
  strategy: string;
  strategyType: "negative" | "positive" | "even" | "fly";
  recommendation: string;
  athlete: string;
  labels: string[];
}

function analyzeSplits(splits: number[], event: string, athleteName: string): AnalysisResult {
  const cfg = EVENT_CONFIG[event];
  const total = splits.reduce((a, b) => a + b, 0);
  const avg = total / splits.length;
  const fastest = Math.min(...splits);
  const slowest = Math.max(...splits);
  const range = slowest - fastest;
  const firstHalf = splits.slice(0, Math.floor(splits.length / 2)).reduce((a, b) => a + b, 0);
  const secondHalf = splits.slice(Math.floor(splits.length / 2)).reduce((a, b) => a + b, 0);
  const splitDiff = secondHalf - firstHalf;
  const variance = splits.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / splits.length;
  const stddev = Math.sqrt(variance);
  const cv = (stddev / avg) * 100;

  let strategy: string;
  let strategyType: "negative" | "positive" | "even" | "fly";
  if (splitDiff < -0.5) {
    strategy = "NEGATIVE SPLIT";
    strategyType = "negative";
  } else if (splitDiff > 1.0) {
    strategy = "POSITIVE SPLIT";
    strategyType = "positive";
  } else if (splits[0] === fastest && splits[splits.length - 1] > avg) {
    strategy = "FLY & DIE";
    strategyType = "fly";
  } else {
    strategy = "EVEN SPLIT";
    strategyType = "even";
  }

  const athlete = athleteName || "Athlete";
  let recommendation = "";
  if (strategyType === "negative") {
    recommendation = `Strong finish by ${athlete}. The second half was ${Math.abs(splitDiff).toFixed(2)}s faster than the first. This is an elite pacing pattern — the athlete had reserves to close hard. Consider slightly more aggressive first-half pacing to optimize total time without sacrificing the strong finish.`;
  } else if (strategyType === "positive") {
    recommendation = `${athlete} went out fast and faded ${splitDiff.toFixed(2)}s in the second half. Focus on: (1) controlled first 50 — hold back 0.3-0.5s, (2) maintain stroke rate through the back half, (3) breathing pattern consistency. Target even splits before attempting negative.`;
  } else if (strategyType === "fly") {
    recommendation = `${athlete} had the fastest opening split but couldn't sustain it. The ${range.toFixed(2)}s range between fastest and slowest splits suggests over-exertion early. Drill: pace work at 80% of race speed for the first 25/50, then build.`;
  } else {
    recommendation = `${athlete} maintained consistent pacing with only ${range.toFixed(2)}s variation (${cv.toFixed(1)}% CV). To drop time: (1) identify the weakest split and target it in practice, (2) work on turns — a 0.1s faster turn on each wall adds up, (3) consider slightly faster opening to create a cushion.`;
  }

  return {
    splits, total, avg, fastest, slowest, range, splitDiff, cv,
    strategy, strategyType, recommendation, athlete,
    labels: cfg.labels.slice(0, splits.length),
  };
}

function PacingChart({ result }: { result: AnalysisResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = 280;
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const { splits, avg, labels } = result;
    const padL = 60, padR = 30, padT = 30, padB = 50;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const minVal = Math.min(...splits) - 0.5;
    const maxVal = Math.max(...splits) + 0.5;
    const range = maxVal - minVal;

    ctx.strokeStyle = "#1e1b4b33";
    ctx.lineWidth = 1;
    ctx.font = "11px monospace";
    ctx.fillStyle = "#a78bfa";
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + (chartH / gridLines) * i;
      const val = maxVal - (range / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(val.toFixed(1) + "s", padL - 8, y + 4);
    }

    const avgY = padT + chartH - ((avg - minVal) / range) * chartH;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, avgY);
    ctx.lineTo(w - padR, avgY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = GOLD;
    ctx.textAlign = "left";
    ctx.fillText("AVG " + avg.toFixed(2), w - padR + 4, avgY + 4);

    const points = splits.map((s, i) => ({
      x: padL + (chartW / (splits.length - 1)) * i,
      y: padT + chartH - ((s - minVal) / range) * chartH,
      val: s,
    }));

    ctx.beginPath();
    ctx.moveTo(points[0].x, padT + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padT + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, "rgba(124, 58, 237, 0.25)");
    grad.addColorStop(1, "rgba(124, 58, 237, 0.02)");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = PURPLE;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    const fastest = Math.min(...splits);
    const slowest = Math.max(...splits);
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.val === fastest ? "#10B981" : p.val === slowest ? SCARLET : PURPLE;
      ctx.fill();
      ctx.strokeStyle = "#0e0e18";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(p.val.toFixed(2), p.x, p.y - 14);
    });

    ctx.fillStyle = "#a78bfa";
    ctx.font = "10px monospace";
    points.forEach((p, i) => {
      ctx.textAlign = "center";
      ctx.fillText(labels[i] || `S${i + 1}`, p.x, h - 10);
    });
  }, [result]);

  return <canvas ref={canvasRef} className="w-full" style={{ height: 280 }} />;
}

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`game-panel game-panel-border relative bg-[#06020f]/80 backdrop-blur-xl border border-[#7C3AED]/15 transition-all duration-300 hover:border-[#7C3AED]/30 shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-2xl p-5 ${className}`}>
    {children}
  </div>
);

const STRATEGY_STYLES: Record<string, { bg: string; text: string }> = {
  negative: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  positive: { bg: "bg-red-500/20", text: "text-red-400" },
  even:     { bg: "bg-amber-500/20", text: "text-amber-400" },
  fly:      { bg: "bg-purple-500/20", text: "text-purple-400" },
};

export default function SplitAnalyzer({ GameHUDHeader }: SplitAnalyzerProps) {
  const [athleteName, setAthleteName] = useState("");
  const [event, setEvent] = useState("100");
  const [course, setCourse] = useState("SCY");
  const [pasteInput, setPasteInput] = useState("");
  const [manualSplits, setManualSplits] = useState<string[]>(() => new Array(EVENT_CONFIG["100"].splits).fill(""));
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const cfg = EVENT_CONFIG[event];

  const handleEventChange = useCallback((ev: string) => {
    setEvent(ev);
    setManualSplits(new Array(EVENT_CONFIG[ev].splits).fill(""));
    setResult(null);
  }, []);

  const loadDemo = useCallback(() => {
    const demo = DEMOS[event];
    if (demo) {
      setAthleteName(demo.athlete);
      setManualSplits(demo.splits.map(s => s.toFixed(2)));
    } else {
      setEvent("100");
      setManualSplits(DEMOS["100"].splits.map(s => s.toFixed(2)));
      setAthleteName(DEMOS["100"].athlete);
    }
  }, [event]);

  const clearAll = useCallback(() => {
    setAthleteName("");
    setPasteInput("");
    setManualSplits(new Array(cfg.splits).fill(""));
    setResult(null);
  }, [cfg.splits]);

  const handleAnalyze = useCallback(() => {
    let splits: number[] = [];
    if (pasteInput.trim()) {
      splits = pasteInput.split(/[,\s\n\t]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
    } else {
      splits = manualSplits.map(s => parseFloat(s)).filter(n => !isNaN(n) && n > 0);
    }
    if (splits.length < 2) {
      alert("Need at least 2 splits to analyze.");
      return;
    }
    const res = analyzeSplits(splits, event, athleteName);
    setResult(res);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [pasteInput, manualSplits, event, athleteName]);

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <GameHUDHeader />

        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-black tracking-tight" style={{ color: PURPLE }}>Split Analyzer</h2>
          <span className="px-3 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase" style={{ background: GOLD, color: "#000" }}>BETA</span>
        </div>

        {/* Race Setup */}
        <Card className="mb-5">
          <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4" style={{ color: PURPLE }}>Race Setup</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Athlete Name</label>
              <input
                type="text" value={athleteName} onChange={e => setAthleteName(e.target.value)}
                placeholder="e.g. Sarah Chen"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:border-[#7C3AED]/60 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Event</label>
              <select value={event} onChange={e => handleEventChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-[#7C3AED]/60 focus:outline-none transition-colors">
                {EVENT_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-[#0e0e18]">{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Course</label>
              <select value={course} onChange={e => setCourse(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-[#7C3AED]/60 focus:outline-none transition-colors">
                <option value="SCY" className="bg-[#0e0e18]">SCY (25 yards)</option>
                <option value="SCM" className="bg-[#0e0e18]">SCM (25 meters)</option>
                <option value="LCM" className="bg-[#0e0e18]">LCM (50 meters)</option>
              </select>
            </div>
          </div>

          {/* Preset Chips */}
          {DEMOS[event] && (
            <div className="flex gap-2 mb-4">
              <button onClick={() => {
                setAthleteName(DEMOS[event].athlete);
                setManualSplits(DEMOS[event].splits.map(s => s.toFixed(2)));
              }}
                className="px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase border-2 border-white/10 text-white/60 hover:border-[#7C3AED]/60 hover:text-[#7C3AED] transition-colors">
                {DEMOS[event].name}
              </button>
            </div>
          )}

          {/* Paste Area */}
          <div className="mb-4">
            <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: PURPLE }}>Quick Entry</h3>
            <div className="rounded-xl bg-white/[0.03] border-2 border-dashed border-white/10 p-4 hover:border-[#7C3AED]/30 transition-colors">
              <p className="text-[11px] text-white/30 text-center mb-2">Paste split times (comma or space separated)</p>
              <textarea
                value={pasteInput} onChange={e => setPasteInput(e.target.value)}
                placeholder="12.34, 14.56, 15.01, 14.89"
                rows={2}
                className="w-full bg-transparent text-center text-sm text-white placeholder:text-white/20 resize-none outline-none"
              />
            </div>
          </div>

          {/* Manual Split Inputs */}
          <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: PURPLE }}>Or Enter Splits Manually</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
            {Array.from({ length: cfg.splits }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl p-3">
                <span className="text-[10px] uppercase tracking-widest text-white/40">{cfg.labels[i]}</span>
                <input
                  type="text" value={manualSplits[i] || ""} placeholder="0.00"
                  onChange={e => {
                    const next = [...manualSplits];
                    next[i] = e.target.value;
                    setManualSplits(next);
                  }}
                  className={`w-20 text-center px-2 py-2 rounded-lg border-2 text-base font-bold bg-white/5 focus:outline-none transition-colors ${
                    manualSplits[i]?.trim() ? "border-[#F59E0B]/60 bg-[#F59E0B]/5" : "border-white/10"
                  } focus:border-[#7C3AED]/60`}
                />
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleAnalyze}
              className="px-6 py-3 rounded-xl text-xs font-bold tracking-widest uppercase text-white transition-all hover:brightness-110"
              style={{ background: PURPLE }}>
              Analyze Splits
            </button>
            <button onClick={loadDemo}
              className="px-6 py-3 rounded-xl text-xs font-bold tracking-widest uppercase text-white/60 bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
              Load Demo
            </button>
            <button onClick={clearAll}
              className="px-6 py-3 rounded-xl text-xs font-bold tracking-widest uppercase text-white/60 bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
              Clear
            </button>
          </div>
        </Card>

        {/* Results */}
        {result && (
          <div ref={resultRef}>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <Card>
                <div className="h-1 rounded-full mb-3" style={{ background: PURPLE }} />
                <p className="text-[10px] uppercase tracking-widest text-white/40">Final Time</p>
                <p className="text-3xl font-black mt-1">{formatTime(result.total)}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{result.athlete}</p>
              </Card>
              <Card>
                <div className="h-1 rounded-full mb-3" style={{ background: GOLD }} />
                <p className="text-[10px] uppercase tracking-widest text-white/40">Fastest Split</p>
                <p className="text-3xl font-black mt-1">{result.fastest.toFixed(2)}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Split {result.splits.indexOf(result.fastest) + 1}</p>
              </Card>
              <Card>
                <div className="h-1 rounded-full mb-3" style={{ background: SCARLET }} />
                <p className="text-[10px] uppercase tracking-widest text-white/40">Split Range</p>
                <p className="text-3xl font-black mt-1">{result.range.toFixed(2)}s</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">CV: {result.cv.toFixed(1)}%</p>
              </Card>
              <Card>
                <div className="h-1 rounded-full mb-3" style={{ background: BLUE }} />
                <p className="text-[10px] uppercase tracking-widest text-white/40">Half Differential</p>
                <p className="text-3xl font-black mt-1">{result.splitDiff > 0 ? "+" : ""}{result.splitDiff.toFixed(2)}s</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">2nd vs 1st half</p>
              </Card>
            </div>

            {/* Pacing Chart */}
            <Card className="mb-5">
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4" style={{ color: PURPLE }}>Pacing Curve</h3>
              <PacingChart result={result} />
            </Card>

            {/* Split Breakdown Table */}
            <Card className="mb-5">
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4" style={{ color: PURPLE }}>Split Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold">Split</th>
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold">Time</th>
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold">Cumulative</th>
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold">Diff vs Avg</th>
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold">Pace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.splits.map((s, i) => {
                      const cumulative = result.splits.slice(0, i + 1).reduce((a, b) => a + b, 0);
                      const diff = s - result.avg;
                      const pct = Math.abs(diff) / result.avg * 100;
                      const barColor = diff < -0.1 ? "bg-emerald-500" : diff > 0.1 ? "bg-red-500" : "bg-amber-500";
                      const diffColor = diff < -0.1 ? "text-emerald-400" : diff > 0.1 ? "text-red-400" : "text-amber-400";
                      return (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold">{result.labels[i] || `Split ${i + 1}`}</td>
                          <td className="py-2.5 px-3 font-bold text-base">{s.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-white/60">{formatTime(cumulative)}</td>
                          <td className={`py-2.5 px-3 font-bold ${diffColor}`}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(2)}s
                          </td>
                          <td className="py-2.5 px-3 w-28">
                            <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(pct * 3 + 20, 100)}%` }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Strategy Analysis */}
            <Card>
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase mb-4" style={{ color: PURPLE }}>Race Strategy Analysis</h3>
              <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wider ${STRATEGY_STYLES[result.strategyType].bg} ${STRATEGY_STYLES[result.strategyType].text}`}>
                {result.strategy}
              </span>
              <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border-l-4 text-sm text-white/70 leading-relaxed" style={{ borderLeftColor: PURPLE }}>
                {result.recommendation}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
