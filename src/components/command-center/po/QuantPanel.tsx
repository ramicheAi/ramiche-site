'use client';

/* ============================================================================
 * QUANT / SIMONS panel — Finance HQ.
 *
 * Fetches the SIMONS quant snapshot from GET /api/command-center/meridian and
 * renders it HONESTLY: the numbers exactly as returned, no mock/placeholder
 * values, no drift. Handles the {unavailable:true} response and the
 * re-baselined empty-book case ($100k flat, no positions) with a clear
 * "no data yet" / "flat book" state. Paper-trading disclaimer always shown.
 *
 * Styling reuses the same vocabulary as FinanceHQ (po-panel, inst-cnr,
 * eyebrow, mono, tnum, cv-sec-head, fn-row, color vars).
 * ========================================================================== */

import { useEffect, useState } from 'react';
import { Icon } from '@/components/command-center/po/Brand';

/* ── Snapshot shape (only the fields we read; everything optional/honest) ── */

type Position = {
  ticker?: string;
  shares?: number;
  direction?: string;
  entry_price?: number;
  entry_date?: string;
  last_score?: number;
};

type Signal = {
  ticker?: string;
  action?: string;
  composite_score?: number;
  confidence?: number;
  price?: number;
};

type MeridianSnapshot = {
  generated_at?: string;
  disclaimer?: string;
  portfolio?: {
    equity?: number;
    capital?: number;
    cash?: number;
    total_return_pct?: number;
    positions?: Position[];
    position_count?: number;
    long_count?: number;
    short_count?: number;
    win_rate?: number;
    trade_count?: number;
    total_realized_pnl?: number;
  };
  signals?: Signal[];
  regime_transitions?: { portfolio_summary?: { dominant_regime?: string } };
  market_timing?: { regime?: string };
};

type Unavailable = { unavailable: true; message?: string };

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ok'; data: MeridianSnapshot };

