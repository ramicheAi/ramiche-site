'use client';

/* ============================================================================
 * TRADE JOURNAL — Finance HQ. Simons' ELI5 paper-trade journal.
 *
 * Fetches the reconciled round-trip trade ledger from
 * GET /api/command-center/trades and renders it HONESTLY: the numbers exactly
 * as returned, no mock/placeholder values, no drift. Handles the
 * {unavailable:true} response and the zero-trades case with a clean
 * "no journal yet" state. Paper-trading disclaimer rendered verbatim from
 * the payload. Every number is Number.isFinite-guarded before formatting.
 *
 * Styling reuses the same vocabulary as QuantPanel/FinanceHQ (po-panel,
 * inst-cnr, inst-mod, cv-sec-head, eyebrow, mono, tnum, po-pal-grp, fn-row,
 * cm-tab/ag-filter, color vars) — no new CSS added.
 * ========================================================================== */

import { useEffect, useState } from 'react';
import { Icon } from '@/components/command-center/po/Brand';

/* ── Ledger shape (only the fields we read; everything optional/honest) ──── */

type TradeOutcome = 'WIN' | 'LOSS' | 'FLAT';
type TradeEra = 'bug-era' | 'honest';

type OpenPosition = {
  ticker?: string;
  direction?: string;
  shares?: number;
  entry_price?: number;
  entry_date?: string;
  entry_score?: number;
  eli5?: string;
};

type Trade = {
  ticker?: string;
  direction?: string;
  era?: TradeEra;
  era_note?: string;
  entry_date?: string;
  exit_date?: string;
  held_days?: number;
  shares?: number;
  entry_price?: number;
  exit_price?: number;
  pnl?: number;
  return_pct?: number;
  outcome?: TradeOutcome;
  exit_rule?: string | null;
  exit_reason?: string | null;
  entry_score?: number;
  pnl_reconciled?: boolean;
  eli5_entry?: string;
  eli5_exit?: string;
  eli5_lesson?: string;
};

type Summary = {
  round_trips?: number;
  wins?: number;
  losses?: number;
  win_rate_pct?: number;
  total_pnl?: number;
  avg_win?: number;
  avg_loss?: number;
  profit_factor?: number;
  avg_held_days?: number;
  eli5?: string;
  honesty_note?: string;
};

type TradeLedger = {
  generated?: string;
  summary?: Summary;
  open_positions?: OpenPosition[];
  trades?: Trade[];
  disclaimer?: string;
};

type Unavailable = { unavailable: true; message?: string };

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ok'; data: TradeLedger };

