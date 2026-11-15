import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEMO_STATE,
  revenueLabel,
  INITIAL_STATE,
  formatArrK,
  formatUsdCompact,
  isDemoRequested,
  resolveFinanceState,
  sourceBadge,
  financeProvenance,
  formatMeasuredAt,
  type StripeRevenuePayload,
} from './finance-truth';

/**
 * Regression coverage for the FinanceHQ failure of 14 Nov 2026.
 *
 * Observed before this change:
 *   - `useState(48200)` rendered $48.2k before any data arrived and stayed there if the revenue
 *     endpoint failed.
 *   - the live override was gated on `subscriptions.mrr > 0`, so a real $0 business displayed
 *     $48,200.
 *   - `setMrr(v => v + Math.random() * 180)` ran every 1.5s on top of real data.
 *
 * Each test below pins one of those, plus the inverse (real data must still render).
 */

const live = (mrr: number, arr?: number): StripeRevenuePayload => ({
  source: 'live',
  subscriptions: { active: 3, mrr, arr },
});

describe('a genuine zero stays zero', () => {
  it('shows 0 rather than the old seed when Stripe reports zero revenue', () => {
    const state = resolveFinanceState(live(0, 0), false);
    expect(state.source).toBe('live');
    expect(state.mrr).toBe(0);
    expect(formatUsdCompact(state.mrr)).toBe('$0');
  });

  it('does not substitute the seeded figure for any zero-valued live response', () => {
    for (const payload of [live(0, 0), live(0), live(0.4, 4.8)]) {
      const state = resolveFinanceState(payload, false);
      expect(state.mrr).not.toBe(48200);
      expect(state.mrr).toBe(payload.subscriptions?.mrr);
    }
  });
});

describe('unavailable stays unavailable', () => {
  it('reports unavailable when Stripe is not configured, and shows no number', () => {
    const state = resolveFinanceState({ source: 'unavailable' }, false);
    expect(state.source).toBe('unavailable');
    expect(state.mrr).toBeNull();
    expect(formatUsdCompact(state.mrr)).toBe('\u2014');
    expect(sourceBadge(state).label).toBe('UNAVAILABLE');
  });

  it('reports unavailable for a missing payload instead of falling back to a mock', () => {
    for (const payload of [null, undefined]) {
      const state = resolveFinanceState(payload, false);
      expect(state.source).toBe('unavailable');
      expect(state.mrr).toBeNull();
    }
  });

  it('treats a live source with no measurable MRR as unavailable, not as zero', () => {
    const state = resolveFinanceState({ source: 'live', subscriptions: {} }, false);
    expect(state.source).toBe('unavailable');
    expect(state.mrr).toBeNull();
    expect(state.reason).toMatch(/no measurable MRR/i);
  });

  it('keeps the API error message as the stated reason', () => {
    const state = resolveFinanceState({ source: 'unavailable', error: 'Stripe API error: 401' }, false);
    expect(state.reason).toBe('Stripe API error: 401');
  });
});

describe('real data still renders', () => {
  it('shows the live MRR and derives ARR when Stripe omits it', () => {
    const state = resolveFinanceState(live(12000), false);
    expect(state.source).toBe('live');
    expect(formatUsdCompact(state.mrr)).toBe('$12.0k');
    expect(state.arr).toBe(144000);
    expect(formatArrK(state.arr)).toBe('144k');
  });

  it('prefers the ARR that Stripe actually reported', () => {
    const state = resolveFinanceState(live(12000, 999000), false);
    expect(state.arr).toBe(999000);
  });

  it('keeps only settled transactions and labels them as live', () => {
    const state = resolveFinanceState(
      {
        ...live(500),
        recentTransactions: [
          { id: 'a', amount: 2400, description: 'Vela Logistics', status: 'succeeded' },
          { id: 'b', amount: 390, description: 'Cobalt Studio', status: 'failed' },
          { id: 'c', amount: 9600, description: 'Orbit Health', status: 'paid' },
        ],
      },
      false,
    );
    expect(state.transactions.map((t) => t.id)).toEqual(['a', 'c']);
    expect(state.transactions[0].amount).toBe('+$2,400');
    expect(state.transactions[0].plan).toBe('Stripe \u00b7 live');
  });

  it('draws no trend line when no historical series exists', () => {
    expect(resolveFinanceState(live(12000), false).chart).toBeNull();
  });

  it('never invents transactions for a live source with none', () => {
    expect(resolveFinanceState(live(12000), false).transactions).toEqual([]);
  });
});

describe('demo data is isolated and labelled', () => {
  it('is unreachable unless explicitly requested', () => {
    for (const search of [null, undefined, '', '?x=1', '?demo=0', '?demo=false', '?demolition=1']) {
      expect(isDemoRequested(search)).toBe(false);
    }
    expect(resolveFinanceState(live(12000), false).source).toBe('live');
  });

  it('is returned only for an explicit demo request, and says so', () => {
    for (const search of ['?demo=1', '?demo=true', '?a=1&demo=1']) {
      expect(isDemoRequested(search)).toBe(true);
    }
    const state = resolveFinanceState(live(12000), true);
    expect(state.source).toBe('demo');
    expect(state).toEqual(DEMO_STATE);
    expect(sourceBadge(state).label).toBe('DEMO');
    expect(state.reason).toMatch(/not real revenue/i);
  });
});

describe('the pre-data default cannot be mistaken for revenue', () => {
  it('starts with no number at all', () => {
    expect(INITIAL_STATE.mrr).toBeNull();
    expect(INITIAL_STATE.arr).toBeNull();
    expect(INITIAL_STATE.chart).toBeNull();
    expect(INITIAL_STATE.transactions).toEqual([]);
    expect(sourceBadge(INITIAL_STATE).label).toBe('SYNC');
  });

  it('renders the em dash for every unmeasured value', () => {
    expect(formatUsdCompact(null)).toBe('\u2014');
    expect(formatArrK(null)).toBe('\u2014');
  });
});

