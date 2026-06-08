'use client';

/* ============================================================================
 * Parallax OS — global alert ticker. Lives just under the HUD. Subscribes to
 * the alert bus; when any instrument has surfaced a critical reading it renders
 * the scrolling red `.po-alertbar` of offending modules. Clicking jumps to the
 * source page. Hidden entirely when there are no alerts.
 * ========================================================================== */

import { useRouter } from 'next/navigation';
import { usePoAlerts, type PoAlert } from '@/lib/po-alert-bus';
import { ROUTE } from '@/lib/po-data';

const SIDEBAR_W = 244;
const HUD_H = 64;

function hrefForAlert(a: PoAlert): string {
  return ROUTE[a.page] ?? a.page ?? '/command-center';
}

export default function AlertTicker() {
  const alerts = usePoAlerts();
  const router = useRouter();

  if (!alerts.length) return null;

  const go = () => {
    const target = hrefForAlert(alerts[0]);
    if (target) router.push(target);
  };

  // duplicate the list so the marquee loops seamlessly (translateX(-50%))
  const loop = [...alerts, ...alerts];

  return (
    <div
      id="cc-alertbar"
      className="po-alertbar"
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
      title="Jump to source"
      style={{
        position: 'fixed',
        top: HUD_H,
        left: SIDEBAR_W,
        right: 0,
        zIndex: 69,
      }}
    >
      <span className="po-alertbar-pulse" />
      <span className="po-alertbar-tag mono">⚠ {alerts.length} CRITICAL</span>
      <div className="po-alertbar-track">
        <div className="po-alertbar-scroll">
          {loop.map((a, i) => (
            <span key={`${a.page}-${i}`} className="po-alertbar-item mono">
              <b>{a.label}</b> {a.value} ·{' '}
              <span style={{ opacity: 0.7 }}>
                {a.pageLabel} · {a.serial}
              </span>
              <span className="po-alertbar-dot" />
            </span>
          ))}
        </div>
      </div>
      <span className="po-alertbar-cta mono">RESOLVE →</span>
    </div>
  );
}