/* ── Formatters (defensive — only format real numbers) ──────────────────── */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function money(v: unknown, digits = 0): string {
  if (!isNum(v)) return '—';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
function pct(v: unknown): string {
  if (!isNum(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}
function num(v: unknown, digits = 2): string {
  if (!isNum(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

const DISCLAIMER = 'Paper trading — research only, not investment advice.';

/* ── Component ───────────────────────────────────────────────────────────── */

export default function QuantPanel() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/command-center/meridian', { cache: 'no-store' })
      .then(async (r) => {
        const json = (await r.json()) as MeridianSnapshot | Unavailable;
        if (cancelled) return;
        if (json && (json as Unavailable).unavailable) {
          setState({
            kind: 'unavailable',
            message:
              (json as Unavailable).message ||
              'No quant snapshot on this host yet.',
          });
          return;
        }
        setState({ kind: 'ok', data: json as MeridianSnapshot });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="po-panel" aria-label="Quant / Simons">
      <span className="inst-cnr tl" />
      <span className="inst-cnr tr" />
      <span className="inst-cnr bl" />
      <span className="inst-cnr br" />
      <div className="cv-sec-head">
        <Icon name="finance" size={16} style={{ color: 'var(--accent)' }} />
        <h3>Quant · Simons</h3>
        <span className="po-pal-grp">MERIDIAN · paper</span>
      </div>

      {state.kind === 'loading' && (
        <div style={{ padding: '14px 2px', fontSize: 12.5, color: 'var(--t-lo)' }} className="mono">
          Loading quant snapshot…
        </div>
      )}

      {state.kind === 'error' && (
        <div style={{ padding: '14px 2px', fontSize: 12.5, color: 'var(--t-lo)' }}>
          Quant feed unreachable.
          <div className="mono" style={{ fontSize: 11, marginTop: 4, color: 'var(--t-lo)' }}>
            {state.message}
          </div>
        </div>
      )}

      {state.kind === 'unavailable' && (
        <div style={{ padding: '14px 2px' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>No quant data yet</div>
          <div style={{ fontSize: 11.5, color: 'var(--t-lo)', marginTop: 4, lineHeight: 1.5 }}>
            {state.message}
          </div>
        </div>
      )}

      {state.kind === 'ok' && <QuantBody data={state.data} />}

      <div
        className="mono"
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--line-2)',
          fontSize: 10.5,
          color: 'var(--t-lo)',
          letterSpacing: '0.02em',
        }}
      >
        {DISCLAIMER}
      </div>
    </section>
  );
}

/* ── Body (only rendered when we have a snapshot) ────────────────────────── */

function QuantBody({ data }: { data: MeridianSnapshot }) {
  const pf = data.portfolio ?? {};
  const positions = Array.isArray(pf.positions) ? pf.positions : [];
  const signals = Array.isArray(data.signals) ? data.signals : [];
  const regime =
    data.regime_transitions?.portfolio_summary?.dominant_regime ??
    data.market_timing?.regime ??
    null;

  const ret = pf.total_return_pct;
  const retColor = !isNum(ret) ? 'var(--t-lo)' : ret >= 0 ? 'var(--c-green)' : 'var(--c-rose)';

  // Re-baselined / flat-book case: no open positions. Render cleanly, don't
  // pretend there's activity.
  const flatBook = positions.length === 0;

  const stats: [string, string, string?][] = [
    ['Equity', money(pf.equity, 0)],
    ['Total return', pct(ret), retColor],
    ['Cash', money(pf.cash, 0)],
    ['Capital base', money(pf.capital, 0)],
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      {/* headline stat row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          marginBottom: 12,
        }}
      >
        {stats.map(([label, value, color]) => (
          <div
            key={label}
            className="inst-mod"
            style={{ padding: '10px 12px', minHeight: 0 }}
          >
            <span className="inst-cnr tl" />
            <span className="inst-cnr tr" />
            <span className="inst-cnr bl" />
            <span className="inst-cnr br" />
            <div className="eyebrow">{label}</div>
            <div className="tnum" style={{ fontSize: 20, marginTop: 2, color: color ?? 'var(--t-hi)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* meta line: regime + book composition + win rate */}
      <div
        className="mono"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          fontSize: 11,
          color: 'var(--t-lo)',
          marginBottom: 12,
        }}
      >
        {regime && (
          <span>
            Regime: <span style={{ color: 'var(--t-hi)' }}>{regime}</span>
          </span>
        )}
        <span>
          Positions:{' '}
          <span style={{ color: 'var(--t-hi)' }}>
            {isNum(pf.position_count) ? pf.position_count : positions.length}
          </span>
          {(isNum(pf.long_count) || isNum(pf.short_count)) && (
            <>
              {' '}
              ({num(pf.long_count, 0)} long / {num(pf.short_count, 0)} short)
            </>
          )}
        </span>
        {isNum(pf.win_rate) && (
          <span>
            Win rate: <span style={{ color: 'var(--t-hi)' }}>{pf.win_rate.toFixed(0)}%</span>
            {isNum(pf.trade_count) && <> · {pf.trade_count} trades</>}
          </span>
        )}
        {isNum(pf.total_realized_pnl) && (
          <span>
            Realized P&amp;L:{' '}
            <span style={{ color: pf.total_realized_pnl >= 0 ? 'var(--c-green)' : 'var(--c-rose)' }}>
              {money(pf.total_realized_pnl, 0)}
            </span>
          </span>
        )}
      </div>

      {/* open positions */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        Open positions
      </div>
      {flatBook ? (
        <div
          style={{
            fontSize: 12,
            color: 'var(--t-lo)',
            padding: '8px 2px 4px',
            lineHeight: 1.5,
          }}
        >
          Flat book — no open positions. {isNum(pf.equity) && isNum(pf.capital) && Math.abs((pf.equity ?? 0) - (pf.capital ?? 0)) < 1
            ? 'Account re-baselined to its starting capital.'
            : 'All capital currently in cash.'}
        </div>
      ) : (
        <div style={{ padding: '2px 0' }}>
          {positions.map((p, i) => (
            <div key={`${p.ticker ?? 'pos'}-${i}`} className="fn-row">
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  {p.ticker ?? '—'}
                  {p.direction && (
                    <span
                      className="mono"
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        color: p.direction === 'short' ? 'var(--c-rose)' : 'var(--c-green)',
                      }}
                    >
                      {p.direction}
                    </span>
                  )}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--t-lo)', marginTop: 1 }}>
                  {num(p.shares, 4)} sh @ {money(p.entry_price, 2)}
                </div>
              </div>
              <div className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--t-lo)' }}>
                score
                <div className="tnum" style={{ fontSize: 14, color: 'var(--t-hi)', marginTop: 1 }}>
                  {num(p.last_score, 1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* top signals (if present) */}
      {signals.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '12px 0 6px' }}>
            Top signals
          </div>
          <div style={{ padding: '2px 0' }}>
            {signals.slice(0, 5).map((s, i) => {
              const actColor =
                s.action === 'BUY'
                  ? 'var(--c-green)'
                  : s.action === 'SELL' || s.action === 'SHORT'
                    ? 'var(--c-rose)'
                    : 'var(--t-lo)';
              return (
                <div key={`${s.ticker ?? 'sig'}-${i}`} className="fn-row">
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {s.ticker ?? '—'}
                      {s.action && (
                        <span
                          className="mono"
                          style={{ marginLeft: 8, fontSize: 10, textTransform: 'uppercase', color: actColor }}
                        >
                          {s.action}
                        </span>
                      )}
                    </div>
                    {isNum(s.confidence) && (
                      <div className="mono" style={{ fontSize: 11, color: 'var(--t-lo)', marginTop: 1 }}>
                        {s.confidence.toFixed(0)}% confidence
                        {isNum(s.price) && <> · {money(s.price, 2)}</>}
                      </div>
                    )}
                  </div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--t-lo)' }}>
                    score
                    <div className="tnum" style={{ fontSize: 14, color: 'var(--t-hi)', marginTop: 1 }}>
                      {num(s.composite_score, 1)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* freshness */}
      {data.generated_at && (
        <div className="mono" style={{ marginTop: 10, fontSize: 10.5, color: 'var(--t-lo)' }}>
          Snapshot {data.generated_at}
        </div>
      )}
    </div>
  );
}
