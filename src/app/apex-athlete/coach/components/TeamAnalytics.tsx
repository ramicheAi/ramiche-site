"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import BgOrbs from "./BgOrbs";

const PURPLE = "#7C3AED";
const SCARLET = "#DC2626";
const GOLD = "#F59E0B";
const BLUE = "#2563EB";
const GREEN = "#059669";

interface TeamAnalyticsProps {
  GameHUDHeader: React.ComponentType;
}

const LEVELS = ["Rookie", "Contender", "Warrior", "Elite", "Captain", "Legend"];
const LEVEL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#7c3aed", "#ec4899", "#d97706"];
const LEVEL_XP = [0, 200, 500, 1000, 1800, 3000];

function timeToSec(t: string): number {
  const p = t.split(/[:.]/);
  if (p.length === 3) return +p[0] * 60 + +p[1] + +p[2] / 100;
  return +p[0] + +p[1] / 100;
}

function secToTime(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return m + ":" + r.toFixed(2).padStart(5, "0");
  }
  return s.toFixed(2);
}

interface RaceResult {
  date: string;
  meet: string;
  time: string;
  splits: string[];
}

interface AthleteData {
  name: string;
  level: string;
  xp: number;
  age: number;
  group: string;
  events: Record<string, RaceResult[]>;
}

