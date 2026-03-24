'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER SIDEBAR — Holographic Navigation
   Matches dashboard: #0a0a0a bg, accent glows, font-mono uppercase, living borders
   ══════════════════════════════════════════════════════════════════════════════ */

const sections = [
  {
    label: 'OPERATIONS',
    items: [
      { href: '/command-center', label: 'Dashboard', icon: '◇', accent: '#C9A84C' },
      { href: '/command-center/chat', label: 'Chat', icon: '◈', accent: '#7c3aed' },
      { href: '/command-center/agents', label: 'Agents', icon: '✦', accent: '#34d399' },
      { href: '/command-center/tasks', label: 'Tasks', icon: '▣', accent: '#f59e0b' },
      { href: '/command-center/health', label: 'System Health', icon: '◉', accent: '#22d3ee' },
      { href: '/command-center/security', label: 'Security', icon: '◆', accent: '#ef4444' },
      { href: '/command-center/settings', label: 'Settings', icon: '⚙', accent: '#888888' },
      { href: '/command-center/yolo', label: 'YOLO Builds', icon: '⚡', accent: '#f59e0b' },
      { href: '/command-center/nerve-center', label: 'Nerve Center', icon: '⚛', accent: '#7c3aed' },
    ],
  },
  {
    label: 'BUSINESS',
    items: [
      { href: '/command-center/finance', label: 'Finance HQ', icon: '◈', accent: '#fcd34d' },
      { href: '/command-center/finance/arbitrage', label: 'Arbitrage Calc', icon: '△', accent: '#fcd34d' },
      { href: '/command-center/sales', label: 'Sales', icon: '◉', accent: '#f59e0b' },
      { href: '/command-center/sales/proposals', label: 'Proposals', icon: '▷', accent: '#f59e0b' },
      { href: '/command-center/sales/pricing', label: 'Pricing', icon: '◎', accent: '#f59e0b' },
      { href: '/command-center/sales/agent-pricing', label: 'Agent Pricing', icon: '◇', accent: '#f59e0b' },
      { href: '/command-center/legal', label: 'Legal', icon: '⚖', accent: '#8b5cf6' },
      { href: '/command-center/strategy', label: 'Strategy', icon: '◇', accent: '#a855f7' },
      { href: '/command-center/observatory', label: 'Observatory', icon: '🔮', accent: '#9b5de5' },
    ],
  },
  {
    label: 'CREATIVE',
    items: [
      { href: '/command-center/content', label: 'Content', icon: '✒', accent: '#c084fc' },
      { href: '/command-center/studio', label: 'Studio', icon: '♫', accent: '#f59e0b' },
      { href: '/command-center/app-builder', label: 'App Builder', icon: '▣', accent: '#00f0ff' },
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

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
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
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      <aside
        style={{
          background: '#050505',
          borderRight: '1px solid rgba(124,58,237,0.15)',
          width: 240,
          fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
        }}
        className={`
          fixed left-0 top-0 h-screen z-40 transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div
            style={{
              padding: '20px 16px 16px',
              borderBottom: '1px solid rgba(124,58,237,0.15)',
              background: 'linear-gradient(180deg, rgba(124,58,237,0.06) 0%, transparent 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#7c3aed',
                  boxShadow: '0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  color: '#e5e5e5',
                  textTransform: 'uppercase' as const,
                }}
              >
                Command Center
              </span>
            </div>
            <p
              style={{
                fontSize: 9,
                color: 'rgba(124,58,237,0.5)',
                letterSpacing: '0.15em',
                marginTop: 4,
                paddingLeft: 18,
                textTransform: 'uppercase' as const,
              }}
            >
              PARALLAX OS v4
            </p>
          </div>

          {/* Nav sections */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {sections.map((section) => (
              <div key={section.label} style={{ marginBottom: 2 }}>
                {/* Section label */}
                <div
                  style={{
                    padding: '12px 16px 4px',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    color: '#444444',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {section.label}
                </div>

                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/command-center' && pathname?.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 16px',
                        margin: '1px 6px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 400,
                        letterSpacing: '0.05em',
                        color: isActive ? '#e5e5e5' : '#666666',
                        background: isActive
                          ? `rgba(${hexToRgb(item.accent)},0.08)`
                          : 'transparent',
                        borderLeft: isActive
                          ? `2px solid ${item.accent}`
                          : '2px solid transparent',
                        boxShadow: isActive
                          ? `inset 0 0 20px rgba(${hexToRgb(item.accent)},0.04)`
                          : 'none',
                        transition: 'all 120ms ease-in-out',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = `rgba(${hexToRgb(item.accent)},0.04)`;
                          e.currentTarget.style.color = '#999999';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#666666';
                        }
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: isActive ? item.accent : '#333333',
                          flexShrink: 0,
                          width: 16,
                          textAlign: 'center',
                          filter: isActive
                            ? `drop-shadow(0 0 4px ${item.accent})`
                            : 'none',
                        }}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div
            style={{
              padding: '12px 16px 16px',
              borderTop: '1px solid rgba(124,58,237,0.15)',
              background: 'linear-gradient(0deg, rgba(124,58,237,0.04) 0%, transparent 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p
                style={{
                  fontSize: 8,
                  color: '#333333',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase' as const,
                }}
              >
                ATLAS v4 // 20 AGENTS
              </p>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px rgba(34,197,94,0.5)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Pulse animation */}
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
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

/* Helper: hex color to r,g,b string */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}
