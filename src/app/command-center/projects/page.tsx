"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");

  const sorted = [...PROJECTS].sort((a, b) => a.priority - b.priority);
  const filtered = filter === "all" ? sorted : sorted.filter(p => p.status === filter);

  return (
    <main className="min-h-screen w-full" style={{ background: "#0a0a14", color: "#e2e8f0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px', opacity: 0.4,
      }} />

      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/parallax-logo.jpg" alt="Parallax" style={{ width: 36, height: 44, objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '0.1em', color: '#c4b5fd' }}>PARALLAX</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>|</span>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: '#94a3b8' }}>PROJECTS</span>
          </Link>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {NAV.map(n => (
              <Link key={n.label + n.href} href={n.href} style={{
                fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
                color: n.active ? '#c4b5fd' : '#94a3b8', transition: 'color 0.2s',
              }}>{n.label}</Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="relative z-10 w-full" style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 48px' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, display: 'inline-block' }}>← Back to Command Center</Link>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 8 }}>
            Project <span style={{ background: 'linear-gradient(135deg, #c4b5fd, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tracker</span>
          </h1>
          <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 24 }}>
            {PROJECTS.length} projects · {PROJECTS.filter(p => p.status === "active").length} active · {PROJECTS.filter(p => p.status === "blocked").length} blocked
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {["all", "active", "blocked", "shipped", "planning", "paused"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
                background: filter === f ? '#7c3aed' : 'rgba(255,255,255,0.04)',
                color: filter === f ? '#fff' : '#94a3b8',
                border: filter === f ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.08)',
              }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(project => {
            const sc = STATUS_COLORS[project.status] || STATUS_COLORS.active;
            const progress = getProgress(project);
            const doneTasks = project.tasks.filter(t => t.done).length;

            return (
              <div key={project.slug} onClick={() => router.push(`/command-center/projects/${project.slug}`)}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: 20, cursor: 'pointer', transition: 'all 0.2s ease',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${project.accent}12`, border: `2px solid ${project.accent}25`, fontSize: 15, fontWeight: 800, color: project.accent, flexShrink: 0,
                      }}>{project.name.charAt(0)}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#e2e8f0' }}>{project.name}</h2>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}30`,
                          }}>{project.status}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>{project.desc}</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 60 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: sc.text }}>{progress}%</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{doneTasks}/{project.tasks.length}</div>
                  </div>
                </div>

                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${project.accent}, ${project.accent}80)`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>Lead: <span style={{ color: project.accent, fontWeight: 600 }}>{project.lead}</span></span>
                    <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                    <span>{project.agents.length} agents</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: project.accent, letterSpacing: '0.05em' }}>OPEN HQ →</span>
                </div>

                {project.blockers && project.blockers.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {project.blockers.map((b, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>{b}</span>
                    ))}
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