const athletes: AthleteData[] = [
  {
    name: "Marcus Williams", level: "Warrior", xp: 680, age: 14, group: "13-14",
    events: {
      "50 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "25.43", splits: ["12.21", "13.22"] },
        { date: "2025-10-19", meet: "October Classic", time: "25.11", splits: ["12.05", "13.06"] },
        { date: "2025-11-16", meet: "Turkey Splash", time: "24.78", splits: ["11.92", "12.86"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "24.52", splits: ["11.80", "12.72"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "24.31", splits: ["11.71", "12.60"] },
        { date: "2026-02-15", meet: "February Fast", time: "24.15", splits: ["11.65", "12.50"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "23.98", splits: ["11.55", "12.43"] },
      ],
      "100 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "56.87", splits: ["26.91", "29.96"] },
        { date: "2025-10-19", meet: "October Classic", time: "55.94", splits: ["26.40", "29.54"] },
        { date: "2025-11-16", meet: "Turkey Splash", time: "55.21", splits: ["26.12", "29.09"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "54.63", splits: ["25.82", "28.81"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "54.10", splits: ["25.55", "28.55"] },
        { date: "2026-02-15", meet: "February Fast", time: "53.72", splits: ["25.31", "28.41"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "53.28", splits: ["25.10", "28.18"] },
      ],
      "200 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "2:05.60", splits: ["29.10", "31.45", "32.80", "32.25"] },
        { date: "2025-11-16", meet: "Turkey Splash", time: "2:03.12", splits: ["28.70", "31.00", "32.20", "31.22"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "2:01.44", splits: ["28.40", "30.60", "31.50", "30.94"] },
        { date: "2026-02-15", meet: "February Fast", time: "1:59.87", splits: ["28.10", "30.20", "31.10", "30.47"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "1:58.52", splits: ["27.80", "29.90", "30.70", "30.12"] },
      ],
      "100 Fly": [
        { date: "2025-10-19", meet: "October Classic", time: "1:05.33", splits: ["30.10", "35.23"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "1:03.87", splits: ["29.60", "34.27"] },
        { date: "2026-02-15", meet: "February Fast", time: "1:02.40", splits: ["29.12", "33.28"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "1:01.15", splits: ["28.75", "32.40"] },
      ],
    },
  },
  {
    name: "Sofia Chen", level: "Elite", xp: 1250, age: 15, group: "15-16",
    events: {
      "100 Back": [
        { date: "2025-09-14", meet: "Fall Invite", time: "1:05.92", splits: ["32.10", "33.82"] },
        { date: "2025-11-16", meet: "Turkey Splash", time: "1:04.65", splits: ["31.50", "33.15"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "1:03.40", splits: ["31.00", "32.40"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "1:02.18", splits: ["30.45", "31.73"] },
      ],
      "200 Back": [
        { date: "2025-09-14", meet: "Fall Invite", time: "2:18.50", splits: ["32.40", "34.80", "35.60", "35.70"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "2:15.22", splits: ["31.80", "34.10", "34.80", "34.52"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "2:12.05", splits: ["31.20", "33.40", "33.90", "33.55"] },
      ],
      "200 IM": [
        { date: "2025-10-19", meet: "October Classic", time: "2:22.10", splits: ["30.50", "36.40", "39.80", "35.40"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "2:19.45", splits: ["29.90", "35.80", "38.90", "34.85"] },
        { date: "2026-02-15", meet: "February Fast", time: "2:17.20", splits: ["29.40", "35.20", "38.20", "34.40"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "2:15.33", splits: ["29.10", "34.80", "37.50", "33.93"] },
      ],
      "50 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "27.10", splits: ["13.10", "14.00"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "26.42", splits: ["12.80", "13.62"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "25.95", splits: ["12.55", "13.40"] },
      ],
    },
  },
  {
    name: "Jayden Brooks", level: "Captain", xp: 1920, age: 16, group: "15-16",
    events: {
      "100 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "51.20", splits: ["24.50", "26.70"] },
        { date: "2025-11-16", meet: "Turkey Splash", time: "50.75", splits: ["24.30", "26.45"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "50.22", splits: ["24.10", "26.12"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "49.88", splits: ["23.90", "25.98"] },
      ],
      "200 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "1:52.40", splits: ["26.50", "28.30", "29.10", "28.50"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "1:50.80", splits: ["26.10", "27.90", "28.70", "28.10"] },
        { date: "2026-02-15", meet: "February Fast", time: "1:49.55", splits: ["25.80", "27.60", "28.40", "27.75"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "1:48.20", splits: ["25.50", "27.30", "28.10", "27.30"] },
      ],
      "500 Free": [
        { date: "2025-10-19", meet: "October Classic", time: "5:05.10", splits: ["27.50", "29.80", "30.50", "31.00", "31.20", "31.40", "31.20", "30.80", "30.60", "31.10"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "4:59.80", splits: ["27.20", "29.40", "30.10", "30.50", "30.70", "30.90", "30.60", "30.20", "29.80", "30.40"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "4:55.15", splits: ["26.90", "29.00", "29.70", "30.10", "30.30", "30.40", "30.10", "29.70", "29.30", "29.65"] },
      ],
      "50 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "23.80", splits: ["11.40", "12.40"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "23.42", splits: ["11.25", "12.17"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "23.10", splits: ["11.10", "12.00"] },
      ],
    },
  },
  {
    name: "Ava Rodriguez", level: "Contender", xp: 320, age: 12, group: "11-12",
    events: {
      "50 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "30.55", splits: ["14.80", "15.75"] },
        { date: "2025-11-16", meet: "Turkey Splash", time: "30.10", splits: ["14.60", "15.50"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "29.72", splits: ["14.40", "15.32"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "29.35", splits: ["14.20", "15.15"] },
      ],
      "100 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "1:06.80", splits: ["31.90", "34.90"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "1:05.20", splits: ["31.20", "34.00"] },
        { date: "2026-02-15", meet: "February Fast", time: "1:04.10", splits: ["30.70", "33.40"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "1:03.25", splits: ["30.30", "32.95"] },
      ],
      "50 Back": [
        { date: "2025-09-14", meet: "Fall Invite", time: "35.40", splits: ["17.20", "18.20"] },
        { date: "2025-11-16", meet: "Turkey Splash", time: "34.85", splits: ["16.90", "17.95"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "34.30", splits: ["16.60", "17.70"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "33.82", splits: ["16.35", "17.47"] },
      ],
      "100 Breast": [
        { date: "2025-10-19", meet: "October Classic", time: "1:22.40", splits: ["39.10", "43.30"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "1:20.55", splits: ["38.40", "42.15"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "1:19.10", splits: ["37.80", "41.30"] },
      ],
    },
  },
  {
    name: "Ethan Park", level: "Rookie", xp: 85, age: 10, group: "10&U",
    events: {
      "50 Free": [
        { date: "2025-10-19", meet: "October Classic", time: "34.20", splits: ["16.50", "17.70"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "33.55", splits: ["16.20", "17.35"] },
        { date: "2026-02-15", meet: "February Fast", time: "33.10", splits: ["16.00", "17.10"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "32.72", splits: ["15.82", "16.90"] },
      ],
      "100 Free": [
        { date: "2025-10-19", meet: "October Classic", time: "1:15.80", splits: ["35.90", "39.90"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "1:14.10", splits: ["35.10", "39.00"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "1:12.55", splits: ["34.40", "38.15"] },
      ],
      "50 Back": [
        { date: "2025-11-16", meet: "Turkey Splash", time: "40.10", splits: ["19.50", "20.60"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "39.20", splits: ["19.00", "20.20"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "38.45", splits: ["18.60", "19.85"] },
      ],
    },
  },
  {
    name: "Lily Nguyen", level: "Warrior", xp: 720, age: 13, group: "13-14",
    events: {
      "100 Breast": [
        { date: "2025-09-14", meet: "Fall Invite", time: "1:18.90", splits: ["37.20", "41.70"] },
        { date: "2025-11-16", meet: "Turkey Splash", time: "1:17.45", splits: ["36.60", "40.85"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "1:16.22", splits: ["36.10", "40.12"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "1:15.10", splits: ["35.60", "39.50"] },
      ],
      "200 Breast": [
        { date: "2025-10-19", meet: "October Classic", time: "2:48.30", splits: ["37.80", "42.50", "44.20", "43.80"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "2:45.10", splits: ["37.20", "41.80", "43.40", "42.70"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "2:41.55", splits: ["36.60", "41.10", "42.50", "41.35"] },
      ],
      "200 IM": [
        { date: "2025-09-14", meet: "Fall Invite", time: "2:28.70", splits: ["31.20", "38.40", "41.50", "37.60"] },
        { date: "2025-12-14", meet: "Winter Champs", time: "2:25.80", splits: ["30.60", "37.80", "40.50", "36.90"] },
        { date: "2026-02-15", meet: "February Fast", time: "2:23.40", splits: ["30.10", "37.20", "39.80", "36.30"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "2:21.55", splits: ["29.70", "36.70", "39.10", "36.05"] },
      ],
      "50 Free": [
        { date: "2025-09-14", meet: "Fall Invite", time: "28.90", splits: ["13.90", "15.00"] },
        { date: "2026-01-18", meet: "New Year Invite", time: "28.20", splits: ["13.60", "14.60"] },
        { date: "2026-03-08", meet: "Spring Qualifier", time: "27.65", splits: ["13.30", "14.35"] },
      ],
    },
  },
];

type ViewType = "overview" | "drops" | "pace" | "team" | "insights";

const NAV_ITEMS: { id: ViewType; icon: string; label: string }[] = [
  { id: "overview", icon: "◉", label: "Overview" },
  { id: "drops", icon: "▼", label: "Time Drops" },
  { id: "pace", icon: "◈", label: "Pace Analysis" },
  { id: "team", icon: "◆", label: "Team Rankings" },
  { id: "insights", icon: "◇", label: "AI Insights" },
];

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`game-panel game-panel-border relative bg-[#06020f]/80 backdrop-blur-xl border border-[#7C3AED]/15 transition-all duration-300 hover:border-[#7C3AED]/30 shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-2xl p-5 ${className}`}>
    {children}
  </div>
);

function useCanvasChart(drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, deps: React.DependencyList, height = 220) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    canvas.width = w * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, height);
    drawFn(ctx, w, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return canvasRef;
}

function drawLineChart(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  datasets: { data: number[]; color: string }[],
  labels: string[],
  opts: { formatY?: (v: number) => string; minY?: number } = {}
) {
  const pad = { t: 20, r: 20, b: 40, l: 55 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

  const allVals: number[] = [];
  datasets.forEach(d => allVals.push(...d.data));
  let minV = opts.minY !== undefined ? opts.minY : Math.min(...allVals);
  let maxV = Math.max(...allVals);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const range = maxV - minV;

  ctx.strokeStyle = "#ffffff10";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * (1 - i / 4);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
    ctx.fillStyle = "#a78bfa";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    const val = minV + range * (i / 4);
    ctx.fillText(opts.formatY ? opts.formatY(val) : val.toFixed(2), pad.l - 8, y + 4);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#a78bfa80";
  const step = Math.max(1, Math.floor(labels.length / 6));
  labels.forEach((l, i) => {
    if (i % step === 0 || i === labels.length - 1) {
      const x = pad.l + (i / (labels.length - 1 || 1)) * cw;
      ctx.fillText(l.length > 5 ? l.slice(5) : l, x, h - 8);
    }
  });

  datasets.forEach(d => {
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    d.data.forEach((v, i) => {
      const x = pad.l + (i / (d.data.length - 1 || 1)) * cw;
      const y = pad.t + ch * (1 - (v - minV) / range);
      if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
    });
    ctx.stroke();
    d.data.forEach((v, i) => {
      const x = pad.l + (i / (d.data.length - 1 || 1)) * cw;
      const y = pad.t + ch * (1 - (v - minV) / range);
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#06020f";
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    });
  });
}

function drawBarChart(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  data: number[], labels: string[], colors: string[]
) {
  const pad = { t: 20, r: 20, b: 40, l: 55 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const maxV = Math.max(...data) * 1.15;
  const barW = Math.min(40, cw / data.length * 0.6);
  const gap = (cw - barW * data.length) / (data.length + 1);

  ctx.strokeStyle = "#ffffff10";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * (1 - i / 4);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
    ctx.fillStyle = "#a78bfa";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText((maxV * (i / 4)).toFixed(1), pad.l - 8, y + 4);
  }

  data.forEach((v, i) => {
    const x = pad.l + gap + (gap + barW) * i;
    const bh = (v / maxV) * ch;
    const y = pad.t + ch - bh;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, 4);
    ctx.fill();
    ctx.fillStyle = "#a78bfa80";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(labels[i], x + barW / 2, h - 8);
  });
}

function getAthleteStats(a: AthleteData) {
  let totalDrop = 0, pbs = 0;
  const meets = new Set<string>();
  const consistency: number[] = [];

  Object.keys(a.events).forEach(ev => {
    const times = a.events[ev];
    if (times.length < 2) return;
    const first = timeToSec(times[0].time);
    const last = timeToSec(times[times.length - 1].time);
    totalDrop += first - last;
    let best = Infinity;
    times.forEach(t => {
      const s = timeToSec(t.time);
      if (s < best) { pbs++; best = s; }
      meets.add(t.date);
    });
    for (let i = 1; i < times.length; i++) {
      consistency.push(timeToSec(times[i - 1].time) - timeToSec(times[i].time));
    }
  });

  const avgCon = consistency.length ? consistency.reduce((s, v) => s + v, 0) / consistency.length : 0;
  const sdCon = consistency.length > 1 ? Math.sqrt(consistency.reduce((s, v) => s + (v - avgCon) ** 2, 0) / consistency.length) : 0;
  const cv = avgCon ? sdCon / Math.abs(avgCon) : 0;

  return { totalDrop, pbs, meets: meets.size, cv };
}

function OverviewView({ a, eventFilter }: { a: AthleteData; eventFilter: string }) {
  const stats = useMemo(() => getAthleteStats(a), [a]);

  const allResults = useMemo(() => {
    const results: (RaceResult & { event: string; timeSec: number })[] = [];
    const evts = eventFilter === "all" ? Object.keys(a.events) : [eventFilter];
    evts.forEach(ev => {
      if (!a.events[ev]) return;
      a.events[ev].forEach(r => results.push({ ...r, event: ev, timeSec: timeToSec(r.time) }));
    });
    return results.sort((a, b) => a.date.localeCompare(b.date));
  }, [a, eventFilter]);

  const chartRef = useCanvasChart((ctx, w, h) => {
    if (eventFilter !== "all" && a.events[eventFilter]) {
      const evData = a.events[eventFilter];
      drawLineChart(ctx, w, h,
        [{ data: evData.map(r => timeToSec(r.time)), color: PURPLE }],
        evData.map(r => r.date),
        { formatY: v => secToTime(v) }
      );
    } else {
      const datasets: { data: number[]; color: string }[] = [];
      const colors = [PURPLE, BLUE, GREEN, SCARLET, GOLD, "#db2777"];
      const allDates = [...new Set(Object.values(a.events).flat().map(r => r.date))].sort();
      let ci = 0;
      Object.keys(a.events).forEach(ev => {
        const times = a.events[ev];
        const first = timeToSec(times[0].time);
        const data = allDates.map(d => {
          const match = times.find(t => t.date === d);
          return match ? ((first - timeToSec(match.time)) / first) * 100 : null;
        }).filter((v): v is number => v !== null);
        if (data.length > 1) datasets.push({ data, color: colors[ci % colors.length] });
        ci++;
      });
      drawLineChart(ctx, w, h, datasets, allDates, { formatY: v => v.toFixed(1) + "%", minY: 0 });
    }
  }, [a, eventFilter]);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Total Time Dropped</p>
          <p className="text-2xl font-black mt-1" style={{ color: GREEN }}>{stats.totalDrop.toFixed(2)}s</p>
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Personal Bests</p>
          <p className="text-2xl font-black mt-1" style={{ color: GREEN }}>{stats.pbs}</p>
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Meets This Season</p>
          <p className="text-2xl font-black mt-1">{stats.meets}</p>
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-white/40">METTLE Level</p>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold badge-${a.level.toLowerCase()}`}
            style={{ background: LEVEL_COLORS[LEVELS.indexOf(a.level)] + "30", color: LEVEL_COLORS[LEVELS.indexOf(a.level)] }}>
            {a.level}
          </span>
        </Card>
      </div>

      <Card className="mb-5">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Season Progression</p>
        <canvas ref={chartRef} className="w-full" style={{ height: 220 }} />
      </Card>

      <Card>
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Recent Results</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Date</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Meet</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Event</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Time</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Drop</th>
              </tr>
            </thead>
            <tbody>
              {allResults.slice(-10).reverse().map((r, i) => {
                const evResults = a.events[r.event];
                const idx = evResults.findIndex(x => x.date === r.date && x.time === r.time);
                let drop = "—";
                let dropClass = "text-white/40";
                if (idx > 0) {
                  const d = timeToSec(evResults[idx - 1].time) - r.timeSec;
                  drop = d > 0 ? `-${d.toFixed(2)}s` : `+${Math.abs(d).toFixed(2)}s`;
                  dropClass = d > 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold";
                }
                return (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-white/50">{r.date}</td>
                    <td className="py-2 px-3 text-white/50">{r.meet}</td>
                    <td className="py-2 px-3">{r.event}</td>
                    <td className="py-2 px-3 font-bold">{r.time}</td>
                    <td className={`py-2 px-3 ${dropClass}`}>{drop}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function DropsView({ a }: { a: AthleteData }) {
  const eventDrops = useMemo(() => {
    const result: Record<string, { avg: number; total: number; drops: number[] }> = {};
    Object.keys(a.events).forEach(ev => {
      const times = a.events[ev];
      const drops: number[] = [];
      for (let i = 1; i < times.length; i++) drops.push(timeToSec(times[i - 1].time) - timeToSec(times[i].time));
      if (drops.length > 0) result[ev] = { avg: drops.reduce((s, v) => s + v, 0) / drops.length, total: drops.reduce((s, v) => s + v, 0), drops };
    });
    return result;
  }, [a]);

  const evNames = Object.keys(eventDrops);
  const chartRef = useCanvasChart((ctx, w, h) => {
    const avgDrops = evNames.map(e => eventDrops[e].avg);
    const colors = evNames.map((_, i) => [PURPLE, BLUE, GREEN, SCARLET][i % 4]);
    drawBarChart(ctx, w, h, avgDrops, evNames.map(e => e.replace(/\d+ /, "")), colors);
  }, [eventDrops]);

  const cumulChartRef = useCanvasChart((ctx, w, h) => {
    const allDropsOverTime: { date: string; drop: number }[] = [];
    Object.keys(a.events).forEach(ev => {
      const times = a.events[ev];
      for (let i = 1; i < times.length; i++) {
        allDropsOverTime.push({ date: times[i].date, drop: timeToSec(times[i - 1].time) - timeToSec(times[i].time) });
      }
    });
    allDropsOverTime.sort((a, b) => a.date.localeCompare(b.date));
    let cumul = 0;
    const cumulData = allDropsOverTime.map(d => { cumul += d.drop; return cumul; });
    if (cumulData.length > 1) {
      drawLineChart(ctx, w, h, [{ data: cumulData, color: GREEN }], allDropsOverTime.map(d => d.date), { formatY: v => v.toFixed(1) + "s", minY: 0 });
    }
  }, [a]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Avg Drop by Event</p>
          <canvas ref={chartRef} className="w-full" style={{ height: 220 }} />
        </Card>
        <Card>
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Cumulative Improvement</p>
          <canvas ref={cumulChartRef} className="w-full" style={{ height: 220 }} />
        </Card>
      </div>
      <Card>
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Drop Analysis by Event</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Event</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Season Start</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Current Best</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Total Drop</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Avg Drop/Meet</th>
              </tr>
            </thead>
            <tbody>
              {evNames.map(ev => {
                const ed = eventDrops[ev];
                const times = a.events[ev];
                return (
                  <tr key={ev} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-bold">{ev}</td>
                    <td className="py-2 px-3 text-white/50">{times[0].time}</td>
                    <td className="py-2 px-3 text-white/50">{times[times.length - 1].time}</td>
                    <td className="py-2 px-3 text-emerald-400 font-bold">-{ed.total.toFixed(2)}s</td>
                    <td className="py-2 px-3 text-emerald-400">-{ed.avg.toFixed(2)}s</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function PaceView({ a, eventFilter }: { a: AthleteData; eventFilter: string }) {
  const ev = eventFilter !== "all" ? eventFilter : Object.keys(a.events)[0];
  const times = a.events[ev] || [];
  const hasData = times.length > 0;

  const chartRef = useCanvasChart((ctx, w, h) => {
    if (!hasData) return;
    const recent = times.slice(-3);
    const colors = [PURPLE, BLUE, GREEN];
    const datasets = recent.map((r, i) => ({ data: r.splits.map(s => parseFloat(s)), color: colors[i] }));
    const labels = recent[0].splits.map((_, i) => `Split ${i + 1}`);
    drawLineChart(ctx, w, h, datasets, labels, { formatY: v => v.toFixed(2) + "s" });
  }, [times, ev, hasData], 260);

  if (!hasData) return <Card><p className="text-white/40">No data for this event.</p></Card>;

  const latest = times[times.length - 1];
  const splits = latest.splits.map(s => parseFloat(s));
  const half = Math.floor(splits.length / 2);
  const firstHalf = splits.slice(0, half).reduce((s, v) => s + v, 0) / half;
  const secondHalf = splits.slice(half).reduce((s, v) => s + v, 0) / (splits.length - half);
  const nsi = ((secondHalf - firstHalf) / firstHalf * 100);
  const mean = splits.reduce((s, v) => s + v, 0) / splits.length;
  const sd = Math.sqrt(splits.reduce((s, v) => s + (v - mean) ** 2, 0) / splits.length);
  const cv = (sd / mean * 100);

  return (
    <>
      <Card className="mb-5">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Pace Curve — {ev}</p>
        <canvas ref={chartRef} className="w-full" style={{ height: 260 }} />
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Negative Split Index</p>
          <p className="text-4xl font-black" style={{ color: nsi < 0 ? GREEN : SCARLET }}>{nsi.toFixed(1)}%</p>
          <p className="text-sm text-white/50 mt-2">{nsi < 0 ? "Negative split — strong finish" : "Positive split — fading in back half"}</p>
          <p className="text-xs text-white/30 mt-1">1st half avg: {firstHalf.toFixed(2)}s | 2nd half avg: {secondHalf.toFixed(2)}s</p>
          <p className="text-[10px] text-white/20 mt-2">Latest: {latest.time} ({latest.date})</p>
        </Card>
        <Card>
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Pacing Consistency (CV%)</p>
          <p className="text-4xl font-black" style={{ color: cv < 5 ? GREEN : cv < 10 ? GOLD : SCARLET }}>{cv.toFixed(1)}%</p>
          <p className="text-sm text-white/50 mt-2">{cv < 5 ? "Excellent pacing consistency" : cv < 10 ? "Moderate variability" : "High variability — consider pacing strategy"}</p>
          <div className="mt-4 space-y-2">
            {splits.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 text-xs text-white/40 text-right shrink-0">Split {i + 1}</span>
                <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                  <div className="h-full rounded transition-all" style={{
                    width: `${(s / Math.max(...splits) * 100).toFixed(0)}%`,
                    background: s === Math.min(...splits) ? GREEN : s === Math.max(...splits) ? SCARLET : PURPLE,
                  }} />
                </div>
                <span className="text-xs font-bold w-14 shrink-0">{s.toFixed(2)}s</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function TeamRankingsView() {
  const ranked = useMemo(() => {
    return athletes.map(a => {
      const stats = getAthleteStats(a);
      return { ...a, ...stats };
    }).sort((a, b) => b.totalDrop - a.totalDrop);
  }, []);

  const levelCounts = LEVELS.map(l => athletes.filter(a => a.level === l).length);
  const total = athletes.length;

  return (
    <>
      <Card className="mb-5">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Team Level Distribution</p>
        <div className="h-6 bg-white/5 rounded-lg overflow-hidden flex">
          {levelCounts.map((c, i) => c > 0 ? (
            <div key={i} className="h-full transition-all" style={{ width: `${(c / total * 100).toFixed(1)}%`, background: LEVEL_COLORS[i] }} />
          ) : null)}
        </div>
        <div className="flex gap-4 flex-wrap mt-3">
          {LEVELS.map((l, i) => levelCounts[i] > 0 ? (
            <div key={l} className="flex items-center gap-2 text-xs text-white/50">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: LEVEL_COLORS[i] }} />
              {l}: {levelCounts[i]}
            </div>
          ) : null)}
        </div>
      </Card>

      <Card>
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-4">Team Rankings — Top Performers</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Rank</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Athlete</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Level</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Total Drops</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">PBs</th>
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Consistency</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((a, i) => (
                <tr key={a.name} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2 px-3 font-bold">#{i + 1}</td>
                  <td className="py-2 px-3">{a.name}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: LEVEL_COLORS[LEVELS.indexOf(a.level)] + "30", color: LEVEL_COLORS[LEVELS.indexOf(a.level)] }}>
                      {a.level}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-emerald-400 font-bold">-{a.totalDrop.toFixed(2)}s</td>
                  <td className="py-2 px-3">{a.pbs}</td>
                  <td className="py-2 px-3 text-white/50">{a.cv < 0.5 ? "High" : a.cv < 1 ? "Medium" : "Low"} ({(a.cv * 100).toFixed(0)}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function InsightsView({ a }: { a: AthleteData }) {
  const insights = useMemo(() => {
    const result: { title: string; text: string }[] = [];

    let bestEvent = "", bestRate = 0;
    Object.keys(a.events).forEach(ev => {
      const times = a.events[ev];
      if (times.length < 2) return;
      const first = timeToSec(times[0].time), last = timeToSec(times[times.length - 1].time);
      const rate = (first - last) / first * 100;
      if (rate > bestRate) { bestRate = rate; bestEvent = ev; }
    });
    if (bestEvent) {
      result.push({
        title: "Strongest Improvement Trajectory",
        text: `${a.name}'s best improvement rate is in ${bestEvent} at ${bestRate.toFixed(1)}% over the season. This suggests natural aptitude or effective training focus. Consider prioritizing ${bestEvent} for championship meets.`,
      });
    }

    Object.keys(a.events).forEach(ev => {
      const latest = a.events[ev][a.events[ev].length - 1];
      if (!latest.splits || latest.splits.length < 2) return;
      const splits = latest.splits.map(s => parseFloat(s));
      const fadePercent = ((splits[splits.length - 1] - splits[0]) / splits[0] * 100);
      if (fadePercent > 8) {
        result.push({
          title: `Pacing Alert: ${ev}`,
          text: `${ev} shows ${fadePercent.toFixed(1)}% fade from first to last split (${splits[0].toFixed(2)}s to ${splits[splits.length - 1].toFixed(2)}s). Recommend: aerobic threshold work and race-pace sets with emphasis on maintaining effort in the back half.`,
        });
      }
    });

    const levelIdx = LEVELS.indexOf(a.level);
    const nextLevel = levelIdx < LEVELS.length - 1 ? LEVELS[levelIdx + 1] : null;
    const nextXP = levelIdx < LEVELS.length - 1 ? LEVEL_XP[levelIdx + 1] : null;
    if (nextLevel && nextXP) {
      const remaining = nextXP - a.xp;
      result.push({
        title: "Level Progression",
        text: `${a.name} is ${a.level} (${a.xp} XP). Needs ${remaining} more XP to reach ${nextLevel}. At ~45 XP/meet, estimate ${Math.ceil(remaining / 45)} more meets to level up.`,
      });
    }

    return result;
  }, [a]);

  return (
    <div className="space-y-4">
      {insights.length === 0 && (
        <Card><p className="text-white/40">Insufficient data to generate insights.</p></Card>
      )}
      {insights.map((ins, i) => (
        <div key={i} className="rounded-2xl p-5 border-2" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(37,99,235,0.08))", borderColor: "rgba(124,58,237,0.2)" }}>
          <h4 className="text-sm font-bold mb-2" style={{ color: PURPLE }}>{ins.title}</h4>
          <p className="text-sm text-white/60 leading-relaxed">{ins.text}</p>
        </div>
      ))}
    </div>
  );
}

export default function TeamAnalytics({ GameHUDHeader }: TeamAnalyticsProps) {
  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [currentAthlete, setCurrentAthlete] = useState(0);
  const [eventFilter, setEventFilter] = useState("all");

  const a = athletes[currentAthlete];
  const eventOptions = useMemo(() => Object.keys(a.events), [a]);

  const handleAthleteChange = useCallback((idx: number) => {
    setCurrentAthlete(idx);
    setEventFilter("all");
  }, []);

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <GameHUDHeader />

        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-2xl font-black tracking-tight" style={{ color: PURPLE }}>Swim Analytics</h2>
          <div className="flex gap-3 items-center">
            <select value={currentAthlete} onChange={e => handleAthleteChange(+e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-[#7C3AED]/60 focus:outline-none">
              {athletes.map((a, i) => <option key={i} value={i} className="bg-[#0e0e18]">{a.name}</option>)}
            </select>
            <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-[#7C3AED]/60 focus:outline-none">
              <option value="all" className="bg-[#0e0e18]">All Events</option>
              {eventOptions.map(ev => <option key={ev} value={ev} className="bg-[#0e0e18]">{ev}</option>)}
            </select>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex gap-1 mb-6 border-b-2 border-white/5 pb-0 overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setCurrentView(item.id)}
              className={`px-4 py-2.5 text-xs font-bold tracking-wider whitespace-nowrap transition-all border-b-[3px] -mb-[2px] ${
                currentView === item.id
                  ? "text-[#7C3AED] border-[#7C3AED]"
                  : "text-white/40 border-transparent hover:text-white/60"
              }`}>
              <span className="mr-1.5">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>

        {currentView === "overview" && <OverviewView a={a} eventFilter={eventFilter} />}
        {currentView === "drops" && <DropsView a={a} />}
        {currentView === "pace" && <PaceView a={a} eventFilter={eventFilter} />}
        {currentView === "team" && <TeamRankingsView />}
        {currentView === "insights" && <InsightsView a={a} />}
      </div>
    </div>
  );
}
