"use client";

import { useState } from "react";
import Link from "next/link";
import { PROJECTS, getProgress } from "../shared-projects";

/* ══════════════════════════════════════════════════════════════════════════════
   MISSIONS — Focused sub-page of Command Center
   Projects & tasks with progress tracking
   ══════════════════════════════════════════════════════════════════════════════ */

const NAV = [
  { label: "COMMAND", href: "/command-center" },
  { label: "AGENTS", href: "/command-center/agents" },
  { label: "MISSIONS", href: "/command-center/missions", active: true },
  { label: "PROJECTS", href: "/command-center/projects" },
  { label: "METTLE", href: "/apex-athlete" },
];

export default function MissionsPage() {
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");

  const missions = filter === "all" ? PROJECTS : PROJECTS.filter(m => m.status === filter);
  const totalTasks = PROJECTS.reduce((s, m) => s + m.tasks.length, 0);
  const doneTasks = PROJECTS.reduce((s, m) => s + m.tasks.filter(t => t.done).length, 0);
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <main className="min-h-screen w-full" style={{ background: '#ffffff', color: '#0f172a', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
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
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: '#64748b' }}>MISSIONS</span>
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
            Active <span style={{ background: 'linear-gradient(135deg, #7c3aed, #1a1a5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Missions</span>
          </h1>
          <p style={{ fontSize: 16, color: '#475569', marginBottom: 24 }}>
            {PROJECTS.filter(m => m.status === 'active').length} active missions · {doneTasks}/{totalTasks} tasks complete ({overallPct}%)
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${overallPct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #1a1a5e, #7c3aed)', transition: 'width 1s' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a5e', fontFamily: 'monospace' }}>{overallPct}%</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {(["all", "active", "paused"] as const).map(f => (
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {missions.map(m => {
            const done = m.tasks.filter(t => t.done).length;
            const total = m.tasks.length;
            const mpct = getProgress(m);
            const isExpanded = expandedMission === m.name;

            return (
              <div key={m.name} onClick={() => setExpandedMission(isExpanded ? null : m.name)}
                style={{
                  background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.08)',
                  borderLeft: `4px solid ${m.accent}`, borderRadius: 16,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer',
                  opacity: m.status === 'paused' ? 0.5 : 1, transition: 'all 0.3s',
                }}>
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{m.name}</h3>
                        {m.priorityLabel === "CRITICAL" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', letterSpacing: '0.1em' }}>CRITICAL</span>
                        )}
                        {m.priorityLabel === "HIGH" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: m.accent, background: `${m.accent}10`, border: `1px solid ${m.accent}25`, letterSpacing: '0.1em' }}>HIGH</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>{m.desc}</p>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 10px', borderRadius: 6, color: m.status === 'active' ? '#059669' : '#94a3b8', background: m.status === 'active' ? '#ecfdf5' : '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.status}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${mpct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${m.accent}80, ${m.accent})`, transition: 'width 0.7s' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: m.accent }}>{done}/{total}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: isExpanded ? 16 : 0 }}>
                    {m.agents.map(a => (
                      <span key={a} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, color: '#475569', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>{a}</span>
                    ))}
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
                      {m.blockers && m.blockers.length > 0 && (
                        <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {m.blockers.map((b, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>{b}</span>
                          ))}
                        </div>
                      )}
                      {m.tasks.map(t => (
                        <div key={t.t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, flexShrink: 0,
                            background: t.done ? `${m.accent}15` : 'transparent',
                            color: t.done ? m.accent : 'transparent',
                            border: t.done ? 'none' : '1px solid rgba(0,0,0,0.1)',
                          }}>
                            {t.done ? "✓" : ""}
                          </div>
                          <span style={{ fontSize: 13, fontFamily: 'monospace', color: t.done ? '#94a3b8' : '#334155', textDecoration: t.done ? 'line-through' : 'none' }}>{t.t}</span>
                        </div>
                      ))}
                      {m.link && (
                        <div style={{ marginTop: 12 }}>
                          <Link href={m.link.href} onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: m.accent, background: `${m.accent}10`, border: `1px solid ${m.accent}25`, transition: 'all 0.2s' }}>
                            {m.link.label} →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
