import { describe, expect, it, vi } from 'vitest';

import { claimRelayDispatch, classifyDispatchFailure, markRelayStatus } from './relay-dispatch';

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

describe('classifyDispatchFailure', () => {
  it('treats a thrown call as unknown delivery, not as a verified failure', () => {
    expect(classifyDispatchFailure('threw')).toEqual({ status: 'unknown', verified: false });
  });

  it('treats an explicit gateway error as a verified non-delivery', () => {
    expect(classifyDispatchFailure('gateway_error')).toEqual({ status: 'failed', verified: true });
    expect(classifyDispatchFailure('no_reply')).toEqual({ status: 'unknown', verified: false });
  });
});
