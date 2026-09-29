import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardServiceCaller, guardOwnerOrService, hasServiceCredential, MIN_SERVICE_SECRET_LENGTH } from './service-caller';
import { twilioSignatureMatches } from './twilio-webhook-guard';
import { createHmac } from 'node:crypto';

const { sessionVerifier } = vi.hoisted(() => ({ sessionVerifier: vi.fn() }));
vi.mock('@/lib/firebase-admin', async (importOriginal) => ({ ...(await importOriginal<object>()), verifySessionCookie: sessionVerifier }));

const CRON = 'fixture-cron-bearer-0123456789';
const req = (headers: Record<string, string>, method = 'POST') => new Request('https://cockpit.example/api/x', { method, headers });

beforeEach(() => {
  vi.stubEnv('PARALLAX_CRON_TOKEN', CRON);
  vi.stubEnv('BRIDGE_API_SECRET', 'fixture-bridge-secret-0123456789');
  vi.stubEnv('PARALLAX_OWNER_UID', 'owner_fixture_only');
  vi.stubEnv('PARALLAX_TRUSTED_ORIGINS', 'https://cockpit.example');
  vi.stubEnv('PARALLAX_CSRF_SECRET', 'fixture-not-a-real-secret-'.repeat(3));
  sessionVerifier.mockResolvedValue({ uid: 'owner_fixture_only', signInProvider: 'password' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('guardServiceCaller', () => {
  it('accepts the exact bearer and returns a service principal, never the owner uid', async () => {
    const r = await guardServiceCaller(req({ authorization: `Bearer ${CRON}` }), 'cron');
    expect(r).toMatchObject({ ok: true, principal: 'service:cron', kind: 'service' });
    expect(JSON.stringify(r)).not.toContain('owner_fixture_only');
  });
  it('ignores request-supplied identity fields', async () => {
    const r = await guardServiceCaller(req({ authorization: `Bearer ${CRON}`, 'x-ramon-uid': 'owner_fixture_only' }), 'cron');
    expect(r.ok && r.principal).toBe('service:cron');
  });
  it.each([
    ['missing', {}],
    ['wrong scheme', { authorization: `Basic ${CRON}` }],
    ['prefix only', { authorization: `Bearer ${CRON.slice(0, -1)}` }],
    ['suffix extra', { authorization: `Bearer ${CRON}x` }],
    ['two values', { authorization: `Bearer ${CRON}, Bearer ${CRON}` }],
    ['empty', { authorization: 'Bearer ' }],
  ])('denies %s', async (_n, h) => {
    const r = await guardServiceCaller(req(h as Record<string, string>), 'cron');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
  it('fails closed with 503 when not configured or too short', async () => {
    vi.stubEnv('PARALLAX_CRON_TOKEN', '');
    let r = await guardServiceCaller(req({ authorization: `Bearer ${CRON}` }), 'cron');
    expect(!r.ok && r.status).toBe(503);
    vi.stubEnv('PARALLAX_CRON_TOKEN', 'x'.repeat(MIN_SERVICE_SECRET_LENGTH - 1));
    r = await guardServiceCaller(req({ authorization: `Bearer ${'x'.repeat(MIN_SERVICE_SECRET_LENGTH - 1)}` }), 'cron');
    expect(!r.ok && r.status).toBe(503);
  });
  it('fails closed for services whose credential is not issued yet (vapi)', async () => {
    const r = await guardServiceCaller(req({ 'x-vapi-secret': 'anything-long-enough-000000' }), 'vapi');
    expect(!r.ok && r.status).toBe(503);
  });
  it('bridge uses its existing header', async () => {
    expect((await guardServiceCaller(req({ 'x-bridge-secret': 'fixture-bridge-secret-0123456789' }), 'bridge')).ok).toBe(true);
    expect((await guardServiceCaller(req({ authorization: 'Bearer fixture-bridge-secret-0123456789' }), 'bridge')).ok).toBe(false);
  });
});

describe('guardOwnerOrService', () => {
  it('uses only the service path when the service header is present (no cookie rescue)', async () => {
    const r = await guardOwnerOrService(req({ authorization: 'Bearer wrong-wrong-wrong-wrong', cookie: `__session=${'fixture-session-'.repeat(5)}` }), 'cron', 'read');
    expect(r.ok).toBe(false);
    expect(hasServiceCredential(req({ authorization: 'x' }), 'cron')).toBe(true);
  });
  it('falls back to the P03 owner read boundary when no service header is present', async () => {
    const r = await guardOwnerOrService(req({ cookie: `__session=${'fixture-session-'.repeat(5)}` }, 'GET'), 'cron', 'read');
    expect(r).toMatchObject({ ok: true, kind: 'owner', uid: 'owner_fixture_only' });
  });
  it('denies the owner mutation path without origin/CSRF', async () => {
    const r = await guardOwnerOrService(req({ cookie: `__session=${'fixture-session-'.repeat(5)}` }), 'cron', 'mutation');
    expect(r.ok).toBe(false);
  });
  it('accepts a valid cron bearer as service, not owner', async () => {
    const r = await guardOwnerOrService(req({ authorization: `Bearer ${CRON}` }), 'cron', 'mutation');
    expect(r).toMatchObject({ ok: true, kind: 'service', principal: 'service:cron' });
  });
});

describe('twilioSignatureMatches', () => {
  const token = 'fixture-twilio-auth';
  const url = 'https://command.parallaxvinc.com/api/command-center/voice/twiml';
  const params = { To: '+15555550101', record: 'false' };
  const good = createHmac('sha1', token).update(url + 'To+15555550101recordfalse').digest('base64');
  it('accepts the exact signature', () => expect(twilioSignatureMatches(token, url, params, good)).toBe(true));
  it('rejects altered params, url, signature, missing token', () => {
    expect(twilioSignatureMatches(token, url, { ...params, To: '+15555550102' }, good)).toBe(false);
    expect(twilioSignatureMatches(token, url + '?x=1', params, good)).toBe(false);
    expect(twilioSignatureMatches(token, url, params, good.slice(0, -2) + 'AA')).toBe(false);
    expect(twilioSignatureMatches('', url, params, good)).toBe(false);
    expect(twilioSignatureMatches(token, url, params, null)).toBe(false);
  });
});
