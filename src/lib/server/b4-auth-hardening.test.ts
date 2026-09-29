import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { isTransientVerifyError, verifyWithOneRetry } from './verify-retry';

const { sessionVerifier } = vi.hoisted(() => ({ sessionVerifier: vi.fn() }));
vi.mock('@/lib/firebase-admin', async (orig) => ({ ...(await orig<object>()), verifySessionCookie: sessionVerifier }));

const err = (code: string) => Object.assign(new Error(code), { code });
const noSleep = () => Promise.resolve();

describe('P05-B4 verification retry policy', () => {
  it.each(['auth/session-cookie-expired', 'auth/session-cookie-revoked', 'auth/argument-error', 'auth/user-disabled', 'auth/user-not-found', 'auth/insufficient-permission', 'something/unknown'])(
    'a definitive or unrecognized rejection (%s) denies immediately with NO retry', async (code) => {
      const verify = vi.fn(async () => { throw err(code); });
      expect(await verifyWithOneRetry(verify, { sleep: noSleep })).toBeNull();
      expect(verify).toHaveBeenCalledTimes(1);
    });
  it.each(['app/network-error', 'app/network-timeout', 'auth/internal-error', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'])(
    'a transient failure (%s) is retried exactly once and succeeds if the retry verifies', async (code) => {
      let n = 0;
      const verify = vi.fn(async () => { if (n++ === 0) throw err(code); return { uid: 'owner' }; });
      expect(await verifyWithOneRetry(verify, { sleep: noSleep })).toEqual({ uid: 'owner' });
      expect(verify).toHaveBeenCalledTimes(2);
    });
  it('two consecutive transient failures fail closed (no grace period)', async () => {
    const verify = vi.fn(async () => { throw err('app/network-error'); });
    expect(await verifyWithOneRetry(verify, { sleep: noSleep })).toBeNull();
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it('transient then definitive rejection denies', async () => {
    let n = 0;
    const verify = vi.fn(async () => { throw err(n++ === 0 ? 'ETIMEDOUT' : 'auth/session-cookie-revoked'); });
    expect(await verifyWithOneRetry(verify, { sleep: noSleep })).toBeNull();
  });
  it('the retry wait is bounded (default 250 ms, single wait)', async () => {
    const waits: number[] = [];
    await verifyWithOneRetry(async () => { throw err('app/network-error'); }, { sleep: async (ms) => { waits.push(ms); } });
    expect(waits).toEqual([250]);
  });
  it('recognizes nested error codes and code-less fetch failures; nothing else', () => {
    expect(isTransientVerifyError({ errorInfo: { code: 'app/network-error' } })).toBe(true);
    expect(isTransientVerifyError(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }))).toBe(true);
    expect(isTransientVerifyError(new TypeError('fetch failed'))).toBe(true);
    expect(isTransientVerifyError(new Error('Decoding Firebase session cookie failed'))).toBe(false);
    expect(isTransientVerifyError(null)).toBe(false);
  });
});

describe('P05-B4 /command-login redirect for an already-verified owner', () => {
  const OWNER = 'owner_fixture_only_uid';
  const COOKIE = 'fixture-session-'.repeat(5);
  beforeEach(() => { vi.stubEnv('PARALLAX_OWNER_UID', OWNER); sessionVerifier.mockReset(); });
  afterEach(() => vi.unstubAllEnvs());
  const hit = async (cookie?: string) => {
    const { middleware } = await import('@/middleware');
    return middleware(new NextRequest('https://command.parallaxvinc.com/command-login', { headers: cookie ? { cookie } : {} }));
  };
  const redirectedTo = (res: Response) => res.headers.get('location');

  it('verified owner session redirects to /command-center', async () => {
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: 'password' });
    const res = await hit(`__session=${COOKIE}`);
    expect(res.status).toBe(307);
    expect(redirectedTo(res)).toBe('https://command.parallaxvinc.com/command-center');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each([
    ['no cookie', undefined, null],
    ['invalid/expired/revoked session (verifier rejects)', `__session=${COOKIE}`, null],
    ['wrong owner', `__session=${COOKIE}`, { uid: 'someone-else-uid-123', signInProvider: 'password' }],
    ['non-interactive provider (custom token)', `__session=${COOKIE}`, { uid: OWNER, signInProvider: 'custom' }],
    ['malformed cookie', '__session=bad', null],
    ['duplicate session cookies', `__session=${COOKIE}; __session=${COOKIE}x`, { uid: OWNER, signInProvider: 'password' }],
  ])('%s: the login page is served, no redirect', async (_n, cookie, verified) => {
    sessionVerifier.mockResolvedValue(verified);
    const res = await hit(cookie);
    expect(redirectedTo(res)).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
  it('owner not configured: login page served (and the cockpit itself stays denied)', async () => {
    vi.stubEnv('PARALLAX_OWNER_UID', '');
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: 'password' });
    const res = await hit(`__session=${COOKIE}`);
    expect(redirectedTo(res)).toBeNull();
    const { middleware } = await import('@/middleware');
    const cc = await middleware(new NextRequest('https://command.parallaxvinc.com/command-center/chat', { headers: { cookie: `__session=${COOKIE}` } }));
    expect(cc.headers.get('location')).toBe('https://command.parallaxvinc.com/command-login');
  });
  it('the middleware matcher covers /command-login', async () => {
    const { config } = await import('@/middleware');
    expect(config.matcher).toContain('/command-login');
  });
});
