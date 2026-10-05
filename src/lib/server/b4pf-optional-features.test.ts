import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueCsrfToken } from './csrf';

/**
 * P05-B4 preflight: Twilio and CC_PUSH_SECRET are OPTIONAL features. With them absent,
 * those features must be unavailable and fail closed, the core cockpit must keep working,
 * and neither absence may open an unauthenticated path.
 */
const { sessionVerifier, admin } = vi.hoisted(() => ({ sessionVerifier: vi.fn(), admin: { client: null as unknown } }));
vi.mock('@/lib/firebase-admin', async (o) => ({ ...(await o<object>()), verifySessionCookie: sessionVerifier }));
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => admin.client }));

const OWNER = 'owner_fixture_only';
const COOKIE = 'fixture-session-'.repeat(5);
const ORIGIN = 'https://cockpit.example';
const CH = '5b9a0c1e-1111-4222-8333-944455556666';
const TWILIO_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_PHONE_NUMBER'];

function fakeClient() {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'in', 'not', 'insert', 'single', 'maybeSingle']) q[m] = () => q;
  (q as { then: unknown }).then = (res: (v: unknown) => void) => res({ data: [{ id: 'row' }], error: null });
  return { from: () => q, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: async () => {} };
}
beforeEach(() => {
  vi.stubEnv('PARALLAX_OWNER_UID', OWNER);
  vi.stubEnv('PARALLAX_TRUSTED_ORIGINS', ORIGIN);
  vi.stubEnv('PARALLAX_CSRF_SECRET', 'fixture-not-a-real-secret-'.repeat(3));
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co');
  for (const k of TWILIO_KEYS) vi.stubEnv(k, '');
  vi.stubEnv('CC_PUSH_SECRET', '');
  sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: 'password' });
  admin.client = fakeClient();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no provider call may happen'); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const owner = (mutation = false): Record<string, string> => {
  const h: Record<string, string> = { cookie: `__session=${COOKIE}`, 'content-type': 'application/json' };
  if (mutation) { h.origin = ORIGIN; const t = issueCsrfToken(COOKIE); if (t.ok) h['x-parallax-csrf'] = t.token; }
  return h;
};
const req = (path: string, method: string, headers: Record<string, string>, body?: unknown) =>
  new NextRequest(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

describe('Twilio absent: dialer unavailable, fails closed, no auth weakening', () => {
  it('voice/token: owner gets {needsSetup:true}, never a token', async () => {
    const { GET } = await import('@/app/api/command-center/voice/token/route');
    const res = await GET(req('/api/command-center/voice/token', 'GET', owner()));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toEqual({ needsSetup: true });
  });
  it('voice/token without a session is still 401 (absence opens nothing)', async () => {
    sessionVerifier.mockResolvedValue(null);
    const { GET } = await import('@/app/api/command-center/voice/token/route');
    expect((await GET(req('/api/command-center/voice/token', 'GET', {}))).status).toBe(401);
  });
  it('voice/twiml refuses (not configured) and never emits TwiML', async () => {
    const { POST } = await import('@/app/api/command-center/voice/twiml/route');
    const res = await POST(new NextRequest(`${ORIGIN}/api/command-center/voice/twiml`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': 'x' }, body: 'To=%2B15555550100' }));
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(await res.text()).not.toContain('<Dial');
  });
  it('voice/recording/start: owner gets 503 twilio_not_configured, definite not-recording, no provider call', async () => {
    const { POST } = await import('@/app/api/command-center/voice/recording/start/route');
    const res = await POST(req('/api/command-center/voice/recording/start', 'POST', owner(true), { callSid: 'CA' + 'a'.repeat(32), leadId: CH, consentConfirmed: true }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ recording: false, definite: true, error: 'twilio_not_configured' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('voice/recording/start without CSRF is still refused before any config check', async () => {
    const { POST } = await import('@/app/api/command-center/voice/recording/start/route');
    expect((await POST(req('/api/command-center/voice/recording/start', 'POST', owner(false), { consentConfirmed: true }))).status).toBe(403);
  });
});

describe('CC_PUSH_SECRET absent: push unavailable, fails closed, no auth weakening', () => {
  it('push POST with any header is 503 (service not configured), never inserts', async () => {
    const { POST } = await import('@/app/api/command-center/push/route');
    const insert = vi.fn();
    admin.client = { from: () => ({ insert }) };
    const res = await POST(req('/api/command-center/push', 'POST', { 'x-cc-push-secret': 'x'.repeat(40), 'content-type': 'application/json' }, { agentId: 'atlas', content: 'hi' }));
    expect(res.status).toBe(503);
    expect(insert).not.toHaveBeenCalled();
  });
  it('an owner browser session cannot push either (machine-only route)', async () => {
    const { POST } = await import('@/app/api/command-center/push/route');
    const res = await POST(req('/api/command-center/push', 'POST', owner(true), { agentId: 'atlas', content: 'hi' }));
    expect([401, 503]).toContain(res.status);
  });
  it('no signature can verify without the secret, so the SSE push scope relays nothing', async () => {
    const { pushSignature, verifyPushSignature } = await import('./cockpit-chat-data');
    expect(pushSignature(CH, CH, 'atlas', 'hi', Date.now())).toBeNull();
    expect(verifyPushSignature(CH, CH, 'atlas', 'hi', 'a'.repeat(64), Date.now())).toBe(false);
  });
  it('the SSE push scope still requires the owner session', async () => {
    sessionVerifier.mockResolvedValue(null);
    const { GET } = await import('@/app/api/command-center/chat/events/route');
    expect((await GET(req('/api/command-center/chat/events?scope=push', 'GET', {}))).status).toBe(401);
  });
});

describe('Core cockpit stays healthy with both optional features absent', () => {
  it('chat history and send work for the owner', async () => {
    const { GET, POST } = await import('@/app/api/command-center/chat/messages/route');
    expect((await GET(req(`/api/command-center/chat/messages?channelId=${CH}`, 'GET', owner()))).status).toBe(200);
    expect((await POST(req('/api/command-center/chat/messages', 'POST', owner(true), { channelId: CH, content: 'hello' }))).status).toBe(200);
  });
  it('bootstrap works, and still denies without a session', async () => {
    const { GET } = await import('@/app/api/command-center/chat/bootstrap/route');
    expect((await GET(req('/api/command-center/chat/bootstrap', 'GET', owner()))).status).toBe(200);
    sessionVerifier.mockResolvedValue(null);
    expect((await GET(req('/api/command-center/chat/bootstrap', 'GET', {}))).status).toBe(401);
  });
  it('/api/health answers 200 (the watchdog probe target)', async () => {
    const { GET } = await import('@/app/api/health/route');
    expect((await GET()).status).toBe(200);
  });
});
