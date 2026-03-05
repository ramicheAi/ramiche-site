"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   PROJECT TRACKER — Command Center
   Progress bars, status, ownership for every major project.
   ══════════════════════════════════════════════════════════════════════════════ */

interface Project {
  name: string;
  slug: string;
  status: "active" | "blocked" | "shipped" | "planning";
  progress: number;
  lead: string;
  leadColor: string;
  blockers?: string[];
  milestones: { label: string; done: boolean }[];
  description: string;
  priority: number;
}

const PROJECTS: Project[] = [
  {
    name: "METTLE",
    slug: "mettle",
    status: "active",
    progress: 85,
    lead: "Atlas",
    leadColor: "#C9A84C",
    description: "Gamified athlete SaaS — ARM (Coach/Athlete/Parent portals)",
    priority: 1,
    blockers: ["STRIPE_SECRET_KEY for live payments"],
    milestones: [
      { label: "Firebase + Firestore", done: true },
      { label: "Level system (6 tiers)", done: true },
      { label: "Meet management (Hy-Tek)", done: true },
      { label: "Invite system + CSV import", done: true },
      { label: "ByteByteGo 52/52", done: true },
      { label: "Brand v5 Forged M", done: true },
      { label: "CI/CD + security scanning", done: true },
      { label: "Beta launch (Saint Andrew's)", done: false },
      { label: "Stripe live payments", done: false },
      { label: "Patent filing (USPTO)", done: false },
    ],
  },
  {
    name: "Parallax Publish",
    slug: "parallax-publish",
    status: "active",
    progress: 55,
    lead: "Shuri",
    leadColor: "#34d399",
    description: "Social media publishing platform — competitor to Upload-Post",
    priority: 2,
    blockers: ["Instagram blocked on Facebook Developer Portal"],
    milestones: [
      { label: "Twitter OAuth2", done: true },
      { label: "Bluesky AT Protocol", done: true },
      { label: "LinkedIn OAuth2", done: true },
      { label: "6-tab UI (Compose, History, Calendar, Accounts, Analytics, AI Writer)", done: true },
      { label: "Instagram integration", done: false },
      { label: "Scheduling backend", done: false },
      { label: "Facebook/Threads/TikTok/YouTube", done: false },
      { label: "Real analytics", done: false },
    ],
  },
  {
    name: "Parallax Site",
    slug: "parallax-site",
    status: "shipped",
    progress: 90,
    lead: "Atlas",
    leadColor: "#C9A84C",
    description: "Agent marketplace + Claude Skills + Setup Service",
    priority: 3,
    milestones: [
      { label: "19 routes live", done: true },
      { label: "White-label system (115 files)", done: true },
      { label: "Agent marketplace", done: true },
      { label: "/forge creative tools", done: true },
      { label: "/publish landing", done: true },
      { label: "Stripe e2e on /agents", done: true },
      { label: "Command Center v4", done: true },
      { label: "All routes fully functional", done: false },
    ],
  },
  {
    name: "Ramiche Studio",
    slug: "ramiche-studio",
    status: "blocked",
    progress: 70,
    lead: "Mercury",
    leadColor: "#f97316",
    description: "Creative services — Sprint $400 / Starter $1,500 / Pro $3,000 / Elite $6,000+",
    priority: 4,
    blockers: ["STRIPE_SECRET_KEY", "Gmail env vars", "First UGC video", "First 5 warm DMs"],
    milestones: [
      { label: "Landing page", done: true },
      { label: "Inquiry form + checkout", done: true },
      { label: "4-platform DM scripts", done: true },
      { label: "Email sequences", done: true },
      { label: "SOPs + onboarding runbook", done: true },
      { label: "Stripe payments live", done: false },
      { label: "First client signed", done: false },
    ],
  },
  {
    name: "ClawGuard Pro",
    slug: "clawguard",
    status: "shipped",
    progress: 95,
    lead: "Widow",
    leadColor: "#ef4444",
    description: "Security scanner — 12-domain, $299/$799/$1499",
    priority: 5,
    milestones: [
      { label: "12-domain scanning", done: true },
      { label: "Stripe pricing tiers", done: true },
      { label: "GitHub repo", done: true },
      { label: "Live deployment", done: true },
      { label: "Marketing + launch push", done: false },
    ],
  },
  {
    name: "Galactik Antics",
    slug: "galactik-antics",
    status: "planning",
    progress: 15,
    lead: "Aetherion",
    leadColor: "#a855f7",
    description: "AI art + merch (Shopify+Printful, phone cases first)",
    priority: 6,
    blockers: ["Shopify API credentials", "GA art assets", "Timeline", "Kickstarter date"],
    milestones: [
      { label: "Phase 1 architecture (10 docs)", done: true },
      { label: "30+ tasks across 7 tracks", done: true },
      { label: "Shopify store setup", done: false },
      { label: "Printful integration", done: false },
      { label: "Art asset pipeline", done: false },
      { label: "Launch", done: false },
    ],
  },
  {
    name: "Command Center",
    slug: "command-center",
    status: "active",
    progress: 60,
    lead: "Atlas",
    leadColor: "#C9A84C",
    description: "Mission Control dashboard — holographic ops hub",
    priority: 7,
    milestones: [
      { label: "Main dashboard (agents, revenue, vitals)", done: true },
      { label: "3D Hangar workspace", done: true },
      { label: "Task Board (Kanban)", done: true },
      { label: "Calendar (Cron viz)", done: true },
      { label: "Project Tracker", done: true },
      { label: "Memory Browser", done: false },
      { label: "Doc Viewer", done: false },
      { label: "2D Pixel Office", done: false },
    ],
  },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "rgba(34,197,94,0.12)", text: "#22c55e", border: "#22c55e" },
  blocked: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", border: "#ef4444" },
  shipped: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", border: "#3b82f6" },
  planning: { bg: "rgba(168,85,247,0.12)", text: "#a855f7", border: "#a855f7" },
};

