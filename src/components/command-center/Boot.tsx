'use client';

/* ============================================================================
 * Parallax OS — IGNITION SEQUENCE. Once-per-session boot overlay: glowing core
 * + rings + crosshair, "PARALLAX OS v4", a typed system log of live fleet
 * counts, a fill bar, then a CSS dissolve. Session-gated via sessionStorage
 * ('po-booted'). Skippable by any key / click. Plays poPlay('boot') if sound on.
 * ========================================================================== */

import { useEffect, useState } from 'react';
import { Logo } from '@/components/command-center/po/Brand';
import { AGENTS } from '@/lib/po-data';
import { poPlay } from '@/lib/po-sound';

const BOOTED_KEY = 'po-booted';

function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Boot() {
  // start true only if this session hasn't booted yet (client-only check)
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    let show = true;
    try {
      show = sessionStorage.getItem(BOOTED_KEY) !== '1';
    } catch {
      /* ignore */
    }
    if (!show) return;

    setBooting(true);
    poPlay('boot');

    const dur = reducedMotion() ? 700 : 3200; // matches po-boot.css boot-out timing
    const end = () => {
      setBooting(false);
      try {
        sessionStorage.setItem(BOOTED_KEY, '1');
      } catch {
        /* ignore */
      }
    };
    const timer = window.setTimeout(end, dur);
    const skip = () => {
      window.clearTimeout(timer);
      end();
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('click', skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('click', skip);
    };
  }, []);

  if (!booting) return null;

  const online = AGENTS.filter((a) => a.status !== 'idle').length;
  const idle = AGENTS.length - online;
  const busy = AGENTS.filter((a) => a.status === 'busy').length;

  const LINES = [
    'PARALLAX OS v4 · KERNEL HANDSHAKE … OK',
    'MOUNTING NAV-COM v4.1408 … OK',
    `SPINNING UP FLEET · ${AGENTS.length} OPERATIVES … ${online} ONLINE`,
    'GATEWAY LINK · CLOUDFLARE TUNNEL … OK',
    busy > 0
      ? `${busy} AGENTS WORKING · ${idle} IDLE · ATLAS AWAKE`
      : 'ATLAS ORCHESTRATOR … AWAKE',
  ];

  return (
    <div className="po-boot" role="status" aria-label="System ignition">
      <div className="po-boot-scan" />
      <div className="po-boot-core">
        <span className="po-boot-ring r1" />
        <span className="po-boot-ring r2" />
        <span className="po-boot-ring r3" />
        <span className="po-boot-orb">
          <Logo size={48} />
        </span>
        <span className="po-boot-cross h" />
        <span className="po-boot-cross v" />
      </div>
      <div className="po-boot-title">
        PARALLAX <span>OS v4</span>
      </div>
      <div className="po-boot-sub mono">COMMAND CENTER · IGNITION SEQUENCE</div>
      <div className="po-boot-log mono">
        {LINES.map((l, i) => (
          <div key={i} className="po-boot-line" style={{ animationDelay: `${0.35 + i * 0.42}s` }}>
            {l}
          </div>
        ))}
      </div>
      <div className="po-boot-bar">
        <span />
      </div>
      <div className="po-boot-skip mono">PRESS ANY KEY TO SKIP</div>
    </div>
  );
}
