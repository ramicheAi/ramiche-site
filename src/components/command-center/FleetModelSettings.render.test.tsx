// @vitest-environment jsdom
/**
 * Rendered-UI tests for the Fleet model panel.
 *
 * The first version of this panel passed its unit tests while telling the operator
 * "Saved and read back: undefined is now undefined" on every success, because the unit test
 * asserted a JSON shape the route never sends. These tests render the component and read the text
 * a person would see.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import FleetModelSettings from './FleetModelSettings';

const READY = {
  ok: true,
  source: 'live',
  registry: {
    observedAt: '2026-11-15T18:00:00.000Z',
    warnings: [],
    providers: [{ name: 'claude-max', models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-5'], reachability: 'unverified' }],
    agents: [
      { agentId: 'atlas', primary: 'claude-max/claude-opus-5', fallbacks: [], unsupported: false },
      { agentId: 'triage', primary: 'claude-max/claude-sonnet-5', fallbacks: [], unsupported: false },
    ],
  },
};

// After a successful save the panel re-reads the registry and requires the persisted value to
// appear there, so the follow-up GET must show the new model rather than the old snapshot.
const READY_UPDATED = {
  ...READY,
  registry: {
    ...READY.registry,
    agents: READY.registry.agents.map((a) =>
      a.agentId === 'atlas' ? { ...a, primary: 'claude-max/claude-haiku-5' } : a,
    ),
  },
};

function stubFetch(...responses: unknown[]) {
  const fn = vi.fn();
  for (const body of responses) fn.mockResolvedValueOnce({ ok: true, json: async () => body } as unknown as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the three runtime states are visibly different', () => {
  it('says the runtime is unavailable and that this is not an empty catalogue', async () => {
    stubFetch({ ok: false, source: 'unavailable', reason: 'not present on this runtime', detail: 'Vercel cannot read it' });
    render(<FleetModelSettings />);
    await waitFor(() => expect(screen.getByText(/Runtime unavailable/i)).toBeTruthy());
    expect(screen.getByText(/not an empty catalogue/i)).toBeTruthy();
    expect(screen.getByText(/not present on this runtime/)).toBeTruthy();
  });

  it('says malformed when the configuration cannot be parsed', async () => {
    stubFetch({ ok: false, source: 'malformed', reason: 'agents.list is not an array' });
    render(<FleetModelSettings />);
    await waitFor(() => expect(screen.getByText(/malformed/i)).toBeTruthy());
  });

  it('says the session expired rather than blaming the runtime', async () => {
    stubFetch({ ok: false, error: 'denied', reason: 'missing_session' });
    render(<FleetModelSettings />);
    await waitFor(() => expect(screen.getAllByText(/session expired/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/Runtime unavailable/i)).toBeNull();
  });

  it('says the catalogue is empty without implying an outage', async () => {
    stubFetch({ ok: true, source: 'live', registry: { agents: [], providers: [], warnings: [], observedAt: '' } });
    render(<FleetModelSettings />);
    await waitFor(() => expect(screen.getByText(/No agents or providers are configured/i)).toBeTruthy());
  });
});

describe('a successful save shows what actually persisted', () => {
  it('renders the confirmed value from the server envelope', async () => {
    stubFetch(READY, {
      ok: true,
      source: 'live',
      write: {
        ok: true,
        agentId: 'atlas',
        before: 'claude-max/claude-opus-5',
        after: 'claude-max/claude-haiku-5',
        backupPath: '/tmp/x.bak',
        observedAt: '2026-11-15T18:01:00.000Z',
      },
    }, READY_UPDATED);

    render(<FleetModelSettings />);
    await waitFor(() => expect(screen.getByLabelText('model for atlas')).toBeTruthy());

    const select = screen.getByLabelText('model for atlas') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'claude-max/claude-haiku-5' } });
    fireEvent.click(screen.getAllByText('Save')[0]);

    await waitFor(() => expect(screen.getByText(/read back/i)).toBeTruthy());
    const text = document.body.textContent ?? '';
    expect(text).toContain('claude-max/claude-haiku-5');
    expect(text).not.toContain('undefined');
  });

  it('shows a lock as busy, not as saved', async () => {
    stubFetch(READY, { ok: false, write: { ok: false, reason: 'locked' } });
    render(<FleetModelSettings />);
    await waitFor(() => expect(screen.getByLabelText('model for atlas')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('model for atlas') as HTMLSelectElement, {
      target: { value: 'claude-max/claude-haiku-5' },
    });
    fireEvent.click(screen.getAllByText('Save')[0]);
    await waitFor(() => expect(screen.getByText(/another change is in progress/i)).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/read back/i);
  });
});
