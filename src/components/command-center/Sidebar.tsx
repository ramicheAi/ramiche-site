'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo, Icon } from '@/components/command-center/po/Brand';

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER SIDEBAR — Parallax OS holographic accordion
   244px rail · single-open accordion · collapses to icon rail ≤1024px (po-mobile.css).
   Uses the ported `.po-side*` / `.po-nav*` classes from po-ui.css.
   The `sections` array below is the source of truth for routing — keep it verbatim.
   ══════════════════════════════════════════════════════════════════════════════ */

const sections = [
  {
    label: 'OPERATIONS',
    items: [
      { href: '/command-center', label: 'Dashboard', icon: '◇', accent: '#C9A84C' },
      { href: '/command-center/jobs', label: 'Jobs', icon: '⚡', accent: '#7c3aed' },
      { href: '/command-center/chat', label: 'Chat', icon: '◈', accent: '#7c3aed' },
      { href: '/command-center/gallery', label: 'Gallery', icon: '▦', accent: '#ec4899' },
      { href: '/command-center/agents', label: 'Agents', icon: '✦', accent: '#34d399' },
      { href: '/command-center/tasks', label: 'Tasks', icon: '▣', accent: '#f59e0b' },
      { href: '/command-center/health', label: 'System Health', icon: '◉', accent: '#22d3ee' },
      { href: '/command-center/security', label: 'Security', icon: '◆', accent: '#ef4444' },
      { href: '/command-center/settings', label: 'Settings', icon: '⚙', accent: '#888888' },
      { href: '/command-center/yolo', label: 'YOLO Builds', icon: '⚡', accent: '#f59e0b' },
      { href: '/command-center/nerve-center', label: 'Nerve Center', icon: '⚛', accent: '#7c3aed' },
      { href: '/command-center/comms', label: 'Comms', icon: '✉', accent: '#34d399' },
    ],
  },
  {
    label: 'BUSINESS',
    items: [
      { href: '/command-center/finance', label: 'Finance HQ', icon: '◈', accent: '#fcd34d' },
      { href: '/command-center/finance/arbitrage', label: 'Arbitrage Calc', icon: '△', accent: '#fcd34d' },
      { href: '/command-center/sales', label: 'Sales', icon: '◉', accent: '#f59e0b' },
      { href: '/command-center/prospector', label: 'Prospector', icon: '🌐', accent: '#22c55e' },
      { href: '/command-center/leads', label: 'Leads', icon: '◎', accent: '#22c55e' },
      { href: '/command-center/funnel', label: 'Funnel', icon: '▼', accent: '#22d3ee' },
      { href: '/command-center/sales/proposals', label: 'METTLE Proposal', icon: '▷', accent: '#f59e0b' },
      { href: '/command-center/sales/pricing', label: 'Pricing', icon: '◎', accent: '#f59e0b' },
      { href: '/command-center/sales/agent-pricing', label: 'Agent Pricing', icon: '◇', accent: '#f59e0b' },
      { href: '/command-center/legal', label: 'Legal', icon: '⚖', accent: '#8b5cf6' },
      { href: '/command-center/strategy', label: 'Strategy', icon: '◇', accent: '#a855f7' },
      { href: '/command-center/observatory', label: 'Observatory', icon: '🔮', accent: '#9b5de5' },
      { href: '/command-center/observatory/live', label: 'Observatory Live', icon: '📡', accent: '#C9A84C' },
      { href: '/command-center/reports', label: 'Reports', icon: '▤', accent: '#f59e0b' },
    ],
  },
  {
    label: 'CREATIVE',
    items: [
      { href: '/command-center/content', label: 'Content', icon: '✒', accent: '#c084fc' },
      { href: '/command-center/studio', label: 'Studio', icon: '♫', accent: '#f59e0b' },
      { href: '/command-center/app-builder', label: 'App Builder', icon: '▣', accent: '#00f0ff' },
      { href: '/command-center/builder', label: 'Builder', icon: '⚒', accent: '#00f0ff' },
    ],
  },
  {
    label: 'SPECIALIST',
    items: [
      { href: '/command-center/wellness', label: 'Wellness', icon: '◈', accent: '#10b981' },
      { href: '/command-center/fabrication', label: 'Fabrication', icon: '⚡', accent: '#14b8a6' },
    ],
  },
  {
    label: 'WORKSPACE',
    items: [
      { href: '/command-center/projects', label: 'Projects', icon: '◉', accent: '#818cf8' },
      { href: '/command-center/memory', label: 'Memory', icon: '◎', accent: '#a855f7' },
      { href: '/command-center/calendar', label: 'Calendar', icon: '○', accent: '#38bdf8' },
      { href: '/command-center/docs', label: 'Docs', icon: '≡', accent: '#666666' },
      { href: '/command-center/office', label: 'Office', icon: '▣', accent: '#06b6d4' },
      { href: '/apex-athlete', label: 'METTLE', icon: '✦', accent: '#C9A84C' },
    ],
  },
];

