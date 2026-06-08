'use client';

/* ============================================================================
 * PARALLAX OS — OBSERVATORY (showpiece #6). Ported from prototype/po-pages.jsx
 * `ObservatoryPage`. A radar with a central gas-giant world
 * (/assets/characters/11.png), 6 signal blips orbiting in real time (rose when
 * confidence > 85%, else violet), confidence %s ticking. Click a blip or list
 * row to lock on (the .sel ping ring).
 *
 * Design mock data (signals) — the live Observatory route lives separately at
 * /command-center/observatory/live and is not touched. Confidence drift +
 * orbit are presentation only; motion gates on prefers-reduced-motion AND the
 * .po-still tweak.
 * ========================================================================== */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/command-center/po/Brand';
import { PAGE } from '@/lib/po-data';
import { usePoTheme } from '@/components/command-center/PoShell';
import { poPlay } from '@/lib/po-sound';

function serialFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = (h % 9) + 1,
    b = ((h >> 4) % 900) + 100,
    c = ((h >> 8) % 9000) + 1000;
  return `${String(a).padStart(2, '0')}A${b}·${c}`;
}

type Signal = { name: string; conf: number; r: number; a: number };

const SIGNALS: Signal[] = [
  { name: 'Helios Robotics · hiring surge', conf: 96, r: 0.3, a: 20 },
  { name: 'Vela Logistics · funding rumor', conf: 88, r: 0.4, a: 305 },
  { name: 'Orbit Health · exec hire', conf: 81, r: 0.26, a: 140 },
  { name: 'Cobalt Studio · pricing intent', conf: 74, r: 0.42, a: 210 },
  { name: 'Nimbus AI · competitor churn', conf: 67, r: 0.36, a: 80 },
  { name: 'Apex Foundry · RFP posted', conf: 59, r: 0.45, a: 255 },
];

export default function Observatory() {
  const { still } = usePoTheme();
  const p = PAGE['observatory'] || { label: 'Observatory', icon: 'observatory', section: 'Operations' };

  const [sig, setSig] = useState<Signal[]>(SIGNALS);
  const [phase, setPhase] = useState(0);
  const [sel, setSel] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || still) return;
    const iv = setInterval(() => {
      setSig((prev) => prev.map((s) => ({ ...s, conf: Math.max(40, Math.min(99, s.conf + Math.round((Math.random() - 0.5) * 4))) })));
    }, 1700);
    const start = performance.now();
    const loop = (now: number) => {
      setPhase((now - start) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      clearInterval(iv);
      cancelAnimationFrame(rafRef.current);
    };
  }, [still]);

  const lockOn = (i: number) => {
    setSel(i);
    poPlay('blip');
  };

  return (
    <div className="pg po-scroll" style={{ ['--accent' as string]: 'var(--c-violet)' } as CSSProperties}>
      <div className="pg-inner">
        {/* instrument header */}
        <div className="pg-head instrument-head">
          <span className="inst-cnr tl" />
          <span className="inst-cnr tr" />
          <span className="inst-cnr bl" />
          <span className="inst-cnr br" />
          <span className="pg-head-ic">
            <Icon name="observatory" size={24} />
            <span className="pg-ic-ring" />
          </span>
          <div className="pg-head-body">
            <div className="pg-head-meta mono">
              <span className="pg-sec">{p.section}</span>
              <span className="pg-sep" />
              <span className="pg-serial">SYS·{serialFor('observatory')}</span>
              <span className="pg-sep" />
              <span className="pg-live">
                <i />
                ONLINE
              </span>
            </div>
            <h1 className="pg-h1 echo" data-echo={p.label}>
              {p.label}
            </h1>
            <div className="pg-ruler" aria-hidden="true">
              {Array.from({ length: 40 }).map((_, i) => (
                <i key={i} className={i % 5 === 0 ? 'maj' : ''} />
              ))}
            </div>
          </div>
          <div className="pg-head-act">
            <Link className="pg-btn" href="/command-center/observatory/multiverse" onClick={() => poPlay('nav')}>
              <Icon name="strategy" size={15} /> Multiverse
            </Link>
            <button className="pg-btn" type="button" onClick={() => poPlay('open')}>
              <Icon name="spark" size={15} /> Scan now
            </button>
          </div>
        </div>

        <p className="pg-sub" style={{ marginTop: -16, marginBottom: 24 }}>
          HORIZON is tracking {sig.length} live signals across the market. Confidence updates in real time.
        </p>

        <div className="ob-grid">
          {/* radar with central gas-giant world + orbiting blips */}
          <div className="ob-radar holo-edge">
            {[0.32, 0.58, 0.84].map((r, i) => (
              <div key={i} className="ob-ring" style={{ width: `${r * 100}%`, height: `${r * 100}%` }} />
            ))}
            <div className="ob-sweep" />
            <div className="ob-planet">
              <div className="ob-planet-glow" />
              <div className="ob-planet-body">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/characters/11.png" alt="Tracked world" />
              </div>
              <div className="ob-planet-ring" />
            </div>
            {sig.map((s, i) => {
              const ang = ((s.a + phase * (6 + i * 1.5)) * Math.PI) / 180;
              const left = 50 + Math.cos(ang) * s.r * 100;
              const top = 50 + Math.sin(ang) * s.r * 100;
              return (
                <span
                  key={i}
                  className={'ob-blip' + (sel === i ? ' sel' : '')}
                  onClick={() => lockOn(i)}
                  style={{ left: left + '%', top: top + '%', ['--bc' as string]: s.conf > 85 ? 'var(--c-rose)' : 'var(--c-violet)' } as CSSProperties}
                  title={s.name}
                />
              );
            })}
          </div>

          {/* tracked-signal list — click a row to lock on */}
          <section className="po-panel">
            <div className="cv-sec-head">
              <Icon name="observatory" size={16} style={{ color: 'var(--accent)' }} />
              <h3>Tracked signals</h3>
              <span className="po-pal-grp mono">HORIZON · live</span>
            </div>
            <div style={{ padding: '2px 0' }}>
              {sig.map((s, i) => (
                <div key={s.name} className={'ob-signal' + (sel === i ? ' sel' : '')} onClick={() => lockOn(i)}>
                  <span className="ob-conf tnum" style={s.conf > 85 ? { color: 'var(--c-rose)' } : undefined}>
                    {s.conf}%
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>{s.name}</div>
                    <div className="ob-bar">
                      <span style={{ width: s.conf + '%', background: s.conf > 85 ? 'var(--c-rose)' : 'var(--c-violet)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
