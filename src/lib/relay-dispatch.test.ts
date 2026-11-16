import { describe, expect, it, vi } from 'vitest';

import {
  claimRelayDispatch,
  describeDuplicate,
  markRelayStatus,
  statusAfterEmptyDispatch,
  statusAfterTurn,
} from './relay-dispatch';

/** Minimal stand-in for the service client: the module only ever calls rpc(). */
function svcWith(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as unknown as Parameters<typeof claimRelayDispatch>[0];
}

describe('claimRelayDispatch', () => {
  it('reports the attempt number when the lease is won', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ claimed: true, attempts: 1, status: 'claimed' }], error: null });
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toEqual({ state: 'claimed', attempt: 1 });
  });

  it('reports a prior delivery as a duplicate with its status', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ claimed: false, attempts: 1, status: 'delivered' }], error: null });
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toEqual({ state: 'duplicate', status: 'delivered' });
  });

  it('reports an in-flight attempt as a duplicate, never as delivered', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ claimed: false, attempts: 2, status: 'claimed' }], error: null });
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toEqual({ state: 'duplicate', status: 'claimed' });
  });

  it('fails open when the message row does not exist, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: [{ claimed: false, attempts: null, status: 'not_found' }], error: null });
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toEqual({
      state: 'unprotected',
      reason: 'message row not found',
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('fails open and warns with the PostgREST code when the RPC is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    const result = await claimRelayDispatch(svcWith(rpc), 'm1');
    expect(result.state).toBe('unprotected');
    expect(warn.mock.calls[0][0]).toContain('not deduplicated');
    expect(warn.mock.calls[0][1]).toContain('PGRST202');
    warn.mockRestore();
  });

  it('fails open when the call throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toMatchObject({ state: 'unprotected' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('never throws, whatever the client does', async () => {
    const rpc = vi.fn().mockImplementation(() => {
      throw new Error('synchronous explosion');
    });
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toMatchObject({ state: 'unprotected' });
  });
});

describe('markRelayStatus', () => {
  it('returns true when the write lands', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(markRelayStatus(svcWith(rpc), 'm1', 'delivered', 2)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('cc_mark_relay_status', {
      p_message_id: 'm1',
      p_status: 'delivered',
      p_attempt: 2,
    });
  });

  it('returns false and warns when a newer attempt owns the row', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(markRelayStatus(svcWith(rpc), 'm1', 'delivered', 1)).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns false and warns on a PostgREST error instead of silence', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(markRelayStatus(svcWith(rpc), 'm1', 'unknown', 1)).resolves.toBe(false);
    expect(warn.mock.calls[0].join(' ')).toContain('42501');
    warn.mockRestore();
  });
});

describe('statusAfterTurn', () => {
  it('records delivered when a reply was written', () => {
    expect(statusAfterTurn({ ok: true, attempted: 1 })).toBe('delivered');
  });

  it('records unknown, not delivered, when a write was attempted and failed', () => {
    expect(statusAfterTurn({ ok: false, attempted: 1 })).toBe('unknown');
  });

  it('records unknown, not delivered, when nothing could even be attempted (no channelId)', () => {
    // summarizePersistence reports ok:true for this case, which is why the attempted count decides.
    expect(statusAfterTurn({ ok: true, attempted: 0 })).toBe('unknown');
  });

  it('records unknown when every write failed and none was attempted', () => {
    expect(statusAfterTurn({ ok: false, attempted: 0 })).toBe('unknown');
  });
});

describe('statusAfterEmptyDispatch', () => {
  it('records failed only when nothing was ever sent', () => {
    expect(statusAfterEmptyDispatch(false)).toBe('failed');
  });

  it('records unknown when a provider was called, including one that answered and declined', () => {
    expect(statusAfterEmptyDispatch(true)).toBe('unknown');
  });
});

// A state that is terminal in SQL must be terminal in the API. When `legacy` was added, all three
// dispatchers still treated it as "in flight, retryable", so the whole pre-migration cohort was
// told to wait for something that would never finish.
describe('describeDuplicate', () => {
  it('reports a genuine delivery as a prior success, with no error', () => {
    const d = describeDuplicate('delivered');
    expect(d.alreadyDispatched).toBe(true);
    expect(d.retryable).toBe(false);
  });

  it('calls a still-held lease in flight and retryable', () => {
    const d = describeDuplicate('claimed');
    expect(d.alreadyDispatched).toBe(false);
    expect(d.retryable).toBe(true);
    expect(d.detail).toMatch(/in flight/i);
  });

  it('never tells the client to retry a legacy row, or to wait for it', () => {
    const d = describeDuplicate('legacy');
    expect(d.alreadyDispatched).toBe(false);
    expect(d.retryable).toBe(false);
    expect(d.detail).not.toMatch(/in flight|wait/i);
    // The operator needs a way forward, not just a refusal.
    expect(d.detail).toMatch(/new message/i);
  });

  it('treats failed_permanent as terminal and says so', () => {
    const d = describeDuplicate('failed_permanent');
    expect(d.retryable).toBe(false);
    expect(d.detail).toMatch(/permanently/i);
  });

  it('keeps a transient re-claim race retryable for failed and unknown', () => {
    // Both are immediately reclaimable, so a duplicate report of either is a same-instant race.
    expect(describeDuplicate('failed').retryable).toBe(true);
    expect(describeDuplicate('unknown').retryable).toBe(true);
  });

  it('defaults to retryable for an unrecognised status rather than blocking a retry', () => {
    expect(describeDuplicate('something_new').retryable).toBe(true);
  });
});
