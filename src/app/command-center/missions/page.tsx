"use client";

import { useState } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   MISSIONS — Focused sub-page of Command Center
   Projects & tasks with progress tracking
   ══════════════════════════════════════════════════════════════════════════════ */

const MISSIONS = [
  {
    name: "METTLE", accent: "#C9A84C", status: "active" as const,
    desc: "Gamified swim training — LIVE BETA — Stripe checkout live", priority: "CRITICAL",
    agents: ["Atlas", "SHURI", "PROXIMON", "MICHAEL", "SELAH", "KIYOSAKI", "TRIAGE"],
    tasks: [
      { t: "Game engine + check-ins", done: true },
      { t: "Coach dashboard + leaderboard", done: true },
      { t: "Three-portal architecture (Coach/Athlete/Parent)", done: true },
      { t: "Multi-roster expansion (240+ athletes, 7 groups)", done: true },
      { t: "Stripe billing — 3 tiers ($149/$349/$549)", done: true },
      { t: "CI/CD pipeline (GitHub Actions + Husky + Vitest)", done: true },
      { t: "Copyright filed (Feb 17, 2026)", done: true },
      { t: "Hy-Tek import (.hy3/.ev3) — iOS fix deployed", done: true },
      { t: "ByteByteGo 52/52 items implemented", done: true },
      { t: "Quest flow UX polish", done: false },
      { t: "Firebase backend (v2) deploy", done: false },
    ],
    link: { label: "Open App", href: "/apex-athlete" },
  },
  {
    name: "Parallax Publish", accent: "#7c3aed", status: "active" as const,
    desc: "Multi-platform social media publishing — 4 platforms live", priority: "HIGH",
    agents: ["Atlas", "SHURI"],
    tasks: [
      { t: "Twitter OAuth + real posting", done: true },
      { t: "Bluesky AT Protocol + real posting", done: true },
      { t: "LinkedIn OAuth + real posting", done: true },
      { t: "Instagram OAuth flow built", done: true },
      { t: "History tab + hashtag suggestions + platform previews", done: true },
      { t: "AI Writer (Gemini-powered)", done: true },
      { t: "Instagram permissions config (Facebook Use Cases)", done: false },
      { t: "Threads / TikTok / YouTube / Facebook integrations", done: false },
      { t: "Scheduling backend (hosted DB)", done: false },
    ],
    link: { label: "Open Publish", href: "https://parallax-publish.vercel.app" },
  },
  {
    name: "Galactik Antics", accent: "#00f0ff", status: "active" as const,
    desc: "AI art merch → Shopify store", priority: "HIGH",
    agents: ["Vee", "SHURI", "INK", "NOVA", "Aetherion"],
    tasks: [
      { t: "Batch A art matched to 5 designs", done: true },
      { t: "Source files copied to iPhone case folders", done: true },
      { t: "Pre-launch content (4 briefs, 7-day calendar)", done: true },
      { t: "Product lineup confirmed (13 cases, 5 posters, 5 tees)", done: true },
      { t: "10 architecture docs delivered", done: true },
      { t: "Weavy renders for 5 Batch A designs", done: false },
      { t: "Shopify store created — API token needed", done: false },
      { t: "Upload products + variants + pricing", done: false },
      { t: "Collector tier system (5 tiers, Shopify Flows)", done: false },
    ],
    link: { label: "Printful", href: "https://www.printful.com/dashboard" },
  },
  {
    name: "ClawGuard Pro", accent: "#ef4444", status: "active" as const,
    desc: "Security scanner — LIVE — $299/$799/$1499", priority: "HIGH",
    agents: ["Widow", "Atlas"],
    tasks: [
      { t: "12-domain security scanner", done: true },
      { t: "Product page + Stripe checkout (3 tiers)", done: true },
      { t: "GitHub repo public", done: true },
      { t: "CSP headers + API rate limiting + Firestore rules", done: true },
      { t: "Demo flow for sales", done: false },
    ],
    link: { label: "ClawGuard", href: "/clawguard" },
  },
  {
    name: "Parallax Studio", accent: "#a855f7", status: "active" as const,
    desc: "Creative Services — 48h Sprint $300-500", priority: "MED",
    agents: ["Vee", "MERCURY"],
    tasks: [
      { t: "Landing page live", done: true },
      { t: "Portfolio + case studies", done: false },
      { t: "Social proof / testimonials", done: false },
      { t: "Stripe integration", done: false },
    ],
    link: { label: "Studio", href: "/studio" },
  },
  {
    name: "Parallax", accent: "#e879f9", status: "active" as const,
    desc: "Parent company — agents + skills marketplace", priority: "MED",
    agents: ["Atlas", "Aetherion"],
    tasks: [
      { t: "9-page site live on Vercel", done: true },
      { t: "Agent marketplace + Claude Skills ($149-499)", done: true },
      { t: "White-label system (115 files, 20 agents, 7 bundles)", done: true },
      { t: "Artist roster page", done: false },
      { t: "Distribution pipeline", done: false },
    ],
    link: { label: "Site", href: "/" },
  },
  {
    name: "SCOWW", accent: "#22d3ee", status: "active" as const,
    desc: "Swim meet — sponsors locked, Meta ad live", priority: "HIGH",
    agents: ["MICHAEL", "Vee"],
    tasks: [
      { t: "Sponsor packages locked", done: true },
      { t: "Meta ad campaign live", done: true },
      { t: "Event logistics finalized", done: false },
      { t: "Registration page", done: false },
    ],
    link: null,
  },
  {
    name: "Music Pipeline", accent: "#f59e0b", status: "paused" as const,
    desc: "Track production & release automation", priority: "LOW",
    agents: ["TheMAESTRO"],
    tasks: [
      { t: "music.json system of record", done: true },
      { t: "Status dashboard", done: true },
      { t: "Stalled-track detection", done: false },
      { t: "Momentum reports", done: false },
    ],
    link: null,
  },
];

