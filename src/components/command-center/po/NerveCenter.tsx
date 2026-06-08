'use client';

/* ============================================================================
 * PARALLAX OS — NERVE CENTER (showpiece #8). Ported from prototype/po-pages.jsx
 * `NerveCenterPage`. Integration mesh: an ATLAS gold core + 7 service nodes
 * (Gateway, Slack, Linear, Stripe, GitHub, Vercel, OpenAI) in faction colors,
 * connector lines, data packets travelling along the links toward the core,
 * and a live signal-traffic feed.
 *
 * Real data: when live jobs exist (`/api/command-center/jobs`), real job
 * titles are folded into the signal-traffic feed so the war room reflects
 * actual fleet activity; otherwise the design mock traffic streams. The mesh
 * SVG + packet motion are presentation only. Motion gates on
 * prefers-reduced-motion AND the .po-still tweak.
 * ========================================================================== */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
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

type Node = { id: string; label: string; x: number; y: number; fac: string; core?: boolean };

const NERVE_NODES: Node[] = [
  { id: 'atlas', label: 'ATLAS', x: 50, y: 48, fac: 'var(--c-gold)', core: true },
  { id: 'gateway', label: 'GATEWAY', x: 50, y: 14, fac: 'var(--c-green)' },
  { id: 'slack', label: 'SLACK', x: 84, y: 26, fac: 'var(--c-fuchsia)' },
  { id: 'linear', label: 'LINEAR', x: 88, y: 60, fac: 'var(--c-indigo)' },
  { id: 'stripe', label: 'STRIPE', x: 70, y: 86, fac: 'var(--c-cyan)' },
  { id: 'github', label: 'GITHUB', x: 30, y: 86, fac: 'var(--c-violet)' },
  { id: 'vercel', label: 'VERCEL', x: 12, y: 60, fac: 'var(--c-sky)' },
  { id: 'openai', label: 'OPENAI', x: 16, y: 26, fac: 'var(--c-teal)' },
];
const NERVE_LINKS = NERVE_NODES.filter((n) => !n.core).map((n) => ({ to: n.id, fac: n.fac }));

type Feed = [src: string, msg: string, color: string];
const NERVE_FEED: Feed[] = [
  ['GATEWAY', 'ingress · 1.2GB/s', 'var(--c-green)'],
  ['STRIPE', 'webhook · invoice.paid', 'var(--c-cyan)'],
  ['GITHUB', 'push · main +147', 'var(--c-violet)'],
  ['SLACK', 'msg · #launch-room', 'var(--c-fuchsia)'],
  ['LINEAR', 'issue · PAR-318 done', 'var(--c-indigo)'],
  ['OPENAI', 'completion · 2.4k tok', 'var(--c-teal)'],
];

type Job = { id: string; title: string; kind: string; status: string };

