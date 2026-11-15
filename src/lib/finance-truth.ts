/**
 * Finance HQ truth model.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The FinanceHQ component used to render `useState(48200)` as monthly recurring revenue and then
 * add `Math.random() * 180` to it every 1.5 seconds. Three separate lies stacked on each other:
 *
 *   1. A hardcoded seed was displayed before any data arrived, and stayed displayed forever if the
 *      revenue endpoint failed.
 *   2. The live override only fired when `subscriptions.mrr > 0`, so a real business earning $0
 *      still showed $48,200.
 *   3. The random drift ran even after a genuine live number arrived, so a real figure was
 *      progressively corrupted on screen.
 *
 * The rule now: a number is shown only when it was measured. `null` means "not measured" and the
 * UI renders it as an em dash, never as a plausible-looking number. Demo values exist, but only
 * behind an explicit `?demo=1` request and always carry the `demo` source so the UI can label them.
 *
 * This module is deliberately pure so the rules can be tested without a DOM.
 */

export type FinanceSource = 'loading' | 'live' | 'unavailable' | 'demo';

export type FinanceTx = {
  id: string;
  name: string;
  plan: string;
  amount: string;
};

export type FinanceState = {
  /** Where the numbers came from. Drives every label in the UI. */
  source: FinanceSource;
  /** Monthly recurring revenue in dollars. null = not measured. Never a placeholder number. */
  mrr: number | null;
  /** Annual recurring revenue in dollars. null = not measured. */
  arr: number | null;
  /** Active subscription count. null = not measured. */
  activeSubscriptions: number | null;
  /** Real transaction rows only. Empty is a truthful answer. */
  transactions: FinanceTx[];
  /** Real historical series only. null = no series available, so no trend line is drawn. */
  chart: number[] | null;
  /** Why a number is missing, shown to the reader instead of a guess. */
  reason?: string;
};

export type StripeRevenuePayload = {
  subscriptions?: { active?: number; mrr?: number; arr?: number };
  recentTransactions?: {
    id?: string;
    amount?: number;
    description?: string;
    created?: string;
    status?: string;
  }[];
  source?: 'live' | 'unavailable';
  error?: string;
};

/** The state before any response has been read. Deliberately empty, not seeded. */
export const INITIAL_STATE: FinanceState = {
  source: 'loading',
  mrr: null,
  arr: null,
  activeSubscriptions: null,
  transactions: [],
  chart: null,
};

/**
 * Demo data, isolated. Only reachable through `resolveFinanceState(payload, true)`, which is only
 * called when the URL explicitly asks for it. Every consumer of this object must render
 * `source: 'demo'` as a visible label; that is the whole point of keeping it in one place.
 */
export const DEMO_STATE: FinanceState = {
  source: 'demo',
  mrr: 48200,
  arr: 578400,
  activeSubscriptions: 6,
  transactions: [
    { id: 'demo-1', name: 'Meridian Labs', plan: 'Annual · Scale', amount: '+$24,000' },
    { id: 'demo-2', name: 'Quanta Systems', plan: 'Monthly · Pro', amount: '+$2,400' },
    { id: 'demo-3', name: 'Northwind Co', plan: 'Monthly · Starter', amount: '+$390' },
    { id: 'demo-4', name: 'Ardent Group', plan: 'Annual · Pro', amount: '+$9,600' },
    { id: 'demo-5', name: 'Refund · Pylon', plan: 'Downgrade', amount: '\u2212$890' },
  ],
  chart: [72, 66, 70, 50, 44, 28, 18, 8],
  reason: 'Demo data requested with ?demo=1. Not real revenue.',
};