/* ── NAV ── */
const NAV = [
  { label: "COMMAND", href: "/command-center" },
  { label: "COMMAND", href: "/command-center" },
  { label: "AGENTS", href: "/command-center/agents" },
  { label: "MISSIONS", href: "/command-center/missions", active: true },
  { label: "METTLE", href: "/apex-athlete" },
];

export default function MissionsPage() {
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");

  const filtered = filter === "all" ? MISSIONS : MISSIONS.filter(m => m.status === filter);
  const totalTasks = MISSIONS.reduce((s, m) => s + m.tasks.length, 0);
  const doneTasks = MISSIONS.reduce((s, m) => s + m.tasks.filter(t => t.done).length, 0);
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <main className="min-h-screen w-full" style={{ background: '#ffffff', color: '#0f172a', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Subtle background */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px', opacity: 0.4,
      }} />

      {/* Nav */}
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
              <Link key={n.href} href={n.href} style={{
                fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
                color: n.active ? '#1a1a5e' : '#64748b', transition: 'color 0.2s',
              }}>{n.label}</Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="relative z-10 w-full" style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 48px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 12, color: '#64748b', marginBottom: 8, display: 'inline-block' }}>← Back to Command Center</Link>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 8 }}>
            Active <span style={{ background: 'linear-gradient(135deg, #7c3aed, #1a1a5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Missions</span>
          </h1>
          <p style={{ fontSize: 16, color: '#475569', marginBottom: 24 }}>
            {MISSIONS.filter(m => m.status === 'active').length} active missions · {doneTasks}/{totalTasks} tasks complete ({overallPct}%)
          </p>

          {/* Overall progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${overallPct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #1a1a5e, #7c3aed)', transition: 'width 1s' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a5e', fontFamily: 'monospace' }}>{overallPct}%</span>
          </div>

          {/* Filters */}
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

        {/* Mission Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {filtered.map(m => {
            const done = m.tasks.filter(t => t.done).length;
            const total = m.tasks.length;
            const mpct = Math.round((done / total) * 100);
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
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{m.name}</h3>
                        {m.priority === "CRITICAL" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', letterSpacing: '0.1em' }}>CRITICAL</span>
                        )}
                        {m.priority === "HIGH" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: m.accent, background: `${m.accent}10`, border: `1px solid ${m.accent}25`, letterSpacing: '0.1em' }}>HIGH</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>{m.desc}</p>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 10px', borderRadius: 6, color: m.status === 'active' ? '#059669' : '#94a3b8', background: m.status === 'active' ? '#ecfdf5' : '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.status}</span>
                  </div>

                  {/* Progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${mpct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${m.accent}80, ${m.accent})`, transition: 'width 0.7s' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: m.accent }}>{done}/{total}</span>
                  </div>

                  {/* Agents */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: isExpanded ? 16 : 0 }}>
                    {m.agents.map(a => (
                      <span key={a} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, color: '#475569', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>{a}</span>
                    ))}
                  </div>

                  {/* Expanded task list */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
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
