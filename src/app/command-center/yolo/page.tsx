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
  tier?: 1 | 2 | 3;
  score?: number;
}

/* ── TIER SYSTEM ────────────────────────────────────────────────────────────
   Tier 1: Internal Tool — auto-deploy to /tools/{slug}, available immediately
   Tier 2: Feature Integration — extract core logic, wire into existing project
   Tier 3: Standalone Product — own repo, domain, Stripe, landing page
   ────────────────────────────────────────────────────────────────────────── */
const TIER_CONFIG: Record<number, { label: string; icon: string; color: string; bg: string; desc: string }> = {
  1: { label: "TOOL", icon: "🔧", color: "#22d3ee", bg: "rgba(34,211,238,0.15)", desc: "Internal tool — auto-deploy to /tools/" },
  2: { label: "INTEGRATE", icon: "🔗", color: "#a855f7", bg: "rgba(168,85,247,0.15)", desc: "Extract & wire into existing project" },
  3: { label: "PRODUCT", icon: "🚀", color: "#C9A84C", bg: "rgba(201,168,76,0.15)", desc: "Standalone product — own repo & domain" },
};

type ReviewStatus = "pending" | "approved" | "rejected";

function slugToName(folder: string): string {
  const parts = folder.replace(/^\d{4}-\d{2}-\d{2}-[a-z-]+?-/, "").split("-");
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

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
  { id: "themis", label: "THEMIS", accent: "#C9A84C", lane: "Legal & Governance" },
  { id: "nova", label: "NOVA", accent: "#7c3aed", lane: "Product Prototypes" },
  { id: "proximon", label: "PROXIMON", accent: "#22d3ee", lane: "Systems & Optimization" },
  { id: "simons", label: "SIMONS", accent: "#f59e0b", lane: "Data & Analytics" },
  { id: "mercury", label: "MERCURY", accent: "#34d399", lane: "Sales & Revenue" },
  { id: "dr strange", label: "DR STRANGE", accent: "#a855f7", lane: "Scenario Modeling" },
  { id: "triage", label: "TRIAGE", accent: "#ef4444", lane: "System Health" },
  { id: "atlas", label: "ATLAS", accent: "#3b82f6", lane: "Operations" },
];


