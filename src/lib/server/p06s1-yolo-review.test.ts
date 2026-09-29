import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueCsrfToken } from './csrf';

// P06-S1: /api/yolo-review must enforce the cockpit owner boundary before ANY Firestore access.
const { sessionVerifier, fs } = vi.hoisted(() => ({
  sessionVerifier: vi.fn(),
  fs: { calls: [] as unknown[][], empty: false },
}));
vi.mock('@/lib/firebase-admin', () => ({ verifySessionCookie: sessionVerifier }));
vi.mock('firebase-admin/app', () => ({
  getApps: () => { fs.calls.push(['getApps']); return [{}]; },
  initializeApp: () => { fs.calls.push(['initializeApp']); },
  cert: () => ({}),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => {
    fs.calls.push(['getFirestore']);
    const ref = {
      update: async (d: unknown) => { fs.calls.push(['update', d]); },
      get: async () => ({ id: 'b1', data: () => ({ folder: 'b1', reviewStatus: 'approved' }) }),
    };
    const q = {
      where: (...a: unknown[]) => { fs.calls.push(['where', ...a]); return q; },
      orderBy: (...a: unknown[]) => { fs.calls.push(['orderBy', ...a]); return q; },
      limit: () => q,
      get: async () => ({ empty: fs.empty, docs: fs.empty ? [] : [{ id: 'b1', ref, data: () => ({ folder: 'b1' }) }] }),
      doc: (id: string) => { fs.calls.push(['doc', id]); return ref; },
    };
    return {
      collection: (n: string) => { fs.calls.push(['collection', n]); return q; },
      batch: () => ({ set: (...a: unknown[]) => { fs.calls.push(['batch.set', ...a]); }, commit: async () => { fs.calls.push(['commit']); } }),
    };
  },
}));

const OWNER = 'owner_fixture_only_uid';
const COOKIE = 'fixture-session-'.repeat(5);
const ORIGIN = 'https://cockpit.example';
const URL_ = `${ORIGIN}/api/yolo-review`;

beforeEach(() => {
  vi.stubEnv('PARALLAX_OWNER_UID', OWNER);
  vi.stubEnv('PARALLAX_TRUSTED_ORIGINS', ORIGIN);
  vi.stubEnv('PARALLAX_CSRF_SECRET', 'fixture-not-a-real-secret-'.repeat(3));
  sessionVerifier.mockReset();
  sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: 'password' });
  fs.calls = []; fs.empty = false;
});
afterEach(() => { vi.unstubAllEnvs(); });

type Opts = { cookie?: string | null; origin?: string | null; csrf?: string | null; body?: unknown };
function req(method: string, o: Opts = {}) {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const cookie = o.cookie === undefined ? COOKIE : o.cookie;
  if (cookie !== null) h.cookie = `__session=${cookie}`;
  if (method !== 'GET') {
    const origin = o.origin === undefined ? ORIGIN : o.origin;
    if (origin !== null) h.origin = origin;
    let csrf = o.csrf;
    if (csrf === undefined) { const t = issueCsrfToken(cookie ?? COOKIE); csrf = t.ok ? t.token : null; }
    if (csrf !== null) h['x-parallax-csrf'] = csrf;
  }
  return new NextRequest(URL_, { method, headers: h, body: method === 'GET' ? undefined : JSON.stringify(o.body ?? { folder: 'b1', reviewStatus: 'approved' }) });
}
const route = () => import('@/app/api/yolo-review/route');
const call = async (method: 'GET' | 'PATCH' | 'POST', o: Opts = {}) => {
  const r = await route();
  const body = method === 'POST' && o.body === undefined ? [{ folder: 'b1', name: 'B1' }] : o.body;
  return r[method](req(method, { ...o, body }));
};
const firestoreTouched = () => fs.calls.length > 0;

