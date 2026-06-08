"use client";

import { useState, useMemo } from "react";
import { CC_DOCUMENTS, type CcDoc } from "@/data/cc-documents";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   DOC VIEWER — Searchable Document Library
   Categorized view of plans, SOPs, newsletters, configs, and agent outputs
   Source: src/data/cc-documents.ts + GET /api/command-center/docs
   ══════════════════════════════════════════════════════════════════════════════ */

type Doc = CcDoc;

const CATEGORIES = ["All", "Plans", "SOPs", "Configs", "Reports", "Creative", "Legal"];

const CATEGORY_ICONS: Record<string, string> = {
  Plans: "◆", SOPs: "◉", Configs: "⚙", Reports: "▣", Creative: "✦", Legal: "§",
};

const CATEGORY_COLORS: Record<string, string> = {
  Plans: "#C9A84C", SOPs: "#34d399", Configs: "#60a5fa", Reports: "#22d3ee", Creative: "#f472b6", Legal: "#a78bfa",
};

const DOCUMENTS: Doc[] = CC_DOCUMENTS;

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
    <InstrumentPage
      id="docs"
      title="Doc Viewer"
      section="Workspace"
      icon="docs"
      accent="var(--c-indigo)"
    >
      {/* Search + Category filter */}
      <Panel title="Library" icon="docs" badge={`${DOCUMENTS.length} docs · ${CATEGORIES.length - 1} cats`}>
        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors"
            style={{ background: "var(--ink-2)", border: "1px solid var(--line)", color: "var(--t-hi)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--t-lo)" }}>
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
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium tracking-wider transition-all"
              style={
                selectedCategory === cat
                  ? { background: "color-mix(in oklab, var(--accent) 18%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in oklab, var(--accent) 35%, transparent)" }
                  : { background: "var(--ink-2)", color: "var(--t-mid)", border: "1px solid var(--line)" }
              }
            >
              {cat !== "All" && <span className="mr-1">{CATEGORY_ICONS[cat]}</span>}
              {cat}
              <span className="ml-1.5 text-[10px] opacity-50">{counts[cat] || 0}</span>
            </button>
          ))}
        </div>
      </Panel>

      {/* Document Grid */}
      <div className="pt-5">
        {filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: "var(--t-lo)" }}>
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
                  className="text-left rounded-xl p-4 transition-all duration-200"
                  style={{
                    background: "var(--ink-1)",
                    border: selectedDoc?.title === doc.title
                      ? "2px solid color-mix(in oklab, var(--accent) 40%, transparent)"
                      : "2px solid var(--line)",
                  }}
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
                  <h3 className="text-sm font-semibold mb-1.5 leading-tight" style={{ color: "var(--t-hi)" }}>{doc.title}</h3>

                  {/* Summary */}
                  <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: "var(--t-mid)" }}>{doc.summary}</p>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--t-lo)" }}>
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
        <div
          className="fixed inset-x-0 bottom-0 z-50 backdrop-blur-xl p-6 max-h-[50vh] overflow-y-auto"
          style={{ background: "color-mix(in oklab, var(--ink-1) 95%, transparent)", borderTop: "2px solid color-mix(in oklab, var(--accent) 30%, transparent)" }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span
                  className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border mb-2 inline-block"
                  style={{ color: CATEGORY_COLORS[selectedDoc.category], borderColor: `${CATEGORY_COLORS[selectedDoc.category]}40`, backgroundColor: `${CATEGORY_COLORS[selectedDoc.category]}10` }}
                >
                  {selectedDoc.category.toUpperCase()}
                </span>
                <h2 className="text-lg font-bold mt-1" style={{ color: "var(--t-hi)" }}>{selectedDoc.title}</h2>
                <p className="text-xs mt-1" style={{ color: "var(--t-mid)" }}>{selectedDoc.author} · {selectedDoc.date}</p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-lg transition-colors"
                style={{ color: "var(--t-lo)" }}
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--t-mid)" }}>{selectedDoc.summary}</p>
            {selectedDoc.path && (
              <p className="text-xs mt-3 font-mono" style={{ color: "var(--accent)" }}>{selectedDoc.path}</p>
            )}
          </div>
        </div>
      )}
    </InstrumentPage>
  );
}
