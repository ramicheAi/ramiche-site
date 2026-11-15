// @vitest-environment jsdom
/**
 * Component-level regression test for Finance HQ.
 *
 * WHY THIS EXISTS
 * ---------------
 * The pure-function suite in finance-truth.test.ts proves the rules, not the wiring. The original
 * defect lived in the wiring: `useState(48200)` in the component, and an interval that added random
 * money to whatever the state held. A reviewer reading the function tests alone could not tell
 * whether the JSX actually used them.
 *
 * This test renders the real component with the real fetch path and asserts what appears on screen.
 * Only external collaborators are mocked: the sound engine and the quant panel. The truth module
 * and the component under test are the real ones. The theme provider is no longer mocked because
 * the component stopped importing it when the fabricated drift was removed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/po-sound', () => ({ poPlay: () => {} }));
vi.mock('@/components/command-center/po/QuantPanel', () => ({
  default: () => <div data-testid="quant-panel" />,
}));

import FinanceHQ from './FinanceHQ';

function respondWith(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, json: async () => body } as unknown as Response),
  );
}

function rejectFetch(message = 'network down') {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

beforeEach(() => {
  window.history.replaceState({}, '', '/command-center/finance');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Finance HQ renders measured revenue or nothing', () => {
  it('shows no number before data arrives, and never the old seed', () => {
    respondWith({ source: 'unavailable' });
    const { container } = render(<FinanceHQ />);
    // The very first paint, before the effect resolves. The hero figure is the only thing that
    // can claim a revenue number, so assert on it directly rather than on any dash in the page.
    expect(container.querySelector('.fn-big')?.textContent).toBe('\u2014');
    expect(document.body.textContent).not.toContain('48.2k');
    expect(document.body.textContent).not.toContain('$48,200');
  });

  it('renders a genuine zero as $0 with a LIVE badge', async () => {
    respondWith({ source: 'live', subscriptions: { active: 0, mrr: 0, arr: 0 } });
    const { container } = render(<FinanceHQ />);
    await waitFor(() => expect(container.querySelector('.fn-big')?.textContent).toBe('$0'));
    expect(screen.getAllByText('LIVE').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('48.2k');
  });

  it('renders measured revenue and labels the source', async () => {
    respondWith({ source: 'live', subscriptions: { active: 3, mrr: 12000, arr: 144000 } });
    const { container } = render(<FinanceHQ />);
    await waitFor(() => expect(container.querySelector('.fn-big')?.textContent).toBe('$12.0k'));
    expect(screen.getAllByText('LIVE').length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('144k ARR');
  });

  it('renders unavailable as an em dash, states why, and shows no figure', async () => {
    respondWith({ source: 'unavailable', error: 'Stripe is not configured' });
    const { container } = render(<FinanceHQ />);
    await waitFor(() => expect(screen.getAllByText('UNAVAILABLE').length).toBeGreaterThan(0));
    expect(container.querySelector('.fn-big')?.textContent).toBe('\u2014');
    expect(document.body.textContent).toContain('Stripe is not configured');
    expect(document.body.textContent).not.toMatch(/\$\d/);
  });

  it('treats a rejected fetch as unavailable, not as zero', async () => {
    rejectFetch();
    const { container } = render(<FinanceHQ />);
    await waitFor(() => expect(screen.getAllByText('UNAVAILABLE').length).toBeGreaterThan(0));
    expect(container.querySelector('.fn-big')?.textContent).toBe('\u2014');
    expect(container.querySelector('.fn-big')?.textContent).not.toBe('$0');
  });

  it('does not show a fabricated trend line in live mode', async () => {
    respondWith({ source: 'live', subscriptions: { active: 2, mrr: 500, arr: 6000 } });
    const { container } = render(<FinanceHQ />);
    await waitFor(() => expect(container.querySelector('.fn-big')?.textContent).toBe('$500'));
    expect(container.querySelector('.fn-line')).toBeNull();
    expect(document.body.textContent).toContain('No revenue history available');
  });

  it('says there are no transactions instead of inventing them', async () => {
    respondWith({ source: 'live', subscriptions: { active: 2, mrr: 500, arr: 6000 } });
    render(<FinanceHQ />);
    await waitFor(() =>
      expect(document.body.textContent).toContain('No settled transactions were returned by Stripe.'),
    );
  });

  it('renders demo figures only on an explicit ?demo=1, and labels them', async () => {
    window.history.replaceState({}, '', '/command-center/finance?demo=1');
    respondWith({ source: 'live', subscriptions: { active: 2, mrr: 500, arr: 6000 } });
    render(<FinanceHQ />);
    await waitFor(() => expect(screen.getAllByText('DEMO').length).toBeGreaterThan(0));
    expect(document.body.textContent).toContain('They are not real revenue');
    // The demo value may appear, but it must be under the demo banner.
    expect(document.body.textContent).toContain('$48.2k');
  });

  it('never adds money over time', async () => {
    vi.useFakeTimers();
    try {
      respondWith({ source: 'live', subscriptions: { active: 2, mrr: 12000, arr: 144000 } });
      const { container } = render(<FinanceHQ />);
      await vi.waitFor(() => expect(container.querySelector('.fn-big')?.textContent).toBe('$12.0k'));
      vi.advanceTimersByTime(60_000);
      // The value must be identical a minute later. The old component incremented every 1.5s.
      expect(container.querySelector('.fn-big')?.textContent).toBe('$12.0k');
      expect(document.body.textContent).not.toContain('$12.1k');
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks unmeasured tiles as not measured rather than inventing values', async () => {
    respondWith({ source: 'live', subscriptions: { active: 2, mrr: 500, arr: 6000 } });
    const { container } = render(<FinanceHQ />);
    await waitFor(() => expect(container.querySelector('.fn-big')?.textContent).toBe('$500'));
    expect(document.body.textContent).toContain('not measured');
    expect(document.body.textContent).not.toContain('31 mo');
    expect(document.body.textContent).not.toContain('1.2%');
  });
});
