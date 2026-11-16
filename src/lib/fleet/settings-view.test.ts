import { describe, expect, it } from 'vitest';
import {
  checkSelection,
  describeRegistry,
  describeWrite,
  selectionOptions,
  type RegistrySnapshot,
} from './settings-view';

const SNAPSHOT: RegistrySnapshot = {
  observedAt: '2026-11-15T18:00:00.000Z',
  warnings: [],
  providers: [
    { name: 'claude-max', models: ['claude-opus-5', 'claude-sonnet-5'], reachability: 'unverified' },
    { name: 'openai', models: ['gpt-6'], reachability: 'unverified' },
  ],
  agents: [
    { agentId: 'atlas', primary: 'claude-max/claude-opus-5', fallbacks: [], unsupported: false },
    { agentId: 'triage', primary: 'claude-max/claude-sonnet-5', fallbacks: [], unsupported: false },
  ],
};

describe('an unavailable registry never looks empty', () => {
  it('reports loading before any response', () => {
    expect(describeRegistry(null).state).toBe('loading');
  });

  it('reports unavailable with the reason and detail', () => {
    const view = describeRegistry({ ok: false, source: 'unavailable', reason: 'not present on this runtime', detail: 'Vercel cannot read it' });
    expect(view).toEqual({ state: 'unavailable', reason: 'not present on this runtime', detail: 'Vercel cannot read it' });
  });

  it('reports malformed separately from unavailable', () => {
    expect(describeRegistry({ ok: false, source: 'malformed', reason: 'agents.list is not an array' }).state).toBe('malformed');
  });

  it('reports a genuinely empty catalogue as empty, not as an outage', () => {
    const view = describeRegistry({ ok: true, source: 'live', registry: { agents: [], providers: [], warnings: [], observedAt: '' } });
    expect(view.state).toBe('empty');
  });
});

describe('selections are refused before they reach the writer', () => {
  it('accepts a provider/model that exists and is free', () => {
    expect(checkSelection(SNAPSHOT, 'atlas', 'openai/gpt-6')).toEqual({ ok: true, provider: 'openai', model: 'gpt-6' });
  });

  it('refuses an unknown provider', () => {
    const result = checkSelection(SNAPSHOT, 'atlas', 'mistral/large');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unknown provider/);
  });

  it('refuses a model the provider does not offer', () => {
    const result = checkSelection(SNAPSHOT, 'atlas', 'openai/gpt-4');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not offered/);
  });

  it('refuses a malformed reference', () => {
    for (const ref of ['', 'gpt-6', 'openai/', '/gpt-6', 'openai/gpt 6', 'a/b/c']) {
      expect(checkSelection(SNAPSHOT, 'atlas', ref).ok, ref).toBe(false);
    }
  });

  it('refuses an unknown agent', () => {
    expect(checkSelection(SNAPSHOT, 'ghost', 'openai/gpt-6').ok).toBe(false);
  });

  it('accepts a selection already used as another agent\'s primary — the server has no such rule', () => {
    // Several agents sharing one model is normal. An earlier version refused this client-only,
    // silently blocking a legitimate assignment the server would have accepted.
    const result = checkSelection(SNAPSHOT, 'atlas', 'claude-max/claude-sonnet-5');
    expect(result).toEqual({ ok: true, provider: 'claude-max', model: 'claude-sonnet-5' });
  });

  it('refuses a no-op selection', () => {
    const result = checkSelection(SNAPSHOT, 'atlas', 'claude-max/claude-opus-5');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/current model/);
  });
});

