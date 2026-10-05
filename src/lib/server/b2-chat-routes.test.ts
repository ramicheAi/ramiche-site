import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueCsrfToken } from './csrf';

const { sessionVerifier, admin } = vi.hoisted(() => ({ sessionVerifier: vi.fn(), admin: { calls: [] as unknown[][], client: null as unknown } }));
vi.mock('@/lib/firebase-admin', async (importOriginal) => ({ ...(await importOriginal<object>()), verifySessionCookie: sessionVerifier }));

// Minimal chainable fake of the service-role supabase-js client that records every call.
function fakeClient(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'in', 'not', 'insert', 'single']) {
    q[m] = (...args: unknown[]) => { admin.calls.push([m, ...args]); return q; };
  }
  (q as { then: unknown }).then = (res: (v: unknown) => void) => res(result);
  return { from: (table: string) => { admin.calls.push(['from', table]); return q; } };
}
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => admin.client }));

const OWNER = 'owner_fixture_only';
const COOKIE = 'fixture-session-'.repeat(5);
const ORIGIN = 'https://cockpit.example';
const CH = '5b9a0c1e-1111-4222-8333-944455556666';
beforeEach(() => {
  vi.stubEnv('PARALLAX_OWNER_UID', OWNER);
  vi.stubEnv('PARALLAX_TRUSTED_ORIGINS', ORIGIN);
  vi.stubEnv('PARALLAX_CSRF_SECRET', 'fixture-not-a-real-secret-'.repeat(3));
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co');
  sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: 'password' });
  admin.calls = [];
  admin.client = fakeClient({ data: [{ id: 'row' }], error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function ownerHeaders(mutation: boolean): Record<string, string> {
  const h: Record<string, string> = { cookie: `__session=${COOKIE}`, 'content-type': 'application/json' };
  if (mutation) { h.origin = ORIGIN; const t = issueCsrfToken(COOKIE); if (t.ok) h['x-parallax-csrf'] = t.token; }
  return h;
}
const get = (path: string) => new NextRequest(`${ORIGIN}${path}`, { method: 'GET', headers: ownerHeaders(false) });
const post = (path: string, body: unknown) => new NextRequest(`${ORIGIN}${path}`, { method: 'POST', headers: ownerHeaders(true), body: JSON.stringify(body) });

describe('P05-B2 chat data routes (owner session, service role)', () => {
  it('GET messages returns rows for a valid channel and queries only that channel', async () => {
    const { GET } = await import('@/app/api/command-center/chat/messages/route');
    const res = await GET(get(`/api/command-center/chat/messages?channelId=${CH}&limit=500&order=desc`));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ data: [{ id: 'row' }], error: null });
    expect(admin.calls).toContainEqual(['from', 'messages']);
    expect(admin.calls).toContainEqual(['eq', 'channel_id', CH]);
    expect(admin.calls).toContainEqual(['limit', 200]); // clamped
  });
  it('GET messages rejects a non-UUID channel id before querying', async () => {
    const { GET } = await import('@/app/api/command-center/chat/messages/route');
    const res = await GET(get('/api/command-center/chat/messages?channelId=x%27%20or%201=1'));
    expect(res.status).toBe(400);
    expect(admin.calls).toHaveLength(0);
  });
  it('POST messages fixes sender, tenant, status and source server-side, ignoring hostile body fields', async () => {
    admin.client = fakeClient({ data: { id: 'new-id' }, error: null });
    const { POST } = await import('@/app/api/command-center/chat/messages/route');
    const res = await POST(post('/api/command-center/chat/messages', {
      channelId: CH, content: 'hello', attachments: [{ url: '/local.png', name: 'a', type: 'image/png' }], threadParentId: null,
      metadata: { targetAgent: 'atlas', isDM: false, channelName: '#x', source: 'forged', approvedBy: 'ramon' },
      sender_user_id: 'attacker', sender_type: 'agent', tenant_id: 'other', status: 'read',
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { id: 'new-id' } });
    const insert = admin.calls.find((c) => c[0] === 'insert')?.[1] as Record<string, unknown>;
    expect(insert).toMatchObject({ channel_id: CH, sender_user_id: '00000000-0000-0000-0000-000000000001', sender_type: 'user', tenant_id: '11111111-1111-1111-1111-111111111111', status: 'sent', content: 'hello' });
    expect((insert.metadata as Record<string, unknown>).source).toBe('command-center-ui');
    expect(insert.metadata).not.toHaveProperty('approvedBy');
  });
  it.each([
    ['empty content', { channelId: CH, content: '   ' }],
    ['bad channel', { channelId: 'nope', content: 'x' }],
    ['foreign attachment host', { channelId: CH, content: 'x', attachments: [{ url: 'https://evil.example/a.png' }] }],
    ['protocol-relative attachment', { channelId: CH, content: 'x', attachments: [{ url: '//evil.example/a.png' }] }],
    ['bad thread parent', { channelId: CH, content: 'x', threadParentId: 'x' }],
    ['oversized content', { channelId: CH, content: 'x'.repeat(20001) }],
  ])('POST messages rejects %s without inserting', async (_n, body) => {
    const { POST } = await import('@/app/api/command-center/chat/messages/route');
    const res = await POST(post('/api/command-center/chat/messages', body));
    expect(res.status).toBe(400);
    expect(admin.calls.find((c) => c[0] === 'insert')).toBeUndefined();
  });
  it('POST messages accepts our own storage public URL', async () => {
    admin.client = fakeClient({ data: { id: 'n' }, error: null });
    const { POST } = await import('@/app/api/command-center/chat/messages/route');
    const res = await POST(post('/api/command-center/chat/messages', { channelId: CH, content: 'x', attachments: [{ url: 'https://fixture.supabase.co/storage/v1/object/public/agent-output/agent/a.png', type: 'image/png' }] }));
    expect(res.status).toBe(200);
  });
  it('GET reactions validates ids and queries only those messages', async () => {
    const { GET } = await import('@/app/api/command-center/chat/reactions/route');
    expect((await GET(get(`/api/command-center/chat/reactions?messageIds=${CH},bad`))).status).toBe(400);
    const res = await GET(get(`/api/command-center/chat/reactions?messageIds=${CH}`));
    expect(res.status).toBe(200);
    expect(admin.calls).toContainEqual(['in', 'message_id', [CH]]);
  });
  it('GET bootstrap returns channels and agents via the service role', async () => {
    const { GET } = await import('@/app/api/command-center/chat/bootstrap/route');
    const res = await GET(get('/api/command-center/chat/bootstrap'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ channels: [{ id: 'row' }], agents: [{ id: 'row' }], error: null });
  });
  it('GET gallery outputs returns messages with attachments and channel names', async () => {
    const { GET } = await import('@/app/api/command-center/gallery/outputs/route');
    const res = await GET(get('/api/command-center/gallery/outputs'));
    expect(res.status).toBe(200);
    expect(admin.calls).toContainEqual(['not', 'attachments', 'is', null]);
  });
  it('GET events requires a UUID channel unless scope=pulse', async () => {
    const { GET } = await import('@/app/api/command-center/chat/events/route');
    expect((await GET(get('/api/command-center/chat/events?channelId=nope'))).status).toBe(400);
  });
  it('reactions POST ignores a request-supplied userId', async () => {
    const src = (await import('node:fs')).readFileSync('src/app/api/command-center/chat/reactions/route.ts', 'utf8');
    expect(src).not.toMatch(/body\.userId/);
  });
  it('routes fail closed (503) when the service role is not configured', async () => {
    admin.client = null;
    const { GET } = await import('@/app/api/command-center/chat/messages/route');
    expect((await GET(get(`/api/command-center/chat/messages?channelId=${CH}`))).status).toBe(503);
  });
});

describe('P05-B2 browser code no longer uses the anon client for chat tables', () => {
  it.each(['src/app/command-center/chat/page.tsx', 'src/app/command-center/gallery/outputs/page.tsx', 'src/hooks/useChatPulse.ts'])('%s has no @/lib/supabase import', async (f) => {
    const src = (await import('node:fs')).readFileSync(f, 'utf8');
    expect(src).not.toMatch(/from "@\/lib\/supabase"/);
    expect(src).not.toMatch(/\.from\("(messages|message_reactions|channels|agent_profiles)"\)/);
  });
});

describe('P05-B2 review fixes', () => {
  it.each(['/\\evil.example/a.png', '/a/../../x', '/a\u0000b', 'javascript:alert(1)', 'data:text/html,x', 'http://evil.example/a.png'])(
    'sanitizeAttachments rejects %j even for trusted machine callers', async (url) => {
      const { sanitizeAttachments } = await import('./cockpit-chat-data');
      expect(sanitizeAttachments([{ url }], 'https://fixture.supabase.co', { allowHttps: true })).toBeNull();
      expect(sanitizeAttachments([{ url }], 'https://fixture.supabase.co')).toBeNull();
    });
  it('sanitizeAttachments admits external https only with allowHttps', async () => {
    const { sanitizeAttachments } = await import('./cockpit-chat-data');
    expect(sanitizeAttachments([{ url: 'https://cdn.example/a.png' }], 'https://fixture.supabase.co')).toBeNull();
    expect(sanitizeAttachments([{ url: 'https://cdn.example/a.png' }], 'https://fixture.supabase.co', { allowHttps: true })).toEqual([{ url: 'https://cdn.example/a.png' }]);
  });
  it('POST messages rejects a backslash attachment path', async () => {
    const { POST } = await import('@/app/api/command-center/chat/messages/route');
    const res = await POST(post('/api/command-center/chat/messages', { channelId: CH, content: 'x', attachments: [{ url: '/\\evil.example/a.png' }] }));
    expect(res.status).toBe(400);
  });
  it('events accepts scope=push (owner-only) and fails closed without the service role', async () => {
    admin.client = null;
    const { GET } = await import('@/app/api/command-center/chat/events/route');
    expect((await GET(get('/api/command-center/chat/events?scope=push'))).status).toBe(503);
  });
  it('push route no longer broadcasts on the public cc-push channel and PushToast uses the SSE relay', async () => {
    const fs = await import('node:fs');
    const route = fs.readFileSync('src/app/api/command-center/push/route.ts', 'utf8');
    expect(route).not.toMatch(/\.channel\(/);
    expect(route).toMatch(/speak: !!body\.speak,\s*agentId/);
    expect(route).toMatch(/sender_agent_id: AGENT_DM_UUID\[/);
    const toast = fs.readFileSync('src/components/command-center/PushToast.tsx', 'utf8');
    expect(toast).not.toMatch(/@\/lib\/supabase/);
    expect(toast).toMatch(/chat\/events\?scope=push/);
  });
  it('no command-center browser code imports the anon Supabase client', async () => {
    const { execSync } = await import('node:child_process');
    const hits = execSync('grep -rlE "from [\\"\']@/lib/supabase[\\"\']" src/app/command-center src/components/command-center src/hooks || true', { encoding: 'utf8' }).trim();
    expect(hits).toBe('');
  });
  describe('chat/webhook input validation (service caller)', () => {
    const TOKEN = 'fixture-webhook-token-'.repeat(2);
    const hook = (body: unknown) => new NextRequest(`${ORIGIN}/api/command-center/chat/webhook`, {
      method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    beforeEach(() => { vi.stubEnv('OPENCLAW_CC_WEBHOOK_TOKEN', TOKEN); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-fixture'); });
    it.each([
      ['non-UUID channel', { agentId: 'atlas', channelId: 'x', content: 'hi' }],
      ['javascript attachment', { agentId: 'atlas', channelId: CH, content: 'hi', attachments: [{ url: 'javascript:alert(1)' }] }],
      ['oversized content', { agentId: 'atlas', channelId: CH, content: 'x'.repeat(20001) }],
    ])('rejects %s with 400', async (_n, body) => {
      const { POST } = await import('@/app/api/command-center/chat/webhook/route');
      expect((await POST(hook(body))).status).toBe(400);
    });
    it('does not fall back to the anon key when the service role is missing (503)', async () => {
      const { POST } = await import('@/app/api/command-center/chat/webhook/route');
      expect((await POST(hook({ agentId: 'atlas', channelId: CH, content: 'hi' }))).status).toBe(503);
    });
  });
});

describe('P05-B2 Codex security fixes', () => {
  it('push signatures bind to the pre-allocated row id; copies on other rows, stale or malformed input fail', async () => {
    const { pushSignature, verifyPushSignature, PUSH_MAX_AGE_MS } = await import('./cockpit-chat-data');
    const now = 1_800_000_000_000;
    const ROW = 'bbbbbbbb-0000-4000-8000-000000000001';
    const COPY = 'bbbbbbbb-0000-4000-8000-000000000002';
    vi.stubEnv('CC_PUSH_SECRET', '');
    expect(pushSignature(ROW, CH, 'atlas', 'hi', now)).toBeNull();
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi', 'a'.repeat(64), now, now)).toBe(false);
    vi.stubEnv('CC_PUSH_SECRET', 'fixture-push-secret-'.repeat(2));
    const sig = pushSignature(ROW, CH, 'atlas', 'hi', now)!;
    // A copy onto a new row fails even if it is the first one any stream sees (Codex re-check 3).
    expect(verifyPushSignature(COPY, CH, 'atlas', 'hi', sig, now, now)).toBe(false);
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi!', sig, now, now)).toBe(false);
    expect(verifyPushSignature(ROW, CH, 'triage', 'hi', sig, now, now)).toBe(false);
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi', sig, now + 1, now)).toBe(false);
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi', sig, now, now + PUSH_MAX_AGE_MS + 1)).toBe(false);
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi', 'é'.repeat(64), now, now)).toBe(false); // must not throw
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi', sig.toUpperCase(), now, now)).toBe(false);
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi', sig, undefined, now)).toBe(false);
    expect(verifyPushSignature('not-a-uuid', CH, 'atlas', 'hi', sig, now, now)).toBe(false);
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi', sig, now, now)).toBe(true);
    expect(verifyPushSignature(ROW, CH, 'atlas', 'hi', sig, now, now + 10)).toBe(true); // same row, second owner tab
  });
  it.each(['/storage/%2e%2e/x', '/a/%2E%2e/b', '/a%2fb', '/a%5Cb'])('sanitizeAttachments rejects encoded traversal %j', async (url) => {
    const { sanitizeAttachments } = await import('./cockpit-chat-data');
    expect(sanitizeAttachments([{ url }], 'https://fixture.supabase.co')).toBeNull();
    expect(sanitizeAttachments([{ url: `https://fixture.supabase.co/storage/v1/object/public/agent-output${url}` }], 'https://fixture.supabase.co')).toBeNull();
  });
  it('events route re-verifies the owner session, caps stream lifetime, filters reactions by channel and requires push signatures', async () => {
    const src = (await import('node:fs')).readFileSync('src/app/api/command-center/chat/events/route.ts', 'utf8');
    expect(src).toMatch(/const reauth = setInterval\(\(\) => \{\s*void guardPrivateRead\(req\)/);
    expect(src).toMatch(/setTimeout\(\(\) => cleanup\?\.\(\), MAX_STREAM_MS\)/);
    expect(src).toMatch(/channel_id !== channelId\) return;/);
    expect(src).toMatch(/verifyPushSignature\(row\.id, row\.channel_id, meta\.agentId, row\.content, meta\.pushSig, meta\.pushTs\)/);
    expect(src).toMatch(/if \(!messageId\) return;/);
    expect(src).toMatch(/catch \{ cleanup\?\.\(\); \}/);
    expect(src).toMatch(/if \(req\.signal\.aborted\) \{ cleanup\(\); return; \}/);
  });
  it('push route is machine-only (service "push") and stores a signature only for speak requests', async () => {
    const src = (await import('node:fs')).readFileSync('src/app/api/command-center/push/route.ts', 'utf8');
    expect(src).toMatch(/export async function POST\(req: NextRequest\) \{\s*const p03Guard = await guardServiceCaller\(req, "push"\);/);
    expect(src).toMatch(/body\.speak \? \{ pushTs, pushSig: pushSignature\(rowId, channelId, agentId, content, pushTs\) \}/);
    expect(src).toMatch(/const rowId = randomUUID\(\);[\s\S]*id: rowId,/);
    expect(src).toMatch(/let channelId = \(body\.channelId \?\? ""\)\.trim\(\)\.toLowerCase\(\);/);
  });
  it('push POST: missing/wrong secret 401, unconfigured 503, owner cookie alone cannot push', async () => {
    const { POST } = await import('@/app/api/command-center/push/route');
    const mk = (h: Record<string, string>) => new NextRequest(`${ORIGIN}/api/command-center/push`, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify({ agentId: 'atlas', content: 'hi' }) });
    vi.stubEnv('CC_PUSH_SECRET', '');
    expect((await POST(mk({ 'x-cc-push-secret': 'x'.repeat(40) }))).status).toBe(503);
    vi.stubEnv('CC_PUSH_SECRET', 'fixture-push-secret-'.repeat(2));
    expect((await POST(mk({ 'x-cc-push-secret': 'wrong-'.repeat(8) }))).status).toBe(401);
    expect((await POST(mk(ownerHeaders(true)))).status).toBe(401);
  });
});