export default function ProjectTracker() {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [liveProjects, setLiveProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/bridge?type=projects");
        if (!res.ok) return;
        const data = await res.json();
        const arr = data?.projects || data?.items;
        if (Array.isArray(arr) && arr.length > 0) {
          setLiveProjects(arr);
        }
      } catch {}
    };
    fetchProjects();
    const iv = setInterval(fetchProjects, 60000);
    return () => clearInterval(iv);
  }, []);

  const projects = liveProjects || PROJECTS;
  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Link href="/command-center" style={{ color: "#64748b", fontSize: 13, textDecoration: "none" }}>
            Command Center
          </Link>
          <span style={{ color: "#334155" }}>/</span>
          <span style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600 }}>Projects</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          PROJECT TRACKER
        </h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>
          {projects.length} projects &middot; {projects.filter((p) => p.status === "active").length} active &middot; {projects.filter((p) => p.status === "blocked").length} blocked
        </p>
      </div>

      {/* Filters */}
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, overflowX: "auto" }}>
        {["all", "active", "blocked", "shipped", "planning"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              border: filter === f ? "1px solid rgba(201,168,76,0.5)" : "1px solid rgba(255,255,255,0.1)",
              background: filter === f ? "rgba(201,168,76,0.15)" : "transparent",
              color: filter === f ? "#C9A84C" : "#64748b",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Project Cards */}
      <div style={{ padding: "8px 20px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.sort((a, b) => a.priority - b.priority).map((project) => {
          const sc = STATUS_COLORS[project.status];
          const isExpanded = expanded === project.slug;
          const doneMilestones = project.milestones.filter((m) => m.done).length;

          return (
            <div
              key={project.slug}
              onClick={() => setExpanded(isExpanded ? null : project.slug)}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `2px solid ${isExpanded ? sc.border + "40" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 14,
                padding: 20,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {/* Top row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>#{project.priority}</span>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{project.name}</h2>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: sc.bg,
                        color: sc.text,
                        border: `1px solid ${sc.border}30`,
                      }}
                    >
                      {project.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{project.description}</p>
                </div>
                <div style={{ textAlign: "right", minWidth: 60 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: sc.text }}>{project.progress}%</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${project.progress}%`,
                    background: `linear-gradient(90deg, ${sc.text}, ${sc.text}80)`,
                    borderRadius: 3,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>

              {/* Lead + milestones count */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                <span>
                  Lead: <span style={{ color: project.leadColor, fontWeight: 600 }}>{project.lead}</span>
                </span>
                <span>{doneMilestones}/{project.milestones.length} milestones</span>
              </div>

              {/* Blockers */}
              {project.blockers && project.blockers.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {project.blockers.map((b, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 8,
                        background: "rgba(239,68,68,0.1)",
                        color: "#ef4444",
                        border: "1px solid rgba(239,68,68,0.2)",
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded milestones */}
              {isExpanded && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", margin: "0 0 10px" }}>
                    Milestones
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {project.milestones.map((m, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            background: m.done ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                            border: m.done ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.1)",
                            color: m.done ? "#22c55e" : "#475569",
                          }}
                        >
                          {m.done ? "\u2713" : ""}
                        </span>
                        <span style={{ color: m.done ? "#94a3b8" : "#e2e8f0", textDecoration: m.done ? "line-through" : "none", opacity: m.done ? 0.6 : 1 }}>
                          {m.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
