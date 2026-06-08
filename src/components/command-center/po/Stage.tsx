'use client';

/* ============================================================================
 * PARALLAX OS — HOLO STAGE (volumetric 3D console centerpiece).
 * Wireframe-globe arc-reactor core w/ triple gimbal rings, the agent fleet
 * orbiting in 3D (avatars scale/dim by depth), four floating instrument gauges
 * (Agents/MRR/Jobs/Shipped) with connector lines + drifting arc reticles, a
 * perspective floor grid, rising data motes, scanlines, and a cursor tilt.
 * Ported from prototype/po-stage.jsx. CSS lives in po/po-stage.css (+ holo).
 *
 * Motion gates on prefers-reduced-motion AND the .po-still tweak (usePoTheme).
 * Live drift via setInterval/rAF in useEffect, cleared on unmount.
 * ========================================================================== */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Avatar } from '@/components/command-center/po/Avatar';
import { AGENTS } from '@/lib/po-data';
import { usePoTheme } from '@/components/command-center/PoShell';

// pick 7 agents to orbit (Atlas is the core, others orbit)
const ORBITERS = AGENTS.filter((a) => !a.lead).slice(0, 7);

type Mote = { x: number; d: number; dur: number; c: string };
const MOTES: Mote[] = [
  { x: 20, d: 0, dur: 7, c: 'var(--c-purple-l)' },
  { x: 34, d: 2.5, dur: 9, c: 'var(--c-cyan)' },
  { x: 46, d: 1.2, dur: 8, c: 'var(--gold-l)' },
  { x: 58, d: 3.4, dur: 7.5, c: 'var(--c-purple-l)' },
  { x: 67, d: 0.8, dur: 9.5, c: 'var(--c-green)' },
  { x: 78, d: 2, dur: 8.2, c: 'var(--c-cyan)' },
  { x: 27, d: 4, dur: 8.8, c: 'var(--gold-l)' },
  { x: 72, d: 5, dur: 7.2, c: 'var(--c-purple-l)' },
];

type Gauge = {
  lab: string;
  val: string;
  sub: string;
  serial: string;
  arc: number;
  pos: CSSProperties;
  conn: CSSProperties;
};
const GAUGES: Gauge[] = [
  { lab: 'Agents', val: '19', sub: '/20', serial: 'FLT·01A', arc: 0.95, pos: { left: '3%', top: '14%' }, conn: { width: 70, left: '100%' } },
  { lab: 'MRR', val: '$48.2k', sub: '+6%', serial: 'FIN·04C', arc: 0.62, pos: { right: '2%', top: '11%' }, conn: { width: 64, right: '100%' } },
  { lab: 'Jobs', val: '7', sub: 'live', serial: 'OPS·02B', arc: 0.45, pos: { left: '5%', bottom: '20%' }, conn: { width: 60, left: '100%' } },
  { lab: 'Shipped', val: '23', sub: 'today', serial: 'BLD·07F', arc: 0.78, pos: { right: '4%', bottom: '17%' }, conn: { width: 58, right: '100%' } },
];

