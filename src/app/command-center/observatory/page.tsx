"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   THE MULTIVERSE — Native Strategic Observatory
   Dr. Strange — Cosmic map, roadmap kanban, scenario planner
   ══════════════════════════════════════════════════════════════════════════════ */

interface Scenario {
  label: string;
  prob: number;
  trigger: string;
  impact: { l: string; v: string }[];
  actions: string[];
}

interface Venture {
  name: string;
  icon: string;
  color: string;
  glow: string;
  tagline: string;
  orbit: { cx: number; cy: number; rx: number; ry: number; speed: number };
  momentum: number;
  risk: string;
  scenarios: { bull: Scenario; base: Scenario; bear: Scenario };
}

interface RoadmapItem {
  id: string;
  title: string;
  desc: string;
  venture: string;
  priority: string;
  status: string;
  date: string | null;
  created: number;
}

const VENTURES: Record<string, Venture> = {
  apex: {
    name: "APEX ATHLETE", icon: "🏊", color: "#00f5d4", glow: "rgba(0,245,212,0.12)", tagline: "Gamified swim training SaaS",
    orbit: { cx: 0.3, cy: 0.38, rx: 0.08, ry: 0.06, speed: 0.0003 }, momentum: 78, risk: "MED",
    scenarios: {
      bull: { label: "Club Adoption Cascade", prob: 35, trigger: "First 3 swim clubs adopt within 60 days. Word-of-mouth triggers regional expansion.",
        impact: [{ l: "Revenue", v: "$180K ARR" }, { l: "Users", v: "5,000+" }, { l: "Expansion", v: "Multi-sport" }, { l: "Timeline", v: "12mo" }],
        actions: ["Seed 3 clubs with free 90-day Pro", "Build shareable achievement cards", "Prepare enterprise pricing", "Begin COPPA audit"] },
      base: { label: "Steady Organic Growth", prob: 50, trigger: "Individual swimmers adopt organically. Revenue builds linearly.",
        impact: [{ l: "Revenue", v: "$45K ARR" }, { l: "Users", v: "800" }, { l: "Expansion", v: "Swim only" }, { l: "Timeline", v: "18mo" }],
        actions: ["SEO + content for swimmers", "Build referral program", "Track retention weekly", "Prepare club sales deck M6"] },
      bear: { label: "Adoption Friction", prob: 15, trigger: "COPPA delays. Schools resist tech. Competitors enter.",
        impact: [{ l: "Revenue", v: "$8K ARR" }, { l: "Users", v: "150" }, { l: "Expansion", v: "Pivot needed" }, { l: "Timeline", v: "24mo" }],
        actions: ["Fast-track COPPA compliance", "Build adult swimmer track", "Monitor competitors weekly", "Keep burn <$3K/mo"] },
    },
  },
  ga: {
    name: "GALACTIK ANTICS", icon: "🌌", color: "#9b5de5", glow: "rgba(155,93,229,0.12)", tagline: "Cosmic collectibles + browser game",
    orbit: { cx: 0.7, cy: 0.32, rx: 0.09, ry: 0.07, speed: 0.00025 }, momentum: 65, risk: "HIGH",
    scenarios: {
      bull: { label: "200%+ Funded", prob: 25, trigger: "Kickstarter hits 200%. Community explodes. IP licensing interest.",
        impact: [{ l: "Revenue", v: "$120K" }, { l: "Backers", v: "2,000+" }, { l: "IP Value", v: "Licensing" }, { l: "Timeline", v: "6mo" }],
        actions: ["Pre-build stretch goals NOW", "Prepare press kit", "Browser game demo at launch", "Identify 3 licensing partners"] },
      base: { label: "Successfully Funded", prob: 45, trigger: "Campaign reaches goal. Solid backer base. Shopify launches.",
        impact: [{ l: "Revenue", v: "$50K" }, { l: "Backers", v: "800" }, { l: "IP Value", v: "Growing" }, { l: "Timeline", v: "9mo" }],
        actions: ["Lock manufacturer timelines", "Shopify ready day 1", "Email capture during campaign", "Plan first post-KS drop"] },
      bear: { label: "Underfunded", prob: 30, trigger: "Campaign falls short. Pivot to DTC needed.",
        impact: [{ l: "Revenue", v: "$15K" }, { l: "Backers", v: "200" }, { l: "IP Value", v: "Intact" }, { l: "Timeline", v: "12mo" }],
        actions: ["Pre-validate with email list 500+", "DTC pivot plan ready", "Small-batch manufacturer backup", "Discord as retention engine"] },
    },
  },
  ramiche: {
    name: "RAMICHE", icon: "🎵", color: "#f15bb5", glow: "rgba(241,91,181,0.12)", tagline: "Music + brand + merch ecosystem",
    orbit: { cx: 0.32, cy: 0.65, rx: 0.07, ry: 0.055, speed: 0.00035 }, momentum: 82, risk: "LOW",
    scenarios: {
      bull: { label: "Breakout Moment", prob: 30, trigger: "A track catches algorithmic fire. Streaming 10x. Brand deals follow.",
        impact: [{ l: "Streams", v: "10M+" }, { l: "Revenue", v: "$200K" }, { l: "Brand", v: "National" }, { l: "Timeline", v: "6mo" }],
        actions: ["Maintain release cadence", "Merch inventory ready to scale", "Management infrastructure in place", "Content pipeline active"] },
      base: { label: "Steady Growth", prob: 55, trigger: "Consistent releases build audience. Revenue grows across streaming + merch.",
        impact: [{ l: "Streams", v: "1M+" }, { l: "Revenue", v: "$45K" }, { l: "Brand", v: "Regional" }, { l: "Timeline", v: "12mo" }],
        actions: ["1 track/month minimum", "Merch drop every 6-8 weeks", "Build email list to 5K", "Cross-promote with Parallax"] },
      bear: { label: "Plateau", prob: 15, trigger: "Growth stalls. Algorithm changes hurt independent artists.",
        impact: [{ l: "Streams", v: "200K" }, { l: "Revenue", v: "$12K" }, { l: "Brand", v: "Local" }, { l: "Timeline", v: "18mo" }],
        actions: ["Diversify revenue NOW", "Build direct fan relationship", "Merch margin optimization", "Explore sync licensing"] },
    },
  },
  parallax: {
    name: "PARALLAX", icon: "🎸", color: "#fee440", glow: "rgba(254,228,64,0.12)", tagline: "3-artist label · Yauggy · Niko · Gabe",
    orbit: { cx: 0.68, cy: 0.62, rx: 0.075, ry: 0.06, speed: 0.0002 }, momentum: 71, risk: "MED",
    scenarios: {
      bull: { label: "Multi-Artist Synergy", prob: 25, trigger: "All 3 artists release same quarter. Cross-promotion compounds.",
        impact: [{ l: "Revenue", v: "$150K" }, { l: "Artists", v: "3 active" }, { l: "Reach", v: "500K+" }, { l: "Timeline", v: "9mo" }],
        actions: ["Coordinate Q2 release calendar", "Create shared visual identity", "Joint playlist strategy", "Approach 2 new artists"] },
      base: { label: "Independent Tracks", prob: 50, trigger: "Artists release independently. Label provides infrastructure.",
        impact: [{ l: "Revenue", v: "$60K" }, { l: "Artists", v: "3 active" }, { l: "Reach", v: "150K" }, { l: "Timeline", v: "12mo" }],
        actions: ["Streamline shared services", "Monthly label check-in", "Build Parallax playlist", "Track per-artist ROI"] },
      bear: { label: "Artist Churn", prob: 25, trigger: "One or more artists leave or become inactive.",
        impact: [{ l: "Revenue", v: "$20K" }, { l: "Artists", v: "1-2" }, { l: "Reach", v: "50K" }, { l: "Timeline", v: "18mo" }],
        actions: ["Clean exit clauses in contracts", "Monthly satisfaction check-ins", "Keep overhead variable", "Pipeline 3-5 warm artists"] },
    },
  },
};

