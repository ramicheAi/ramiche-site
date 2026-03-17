"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";
import { db, hasConfig } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, query, orderBy } from "firebase/firestore";

/* ══════════════════════════════════════════════════════════════════════════════
   YOLO BUILDS — Multi-Agent Overnight Prototype Gallery
   5 agents build every night: NOVA, PROXIMON, SIMONS, MERCURY, DR STRANGE
   Sunday eval sweep by PROXIMON scores + picks winners
   ══════════════════════════════════════════════════════════════════════════════ */

interface Build {
  date: string;
  name: string;
  idea: string;
  status: "working" | "partial" | "failed";
  takeaway: string;
  folder: string;
  agent: string;
  reviewStatus?: "approved" | "rejected" | "pending";
  score?: number;
}

type ReviewStatus = "pending" | "approved" | "rejected";

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  working:  { label: "Working",  color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  partial:  { label: "Partial",  color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  failed:   { label: "Failed",   color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  approved: { label: "Approved", color: "#22c55e", bg: "rgba(34,197,94,0.25)" },
  rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.25)" },
};

/* ── AGENT FILTER CONFIG ──────────────────────────────────────────────────── */
const YOLO_AGENTS = [
  { id: "all", label: "ALL", accent: "#C9A84C", lane: "" },
  { id: "nova", label: "NOVA", accent: "#7c3aed", lane: "Product Prototypes" },
  { id: "proximon", label: "PROXIMON", accent: "#22d3ee", lane: "Systems & Optimization" },
  { id: "simons", label: "SIMONS", accent: "#f59e0b", lane: "Data & Analytics" },
  { id: "mercury", label: "MERCURY", accent: "#34d399", lane: "Sales & Revenue" },
  { id: "dr strange", label: "DR STRANGE", accent: "#a855f7", lane: "Scenario Modeling" },
];

const SEED_BUILDS: Build[] = [
  { date: "2026-03-17", name: "NOVA // Kinetic Tolerance Engine", idea: "Interactive mechanical clearance explorer for 3D printing — visualizes print-in-place tolerances for hinges and planetary bearings with live SVG physics.", status: "working", takeaway: "Tolerances compound. This 17KB single HTML file uses interactive SVG and CSS animations to teach designers exactly how clearance gaps (0.05mm vs 0.2mm) behave when printed on the Bambu A1. Real-time visual physics.", folder: "2026-03-17-nova-kinetic-engine", agent: "Nova" },
  { date: "2026-03-17", name: "FORGE — Material Science Lab", idea: "Interactive material science explorer for 3D printing — 12 FDM materials with real engineering data, live thermal phase simulator, radar-chart head-to-head comparison, print setting optimizer by part type and priority, and cost estimator with waste factoring", status: "working", takeaway: "50KB single HTML. 12 materials with real datasheet values. Thermal simulator shows glass transition, softening, melting, degradation phases in real time. Radar chart comparison with canvas rendering. Print optimizer adjusts 13 slicer parameters by material × part type × priority. Nobody else on the team can build this.", folder: "2026-03-17-nova-forge-material-lab", agent: "Nova" },
  { date: "2026-03-17", name: "Signal Wire — Agent Communication Visualiser", idea: "Real-time particle network showing every message, task handoff, and decision flowing between 20 agents. Animated canvas with orbital node layout, signal trails, and live feed. Ultra-linear dark UI.", status: "working", takeaway: "28KB single HTML. Canvas particle system with trail rendering. Orbital dual-ring layout (core 6 inner, 14 outer). Signal feed with type filtering. Organic emission timing (1.5-6s) feels alive. Agent roster with signal-strength bars.", folder: "2026-03-17-proximon-signal-wire", agent: "Proximon" },
  { date: "2026-03-17", name: "Nerve Centre — R&D Operations Intelligence", idea: "Live operational dashboard with experiment timeline, agent signal-strength grid, bottleneck radar, cost distribution, flywheel visualiser, and system pulse — all real data from Proximon's experiment log", status: "working", takeaway: "Ultra-linear layout with scanline overlay and grid background. Signal-strength bars per agent. Pulse bar with 60 animated segments. Every experiment I've shipped is tracked with status + delta.", folder: "2026-03-17-proximon-nerve-centre", agent: "Proximon" },
  { date: "2026-03-17", name: "METTLE Time Standards & Converter", idea: "4-in-1 swim time utility — course converter (SCY/SCM/LCM), motivational time standards table (B-AAAA), gap analysis with progress bar, drop tracker with season progression", status: "working", takeaway: "44KB single HTML. 14 events x 6 age groups x 2 genders x 6 standards = full coverage. Gap analysis showing estimated meets to next standard is killer for parent engagement.", folder: "2026-03-17-mettle-time-standards", agent: "Nova" },
  { date: "2026-03-17", name: "Mercury Velocity Engine", idea: "Sales intelligence system — monitors funding rounds, exec hires, DTC brand signals, auto-generates pitch deck outlines from any company URL", status: "working", takeaway: "Signal-to-deck pipeline: RSS monitoring for >$10M funding rounds and CMO/Head of Brand hires, URL-based brand extraction, 4-slide pitch scaffold.", folder: "2026-03-17-mercury-velocity-engine", agent: "Mercury" },
  { date: "2026-03-17", name: "Mercury Pricing Calculator", idea: "Value-based pricing engine for Ramiche Studio — 3 service types, three-tier quote output (Anchor/Target/Premium), 48h Sprint floor rate ($10K min)", status: "working", takeaway: "Value-based pricing (10% of client value x complexity multiplier) produces defensible quotes. Three-tier output anchors high and lets clients self-select.", folder: "2026-03-17-mercury-pricing-calculator", agent: "Mercury" },
  { date: "2026-03-17", name: "METTLE Coach Proposal Generator", idea: "Sales tool generating customized pitch proposals for swim teams — pain-to-solution mapping, ROI projections, competitive comparison, pricing, onboarding timeline", status: "working", takeaway: "Proposal generation is the highest-leverage sales tool. Pain-to-solution mapping is strongest element. Print CSS keeps branded look in PDF.", folder: "2026-03-17-mettle-proposal-generator", agent: "Mercury" },
  { date: "2026-03-17", name: "Ramiche Studio Hybrid Margin Engine", idea: "Interactive pricing engine modeling gross margin expansion by substituting $50/hr human creative labor with $2.50/hr AI agent compute", status: "working", takeaway: "Multiple chart visualizations make the arbitrage of human vs agent hours starkly visible. Dynamic insights translate numbers into operational strategy.", folder: "2026-03-17-ramiche-hybrid-margin", agent: "Simons" },
  { date: "2026-03-17", name: "SpoolTracker", idea: "Visual filament inventory tracker for 3D printing — spool management, usage logging, cost tracking", status: "working", takeaway: "Visual filament inventory with real-time cost tracking.", folder: "2026-03-17-nova-spool-tracker", agent: "Nova" },
  { date: "2026-03-16", name: "Verified Agent — PE Portfolio Value Multiplier", idea: "Interactive calculator showing how deploying $150/hr agents replaces human SG&A, drives EBITDA margin expansion and exit multiple arbitrage for PE portfolios", status: "working", takeaway: "Chart.js waterfall bridge chart with transparent base stack. 10x speed factor contextualizes $150/hr agent vs $75/hr human.", folder: "2026-03-16-verified-agent-pe-multiplier", agent: "Simons" },
  { date: "2026-03-16", name: "METTLE Athlete Check-In", idea: "Mobile-first kiosk for athletes to self-check-in at practice via 4-digit PIN — XP rewards, attendance streaks, live roster, streak leaderboard, coach quick panel", status: "working", takeaway: "29KB single HTML. PIN numpad with readonly inputs prevents mobile keyboard popup — critical for wet-finger poolside use. XP streak bonuses create compounding engagement.", folder: "2026-03-16-mettle-athlete-checkin", agent: "Nova" },
  { date: "2026-03-15", name: "METTLE ROI & Retention Forecaster", idea: "Interactive financial modeling tool for swim club owners calculating ROI of implementing METTLE by modeling churn reduction and tier upgrade lift", status: "working", takeaway: "Chart.js cumulative charting for break-even timelines. Confirms value of volume-based tier pricing.", folder: "2026-03-15-mettle-roi-forecaster", agent: "Simons" },
  { date: "2026-03-15", name: "METTLE Team Recruitment Portal", idea: "Recruitment portal for swim teams — 12-question readiness assessment with personalized onboarding roadmap, competitive comparison, 4-tier pricing, full beta application with all 59 USA Swimming LSCs", status: "working", takeaway: "44KB single HTML. Toggle-button assessment UX faster than radio buttons for mobile. Personalized plan converts higher than generic landing page.", folder: "2026-03-15-mettle-recruitment-portal", agent: "Nova" },
  { date: "2026-03-14", name: "APEX Sales Dashboard", idea: "Lead scoring, email sequence builder, and pipeline projection tool for METTLE sales — prioritizes swim team leads, visualizes conversion stages, forecasts revenue", status: "working", takeaway: "First sales-lane YOLO build. Pipeline projection uses real swim coach conversion rates. Sales tools must speak coach language.", folder: "2026-03-14-apex-sales-dashboard", agent: "Mercury" },
  { date: "2026-03-14", name: "Verified Agent Fleet Margin Simulator", idea: "Interactive pricing and margin simulator — MRR, token cost mixes (DeepSeek/Sonnet/Opus), gross margins, and break-even points", status: "working", takeaway: "Vanilla JS + Tailwind. Revealed that Opus destroys margins on $100-$200/hr agents if token usage is high.", folder: "2026-03-14-agent-margin-simulator", agent: "Simons" },
  { date: "2026-03-14", name: "METTLE Practice Planner — Swim Set Builder", idea: "Interactive swim practice set builder — set group construction (8 types), 7 energy zones with real-time distribution, volume/time calculator, 8 quick templates, drag-and-drop reorder, text export", status: "working", takeaway: "45KB single HTML. Fourth METTLE build targeting daily coaching workflow. Energy zone system gives coaches instant workout balance visibility.", folder: "2026-03-14-mettle-practice-planner", agent: "Nova" },
  { date: "2026-03-13", name: "METTLE Swim Analytics — Coach Dashboard", idea: "Interactive swim analytics dashboard — athlete selector, event filtering, performance trends, split analysis, training load tracking, improvement curves", status: "working", takeaway: "46KB single HTML. NOVA lane. Coach-facing analytics with METTLE level badges, season trend charts, and training volume tracking.", folder: "2026-03-13-mettle-swim-analytics", agent: "Nova" },
  { date: "2026-03-13", name: "Verified Agent Business — Enterprise ROI Calculator", idea: "Interactive ROI calculator — 5-vertical selector, dynamic cost modeling with staff vs. agent deployment, 12-month projection chart with break-even detection", status: "working", takeaway: "27KB single HTML. All 5 verticals match launch order from Mar 11 consultation. The calculator IS the pitch — prospects who model their own numbers sell themselves.", folder: "2026-03-13-verified-agent-roi-calculator", agent: "Nova" },
  { date: "2026-03-12", name: "Ramiche Studio Project Tracker", idea: "Interactive client pipeline dashboard — 5-stage Kanban board, project creation with tier pricing ($400-$6K+), revenue analytics, activity logging", status: "working", takeaway: "918-line, 33KB single HTML. First Ramiche Studio build. Bridges operations and creative execution.", folder: "2026-03-12-studio-project-tracker", agent: "Nova" },
  { date: "2026-03-11", name: "METTLE Parent Portal Dashboard", idea: "Parent-facing dashboard — athlete hero card, METTLE level progress, season stats, XP breakdown, performance trend chart, best times, 16-trophy case, meets, notifications", status: "working", takeaway: "48KB single HTML. Third METTLE build targeting PARENT portal. XP breakdown makes gamification transparent. Parent engagement loop = notification → portal → progress → motivated kid.", folder: "2026-03-11-mettle-parent-portal", agent: "Nova" },
  { date: "2026-03-10", name: "METTLE Meet Day Command Center", idea: "Real-time meet day dashboard — event timeline, countdown timers, 24-athlete roster with METTLE levels, heat/lane grids, results with splits and PB detection", status: "working", takeaway: "40KB single HTML. 5-tab interface with simulation mode. Competition-day tool where METTLE proves its value.", folder: "2026-03-10-mettle-meet-day", agent: "Nova" },
  { date: "2026-03-09", name: "Bambu Lab A1 Live Monitor", idea: "Real-time MQTT telemetry dashboard — print progress, nozzle/bed temps, speed profiles, fan status, machine state detection with demo mode", status: "working", takeaway: "30KB single HTML. Full Bambu MQTT parser. Demo simulates heating → leveling → printing → complete lifecycle.", folder: "2026-03-09-bambu-live-monitor", agent: "Nova" },
  { date: "2026-03-08", name: "METTLE Athlete Card Generator", idea: "Interactive trading card generator — athlete profile cards with stats, level badges, event results, photo upload, 6 themes, PNG export for social media", status: "working", takeaway: "43KB single HTML. First METTLE-focused build. Live preview with 3D hover effect and canvas-based PNG export.", folder: "2026-03-08-mettle-athlete-cards", agent: "Nova" },
  { date: "2026-03-07", name: "STL Instant Quoter", idea: "Client-side STL parser with geometry analysis (volume, surface area, bounding box) and instant cost quoting across 6 materials — binary + ASCII support, wireframe 3D preview", status: "working", takeaway: "31KB single HTML. Real STL parsing via DataView — no external libs. Signed tetrahedron method for volume.", folder: "2026-03-07-stl-instant-quoter", agent: "Nova" },
  { date: "2026-03-05", name: "PrintQueue — Production Queue Manager", idea: "Real-time print job queue manager with priority ordering, material stock validation, cost tracking, live progress simulation", status: "working", takeaway: "32KB single HTML. Full job lifecycle. Seeded with Parallax ecosystem data.", folder: "2026-03-05-print-queue-dashboard", agent: "Nova" },
  { date: "2026-03-03", name: "FilaTrack — Filament Inventory & Cost Tracker", idea: "Interactive filament inventory manager with spool tracking, print logging, cost-per-gram analytics, low-stock alerts", status: "working", takeaway: "1137-line single HTML. Full spool lifecycle: add, log prints, track costs, low-stock alerts.", folder: "2026-03-03-filament-tracker", agent: "Nova" },
  { date: "2026-03-02", name: "PrintDiag — 3D Print Failure Analyzer", idea: "Interactive FDM failure diagnostic tool with 10 failure modes, step-by-step flowcharts, slicer quick-fix tables", status: "working", takeaway: "690-line single HTML covering 10 FDM failures with diagnostic flowcharts.", folder: "2026-03-02-print-failure-analyzer", agent: "Nova" },
  { date: "2026-03-02", name: "PrintFlow Storefront", idea: "Full drag-and-drop 3D print quoting storefront — Three.js STL viewer, instant cost calculator, material selector", status: "working", takeaway: "1064 lines. Three.js STL viewer with live cost calculation.", folder: "2026-03-02-printflow-storefront", agent: "Nova" },
  { date: "2026-03-02", name: "Squad Status Board", idea: "Live dashboard showing all 19 agents with capability badges, model info, and provider", status: "working", takeaway: "Exposed capability gaps across the squad.", folder: "2026-03-02-squad-status-board", agent: "Atlas" },
];

export default function YoloBuildsPage() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);

  useEffect(() => {
    async function loadBuilds() {
      // Step 1: Try fetching real build data from API
      let apiBuilds: Build[] = [];
      try {
        const res = await fetch("/api/command-center/yolo-builds");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            apiBuilds = data;
          }
        }
      } catch {}

      // Step 2: Merge API data with SEED_BUILDS (API takes priority, dedup by folder)
      const seedWithDefaults = SEED_BUILDS.map(b => ({ ...b, reviewStatus: "pending" as ReviewStatus }));
      let merged: Build[];
      if (apiBuilds.length > 0) {
        const folderSet = new Set(apiBuilds.map(b => b.folder));
        const apiWithDefaults = apiBuilds.map(b => ({ ...b, reviewStatus: (b.reviewStatus || "pending") as ReviewStatus }));
        const uniqueSeeds = seedWithDefaults.filter(b => !folderSet.has(b.folder));
        merged = [...apiWithDefaults, ...uniqueSeeds];
      } else {
        merged = seedWithDefaults;
      }

      // Step 3: Sort by date descending
      merged.sort((a, b) => b.date.localeCompare(a.date));

      // Step 4: If Firestore is available, merge with SEED_BUILDS (never skip seeds)
      if (db && hasConfig) {
        try {
          const q = query(collection(db, "yolo_builds"), orderBy("date", "desc"));
          const snap = await getDocs(q);
          const fsData = snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as Build));
          // Merge: Firestore data + any SEED_BUILDS not yet in Firestore
          const fsFolders = new Set(fsData.map(b => b.folder));
          const missingSeed = merged.filter(b => !fsFolders.has(b.folder));
          // Seed missing builds into Firestore
          for (const build of missingSeed) {
            await setDoc(doc(db, "yolo_builds", build.folder), { ...build, reviewStatus: "pending" }, { merge: true });
          }
          const allBuilds = [...fsData.map(b => ({ ...b, reviewStatus: (b.reviewStatus || "pending") as ReviewStatus })), ...missingSeed];
          allBuilds.sort((a, b) => b.date.localeCompare(a.date));
          setBuilds(allBuilds);
          return;
        } catch {}
      }

      setBuilds(merged);
    }
    loadBuilds();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const setReview = async (folder: string, status: ReviewStatus) => {
    if (db && hasConfig) {
      try {
        const docRef = doc(db, "yolo_builds", folder);
        await setDoc(docRef, { reviewStatus: status, reviewedAt: new Date().toISOString() }, { merge: true });
      } catch {}
    }
    setBuilds((prev) =>
      prev.map((b) => (b.folder === folder ? { ...b, reviewStatus: status } : b)),
    );
    if (status === "approved") {
      setToast({ message: "Build approved", color: "#22c55e" });
    } else if (status === "rejected") {
      setToast({ message: "Build rejected", color: "#ef4444" });
    } else {
      setToast({ message: "Review reset", color: "#a3a3a3" });
    }
  };

  const filtered = filter === "all"
    ? builds
    : builds.filter((b) => b.agent.toLowerCase() === filter);

  const stats = {
    total: builds.length,
    working: builds.filter((b) => b.status === "working").length,
    agents: new Set(builds.map((b) => b.agent.toLowerCase())).size,
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white">
      <ParticleField />
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg backdrop-blur-md transition-all duration-300"
          style={{
            background: `${toast.color}20`,
            border: `1px solid ${toast.color}40`,
            color: toast.color,
            animation: "toastSlideIn 0.3s ease-out",
          }}
        >
          {toast.message}
        </div>
      )}
      <style jsx>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/command-center" className="text-white/40 hover:text-white/70 text-sm mb-2 inline-block">&larr; Command Center</Link>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
              YOLO BUILDS
            </h1>
            <p className="text-white/40 text-xs mt-1" style={{ letterSpacing: "0.15em" }}>
              {stats.agents} AGENTS // {stats.total} BUILDS // NIGHTLY 12:30 AM — 2:30 AM EST
            </p>
          </div>
          <div className="flex gap-3">
            {[
              { label: "WORKING", val: stats.working, color: "#22c55e" },
              { label: "TOTAL", val: stats.total, color: "#C9A84C" },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center px-3 py-2 rounded-lg border-2"
                style={{ borderColor: `${s.color}25`, background: `${s.color}08` }}
              >
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[9px] tracking-widest" style={{ color: `${s.color}88` }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent filter chips */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {YOLO_AGENTS.map((a) => {
            const count = a.id === "all" ? builds.length : builds.filter(b => b.agent.toLowerCase() === a.id).length;
            return (
              <button
                key={a.id}
                onClick={() => setFilter(a.id)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all"
                style={{
                  border: `2px solid ${filter === a.id ? a.accent : `${a.accent}25`}`,
                  background: filter === a.id ? `${a.accent}15` : "transparent",
                  color: filter === a.id ? a.accent : "#666",
                  boxShadow: filter === a.id ? `0 0 12px ${a.accent}20` : "none",
                }}
              >
                {a.label} ({count})
                {a.lane && <span className="ml-1 opacity-50 text-[9px]">{a.lane}</span>}
              </button>
            );
          })}
        </div>

        {/* Build Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((build) => {
            const review = build.reviewStatus ?? "pending";
            const isApproved = review === "approved";
            const isRejected = review === "rejected";
            const agentConfig = YOLO_AGENTS.find(a => a.id === build.agent.toLowerCase());
            const accent = agentConfig?.accent || "#7c3aed";
            const s = isApproved
              ? STATUS_STYLES.approved
              : isRejected
              ? STATUS_STYLES.rejected
              : STATUS_STYLES[build.status];

            return (
              <div
                key={build.folder}
                className="rounded-xl border-2 p-5 flex flex-col gap-3 transition-all duration-300"
                style={{
                  borderColor: isApproved
                    ? "rgba(34,197,94,0.4)"
                    : isRejected
                    ? "rgba(239,68,68,0.3)"
                    : `${accent}20`,
                  background: isApproved
                    ? "rgba(34,197,94,0.05)"
                    : isRejected
                    ? "rgba(239,68,68,0.03)"
                    : `linear-gradient(135deg, ${accent}06, transparent)`,
                  boxShadow: isApproved
                    ? "0 0 20px rgba(34,197,94,0.15)"
                    : "none",
                  opacity: isRejected ? 0.6 : 1,
                }}
              >
                {/* Top row: agent badge + status + date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded"
                      style={{ background: `${accent}20`, color: accent }}
                    >
                      {build.agent.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
                      {s.label}
                    </span>
                  </div>
                  <span className="text-xs text-white/30">{build.date}</span>
                </div>

                {/* Name */}
                <a
                  href={`/yolo-builds/${build.folder}/index.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <h3
                    className="text-sm font-bold leading-tight group-hover:underline"
                    style={{
                      color: isRejected ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)",
                      textDecoration: isRejected ? "line-through" : "none",
                    }}
                  >
                    {build.name}
                  </h3>
                </a>

                {/* Idea */}
                <p className="text-xs text-white/50 line-clamp-3">{build.idea}</p>

                {/* Takeaway */}
                <p className="text-[11px] text-white/35 italic line-clamp-2">{build.takeaway}</p>

                {/* Score badge if scored */}
                {build.score && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/40">Score:</span>
                    <span className="text-xs font-bold" style={{ color: build.score >= 80 ? "#22c55e" : build.score >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {build.score}/110
                    </span>
                  </div>
                )}

                {/* Footer: actions */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.06]">
                  <span className="text-xs text-white/40">
                    Built by <span className="text-white/60 font-medium">{build.agent}</span>
                  </span>
                  <div className="flex gap-2">
                    <a
                      href={`/yolo-builds/${build.folder}/index.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      Test
                    </a>
                    <button
                      onClick={() => setReview(build.folder, isApproved ? "pending" : "approved")}
                      className="text-xs px-2 py-1 rounded border transition-colors"
                      style={{
                        borderColor: isApproved ? "rgba(34,197,94,0.6)" : "rgba(34,197,94,0.3)",
                        color: isApproved ? "#fff" : "#4ade80",
                        background: isApproved ? "rgba(34,197,94,0.3)" : "transparent",
                      }}
                    >
                      {isApproved ? "\u2713" : "Approve"}
                    </button>
                    <button
                      onClick={() => setReview(build.folder, isRejected ? "pending" : "rejected")}
                      className="text-xs px-2 py-1 rounded border transition-colors"
                      style={{
                        borderColor: isRejected ? "rgba(239,68,68,0.6)" : "rgba(239,68,68,0.3)",
                        color: isRejected ? "#fff" : "#f87171",
                        background: isRejected ? "rgba(239,68,68,0.3)" : "transparent",
                      }}
                    >
                      {isRejected ? "\u2717" : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-white/40">No builds yet for this agent.</p>
            <p className="text-xs mt-1 text-white/25">Builds run nightly 12:30 AM — 2:30 AM EST</p>
          </div>
        )}

        {/* Schedule info */}
        <div className="mt-10 border-2 border-white/[0.06] rounded-xl p-5">
          <h3 className="text-xs font-bold tracking-widest mb-3" style={{ color: "#C9A84C" }}>BUILD SCHEDULE</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {YOLO_AGENTS.filter(a => a.id !== "all").map((a) => (
              <div
                key={a.id}
                className="rounded-lg border-2 p-3"
                style={{ borderColor: `${a.accent}20`, background: `${a.accent}05` }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: a.accent }}>{a.label}</div>
                <div className="text-[10px] text-white/40">{a.lane}</div>
                <div className="text-[10px] text-white/30 mt-1">
                  {a.id === "proximon" ? "12:30 AM" : a.id === "nova" ? "1:00 AM" : a.id === "simons" ? "1:30 AM" : a.id === "mercury" ? "2:00 AM" : "2:30 AM"}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/25 mt-3">Sunday 4 AM: PROXIMON runs evaluation sweep — scores all builds on 110-point scale, picks winners for production integration.</p>
        </div>
      </div>
    </div>
  );
}
