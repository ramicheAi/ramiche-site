"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";

/* ══════════════════════════════════════════════════════════════
   MEET TRACKER — Standalone live swim meet tracker
   Track heats, enter times, detect PRs, view leaderboard
   ══════════════════════════════════════════════════════════════ */

// ── SFX (Web Audio API) ────────────────────────────────────
const SFX = {
  pr: () => {
    try {
      const c = new AudioContext();
      [523, 659, 784, 1047].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.frequency.value = f; o.type = "sine";
        g.gain.setValueAtTime(0, c.currentTime + i * 0.1);
        g.gain.linearRampToValueAtTime(0.12, c.currentTime + i * 0.1 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.1 + 0.3);
        o.start(c.currentTime + i * 0.1); o.stop(c.currentTime + i * 0.1 + 0.3);
      });
    } catch { /* audio not available */ }
  },
  eventDone: () => {
    try {
      const c = new AudioContext();
      [880, 1174].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.frequency.value = f; o.type = "triangle";
        g.gain.setValueAtTime(0, c.currentTime + i * 0.12);
        g.gain.linearRampToValueAtTime(0.08, c.currentTime + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.12 + 0.2);
        o.start(c.currentTime + i * 0.12); o.stop(c.currentTime + i * 0.12 + 0.2);
      });
    } catch { /* audio not available */ }
  },
};

// ── Types ──────────────────────────────────────────────────
interface DemoAthlete {
  id: string;
  name: string;
  age: number;
  gender: "M" | "F";
  bestTimes: Record<string, number>;
}

interface HeatLane {
  athleteId: string;
  seedTime: number;
  finalTime?: number;
  isPR?: boolean;
}

interface LiveEvent {
  id: string;
  num: number;
  name: string;
  gender: "M" | "F" | "Mixed";
  distance: number;
  stroke: string;
  heats: { lanes: (HeatLane | null)[] }[];
  status: "upcoming" | "current" | "completed";
}

interface LiveMeet {
  id: string;
  name: string;
  date: string;
  location: string;
  course: "SCY" | "SCM" | "LCM";
  events: LiveEvent[];
  broadcasts: { id: string; message: string; time: number }[];
}

// ── Demo Data ──────────────────────────────────────────────

const DEMO_ATHLETES: DemoAthlete[] = [
  { id: "a1", name: "Marcus Chen", age: 13, gender: "M", bestTimes: { "50 Free": 26.4, "100 Free": 57.8, "100 Back": 63.2, "200 IM": 133.5, "50 Fly": 29.1, "100 Breast": 72.3 } },
  { id: "a2", name: "Sofia Rivera", age: 12, gender: "F", bestTimes: { "50 Free": 28.1, "100 Free": 61.3, "100 Back": 67.5, "200 IM": 142.8, "50 Fly": 32.4, "100 Breast": 76.1 } },
  { id: "a3", name: "Jayden Brooks", age: 14, gender: "M", bestTimes: { "50 Free": 24.9, "100 Free": 54.2, "100 Back": 59.8, "200 IM": 126.4, "50 Fly": 27.3, "100 Breast": 68.9 } },
  { id: "a4", name: "Ava Thompson", age: 11, gender: "F", bestTimes: { "50 Free": 30.2, "100 Free": 65.7, "100 Back": 71.4, "200 IM": 152.1, "50 Fly": 35.6, "100 Breast": 81.2 } },
  { id: "a5", name: "Kai Nakamura", age: 13, gender: "M", bestTimes: { "50 Free": 25.7, "100 Free": 56.1, "100 Back": 61.5, "200 IM": 129.8, "50 Fly": 28.4, "100 Breast": 70.6 } },
  { id: "a6", name: "Zoe Washington", age: 12, gender: "F", bestTimes: { "50 Free": 29.3, "100 Free": 63.8, "100 Back": 69.2, "200 IM": 147.3, "50 Fly": 33.7, "100 Breast": 78.4 } },
  { id: "a7", name: "Ethan Park", age: 14, gender: "M", bestTimes: { "50 Free": 25.1, "100 Free": 55.3, "100 Back": 60.4, "200 IM": 128.1, "50 Fly": 27.8, "100 Breast": 69.5 } },
  { id: "a8", name: "Lily Martinez", age: 11, gender: "F", bestTimes: { "50 Free": 31.0, "100 Free": 67.2, "100 Back": 73.1, "200 IM": 155.6, "50 Fly": 36.8, "100 Breast": 83.5 } },
];