const VENTURE_COLORS: Record<string, string> = { apex: "#00f5d4", ga: "#9b5de5", ramiche: "#f15bb5", parallax: "#fee440", all: "#ffffff" };
const STATUSES = ["backlog", "in-progress", "review", "done"] as const;
const STATUS_LABELS: Record<string, string> = { backlog: "Backlog", "in-progress": "In Progress", review: "Review", done: "Done" };
const STATUS_COLORS: Record<string, string> = { backlog: "#9ca3af", "in-progress": "#00f5d4", review: "#ffab40", done: "#00e676" };

const DEFAULT_ITEMS: RoadmapItem[] = [
  { id: "d1", title: "COPPA compliance audit", desc: "Legal review for youth data handling. Required before club adoption push.", venture: "apex", priority: "high", status: "in-progress", date: "2026-04-15", created: Date.now() },
  { id: "d2", title: "Gamification engine MVP", desc: "Points, badges, leaderboards, streaks. Core differentiator.", venture: "apex", priority: "high", status: "in-progress", date: "2026-04-01", created: Date.now() },
  { id: "d3", title: "Swim club pilot program", desc: "Seed 3 clubs with free 90-day Pro tier. Measure engagement vs baseline.", venture: "apex", priority: "med", status: "backlog", date: "2026-06-01", created: Date.now() },
  { id: "d4", title: "Kickstarter campaign page", desc: "Campaign copy, rewards tiers, stretch goals, media kit.", venture: "ga", priority: "high", status: "in-progress", date: "2026-05-01", created: Date.now() },
  { id: "d5", title: "Browser game demo", desc: "Playable demo for Kickstarter launch. Core loop: explore, collect, trade.", venture: "ga", priority: "high", status: "backlog", date: "2026-05-15", created: Date.now() },
  { id: "d6", title: "Relic capsule system design", desc: "Collector tier mechanics. Ascending rarity. Repeat buyer incentives.", venture: "ga", priority: "med", status: "backlog", date: "2026-06-01", created: Date.now() },
  { id: "d7", title: "Shopify store buildout", desc: "Single store across GA + RAMICHE + Parallax. Cross-sell enabled.", venture: "all", priority: "high", status: "in-progress", date: "2026-04-15", created: Date.now() },
  { id: "d8", title: "Q2 release calendar", desc: "Coordinate drops across RAMICHE + Parallax for maximum cross-promotion.", venture: "parallax", priority: "med", status: "backlog", date: "2026-04-01", created: Date.now() },
  { id: "d9", title: "EP production + master", desc: "Complete EP. 5 tracks. Mix and master by April.", venture: "ramiche", priority: "high", status: "in-progress", date: "2026-04-30", created: Date.now() },
  { id: "d10", title: "Merch drop #1 design", desc: "Tied to EP release. Limited run. Print-on-demand backup.", venture: "ramiche", priority: "med", status: "backlog", date: "2026-05-15", created: Date.now() },
  { id: "d11", title: "Verified Agent marketplace MVP", desc: "Landing page + certification flow + booking system for AI agent consulting.", venture: "all", priority: "med", status: "backlog", date: "2026-09-01", created: Date.now() },
  { id: "d12", title: "Security monitoring system", desc: "Daily security checks, weekly academic scans, threat scoring.", venture: "all", priority: "low", status: "done", date: "2026-03-04", created: Date.now() },
];

