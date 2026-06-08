'use client';

/* ============================================================================
 * PARALLAX OS — SANCTUARY view (default /command-center landing).
 * Radical calm: one luminous golden throne (Iron Man targeting reticle) in a
 * vast field, a constellation of 6 primary domains as points of light, one
 * truth line, and "The Word" (⌘K). Ported from prototype/po-sanctuary.jsx.
 *
 * Navigation goes through real routes (@/lib/po-data ROUTE).
 * "The Word" opens the existing ⌘K command palette by dispatching a synthetic
 * Meta+K keydown on window (the chrome's CommandHUD already listens for that).
 * Motion gates on prefers-reduced-motion AND the .po-still tweak (usePoTheme).
 * ========================================================================== */

import { useEffect, useRef, Fragment, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/command-center/po/Brand';
import { ROUTE } from '@/lib/po-data';
import { usePoTheme } from '@/components/command-center/PoShell';

// six primary domains orbit the throne (everything else via the Word/⌘K)
type Star = { id: string; label: string; fac: string; x: number; y: number; ct: string };
const STARS: Star[] = [
  { id: 'comms', label: 'Comms', fac: 'var(--c-purple-l)', x: 50, y: 23, ct: '12 unread' },
  { id: 'agents', label: 'Agents', fac: 'var(--c-green)', x: 73, y: 33, ct: '19 online' },
  { id: 'finance', label: 'Finance', fac: 'var(--gold)', x: 70, y: 62, ct: '$48.2k' },
  { id: 'observatory', label: 'Observatory', fac: 'var(--c-violet)', x: 50, y: 69, ct: '6 signals' },
  { id: 'tasks', label: 'Tasks', fac: 'var(--c-amber)', x: 30, y: 62, ct: '7 live' },
  { id: 'builder', label: 'App Builder', fac: 'var(--c-cyan)', x: 27, y: 33, ct: 'ready' },
];

// the truths, woven into one quiet line (not floating boxes)
const TRUTHS: [string, string][] = [
  ['19/20', 'online'],
  ['$48.2k', 'MRR'],
  ['7', 'jobs'],
  ['23', 'shipped'],
];

/** open the existing ⌘K palette via a synthetic Meta+K keydown (chrome listens). */
function openPalette() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
  );
}

export default function Sanctuary() {
  const router = useRouter();
  const { toggleTheme, still } = usePoTheme();
  const ref = useRef<HTMLDivElement>(null);

  const go = (id: string) => {
    const href = ROUTE[id];
    if (href) router.push(href);
  };
  const onExpand = () => router.push('/command-center/dashboard');

  // mouse parallax — gated on reduced-motion AND the .po-still tweak.
  useEffect(() => {
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || still) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--sx', x.toFixed(3));
        el.style.setProperty('--sy', y.toFixed(3));
      });
    };
    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [still]);

  return (
    <div className="sanc" ref={ref}>
      <div className="sanc-field" />

      {/* minimal corner: theme + expand to full command center */}
      <div className="sanc-corner">
        <button className="po-icbtn" onClick={toggleTheme} title="Toggle light / dark" type="button">
          <Icon name="sun" size={16} />
        </button>
        <button className="po-icbtn" onClick={onExpand} title="Expand to full Command Center" type="button">
          <Icon name="dashboard" size={16} />
        </button>
      </div>

      {/* DIRECTIVE — the state of all things, in one breath */}
      <div className="sanc-top">
        <div className="sanc-eyebrow">Parallax OS · Sanctuary</div>
        <div className="sanc-status">
          <span className="dot" /> All systems nominal · the fleet is at peace
        </div>
        <div className="sanc-truths">
          {TRUTHS.map(([v, l], i) => (
            <Fragment key={l}>
              {i > 0 && <span className="sep" />}
              <span className="t">
                <b className="tnum">{v}</b> {l}
              </span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* CONSTELLATION — navigation as points of light */}
      <div className="sanc-constellation">
        {STARS.map((s) => (
          <div
            key={s.id}
            className="sanc-star"
            style={{ left: s.x + '%', top: s.y + '%', ['--fac' as string]: s.fac } as CSSProperties}
            onClick={() => go(s.id)}
            title={s.label}
          >
            <span className="pt" />
            <span className="lbl">{s.label}</span>
            <span className="ct">{s.ct}</span>
          </div>
        ))}
      </div>

      {/* THE THRONE — an Iron Man targeting reticle */}
      <div className="sanc-throne">
        <div className="sanc-rays" />
        <div className="sanc-halo" />

        {/* targeting reticle: brackets · crosshair · segmented arcs · telemetry */}
        <div className="sanc-reticle">
          <span className="sanc-cross h" />
          <span className="sanc-cross v" />
          <span className="sanc-brk tl" />
          <span className="sanc-brk tr" />
          <span className="sanc-brk bl" />
          <span className="sanc-brk br" />
          <span className="sanc-tele t">TARGET · ATLAS // LOCK</span>
          <span className="sanc-tele l">AXIS·0</span>
          <span className="sanc-tele r">AXIS·1</span>
        </div>

        <div className="sanc-ring r3" />
        <div className="sanc-ring r1" />
        <div className="sanc-arc a1" />
        <div className="sanc-arc a2" />
        <div className="sanc-ring ticks" />
        <div className="sanc-ring r2" />
        <div className="sanc-core" onClick={() => go('comms')} title="Commune with ATLAS">
          <span className="sanc-core-glint" />
        </div>
      </div>

      {/* THE WORD — speak, and it is done */}
      <div className="sanc-bottom">
        <div className="sanc-directive">
          <b>Helios Robotics</b> is hot and matches three signals — speak, and it is done.
        </div>
        <div className="sanc-word" onClick={openPalette}>
          <span className="orb">
            <Icon name="command" size={18} />
          </span>
          <span className="ph">Speak intent — name a place, an operative, a command…</span>
          <span className="kbd">⌘K</span>
        </div>
      </div>
    </div>
  );
}
