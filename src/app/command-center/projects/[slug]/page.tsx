"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

/* ══════════════════════════════════════════════════════════════════════════════
   PROJECT HQ — Per-Project Dashboard with Doc Viewer
   Now fetches LIVE data from /api/command-center/projects (workspace files).
   ══════════════════════════════════════════════════════════════════════════════ */

interface ProjectTask { t: string; done: boolean }
interface Project {
  name: string;
  slug: string;
  accent: string;
  status: string;
  desc: string;
  priority: number;
  priorityLabel: string;
  agents: string[];
  lead: string;
  tasks: ProjectTask[];
  blockers?: string[];
  link: { label: string; href: string } | null;
}

const DOC_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  "ARCHITECTURE.md": { label: "Architecture", icon: "◈", desc: "Stack, routes, infrastructure" },
  "DECISIONS.md": { label: "Decisions", icon: "◇", desc: "Why we chose X over Y" },
  "MEMORY.md": { label: "Memory", icon: "◉", desc: "Project-specific context" },
  "PIPELINE.md": { label: "Pipeline", icon: "▸", desc: "Sprint flow & task states" },
  "TASKS.md": { label: "Tasks", icon: "☐", desc: "Current backlog & completed" },
};

const NAV = [
  { label: "COMMAND", href: "/command-center" },
  { label: "AGENTS", href: "/command-center/agents" },
  { label: "PROJECTS", href: "/command-center/projects" },
  { label: "METTLE", href: "/apex-athlete" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "rgba(34,197,94,0.08)", text: "#059669", border: "#059669" },
  blocked: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "#ef4444" },
  shipped: { bg: "rgba(59,130,246,0.08)", text: "#3b82f6", border: "#3b82f6" },
  planning: { bg: "rgba(168,85,247,0.08)", text: "#a855f7", border: "#a855f7" },
  paused: { bg: "rgba(100,116,139,0.08)", text: "#94a3b8", border: "#94a3b8" },
};

function getProgress(p: Project): number {
  if (p.tasks.length === 0) return 0;
  return Math.round((p.tasks.filter(t => t.done).length / p.tasks.length) * 100);
}

