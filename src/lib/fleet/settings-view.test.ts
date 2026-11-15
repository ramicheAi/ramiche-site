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

  it('refuses a duplicate selection already used by another agent', () => {
    const result = checkSelection(SNAPSHOT, 'atlas', 'claude-max/claude-sonnet-5');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already the primary model for triage/);
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
