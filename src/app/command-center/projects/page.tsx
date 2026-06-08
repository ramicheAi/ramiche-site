"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { InstrumentPage } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   PROJECT TRACKER — Command Center
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

export default function ProjectTracker() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("");

  const fetchProjects = useCallback(() => {
    // Live merged data: shared-projects metadata + filesystem TASKS.md
    fetch("/api/command-center/projects")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data?.projects) && data.projects.length > 0) {
          setProjects(data.projects);
        }
        setLastSync(new Date().toISOString());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 15000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const sorted = [...projects].sort((a, b) => (a.priority || 99) - (b.priority || 99));
  const filtered = filter === "all" ? sorted : sorted.filter(p => p.status === filter);

  return (
    <InstrumentPage
      id="projects"
      title="Project Tracker"
      section="Workspace"
      icon="projects"
      accent="var(--c-indigo)"
    >
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 16, color: 'var(--t-mid)', marginBottom: 8 }}>
          {loading ? "Loading..." : `${projects.length} projects · ${projects.filter(p => p.status === "active").length} active · ${projects.filter(p => p.status === "blocked").length} blocked`}
        </p>
        {lastSync && (
          <p style={{ fontSize: 11, color: 'var(--t-lo)', marginBottom: 20, fontFamily: 'var(--f-mono)' }}>
            LIVE · Last synced: {new Date(lastSync).toLocaleString()} · Auto-refresh 30s
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {["all", "active", "blocked", "shipped", "planning", "paused"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
              textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
              background: filter === f ? 'var(--accent)' : 'var(--ink-2)',
              color: filter === f ? '#fff' : 'var(--t-mid)',
              border: filter === f ? '1px solid var(--accent)' : '1px solid var(--line)',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--t-mid)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', animation: 'pulse 2s infinite' }}>SYNCING LIVE DATA…</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(project => {
            const sc = STATUS_COLORS[project.status] || STATUS_COLORS.active;
            const progress = getProgress(project);
            const doneTasks = project.tasks.filter(t => t.done).length;

            return (
              <div key={project.slug} onClick={() => router.push(`/command-center/projects/${project.slug}`)}
                style={{
                  background: 'var(--ink-1)', border: '2px solid var(--line)',
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
                          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--t-hi)' }}>{project.name}</h2>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}30`,
                          }}>{project.status}</span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--t-mid)', margin: '2px 0 0' }}>{project.desc}</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 60 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: sc.text }}>{progress}%</div>
                    <div style={{ fontSize: 10, color: 'var(--t-lo)' }}>{doneTasks}/{project.tasks.length}</div>
                  </div>
                </div>

                <div style={{ height: 6, background: 'var(--ink-3)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${project.accent}, ${project.accent}80)`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--t-mid)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>Lead: <span style={{ color: project.accent, fontWeight: 600 }}>{project.lead}</span></span>
                    <span style={{ color: 'var(--t-dim)' }}>|</span>
                    <span>{project.agents?.length || 0} agents</span>
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
    </InstrumentPage>
  );
}