describe('a write is only a success when the server read it back', () => {
  it('reports the persisted value from the server, never the requested one', () => {
    const view = describeWrite({
      ok: true,
      agentId: 'atlas',
      before: 'claude-max/claude-opus-5',
      after: 'openai/gpt-6',
      backupPath: '/tmp/x.bak',
      observedAt: '2026-11-15T18:01:00.000Z',
    });
    expect(view).toMatchObject({ state: 'saved', agentId: 'atlas', persisted: 'openai/gpt-6' });
  });

  it('treats a lock as busy, not as saved and not as broken', () => {
    const view = describeWrite({ ok: false, reason: 'locked', detail: 'lock exists' });
    expect(view.state).toBe('busy');
  });

  it('treats a read-back mismatch as a rejection, never as success', () => {
    const view = describeWrite({ ok: false, reason: 'readback_mismatch' });
    expect(view.state).toBe('rejected');
    if (view.state === 'rejected') expect(view.message).toMatch(/read back/);
  });

  it('treats a missing source as unavailable', () => {
    const view = describeWrite({ ok: false, reason: 'source_unavailable', detail: 'missing file' });
    expect(view.state).toBe('unavailable');
  });

  it('never puts a filesystem path from detail into the rendered message', () => {
    // Regression lock for the P2 fix: source_unavailable/lock_failed/write_failed detail text is
    // a real path on the runtime host. A future change that goes back to `flat.detail` here would
    // pass every other test in this file but leak the path again — this is the one that catches it.
    for (const reason of ['source_unavailable', 'lock_failed', 'write_failed']) {
      const view = describeWrite({
        ok: false,
        reason,
        detail: '/Users/admin/.openclaw/openclaw.json.lock exists; another update is in progress',
      });
      expect(view.state).toBe('unavailable');
      if (view.state === 'unavailable') {
        expect(view.message).not.toMatch(/\/Users\//);
        expect(view.message).not.toMatch(/openclaw\.json/);
      }
    }
  });

  it('has no idle success state', () => {
    expect(describeWrite(null)).toEqual({ state: 'idle' });
  });
});

describe('options come only from the advertised catalogue', () => {
  it('offers exactly the configured provider/model pairs', () => {
    expect(selectionOptions(SNAPSHOT)).toEqual([
      { group: 'claude-max', value: 'claude-max/claude-opus-5', label: 'claude-opus-5' },
      { group: 'claude-max', value: 'claude-max/claude-sonnet-5', label: 'claude-sonnet-5' },
      { group: 'openai', value: 'openai/gpt-6', label: 'gpt-6' },
    ]);
  });
});

describe('the route envelope is not the write result', () => {
  // The first version read the top level of {ok, source, write} and rendered
  // "Saved and read back: undefined is now undefined" on every success.
  it('reads the confirmed value out of the envelope', () => {
    const view = describeWrite({
      ok: true,
      source: 'live',
      write: {
        ok: true,
        agentId: 'atlas',
        before: 'claude-max/claude-opus-5',
        after: 'openai/gpt-6',
        backupPath: '/tmp/x.bak',
        observedAt: '2026-11-15T18:01:00.000Z',
      },
    } as never);
    expect(view).toMatchObject({ state: 'saved', persisted: 'openai/gpt-6', before: 'claude-max/claude-opus-5' });
  });

  it('refuses to call it saved when the server returned no confirmed value', () => {
    const view = describeWrite({ ok: true, write: { ok: true, agentId: 'atlas', after: '' } } as never);
    expect(view.state).toBe('rejected');
    if (view.state === 'rejected') expect(view.message).toMatch(/did not return the value/);
  });

  it('never prints undefined into the message', () => {
    const view = describeWrite({ ok: true, source: 'live', write: { ok: true, agentId: 'atlas' } } as never);
    if (view.state === 'rejected') expect(view.message).not.toContain('undefined');
  });
});

describe('an expired session is not an outage', () => {
  it('reports denied rather than runtime unavailable', () => {
    const view = describeRegistry({ ok: false, error: 'denied', reason: 'missing_session' } as never);
    expect(view).toEqual({ state: 'denied', reason: 'your session expired; sign in again' });
  });

  it('does not describe every denial reason as a session problem', () => {
    // ownerDenialResponse wraps every guard refusal identically as {error:"denied", reason}, so
    // a 403 not_owner or a 503 owner_not_configured must not render "sign in again" — the operator
    // IS signed in; signing in again changes nothing for either case.
    const notOwner = describeRegistry({ ok: false, error: 'denied', reason: 'not_owner' } as never);
    const noOwner = describeRegistry({ ok: false, error: 'denied', reason: 'owner_not_configured' } as never);
    expect(notOwner.state).toBe('denied');
    expect(noOwner.state).toBe('denied');
    if (notOwner.state === 'denied') expect(notOwner.reason.toLowerCase()).not.toContain('sign in again');
    if (noOwner.state === 'denied') expect(noOwner.reason.toLowerCase()).not.toContain('sign in again');
  });

  it('gives a CSRF/origin denial on GET a distinct message too', () => {
    const view = describeRegistry({ ok: false, error: 'denied', reason: 'origin_mismatch' } as never);
    expect(view).toEqual({
      state: 'denied',
      reason: 'the request was blocked for security reasons; reload the page and try again',
    });
  });
});

describe('half a catalogue is not ready', () => {
  it('reports empty when agents exist but no providers do', () => {
    const view = describeRegistry({
      ok: true,
      source: 'live',
      registry: { agents: [{ agentId: 'atlas', primary: null, fallbacks: [], unsupported: false }], providers: [], warnings: [], observedAt: '' },
    });
    expect(view.state).toBe('empty');
  });
});

describe('selection refs with slashes and guard denials', () => {
  const snapshot = {
    agents: [{ agentId: 'atlas', primary: 'claude-max/claude-opus-5', fallbacks: [], unsupported: false }],
    providers: [
      { name: 'claude-max', models: ['claude-opus-5'], reachability: 'unverified' as const },
      { name: 'lmstudio', models: ['google/gemma-4-e4b'], reachability: 'unverified' as const },
    ],
    warnings: [],
    observedAt: '2026-11-15T00:00:00.000Z',
  };

  it('accepts a model id that itself contains a slash', () => {
    expect(checkSelection(snapshot, 'atlas', 'lmstudio/google/gemma-4-e4b')).toMatchObject({
      ok: true,
      provider: 'lmstudio',
      model: 'google/gemma-4-e4b',
    });
  });

  it('still refuses an empty side', () => {
    expect(checkSelection(snapshot, 'atlas', '/model').ok).toBe(false);
    expect(checkSelection(snapshot, 'atlas', 'provider/').ok).toBe(false);
  });

  it('accepts a model id containing a space, exactly like the server splitRef does', () => {
    const spacedSnapshot = {
      ...snapshot,
      providers: [...snapshot.providers, { name: 'spacey', models: ['Qwen3 14B'], reachability: 'unverified' as const }],
    };
    expect(checkSelection(spacedSnapshot, 'atlas', 'spacey/Qwen3 14B')).toMatchObject({
      ok: true,
      provider: 'spacey',
      model: 'Qwen3 14B',
    });
  });

  it('maps every guard denial reason to unauthorized, not to an outage', () => {
    for (const reason of [
      'missing_session',
      'invalid_session',
      'session_expired',
      'not_owner',
      'owner_not_configured',
      'missing_unlock',
      'device_mismatch',
      'cross_site',
      'origin_mismatch',
      'missing_origin',
    ]) {
      const view = describeWrite({ ok: false, reason });
      expect(view.state).toBe('unauthorized');
      // The runtime did not reject anything here — the request never reached it. A denial must
      // never be described as the runtime's own refusal.
      if (view.state === 'unauthorized') expect(view.message.toLowerCase()).not.toContain('the runtime rejected');
    }
  });

  it('gives a CSRF/origin denial a distinct message from a session denial', () => {
    const origin = describeWrite({ ok: false, reason: 'origin_mismatch' });
    const session = describeWrite({ ok: false, reason: 'session_expired' });
    expect(origin.state).toBe('unauthorized');
    expect(session.state).toBe('unauthorized');
    if (origin.state === 'unauthorized' && session.state === 'unauthorized') {
      expect(origin.message).not.toBe(session.message);
    }
  });

  it('never renders a blank rejection', () => {
    const view = describeWrite({ ok: false, reason: 'something_new' });
    if (view.state === 'rejected') expect(view.message.length).toBeGreaterThan(10);
  });
});
