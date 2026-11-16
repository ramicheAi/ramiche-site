import { describe, expect, it, vi } from 'vitest';

import {
  claimRelayDispatch,
  classifyClaimError,
  describeDuplicate,
  describeUnavailable,
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

  // CC-RECOVERY-14: these five used to assert that the claim failed OPEN. They now assert it fails
  // CLOSED, because proceeding without a claim is the one state where duplicate execution is
  // certain: no lease is held, no outcome can be recorded (a null-attempt mark is refused on an
  // already-claimed row), and the next retry re-claims the row after the lease and runs again.
  it('refuses when the message row does not exist', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: [{ claimed: false, attempts: null, status: 'not_found' }], error: null });
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toMatchObject({
      state: 'unavailable',
      reason: 'no_message',
    });
    err.mockRestore();
  });

  it('refuses when the RPC is missing, and names the deployment as the cause', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.cc_claim_relay_dispatch' } });
    const result = await claimRelayDispatch(svcWith(rpc), 'm1');
    expect(result).toMatchObject({ state: 'unavailable', reason: 'not_deployed' });
    // The operator has to be able to tell this apart from an outage: the fix is a migration.
    expect(err.mock.calls[0][0]).toMatch(/refusing to dispatch/i);
    err.mockRestore();
  });

  it('refuses when the grant is revoked, and names permissions as the cause', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for function cc_claim_relay_dispatch' } });
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toMatchObject({
      state: 'unavailable',
      reason: 'unauthorized',
    });
    err.mockRestore();
  });

  it('refuses when the call throws, and calls it a transport fault', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toMatchObject({
      state: 'unavailable',
      reason: 'transport',
    });
    err.mockRestore();
  });

  it('never throws, whatever the client does, and still refuses', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn().mockImplementation(() => {
      throw new Error('synchronous explosion');
    });
    await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toMatchObject({ state: 'unavailable' });
    err.mockRestore();
  });

  it('refuses a malformed reply rather than guessing it means "no prior attempt"', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cases = [
      { data: null, error: null },
      { data: [], error: null },
      { data: [{ claimed: 'yes' }], error: null },
      { data: [{ claimed: false }], error: null },
      { data: 'surprise', error: null },
    ];
    for (const c of cases) {
      const rpc = vi.fn().mockResolvedValue(c);
      await expect(claimRelayDispatch(svcWith(rpc), 'm1')).resolves.toMatchObject({
        state: 'unavailable',
        reason: 'malformed',
      });
    }
    err.mockRestore();
  });
});

describe('classifyClaimError', () => {
  it('distinguishes a missing migration from a revoked grant from an outage', () => {
    expect(classifyClaimError({ code: 'PGRST202', message: 'Could not find the function' })).toBe('not_deployed');
    expect(classifyClaimError({ code: '42501', message: 'permission denied' })).toBe('unauthorized');
    expect(classifyClaimError({ message: 'JWT expired' })).toBe('unauthorized');
    expect(classifyClaimError(new Error('ECONNRESET'))).toBe('transport');
    expect(classifyClaimError({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe('transport');
  });

  it('blames the caller for a malformed id, not the deduplication function', () => {
    // 22P02 means the id is not a UUID. It will never succeed, so telling the caller to retry is an
    // invitation to loop, and telling them the function is broken sends them to the wrong component.
    expect(classifyClaimError({ code: '22P02', message: 'invalid input syntax for type uuid: "abc"' })).toBe('bad_id');
    const d = describeUnavailable('bad_id');
    expect(d.retryable).toBe(false);
    expect(d.httpStatus).toBe(400);
    expect(d.detail).toMatch(/not a UUID/i);
    expect(d.detail).not.toMatch(/deduplication function/i);
  });
});

describe('describeUnavailable', () => {
  it('says nothing ran, in every case, and never blames the caller', () => {
    const reasons = ['not_configured', 'not_deployed', 'unauthorized', 'transport', 'malformed', 'no_message'] as const;
    for (const r of reasons) {
      const d = describeUnavailable(r);
      expect(d.detail).toMatch(/nothing ran/i);
      expect(d.httpStatus).toBeGreaterThanOrEqual(400);
      expect(d.code).toMatch(/^[a-z_]+$/);
    }
  });

  it('marks only a transport fault as retryable by the caller', () => {
    // A missing migration, a revoked grant and a malformed function need an operator, not a retry.
    expect(describeUnavailable('transport').retryable).toBe(true);
    expect(describeUnavailable('not_deployed').retryable).toBe(false);
    expect(describeUnavailable('unauthorized').retryable).toBe(false);
    expect(describeUnavailable('malformed').retryable).toBe(false);
    expect(describeUnavailable('no_message').retryable).toBe(false);
  });
});

describe('markRelayStatus', () => {
  it('reports a zero-row update as not recorded, and says another attempt owns the message', async () => {
    // The database returns false when the attempt number is stale (a lease expired and someone else
    // re-claimed). That is a zero-row update, not an error, and it must not be counted as recorded.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(markRelayStatus(svcWith(rpc), 'm1', 'delivered', 1)).resolves.toBe(false);
    expect(warn.mock.calls.map((c) => c.join(' ')).join(' ')).toMatch(/another attempt now owns/i);
    warn.mockRestore();
  });

  it('reports an RPC error as not recorded rather than throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'no function' } });
    await expect(markRelayStatus(svcWith(rpc), 'm1', 'unknown', 1)).resolves.toBe(false);
    warn.mockRestore();
  });

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
