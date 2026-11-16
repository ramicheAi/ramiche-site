'use client';

/**
 * Fleet model settings.
 *
 * Replaces the previous flow, which posted to /api/command-center/agents and wrote
 * `directory.json`. That file is not what the gateway reads, so a save could report success while
 * the runtime kept its old model. This panel reads and writes the authoritative registry
 * (PR #95): GET /api/command-center/fleet/models and POST the same route, which locks, backs up,
 * writes atomically and reads the value back.
 *
 * Truth rules:
 * - unavailable, malformed and empty are three different screens.
 * - a selection is validated against the advertised catalogue before it is sent, and the server
 *   validates again.
 * - success is shown only when the server returns the value it read back; the panel then refreshes
 *   from the registry rather than trusting local state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkSelection,
  describeRegistry,
  describeWrite,
  selectionOptions,
  type RegistryResponse,
  type RegistryView,
  type WriteResponse,
  type WriteView,
} from '@/lib/fleet/settings-view';

export default function FleetModelSettings() {
  const [view, setView] = useState<RegistryView>({ state: 'loading' });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<WriteView | { state: 'idle' }>({ state: 'idle' });

  const load = useCallback(async (): Promise<RegistryView> => {
    setView({ state: 'loading' });
    let next: RegistryView;
    try {
      const res = await fetch('/api/command-center/fleet/models', { cache: 'no-store' });
      const body = (await res.json()) as RegistryResponse;
      next = describeRegistry(body);
    } catch {
      next = describeRegistry({ ok: false, source: 'unavailable', reason: 'the request failed before it reached the runtime' });
    }
    setView(next);
    return next;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshot = view.state === 'ready' || view.state === 'empty' ? view.registry : null;
  const options = useMemo(() => (snapshot ? selectionOptions(snapshot) : []), [snapshot]);

  const save = async (agentId: string, ref: string) => {
    if (!snapshot) return;
    const check = checkSelection(snapshot, agentId, ref);
    if (!check.ok) {
      setResult({ state: 'rejected', code: 'client_validation', message: check.reason });
      return;
    }
    setBusy(agentId);
    setResult({ state: 'idle' });
    try {
      const res = await fetch('/api/command-center/fleet/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, model: ref }),
      });
      const body = (await res.json()) as WriteResponse;
      const described = describeWrite(body);
      setResult(described);
      if (described.state === 'saved') {
        setDraft((d) => ({ ...d, [agentId]: '' }));
        // Re-read and compare: the confirmation must match the registry, not only the POST body.
        const fresh = await load();
        if (fresh.state === 'ready' || fresh.state === 'empty') {
          const row = fresh.registry.agents.find((a) => a.agentId === agentId);
          if (row?.primary !== described.persisted) {
            setResult({
              state: 'rejected',
              code: 'readback_mismatch',
              message: `the runtime returned ${described.persisted} but the re-read shows ${row?.primary ?? 'nothing'}`,
            });
          }
        }
      }
    } catch {
      setResult({ state: 'unavailable', code: 'network', message: 'the request failed before the runtime answered' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="po-panel" aria-label="Fleet models" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Fleet models</h3>
        <button type="button" onClick={() => void load()} disabled={busy !== null} style={{ minHeight: 44, padding: '0 14px' }}>
          Re-read runtime
        </button>
      </div>

      {view.state === 'loading' && <p>Reading the runtime configuration…</p>}

      {view.state === 'unavailable' && (
        <p role="alert" style={{ color: 'var(--c-rose)' }}>
          <strong>Runtime unavailable.</strong> {view.reason}
          {/* view.detail is never rendered: the route's detail text for this state is a
              filesystem path (e.g. "missing /…/openclaw.json"), and no path should reach the
              client. reason alone is the user-facing explanation. */}
          <br />
          <span style={{ opacity: 0.75 }}>This is not an empty catalogue. Nothing is shown because nothing could be read.</span>
        </p>
      )}

      {view.state === 'denied' && (
        <p role="alert" style={{ color: 'var(--c-gold)' }}>
          {/* Heading and detail must agree. This used to hardcode "Your session expired." above a
              detail that said, correctly, "this session is signed in, but not as this runtime's
              configured owner" — two diagnoses in one sentence, one of them false. */}
          <strong>{view.heading}</strong> {view.reason}
        </p>
      )}

      {view.state === 'malformed' && (
        <p role="alert" style={{ color: 'var(--c-rose)' }}>
          <strong>The runtime configuration is malformed.</strong> {view.reason}
        </p>
      )}

      {view.state === 'empty' && (
        <p role="status">
          <strong>No agents or providers are configured.</strong> The runtime answered and has nothing
          in its catalogue. This is an empty configuration, not an outage.
        </p>
      )}

      {snapshot && snapshot.warnings.length > 0 && (
        <p role="status" style={{ color: 'var(--c-gold)' }}>
          Warnings: {snapshot.warnings.join('; ')}
        </p>
      )}

      {snapshot && snapshot.agents.length > 0 && (
        <div style={{ overflowX: 'auto', minWidth: 0, marginTop: 8 }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Agent</th>
              <th align="left">Configured model</th>
              <th align="left">Change to</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {snapshot.agents.map((agent) => {
              const selected = draft[agent.agentId] ?? '';
              return (
                <tr key={agent.agentId}>
                  <td>{agent.agentId}</td>
                  <td>
                    {agent.primary ?? <em>not configured</em>}
                    {agent.unsupported && <strong title="configured but not advertised by the provider"> (unsupported)</strong>}
                  </td>
                  <td>
                    <select
                      aria-label={`model for ${agent.agentId}`}
                      value={selected}
                      onChange={(e) => setDraft((d) => ({ ...d, [agent.agentId]: e.target.value }))}
                    >
                      <option value="">select…</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.group} / {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={!selected || busy === agent.agentId}
                      style={{ minHeight: 44, minWidth: 64 }}
                      onClick={() => void save(agent.agentId, selected)}
                    >
                      {busy === agent.agentId ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {result.state === 'saved' && (
        <p role="status" style={{ color: 'var(--c-green)' }}>
          Saved and read back: {result.agentId} is now <code>{result.persisted}</code>.
          {result.before ? <> (was <code>{result.before}</code>)</> : null}
        </p>
      )}
      {result.state === 'rejected' && (
        <p role="alert" style={{ color: 'var(--c-rose)' }}>Not saved: {result.message}</p>
      )}
      {result.state === 'busy' && (
        <p role="alert" style={{ color: 'var(--c-gold)' }}>{result.message}</p>
      )}
      {result.state === 'unauthorized' && (
        <p role="alert" style={{ color: 'var(--c-gold)' }}>{result.message}</p>
      )}
      {result.state === 'unavailable' && (
        <p role="alert" style={{ color: 'var(--c-rose)' }}>Not saved: {result.message}</p>
      )}

      <p style={{ opacity: 0.6, fontSize: 12, marginTop: 12 }}>
        Provider reachability is unverified: this view reads configuration, it does not call the providers.
        Only the selected agent&apos;s primary model is written; nothing else in the gateway config is touched.
      </p>
    </section>
  );
}
