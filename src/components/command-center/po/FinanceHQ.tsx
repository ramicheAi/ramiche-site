'use client';

/* ============================================================================
 * PARALLAX OS — FINANCE HQ (showpiece #5). Ported from prototype/po-pages.jsx
 * `FinancePage`. Instrument header, a giant MRR figure that climbs live, LIVE
 * tag, area chart with a pulsing beacon, four ring-gauge tiles, and a
 * transaction stream where new deals flash gold at the top.
 *
 * Real data: seeds the live MRR + ARR from the real Stripe revenue endpoint
 * (`/api/command-center/stripe-revenue`) when it reports `source: "live"`;
 * real recent Stripe charges are folded into the transaction stream. Falls
 * back to the design mock when Stripe is unavailable. Drift is presentation
 * only. Motion gates on prefers-reduced-motion AND the .po-still tweak.
 * ========================================================================== */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@/components/command-center/po/Brand';
import { PAGE } from '@/lib/po-data';
import { usePoTheme } from '@/components/command-center/PoShell';
import { poPlay } from '@/lib/po-sound';
import { poAlertBus } from '@/lib/po-alert-bus';

// deterministic serial code per page (matches prototype serialFor)
function serialFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = (h % 9) + 1,
    b = ((h >> 4) % 900) + 100,
    c = ((h >> 8) % 9000) + 1000;
  return `${String(a).padStart(2, '0')}A${b}·${c}`;
}

type Tx = [name: string, plan: string, amt: string];

const TX: Tx[] = [
  ['Helios Robotics', 'Annual · Scale', '+$18,000'],
  ['Vela Logistics', 'Monthly · Pro', '+$2,400'],
  ['Orbit Health', 'Annual · Pro', '+$9,600'],
  ['Cobalt Studio', 'Monthly · Starter', '+$390'],
  ['Refund · Nimbus', 'Downgrade', '−$1,200'],
];
const TX_POOL: Tx[] = [
  ['Meridian Labs', 'Annual · Scale', '+$24,000'],
  ['Quanta Systems', 'Monthly · Pro', '+$2,400'],
  ['Northwind Co', 'Monthly · Starter', '+$390'],
  ['Ardent Group', 'Annual · Pro', '+$9,600'],
  ['Volt Mobility', 'Monthly · Pro', '+$2,400'],
  ['Cirrus AI', 'Annual · Scale', '+$31,000'],
  ['Refund · Pylon', 'Downgrade', '−$890'],
  ['Beacon Health', 'Monthly · Pro', '+$2,400'],
];

type StripeRevenue = {
  subscriptions?: { active: number; mrr: number; arr: number };
  recentTransactions?: { id: string; amount: number; description: string; created: string; status: string }[];
  source?: 'live' | 'unavailable';
};