const athleteMap = Object.fromEntries(DEMO_ATHLETES.map(a => [a.id, a]));

function buildHeats(athleteIds: string[], eventName: string, lanesPerHeat = 6): { lanes: (HeatLane | null)[] }[] {
  const entries = athleteIds.map(id => ({
    athleteId: id,
    seedTime: athleteMap[id]?.bestTimes[eventName] ?? 99,
  })).sort((a, b) => a.seedTime - b.seedTime);

  const heats: { lanes: (HeatLane | null)[] }[] = [];
  for (let i = 0; i < entries.length; i += lanesPerHeat) {
    const chunk = entries.slice(i, i + lanesPerHeat);
    const lanes: (HeatLane | null)[] = Array(lanesPerHeat).fill(null);
    const order = lanesPerHeat === 6 ? [2, 3, 1, 4, 0, 5] : [3, 4, 2, 5, 1, 6, 0, 7];
    chunk.forEach((e, idx) => {
      if (idx < order.length) lanes[order[idx]] = e;
    });
    heats.push({ lanes });
  }
  return heats;
}

const DEMO_MEET: LiveMeet = {
  id: "m1",
  name: "Spring Invitational 2026",
  date: "2026-03-28",
  location: "Saint Andrew's Aquatics Center",
  course: "SCY",
  events: [
    { id: "e1", num: 1, name: "50 Free", gender: "M", distance: 50, stroke: "Free", status: "completed", heats: buildHeats(["a1", "a3", "a5", "a7"], "50 Free") },
    { id: "e2", num: 2, name: "50 Free", gender: "F", distance: 50, stroke: "Free", status: "completed", heats: buildHeats(["a2", "a4", "a6", "a8"], "50 Free") },
    { id: "e3", num: 3, name: "100 Back", gender: "M", distance: 100, stroke: "Back", status: "current", heats: buildHeats(["a1", "a3", "a5", "a7"], "100 Back") },
    { id: "e4", num: 4, name: "100 Back", gender: "F", distance: 100, stroke: "Back", status: "upcoming", heats: buildHeats(["a2", "a4", "a6", "a8"], "100 Back") },
    { id: "e5", num: 5, name: "200 IM", gender: "M", distance: 200, stroke: "IM", status: "upcoming", heats: buildHeats(["a1", "a3", "a5", "a7"], "200 IM") },
    { id: "e6", num: 6, name: "200 IM", gender: "F", distance: 200, stroke: "IM", status: "upcoming", heats: buildHeats(["a2", "a4", "a6", "a8"], "200 IM") },
    { id: "e7", num: 7, name: "50 Fly", gender: "M", distance: 50, stroke: "Fly", status: "upcoming", heats: buildHeats(["a1", "a3", "a5", "a7"], "50 Fly") },
    { id: "e8", num: 8, name: "50 Fly", gender: "F", distance: 50, stroke: "Fly", status: "upcoming", heats: buildHeats(["a2", "a4", "a6", "a8"], "50 Fly") },
    { id: "e9", num: 9, name: "100 Breast", gender: "M", distance: 100, stroke: "Breast", status: "upcoming", heats: buildHeats(["a1", "a3", "a5", "a7"], "100 Breast") },
    { id: "e10", num: 10, name: "100 Breast", gender: "F", distance: 100, stroke: "Breast", status: "upcoming", heats: buildHeats(["a2", "a4", "a6", "a8"], "100 Breast") },
  ],
  broadcasts: [
    { id: "b1", message: "Welcome to Spring Invitational 2026!", time: Date.now() - 3600000 },
    { id: "b2", message: "Event 3 -- 100 Back Boys -- Now on the blocks", time: Date.now() - 60000 },
    { id: "b3", message: "Reminder: Warm-down pool closes at 4 PM", time: Date.now() - 30000 },
  ],
};