/* href → Parallax OS geometric icon name (from Brand's `I` map). The legacy
   `item.icon` unicode glyphs are kept on the data above for compatibility; this
   table is the visual upgrade. Unknown hrefs fall back to a sensible default. */
const ICON_BY_HREF: Record<string, string> = {
  '/command-center': 'dashboard',
  '/command-center/jobs': 'bolt',
  '/command-center/chat': 'comms',
  '/command-center/gallery': 'gallery',
  '/command-center/agents': 'agents',
  '/command-center/tasks': 'tasks',
  '/command-center/health': 'health',
  '/command-center/security': 'security',
  '/command-center/settings': 'settings',
  '/command-center/yolo': 'bolt',
  '/command-center/nerve-center': 'nerve',
  '/command-center/comms': 'comms',
  '/command-center/finance': 'finance',
  '/command-center/finance/arbitrage': 'arbitrage',
  '/command-center/sales': 'sales',
  '/command-center/prospector': 'nexus',
  '/command-center/leads': 'strategy',
  '/command-center/sales/proposals': 'proposals',
  '/command-center/sales/pricing': 'finance',
  '/command-center/sales/agent-pricing': 'finance',
  '/command-center/legal': 'legal',
  '/command-center/strategy': 'strategy',
  '/command-center/observatory': 'observatory',
  '/command-center/observatory/live': 'observatory',
  '/command-center/reports': 'reports',
  '/command-center/content': 'content',
  '/command-center/studio': 'studio',
  '/command-center/app-builder': 'builder',
  '/command-center/builder': 'builder',
  '/command-center/wellness': 'wellness',
  '/command-center/fabrication': 'fabrication',
  '/command-center/projects': 'projects',
  '/command-center/memory': 'memory',
  '/command-center/calendar': 'calendar',
  '/command-center/docs': 'docs',
  '/command-center/office': 'office',
  '/apex-athlete': 'mettle',
};

function iconFor(href: string): string {
  return ICON_BY_HREF[href] ?? 'dot';
}

function isItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/command-center') return pathname === '/command-center';
  return pathname === href || pathname.startsWith(href + '/');
}

/** the section label that contains the currently active route (default-open) */
function sectionForPath(pathname: string | null): string {
  for (const s of sections) {
    // longest-match wins so /sales/proposals beats /sales
    const matches = s.items
      .filter((it) => isItemActive(pathname, it.href))
      .sort((a, b) => b.href.length - a.href.length);
    if (matches.length) return s.label;
  }
  return sections[0].label;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSec, setOpenSec] = useState<string>(() => sectionForPath(pathname));

  // when the route changes, expand the section that owns it (single-open)
  useEffect(() => {
    setOpenSec(sectionForPath(pathname));
  }, [pathname]);

  return (
    <>
      {/* Mobile toggle (preserved behavior) */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden"
        style={{
          padding: '8px 10px',
          background: 'rgba(10,10,10,0.95)',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 8,
          color: '#7c3aed',
          fontSize: 16,
          cursor: 'pointer',
          boxShadow: '0 0 12px rgba(124,58,237,0.15)',
        }}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      <aside
        className={`po-side fixed left-0 top-0 z-40 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ position: 'fixed', height: '100vh' }}
      >
        <div className="po-side-head">
          <Logo size={30} />
          <div>
            <div className="nm">PARALLAX</div>
            <div className="ver">OS v4 · COMMAND CENTER</div>
          </div>
        </div>

        <nav className="po-nav po-scroll">
          {sections.map((section) => {
            const open = openSec === section.label;
            const hasActive = section.items.some((it) => isItemActive(pathname, it.href));
            // rolled-up badge count of any numeric badges (legacy items have none → 0)
            const rollup = section.items.length;

            return (
              <div key={section.label} className={`po-nav-grp${open ? ' open' : ''}`}>
                <button
                  type="button"
                  className={`po-nav-sec${hasActive ? ' has-active' : ''}`}
                  onClick={() => setOpenSec(open ? '' : section.label)}
                  aria-expanded={open}
                >
                  <span className="po-nav-sec-lbl">{section.label}</span>
                  {!open && rollup > 0 && <span className="po-nav-sec-roll">{rollup}</span>}
                  <span className="po-nav-sec-chev">
                    <Icon name="chevdown" size={13} />
                  </span>
                </button>

                <div className="po-nav-items">
                  <div className="po-nav-items-inner">
                    {section.items.map((item) => {
                      const active = isItemActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`po-navitem${active ? ' on' : ''}`}
                          style={{ ['--accent' as string]: item.accent } as React.CSSProperties}
                          title={item.label}
                        >
                          <span className="ic">
                            <Icon name={iconFor(item.href)} size={16} />
                          </span>
                          <span className="lbl">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="po-side-foot">
          <span>ATLAS v4 // 20 AGENTS</span>
          <span className="po-foot-dot" />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.8)' }}
        />
      )}
    </>
  );
}