// compact 270° ring gauge for instrument tiles (matches prototype RingGauge)
function RingGauge({ v, size = 44, crit }: { v: number; size?: number; crit?: boolean }) {
  const R = 22,
    C = 2 * Math.PI * R,
    span = 0.75,
    fill = C * span * Math.max(0, Math.min(1, v));
  const col = crit ? 'var(--c-red)' : 'var(--accent)';
  return (
    <svg className="inst-ring" width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <g transform="rotate(135 28 28)">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--line-2)" strokeWidth="3" strokeDasharray={`${C * span} ${C}`} opacity="0.3" />
        <circle className="inst-ring-fill" cx="28" cy="28" r={R} fill="none" stroke={col} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${fill} ${C}`} />
      </g>
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (135 + (i / 6) * 270) * (Math.PI / 180);
        return <line key={i} x1={28 + Math.cos(a) * 26} y1={28 + Math.sin(a) * 26} x2={28 + Math.cos(a) * 28} y2={28 + Math.sin(a) * 28} stroke={col} strokeWidth="1" opacity="0.4" />;
      })}
      <circle cx="28" cy="28" r="2.5" fill={col} />
    </svg>
  );
}

export default function FinanceHQ() {
  const { still } = usePoTheme();
  const p = PAGE['finance'] || { label: 'Finance HQ', icon: 'finance', section: 'Business' };

  const [mrr, setMrr] = useState(48200);
  const [arrK, setArrK] = useState<string | null>(null); // real ARR (k) when live
  const [chart, setChart] = useState<number[]>([72, 66, 70, 50, 44, 28, 18, 8]);
  const [feed, setFeed] = useState(() => TX.map((t, i) => ({ t, id: i, fresh: false })));
  const nid = useRef(100);
  const prevCrit = useRef(false);

  // seed the live MRR from the real Stripe endpoint when available
  useEffect(() => {
    let cancelled = false;
    fetch('/api/command-center/stripe-revenue')
      .then((r) => r.json())
      .then((d: StripeRevenue) => {
        if (cancelled) return;
        if (d?.source === 'live' && d.subscriptions && d.subscriptions.mrr > 0) {
          setMrr(Math.round(d.subscriptions.mrr));
          setArrK((d.subscriptions.arr / 1000).toFixed(0));
        }
        // fold real recent charges into the top of the stream
        const real = (d?.recentTransactions || [])
          .filter((t) => t.status === 'succeeded' || t.status === 'paid')
          .slice(0, 4)
          .map((t, i) => ({
            t: [t.description || 'Payment', 'Stripe · live', `+$${Math.round(t.amount).toLocaleString('en-US')}`] as Tx,
            id: 1000 + i,
            fresh: false,
          }));
        if (real.length) setFeed((f) => [...real, ...f].slice(0, 7));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // live drift — gated on reduced-motion AND .po-still
  useEffect(() => {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || still) return;
    const iv = setInterval(() => {
      setMrr((v) => v + Math.round(Math.random() * 180));
      setChart((c) => [...c.slice(1), Math.max(4, c[c.length - 1] + (Math.random() - 0.6) * 10)]);
    }, 1500);
    const feedIv = setInterval(() => {
      const pick = TX_POOL[Math.floor(Math.random() * TX_POOL.length)];
      setFeed((f) => [{ t: pick, id: nid.current++, fresh: true }, ...f.map((x) => ({ ...x, fresh: false }))].slice(0, 7));
      poPlay('blip');
    }, 4200);
    return () => {
      clearInterval(iv);
      clearInterval(feedIv);
    };
  }, [still]);

  const mrrK = (mrr / 1000).toFixed(1);
  const arr = arrK ?? ((mrr * 12) / 1000).toFixed(0);
  const pts = chart.map((v, i) => `${(i / (chart.length - 1)) * 320},${v}`).join(' ');
  const lastX = 320,
    lastY = chart[chart.length - 1];

  // surface a critical reading on the global alert ticker if runway burns down.
  // (presentation: runway gauge fixed; we alert when MRR drops below a floor —
  // here the drift only climbs, so this stays nominal — wired per the contract.)
  const runwayLow = mrr < 30000;
  useEffect(() => {
    const key = 'finance:runway';
    if (runwayLow && !prevCrit.current) {
      poAlertBus.set(key, { label: 'RUNWAY', value: `${mrrK}k MRR`, page: 'finance', pageLabel: p.label, serial: serialFor('finance') });
      poPlay('alert');
    } else if (!runwayLow && prevCrit.current) {
      poAlertBus.clear(key);
    }
    prevCrit.current = runwayLow;
  }, [runwayLow, mrrK, p.label]);
  useEffect(() => () => poAlertBus.clear('finance:runway'), []);

  const tiles: [string, string, number][] = [
    ['Net new MRR', '+$2.7k', 0.62],
    ['New logos', '6', 0.4],
    ['Churn', '1.2%', 0.12],
    ['Runway', '31 mo', 0.78],
  ];

  return (
    <div className="pg po-scroll" style={{ ['--accent' as string]: 'var(--c-gold)' } as CSSProperties}>
      <div className="pg-inner">
        {/* instrument header */}
        <div className="pg-head instrument-head">
          <span className="inst-cnr tl" />
          <span className="inst-cnr tr" />
          <span className="inst-cnr bl" />
          <span className="inst-cnr br" />
          <span className="pg-head-ic">
            <Icon name="finance" size={24} />
            <span className="pg-ic-ring" />
          </span>
          <div className="pg-head-body">
            <div className="pg-head-meta mono">
              <span className="pg-sec">{p.section}</span>
              <span className="pg-sep" />
              <span className="pg-serial">SYS·{serialFor('finance')}</span>
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
              <Icon name="reports" size={15} /> Export
            </button>
          </div>
        </div>

        {/* hero: giant live MRR + area chart with pulsing beacon */}
        <div className="fn-hero po-panel holo-foil">
          <span className="inst-cnr tl" />
          <span className="inst-cnr tr" />
          <span className="inst-cnr bl" />
          <span className="inst-cnr br" />
          <div>
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Monthly recurring revenue{' '}
              <span className="fn-livetag mono">
                <i />
                LIVE
              </span>
            </div>
            <div className="fn-big tnum">${mrrK}k</div>
            <div className="fn-delta">
              {'▲'} 6.0% week-over-week · ${arr}k ARR
            </div>
          </div>
          <svg width="320" height="92" viewBox="0 0 320 92" style={{ flex: 1, minWidth: 0 }}>
            <defs>
              <linearGradient id="fn-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--c-gold)" stopOpacity="0.35" />
                <stop offset="1" stopColor="var(--c-gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="fn-area" d={`M0,${chart[0]} ${chart.map((v, i) => `L${(i / (chart.length - 1)) * 320},${v}`).join(' ')} L320,92 L0,92 Z`} fill="url(#fn-g)" />
            <polyline className="fn-line" points={pts} fill="none" stroke="var(--c-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r="3.5" fill="var(--c-gold)" />
            <circle className="fn-pulse" cx={lastX} cy={lastY} r="3.5" fill="none" stroke="var(--c-gold)" />
          </svg>
        </div>

        {/* four ring-gauge tiles */}
        <div className="fn-tiles">
          {tiles.map(([l, v, a]) => (
            <div key={l} className="fn-tile inst-mod" style={{ minHeight: 0 }}>
              <span className="inst-cnr tl" />
              <span className="inst-cnr tr" />
              <span className="inst-cnr bl" />
              <span className="inst-cnr br" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RingGauge v={a} size={44} />
                <div>
                  <div className="eyebrow">{l}</div>
                  <div className="v tnum" style={{ fontSize: 24 }}>
                    {v}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* transaction stream — new deals flash gold at the top */}
        <section className="po-panel">
          <div className="cv-sec-head">
            <Icon name="finance" size={16} style={{ color: 'var(--accent)' }} />
            <h3>Transaction stream</h3>
            <span className="po-pal-grp">LEDGER · live sync</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {feed.map(({ t, id, fresh }) => (
              <div key={id} className={'fn-row' + (fresh ? ' fn-fresh' : '')}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t[0]}</div>
                  <div style={{ fontSize: 11, color: 'var(--t-lo)', marginTop: 1 }}>{t[1]}</div>
                </div>
                <span className="fn-amt" style={{ color: t[2][0] === '−' ? 'var(--c-rose)' : 'var(--c-green)' }}>
                  {t[2]}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
