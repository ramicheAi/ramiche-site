'use client';

/* ============================================================================
 * QUANT LAB — Finance HQ. Four independent quant research panels stacked
 * below the Trade Journal: STRATEGY LAB (promotion pipeline), CATALYST
 * (earnings-event risk), LINKAGE (cross-asset correlation board), and TRADE
 * QUALITY (signal/exit autopsy + conviction-curve backtest + recommendations).
 *
 * Each sub-panel fetches its own report independently (GET
 * /api/command-center/{strategy-lab,catalyst,linkage,trade-quality}) and owns
 * its own loading/error/unavailable/ok state — one report being absent
 * (e.g. strategy_lab_report.json mid-regeneration) never blocks the other
 * three. Numbers render exactly as returned, no mock/placeholder values;
 * every number is Number.isFinite-guarded before formatting. Each panel ends
 * with its own disclaimer line, rendered verbatim from its payload.
 *
 * Styling reuses the same vocabulary as TradeJournal/QuantPanel (po-panel,
 * inst-cnr, inst-mod, eyebrow, mono, tnum, cv-sec-head, fn-row, po-pal-grp,
 * color vars) — no new CSS added.
 * ========================================================================== */

import { useEffect, useState } from 'react';
import { Icon } from '@/components/command-center/po/Brand';