/** True only for an explicit demo request. `?demo=0` and a bare `?demo` do not count. */
export function isDemoRequested(search: string | null | undefined): boolean {
  if (!search) return false;
  const match = /[?&]demo=([^&]*)/.exec(search);
  if (!match) return false;
  const value = decodeURIComponent(match[1]).toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapTransactions(payload: StripeRevenuePayload): FinanceTx[] {
  // A malformed row must never throw: the caller would lose a genuinely live MRR because one
  // unrelated entry was the wrong shape. Non-arrays and non-objects are skipped, not trusted.
  const rows = Array.isArray(payload.recentTransactions) ? payload.recentTransactions : [];
  return rows
    .filter((t): t is NonNullable<typeof t> => Boolean(t) && typeof t === 'object')
    .filter((t) => t.status === 'succeeded' || t.status === 'paid')
    .slice(0, 4)
    .map((t, i) => {
      const amount = finiteNumber(t.amount);
      return {
        id: t.id ?? `tx-${i}`,
        name: t.description || 'Payment',
        plan: 'Stripe \u00b7 live',
        // An amount we cannot measure is not zero. It renders as an em dash.
        amount:
          amount === null
            ? '\u2014'
            : `${amount < 0 ? '\u2212' : '+'}$${Math.round(Math.abs(amount)).toLocaleString('en-US')}`,
      };
    });
}

/**
 * Turn a revenue response into displayable state.
 *
 * Fails closed on purpose: anything that is not a live response with a measurable MRR becomes
 * `unavailable` with a reason, and `mrr` stays null. A genuine `mrr: 0` is measured revenue of
 * zero and is preserved as 0. It is never replaced by a seed.
 */
export function resolveFinanceState(
  payload: StripeRevenuePayload | null | undefined,
  demoRequested: boolean,
): FinanceState {
  // A copy, not the constant: a consumer that mutates state must not corrupt the demo fixture
  // for every later caller.
  if (demoRequested) {
    return {
      ...DEMO_STATE,
      transactions: DEMO_STATE.transactions.map((t) => ({ ...t })),
      chart: DEMO_STATE.chart ? [...DEMO_STATE.chart] : null,
    };
  }

  if (!payload) {
    return { ...INITIAL_STATE, source: 'unavailable', reason: 'No revenue response was received.' };
  }

  if (payload.source !== 'live') {
    return {
      ...INITIAL_STATE,
      source: 'unavailable',
      reason: payload.error || 'Stripe is not configured or did not respond.',
    };
  }

  const mrr = finiteNumber(payload.subscriptions?.mrr);
  if (mrr === null) {
    return {
      ...INITIAL_STATE,
      source: 'unavailable',
      reason: 'Stripe reported a live source but returned no measurable MRR.',
    };
  }

  const declaredArr = finiteNumber(payload.subscriptions?.arr);
  return {
    source: 'live',
    mrr,
    // Deriving ARR from MRR is arithmetic, not invention. Only used when Stripe omits it.
    arr: declaredArr ?? mrr * 12,
    activeSubscriptions: finiteNumber(payload.subscriptions?.active),
    transactions: mapTransactions(payload),
    // No time series is returned by the revenue endpoint, so no trend line is drawn.
    chart: null,
  };
}

/** Compact money for the hero figure. null renders as an em dash, never as a number. */
export function formatUsdCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '\u2014';
  const abs = Math.abs(value);
  if (abs >= 1000) return `${value < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `${value < 0 ? '-' : ''}$${Math.round(abs)}`;
}

/** ARR label in thousands, or an em dash. */
export function formatArrK(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '\u2014';
  return `${(value / 1000).toFixed(0)}k`;
}


/**
 * The revenue label shared by every surface that shows MRR.
 *
 * `state` is the feed's own status, so this is the one place that decides "measured or unknown".
 * A real zero renders as zero; anything that was not measured renders as an em dash. CommandHUD
 * previously gated on `mrr > 0` and fell back to a showpiece constant, which is how a $0 business
 * saw $48.2k in the chrome above an honest Finance hero.
 */
export function revenueLabel(
  state: 'ok' | 'degraded' | 'offline' | 'unknown',
  mrr: number,
  format: (value: number) => string = formatUsdCompact,
): string {
  return state === 'ok' && Number.isFinite(mrr) ? format(mrr) : '\u2014';
}

export type SourceBadge = { label: string; tone: 'live' | 'demo' | 'unavailable' | 'loading' };

/** The only place a status label is decided, so the UI cannot claim LIVE without a live source. */
export function sourceBadge(state: FinanceState): SourceBadge {
  switch (state.source) {
    case 'live':
      return { label: 'LIVE', tone: 'live' };
    case 'demo':
      return { label: 'DEMO', tone: 'demo' };
    case 'unavailable':
      return { label: 'UNAVAILABLE', tone: 'unavailable' };
    default:
      return { label: 'SYNC', tone: 'loading' };
  }
}
