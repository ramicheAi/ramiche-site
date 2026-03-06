"use client";

import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   YOLO BUILDS — Overnight prototype gallery
   Each night the squad generates a wild idea and builds a working prototype
   ══════════════════════════════════════════════════════════════════════════════ */

interface Build {
  date: string;
  name: string;
  idea: string;
  status: "working" | "partial" | "failed";
  takeaway: string;
  folder: string;
  agent: string;
}

const BUILDS: Build[] = [
  {
    date: "2026-03-05",
    name: "PrintQueue — Production Queue Manager",
    idea: "Real-time print job queue manager with priority ordering, material stock validation, cost tracking, live progress simulation, machine status panel, and activity logging",
    status: "working",
    takeaway: "32KB single HTML file. Full job lifecycle management with priority-sorted queue and material stock validation.",
    folder: "2026-03-05-print-queue-dashboard",
    agent: "Nova",
  },
  {
    date: "2026-03-03",
    name: "FilaTrack — Filament Inventory & Cost Tracker",
    idea: "Interactive filament inventory manager with spool tracking, print logging with auto-deduction, cost-per-gram analytics, low-stock alerts, and data export",
    status: "working",
    takeaway: "1137-line single HTML file. Covers full spool lifecycle: add inventory, log prints, track material costs, surface low-stock alerts.",
    folder: "2026-03-03-filament-tracker",
    agent: "Nova",
  },
  {
    date: "2026-03-02",
    name: "PrintDiag — 3D Print Failure Analyzer",
    idea: "Interactive FDM failure diagnostic tool with 10 failure modes, step-by-step flowcharts, slicer quick-fix tables, and material-specific notes",
    status: "working",
    takeaway: "690-line single HTML file covering the 10 most common FDM failures with symptoms, root causes, and concrete slicer fixes.",
    folder: "2026-03-02-print-failure-analyzer",
    agent: "Nova",
  },
  {
    date: "2026-03-02",
    name: "PrintFlow Storefront",
    idea: "Full drag-and-drop 3D print quoting storefront — Three.js STL viewer, instant cost calculator, material selector, order form. 1064 lines.",
    status: "working",
    takeaway: "NOVA built 1064 lines of real code at 1AM. Three.js STL viewer with instant quoting.",
    folder: "2026-03-02-printflow-storefront",
    agent: "Nova",
  },
  {
    date: "2026-03-02",
    name: "Squad Status Board",
    idea: "Live dashboard showing all 19 agents with capability badges, model info, and provider",
    status: "working",
    takeaway: "Exposed capability gaps: DeepSeek/Kimi/GLM agents lack native vision — need OpenClaw image tool routing.",
    folder: "2026-03-02-squad-status-board",
    agent: "Atlas",
  },
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  working: { label: "Working", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  partial: { label: "Partial", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  failed:  { label: "Failed",  color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

export default function YoloBuildsPage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white">
      <ParticleField />
      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/command-center" className="text-white/40 hover:text-white/70 text-sm mb-2 inline-block">&larr; Command Center</Link>
            <h1 className="text-2xl font-bold tracking-tight">YOLO Overnight Builds</h1>
            <p className="text-white/40 text-sm mt-1">Every night, the squad generates a wild idea and builds a working prototype.</p>
          </div>
          <div className="text-right text-sm text-white/30">
            <div>{BUILDS.length} builds</div>
            <div>{BUILDS.filter(b => b.status === "working").length} working</div>
          </div>
        </div>

        {/* Build Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BUILDS.map((build) => {
            const s = STATUS_STYLES[build.status];
            return (
              <div
                key={build.folder}
                className="rounded-xl border-2 border-white/[0.08] bg-white/[0.02] p-5 flex flex-col gap-3 hover:border-white/[0.15] transition-colors"
              >
                {/* Top row: status + date */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
                    {s.label}
                  </span>
                  <span className="text-xs text-white/30">{build.date}</span>
                </div>

                {/* Name */}
                <h3 className="text-base font-bold text-white/90 leading-tight">{build.name}</h3>

                {/* Idea */}
                <p className="text-sm text-white/50 line-clamp-3">{build.idea}</p>

                {/* Takeaway */}
                <p className="text-xs text-white/35 italic line-clamp-2">{build.takeaway}</p>

                {/* Footer: agent + actions */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.06]">
                  <span className="text-xs text-white/40">Built by <span className="text-white/60 font-medium">{build.agent}</span></span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => alert("Coming soon — approval workflow")}
                      className="text-xs px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => alert("Coming soon — rejection workflow")}
                      className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