function genId() {
  return Math.random().toString(36).substring(2, 11);
}

type ViewType = "observatory" | "roadmap" | "scenarios";

export default function ObservatoryPage() {
  const [view, setView] = useState<ViewType>("observatory");
  const [activeVenture, setActiveVenture] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [clock, setClock] = useState("");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdIdx, setCmdIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fVenture, setFVenture] = useState("apex");
  const [fPriority, setFPriority] = useState("med");
  const [fStatus, setFStatus] = useState("backlog");
  const [fDate, setFDate] = useState("");

  const starRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const starsRef = useRef<{ x: number; y: number; size: number; opacity: number; twinkleSpeed: number; twinkleOffset: number }[]>([]);
  const cmdInputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const saveData = useCallback(async (newItems: RoadmapItem[]) => {
    try { localStorage.setItem("multiverse_roadmap_v2", JSON.stringify(newItems)); } catch {}
    try {
      await fetch("/api/command-center/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newItems }),
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/command-center/roadmap");
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            setItems(data.items);
            return;
          }
        }
      } catch {}
      try {
        const saved = localStorage.getItem("multiverse_roadmap_v2");
        if (saved) { setItems(JSON.parse(saved)); return; }
      } catch {}
      setItems(DEFAULT_ITEMS);
    })();
  }, []);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/New_York" }) + " EDT");
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (view !== "observatory") return;
    const star = starRef.current;
    const map = mapRef.current;
    if (!star || !map) return;
    const sCtx = star.getContext("2d");
    const mCtx = map.getContext("2d");
    if (!sCtx || !mCtx) return;

    const resize = () => {
      const p = star.parentElement;
      if (!p) return;
      star.width = p.offsetWidth;
      star.height = p.offsetHeight;
      map.width = p.offsetWidth;
      map.height = p.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = Math.floor((star.width * star.height) / 3500);
    starsRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * star.width,
      y: Math.random() * star.height,
      size: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.6 + 0.1,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
    }));

    let startTime: number | null = null;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const t = ts - startTime;

      sCtx.clearRect(0, 0, star.width, star.height);
      for (const s of starsRef.current) {
        const o = s.opacity + Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.2;
        sCtx.fillStyle = `rgba(255,255,255,${Math.max(0, o)})`;
        sCtx.beginPath();
        sCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        sCtx.fill();
      }

      mCtx.clearRect(0, 0, map.width, map.height);
      const W = map.width, H = map.height;
      const positions: Record<string, { x: number; y: number }> = {};

      for (const [key, v] of Object.entries(VENTURES)) {
        const cx = v.orbit.cx * W, cy = v.orbit.cy * H;
        const rx = v.orbit.rx * W, ry = v.orbit.ry * H;
        mCtx.strokeStyle = `${v.color}15`;
        mCtx.lineWidth = 1;
        mCtx.beginPath();
        mCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        mCtx.stroke();

        const angle = t * v.orbit.speed;
        const px = cx + Math.cos(angle) * rx;
        const py = cy + Math.sin(angle) * ry;
        positions[key] = { x: px, y: py };

        const grad = mCtx.createRadialGradient(px, py, 0, px, py, 35);
        grad.addColorStop(0, v.glow);
        grad.addColorStop(1, "transparent");
        mCtx.fillStyle = grad;
        mCtx.beginPath();
        mCtx.arc(px, py, 35, 0, Math.PI * 2);
        mCtx.fill();

        mCtx.fillStyle = v.color;
        mCtx.beginPath();
        mCtx.arc(px, py, 5, 0, Math.PI * 2);
        mCtx.fill();
      }

      const keys = Object.keys(VENTURES);
      mCtx.lineWidth = 0.5;
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = positions[keys[i]], b = positions[keys[j]];
          const grad = mCtx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `${VENTURES[keys[i]].color}10`);
          grad.addColorStop(1, `${VENTURES[keys[j]].color}10`);
          mCtx.strokeStyle = grad;
          mCtx.beginPath();
          mCtx.moveTo(a.x, a.y);
          mCtx.lineTo(b.x, b.y);
          mCtx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [view]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((o) => !o);
        setCmdQuery("");
        setCmdIdx(0);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (cmdOpen && cmdInputRef.current) cmdInputRef.current.focus();
  }, [cmdOpen]);

  const filteredItems = items.filter((item) => {
    if (activeVenture && item.venture !== activeVenture && item.venture !== "all") return false;
    if (activeStatus && item.status !== activeStatus) return false;
    return true;
  });

  const openAddModal = () => {
    setEditId(null);
    setFTitle("");
    setFDesc("");
    setFVenture(activeVenture || "apex");
    setFPriority("med");
    setFStatus("backlog");
    setFDate("");
    setModalOpen(true);
  };

  const openEditModal = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setEditId(id);
    setFTitle(item.title);
    setFDesc(item.desc || "");
    setFVenture(item.venture);
    setFPriority(item.priority);
    setFStatus(item.status);
    setFDate(item.date || "");
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!fTitle.trim()) { showToast("Title required"); return; }
    let next: RoadmapItem[];
    if (editId) {
      next = items.map((i) =>
        i.id === editId ? { ...i, title: fTitle, desc: fDesc, venture: fVenture, priority: fPriority, status: fStatus, date: fDate || null } : i
      );
      showToast("Item updated");
    } else {
      next = [...items, { id: genId(), title: fTitle, desc: fDesc, venture: fVenture, priority: fPriority, status: fStatus, date: fDate || null, created: Date.now() }];
      showToast("Item added");
    }
    setItems(next);
    saveData(next);
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!editId) return;
    const next = items.filter((i) => i.id !== editId);
    setItems(next);
    saveData(next);
    setModalOpen(false);
    showToast("Item deleted");
  };

  const moveForward = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const idx = STATUSES.indexOf(item.status as typeof STATUSES[number]);
    if (idx < STATUSES.length - 1) {
      const next = items.map((i) => (i.id === id ? { ...i, status: STATUSES[idx + 1] } : i));
      setItems(next);
      saveData(next);
      showToast(`Moved to ${STATUS_LABELS[STATUSES[idx + 1]]}`);
    }
  };

  const handleDrop = (newStatus: string) => {
    if (!dragId) return;
    const item = items.find((i) => i.id === dragId);
    if (item && item.status !== newStatus) {
      const next = items.map((i) => (i.id === dragId ? { ...i, status: newStatus } : i));
      setItems(next);
      saveData(next);
      showToast(`Moved to ${STATUS_LABELS[newStatus]}`);
    }
    setDragId(null);
  };

  const exportRoadmap = () => {
    const lines = ["# MULTIVERSE ROADMAP", `Exported: ${new Date().toISOString().split("T")[0]}`, ""];
    for (const status of STATUSES) {
      const group = items.filter((i) => i.status === status);
      if (!group.length) continue;
      lines.push(`## ${STATUS_LABELS[status]} (${group.length})`);
      for (const item of group) {
        const v = item.venture === "all" ? "Cross-Venture" : (VENTURES[item.venture]?.name || item.venture);
        lines.push(`- **${item.title}** [${v}] [${item.priority}]${item.date ? ` — ${item.date}` : ""}`);
        if (item.desc) lines.push(`  ${item.desc}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `multiverse-roadmap-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    showToast("Roadmap exported");
  };

  const cmdResults = (() => {
    const q = cmdQuery.toLowerCase();
    const r: { icon: string; text: string; hint: string; action: () => void }[] = [];
    if (!q || "add".includes(q) || "new".includes(q)) r.push({ icon: "+", text: "Add new roadmap item", hint: "create", action: () => { setCmdOpen(false); openAddModal(); } });
    if (!q || "export".includes(q)) r.push({ icon: "↓", text: "Export roadmap as markdown", hint: "export", action: () => { setCmdOpen(false); exportRoadmap(); } });
    (["observatory", "roadmap", "scenarios"] as const).forEach((v) => {
      if (!q || v.includes(q)) r.push({ icon: "◉", text: `Go to ${v.charAt(0).toUpperCase() + v.slice(1)}`, hint: v, action: () => { setCmdOpen(false); setView(v); } });
    });
    Object.entries(VENTURES).forEach(([k, v]) => {
      if (!q || v.name.toLowerCase().includes(q) || k.includes(q)) r.push({ icon: v.icon, text: `Filter: ${v.name}`, hint: k, action: () => { setCmdOpen(false); setActiveVenture(k); } });
    });
    if (q.length >= 2) {
      items.forEach((item) => {
        if (item.title.toLowerCase().includes(q) || (item.desc || "").toLowerCase().includes(q))
          r.push({ icon: "☰", text: item.title, hint: STATUS_LABELS[item.status], action: () => { setCmdOpen(false); openEditModal(item.id); } });
      });
    }
    return r.slice(0, 8);
  })();

  const cardPositions: Record<string, { left: string; top: string }> = {
    apex: { left: "6%", top: "12%" },
    ga: { left: "58%", top: "6%" },
    ramiche: { left: "6%", top: "52%" },
    parallax: { left: "58%", top: "48%" },
  };

  const total = items.length;
  const inProg = items.filter((i) => i.status === "in-progress").length;
  const done = items.filter((i) => i.status === "done").length;

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#0a0a0f", color: "#e8e8f0", fontFamily: "'Space Grotesk', sans-serif", overflow: "hidden" }}>
      <ParticleField variant="purple" opacity={0.2} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');
        .mv-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:52px;background:rgba(10,10,15,0.95);border-bottom:1px solid rgba(255,255,255,0.08);position:relative;z-index:100}
        .mv-logo{font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase}
        .mv-sub{font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:1px;font-family:'JetBrains Mono',monospace}
        .mv-tab{padding:6px 14px;border-radius:6px;font-size:12px;font-weight:500;color:rgba(255,255,255,0.4);border:none;background:none;cursor:pointer;transition:all .2s;font-family:inherit}
        .mv-tab:hover{color:rgba(255,255,255,0.6)}
        .mv-tab.active{background:rgba(255,255,255,0.06);color:#e8e8f0}
        .mv-clock{font-family:'JetBrains Mono',monospace;font-size:12px;color:rgba(255,255,255,0.4)}
        .mv-pulse{width:8px;height:8px;border-radius:50%;background:#00e676;animation:mvpulse 2s ease-in-out infinite}
        @keyframes mvpulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}
        .mv-layout{display:grid;grid-template-columns:260px 1fr;height:calc(100vh - 52px);position:relative;z-index:10}
        @media(max-width:900px){.mv-layout{grid-template-columns:1fr} .mv-sidebar{display:none !important}}
        .mv-sidebar{border-right:1px solid rgba(255,255,255,0.08);background:rgba(10,10,15,0.6);overflow-y:auto;padding:16px 0}
        .mv-pill{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:all .2s;margin:0 16px 4px;border:1px solid transparent}
        .mv-pill:hover{background:rgba(255,255,255,0.06)}
        .mv-pill.active{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.2)}
        .mv-stitle{font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;padding:0 20px}
        .mv-metric{background:rgba(0,0,0,0.3);border-radius:8px;padding:8px 10px}
        .mv-metric-label{font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
        .mv-metric-value{font-size:16px;font-weight:600;font-family:'JetBrains Mono',monospace}
        .mv-fpill{padding:4px 10px;border-radius:12px;font-size:11px;border:1px solid rgba(255,255,255,0.08);background:none;color:rgba(255,255,255,0.4);cursor:pointer;transition:all .2s;font-family:inherit}
        .mv-fpill:hover{border-color:rgba(255,255,255,0.2);color:rgba(255,255,255,0.6)}
        .mv-fpill.active{border-color:rgba(255,255,255,0.6);color:#e8e8f0;background:rgba(255,255,255,0.06)}
        .mv-card{position:absolute;width:260px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;backdrop-filter:blur(20px);cursor:pointer;transition:all .4s cubic-bezier(.16,1,.3,1)}
        .mv-card:hover{background:rgba(255,255,255,0.06);transform:scale(1.02) translateY(-3px)}
        .mv-ritem{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:grab;transition:all .2s;position:relative}
        .mv-ritem:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.2)}
        .mv-ritem:hover .mv-iactions{opacity:1}
        .mv-iactions{position:absolute;top:8px;right:8px;display:flex;gap:4px;opacity:0;transition:opacity .2s}
        .mv-ibtn{width:24px;height:24px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;transition:all .15s;font-family:inherit}
        .mv-ibtn:hover{background:rgba(255,255,255,0.06);color:#e8e8f0;border-color:rgba(255,255,255,0.2)}
        .mv-scard{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;transition:all .2s}
        .mv-scard:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.2)}
        .mv-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
        .mv-modal{background:#0a0a0f;border:1px solid rgba(255,255,255,0.08);border-radius:16px;width:480px;max-height:80vh;overflow-y:auto;padding:28px}
        .mv-finput{width:100%;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#e8e8f0;font-size:13px;outline:none;transition:border-color .2s;font-family:inherit;box-sizing:border-box}
        .mv-finput:focus{border-color:#00f5d4}
        .mv-cmdbar{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:560px;background:#0a0a0f;border:1px solid rgba(255,255,255,0.08);border-radius:16px;z-index:300;box-shadow:0 20px 60px rgba(0,0,0,.6)}
        .mv-cmdresult{padding:10px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background .1s}
        .mv-cmdresult:hover,.mv-cmdresult.sel{background:rgba(255,255,255,0.06)}
        .mv-btn{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:500;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#e8e8f0;cursor:pointer;transition:all .2s;font-family:inherit;display:flex;align-items:center;gap:6px}
        .mv-btn:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.2)}
        .mv-btn-primary{background:rgba(0,245,212,0.1);border-color:rgba(0,245,212,0.3);color:#00f5d4}
        .mv-btn-primary:hover{background:rgba(0,245,212,0.18)}
        .mv-btn-danger{background:rgba(255,82,82,0.1);border-color:rgba(255,82,82,0.3);color:#ff5252}
        .mv-btn-danger:hover{background:rgba(255,82,82,0.2)}
        .mv-toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:10px;font-size:13px;z-index:500;background:rgba(0,230,118,.15);border:1px solid rgba(0,230,118,.3);color:#00e676;animation:mvtoastin .3s cubic-bezier(.16,1,.3,1)}
        @keyframes mvtoastin{from{transform:translateY(100px);opacity:0}to{transform:translateY(0);opacity:1}}
        .mv-colhdr{display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:8px 12px;border-radius:10px}
        .mv-dragover{border-color:#00f5d4 !important;box-shadow:0 0 12px rgba(0,245,212,0.15)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
      `}</style>

      {/* TOPBAR */}
      <div className="mv-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>← CMD</Link>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
          <div className="mv-logo">THE MULTIVERSE</div>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
          <div className="mv-sub">Command Center</div>
          <Link href="/command-center/observatory/live" style={{ fontSize: 10, letterSpacing: "0.08em", color: "rgba(201,168,76,0.85)", textDecoration: "none", marginLeft: 8 }}>
            Live metrics →
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 2 }}>
            {(["observatory", "roadmap", "scenarios"] as const).map((v) => (
              <button key={v} className={`mv-tab${view === v ? " active" : ""}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="mv-clock">{clock}</div>
          <div className="mv-pulse" />
        </div>
      </div>

      <div className="mv-layout">
        {/* SIDEBAR */}
        <div className="mv-sidebar">
          <div style={{ marginBottom: 24 }}>
            <div className="mv-stitle">Ventures</div>
            <div className={`mv-pill${!activeVenture ? " active" : ""}`} onClick={() => setActiveVenture(null)}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} />
              <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>All Ventures</div>
            </div>
            {Object.entries(VENTURES).map(([k, v]) => (
              <div key={k} className={`mv-pill${activeVenture === k ? " active" : ""}`} onClick={() => setActiveVenture(k)}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: v.color }} />
                <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{v.name}</div>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: v.color }}>{v.momentum}%</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 24 }}>
            <div className="mv-stitle">Quick Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 16px" }}>
              <div className="mv-metric"><div className="mv-metric-label">Total</div><div className="mv-metric-value">{total}</div></div>
              <div className="mv-metric"><div className="mv-metric-label">Active</div><div className="mv-metric-value" style={{ color: "#00f5d4" }}>{inProg}</div></div>
              <div className="mv-metric"><div className="mv-metric-label">Done</div><div className="mv-metric-value" style={{ color: "#00e676" }}>{done}</div></div>
              <div className="mv-metric"><div className="mv-metric-label">Completion</div><div className="mv-metric-value">{total ? Math.round((done / total) * 100) : 0}%</div></div>
            </div>
          </div>

          <div>
            <div className="mv-stitle">Filter by Status</div>
            <div style={{ display: "flex", gap: 4, padding: "0 16px", flexWrap: "wrap" }}>
              <button className={`mv-fpill${!activeStatus ? " active" : ""}`} onClick={() => setActiveStatus(null)}>All</button>
              {STATUSES.map((s) => (
                <button key={s} className={`mv-fpill${activeStatus === s ? " active" : ""}`} onClick={() => setActiveStatus(s)}>{STATUS_LABELS[s]}</button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ overflow: "hidden", position: "relative" }}>
          {/* OBSERVATORY VIEW */}
          {view === "observatory" && (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <canvas ref={starRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />
              <canvas ref={mapRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }} />
              <div style={{ position: "relative", zIndex: 50, width: "100%", height: "100%" }}>
                {Object.entries(VENTURES).map(([k, v]) => (
                  <div key={k} className="mv-card" style={{ left: cardPositions[k].left, top: cardPositions[k].top }}
                    onClick={() => { setActiveVenture(k); setView("roadmap"); }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, background: v.glow, color: v.color }}>{v.icon}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: v.color }}>{v.name}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{v.tagline}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div className="mv-metric"><div className="mv-metric-label">Momentum</div><div className="mv-metric-value" style={{ color: v.color }}>{v.momentum}%</div></div>
                      <div className="mv-metric"><div className="mv-metric-label">Risk</div><div className="mv-metric-value" style={{ color: v.color }}>{v.risk}</div></div>
                      <div className="mv-metric"><div className="mv-metric-label">Tasks</div><div className="mv-metric-value">{items.filter((i) => i.venture === k).length}</div></div>
                      <div className="mv-metric"><div className="mv-metric-label">Done</div><div className="mv-metric-value" style={{ color: "#00e676" }}>{items.filter((i) => i.venture === k && i.status === "done").length}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROADMAP VIEW */}
          {view === "roadmap" && (
            <div style={{ height: "100%", overflow: "auto" }}>
              <div style={{ padding: "24px 32px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#0a0a0f", zIndex: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Roadmap</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="mv-btn" onClick={exportRoadmap}>Export</button>
                  <button className="mv-btn mv-btn-primary" onClick={openAddModal}>+ Add Item</button>
                </div>
              </div>
              <div style={{ padding: "20px 32px 32px", display: "flex", gap: 20, minHeight: "calc(100vh - 160px)" }}>
                {STATUSES.map((status) => {
                  const colItems = filteredItems
                    .filter((i) => i.status === status)
                    .sort((a, b) => {
                      const prio: Record<string, number> = { high: 0, med: 1, low: 2 };
                      return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1) || new Date(a.date || "2099-12-31").getTime() - new Date(b.date || "2099-12-31").getTime();
                    });
                  return (
                    <div key={status} style={{ flex: 1, minWidth: 240, maxWidth: 360 }}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("mv-dragover"); }}
                      onDragLeave={(e) => e.currentTarget.classList.remove("mv-dragover")}
                      onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("mv-dragover"); handleDrop(status); }}>
                      <div className="mv-colhdr" style={{ background: `${STATUS_COLORS[status]}10` }}>
                        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</div>
                        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", padding: "2px 8px", borderRadius: 10, background: "rgba(0,0,0,0.3)", color: STATUS_COLORS[status] }}>{colItems.length}</div>
                      </div>
                      {colItems.map((item) => {
                        const vc = VENTURE_COLORS[item.venture] || "#fff";
                        const vName = item.venture === "all" ? "CROSS" : (VENTURES[item.venture]?.name?.split(" ")[0] || item.venture).toUpperCase();
                        const dateStr = item.date ? new Date(item.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                        return (
                          <div key={item.id} className="mv-ritem" draggable
                            onDragStart={() => setDragId(item.id)}
                            onDragEnd={() => setDragId(null)}>
                            <div className="mv-iactions">
                              <button className="mv-ibtn" onClick={() => openEditModal(item.id)} title="Edit">✎</button>
                              <button className="mv-ibtn" onClick={() => moveForward(item.id)} title="Move forward">→</button>
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, flex: 1 }}>{item.title}</div>
                              <div style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0, border: `1px solid ${vc}30`, color: vc }}>{vName}</div>
                            </div>
                            {item.desc && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: 8 }}>{item.desc.length > 100 ? item.desc.slice(0, 100) + "..." : item.desc}</div>}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {dateStr && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>{dateStr}</div>}
                              <div style={{
                                fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.5,
                                ...(item.priority === "high" ? { background: "rgba(255,82,82,0.12)", color: "#ff5252", border: "1px solid rgba(255,82,82,0.2)" }
                                  : item.priority === "med" ? { background: "rgba(255,171,64,0.12)", color: "#ffab40", border: "1px solid rgba(255,171,64,0.2)" }
                                    : { background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" })
                              }}>{item.priority}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCENARIOS VIEW */}
          {view === "scenarios" && (
            <div style={{ padding: "24px 32px", overflow: "auto", height: "100%" }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Scenario Planner</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Probability-weighted futures across all ventures</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
                {(activeVenture ? [activeVenture] : Object.keys(VENTURES)).flatMap((vk) => {
                  const v = VENTURES[vk];
                  return (["bull", "base", "bear"] as const).map((sk) => {
                    const s = v.scenarios[sk];
                    const typeStyle = sk === "bull"
                      ? { background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }
                      : sk === "base"
                        ? { background: "rgba(255,171,64,0.12)", color: "#ffab40", border: "1px solid rgba(255,171,64,0.2)" }
                        : { background: "rgba(255,82,82,0.12)", color: "#ff5252", border: "1px solid rgba(255,82,82,0.2)" };
                    return (
                      <div key={`${vk}-${sk}`} className="mv-scard">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <span style={{ fontSize: 16 }}>{v.icon}</span>
                          <span style={{ fontSize: 12, color: v.color, fontWeight: 600 }}>{v.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 1, ...typeStyle }}>{sk}</span>
                          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: v.color, marginLeft: "auto" }}>{s.prob}%</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 14 }}>{s.trigger}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                          {s.impact.map((im) => (
                            <div key={im.l} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "8px 10px" }}>
                              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>{im.l}</div>
                              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", marginTop: 2, color: v.color }}>{im.v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Action Plan</div>
                          {s.actions.map((a) => (
                            <div key={a} style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: "4px 0 4px 14px", position: "relative" }}>
                              <span style={{ position: "absolute", left: 0, color: "rgba(255,255,255,0.4)" }}>→</span>
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="mv-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="mv-modal">
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>{editId ? "Edit Roadmap Item" : "Add Roadmap Item"}</div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Title</label>
              <input className="mv-finput" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Description</label>
              <textarea className="mv-finput" value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Details, context, acceptance criteria..." style={{ minHeight: 80, resize: "vertical" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Venture</label>
                <select className="mv-finput" value={fVenture} onChange={(e) => setFVenture(e.target.value)}>
                  <option value="apex">Apex Athlete</option>
                  <option value="ga">Galactik Antics</option>
                  <option value="ramiche">RAMICHE</option>
                  <option value="parallax">Parallax</option>
                  <option value="all">Cross-Venture</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Priority</label>
                <select className="mv-finput" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
                  <option value="high">High</option>
                  <option value="med">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Status</label>
                <select className="mv-finput" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  <option value="backlog">Backlog</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Target Date</label>
                <input className="mv-finput" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
              {editId && <button className="mv-btn mv-btn-danger" style={{ marginRight: "auto" }} onClick={handleDelete}>Delete</button>}
              <button className="mv-btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="mv-btn mv-btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* COMMAND BAR */}
      {cmdOpen && (
        <div className="mv-cmdbar">
          <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#00f5d4", marginRight: 10 }}>⌘K</span>
            <input ref={cmdInputRef} value={cmdQuery} onChange={(e) => { setCmdQuery(e.target.value); setCmdIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCmdIdx((i) => Math.min(i + 1, cmdResults.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setCmdIdx((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter" && cmdResults[cmdIdx]) { e.preventDefault(); cmdResults[cmdIdx].action(); }
                if (e.key === "Escape") setCmdOpen(false);
              }}
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e8e8f0", fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}
              placeholder="Search roadmap, jump to venture, add item..." autoComplete="off" />
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", padding: 8 }}>
            {cmdResults.map((r, i) => (
              <div key={i} className={`mv-cmdresult${i === cmdIdx ? " sel" : ""}`} onClick={r.action} onMouseEnter={() => setCmdIdx(i)}>
                <div style={{ fontSize: 14, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>{r.icon}</div>
                <div style={{ fontSize: 13, flex: 1 }}>{r.text}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>{r.hint}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className="mv-toast">{toast}</div>}
    </div>
  );
}