// Iron Man / HUD concentric arc-gauge reticle
function ArcGauge({ v, size = 50 }: { v: number; size?: number }) {
  const R = 19;
  const C = 2 * Math.PI * R;
  const span = 0.72; // 260° arc, gap at bottom
  const track = C * span;
  const fill = track * Math.max(0, Math.min(1, v));
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  return (
    <svg className="arc-gauge" width={size} height={size} viewBox="0 0 50 50" aria-hidden="true">
      <g transform="rotate(129 25 25)">
        <circle cx="25" cy="25" r={R} fill="none" stroke="var(--line-2)" strokeWidth="3" strokeDasharray={`${track} ${C}`} opacity="0.3" />
        <circle className="arc-fill" cx="25" cy="25" r={R} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${fill} ${C}`} />
      </g>
      {ticks.map((i) => {
        const a = ((129 + (i / 10) * 260) * Math.PI) / 180;
        const x1 = 25 + Math.cos(a) * 23;
        const y1 = 25 + Math.sin(a) * 23;
        const x2 = 25 + Math.cos(a) * 25;
        const y2 = 25 + Math.sin(a) * 25;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth="1" opacity="0.4" />;
      })}
      <circle cx="25" cy="25" r="2" fill="var(--accent)" />
      <line x1="25" y1="20.5" x2="25" y2="22.5" stroke="var(--accent)" strokeWidth="1" />
      <line x1="25" y1="27.5" x2="25" y2="29.5" stroke="var(--accent)" strokeWidth="1" />
      <line x1="20.5" y1="25" x2="22.5" y2="25" stroke="var(--accent)" strokeWidth="1" />
      <line x1="27.5" y1="25" x2="29.5" y2="25" stroke="var(--accent)" strokeWidth="1" />
    </svg>
  );
}

export default function Stage({ go }: { go?: (id: string) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const { still } = usePoTheme();

  // live-drifting gauge values
  const [gv, setGv] = useState<number[]>(() => GAUGES.map((g) => g.arc));
  useEffect(() => {
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || still) return;
    const iv = setInterval(() => {
      setGv((prev) => prev.map((v) => Math.max(0.08, Math.min(0.99, v + (Math.random() - 0.5) * 0.08))));
    }, 1700);
    return () => clearInterval(iv);
  }, [still]);

  // mouse tilt
  useEffect(() => {
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || still) return;
    const el = stageRef.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--tilty', (x * 16).toFixed(2) + 'deg');
        el.style.setProperty('--tiltx', (-y * 10).toFixed(2) + 'deg');
      });
    };
    const leave = () => {
      el.style.setProperty('--tilty', '0deg');
      el.style.setProperty('--tiltx', '0deg');
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', leave);
      cancelAnimationFrame(raf);
    };
  }, [still]);

  // orbit animation (JS so nodes stay billboarded/upright)
  useEffect(() => {
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || still) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  const Rx = 200;
  const Rz = 64; // orbit radii (elliptical, tilted)
  return (
    <div className="stage holo-edge" ref={stageRef}>
      <div className="stage-scene">
        <div className="stage-floor" />

        {/* flat HUD compass under core */}
        <div className="stage-compass">
          <div className="compass-ring tick" />
          <div className="compass-ring rot" style={{ inset: '10%', borderStyle: 'dashed' }} />
        </div>

        {/* orbiting fleet */}
        <div className="orbit">
          <div className="orbit-path" style={{ width: Rx * 2, height: Rz * 2 }} />
          {ORBITERS.map((a, i) => {
            const ang = (i / ORBITERS.length) * Math.PI * 2 + t * 0.34;
            const x = Math.cos(ang) * Rx;
            const z = Math.sin(ang) * Rx; // depth
            const y = Math.sin(ang) * Rz * -0.35; // slight vertical for the tilt
            const depth = (z + Rx) / (Rx * 2); // 0..1 back→front
            return (
              <div
                key={a.id}
                className="orbit-node"
                style={{
                  transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)`,
                  zIndex: Math.round(depth * 100),
                  opacity: 0.5 + depth * 0.5,
                }}
              >
                <div
                  className="orbit-chip naked"
                  style={{ ['--fac' as string]: a.fac, transform: `scale(${(0.78 + depth * 0.34).toFixed(2)})` } as CSSProperties}
                  onClick={() => go && go('comms')}
                  title={a.name}
                >
                  <Avatar agent={a} size={42} bob={false} />
                </div>
                {depth > 0.55 && (
                  <div className="orbit-label" style={{ ['--fac' as string]: a.fac } as CSSProperties}>
                    {a.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CORE */}
        <div className="stage-core">
          <div className="core-glow" />
          <div className="gring r1" style={{ ['--rb' as string]: 'rotateX(72deg)' } as CSSProperties} />
          <div className="gring r2" style={{ ['--rb' as string]: 'rotateY(70deg)' } as CSSProperties} />
          <div className="gring r3" style={{ ['--rb' as string]: 'rotateX(60deg) rotateY(28deg)' } as CSSProperties} />
          <div className="core-iris" />
          <div className="core-sphere" />
          <div className="core-wire-spin">
            <div className="core-wire">
              <i /><i /><i /><i /><i />
            </div>
          </div>
        </div>

        {/* rising data motes */}
        <div className="stage-motes" aria-hidden="true">
          {MOTES.map((m, i) => (
            <span
              key={i}
              style={{
                left: m.x + '%',
                bottom: '8%',
                animationDelay: m.d + 's',
                animationDuration: m.dur + 's',
                ['--mc' as string]: m.c,
              } as CSSProperties}
            />
          ))}
        </div>

        {/* title plate */}
        <div className="stage-plate">
          <div className="nm">ATLAS</div>
          <div className="st">
            <span className="po-livedot" />ALL SYSTEMS NOMINAL · 20 AGENTS
          </div>
        </div>
      </div>

      {/* floating gauges — cockpit instruments (serial · arc reticle · brackets) */}
      {GAUGES.map((g, gi) => (
        <div key={g.lab} className="holo-gauge" style={{ ...g.pos, position: 'absolute' }}>
          <div className="gauge-card instrument">
            <span className="gauge-conn" style={g.conn} />
            <span className="inst-cnr tl" />
            <span className="inst-cnr tr" />
            <span className="inst-cnr bl" />
            <span className="inst-cnr br" />
            <span className="inst-serial">{g.serial}</span>
            <div className="gauge-row">
              <ArcGauge v={gv[gi]} />
              <div className="gauge-readout">
                <div className="gauge-lab">{g.lab}</div>
                <div className="gauge-val tnum">
                  {g.val}
                  <small>{g.sub}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="stage-fx" />
      <div className="stage-crt" aria-hidden="true" />
    </div>
  );
}
