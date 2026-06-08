"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   MISSIONS — Focused sub-page of Command Center
   Projects & tasks with progress tracking — NOW LIVE from bridge API
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

function getProgress(p: Project): number {
  if (p.tasks.length === 0) return 0;
  return Math.round((p.tasks.filter(t => t.done).length / p.tasks.length) * 100);
}

export default function MissionsPage() {
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(() => {
    fetch("/api/bridge?type=projects")
      .then(r => r.json())
      .then(data => {
        const list = data?.projects;
        if (Array.isArray(list) && list.length > 0) {
          setProjects(list);
        } else {
          return fetch("/api/command-center/projects").then(r => r.json()).then(fb => {
            if (fb.projects) setProjects(fb.projects);
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const sorted = [...projects].sort((a, b) => (a.priority || 99) - (b.priority || 99));
  const missions = filter === "all" ? sorted : sorted.filter(m => m.status === filter);
  const totalTasks = sorted.reduce((s, m) => s + m.tasks.length, 0);
  const doneTasks = sorted.reduce((s, m) => s + m.tasks.filter(t => t.done).length, 0);
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <InstrumentPage
      id="missions"
      title="Missions"
      section="Operations"
      icon="bolt"
      accent="var(--c-amber)"
      actions={
        <span style={{ fontSize: 13, color: 'var(--t-mid)' }} className="mono">
          {sorted.filter(m => m.status === 'active').length} active · {doneTasks}/{totalTasks} ({overallPct}%)
        </span>
      }
    >
        <Panel title="Mission Progress" icon="bolt">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${overallPct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--c-violet), var(--accent))', transition: 'width 1s' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--f-mono)' }}>{overallPct}%</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {(["all", "active", "paused"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 16px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
                background: filter === f ? 'var(--accent)' : 'var(--ink-2)',
                color: filter === f ? 'var(--ink-0)' : 'var(--t-mid)',
                border: filter === f ? '1px solid var(--accent)' : '1px solid var(--line)',
              }}>{f}</button>
            ))}
          </div>
        </Panel>

        <div style={{ height: 20 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {missions.map(m => {
            const done = m.tasks.filter(t => t.done).length;
            const total = m.tasks.length;
            const mpct = getProgress(m);
            const isExpanded = expandedMission === m.name;

            return (
              <div key={m.name} onClick={() => setExpandedMission(isExpanded ? null : m.name)}
                style={{
                  background: 'var(--ink-1)', border: '1px solid var(--line)',
                  borderLeft: `4px solid ${m.accent}`, borderRadius: 'var(--r-lg)',
                  cursor: 'pointer',
                  opacity: m.status === 'paused' ? 0.5 : 1, transition: 'all 0.3s',
                }}>
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t-hi)' }}>{m.name}</h3>
                        {m.priorityLabel === "CRITICAL" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: 'var(--c-red)', background: 'color-mix(in srgb, var(--c-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--c-red) 15%, transparent)', letterSpacing: '0.1em' }}>CRITICAL</span>
                        )}
                        {m.priorityLabel === "HIGH" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: m.accent, background: `color-mix(in srgb, ${m.accent} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${m.accent} 25%, transparent)`, letterSpacing: '0.1em' }}>HIGH</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--t-mid)', fontFamily: 'var(--f-mono)' }}>{m.desc}</p>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 10px', borderRadius: 6, color: m.status === 'active' ? 'var(--c-green)' : 'var(--t-mid)', background: m.status === 'active' ? 'color-mix(in srgb, var(--c-green) 15%, transparent)' : 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.status}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--ink-2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${mpct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, color-mix(in srgb, ${m.accent} 50%, transparent), ${m.accent})`, transition: 'width 0.7s' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--f-mono)', color: m.accent }}>{done}/{total}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: isExpanded ? 16 : 0 }}>
                    {m.agents.map(a => (
                      <span key={a} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, color: 'var(--t-mid)', background: 'var(--ink-2)', border: '1px solid var(--line)' }}>{a}</span>
                    ))}
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                      {m.blockers && m.blockers.length > 0 && (
                        <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {m.blockers.map((b, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'color-mix(in srgb, var(--c-red) 8%, transparent)', color: 'var(--c-red)', border: '1px solid color-mix(in srgb, var(--c-red) 15%, transparent)' }}>{b}</span>
                          ))}
                        </div>
                      )}
                      {m.tasks.map(t => (
                        <div key={t.t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, flexShrink: 0,
                            background: t.done ? `color-mix(in srgb, ${m.accent} 15%, transparent)` : 'transparent',
                            color: t.done ? m.accent : 'transparent',
                            border: t.done ? 'none' : '1px solid var(--line-2)',
                          }}>
                            {t.done ? "✓" : ""}
                          </div>
                          <span style={{ fontSize: 13, fontFamily: 'var(--f-mono)', color: t.done ? 'var(--t-mid)' : 'var(--t-hi)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.t}</span>
                        </div>
                      ))}
                      {m.link && (
                        <div style={{ marginTop: 12 }}>
                          <Link href={m.link.href} onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: m.accent, background: `color-mix(in srgb, ${m.accent} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${m.accent} 25%, transparent)`, transition: 'all 0.2s' }}>
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
    </InstrumentPage>
  );
}