export default function NerveCenter() {
  const { still } = usePoTheme();
  const p = PAGE['nerve'] || { label: 'Nerve Center', icon: 'nerve', section: 'Operations' };

  const [feed, setFeed] = useState(() => NERVE_FEED.map((f, i) => ({ f, id: i, fresh: false })));
  const [liveJobs, setLiveJobs] = useState<Job[]>([]);
  const nid = useRef(50);

  // pull real live jobs to weave into the signal-traffic feed
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/command-center/jobs?limit=30', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { jobs?: Job[] } | null) => {
          if (cancelled || !j?.jobs) return;
          setLiveJobs(j.jobs.filter((x) => x.status === 'running' || x.status === 'queued'));
        })
        .catch(() => {});
    };
    load();
    const i = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, []);

  useEffect(() => {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || still) return;
    const iv = setInterval(() => {
      // prefer a real running job as the next traffic line when one exists
      const job = liveJobs[Math.floor(Math.random() * liveJobs.length)];
      const pick: Feed = job
        ? ['ATLAS', `job · ${job.title.slice(0, 28)}`, 'var(--c-gold)']
        : NERVE_FEED[Math.floor(Math.random() * NERVE_FEED.length)];
      setFeed((q) => [{ f: pick, id: nid.current++, fresh: true }, ...q.map((x) => ({ ...x, fresh: false }))].slice(0, 7));
      poPlay('blip');
    }, 2600);
    return () => clearInterval(iv);
  }, [still, liveJobs]);

  const core = NERVE_NODES[0];

  return (
    <div className="pg po-scroll" style={{ ['--accent' as string]: 'var(--c-purple)' } as CSSProperties}>
      <div className="pg-inner">
        {/* instrument header */}
        <div className="pg-head instrument-head">
          <span className="inst-cnr tl" />
          <span className="inst-cnr tr" />
          <span className="inst-cnr bl" />
          <span className="inst-cnr br" />
          <span className="pg-head-ic">
            <Icon name="nerve" size={24} />
            <span className="pg-ic-ring" />
          </span>
          <div className="pg-head-body">
            <div className="pg-head-meta mono">
              <span className="pg-sec">{p.section}</span>
              <span className="pg-sep" />
              <span className="pg-serial">SYS·{serialFor('nerve')}</span>
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
            <button className="pg-btn" type="button" onClick={() => poPlay('open')}>
              <Icon name="nerve" size={15} /> Add bridge
            </button>
          </div>
        </div>

        <div className="nv-grid">
          {/* integration mesh */}
          <div className="nv-mesh po-panel holo-edge">
            <span className="inst-cnr tl" />
            <span className="inst-cnr tr" />
            <span className="inst-cnr bl" />
            <span className="inst-cnr br" />
            <div className="nv-mesh-head">
              <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--accent)' }}>
                INTEGRATION MESH
              </span>
              <span className="ab-livetag mono">
                <i style={{ background: 'var(--c-purple-l)', boxShadow: '0 0 6px var(--c-purple-l)' }} />7 BRIDGES LIVE
              </span>
            </div>
            <svg className="nv-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {NERVE_LINKS.map((l, i) => {
                const n = NERVE_NODES.find((x) => x.id === l.to)!;
                return (
                  <g key={l.to}>
                    <line x1={core.x} y1={core.y} x2={n.x} y2={n.y} stroke={l.fac} strokeWidth="0.3" opacity="0.3" />
                    <circle
                      className="nv-packet"
                      r="0.9"
                      fill={l.fac}
                      style={{ offsetPath: `path('M ${n.x} ${n.y} L ${core.x} ${core.y}')`, animationDelay: i * -0.7 + 's' } as CSSProperties}
                    />
                  </g>
                );
              })}
              {NERVE_NODES.map((n) => (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={n.core ? 5 : 3.2} fill={`color-mix(in oklab, ${n.fac} 22%, #0c0c14)`} stroke={n.fac} strokeWidth="0.4" />
                  {n.core && <circle className="nv-core-ring" cx={n.x} cy={n.y} r="6.5" fill="none" stroke={n.fac} strokeWidth="0.3" opacity="0.5" />}
                </g>
              ))}
            </svg>
            {NERVE_NODES.map((n) => (
              <span key={n.id} className="nv-node-lab mono" style={{ left: n.x + '%', top: n.y + '%', color: n.fac }}>
                {n.label}
              </span>
            ))}
          </div>

          {/* live signal traffic */}
          <section className="po-panel nv-feed-panel">
            <div className="cv-sec-head">
              <Icon name="nerve" size={16} style={{ color: 'var(--accent)' }} />
              <h3>Signal traffic</h3>
              <span className="po-pal-grp mono">live</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {feed.map(({ f, id, fresh }) => (
                <div key={id} className={'nv-feed' + (fresh ? ' ab-fresh' : '')}>
                  <span className="nv-feed-dot" style={{ background: f[2], boxShadow: '0 0 7px ' + f[2] }} />
                  <span className="nv-feed-src mono" style={{ color: f[2] }}>
                    {f[0]}
                  </span>
                  <span className="nv-feed-msg mono">{f[1]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
