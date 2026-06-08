"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InstrumentPage } from "@/components/command-center/po/Instrument";

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
  repo?: string;
  repoPath?: string;
  liveUrl?: string | null;
  stack?: string[];
}

const DOC_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  "ARCHITECTURE.md": { label: "Architecture", icon: "◈", desc: "Stack, routes, infrastructure" },
  "DECISIONS.md": { label: "Decisions", icon: "◇", desc: "Why we chose X over Y" },
  "MEMORY.md": { label: "Memory", icon: "◉", desc: "Project-specific context" },
  "PIPELINE.md": { label: "Pipeline", icon: "▸", desc: "Sprint flow & task states" },
  "TASKS.md": { label: "Tasks", icon: "☐", desc: "Current backlog & completed" },
};

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
      const t = setTimeout(() => { loadDoc(urlDoc); setTab("docs"); }, 0);
      return () => clearTimeout(t);
    }
  }, [docs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <InstrumentPage id="projects" title="Project" section="Workspace" icon="projects" accent="var(--c-indigo)">
        <div style={{ padding: "80px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--t-mid)' }}>LOADING PROJECT…</div>
        </div>
      </InstrumentPage>
    );
  }

  if (!project) {
    return (
      <InstrumentPage id="projects" title="Project" section="Workspace" icon="projects" accent="var(--c-indigo)">
        <div style={{ padding: "80px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--t-hi)' }}>Project not found</h1>
          <Link href="/command-center/projects" style={{ color: "var(--accent)", marginTop: 16, display: "inline-block" }}>← Back to Projects</Link>
        </div>
      </InstrumentPage>
    );
  }

  const sc = STATUS_COLORS[project.status] || STATUS_COLORS.active;
  const progress = getProgress(project);
  const doneTasks = project.tasks.filter((t) => t.done).length;

  return (
    <InstrumentPage
      id="projects"
      title={project.name}
      section="Workspace"
      icon="projects"
      accent="var(--c-indigo)"
      actions={
        <Link href="/command-center/projects" style={{ fontSize: 12, color: "var(--t-mid)", textDecoration: "none" }}>
          ← Back to Projects
        </Link>
      }
    >
      <div>
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
                <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, lineHeight: 1.1, margin: 0, color: 'var(--t-hi)' }}>{project.name}</h1>
                <p style={{ fontSize: 14, color: "var(--t-mid)", margin: "4px 0 0" }}>{project.desc}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "3px 10px", borderRadius: 10, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}30`,
              }}>{project.status}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 10, background: "var(--ink-2)", color: "var(--t-mid)" }}>
                Priority #{project.priority}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 10, background: "var(--ink-2)", color: "var(--t-mid)" }}>
                Lead: {project.lead}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: sc.text, lineHeight: 1 }}>{progress}%</div>
            <div style={{ fontSize: 12, color: "var(--t-mid)", marginTop: 4 }}>{doneTasks}/{project.tasks.length} tasks done</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden", marginBottom: 24 }}>
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
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--t-mid)", padding: "4px 0", marginRight: 4 }}>Team:</span>
          {project.agents.map((a) => (
            <span key={a} style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8, background: `${project.accent}08`, color: project.accent, border: `1px solid ${project.accent}20` }}>{a}</span>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 0, marginBottom: 32, borderBottom: "2px solid var(--line)" }}>
          {(["overview", "docs", "tasks"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "12px 24px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              cursor: "pointer", background: "transparent", border: "none", borderBottom: tab === t ? `3px solid ${project.accent}` : "3px solid transparent",
              color: tab === t ? "var(--t-hi)" : "var(--t-mid)", transition: "all 0.2s", marginBottom: -2,
            }}>
              {t === "docs" ? `Documents (${docs.length})` : t === "tasks" ? `Tasks (${project.tasks.length})` : "Overview"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {/* Quick Stats */}
            <div style={{ background: "var(--ink-1)", border: "2px solid var(--line)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--t-mid)", marginBottom: 16 }}>Quick Stats</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--t-mid)" }}>Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sc.text }}>{progress}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--t-mid)" }}>Tasks Complete</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-hi)' }}>{doneTasks}/{project.tasks.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--t-mid)" }}>Team Size</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-hi)' }}>{project.agents.length} agents</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--t-mid)" }}>Documents</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-hi)' }}>{docs.length} files</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--t-mid)" }}>Blockers</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: project.blockers?.length ? "#ef4444" : "#059669" }}>
                    {project.blockers?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Project Info */}
            <div style={{ background: "var(--ink-1)", border: "2px solid var(--line)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--t-mid)", marginBottom: 16 }}>Project Info</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {project.liveUrl && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--t-mid)" }}>Live URL</span>
                    <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: project.accent, textDecoration: "none" }}>
                      {project.liveUrl.replace(/^https?:\/\//, "").split("/")[0]} ↗
                    </a>
                  </div>
                )}
                {project.repo && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--t-mid)" }}>Repo</span>
                    <a href={`https://github.com/${project.repo}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "var(--t-mid)", textDecoration: "none" }}>
                      {project.repo} ↗
                    </a>
                  </div>
                )}
                {project.repoPath && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--t-mid)" }}>Path</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t-lo)", fontFamily: "monospace" }}>{project.repoPath}</span>
                  </div>
                )}
                {project.stack && project.stack.length > 0 && (
                  <div>
                    <span style={{ fontSize: 13, color: "var(--t-mid)", display: "block", marginBottom: 8 }}>Stack</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {project.stack.map((s) => (
                        <span key={s} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 8, background: `${project.accent}08`, color: project.accent, border: `1px solid ${project.accent}20` }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Documents Quick Access */}
            <div style={{ background: "var(--ink-1)", border: "2px solid var(--line)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--t-mid)", marginBottom: 16 }}>Documents</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map((d) => {
                  const info = DOC_LABELS[d] || { label: d, icon: "◻", desc: "" };
                  return (
                    <button key={d} onClick={() => { setTab("docs"); loadDoc(d); }} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                      background: "var(--ink-1)", border: "1px solid var(--line)", cursor: "pointer",
                      transition: "all 0.2s", textAlign: "left", width: "100%",
                    }}>
                      <span style={{ fontSize: 16, color: project.accent }}>{info.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t-hi)" }}>{info.label}</div>
                        <div style={{ fontSize: 11, color: "var(--t-mid)" }}>{info.desc}</div>
                      </div>
                    </button>
                  );
                })}
                {docs.length === 0 && <div style={{ fontSize: 13, color: "var(--t-mid)" }}>No documents found</div>}
              </div>
            </div>

            {/* Recent Tasks */}
            <div style={{ background: "var(--ink-1)", border: "2px solid var(--line)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--t-mid)", marginBottom: 16 }}>Tasks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {project.tasks.slice(0, 8).map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                      background: t.done ? "rgba(34,197,94,0.08)" : "var(--ink-1)",
                      border: t.done ? "1px solid rgba(34,197,94,0.2)" : "1px solid var(--line)",
                      color: t.done ? "#059669" : "var(--t-mid)", flexShrink: 0,
                    }}>{t.done ? "✓" : ""}</span>
                    <span style={{ color: t.done ? "var(--t-lo)" : "var(--t-hi)", textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.6 : 1, lineHeight: 1.3 }}>{t.t}</span>
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
              <div style={{ background: "var(--ink-1)", border: "2px solid var(--line)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--t-mid)", marginBottom: 16 }}>Quick Link</div>
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
                    background: isActive ? `${project.accent}08` : "var(--ink-1)",
                    border: isActive ? `2px solid ${project.accent}30` : "2px solid var(--line)",
                    cursor: "pointer", transition: "all 0.2s", textAlign: "left", width: "100%",
                  }}>
                    <span style={{ fontSize: 16, color: isActive ? project.accent : "var(--t-mid)" }}>{info.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? "var(--t-hi)" : "var(--t-mid)" }}>{info.label}</div>
                      <div style={{ fontSize: 10, color: "var(--t-lo)" }}>{info.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Doc content viewer */}
            {activeDoc && (
              <div style={{ background: "var(--ink-1)", border: "2px solid var(--line)", borderRadius: 14, padding: 0, overflow: "hidden" }}>
                {/* Doc header */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px",
                  borderBottom: "1px solid var(--line)", background: "var(--ink-1)",
                }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--t-hi)" }}>
                      {DOC_LABELS[activeDoc]?.icon} {DOC_LABELS[activeDoc]?.label || activeDoc}
                    </h3>
                    <span style={{ fontSize: 11, color: "var(--t-lo)" }}>{slug}/{activeDoc}</span>
                  </div>
                  <button onClick={shareDoc} style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    background: copied ? "rgba(34,197,94,0.08)" : "var(--ink-2)",
                    border: copied ? "1px solid rgba(34,197,94,0.2)" : "1px solid var(--line)",
                    color: copied ? "#059669" : "var(--t-mid)", transition: "all 0.2s",
                  }}>
                    {copied ? "✓ Copied!" : "Share Link"}
                  </button>
                </div>

                {/* Doc body */}
                <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
                  {docLoading ? (
                    <div style={{ fontSize: 14, color: "var(--t-mid)", textAlign: "center", padding: 40 }}>Loading...</div>
                  ) : (
                    <pre style={{
                      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                      fontSize: 13, lineHeight: 1.7, color: "var(--t-mid)", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      margin: 0, background: "transparent",
                    }}>
                      {docContent}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {!activeDoc && (
              <div style={{ padding: 60, textAlign: "center", color: "var(--t-mid)", fontSize: 14 }}>
                Select a document to view
              </div>
            )}
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {tab === "tasks" && (() => {
          const pending = project.tasks.filter(t => !t.done);
          const done = project.tasks.filter(t => t.done);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Pending section */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--t-hi)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: project.accent, display: "inline-block" }} />
                  In Progress ({pending.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pending.map((t, i) => (
                    <div key={`p-${i}`} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 10,
                      background: "var(--ink-1)", border: "2px solid var(--line)", transition: "all 0.2s",
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
                        background: "var(--ink-1)", border: `2px solid ${project.accent}40`, color: "var(--t-mid)",
                      }} />
                      <span style={{ fontSize: 14, color: "var(--t-hi)" }}>{t.t}</span>
                    </div>
                  ))}
                  {pending.length === 0 && <div style={{ fontSize: 13, color: "var(--t-mid)", padding: "12px 18px" }}>All tasks complete</div>}
                </div>
              </div>

              {/* Done section */}
              {done.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--t-lo)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
                    Completed ({done.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {done.map((t, i) => (
                      <div key={`d-${i}`} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderRadius: 10,
                        background: "var(--ink-1)", border: "1px solid var(--ink-2)", transition: "all 0.2s",
                      }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
                          background: "rgba(34,197,94,0.08)", border: "2px solid rgba(34,197,94,0.25)", color: "#059669",
                        }}>✓</span>
                        <span style={{ fontSize: 13, color: "var(--t-lo)", textDecoration: "line-through", opacity: 0.7 }}>{t.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </InstrumentPage>
  );
}