/* ── Shared helpers ───────────────────────────────────────────────────────── */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function pct(v: unknown, digits = 1): string {
  if (!isNum(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}
function pctPlain(v: unknown, digits = 1): string {
  if (!isNum(v)) return '—';
  return `${v.toFixed(digits)}%`;
}
function num(v: unknown, digits = 2): string {
  if (!isNum(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}
function money(v: unknown, opts: { digits?: number; signed?: boolean } = {}): string {
  if (!isNum(v)) return '—';
  const { digits = 2, signed = false } = opts;
  const sign = signed ? (v > 0 ? '+' : v < 0 ? '-' : '') : v < 0 ? '-' : '';
  const formatted = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${sign}$${formatted}`;
}
function sharpe(v: unknown): string {
  if (!isNum(v)) return '—';
  return v.toFixed(2);
}

function Badge({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span
      className="mono"
      title={title}
      style={{
        fontSize: 8.5,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        color,
        border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  );
}

/* ── Generic fetch-state hook (each sub-panel gets its own instance) ─────── */

type Unavailable = { unavailable: true; message?: string };
type FetchState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ok'; data: T };

function useReport<T>(path: string): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(path, { cache: 'no-store' })
      .then(async (r) => {
        const json = (await r.json()) as T | Unavailable;
        if (cancelled) return;
        if (json && (json as Unavailable).unavailable) {
          setState({
            kind: 'unavailable',
            message: (json as Unavailable).message || 'Not generated yet.',
          });
          return;
        }
        setState({ kind: 'ok', data: json as T });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return state;
}

/* ── Shared sub-panel shell: header + loading/error/unavailable states ──── */

function SubPanel({
  icon,
  title,
  tag,
  state,
  children,
}: {
  icon: string;
  title: string;
  tag: string;
  state: FetchState<unknown>;
  children: React.ReactNode;
}) {
  return (
    <section className="po-panel" aria-label={title}>
      <span className="inst-cnr tl" />
      <span className="inst-cnr tr" />
      <span className="inst-cnr bl" />
      <span className="inst-cnr br" />
      <div className="cv-sec-head">
        <Icon name={icon} size={16} style={{ color: 'var(--accent)' }} />
        <h3>{title}</h3>
        <span className="po-pal-grp">{tag}</span>
      </div>

      {state.kind === 'loading' && (
        <div style={{ padding: '14px 2px', fontSize: 12.5, color: 'var(--t-lo)' }} className="mono">
          Loading…
        </div>
      )}

      {state.kind === 'error' && (
        <div style={{ padding: '14px 2px', fontSize: 12.5, color: 'var(--t-lo)' }}>
          Report unreachable.
          <div className="mono" style={{ fontSize: 11, marginTop: 4, color: 'var(--t-lo)' }}>
            {state.message}
          </div>
        </div>
      )}

      {state.kind === 'unavailable' && (
        <div style={{ padding: '14px 2px' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Not generated yet</div>
          <div style={{ fontSize: 11.5, color: 'var(--t-lo)', marginTop: 4, lineHeight: 1.5 }}>
            {state.message}
          </div>
        </div>
      )}

      {state.kind === 'ok' && children}
    </section>
  );
}

function Disclaimer({ text }: { text?: string }) {
  if (!text) return null;
  return (
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
      {text}
    </div>
  );
}

/* ============================================================================
 * STRATEGY LAB
 * ========================================================================== */

type ClosestCandidate = { name?: string; oos_sharpe?: number; deflated_sharpe?: number };

type StrategyLabReport = {
  cycle?: string | number;
  verdict?: string;
  promoted?: string[];
  retired?: string[];
  candidates_count?: number;
  closest_to_promotion?: ClosestCandidate[];
  eli5?: string;
  disclaimer?: string;
};

function StrategyLabBody({ data }: { data: StrategyLabReport }) {
  const promoted = Array.isArray(data.promoted) ? data.promoted : [];
  const retired = Array.isArray(data.retired) ? data.retired : [];
  const closest = Array.isArray(data.closest_to_promotion) ? data.closest_to_promotion : [];

  return (
    <div style={{ padding: '4px 0' }}>
      {data.verdict && (
        <p style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, margin: '2px 0 0', color: 'var(--t-hi)' }}>
          {data.verdict}
        </p>
      )}
      {data.eli5 && (
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--t-mid)', margin: '6px 0 0' }}>{data.eli5}</p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Badge label={`Promoted · ${promoted.length}`} color="var(--c-green)" />
        <Badge label={`Retired · ${retired.length}`} color="var(--c-rose)" />
        <Badge label={`Candidates · ${isNum(data.candidates_count) ? data.candidates_count : '—'}`} color="var(--t-lo)" />
      </div>

      {(promoted.length > 0 || retired.length > 0) && (
        <div className="mono" style={{ marginTop: 10, fontSize: 11, color: 'var(--t-lo)', lineHeight: 1.6 }}>
          {promoted.length > 0 && (
            <div>
              <span style={{ color: 'var(--c-green)' }}>Promoted:</span> {promoted.join(', ')}
            </div>
          )}
          {retired.length > 0 && (
            <div>
              <span style={{ color: 'var(--c-rose)' }}>Retired:</span> {retired.join(', ')}
            </div>
          )}
        </div>
      )}

      {closest.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>
            Closest to promotion
          </div>
          <div style={{ padding: '2px 0' }}>
            {closest.map((c, i) => (
              <div key={`${c.name ?? 'cand'}-${i}`} className="fn-row">
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name ?? '—'}</div>
                <div className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--t-lo)' }}>
                  deflated sharpe
                  <div className="tnum" style={{ fontSize: 14, color: 'var(--t-hi)', marginTop: 1 }}>
                    {sharpe(c.deflated_sharpe)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Disclaimer text={data.disclaimer} />
    </div>
  );
}

/* ============================================================================
 * CATALYST
 * ========================================================================== */

type EventStudy = {
  avg_abs_move_pct?: number;
  max_abs_move_pct?: number;
  pct_gapped_past_stop?: number;
};

type EarningsRow = {
  ticker?: string;
  next_earnings?: string;
  days_to_earnings?: number;
  event_study?: EventStudy;
};

type CatalystReport = {
  generated?: string;
  macro_proximity?: string[];
  news_feed?: { status?: string; note?: string };
  earnings_in_next_21d?: EarningsRow[];
  eli5?: string;
  disclaimer?: string;
};

const GAP_WARN_THRESHOLD = 30;

function CatalystBody({ data }: { data: CatalystReport }) {
  const rows = Array.isArray(data.earnings_in_next_21d) ? data.earnings_in_next_21d : [];
  const macroFlags = Array.isArray(data.macro_proximity) ? data.macro_proximity : [];

  return (
    <div style={{ padding: '4px 0' }}>
      {data.eli5 && (
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--t-hi)', margin: '2px 0 0' }}>{data.eli5}</p>
      )}

      {macroFlags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {macroFlags.map((f, i) => (
            <Badge key={i} label={f} color="var(--c-amber)" />
          ))}
        </div>
      )}

      {data.news_feed?.status && (
        <div className="mono" style={{ marginTop: 10, fontSize: 11, color: 'var(--t-lo)' }}>
          News feed:{' '}
          <span style={{ color: data.news_feed.status === 'available' ? 'var(--c-green)' : 'var(--t-lo)' }}>
            {data.news_feed.status}
          </span>
          {data.news_feed.note && <span> · {data.news_feed.note}</span>}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>
            Earnings in next 21 days
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 520 }}>
              <div
                className="mono"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  gap: 8,
                  fontSize: 10,
                  color: 'var(--t-lo)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '4px 4px',
                  borderBottom: '1px solid var(--line-2)',
                }}
              >
                <span>Ticker</span>
                <span>Days to earnings</span>
                <span>Avg abs move</span>
                <span>Gapped past stop</span>
              </div>
              {rows.map((r, i) => {
                const gap = r.event_study?.pct_gapped_past_stop;
                const warn = isNum(gap) && gap >= GAP_WARN_THRESHOLD;
                return (
                  <div key={`${r.ticker ?? 'row'}-${i}`}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 1fr',
                        gap: 8,
                        alignItems: 'center',
                        padding: '8px 4px',
                        borderBottom: '1px solid var(--line)',
                        background: warn ? 'color-mix(in oklab, var(--c-amber) 10%, transparent)' : 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{r.ticker ?? '—'}</span>
                      <span className="tnum mono" style={{ fontSize: 12, color: 'var(--t-hi)' }}>
                        {isNum(r.days_to_earnings) ? `${r.days_to_earnings}d` : '—'}
                      </span>
                      <span className="tnum mono" style={{ fontSize: 12, color: 'var(--t-hi)' }}>
                        {pctPlain(r.event_study?.avg_abs_move_pct)}
                      </span>
                      <span
                        className="tnum mono"
                        style={{ fontSize: 12, color: warn ? 'var(--c-amber)' : 'var(--t-hi)', fontWeight: warn ? 600 : 400 }}
                      >
                        {pctPlain(gap)}
                      </span>
                    </div>
                    {warn && (
                      <div
                        className="mono"
                        style={{ fontSize: 10, color: 'var(--c-amber)', padding: '2px 4px 8px', letterSpacing: '0.02em' }}
                      >
                        ⚠ size down into earnings — historically gaps past the stop {pctPlain(gap)} of the time
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Disclaimer text={data.disclaimer} />
    </div>
  );
}

/* ============================================================================
 * LINKAGE
 * ========================================================================== */

type DriverPush = { asset?: string; corr?: number; direction?: string };
type Driver = { pushes?: DriverPush[]; leads_sp500_next_day_corr?: number };

type LinkageReport = {
  generated?: string;
  window_days?: number;
  macro_quad_proxy?: string;
  correlation_matrix?: Record<string, Record<string, number>>;
  drivers?: Record<string, Driver>;
  eli5?: string;
  disclaimer?: string;
};

function corrCellStyle(v: unknown): React.CSSProperties {
  if (!isNum(v)) {
    return { color: 'var(--t-lo)' };
  }
  const intensity = Math.min(85, Math.round(Math.abs(v) * 85));
  const color = v >= 0 ? 'var(--c-green)' : 'var(--c-rose)';
  return {
    background: `color-mix(in oklab, ${color} ${intensity}%, transparent)`,
    color: intensity > 40 ? 'var(--t-hi)' : 'var(--t-mid)',
  };
}

function LinkageBody({ data }: { data: LinkageReport }) {
  const matrix = data.correlation_matrix && typeof data.correlation_matrix === 'object' ? data.correlation_matrix : null;
  const labels = matrix ? Object.keys(matrix) : [];
  const drivers = data.drivers && typeof data.drivers === 'object' ? data.drivers : {};
  const driverNames = Object.keys(drivers);

  return (
    <div style={{ padding: '4px 0' }}>
      {data.macro_quad_proxy && (
        <div
          className="inst-mod"
          style={{ padding: '10px 12px', minHeight: 0, marginBottom: 12, display: 'inline-block' }}
        >
          <span className="inst-cnr tl" />
          <span className="inst-cnr tr" />
          <span className="inst-cnr bl" />
          <span className="inst-cnr br" />
          <div className="eyebrow">Macro quad proxy</div>
          <div style={{ fontSize: 16, marginTop: 2, color: 'var(--t-hi)', fontWeight: 500 }}>
            {data.macro_quad_proxy}
          </div>
        </div>
      )}

      {data.eli5 && (
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--t-mid)', margin: '2px 0 0' }}>{data.eli5}</p>
      )}

      {driverNames.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>
            Drivers
          </div>
          <div style={{ padding: '2px 0' }}>
            {driverNames.map((name) => {
              const d = drivers[name];
              const pushes = Array.isArray(d?.pushes) ? d.pushes : [];
              return (
                <div key={name} className="fn-row" style={{ alignItems: 'flex-start', whiteSpace: 'normal' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-hi)' }}>{name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                      {pushes.map((p, i) => (
                        <div key={i} className="mono" style={{ fontSize: 11, color: 'var(--t-lo)' }}>
                          {name} → {p.asset ?? '—'}{' '}
                          <span style={{ color: isNum(p.corr) && p.corr >= 0 ? 'var(--c-green)' : 'var(--c-rose)' }}>
                            ({num(p.corr, 2)}, {p.direction ?? '—'})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {isNum(d?.leads_sp500_next_day_corr) && (
                    <div className="mono" style={{ textAlign: 'right', fontSize: 10.5, color: 'var(--t-lo)' }}>
                      leads S&amp;P +1d
                      <div className="tnum" style={{ fontSize: 13, color: 'var(--t-hi)', marginTop: 1 }}>
                        {num(d.leads_sp500_next_day_corr, 2)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {matrix && labels.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>
            Correlation matrix{isNum(data.window_days) ? ` · ${data.window_days}d window` : ''}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table
              className="mono tnum"
              style={{ borderCollapse: 'collapse', fontSize: 10.5, minWidth: labels.length * 58 + 90 }}
            >
              <thead>
                <tr>
                  <th style={{ padding: '4px 6px', textAlign: 'left', color: 'var(--t-lo)' }} />
                  {labels.map((l) => (
                    <th key={l} style={{ padding: '4px 6px', color: 'var(--t-lo)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.map((rowLabel) => (
                  <tr key={rowLabel}>
                    <td style={{ padding: '4px 6px', color: 'var(--t-lo)', whiteSpace: 'nowrap' }}>{rowLabel}</td>
                    {labels.map((colLabel) => {
                      const v = matrix[rowLabel]?.[colLabel];
                      return (
                        <td
                          key={colLabel}
                          style={{
                            padding: '4px 6px',
                            textAlign: 'center',
                            borderRadius: 3,
                            ...corrCellStyle(v),
                          }}
                        >
                          {num(v, 2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Disclaimer text={data.disclaimer} />
    </div>
  );
}

/* ============================================================================
 * TRADE QUALITY
 * ========================================================================== */

type SignalBucket = { n?: number; win_pct?: number; expectancy_per_trade?: number };
type ConvictionCurve = { total_return_pct?: number; sharpe?: number };
type Recommendation = { lever?: string; evidence?: string; change?: string; status?: string };

type TradeQualityReport = {
  autopsy?: {
    by_signal_strength?: Record<string, SignalBucket>;
    by_exit_rule?: Record<string, { n?: number; win_pct?: number; total_pnl?: number; expectancy_per_trade?: number }>;
  };
  conviction_curve_backtest?: Record<string, ConvictionCurve>;
  recommendations?: Recommendation[];
  eli5?: string;
  disclaimer?: string;
};

function statusBadge(status?: string) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes('testable-now') || s === 'testable-now') {
    return <Badge label={status} color="var(--c-green)" />;
  }
  if (s.startsWith('forward-test')) {
    return <Badge label={status} color="var(--c-amber)" />;
  }
  return <Badge label={status} color="var(--t-lo)" />;
}

// Preferred display order for signal-strength buckets when present.
const SIGNAL_BUCKET_ORDER = ['weak(<20)', 'mid(20-30)', 'extreme(30+)'];

function TradeQualityBody({ data }: { data: TradeQualityReport }) {
  const bySignal = data.autopsy?.by_signal_strength && typeof data.autopsy.by_signal_strength === 'object'
    ? data.autopsy.by_signal_strength
    : {};
  const signalKeys = Object.keys(bySignal).sort((a, b) => {
    const ia = SIGNAL_BUCKET_ORDER.indexOf(a);
    const ib = SIGNAL_BUCKET_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const curves = data.conviction_curve_backtest && typeof data.conviction_curve_backtest === 'object'
    ? data.conviction_curve_backtest
    : {};
  const curveNames = Object.keys(curves);

  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];

  return (
    <div style={{ padding: '4px 0' }}>
      {data.eli5 && (
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--t-hi)', margin: '2px 0 0' }}>{data.eli5}</p>
      )}

      {signalKeys.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>
            Expectancy by signal strength
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
            }}
          >
            {signalKeys.map((k) => {
              const b = bySignal[k];
              const exp = b?.expectancy_per_trade;
              return (
                <div key={k} className="inst-mod" style={{ padding: '10px 12px', minHeight: 0 }}>
                  <span className="inst-cnr tl" />
                  <span className="inst-cnr tr" />
                  <span className="inst-cnr bl" />
                  <span className="inst-cnr br" />
                  <div className="eyebrow">{k}</div>
                  <div className="tnum" style={{ fontSize: 18, marginTop: 2, color: isNum(exp) && exp >= 0 ? 'var(--c-green)' : 'var(--c-rose)' }}>
                    {money(exp, { signed: true })}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--t-lo)', marginTop: 2 }}>
                    {pctPlain(b?.win_pct)} win · n={isNum(b?.n) ? b.n : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {curveNames.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>
            Conviction curve backtest
          </div>
          <div style={{ padding: '2px 0' }}>
            {curveNames.map((name) => {
              const c = curves[name];
              return (
                <div key={name} className="fn-row">
                  <div style={{ fontSize: 12.5 }}>{name}</div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--t-lo)' }}>
                    <span style={{ color: isNum(c?.total_return_pct) && c.total_return_pct >= 0 ? 'var(--c-green)' : 'var(--c-rose)' }}>
                      {pct(c?.total_return_pct)}
                    </span>
                    <span style={{ marginLeft: 8 }}>sharpe {sharpe(c?.sharpe)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {recs.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>
            Recommendations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map((r, i) => (
              <div key={i} style={{ padding: '10px 4px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-hi)' }}>{r.lever ?? '—'}</span>
                  {statusBadge(r.status)}
                </div>
                {r.evidence && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--t-lo)', marginTop: 4, lineHeight: 1.5 }}>
                    {r.evidence}
                  </div>
                )}
                {r.change && (
                  <div style={{ fontSize: 12, color: 'var(--t-mid)', marginTop: 4, lineHeight: 1.5 }}>{r.change}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Disclaimer text={data.disclaimer} />
    </div>
  );
}

/* ============================================================================
 * QUANT LAB — assembled
 * ========================================================================== */

export default function QuantLab() {
  const strategyLab = useReport<StrategyLabReport>('/api/command-center/strategy-lab');
  const catalyst = useReport<CatalystReport>('/api/command-center/catalyst');
  const linkage = useReport<LinkageReport>('/api/command-center/linkage');
  const tradeQuality = useReport<TradeQualityReport>('/api/command-center/trade-quality');

  return (
    <>
      <SubPanel icon="strategy" title="Strategy Lab" tag="promotion pipeline" state={strategyLab}>
        {strategyLab.kind === 'ok' && <StrategyLabBody data={strategyLab.data} />}
      </SubPanel>

      <SubPanel icon="bolt" title="Catalyst" tag="earnings risk" state={catalyst}>
        {catalyst.kind === 'ok' && <CatalystBody data={catalyst.data} />}
      </SubPanel>

      <SubPanel icon="nexus" title="Linkage" tag="cross-asset board" state={linkage}>
        {linkage.kind === 'ok' && <LinkageBody data={linkage.data} />}
      </SubPanel>

      <SubPanel icon="health" title="Trade Quality" tag="autopsy · tuner" state={tradeQuality}>
        {tradeQuality.kind === 'ok' && <TradeQualityBody data={tradeQuality.data} />}
      </SubPanel>
    </>
  );
}
