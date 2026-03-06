"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";
import { db, hasConfig } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, query, orderBy } from "firebase/firestore";

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
  reviewStatus?: "approved" | "rejected" | "pending";
}

type ReviewStatus = "pending" | "approved" | "rejected";

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  working:  { label: "Working",  color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  partial:  { label: "Partial",  color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  failed:   { label: "Failed",   color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  approved: { label: "Approved", color: "#22c55e", bg: "rgba(34,197,94,0.25)" },
  rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.25)" },
};

const SEED_BUILDS: Build[] = [
  { date: "2026-03-05", name: "PrintQueue — Production Queue Manager", idea: "Real-time print job queue manager with priority ordering, material stock validation, cost tracking, live progress simulation", status: "working", takeaway: "32KB single HTML file. Full job lifecycle. Seeded with Parallax ecosystem data.", folder: "2026-03-05-print-queue-dashboard", agent: "Nova" },
  { date: "2026-03-03", name: "FilaTrack — Filament Inventory & Cost Tracker", idea: "Interactive filament inventory manager with spool tracking, print logging, cost-per-gram analytics, low-stock alerts", status: "working", takeaway: "1137-line single HTML. Full spool lifecycle: add, log prints, track costs, low-stock alerts.", folder: "2026-03-03-filament-tracker", agent: "Nova" },
  { date: "2026-03-02", name: "PrintDiag — 3D Print Failure Analyzer", idea: "Interactive FDM failure diagnostic tool with 10 failure modes, step-by-step flowcharts, slicer quick-fix tables", status: "working", takeaway: "690-line single HTML covering 10 FDM failures with diagnostic flowcharts.", folder: "2026-03-02-print-failure-analyzer", agent: "Nova" },
  { date: "2026-03-02", name: "PrintFlow Storefront", idea: "Full drag-and-drop 3D print quoting storefront — Three.js STL viewer, instant cost calculator, material selector", status: "working", takeaway: "1064 lines. Three.js STL viewer with live cost calculation.", folder: "2026-03-02-printflow-storefront", agent: "Nova" },
  { date: "2026-03-02", name: "Squad Status Board", idea: "Live dashboard showing all 19 agents with capability badges, model info, and provider", status: "working", takeaway: "Exposed capability gaps across the squad.", folder: "2026-03-02-squad-status-board", agent: "Atlas" },
];

export default function YoloBuildsPage() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);

  useEffect(() => {
    async function loadBuilds() {
      if (db && hasConfig) {
        try {
          const q = query(collection(db, "yolo_builds"), orderBy("date", "desc"));
          const snap = await getDocs(q);
          const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as Build));
          if (data.length > 0) { setBuilds(data); return; }
          // Firestore empty — seed it
          for (const build of SEED_BUILDS) {
            await setDoc(doc(db, "yolo_builds", build.folder), { ...build, reviewStatus: "pending" }, { merge: true });
          }
          setBuilds(SEED_BUILDS.map(b => ({ ...b, reviewStatus: "pending" as ReviewStatus })));
          return;
        } catch {}
      }
      // No Firestore — use seed data directly
      setBuilds(SEED_BUILDS.map(b => ({ ...b, reviewStatus: "pending" as ReviewStatus })));
    }
    loadBuilds();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const setReview = async (folder: string, status: ReviewStatus) => {
    // Update Firestore
    if (db && hasConfig) {
      try {
        const docRef = doc(db, "yolo_builds", folder);
        await setDoc(docRef, { reviewStatus: status, reviewedAt: new Date().toISOString() }, { merge: true });
      } catch {}
    }
    // Update local state
    setBuilds((prev) =>
      prev.map((b) => (b.folder === folder ? { ...b, reviewStatus: status } : b)),
    );
    if (status === "approved") {
      setToast({ message: "Build approved \u2014 saved to Firestore", color: "#22c55e" });
    } else if (status === "rejected") {
      setToast({ message: "Build rejected \u2014 saved to Firestore", color: "#ef4444" });
    } else {
      setToast({ message: "Review reset to pending", color: "#a3a3a3" });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white">
      <ParticleField />
      {/* Toast notification */}
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/command-center" className="text-white/40 hover:text-white/70 text-sm mb-2 inline-block">&larr; Command Center</Link>
            <h1 className="text-2xl font-bold tracking-tight">YOLO Overnight Builds</h1>
            <p className="text-white/40 text-sm mt-1">Every night, the squad generates a wild idea and builds a working prototype.</p>
          </div>
          <div className="text-right text-sm text-white/30">
            <div>{builds.length} builds</div>
            <div>{builds.filter(b => b.status === "working").length} working</div>
          </div>
        </div>

        {/* Build Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {builds.map((build) => {
            const review = build.reviewStatus ?? "pending";
            const isApproved = review === "approved";
            const isRejected = review === "rejected";
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
                    : "rgba(255,255,255,0.08)",
                  background: isApproved
                    ? "rgba(34,197,94,0.05)"
                    : isRejected
                    ? "rgba(239,68,68,0.03)"
                    : "rgba(255,255,255,0.02)",
                  boxShadow: isApproved
                    ? "0 0 20px rgba(34,197,94,0.15)"
                    : "none",
                  opacity: isRejected ? 0.6 : 1,
                }}
              >
                {/* Top row: status + date */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
                    {s.label}
                  </span>
                  <span className="text-xs text-white/30">{build.date}</span>
                </div>

                {/* Name — clickable link to build */}
                <a
                  href={`/yolo-builds/${build.folder}/index.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <h3
                    className="text-base font-bold leading-tight group-hover:underline"
                    style={{
                      color: isRejected ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)",
                      textDecoration: isRejected ? "line-through" : "none",
                    }}
                  >
                    {build.name}
                  </h3>
                </a>

                {/* Idea */}
                <p className="text-sm text-white/50 line-clamp-3">{build.idea}</p>

                {/* Takeaway */}
                <p className="text-xs text-white/35 italic line-clamp-2">{build.takeaway}</p>

                {/* Footer: agent + actions */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.06]">
                  <span className="text-xs text-white/40">Built by <span className="text-white/60 font-medium">{build.agent}</span></span>
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
                      {isApproved ? "Approved" : "Approve"}
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
                      {isRejected ? "Rejected" : "Reject"}
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
