"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   DOC VIEWER — Searchable Document Library
   Categorized view of plans, SOPs, newsletters, configs, and agent outputs
   ══════════════════════════════════════════════════════════════════════════════ */

interface Doc {
  title: string;
  category: string;
  author: string;
  date: string;
  summary: string;
  status: "active" | "draft" | "archived";
  path?: string;
}

const CATEGORIES = ["All", "Plans", "SOPs", "Configs", "Reports", "Creative", "Legal"];

const CATEGORY_ICONS: Record<string, string> = {
  Plans: "◆", SOPs: "◉", Configs: "⚙", Reports: "▣", Creative: "✦", Legal: "§",
};

const CATEGORY_COLORS: Record<string, string> = {
  Plans: "#C9A84C", SOPs: "#34d399", Configs: "#60a5fa", Reports: "#22d3ee", Creative: "#f472b6", Legal: "#a78bfa",
};

const DOCUMENTS: Doc[] = [
  { title: "METTLE Beta Launch Plan", category: "Plans", author: "Atlas", date: "2026-03-01", summary: "Saint Andrew's Aquatics onboarding sequence, invite system, CSV import, setup wizard, coach quickstart guide.", status: "active" },
  { title: "Parallax Publish Roadmap", category: "Plans", author: "Atlas", date: "2026-02-27", summary: "3 platforms live (Twitter, Bluesky, LinkedIn). Instagram blocked on FB Developer Portal. Scheduling backend needed.", status: "active" },
  { title: "Galactik Antics Phase 1 Matrix", category: "Plans", author: "AETHERION", date: "2026-02-26", summary: "10 architecture docs, 30+ tasks across 7 tracks. Shopify + art assets pending.", status: "draft" },
  { title: "Ramiche Studio Pricing & Tiers", category: "Plans", author: "MERCURY", date: "2026-03-01", summary: "Sprint $400 / Starter $1,500 / Pro $3,000 / Elite $6,000+. Client acquisition kit complete.", status: "active" },
  { title: "Revenue Priority Stack", category: "Plans", author: "MERCURY", date: "2026-03-01", summary: "METTLE beta → Ramiche Studio first client → Parallax agent marketplace → Galactik Antics.", status: "active" },
  { title: "Agent Deployment SOP", category: "SOPs", author: "Atlas", date: "2026-02-24", summary: "SkillsBench-optimized. 2-3 focused modules per skill doc. Curated > auto-generated (+16.2%).", status: "active" },
  { title: "Build & Deploy Checklist", category: "SOPs", author: "Atlas", date: "2026-03-02", summary: "Build → commit → push → vercel --prod --force → curl verify → check age header.", status: "active" },
  { title: "Service Worker Ban Protocol", category: "SOPs", author: "SHURI", date: "2026-03-02", summary: "SWs BANNED on all Parallax/METTLE apps. Self-destruct pattern + inline head script.", status: "active" },
  { title: "Repo Verification Protocol", category: "SOPs", author: "Atlas", date: "2026-03-02", summary: "HARD RULE: verify correct repo via MEMORY.md before editing ANY product code.", status: "active" },
  { title: "THEMIS Governance Protocol", category: "SOPs", author: "Atlas", date: "2026-03-04", summary: "Atlas commands. Executors build. Themis governs. Token discipline + role enforcement.", status: "active" },
  { title: "Atlas Operational Protocol", category: "SOPs", author: "Atlas", date: "2026-03-04", summary: "<250 words, no narration, diff-only, one step per turn, max 2 agents per step.", status: "active" },
  { title: "Gateway Config", category: "Configs", author: "Atlas", date: "2026-03-04", summary: "19 agents, all cloud. Opus 4.6 for Atlas, DeepSeek V3.2 for execution squad, Kimi K2.5 for brand/social.", status: "active" },
  { title: "Cron Schedule", category: "Configs", author: "Atlas", date: "2026-03-04", summary: "17 cron events. Morning brief 7:15 AM, intel scans 8AM-12:15PM, overnight builder 1 AM.", status: "active" },
  { title: "Firebase Security Rules", category: "Configs", author: "SHURI", date: "2026-02-20", summary: "Firestore rules locked down for apex-athlete-73755. Coach/athlete/parent access patterns.", status: "active" },
  { title: "Agent Squad Performance Report", category: "Reports", author: "SIMONS", date: "2026-03-03", summary: "19 agents operational. Build success rate: 85%. Average task completion: 12 min.", status: "active" },
  { title: "Site Audit Results", category: "Reports", author: "Atlas", date: "2026-02-27", summary: "19 routes: 9 functional, 7 marketing-only, 2 partial, 1 fixed. /agents has real e2e.", status: "active" },
  { title: "ByteByteGo Compliance", category: "Reports", author: "SHURI", date: "2026-02-25", summary: "ALL 52 items implemented: security, performance, UX, infrastructure.", status: "active" },
  { title: "Amir Mushich Creative Arsenal", category: "Creative", author: "INK", date: "2026-03-02", summary: "50 Nano Banana Pro prompts for branding, products, mockups, apparel, typography, posters, icons.", status: "active" },
  { title: "Living Experience Philosophy", category: "Creative", author: "Atlas", date: "2026-02-28", summary: "Every screen = a place. Cardiac entrainment 72 BPM, biophilia, proprioception. Ambient particles mandatory.", status: "active" },
  { title: "METTLE Brand Guidelines v5", category: "Creative", author: "VEE", date: "2026-02-17", summary: "Forged M. Biblical colors: purple, scarlet, gold, blue. Gamified athlete progression.", status: "active" },
  { title: "Copyright Registration", category: "Legal", author: "Atlas", date: "2026-02-17", summary: "METTLE copyright DONE. Patent filing in progress at USPTO ($65 micro entity).", status: "active" },
  { title: "Trademark Filing Notes", category: "Legal", author: "Atlas", date: "2026-02-20", summary: "METTLE — Class 9+41+42 recommended. Filing pending.", status: "draft" },
  { title: "ClawGuard Pro Pricing", category: "Legal", author: "MERCURY", date: "2026-02-22", summary: "Security scanner live. $299/$799/$1499 tiers. GitHub + Stripe wired.", status: "active" },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "ACTIVE" },
  draft: { bg: "bg-amber-500/10", text: "text-amber-400", label: "DRAFT" },
  archived: { bg: "bg-white/5", text: "text-white/30", label: "ARCHIVED" },
};

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return DOCUMENTS.filter((d) => {
      const matchSearch = !q || d.title.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q) || d.author.toLowerCase().includes(q);
      const matchCat = selectedCategory === "All" || d.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [search, selectedCategory]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: DOCUMENTS.length };
    DOCUMENTS.forEach((d) => { m[d.category] = (m[d.category] || 0) + 1; });
    return m;
  }, []);

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <ParticleField />

      {/* Header */}
      <div className="relative z-10 px-4 sm:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/command-center" className="text-xs text-white/40 hover:text-white/70 tracking-[0.2em] transition-colors">
              ← COMMAND CENTER
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">DOC</span>
              <span className="text-white/40 ml-2 text-lg font-light">VIEWER</span>
            </h1>
            <p className="text-white/30 text-xs tracking-[0.15em] mt-1">
              {DOCUMENTS.length} DOCUMENTS · {CATEGORIES.length - 1} CATEGORIES
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs">
              ✕
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium tracking-wider transition-all ${
                selectedCategory === cat
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white/60"
              }`}
            >
              {cat !== "All" && <span className="mr-1">{CATEGORY_ICONS[cat]}</span>}
              {cat}
              <span className="ml-1.5 text-[10px] opacity-50">{counts[cat] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      <div className="relative z-10 px-4 sm:px-8 pb-12">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="text-4xl mb-3">∅</p>
            <p className="text-sm">No documents match your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((doc, i) => {
              const catColor = CATEGORY_COLORS[doc.category] || "#6b7280";
              const st = STATUS_STYLES[doc.status];
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDoc(selectedDoc?.title === doc.title ? null : doc)}
                  className={`text-left bg-white/[0.02] hover:bg-white/[0.05] border-2 rounded-xl p-4 transition-all duration-200 ${
                    selectedDoc?.title === doc.title ? "border-cyan-500/40" : "border-white/[0.06] hover:border-white/10"
                  }`}
                >
                  {/* Category + Status */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border"
                      style={{ color: catColor, borderColor: `${catColor}40`, backgroundColor: `${catColor}10` }}
                    >
                      {CATEGORY_ICONS[doc.category]} {doc.category.toUpperCase()}
                    </span>
                    <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-white/90 mb-1.5 leading-tight">{doc.title}</h3>

                  {/* Summary */}
                  <p className="text-xs text-white/40 leading-relaxed line-clamp-2 mb-3">{doc.summary}</p>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[10px] text-white/25">
                    <span>{doc.author}</span>
                    <span>{doc.date}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedDoc && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-[#0d0d14]/95 backdrop-blur-xl border-t-2 border-cyan-500/20 p-6 max-h-[50vh] overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span
                  className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border mb-2 inline-block"
                  style={{ color: CATEGORY_COLORS[selectedDoc.category], borderColor: `${CATEGORY_COLORS[selectedDoc.category]}40`, backgroundColor: `${CATEGORY_COLORS[selectedDoc.category]}10` }}
                >
                  {selectedDoc.category.toUpperCase()}
                </span>
                <h2 className="text-lg font-bold text-white/90 mt-1">{selectedDoc.title}</h2>
                <p className="text-xs text-white/30 mt-1">{selectedDoc.author} · {selectedDoc.date}</p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-white/30 hover:text-white/70 text-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">{selectedDoc.summary}</p>
            {selectedDoc.path && (
              <p className="text-xs text-cyan-400/50 mt-3 font-mono">{selectedDoc.path}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