// ── Helpers ─────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(2).padStart(5, "0");
    return `${m}:${s}`;
  }
  return seconds.toFixed(2);
}

function parseTimeInput(val: string): number | null {
  const v = val.trim();
  if (!v) return null;
  const colonMatch = v.match(/^(\d+):(\d{2}\.\d{1,2})$/);
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseFloat(colonMatch[2]);
  const plain = parseFloat(v);
  return isNaN(plain) ? null : plain;
}

// ── Broadcast Ticker ────────────────────────────────────────

function BroadcastTicker({ messages }: { messages: { id: string; message: string; time: number }[] }) {
  const sorted = [...messages].sort((a, b) => b.time - a.time);
  return (
    <div className="w-full overflow-hidden bg-[#00f0ff]/10 border-b border-[#00f0ff]/20 py-2">
      <div className="animate-[marquee_20s_linear_infinite] whitespace-nowrap flex gap-12 text-sm text-[#00f0ff]">
        {sorted.concat(sorted).map((b, i) => (
          <span key={`${b.id}-${i}`} className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
            {b.message}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Countdown Ring (CSS only) ───────────────────────────────

function CountdownRing({ seconds, label }: { seconds: number; label: string }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const tid = setTimeout(() => setRemaining(seconds), 0);
    const iv = setInterval(() => {
      setRemaining(p => {
        if (p <= 1) { clearInterval(iv); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { clearTimeout(tid); clearInterval(iv); };
  }, [seconds]);

  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - remaining / seconds);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#00f0ff" strokeOpacity={0.1} strokeWidth={4} />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke="#00f0ff" strokeWidth={4} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="drop-shadow-[0_0_8px_rgba(0,240,255,0.6)] transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-mono font-bold text-[#f8fafc]">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </span>
        </div>
      </div>
      <span className="text-xs text-[#00f0ff]/70 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── PR Celebration (CSS only) ───────────────────────────────

function PRCelebration({ athleteName, time, improvement }: { athleteName: string; time: string; improvement: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-[fadeIn_0.3s_ease-out]">
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full animate-[prBurst_1.5s_ease-out_forwards]"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />
        <div className="relative text-center z-10 animate-[slideUp_0.5s_ease-out_0.3s_both]">
          <div className="text-5xl font-black text-[#f59e0b] drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]">
            +PR!
          </div>
          <div className="text-xl font-bold text-[#f8fafc] mt-2">{athleteName}</div>
          <div className="text-lg text-[#00f0ff] font-mono">{time}</div>
          <div className="text-sm text-[#f59e0b] mt-1">-{improvement.toFixed(2)}s improvement</div>
        </div>
      </div>
    </div>
  );
}

// ── Event Timeline ──────────────────────────────────────────

function EventTimeline({ events, currentIdx, onSelect }: { events: LiveEvent[]; currentIdx: number; onSelect: (i: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.children[currentIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentIdx]);

  return (
    <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {events.map((ev, i) => {
        const isCurrent = i === currentIdx;
        const isDone = ev.status === "completed";
        return (
          <button
            key={ev.id}
            onClick={() => onSelect(i)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-all active:scale-95
              ${isCurrent ? "border-[#00f0ff] bg-[#00f0ff]/15 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.3)]" : ""}
              ${isDone ? "border-[#a855f7]/30 bg-[#a855f7]/10 text-[#a855f7]/80" : ""}
              ${!isCurrent && !isDone ? "border-[#f8fafc]/10 text-[#f8fafc]/50 hover:border-[#f8fafc]/30" : ""}
            `}
          >
            <div className="text-[10px] opacity-60">E{ev.num}</div>
            <div className="whitespace-nowrap">{ev.distance} {ev.stroke}</div>
            <div className="text-[10px] opacity-60">{ev.gender === "M" ? "Boys" : ev.gender === "F" ? "Girls" : "Mixed"}</div>
            {isDone && <div className="text-[10px] text-[#a855f7]">Done</div>}
            {isCurrent && (
              <div className="w-full h-0.5 bg-[#00f0ff] rounded-full mt-1 animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Pool Lane Grid ──────────────────────────────────────────

function PoolLaneGrid({
  heat, heatIdx, eventStatus, onTapLane
}: {
  heat: { lanes: (HeatLane | null)[] };
  heatIdx: number;
  eventStatus: string;
  onTapLane: (laneIdx: number) => void;
}) {
  return (
    <div className="relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#00f0ff] uppercase tracking-wider">
          Heat {heatIdx + 1}
        </h3>
        {eventStatus === "current" && (
          <span className="text-xs text-[#f8fafc]/40">Tap lane to enter time</span>
        )}
      </div>
      <div className="space-y-1">
        {heat.lanes.map((lane, laneIdx) => {
          const athlete = lane ? athleteMap[lane.athleteId] : null;
          const hasFinal = lane?.finalTime != null;
          const isPR = lane?.isPR;
          return (
            <button
              key={laneIdx}
              onClick={() => lane && eventStatus === "current" && onTapLane(laneIdx)}
              disabled={!lane || eventStatus !== "current"}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]
                ${!lane ? "border-[#f8fafc]/5 bg-[#f8fafc]/[0.02] opacity-30 cursor-default" : ""}
                ${lane && !hasFinal && eventStatus === "current" ? "border-[#00f0ff]/20 bg-[#00f0ff]/[0.05] hover:bg-[#00f0ff]/10 cursor-pointer" : ""}
                ${lane && !hasFinal && eventStatus !== "current" ? "border-[#f8fafc]/10 bg-[#f8fafc]/[0.03] cursor-default" : ""}
                ${hasFinal && !isPR ? "border-[#a855f7]/30 bg-[#a855f7]/10 cursor-default" : ""}
                ${isPR ? "border-[#f59e0b]/50 bg-[#f59e0b]/10 shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-default" : ""}
              `}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${isPR ? "bg-[#f59e0b]/20 text-[#f59e0b]" : "bg-[#00f0ff]/10 text-[#00f0ff]/60"}
              `}>
                {laneIdx + 1}
              </div>
              <div className="flex-1 text-left min-w-0">
                {athlete ? (
                  <>
                    <div className={`text-sm font-medium truncate ${isPR ? "text-[#f59e0b]" : "text-[#f8fafc]"}`}>
                      {athlete.name}
                    </div>
                    <div className="text-xs text-[#f8fafc]/40">
                      Seed: {fmtTime(lane!.seedTime)}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-[#f8fafc]/20">Empty</div>
                )}
              </div>
              {hasFinal && (
                <div className="text-right">
                  <div className={`text-sm font-mono font-bold ${isPR ? "text-[#f59e0b]" : "text-[#f8fafc]"}`}>
                    {fmtTime(lane!.finalTime!)}
                  </div>
                  {isPR && (
                    <div className="text-xs font-bold text-[#f59e0b] animate-pulse">PR!</div>
                  )}
                  {!isPR && lane!.finalTime! < lane!.seedTime && (
                    <div className="text-xs text-green-400">
                      -{(lane!.seedTime - lane!.finalTime!).toFixed(2)}
                    </div>
                  )}
                  {!isPR && lane!.finalTime! >= lane!.seedTime && (
                    <div className="text-xs text-[#f8fafc]/40">
                      +{(lane!.finalTime! - lane!.seedTime).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
              {lane && !hasFinal && (
                <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Time Entry Modal ────────────────────────────────────────

function TimeEntryModal({
  athlete, seedTime, bestTime, onSubmit, onClose
}: {
  athlete: DemoAthlete;
  seedTime: number;
  bestTime: number;
  onSubmit: (time: number) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    const t = parseTimeInput(val);
    if (t && t > 0) onSubmit(t);
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0e0e18] border border-[#00f0ff]/20 rounded-t-2xl sm:rounded-2xl p-6 animate-[slideUp_0.3s_ease-out]"
      >
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-[#f8fafc]">{athlete.name}</h3>
          <div className="flex justify-center gap-4 mt-1 text-xs text-[#f8fafc]/50">
            <span>Seed: <span className="text-[#00f0ff] font-mono">{fmtTime(seedTime)}</span></span>
            <span>Best: <span className="text-[#a855f7] font-mono">{fmtTime(bestTime)}</span></span>
          </div>
        </div>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          placeholder="1:03.45 or 63.45"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          className="w-full bg-[#06020f] border border-[#00f0ff]/30 rounded-xl px-4 py-3 text-center text-xl font-mono text-[#f8fafc] placeholder-[#f8fafc]/20 focus:outline-none focus:border-[#00f0ff] focus:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[#f8fafc]/10 text-[#f8fafc]/50 text-sm hover:border-[#f8fafc]/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-xl bg-[#00f0ff]/20 border border-[#00f0ff]/50 text-[#00f0ff] text-sm font-bold hover:bg-[#00f0ff]/30 transition"
          >
            Record Time
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard ─────────────────────────────────────────────

function Leaderboard({ events }: { events: LiveEvent[] }) {
  const PLACE_POINTS = [7, 5, 4, 3, 2, 1];
  const points: Record<string, number> = {};

  events.filter(e => e.status === "completed").forEach(ev => {
    const results: { athleteId: string; time: number }[] = [];
    ev.heats.forEach(heat => {
      heat.lanes.forEach(lane => {
        if (lane?.finalTime != null) {
          results.push({ athleteId: lane.athleteId, time: lane.finalTime });
        }
      });
    });
    results.sort((a, b) => a.time - b.time);
    results.forEach((r, i) => {
      if (i < PLACE_POINTS.length) {
        points[r.athleteId] = (points[r.athleteId] || 0) + PLACE_POINTS[i];
      }
    });
  });

  const sorted = Object.entries(points)
    .map(([id, pts]) => ({ athlete: athleteMap[id], pts }))
    .filter(e => e.athlete)
    .sort((a, b) => b.pts - a.pts);

  if (sorted.length === 0) return null;

  const glowColors = ["#f59e0b", "#94a3b8", "#cd7f32"];

  return (
    <div className="relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-4">
      <h3 className="text-sm font-bold text-[#f8fafc]/60 uppercase tracking-wider mb-3">Team Leaderboard</h3>
      <div className="space-y-1.5">
        {sorted.map((entry, i) => (
          <div
            key={entry.athlete.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border transition-all"
            style={i < 3 ? {
              borderColor: `${glowColors[i]}40`,
              backgroundColor: `${glowColors[i]}0D`,
              boxShadow: `0 0 12px ${glowColors[i]}20`,
            } : { borderColor: "rgba(248,250,252,0.05)" }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={i < 3 ? { background: `${glowColors[i]}30`, color: glowColors[i] } : { color: "#f8fafc50" }}
            >
              {i + 1}
            </div>
            <span className={`flex-1 text-sm font-medium ${i < 3 ? "text-[#f8fafc]" : "text-[#f8fafc]/60"}`}>
              {entry.athlete.name}
            </span>
            <span className="text-sm font-mono font-bold" style={{ color: i < 3 ? glowColors[i] : "#f8fafc80" }}>
              {entry.pts}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Meet Stats Summary ──────────────────────────────────────

function MeetStats({ meet }: { meet: LiveMeet }) {
  const completedEvents = meet.events.filter(e => e.status === "completed");
  let totalPRs = 0;
  let totalSwims = 0;
  completedEvents.forEach(ev => {
    ev.heats.forEach(heat => {
      heat.lanes.forEach(lane => {
        if (lane?.finalTime != null) {
          totalSwims++;
          if (lane.isPR) totalPRs++;
        }
      });
    });
  });

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-[#06020f]/80 border border-[#00f0ff]/15 rounded-xl p-3 text-center">
        <div className="text-2xl font-black text-[#00f0ff]">{completedEvents.length}/{meet.events.length}</div>
        <div className="text-[10px] text-[#f8fafc]/40 uppercase tracking-wider mt-1">Events</div>
      </div>
      <div className="bg-[#06020f]/80 border border-[#f59e0b]/15 rounded-xl p-3 text-center">
        <div className="text-2xl font-black text-[#f59e0b]">{totalPRs}</div>
        <div className="text-[10px] text-[#f8fafc]/40 uppercase tracking-wider mt-1">PRs</div>
      </div>
      <div className="bg-[#06020f]/80 border border-[#a855f7]/15 rounded-xl p-3 text-center">
        <div className="text-2xl font-black text-[#a855f7]">{totalSwims}</div>
        <div className="text-[10px] text-[#f8fafc]/40 uppercase tracking-wider mt-1">Swims</div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────

export default function MeetTracker() {
  const [meet, setMeet] = useState<LiveMeet>(DEMO_MEET);
  const [selectedEventIdx, setSelectedEventIdx] = useState<number>(() => {
    const idx = DEMO_MEET.events.findIndex(e => e.status === "current");
    return idx >= 0 ? idx : 0;
  });
  const [editLane, setEditLane] = useState<{ eventIdx: number; heatIdx: number; laneIdx: number } | null>(null);
  const [prCelebration, setPrCelebration] = useState<{ name: string; time: string; improvement: number } | null>(null);
  const [tab, setTab] = useState<"events" | "leaderboard">("events");

  const currentEvent = meet.events[selectedEventIdx];

  const handleTimeSubmit = useCallback((time: number) => {
    if (!editLane) return;
    const { eventIdx, heatIdx, laneIdx } = editLane;

    setMeet(prev => {
      const next = structuredClone(prev);
      const ev = next.events[eventIdx];
      const lane = ev.heats[heatIdx].lanes[laneIdx];
      if (!lane) return prev;

      lane.finalTime = time;
      const athlete = athleteMap[lane.athleteId];
      const eventName = `${ev.distance} ${ev.stroke}`;
      const best = athlete?.bestTimes[eventName];

      if (best && time < best) {
        lane.isPR = true;
        SFX.pr();
        setPrCelebration({
          name: athlete.name,
          time: fmtTime(time),
          improvement: best - time,
        });
        setTimeout(() => setPrCelebration(null), 3000);
      }

      const allDone = ev.heats.every(h => h.lanes.every(l => !l || l.finalTime != null));
      if (allDone && ev.status !== "completed") {
        ev.status = "completed";
        SFX.eventDone();
        const nextIdx = next.events.findIndex(e => e.status === "upcoming");
        if (nextIdx >= 0) {
          next.events[nextIdx].status = "current";
          setTimeout(() => setSelectedEventIdx(nextIdx), 500);
        }
      }

      return next;
    });

    setEditLane(null);
  }, [editLane]);

  const handleAdvanceEvent = useCallback(() => {
    setMeet(prev => {
      const next = structuredClone(prev);
      const curIdx = next.events.findIndex(e => e.status === "current");
      if (curIdx >= 0) next.events[curIdx].status = "completed";
      const nextIdx = next.events.findIndex(e => e.status === "upcoming");
      if (nextIdx >= 0) {
        next.events[nextIdx].status = "current";
        setSelectedEventIdx(nextIdx);
      }
      return next;
    });
    SFX.eventDone();
  }, []);

  const hasUpcoming = meet.events.some(e => e.status === "upcoming");

  const editingAthlete = editLane
    ? athleteMap[currentEvent.heats[editLane.heatIdx].lanes[editLane.laneIdx]?.athleteId ?? ""]
    : null;
  const editingLaneData = editLane
    ? currentEvent.heats[editLane.heatIdx].lanes[editLane.laneIdx]
    : null;
  const editingEventName = editLane
    ? `${currentEvent.distance} ${currentEvent.stroke}`
    : "";

  return (
    <div className="min-h-screen bg-[#0e0e18] text-[#f8fafc]">
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes prBurst { 0% { transform: scale(0.5); opacity: 0; } 50% { opacity: 0.6; } 100% { transform: scale(3); opacity: 0; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <BroadcastTicker messages={meet.broadcasts} />

      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider bg-gradient-to-r from-[#00f0ff] to-[#a855f7] bg-clip-text text-transparent">
              Meet Tracker
            </h1>
            <p className="text-xs text-[#f8fafc]/40">{meet.name} &middot; {meet.location}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#f8fafc]/30 font-mono">{meet.course}</span>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">LIVE</span>
          </div>
        </div>

        <MeetStats meet={meet} />

        {/* Tab Switcher */}
        <div className="flex gap-2 mt-3 mb-2">
          <button
            onClick={() => setTab("events")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              tab === "events"
                ? "bg-[#00f0ff]/15 border border-[#00f0ff]/40 text-[#00f0ff]"
                : "border border-[#f8fafc]/10 text-[#f8fafc]/40 hover:text-[#f8fafc]/60"
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              tab === "leaderboard"
                ? "bg-[#a855f7]/15 border border-[#a855f7]/40 text-[#a855f7]"
                : "border border-[#f8fafc]/10 text-[#f8fafc]/40 hover:text-[#f8fafc]/60"
            }`}
          >
            Leaderboard
          </button>
        </div>

        {tab === "events" && (
          <EventTimeline
            events={meet.events}
            currentIdx={selectedEventIdx}
            onSelect={setSelectedEventIdx}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="px-4 pb-24 space-y-4">
        {tab === "events" && (
          <>
            {/* Current Event Header */}
            <div key={currentEvent.id}>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-xs uppercase tracking-wider ${
                    currentEvent.status === "current" ? "text-[#00f0ff]" :
                    currentEvent.status === "completed" ? "text-[#a855f7]" : "text-[#f8fafc]/30"
                  }`}>
                    Event {currentEvent.num} &middot; {currentEvent.gender === "M" ? "Boys" : currentEvent.gender === "F" ? "Girls" : "Mixed"}
                  </span>
                  <h2 className="text-2xl font-black text-[#f8fafc]">
                    {currentEvent.distance} {currentEvent.stroke}
                  </h2>
                </div>

                {currentEvent.status === "current" && hasUpcoming && (
                  <button
                    onClick={handleAdvanceEvent}
                    className="px-4 py-2 rounded-xl border border-[#a855f7]/40 bg-[#a855f7]/10 text-[#a855f7] text-sm font-bold hover:bg-[#a855f7]/20 transition active:scale-95"
                  >
                    Complete Event
                  </button>
                )}
              </div>

              {currentEvent.status === "upcoming" && (
                <div className="flex justify-center py-6">
                  <CountdownRing seconds={180} label="Until this event" />
                </div>
              )}
            </div>

            {/* Heat/Lane Grids */}
            {(currentEvent.status === "current" || currentEvent.status === "completed") && (
              <div className="space-y-3">
                {currentEvent.heats.map((heat, heatIdx) => (
                  <PoolLaneGrid
                    key={heatIdx}
                    heat={heat}
                    heatIdx={heatIdx}
                    eventStatus={currentEvent.status}
                    onTapLane={(laneIdx) => {
                      setEditLane({ eventIdx: selectedEventIdx, heatIdx, laneIdx });
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "leaderboard" && (
          <Leaderboard events={meet.events} />
        )}
      </div>

      {/* Time Entry Modal */}
      {editLane && editingAthlete && editingLaneData && (
        <TimeEntryModal
          athlete={editingAthlete}
          seedTime={editingLaneData.seedTime}
          bestTime={editingAthlete.bestTimes[editingEventName] ?? editingLaneData.seedTime}
          onSubmit={handleTimeSubmit}
          onClose={() => setEditLane(null)}
        />
      )}

      {/* PR Celebration */}
      {prCelebration && (
        <PRCelebration
          athleteName={prCelebration.name}
          time={prCelebration.time}
          improvement={prCelebration.improvement}
        />
      )}
    </div>
  );
}
