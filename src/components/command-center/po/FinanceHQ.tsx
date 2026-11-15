'use client';

/* ============================================================================
 * PARALLAX OS — FINANCE HQ (showpiece #5). Ported from prototype/po-pages.jsx
 * `FinancePage`. Instrument header, a giant MRR figure, an area chart with a
 * pulsing beacon, four ring-gauge tiles, and a transaction stream.
 *
 * TRUTH RULES (they are not negotiable; see src/lib/finance-truth.ts)
 * - No revenue figure is rendered unless it was measured. Unmeasured renders as
 *   an em dash, never as a plausible looking number.
 * - A genuine $0 from Stripe renders as $0. It is never replaced by a seed.
 * - Nothing is added to a measured figure. There is no drift, no jitter, no
 *   "presentation only" arithmetic on money.
 * - No trend line is drawn unless a real series exists. The revenue endpoint
 *   returns a point, not a history, so in LIVE mode there is no sparkline.
 * - Demo data is reachable only via an explicit `?demo=1`, and whenever it is
 *   shown the screen says DEMO and states that the figures are not real.
 * - The status chip is derived from the data source, so the screen cannot say
 *   LIVE while showing a fallback.
 * ========================================================================== */

import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '@/components/command-center/po/Brand';
import QuantPanel from '@/components/command-center/po/QuantPanel';
import { PAGE } from '@/lib/po-data';
import { poPlay } from '@/lib/po-sound';
import {
  DEMO_STATE,
  INITIAL_STATE,
  formatArrK,
  formatUsdCompact,
  isDemoRequested,
  resolveFinanceState,
  sourceBadge,
  type FinanceState,
  type StripeRevenuePayload,
} from '@/lib/finance-truth';

// deterministic serial code per page (matches prototype serialFor)
function serialFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = (h % 9) + 1,
    b = ((h >> 4) % 900) + 100,
    c = ((h >> 8) % 9000) + 1000;
  return `${String(a).padStart(2, '0')}A${b}·${c}`;
}

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
  const p = PAGE['finance'] || { label: 'Finance HQ', icon: 'finance', section: 'Business' };

  const [fin, setFin] = useState<FinanceState>(INITIAL_STATE);

  // Read the revenue endpoint once. `?demo=1` short-circuits to the labelled demo state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isDemoRequested(window.location.search)) {
        if (!cancelled) setFin(DEMO_STATE);
        return;
      }
      try {
        const response = await fetch('/api/command-center/stripe-revenue');
        const payload = (await response.json()) as StripeRevenuePayload;
        if (!cancelled) setFin(resolveFinanceState(payload, false));
      } catch {
        if (!cancelled) setFin(resolveFinanceState(null, false));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const badge = sourceBadge(fin);
  const isLive = fin.source === 'live';
  const isDemo = fin.source === 'demo';
  const chart = fin.chart;
  const pts = chart ? chart.map((v, i) => `${(i / (chart.length - 1)) * 320},${v}`).join(' ') : '';
  const lastY = chart ? chart[chart.length - 1] : 0;

  // Only measured metrics are given a value. The rest are explicitly unknown.
  const tiles: [string, string, number | null][] = [
    ['Active subscriptions', fin.activeSubscriptions === null ? '—' : String(fin.activeSubscriptions), null],
    ['Net new MRR', '—', null],
    ['Churn', '—', null],
    ['Runway', '—', null],
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
              <span className="pg-live" data-tone={badge.tone} title={`Revenue source: ${badge.label}`}>
                <i />
                {badge.label}
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

        {isDemo && (
          <div className="po-panel" role="status" style={{ padding: '10px 14px', borderColor: 'var(--c-gold)' }}>
            <strong>DEMO DATA.</strong> These figures are a design sample requested with{' '}
            <code>?demo=1</code>. They are not real revenue.
          </div>
        )}

        {/* hero: MRR, measured or explicitly unknown */}
        <div className="fn-hero po-panel holo-foil">
          <span className="inst-cnr tl" />
          <span className="inst-cnr tr" />
          <span className="inst-cnr bl" />
          <span className="inst-cnr br" />
          <div>
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Monthly recurring revenue{' '}
              <span className="fn-livetag mono" data-tone={badge.tone}>
                <i />
                {badge.label}
              </span>
            </div>
            <div className="fn-big tnum">{formatUsdCompact(fin.mrr)}</div>
            <div className="fn-delta">
              {isLive && <>{'▲'} measured from Stripe · ${formatArrK(fin.arr)} ARR</>}
              {isDemo && <>sample series · ${formatArrK(fin.arr)} ARR</>}
              {!isLive && !isDemo && (fin.reason || 'No measured revenue available.')}
            </div>
          </div>
          {chart ? (
            <svg width="320" height="92" viewBox="0 0 320 92" style={{ flex: 1, minWidth: 0 }}>
              <defs>
                <linearGradient id="fn-g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--c-gold)" stopOpacity="0.35" />
                  <stop offset="1" stopColor="var(--c-gold)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="fn-area" d={`M0,${chart[0]} ${chart.map((v, i) => `L${(i / (chart.length - 1)) * 320},${v}`).join(' ')} L320,92 L0,92 Z`} fill="url(#fn-g)" />
              <polyline className="fn-line" points={pts} fill="none" stroke="var(--c-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={320} cy={lastY} r="3.5" fill="var(--c-gold)" />
              <circle className="fn-pulse" cx={320} cy={lastY} r="3.5" fill="none" stroke="var(--c-gold)" />
            </svg>
          ) : (
            <div
              className="mono"
              style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--t-lo)', alignSelf: 'center' }}
              title="The revenue endpoint returns a single figure, not a time series."
            >
              No revenue history available. No trend line is drawn.
            </div>
          )}
        </div>

        {/* four ring-gauge tiles: measured values only */}
        <div className="fn-tiles">
          {tiles.map(([l, v, a]) => (
            <div key={l} className="fn-tile inst-mod" style={{ minHeight: 0 }}>
              <span className="inst-cnr tl" />
              <span className="inst-cnr tr" />
              <span className="inst-cnr bl" />
              <span className="inst-cnr br" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {a === null ? <span className="mono" style={{ width: 44, textAlign: 'center', color: 'var(--t-lo)' }}>—</span> : <RingGauge v={a} size={44} />}
                <div>
                  <div className="eyebrow">{l}</div>
                  <div className="v tnum" style={{ fontSize: 24 }}>
                    {v}
                  </div>
                  {a === null && <div className="mono" style={{ fontSize: 10, color: 'var(--t-lo)' }}>not measured</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* transaction stream — real rows only */}
        <section className="po-panel">
          <div className="cv-sec-head">
            <Icon name="finance" size={16} style={{ color: 'var(--accent)' }} />
            <h3>Transaction stream</h3>
            <span className="po-pal-grp">{isLive ? 'LEDGER · live sync' : isDemo ? 'LEDGER · demo' : 'LEDGER · no live source'}</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {fin.transactions.length === 0 && (
              <div className="mono" style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--t-lo)' }}>
                {isLive ? 'No settled transactions were returned by Stripe.' : 'No transaction data available.'}
              </div>
            )}
            {fin.transactions.map((t) => (
              <div key={t.id} className="fn-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t-lo)', marginTop: 1 }}>{t.plan}</div>
                </div>
                <span className="fn-amt" style={{ color: t.amount.startsWith('−') ? 'var(--c-rose)' : 'var(--c-green)' }}>
                  {t.amount}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* quant / Simons — real MERIDIAN snapshot (honest, no mock data) */}
        <QuantPanel />
      </div>
    </div>
  );
}