describe('malformed data cannot throw or invent a number', () => {
  it('a non-array recentTransactions is ignored instead of throwing', () => {
    const state = resolveFinanceState(
      { source: 'live', subscriptions: { mrr: 900 }, recentTransactions: {} as never },
      false,
    );
    expect(state.source).toBe('live');
    expect(state.mrr).toBe(900);
    expect(state.transactions).toEqual([]);
  });

  it('a null row is skipped, and the live MRR survives', () => {
    const state = resolveFinanceState(
      { source: 'live', subscriptions: { mrr: 900 }, recentTransactions: [null as never] },
      false,
    );
    expect(state.source).toBe('live');
    expect(state.mrr).toBe(900);
    expect(state.transactions).toEqual([]);
  });

  it('an unmeasurable amount renders an em dash, not a fabricated zero', () => {
    const state = resolveFinanceState(
      {
        source: 'live',
        subscriptions: { mrr: 900 },
        recentTransactions: [
          { id: 's', amount: '2500' as unknown as number, status: 'succeeded' },
          { id: 'n', amount: 2500, status: 'succeeded' },
        ],
      },
      false,
    );
    expect(state.transactions[0].amount).toBe('\u2014');
    expect(state.transactions[1].amount).toBe('+$2,500');
  });

  it('the demo state is a copy, so a consumer cannot corrupt the fixture', () => {
    const first = resolveFinanceState(null, true);
    first.transactions[0].name = 'mutated';
    const second = resolveFinanceState(null, true);
    expect(second.transactions[0].name).not.toBe('mutated');
  });
});


describe('the shared revenue label cannot fabricate a figure', () => {
  it('renders a measured zero as zero', () => {
    expect(revenueLabel('ok', 0)).toBe('$0');
  });

  it('renders every unmeasured state as an em dash', () => {
    for (const state of ['degraded', 'offline', 'unknown'] as const) {
      expect(revenueLabel(state, 0)).toBe('\u2014');
      expect(revenueLabel(state, 48200)).toBe('\u2014');
    }
  });

  it('uses the caller formatter when measured', () => {
    expect(revenueLabel('ok', 12000, (v) => `$${(v / 1000).toFixed(1)}k`)).toBe('$12.0k');
  });
});

describe('the component cannot reintroduce the defect', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/command-center/po/FinanceHQ.tsx'),
    'utf8',
  );

  it('contains no random number generation', () => {
    expect(source).not.toMatch(/Math\.random/);
  });

  it('contains no hardcoded revenue seed', () => {
    expect(source).not.toMatch(/48200/);
    expect(source).not.toMatch(/useState\(\s*\d{4,}\s*\)/);
  });

  it('reads its numbers from the truth model', () => {
    expect(source).toMatch(/from '@\/lib\/finance-truth'/);
  });
});


describe('measurement provenance', () => {
  const live = (over: Partial<StripeRevenuePayload> = {}): StripeRevenuePayload => ({
    source: 'live',
    subscriptions: { mrr: 5000, arr: 60000, active: 3 },
    recentTransactions: [],
    fetchedAt: '2026-11-15T13:34:00.000Z',
    ...over,
  });

  it('carries the measurement time through a live reading', () => {
    const state = resolveFinanceState(live(), false);
    expect(state.measuredAt).toBe('2026-11-15T13:34:00.000Z');
    expect(financeProvenance(state).trustworthy).toBe(true);
    expect(financeProvenance(state).source).toBe('Stripe (live)');
  });

  it('does not invent a measurement time when the server omits one', () => {
    const state = resolveFinanceState(live({ fetchedAt: undefined }), false);
    expect(state.measuredAt).toBeNull();
    expect(financeProvenance(state).measured).toBe('not measured');
    // The figure is still real; only its timestamp is unknown.
    expect(state.mrr).toBe(5000);
  });

  it('rejects a malformed timestamp instead of rendering it', () => {
    const state = resolveFinanceState(live({ fetchedAt: 'not-a-date' }), false);
    expect(state.measuredAt).toBeNull();
    expect(formatMeasuredAt('not-a-date')).toBe('not measured');
  });

  it('reports unavailable with no measured time when the source is down', () => {
    const state = resolveFinanceState({ source: 'unavailable', error: 'boom' }, false);
    expect(state.mrr).toBeNull();
    expect(state.measuredAt).toBeNull();
    const prov = financeProvenance(state);
    expect(prov.status).toBe('unavailable');
    expect(prov.trustworthy).toBe(false);
    expect(prov.measured).toBe('not measured');
  });

  it('labels demo data as not real, even though it has numbers', () => {
    const prov = financeProvenance(DEMO_STATE);
    expect(prov.status).toBe('demo');
    expect(prov.trustworthy).toBe(false);
    expect(prov.measured).toBe('not real');
    expect(DEMO_STATE.measuredAt).toBeNull();
  });

  it('keeps a measured zero trustworthy and distinguishable from unknown', () => {
    const zero = resolveFinanceState(live({ subscriptions: { mrr: 0, arr: 0, active: 0 } }), false);
    expect(zero.source).toBe('live');
    expect(zero.mrr).toBe(0);
    expect(financeProvenance(zero).trustworthy).toBe(true);
    expect(formatUsdCompact(zero.mrr)).toBe('$0');
    expect(formatUsdCompact(INITIAL_STATE.mrr)).toBe('\u2014');
  });
});