export default function YoloBuildsPage() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);

  useEffect(() => {
    async function loadBuilds() {
      // Step 1: Fetch live builds from disk API (source of truth)
      let diskBuilds: Build[] = [];
      try {
        const res = await fetch("/api/command-center/yolo-builds", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          diskBuilds = Array.isArray(data) ? data.map((b: Record<string, unknown>) => ({
            date: (b.date as string) || "",
            name: (b.name as string) || slugToName((b.folder as string) || ""),
            idea: (b.idea as string) || "",
            status: (b.status as Build["status"]) || "working",
            takeaway: (b.takeaway as string) || "",
            folder: (b.folder as string) || "",
            agent: (b.agent as string) || "Unknown",
            reviewStatus: "pending" as ReviewStatus,
            tier: b.tier as 1 | 2 | 3 | undefined,
            score: b.score as number | undefined,
          })) : [];
        }
      } catch {}

      // Step 2: Try Firestore for review status / tier / score metadata
      const fsData = new Map<string, { reviewStatus?: string; tier?: number; score?: number }>();
      if (db && hasConfig) {
        try {
          const q = query(collection(db, "yolo_builds"), orderBy("date", "desc"));
          const snap = await getDocs(q);
          snap.docs.forEach(d => {
            const data = d.data();
            fsData.set(data.folder || d.id, {
              reviewStatus: data.reviewStatus,
              tier: data.tier,
              score: data.score,
            });
          });
        } catch {}
      }

      // Step 3: Use disk builds — no hardcoded fallback (empty state if API returns nothing)
      const enriched = diskBuilds.map(b => {
        const fs = fsData.get(b.folder);
        return {
          ...b,
          name: b.name || slugToName(b.folder),
          idea: b.idea || "",
          takeaway: b.takeaway || "",
          reviewStatus: (fs?.reviewStatus || "pending") as ReviewStatus,
          tier: (fs?.tier ?? b.tier) as 1 | 2 | 3 | undefined,
          score: (fs?.score ?? b.score) as number | undefined,
        };
      });
      enriched.sort((a, b) => b.date.localeCompare(a.date));
      setBuilds(enriched);
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
      setToast({ message: "Build approved — select a tier to promote", color: "#22c55e" });
    } else if (status === "rejected") {
      setToast({ message: "Build rejected", color: "#ef4444" });
    } else {
      setToast({ message: "Review reset", color: "#a3a3a3" });
    }
  };

  const setTier = async (folder: string, tier: 1 | 2 | 3) => {
    if (db && hasConfig) {
      try {
        const docRef = doc(db, "yolo_builds", folder);
        await setDoc(docRef, { tier, tierAssignedAt: new Date().toISOString() }, { merge: true });
      } catch {}
    }
    setBuilds((prev) =>
      prev.map((b) => (b.folder === folder ? { ...b, tier, reviewStatus: "approved" as ReviewStatus } : b)),
    );
    const t = TIER_CONFIG[tier];
    setToast({ message: `${t.icon} Promoted to ${t.label}`, color: t.color });
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

        {/* Tier Key */}
        <div className="mb-6 border-2 border-white/[0.06] rounded-xl p-4">
          <h3 className="text-[10px] font-bold tracking-widest mb-3 text-white/40">POST-APPROVAL TIER KEY</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((t) => {
              const cfg = TIER_CONFIG[t as 1 | 2 | 3];
              return (
                <div key={t} className="flex items-center gap-3 rounded-lg border-2 px-3 py-2" style={{ borderColor: `${cfg.color}30`, background: cfg.bg }}>
                  <span className="text-lg">{cfg.icon}</span>
                  <div>
                    <div className="text-xs font-bold" style={{ color: cfg.color }}>TIER {t}: {cfg.label}</div>
                    <div className="text-[10px] text-white/40">{cfg.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Build Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {builds.length === 0 && (
            <span style={{ fontSize: 13, color: '#555', padding: '24px 0', gridColumn: '1 / -1' }}>No builds loaded — waiting for YOLO builds API</span>
          )}
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

                {/* Tier badge (if assigned) */}
                {build.tier && (
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded"
                      style={{ background: TIER_CONFIG[build.tier].bg, color: TIER_CONFIG[build.tier].color }}
                    >
                      {TIER_CONFIG[build.tier].icon} TIER {build.tier}: {TIER_CONFIG[build.tier].label}
                    </span>
                  </div>
                )}

                {/* Footer: actions */}
                <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
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
                  {/* Tier selector — shows after approval */}
                  {isApproved && (
                    <div className="flex gap-2">
                      {([1, 2, 3] as const).map((t) => {
                        const cfg = TIER_CONFIG[t];
                        const isActive = build.tier === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setTier(build.folder, t)}
                            className="flex-1 text-[10px] font-bold tracking-wider py-1.5 rounded border-2 transition-all"
                            style={{
                              borderColor: isActive ? cfg.color : `${cfg.color}30`,
                              color: isActive ? "#fff" : cfg.color,
                              background: isActive ? cfg.bg : "transparent",
                              boxShadow: isActive ? `0 0 12px ${cfg.color}25` : "none",
                            }}
                          >
                            {cfg.icon} T{t}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Promotion Panel — appears when tier is assigned */}
                  {build.tier === 1 && (
                    <div
                      className="rounded-lg border-2 p-3 mt-1 flex flex-col gap-2"
                      style={{ borderColor: `${TIER_CONFIG[1].color}40`, background: `${TIER_CONFIG[1].color}08` }}
                    >
                      <div className="text-[10px] tracking-wider text-white/60">
                        Ready to deploy to <span className="font-bold" style={{ color: TIER_CONFIG[1].color }}>/tools/{build.folder}</span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`vercel deploy --prod ./yolo-builds/${build.folder} --name tools-${build.folder}`);
                          setToast({ message: "Deploy command copied to clipboard", color: TIER_CONFIG[1].color });
                        }}
                        className="text-[10px] font-bold tracking-wider py-1.5 rounded border-2 transition-all hover:brightness-125"
                        style={{
                          borderColor: TIER_CONFIG[1].color,
                          color: TIER_CONFIG[1].color,
                          background: `${TIER_CONFIG[1].color}15`,
                        }}
                      >
                        DEPLOY TO TOOLS
                      </button>
                      <div className="text-[10px] tracking-wider font-medium" style={{ color: TIER_CONFIG[1].color }}>
                        Awaiting deployment
                      </div>
                    </div>
                  )}
                  {build.tier === 2 && (
                    <div
                      className="rounded-lg border-2 p-3 mt-1 flex flex-col gap-2"
                      style={{ borderColor: `${TIER_CONFIG[2].color}40`, background: `${TIER_CONFIG[2].color}08` }}
                    >
                      <textarea
                        data-packet={build.folder}
                        className="w-full rounded border-2 bg-transparent text-[10px] tracking-wider text-white/70 p-2 resize-none focus:outline-none"
                        style={{ borderColor: `${TIER_CONFIG[2].color}30` }}
                        rows={7}
                        defaultValue={`AGENT: \nTARGET PROJECT: \nSOURCE: /yolo-builds/${build.folder}\nTASK: Extract core logic and integrate into target\nDONE CRITERIA: `}
                      />
                      <button
                        onClick={() => {
                          const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[data-packet="${build.folder}"]`);
                          const text = textarea?.value || `AGENT: \nTARGET PROJECT: \nSOURCE: /yolo-builds/${build.folder}\nTASK: Extract core logic and integrate into target\nDONE CRITERIA: `;
                          navigator.clipboard.writeText(text);
                          setToast({ message: "Delegation packet copied", color: TIER_CONFIG[2].color });
                        }}
                        className="text-[10px] font-bold tracking-wider py-1.5 rounded border-2 transition-all hover:brightness-125"
                        style={{
                          borderColor: TIER_CONFIG[2].color,
                          color: TIER_CONFIG[2].color,
                          background: `${TIER_CONFIG[2].color}15`,
                        }}
                      >
                        COPY PACKET
                      </button>
                    </div>
                  )}
                  {build.tier === 3 && (
                    <div
                      className="rounded-lg border-2 p-3 mt-1 flex flex-col gap-2"
                      style={{ borderColor: `${TIER_CONFIG[3].color}40`, background: `${TIER_CONFIG[3].color}08` }}
                    >
                      {[
                        "Create repo",
                        "Set up domain",
                        "Wire Stripe",
                        "Build landing page",
                        "Deploy to production",
                      ].map((item) => (
                        <label key={item} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="accent-[#C9A84C] w-3 h-3"
                          />
                          <span className="text-[10px] tracking-wider text-white/60 group-hover:text-white/80 transition-colors">
                            {item}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
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