describe('P06-S1 /api/yolo-review: denials perform no Firestore access', () => {
  const methods = ['GET', 'PATCH', 'POST'] as const;

  it.each(methods)('%s: missing session -> 401, no Firestore', async (m) => {
    const res = await call(m, { cookie: null });
    expect(res.status).toBe(401);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(methods)('%s: forged/unverifiable session (verifier rejects) -> 401, no Firestore', async (m) => {
    sessionVerifier.mockRejectedValue(Object.assign(new Error('bad'), { code: 'auth/argument-error' }));
    const res = await call(m);
    expect(res.status).toBe(401);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(methods)('%s: expired or revoked session (verifier returns null) -> 401, no Firestore', async (m) => {
    sessionVerifier.mockResolvedValue(null);
    const res = await call(m);
    expect(res.status).toBe(401);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(methods)('%s: malformed cookie -> 401, no Firestore', async (m) => {
    const res = await call(m, { cookie: 'bad' });
    expect(res.status).toBe(401);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(methods)('%s: authenticated non-owner -> 403, no Firestore', async (m) => {
    sessionVerifier.mockResolvedValue({ uid: 'someone-else-uid-123', signInProvider: 'password' });
    const res = await call(m);
    expect(res.status).toBe(403);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(methods)('%s: owner not configured -> fails closed (503), no Firestore', async (m) => {
    vi.stubEnv('PARALLAX_OWNER_UID', '');
    const res = await call(m);
    expect(res.status).toBe(503);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(['PATCH', 'POST'] as const)('%s: missing Origin -> 403, no Firestore', async (m) => {
    const res = await call(m, { origin: null });
    expect(res.status).toBe(403);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(['PATCH', 'POST'] as const)('%s: foreign Origin -> 403, no Firestore', async (m) => {
    const res = await call(m, { origin: 'https://ramiche-site.vercel.app' });
    expect(res.status).toBe(403);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(['PATCH', 'POST'] as const)('%s: missing CSRF token -> denied, no Firestore', async (m) => {
    const res = await call(m, { csrf: null });
    expect(res.status).toBe(403);
    expect(firestoreTouched()).toBe(false);
  });
  it.each(['PATCH', 'POST'] as const)('%s: CSRF token bound to a different session -> denied, no Firestore', async (m) => {
    const t = issueCsrfToken('other-session-'.repeat(5));
    const res = await call(m, { csrf: t.ok ? t.token : 'x' });
    expect(res.status).toBe(403);
    expect(firestoreTouched()).toBe(false);
  });
  it('identity claims in the body or headers grant nothing', async () => {
    const r = await route();
    const res = await r.PATCH(new NextRequest(URL_, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-parallax-owner': OWNER, 'x-forwarded-host': 'command.parallaxvinc.com', authorization: `Bearer ${OWNER}` },
      body: JSON.stringify({ folder: 'b1', reviewStatus: 'approved', uid: OWNER, approvedBy: 'Ramon' }),
    }));
    expect(res.status).toBe(401);
    expect(firestoreTouched()).toBe(false);
  });
});

describe('P06-S1 /api/yolo-review: owner behaviour preserved', () => {
  it('GET as owner reads yolo_builds ordered by date', async () => {
    const res = await call('GET');
    expect(res.status).toBe(200);
    expect(fs.calls).toContainEqual(['collection', 'yolo_builds']);
    expect(fs.calls).toContainEqual(['orderBy', 'date', 'desc']);
  });
  it.each(['approved', 'rejected', 'pending'])('PATCH as owner sets reviewStatus=%s', async (s) => {
    const res = await call('PATCH', { body: { folder: 'b1', reviewStatus: s } });
    expect(res.status).toBe(200);
    const upd = fs.calls.find((c) => c[0] === 'update')?.[1] as Record<string, unknown>;
    expect(upd.reviewStatus).toBe(s);
    expect(typeof upd.reviewedAt).toBe('string');
  });
  it('PATCH as owner: unknown build -> 404, no update', async () => {
    fs.empty = true;
    const res = await call('PATCH');
    expect(res.status).toBe(404);
    expect(fs.calls.find((c) => c[0] === 'update')).toBeUndefined();
  });
  it.each([
    ['missing folder', { reviewStatus: 'approved' }],
    ['unknown status', { folder: 'b1', reviewStatus: 'deployed' }],
    ['non-string folder', { folder: { $gt: '' }, reviewStatus: 'approved' }],
    ['oversized folder', { folder: 'x'.repeat(201), reviewStatus: 'approved' }],
  ])('PATCH as owner rejects %s with 400 and no Firestore write', async (_n, body) => {
    const res = await call('PATCH', { body });
    expect(res.status).toBe(400);
    expect(fs.calls.find((c) => c[0] === 'update')).toBeUndefined();
  });
  it('POST as owner seeds builds with default pending status', async () => {
    const res = await call('POST', { body: [{ folder: 'b1', name: 'B1' }] });
    expect(res.status).toBe(200);
    expect(fs.calls).toContainEqual(['commit']);
    const set = fs.calls.find((c) => c[0] === 'batch.set');
    expect(set?.[2]).toMatchObject({ folder: 'b1', reviewStatus: 'pending' });
  });
  it('POST as owner rejects a non-array body with 400 and no write', async () => {
    const res = await call('POST', { body: { folder: 'b1' } });
    expect(res.status).toBe(400);
    expect(fs.calls.find((c) => c[0] === 'commit')).toBeUndefined();
  });
});
