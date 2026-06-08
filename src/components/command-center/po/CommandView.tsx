'use client';

/* ============================================================================
 * PARALLAX OS — COMMAND (full dashboard) view.
 * The 3D holographic <Stage/> centerpiece + ATLAS directive bar, vitals strip,
 * fleet list, and the live git/activity feed. Ported from prototype/po-command.jsx.
 * CSS lives in po/po-command.css (+ holo / stage). Navigation goes through real
 * routes (@/lib/po-data ROUTE). A "classic view" link keeps the legacy dashboard
 * reachable at /command-center/legacy.
 * ========================================================================== */

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/command-center/po/Brand';
import { Avatar } from '@/components/command-center/po/Avatar';
import { AGENTS, VITALS, FEED, ROUTE } from '@/lib/po-data';
import Stage from '@/components/command-center/po/Stage';
import type { CSSProperties } from 'react';

export default function CommandView() {
  const router = useRouter();
  const go = (id: string) => {
    const href = ROUTE[id];
    if (href) router.push(href);
  };
  const fleet = AGENTS.slice(0, 8);

  return (
    <div className="cv po-scroll">
      <div className="cv-inner">
        {/* 3D holographic console — the centerpiece */}
        <div className="cv-stage-head">
          <div>
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--gold)' }}>
              <span className="slash" style={{ color: 'var(--gold)' }} /> Mission Control · Live Projection
            </div>
            <h1 className="cv-h1 echo" data-echo="Command Center">Command Center</h1>
          </div>
          <button className="cv-primary" style={{ width: 'auto', padding: '0 20px' }} onClick={() => go('comms')} type="button">
            <Icon name="comms" size={16} /> Open with ATLAS
          </button>
        </div>

        <Stage go={go} />

        <div className="cv-vitals po-panel holo-foil">
          {VITALS.map((v) => (
            <div key={v.lab} className="cv-vital">
              <div className="vtop">
                <span className="eyebrow">{v.lab}</span>
                <Icon name={v.icon} size={15} style={{ color: 'var(--t-lo)' }} />
              </div>
              <div>
                <span className="num tnum">{v.num}</span>
                <span className="sub">{v.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ATLAS directive — the one thing that needs you */}
        <div className="cv-directive holo-foil holo-edge" onClick={() => go('comms')}>
          <div className="holo-orb" style={{ width: 44, height: 44, flex: '0 0 44px' }}>
            <span className="ring2" />
            <span className="sheen" />
            <span className="core" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ color: 'var(--c-purple-l)', marginBottom: 5 }}>ATLAS · Directive</div>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>
              <b style={{ color: 'var(--gold-l)' }}>Helios Robotics</b> went hot 12m ago and matches three signals. Want me to draft outreach and brief Proximon?
            </div>
          </div>
          <button className="cv-primary" style={{ width: 'auto', padding: '0 20px', flex: '0 0 auto' }} type="button">
            <Icon name="comms" size={16} /> Respond
          </button>
        </div>

        <div className="cv-cols">
          <section className="po-panel">
            <div className="cv-sec-head">
              <Icon name="agents" size={16} style={{ color: 'var(--accent)' }} />
              <h3>Fleet</h3>
              <span className="po-pal-grp" onClick={() => go('agents')} style={{ cursor: 'pointer' }}>view all 20</span>
            </div>
            <div className="cv-fleet po-scroll">
              {fleet.map((o) => (
                <div key={o.id} className="cv-fleet-row" style={{ ['--fac' as string]: o.fac } as CSSProperties} onClick={() => go('comms')}>
                  <span className="cv-fleet-sig" style={{ background: 'none', border: 'none' }}>
                    <Avatar agent={o} size={34} bob={false} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="cv-fleet-name">{o.name}</div>
                    <div className="cv-fleet-task">{o.task}</div>
                  </div>
                  <span className={'cv-fleet-stat ' + (o.status === 'idle' ? 'idle' : 'active')}>
                    {o.status === 'idle' ? 'idle' : o.status === 'busy' ? 'working' : 'online'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="po-panel">
            <div className="cv-sec-head">
              <Icon name="pulse" size={16} style={{ color: 'var(--accent)' }} />
              <h3>Live activity</h3>
              <span className="po-pal-grp">main · streaming</span>
            </div>
            <div className="cv-feed">
              {FEED.map((f) => (
                <div key={f.hash} className="cv-feed-row">
                  <span className="cv-feed-hash">{f.hash}</span>
                  <span className="cv-feed-msg">{f.msg}</span>
                  <span className="cv-feed-meta">{f.who} · {f.t}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* keep the rich legacy dashboard reachable */}
        <div className="cv-classic-link" style={{ textAlign: 'center', padding: '4px 0 8px' }}>
          <button
            className="po-pal-grp"
            style={{ cursor: 'pointer', background: 'none', border: 'none' }}
            onClick={() => router.push('/command-center/legacy')}
            type="button"
          >
            ↩ classic view
          </button>
        </div>
      </div>
    </div>
  );
}