/* ── Formatters (defensive — only format real numbers) ──────────────────── */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

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
function pct(v: unknown, digits = 2): string {
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
function factor(v: unknown): string {
  if (!isNum(v)) return '—';
  return `${v.toFixed(2)}x`;
}
function heldDays(v: unknown): string {
  if (!isNum(v)) return '—';
  return `${num(v, 1)}d`;
}
function pnlColor(v: unknown): string {
  if (!isNum(v)) return 'var(--t-lo)';
  return v >= 0 ? 'var(--c-green)' : 'var(--c-rose)';
}

/* ── Small pill badge (mirrors the .ab-bbadge/.ab-dbadge vocabulary) ────── */

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

/* ── Component ───────────────────────────────────────────────────────────── */

export default function TradeJournal() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/command-center/trades', { cache: 'no-store' })
      .then(async (r) => {
        const json = (await r.json()) as TradeLedger | Unavailable;
        if (cancelled) return;
        if (json && (json as Unavailable).unavailable) {
          setState({
            kind: 'unavailable',
            message: (json as Unavailable).message || 'No trade journal on this host yet.',
          });
          return;
        }
        setState({ kind: 'ok', data: json as TradeLedger });
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
    <section className="po-panel" aria-label="Trade journal">
      <span className="inst-cnr tl" />
      <span className="inst-cnr tr" />
      <span className="inst-cnr bl" />
      <span className="inst-cnr br" />
      <div className="cv-sec-head">
        <Icon name="reports" size={16} style={{ color: 'var(--accent)' }} />
        <h3>Trade Journal · Simons</h3>
        <span className="po-pal-grp">ELI5 · paper</span>
      </div>

      {state.kind === 'loading' && (
        <div style={{ padding: '14px 2px', fontSize: 12.5, color: 'var(--t-lo)' }} className="mono">
          Loading trade journal…
        </div>
      )}

      {state.kind === 'error' && (
        <div style={{ padding: '14px 2px', fontSize: 12.5, color: 'var(--t-lo)' }}>
          Trade journal unreachable.
          <div className="mono" style={{ fontSize: 11, marginTop: 4, color: 'var(--t-lo)' }}>
            {state.message}
          </div>
        </div>
      )}

      {state.kind === 'unavailable' && (
        <div style={{ padding: '14px 2px' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>No trade journal yet</div>
          <div style={{ fontSize: 11.5, color: 'var(--t-lo)', marginTop: 4, lineHeight: 1.5 }}>
            {state.message}
          </div>
        </div>
      )}

      {state.kind === 'ok' && <JournalBody data={state.data} />}
    </section>
  );
}

/* ── Body (only rendered when we have a ledger) ──────────────────────────── */

type TradeFilter = 'all' | 'wins' | 'losses';

function JournalBody({ data }: { data: TradeLedger }) {
  const [filter, setFilter] = useState<TradeFilter>('all');

  const s = data.summary ?? {};
  const openPositions = Array.isArray(data.open_positions) ? data.open_positions : [];
  const trades = Array.isArray(data.trades) ? data.trades : [];

  // Honest empty state — no journal activity at all yet. Don't render a grid
  // of zeroed-out cards; that would read as broken, not "no data yet".
  if (trades.length === 0 && openPositions.length === 0) {
    return (
      <div style={{ padding: '14px 2px' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>No trade journal yet</div>
        <div style={{ fontSize: 11.5, color: 'var(--t-lo)', marginTop: 4, lineHeight: 1.5 }}>
          Simons hasn&apos;t closed a round-trip paper trade yet. Check back once the pipeline runs.
        </div>
      </div>
    );
  }

  const winsCount = trades.filter((t) => t.outcome === 'WIN').length;
  const lossesCount = trades.filter((t) => t.outcome === 'LOSS').length;
  const filteredTrades = trades.filter((t) =>
    filter === 'all' ? true : filter === 'wins' ? t.outcome === 'WIN' : t.outcome === 'LOSS'
  );

  const tabs: [TradeFilter, string][] = [
    ['all', `All · ${trades.length}`],
    ['wins', `Wins · ${winsCount}`],
    ['losses', `Losses · ${lossesCount}`],
  ];

  const statCards: { label: string; node: React.ReactNode }[] = [
    { label: 'Round trips', node: <span className="tnum">{isNum(s.round_trips) ? s.round_trips : '—'}</span> },
    {
      label: 'Win rate',
      node: (
        <>
          <span className="tnum">{pctPlain(s.win_rate_pct)}</span>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--t-lo)', marginTop: 2 }}>
            {isNum(s.wins) ? s.wins : '—'}W · {isNum(s.losses) ? s.losses : '—'}L
          </div>
        </>
      ),
    },
    {
      label: 'Total P&L',
      node: (
        <span className="tnum" style={{ color: pnlColor(s.total_pnl) }}>
          {money(s.total_pnl, { signed: true, digits: 0 })}
        </span>
      ),
    },
    {
      label: 'Avg held',
      node: <span className="tnum">{heldDays(s.avg_held_days)}</span>,
    },
    {
      label: 'Profit factor',
      node: <span className="tnum">{factor(s.profit_factor)}</span>,
    },
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      {/* summary stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          marginBottom: 12,
        }}
      >
        {statCards.map(({ label, node }) => (
          <div key={label} className="inst-mod" style={{ padding: '10px 12px', minHeight: 0 }}>
            <span className="inst-cnr tl" />
            <span className="inst-cnr tr" />
            <span className="inst-cnr bl" />
            <span className="inst-cnr br" />
            <div className="eyebrow">{label}</div>
            <div style={{ fontSize: 20, marginTop: 2, color: 'var(--t-hi)' }}>{node}</div>
          </div>
        ))}

        {/* avg win vs avg loss — side by side inside one card */}
        <div className="inst-mod" style={{ padding: '10px 12px', minHeight: 0 }}>
          <span className="inst-cnr tl" />
          <span className="inst-cnr tr" />
          <span className="inst-cnr bl" />
          <span className="inst-cnr br" />
          <div className="eyebrow">Avg win / loss</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            <div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--t-lo)', letterSpacing: '0.08em' }}>
                WIN
              </div>
              <div className="tnum" style={{ fontSize: 17, color: 'var(--c-green)' }}>
                {money(s.avg_win, { signed: true })}
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--t-lo)', letterSpacing: '0.08em' }}>
                LOSS
              </div>
              <div className="tnum" style={{ fontSize: 17, color: 'var(--c-rose)' }}>
                {money(s.avg_loss, { signed: true })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* summary ELI5 + honesty note */}
      {s.eli5 && (
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--t-hi)', margin: '2px 0 0' }}>{s.eli5}</p>
      )}
      {s.honesty_note && (
        <p
          className="mono"
          style={{ fontSize: 10.5, lineHeight: 1.5, color: 'var(--t-lo)', margin: '8px 0 0' }}
        >
          {s.honesty_note}
        </p>
      )}

      {/* open positions */}
      {openPositions.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>
            Open positions
          </div>
          <div style={{ padding: '2px 0' }}>
            {openPositions.map((p, i) => (
              <div key={`${p.ticker ?? 'pos'}-${i}`} className="fn-row" style={{ alignItems: 'flex-start', whiteSpace: 'normal' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {p.ticker ?? '—'}
                    {p.direction && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          color: p.direction === 'short' ? 'var(--c-rose)' : 'var(--c-green)',
                        }}
                      >
                        {p.direction}
                      </span>
                    )}
                    <span className="po-pal-grp">OPEN</span>
                  </div>
                  {p.eli5 && (
                    <div style={{ fontSize: 12, color: 'var(--t-lo)', marginTop: 4, lineHeight: 1.5 }}>{p.eli5}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* trade list header + filter row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          margin: '18px 0 8px',
        }}
      >
        <div className="eyebrow" style={{ margin: 0 }}>
          Trade list
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ag-filter" style={{ margin: 0 }}>
            {tabs.map(([k, l]) => (
              <button
                key={k}
                type="button"
                className={'cm-tab' + (filter === k ? ' on' : '')}
                style={{ flex: '0 0 auto', padding: '0 14px', height: 26 }}
                onClick={() => setFilter(k)}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--t-lo)', whiteSpace: 'nowrap' }}>
            {filteredTrades.length} shown
          </span>
        </div>
      </div>

      {/* scrollable trade cards, newest first (already sorted by the source) */}
      <div style={{ maxHeight: 560, overflowY: 'auto', paddingRight: 2 }}>
        {filteredTrades.length === 0 ? (
          <div style={{ padding: '14px 2px', fontSize: 12, color: 'var(--t-lo)' }}>
            No trades match this filter.
          </div>
        ) : (
          filteredTrades.map((t, i) => <TradeCard key={`${t.ticker ?? 'trade'}-${t.exit_date ?? i}-${i}`} t={t} />)
        )}
      </div>

      {/* freshness + disclaimer, verbatim from the payload */}
      {(data.generated || data.disclaimer) && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid var(--line-2)',
          }}
        >
          {data.generated && (
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--t-lo)' }}>
              Journal generated {data.generated}
            </div>
          )}
          {data.disclaimer && (
            <div
              className="mono"
              style={{ fontSize: 10.5, color: 'var(--t-lo)', letterSpacing: '0.02em', marginTop: data.generated ? 4 : 0 }}
            >
              {data.disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── One trade card ──────────────────────────────────────────────────────── */

function TradeCard({ t }: { t: Trade }) {
  const outcomeColor =
    t.outcome === 'WIN' ? 'var(--c-green)' : t.outcome === 'LOSS' ? 'var(--c-rose)' : 'var(--t-lo)';

  return (
    <div style={{ padding: '14px 4px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={t.outcome ?? '—'} color={outcomeColor} />
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t.ticker ?? '—'}</span>
          {t.direction && (
            <span
              className="mono"
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                color: t.direction === 'short' ? 'var(--c-rose)' : 'var(--c-green)',
              }}
            >
              {t.direction}
            </span>
          )}
          {t.era === 'bug-era' && <Badge label="old-book era" color="var(--c-amber)" title={t.era_note} />}
          {t.pnl_reconciled === false && <Badge label="SUSPECT" color="var(--c-red)" />}
        </div>
        <div className="tnum" style={{ textAlign: 'right', fontSize: 13.5, color: pnlColor(t.pnl) }}>
          {money(t.pnl, { signed: true })}
          <span className="mono" style={{ fontSize: 11, marginLeft: 6, color: 'var(--t-lo)' }}>
            {pct(t.return_pct)}
          </span>
        </div>
      </div>

      <div className="mono" style={{ fontSize: 10.5, color: 'var(--t-lo)', marginTop: 4 }}>
        {t.entry_date ?? '—'} → {t.exit_date ?? '—'} · {isNum(t.held_days) ? `${num(t.held_days, 1)}d held` : '—'}
      </div>

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {t.eli5_entry && (
          <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--t-hi)' }}>{t.eli5_entry}</p>
        )}
        {t.eli5_exit && (
          <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--t-mid)' }}>{t.eli5_exit}</p>
        )}
        {t.eli5_lesson && (
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
              fontStyle: 'italic',
              color: 'var(--t-mid)',
              borderLeft: '2px solid var(--accent)',
              paddingLeft: 10,
            }}
          >
            <span
              className="mono"
              style={{ fontStyle: 'normal', fontSize: 9, letterSpacing: '0.1em', color: 'var(--accent)', marginRight: 6 }}
            >
              LESSON
            </span>
            {t.eli5_lesson}
          </p>
        )}
      </div>
    </div>
  );
}