export default function ProjectHQ() {
  const params = useParams();
  const slug = params?.slug as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<string[]>([]);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [docLoading, setDocLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"overview" | "docs" | "tasks">("overview");

  // Fetch project data from API
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/command-center/projects?slug=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.docs) setDocs(data.docs);
        // Build project object from API response
        if (data.name) {
          setProject({
            name: data.name,
            slug: data.slug || slug,
            accent: data.accent || "#7c3aed",
            status: data.status || "active",
            desc: data.desc || "",
            priority: data.priority || 99,
            priorityLabel: data.priorityLabel || "",
            agents: data.agents || [],
            lead: data.lead || "Atlas",
            tasks: data.tasks || [],
            blockers: data.blockers || [],
            link: data.link || null,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  // Fetch doc content
  const loadDoc = (docName: string) => {
    setActiveDoc(docName);
    setDocLoading(true);
    setDocContent("");
    fetch(`/api/command-center/projects?slug=${slug}&doc=${docName}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.content) setDocContent(data.content);
        setDocLoading(false);
      })
      .catch(() => setDocLoading(false));
  };

  // Share doc (copy link)
  const shareDoc = () => {
    const url = `${window.location.origin}/command-center/projects/${slug}?doc=${activeDoc}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Auto-open doc from URL param
  useEffect(() => {
    const urlDoc = new URLSearchParams(window.location.search).get("doc");
    if (urlDoc && docs.includes(urlDoc)) {
      loadDoc(urlDoc);
      setTab("docs");
    }
  }, [docs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <main className="min-h-screen w-full" style={{ background: "#0a0a14", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ padding: "120px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', color: '#94a3b8' }}>LOADING PROJECT…</div>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen w-full" style={{ background: "#0a0a14", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ padding: "120px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#e2e8f0' }}>Project not found</h1>
          <Link href="/command-center/projects" style={{ color: "#c4b5fd", marginTop: 16, display: "inline-block" }}>← Back to Projects</Link>
        </div>
      </main>
    );
  }

  const sc = STATUS_COLORS[project.status] || STATUS_COLORS.active;
  const progress = getProgress(project);
  const doneTasks = project.tasks.filter((t) => t.done).length;

  return (
    <main className="min-h-screen w-full" style={{ background: "#0a0a14", color: "#e2e8f0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Grid background */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px", opacity: 0.4,
      }} />

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(10,10,20,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/parallax-logo.jpg" alt="Parallax" style={{ width: 36, height: 44, objectFit: "contain" }} />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "0.1em", color: "#c4b5fd" }}>PARALLAX</span>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 14 }}>|</span>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "#94a3b8" }}>PROJECT HQ</span>
          </Link>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {NAV.map((n) => (
              <Link key={n.label} href={n.href} style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", color: "#94a3b8", transition: "color 0.2s" }}>
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="relative z-10 w-full" style={{ maxWidth: 1400, margin: "0 auto", padding: "100px 24px 48px" }}>
        {/* Back link */}
        <Link href="/command-center/projects" style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16, display: "inline-block" }}>
          ← Back to Projects
        </Link>

        {/* Project Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                background: `${project.accent}15`, border: `2px solid ${project.accent}30`, fontSize: 20, fontWeight: 800, color: project.accent,
              }}>
                {project.name.charAt(0)}
              </div>
              <div>
                <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, lineHeight: 1.1, margin: 0, color: '#e2e8f0' }}>{project.name}</h1>
                <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0" }}>{project.desc}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "3px 10px", borderRadius: 10, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}30`,
              }}>{project.status}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                Priority #{project.priority}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                Lead: {project.lead}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: sc.text, lineHeight: 1 }}>{progress}%</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{doneTasks}/{project.tasks.length} tasks done</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${project.accent}, ${project.accent}80)`, borderRadius: 4, transition: "width 0.5s ease" }} />
        </div>

        {/* Blockers */}
        {project.blockers && project.blockers.length > 0 && (
          <div style={{ marginBottom: 24, padding: 16, background: "rgba(239,68,68,0.04)", border: "2px solid rgba(239,68,68,0.12)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ef4444", marginBottom: 8 }}>Blockers</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {project.blockers.map((b, i) => (
                <span key={i} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>{b}</span>
              ))}
            </div>
          </div>
        )}

        {/* Agents */}
        <div style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", padding: "4px 0", marginRight: 4 }}>Team:</span>
          {project.agents.map((a) => (
            <span key={a} style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8, background: `${project.accent}08`, color: project.accent, border: `1px solid ${project.accent}20` }}>{a}</span>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 0, marginBottom: 32, borderBottom: "2px solid rgba(255,255,255,0.06)" }}>
          {(["overview", "docs", "tasks"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "12px 24px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              cursor: "pointer", background: "transparent", border: "none", borderBottom: tab === t ? `3px solid ${project.accent}` : "3px solid transparent",
              color: tab === t ? "#e2e8f0" : "#94a3b8", transition: "all 0.2s", marginBottom: -2,
            }}>
              {t === "docs" ? `Documents (${docs.length})` : t === "tasks" ? `Tasks (${project.tasks.length})` : "Overview"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {/* Quick Stats */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "2px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 16 }}>Quick Stats</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sc.text }}>{progress}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>Tasks Complete</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{doneTasks}/{project.tasks.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>Team Size</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{project.agents.length} agents</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>Documents</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{docs.length} files</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>Blockers</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: project.blockers?.length ? "#ef4444" : "#059669" }}>
                    {project.blockers?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Documents Quick Access */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "2px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 16 }}>Documents</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map((d) => {
                  const info = DOC_LABELS[d] || { label: d, icon: "◻", desc: "" };
                  return (
                    <button key={d} onClick={() => { setTab("docs"); loadDoc(d); }} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
                      transition: "all 0.2s", textAlign: "left", width: "100%",
                    }}>
                      <span style={{ fontSize: 16, color: project.accent }}>{info.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{info.label}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{info.desc}</div>
                      </div>
                    </button>
                  );
                })}
                {docs.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8" }}>No documents found</div>}
              </div>
            </div>

            {/* Recent Tasks */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "2px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 16 }}>Tasks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {project.tasks.slice(0, 8).map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                      background: t.done ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
                      border: t.done ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.08)",
                      color: t.done ? "#059669" : "#94a3b8", flexShrink: 0,
                    }}>{t.done ? "✓" : ""}</span>
                    <span style={{ color: t.done ? "#64748b" : "#e2e8f0", textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.6 : 1, lineHeight: 1.3 }}>{t.t}</span>
                  </div>
                ))}
                {project.tasks.length > 8 && (
                  <button onClick={() => setTab("tasks")} style={{ fontSize: 11, color: project.accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}>
                    + {project.tasks.length - 8} more →
                  </button>
                )}
              </div>
            </div>

            {/* Link */}
            {project.link && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "2px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 16 }}>Quick Link</div>
                <Link href={project.link.href} style={{
                  display: "inline-block", padding: "12px 28px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.1em", color: "#fff",
                  background: `linear-gradient(135deg, ${project.accent}, ${project.accent}cc)`,
                  transition: "all 0.2s", textDecoration: "none",
                }}>
                  {project.link.label} →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── DOCS TAB ── */}
        {tab === "docs" && (
          <div style={{ display: "grid", gridTemplateColumns: activeDoc ? "240px 1fr" : "1fr", gap: 20 }}>
            {/* Doc sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {docs.map((d) => {
                const info = DOC_LABELS[d] || { label: d, icon: "◻", desc: "" };
                const isActive = activeDoc === d;
                return (
                  <button key={d} onClick={() => loadDoc(d)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10,
                    background: isActive ? `${project.accent}08` : "rgba(255,255,255,0.03)",
                    border: isActive ? `2px solid ${project.accent}30` : "2px solid rgba(255,255,255,0.06)",
                    cursor: "pointer", transition: "all 0.2s", textAlign: "left", width: "100%",
                  }}>
                    <span style={{ fontSize: 16, color: isActive ? project.accent : "#94a3b8" }}>{info.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#e2e8f0" : "#94a3b8" }}>{info.label}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{info.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Doc content viewer */}
            {activeDoc && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "2px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 0, overflow: "hidden" }}>
                {/* Doc header */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)",
                }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#e2e8f0" }}>
                      {DOC_LABELS[activeDoc]?.icon} {DOC_LABELS[activeDoc]?.label || activeDoc}
                    </h3>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{slug}/{activeDoc}</span>
                  </div>
                  <button onClick={shareDoc} style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    background: copied ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                    border: copied ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.08)",
                    color: copied ? "#059669" : "#94a3b8", transition: "all 0.2s",
                  }}>
                    {copied ? "✓ Copied!" : "Share Link"}
                  </button>
                </div>

                {/* Doc body */}
                <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
                  {docLoading ? (
                    <div style={{ fontSize: 14, color: "#94a3b8", textAlign: "center", padding: 40 }}>Loading...</div>
                  ) : (
                    <pre style={{
                      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                      fontSize: 13, lineHeight: 1.7, color: "#cbd5e1", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      margin: 0, background: "transparent",
                    }}>
                      {docContent}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {!activeDoc && (
              <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                Select a document to view
              </div>
            )}
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {tab === "tasks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {project.tasks.map((t, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: "2px solid rgba(255,255,255,0.06)", transition: "all 0.2s",
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
                  background: t.done ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
                  border: t.done ? "2px solid rgba(34,197,94,0.25)" : "2px solid rgba(255,255,255,0.08)",
                  color: t.done ? "#059669" : "#94a3b8",
                }}>{t.done ? "✓" : ""}</span>
                <span style={{ fontSize: 14, color: t.done ? "#64748b" : "#e2e8f0", textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.6 : 1 }}>{t.t}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
