"use client";

import { useState } from "react";
import Link from "next/link";
import { PROJECTS, getProgress } from "../shared-projects";

/* ══════════════════════════════════════════════════════════════════════════════
   PROJECT TRACKER — Command Center
   Progress bars, status, ownership for every major project.
   Uses shared data source — same data as Missions page.
   ══════════════════════════════════════════════════════════════════════════════ */

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "rgba(34,197,94,0.08)", text: "#059669", border: "#059669" },
  blocked: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "#ef4444" },
  shipped: { bg: "rgba(59,130,246,0.08)", text: "#3b82f6", border: "#3b82f6" },
  planning: { bg: "rgba(168,85,247,0.08)", text: "#a855f7", border: "#a855f7" },
  paused: { bg: "rgba(100,116,139,0.08)", text: "#94a3b8", border: "#94a3b8" },
};

const NAV = [
  { label: "COMMAND", href: "/command-center" },
  { label: "AGENTS", href: "/command-center/agents" },
  { label: "MISSIONS", href: "/command-center/missions" },
  { label: "PROJECTS", href: "/command-center/projects", active: true },
  { label: "METTLE", href: "/apex-athlete" },
];

export default function ProjectTracker() {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = [...PROJECTS].sort((a, b) => a.priority - b.priority);
  const filtered = filter === "all" ? sorted : sorted.filter(p => p.status === filter);

  return (
    <main className="min-h-screen w-full" style={{ background: "#ffffff", color: "#0f172a", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px', opacity: 0.4,
      }} />

      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/parallax-logo.jpg" alt="Parallax" style={{ width: 36, height: 44, objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '0.1em', color: '#1a1a5e' }}>PARALLAX</span>
            <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: 14 }}>|</span>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: '#64748b' }}>PROJECTS</span>
          </Link>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {NAV.map(n => (
              <Link key={n.label + n.href} href={n.href} style={{
                fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
                color: n.active ? '#1a1a5e' : '#64748b', transition: 'color 0.2s',
              }}>{n.label}</Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="relative z-10 w-full" style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 48px' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 12, color: '#64748b', marginBottom: 8, display: 'inline-block' }}>← Back to Command Center</Link>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 8 }}>
            Project <span style={{ background: 'linear-gradient(135deg, #7c3aed, #1a1a5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tracker</span>
          </h1>
          <p style={{ fontSize: 16, color: '#475569', marginBottom: 24 }}>
            {PROJECTS.length} projects · {PROJECTS.filter(p => p.status === "active").length} active · {PROJECTS.filter(p => p.status === "blocked").length} blocked
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {["all", "active", "blocked", "shipped", "planning", "paused"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
                background: filter === f ? '#1a1a5e' : 'rgba(0,0,0,0.04)',
                color: filter === f ? '#fff' : '#64748b',
                border: filter === f ? '1px solid #1a1a5e' : '1px solid rgba(0,0,0,0.08)',
              }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(project => {
            const sc = STATUS_COLORS[project.status] || STATUS_COLORS.active;
            const isExpanded = expanded === project.slug;
            const progress = getProgress(project);
            const doneTasks = project.tasks.filter(t => t.done).length;

            return (
              <div key={project.slug} onClick={() => setExpanded(isExpanded ? null : project.slug)}
                style={{
                  background: 'rgba(255,255,255,0.95)', border: `2px solid ${isExpanded ? sc.border + "40" : "rgba(0,0,0,0.06)"}`,
                  borderRadius: 14, padding: 20, cursor: 'pointer', transition: 'all 0.2s ease',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>#{project.priority}</span>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>{project.name}</h2>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}30`,
                      }}>{project.status}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{project.desc}</p>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 60 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: sc.text }}>{progress}%</div>
                  </div>
                </div>

                <div style={{ height: 6, background: 'rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${sc.text}, ${sc.text}80)`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                  <span>Lead: <span style={{ color: project.accent, fontWeight: 600 }}>{project.lead}</span></span>
                  <span>{doneTasks}/{project.tasks.length} tasks</span>
                </div>

                {project.blockers && project.blockers.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {project.blockers.map((b, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>{b}</span>
                    ))}
                  </div>
                )}

                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', margin: '0 0 10px' }}>Tasks</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {project.tasks.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                          <span style={{
                            width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                            background: t.done ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.02)',
                            border: t.done ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(0,0,0,0.08)',
                            color: t.done ? '#059669' : '#94a3b8',
                          }}>{t.done ? "✓" : ""}</span>
                          <span style={{ color: t.done ? '#94a3b8' : '#334155', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>{t.t}</span>
                        </div>
                      ))}
                    </div>
                    {project.link && (
                      <div style={{ marginTop: 12 }}>
                        <Link href={project.link.href} onClick={e => e.stopPropagation()}
                          style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: project.accent, background: `${project.accent}10`, border: `1px solid ${project.accent}25`, transition: 'all 0.2s' }}>
                          {project.link.label} →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
