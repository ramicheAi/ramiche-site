import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';
import { issueCsrfToken } from './csrf';

const { sessionVerifier, db } = vi.hoisted(() => ({
  sessionVerifier: vi.fn(),
  db: { client: null as unknown, ops: [] as Array<{ table: string; ops: unknown[][] }> },
}));
vi.mock('@/lib/firebase-admin', async (orig) => ({ ...(await orig<object>()), verifySessionCookie: sessionVerifier }));
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => db.client }));

type Resolver = (table: string, ops: unknown[][]) => { data?: unknown; error?: { message: string } | null };
/** Chainable supabase-js fake: every chain is recorded; awaiting it asks the resolver. */
function fakeDb(resolve: Resolver) {
  return {
    from(table: string) {
      const rec = { table, ops: [] as unknown[][] };
      db.ops.push(rec);
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'not', 'limit', 'ilike', 'insert', 'update', 'maybeSingle', 'single', 'order', 'in', 'range', 'or']) {
        chain[m] = (...a: unknown[]) => { rec.ops.push([m, ...a]); return chain; };
      }
      chain.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
        try { const r = resolve(table, rec.ops); return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(ok, bad); }
        catch (e) { return Promise.reject(e).then(ok, bad); }
      };
      return chain;
    },
  };
}
const opsOf = (table: string, m: string) => db.ops.filter((o) => o.table === table && o.ops.some((x) => x[0] === m));

const OWNER = 'owner_fixture_only';
const COOKIE = 'fixture-session-'.repeat(5);
const ORIGIN = 'https://cockpit.example';
const SID = 'CA' + 'a'.repeat(32);
const LEAD = '5b9a0c1e-1111-4222-8333-944455556666';
const TWILIO = { TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32), TWILIO_AUTH_TOKEN: 'fixture-auth-token-0123456789', TWILIO_API_KEY_SID: 'SK' + '2'.repeat(32), TWILIO_API_KEY_SECRET: 'fixture-api-secret', TWILIO_TWIML_APP_SID: 'AP' + '3'.repeat(32), TWILIO_PHONE_NUMBER: '+15555550100' };

beforeEach(() => {
  vi.stubEnv('PARALLAX_OWNER_UID', OWNER);
  vi.stubEnv('PARALLAX_TRUSTED_ORIGINS', ORIGIN);
  vi.stubEnv('PARALLAX_CSRF_SECRET', 'fixture-not-a-real-secret-'.repeat(3));
  for (const [k, v] of Object.entries(TWILIO)) vi.stubEnv(k, v);
  sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: 'password' });
  db.ops = [];
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function ownerPost(path: string, body: unknown) {
  const h: Record<string, string> = { cookie: `__session=${COOKIE}`, 'content-type': 'application/json', origin: ORIGIN };
  const t = issueCsrfToken(COOKIE); if (t.ok) h['x-parallax-csrf'] = t.token;
  return new NextRequest(`${ORIGIN}${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
}

type TwilioScript = {
  call?: { status: string; from: string } | null;
  /** Successive answers for GET .../Recordings.json (null = unreadable). Last one repeats. */
  lists?: Array<Array<{ sid: string; status: string }> | null>;
  /** Answer for POST .../Recordings.json. */
  record?: { status: number; sid?: string } | 'throw';
  endOk?: boolean;
  onRecordPost?: () => void;
};
const RE_SID = 'RE' + 'c'.repeat(32);
function twilioFetch(s: TwilioScript) {
  let listIdx = 0;
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const post = init?.method === 'POST';
    if (u.endsWith('/Recordings.json') && post) {
      s.onRecordPost?.();
      if (s.record === 'throw') throw new Error('socket hang up');
      const r = s.record ?? { status: 201, sid: RE_SID };
      return new Response(JSON.stringify(r.sid ? { sid: r.sid } : {}), { status: r.status });
    }
    if (u.endsWith('/Recordings.json')) {
      const lists = s.lists ?? [[]];
      const l = lists[Math.min(listIdx++, lists.length - 1)];
      return l === null ? new Response('err', { status: 500 }) : new Response(JSON.stringify({ recordings: l }), { status: 200 });
    }
    if (post) return new Response('{}', { status: s.endOk === false ? 500 : 200 }); // end call
    if (s.call === null) return new Response('{}', { status: 404 });
    const sid = /\/Calls\/(CA[0-9a-f]{32})\.json$/.exec(u)?.[1] ?? SID; // echo the requested call
    return new Response(JSON.stringify({ sid, ...(s.call ?? { status: 'in-progress', from: 'client:ramon' }) }), { status: 200 });
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const recordingPosts = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter(([u, i]) => String(u).endsWith('/Recordings.json') && (i as RequestInit)?.method === 'POST');
const endCallPosts = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter(([u, i]) => /\/Calls\/CA[0-9a-f]{32}\.json$/.test(String(u)) && (i as RequestInit)?.method === 'POST');

describe('P05-B2.1 recording start: consent boundary (server)', () => {
  type DbScript = { meta?: Record<string, unknown>; eventError?: boolean; updateRows?: number; order?: string[] };
  const leadDb = (d: DbScript = {}) => fakeDb((table, ops) => {
    const has = (m: string) => ops.some((o) => o[0] === m);
    if (table === 'pipeline_events' && has('insert')) {
      d.order?.push('event');
      return d.eventError ? { error: { message: 'insert failed' } } : { data: { id: 'ev1' } };
    }
    if (table === 'pipeline_leads' && has('update')) {
      d.order?.push('meta');
      return { data: Array.from({ length: d.updateRows ?? 1 }, () => ({ id: LEAD })) };
    }
    return { data: { id: LEAD, meta: d.meta ?? {} } };
  });
  const post = (b: unknown) => import('@/app/api/command-center/voice/recording/start/route').then((m) => m.POST(ownerPost('/api/command-center/voice/recording/start', b)));
  const ok = { callSid: SID, leadId: LEAD, consentConfirmed: true };

  it.each([
    ['missing consent flag', { callSid: SID, leadId: LEAD }],
    ['consent flag not literally true', { callSid: SID, leadId: LEAD, consentConfirmed: 'true' }],
    ['bad call sid', { callSid: 'CAxyz', leadId: LEAD, consentConfirmed: true }],
    ['bad lead id', { callSid: SID, leadId: 'x', consentConfirmed: true }],
  ])('rejects %s without touching Twilio (definite: not recording)', async (_n, body) => {
    db.client = leadDb();
    const f = twilioFetch({});
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ recording: false, definite: true });
  });
  it('a failed call lookup is UNKNOWN (an earlier attempt may be recording), and nothing starts', async () => {
    db.client = leadDb();
    const f = twilioFetch({ call: null });
    const res = await post(ok);
    expect(await res.json()).toMatchObject({ recording: false, definite: false, error: 'call_state_unreadable' });
    expect(recordingPosts(f)).toHaveLength(0);
  });
  it.each([
    ['call ringing (not answered)', { call: { status: 'ringing', from: 'client:ramon' } }],
    ['call completed', { call: { status: 'completed', from: 'client:ramon' } }],
    ['call not placed by this dialer', { call: { status: 'in-progress', from: '+15550001111' } }],
  ])('fails closed when %s', async (_n, script) => {
    db.client = leadDb();
    const f = twilioFetch(script as TwilioScript);
    const res = await post(ok);
    expect([409, 503]).toContain(res.status);
    expect((await res.json()).definite).toBe(true);
    expect(recordingPosts(f)).toHaveLength(0);
  });
  it.each([
    ["Twilio's recording list unreadable", [null]],
    ['a malformed entry in the list (never silently dropped)', [[{ sid: 'not-a-recording-sid', status: 'in-progress' }]]],
    ['an unrecognized recording status', [[{ sid: 'RE' + 'f'.repeat(32), status: '' }]]],
    ['a novel status string', [[{ sid: 'RE' + 'f'.repeat(32), status: 'recording-ish' }]]],
  ])('%s -> nothing started and the state is reported UNKNOWN, not "not recording"', async (_n, lists) => {
    db.client = leadDb();
    const f = twilioFetch({ lists: lists as TwilioScript['lists'] });
    const res = await post(ok);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ recording: false, definite: false });
    expect(recordingPosts(f)).toHaveLength(0);
  });
  it('fails closed (no recording) if the append-only consent event cannot be saved', async () => {
    db.client = leadDb({ eventError: true });
    const f = twilioFetch({});
    const res = await post(ok);
    expect(res.status).toBe(503);
    expect(recordingPosts(f)).toHaveLength(0);
  });
  it('fails closed if the lead meta update touches zero rows (lead vanished)', async () => {
    db.client = leadDb({ updateRows: 0 });
    const f = twilioFetch({});
    const res = await post(ok);
    expect(res.status).toBe(503);
    expect(recordingPosts(f)).toHaveLength(0);
  });
  it('saves both evidence records BEFORE asking Twilio to record, then records the outcome; no content stored', async () => {
    const order: string[] = [];
    db.client = leadDb({ meta: { other: 1 }, order });
    const f = twilioFetch({ onRecordPost: () => order.push('twilio-record') });
    const res = await post(ok);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, recording: true, definite: true, recordingSid: RE_SID });
    expect(order.slice(0, 3)).toEqual(['event', 'meta', 'twilio-record']);
    const metas = opsOf('pipeline_leads', 'update').map((o) => (o.ops.find((x) => x[0] === 'update')![1] as { meta: { recordingConsents: Array<Record<string, unknown>>; other: number } }).meta);
    expect(metas[0].recordingConsents).toEqual([expect.objectContaining({ callSid: SID, outcome: 'pending', attestedBy: 'owner' })]);
    expect(metas.at(-1)!.recordingConsents).toEqual([expect.objectContaining({ callSid: SID, outcome: 'started', recordingSid: RE_SID })]);
    expect(metas.at(-1)!.other).toBe(1);
    expect(Object.keys(metas.at(-1)!.recordingConsents[0]).sort()).toEqual(['attestedBy', 'callSid', 'consentConfirmedAt', 'outcome', 'recordingSid', 'recordingStartedAt']);
    const ev = opsOf('pipeline_events', 'insert')[0].ops.find((x) => x[0] === 'insert')![1] as { kind: string; detail: Record<string, unknown> };
    expect(ev.kind).toBe('recording_consent');
    expect(Object.keys(ev.detail).sort()).toEqual(['attestedBy', 'callSid', 'consentConfirmedAt']);
    expect(String((recordingPosts(f)[0][1] as RequestInit).body)).toContain('RecordingChannels=dual');
  });
  it('Twilio rejecting the request (4xx) is a definite failure', async () => {
    db.client = leadDb();
    twilioFetch({ record: { status: 400 } });
    const res = await post(ok);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ recording: false, definite: true, error: 'recording_not_started' });
  });
  it('an already-active recording on this call is returned, never a second one, even with a different lead id', async () => {
    db.client = leadDb();
    const f = twilioFetch({ lists: [[{ sid: RE_SID, status: 'in-progress' }]] });
    const other = await post({ ...ok, leadId: 'aaaaaaaa-0000-4000-8000-000000000009' });
    expect(await other.json()).toMatchObject({ recording: true, repeat: true, recordingSid: RE_SID });
    expect(recordingPosts(f)).toHaveLength(0);
    expect(opsOf('pipeline_events', 'insert')).toHaveLength(0);
  });
  it('ambiguous start (5xx) reconciled: Twilio shows it recording -> recording true', async () => {
    db.client = leadDb();
    twilioFetch({ record: { status: 500 }, lists: [[], [{ sid: RE_SID, status: 'in-progress' }]] });
    expect(await (await post(ok)).json()).toMatchObject({ recording: true, recordingSid: RE_SID });
  });
  it('ambiguous start (network) and Twilio shows none -> the call is ended (the pending create could still land)', async () => {
    db.client = leadDb();
    const f = twilioFetch({ record: 'throw', lists: [[], []] });
    expect(await (await post(ok)).json()).toMatchObject({ recording: false, definite: true, callEnded: true });
    expect(endCallPosts(f)).toHaveLength(1);
  });
  it('ambiguous start and unreadable list -> the call is ended, then definite', async () => {
    db.client = leadDb();
    const f = twilioFetch({ record: 'throw', lists: [[], null] });
    const res = await post(ok);
    expect(await res.json()).toMatchObject({ recording: false, definite: true, callEnded: true });
    expect(endCallPosts(f)).toHaveLength(1);
    expect(String((endCallPosts(f)[0][1] as RequestInit).body)).toBe('Status=completed');
  });
  it('ambiguous start, unreadable list and call cannot be ended -> UNKNOWN, and that call is blocked from further starts', async () => {
    db.client = leadDb();
    const f = twilioFetch({ record: 'throw', lists: [[], null], endOk: false });
    const stuck = { ...ok, callSid: 'CA' + 'e'.repeat(32) }; // own SID: the unresolved set is per process
    const res = await post(stuck);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ recording: false, definite: false, error: 'recording_state_unknown' });
    const again = await post(stuck);
    expect(await again.json()).toMatchObject({ definite: false, error: 'recording_state_unresolved' });
    expect(recordingPosts(f)).toHaveLength(1);
  });
  it('if the fresh re-read fails, the final meta write is skipped (never written from stale data)', async () => {
    let reads = 0;
    db.client = fakeDb((table, ops) => {
      const has = (m: string) => ops.some((o) => o[0] === m);
      if (table === 'pipeline_events') return { data: { id: 'ev1' } };
      if (has('update')) return { data: [{ id: LEAD }] };
      reads++;
      return reads === 1 ? { data: { id: LEAD, meta: {} } } : { error: { message: 'read failed' } };
    });
    twilioFetch({});
    const res = await post({ ...ok, callSid: 'CA' + '9'.repeat(32) });
    expect(res.status).toBe(200);
    expect(opsOf('pipeline_leads', 'update')).toHaveLength(1); // only the pre-recording evidence write
    expect(opsOf('pipeline_events', 'insert').map((o) => (o.ops.find((x) => x[0] === 'insert')![1] as { kind: string }).kind)).toEqual(['recording_consent', 'recording_started']);
  });
  it('the final consent write re-reads the lead, keeping a recording the webhook saved meanwhile', async () => {
    let reads = 0;
    db.client = fakeDb((table, ops) => {
      const has = (m: string) => ops.some((o) => o[0] === m);
      if (table === 'pipeline_events') return { data: { id: 'ev1' } };
      if (has('update')) return { data: [{ id: LEAD }] };
      reads++;
      return { data: { id: LEAD, meta: reads === 1 ? {} : { recordings: [{ sid: 'RE' + 'e'.repeat(32) }] } } };
    });
    twilioFetch({});
    await post({ ...ok, callSid: 'CA' + 'd'.repeat(32) });
    const last = opsOf('pipeline_leads', 'update').at(-1)!.ops.find((x) => x[0] === 'update')![1] as { meta: { recordings?: unknown[] } };
    expect(last.meta.recordings).toEqual([{ sid: 'RE' + 'e'.repeat(32) }]);
  });
  it('concurrent requests for the same call: only one reaches Twilio', async () => {
    db.client = leadDb();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const f = twilioFetch({});
    const base = f.getMockImplementation()!;
    f.mockImplementation(async (u: string, i?: RequestInit) => { if (!String(u).includes('/Recordings')) await gate; return base(u, i); });
    const a = post(ok);
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    const b = await post(ok);
    expect(b.status).toBe(409);
    expect(await b.json()).toMatchObject({ definite: false }); // the first request may be recording
    release();
    expect((await a).status).toBe(200);
    expect(recordingPosts(f)).toHaveLength(1);
  });
  it('requires the owner session, Origin and CSRF (P03)', async () => {
    db.client = leadDb();
    const f = twilioFetch({});
    const { POST } = await import('@/app/api/command-center/voice/recording/start/route');
    const res = await POST(new NextRequest(`${ORIGIN}/api/command-center/voice/recording/start`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `__session=${COOKIE}`, origin: ORIGIN }, body: JSON.stringify(ok) }));
    expect(res.status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('P05-B2.1 TwiML never records on connect', () => {
  function signed(params: Record<string, string>) {
    const url = 'https://command.parallaxvinc.com/api/command-center/voice/twiml';
    const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
    const sig = createHmac('sha1', TWILIO.TWILIO_AUTH_TOKEN).update(data).digest('base64');
    return new NextRequest(`${ORIGIN}/api/command-center/voice/twiml`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': sig }, body: new URLSearchParams(params).toString() });
  }
  it.each<Record<string, string>>([{}, { record: 'true' }, { record: 'record-from-answer' }])('params %j produce a Dial with no recording attributes', async (extra) => {
    const { POST } = await import('@/app/api/command-center/voice/twiml/route');
    const res = await POST(signed({ To: '+15555550199', leadId: LEAD, ...extra }));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<Dial callerId="+15555550100" answerOnBridge="true">');
    expect(xml).not.toMatch(/record/i);
  });
});

describe('P05-B2.1 recording webhook flags recordings without a consent entry', () => {
  function signedRec(params: Record<string, string>) {
    const url = `https://command.parallaxvinc.com/api/command-center/voice/recording?leadId=${LEAD}`;
    const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
    const sig = createHmac('sha1', TWILIO.TWILIO_AUTH_TOKEN).update(data).digest('base64');
    return new NextRequest(`${ORIGIN}/api/command-center/voice/recording?leadId=${LEAD}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': sig }, body: new URLSearchParams(params).toString() });
  }
  it.each([
    ['consented (meta)', [{ callSid: SID, outcome: 'started' }], [], true],
    ['meta lost but durable consent event exists', [], [{ id: 'ev1' }], true],
    ['no consent anywhere', [], [], false],
    ['consent attempt that failed, no event', [{ callSid: SID, outcome: 'failed' }], [], false],
  ])('%s -> consented=%s', async (_n, consents, events, expected) => {
    db.client = fakeDb((table, ops) => {
      if (table === 'pipeline_events') return { data: events };
      return ops.some((o) => o[0] === 'update') ? { data: [{ id: LEAD }] } : { data: { id: LEAD, meta: { recordingConsents: consents } } };
    });
    const { POST } = await import('@/app/api/command-center/voice/recording/route');
    await POST(signedRec({ CallSid: SID, RecordingUrl: 'https://api.twilio.com/rec', RecordingSid: 'RE' + 'c'.repeat(32) }));
    const upd = opsOf('pipeline_leads', 'update')[0].ops.find((x) => x[0] === 'update')![1] as { meta: { recordings: Array<{ consented: boolean }> } };
    expect(upd.meta.recordings[0].consented).toBe(expected);
  });
});

describe('P05-B2.1 recording webhook acknowledges only saved recordings', () => {
  const params = { CallSid: SID, RecordingUrl: 'https://api.twilio.com/rec', RecordingSid: 'RE' + 'c'.repeat(32) };
  function signedRec(p: Record<string, string>) {
    const url = `https://command.parallaxvinc.com/api/command-center/voice/recording?leadId=${LEAD}`;
    const data = url + Object.keys(p).sort().map((k) => k + p[k]).join('');
    const sig = createHmac('sha1', TWILIO.TWILIO_AUTH_TOKEN).update(data).digest('base64');
    return new NextRequest(`${ORIGIN}/api/command-center/voice/recording?leadId=${LEAD}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': sig }, body: new URLSearchParams(p).toString() });
  }
  const call = () => import('@/app/api/command-center/voice/recording/route').then((m) => m.POST(signedRec(params)));
  it('storage unavailable -> 503 (retryable), not 200', async () => {
    db.client = null;
    expect((await call()).status).toBe(503);
  });
  it('consent-event lookup error -> 500 (retry), never labelled unconsented', async () => {
    db.client = fakeDb((table) => (table === 'pipeline_events' ? { error: { message: 'timeout' } } : { data: { id: LEAD, meta: {} } }));
    expect((await call()).status).toBe(500);
    expect(opsOf('pipeline_leads', 'update')).toHaveLength(0);
  });
  it('read error -> 500', async () => {
    db.client = fakeDb(() => ({ error: { message: 'read failed' } }));
    expect((await call()).status).toBe(500);
  });
  it('write error or zero rows -> 500', async () => {
    db.client = fakeDb((table, ops) => (table === 'pipeline_events' ? { data: [] } : ops.some((o) => o[0] === 'update') ? { data: [] } : { data: { id: LEAD, meta: {} } }));
    expect((await call()).status).toBe(500);
  });
  it('a retried callback for an already-saved recording is acknowledged without duplicating it', async () => {
    db.client = fakeDb(() => ({ data: { id: LEAD, meta: { recordings: [{ sid: params.RecordingSid }] } } }));
    expect((await call()).status).toBe(200);
    expect(opsOf('pipeline_leads', 'update')).toHaveLength(0);
  });
});

describe('P05-B2.1 nurture: failures never advance, retries never duplicate', () => {
  const CRON = 'fixture-cron-token-'.repeat(2);
  const lead = (over: Record<string, unknown> = {}) => ({
    id: LEAD, company: 'Fixture Co', name: 'Pat', contact_email: 'pat@example.com', stage: 'new', value: 1000,
    created_at: '2026-01-01T00:00:00Z', meta: { consentAt: '2026-01-01T00:00:00Z', audit: { gaps: ['No Google Business Profile', 'Slow mobile site'], healthScore: 41 }, ...over },
  });
  type NurtureState = { gateRows: unknown[]; lookupError?: string; insertError?: string; advanceError?: string; leads?: unknown[] };
  const nurtureDb = (s: NurtureState) => fakeDb((table, ops) => {
    const has = (m: string) => ops.some((o) => o[0] === m);
    if (table === 'pipeline_leads' && has('update')) {
      const meta = (ops.find((o) => o[0] === 'update')![1] as { meta: { nurture?: { step?: number } } }).meta;
      const isAdvance = (meta.nurture?.step ?? 0) > 0 && !('lastError' in (meta.nurture ?? {}));
      return { error: isAdvance && s.advanceError ? { message: s.advanceError } : null };
    }
    if (table === 'pipeline_leads') return { data: s.leads ?? [lead()] };
    if (table === 'pipeline_gate' && has('insert')) {
      if (s.insertError) return { error: { message: s.insertError } };
      s.gateRows.push((ops.find((o) => o[0] === 'insert')![1]));
      return { error: null };
    }
    if (table === 'pipeline_gate') return s.lookupError ? { error: { message: s.lookupError } } : { data: s.gateRows.slice(0, 1) };
    return {};
  });
  const run = async () => {
    vi.stubEnv('PARALLAX_CRON_TOKEN', CRON);
    const { POST } = await import('@/app/api/command-center/nurture/route');
    const res = await POST(new NextRequest(`${ORIGIN}/api/command-center/nurture`, { method: 'POST', headers: { authorization: `Bearer ${CRON}` } }));
    return res.json() as Promise<{ advanced: number; failures: Array<{ stage: string }>; held: unknown[]; due: number }>;
  };
  const advances = () => opsOf('pipeline_leads', 'update').filter((o) => { const m = (o.ops.find((x) => x[0] === 'update')![1] as { meta: { nurture: Record<string, unknown> } }).meta.nurture; return !('lastError' in m); });

  it('a failed draft insert does NOT advance the lead and records the failure', async () => {
    const s: NurtureState = { gateRows: [], insertError: 'db down' };
    db.client = nurtureDb(s);
    const out = await run();
    expect(out.advanced).toBe(0);
    expect(out.failures).toEqual([expect.objectContaining({ stage: 'draft' })]);
    expect(advances()).toHaveLength(0);
    const noted = opsOf('pipeline_leads', 'update')[0].ops.find((x) => x[0] === 'update')![1] as { meta: { nurture: { step: number; lastError: { stage: string } } } };
    expect(noted.meta.nurture).toMatchObject({ step: 0, lastError: { stage: 'draft' } });
  });
  it('a failed duplicate lookup does NOT draft or advance', async () => {
    const s: NurtureState = { gateRows: [], lookupError: 'timeout' };
    db.client = nurtureDb(s);
    const out = await run();
    expect(out.failures).toEqual([expect.objectContaining({ stage: 'lookup' })]);
    expect(opsOf('pipeline_gate', 'insert')).toHaveLength(0);
    expect(advances()).toHaveLength(0);
  });
  it('retry after a failed advance finds the existing draft and advances WITHOUT drafting again', async () => {
    const s: NurtureState = { gateRows: [], advanceError: 'conflict' };
    db.client = nurtureDb(s);
    const first = await run();
    expect(first.failures).toEqual([expect.objectContaining({ stage: 'advance' })]);
    expect(s.gateRows).toHaveLength(1);
    s.advanceError = undefined;
    db.ops = [];
    const second = await run();
    expect(second.advanced).toBe(1);
    expect(opsOf('pipeline_gate', 'insert')).toHaveLength(0);
    expect(s.gateRows).toHaveLength(1);
  });
  it('an existing draft in ANY status (already approved/sent) is never drafted again', async () => {
    const s: NurtureState = { gateRows: [{ id: 'g1', status: 'executed' }] };
    db.client = nurtureDb(s);
    const out = await run();
    expect(out.advanced).toBe(1);
    expect(opsOf('pipeline_gate', 'insert')).toHaveLength(0);
    const lookup = opsOf('pipeline_gate', 'select')[0].ops;
    expect(lookup.some((o) => o[0] === 'eq' && o[1] === 'status')).toBe(false); // not limited to pending
    expect(lookup).toContainEqual(['ilike', 'title', '%· deliver-audit ·%']);
  });
  it('happy path drafts once with a stable nurture key and advances', async () => {
    const s: NurtureState = { gateRows: [] };
    db.client = nurtureDb(s);
    const out = await run();
    expect(out).toMatchObject({ advanced: 1, failures: [] });
    expect(s.gateRows[0]).toMatchObject({ title: expect.stringContaining('· deliver-audit ·'), payload: expect.objectContaining({ nurtureKey: `${LEAD}:deliver-audit` }) });
  });
  it('first email carries the actual audit findings and promises nothing that is not included', async () => {
    const s: NurtureState = { gateRows: [] };
    db.client = nurtureDb(s);
    await run();
    const body = (s.gateRows[0] as { payload: { body: string } }).payload.body;
    expect(body).toContain('- No Google Business Profile');
    expect(body).toContain('- Slow mobile site');
    expect(body).toContain('Overall score: 41 out of 100.');
    expect(body).not.toMatch(/attached|below|full breakdown/i);
    expect(body).not.toMatch(/[–—…]/); // brand voice: no dashes or ellipses in the new copy
  });
  it('pages past 300 finished leads so a later eligible lead is still nurtured (no starvation)', async () => {
    const done = Array.from({ length: 300 }, (_, i) => ({ ...lead({ nurture: { step: 5 } }), id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}` }));
    const eligible = { ...lead(), id: 'bbbbbbbb-0000-4000-8000-000000000001' };
    const all = [...done, eligible];
    const s: NurtureState = { gateRows: [] };
    db.client = fakeDb((table, ops) => {
      const range = ops.find((o) => o[0] === 'range') as [string, number, number] | undefined;
      if (table === 'pipeline_leads' && !ops.some((o) => o[0] === 'update') && range) return { data: all.slice(range[1], range[2] + 1) };
      if (table === 'pipeline_gate' && ops.some((o) => o[0] === 'insert')) { s.gateRows.push(1); return { error: null }; }
      if (table === 'pipeline_gate') return { data: [] }; // no existing drafts
      return { error: null }; // lead updates succeed
    });
    const out = await run();
    expect(out.advanced).toBe(1);
    expect(s.gateRows).toHaveLength(1);
    const ranges = db.ops.filter((o) => o.table === 'pipeline_leads').map((o) => o.ops.find((x) => x[0] === 'range')).filter(Boolean);
    expect(ranges).toEqual([['range', 0, 299], ['range', 300, 599]]);
    const orFilters = db.ops.filter((o) => o.table === 'pipeline_leads').map((o) => o.ops.find((x) => x[0] === 'or')).filter(Boolean);
    expect(orFilters[0]).toEqual(['or', 'meta->nurture->>step.is.null,meta->nurture->>step.lt.5']); // finished sequences excluded in the query
  });
  it('overlapping executions: the second is refused (409) and drafts nothing', async () => {
    const s: NurtureState = { gateRows: [] };
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const inner = nurtureDb(s);
    db.client = { from: (tb: string) => { const c = inner.from(tb) as Record<string, unknown>; const then = c.then as (a: unknown, b?: unknown) => unknown; c.then = (a: unknown, b?: unknown) => gate.then(() => then(a, b)); return c; } };
    vi.stubEnv('PARALLAX_CRON_TOKEN', CRON);
    const { POST } = await import('@/app/api/command-center/nurture/route');
    const mk = () => new NextRequest(`${ORIGIN}/api/command-center/nurture`, { method: 'POST', headers: { authorization: `Bearer ${CRON}` } });
    const first = POST(mk());
    const second = await POST(mk());
    expect(second.status).toBe(409);
    release();
    expect((await first).status).toBe(200);
    expect(s.gateRows).toHaveLength(1);
  });
  it('a lead with no audit findings is held, not sent an empty audit email, and not advanced', async () => {
    const s: NurtureState = { gateRows: [], leads: [lead({ audit: undefined })] };
    db.client = nurtureDb(s);
    const out = await run();
    expect(out.held).toEqual([expect.objectContaining({ step: 'deliver-audit' })]);
    expect(opsOf('pipeline_gate', 'insert')).toHaveLength(0);
    expect(advances()).toHaveLength(0);
  });
});

describe('P05-B2.1 browser mutations to P03-guarded routes carry CSRF (cockpitFetch)', () => {
  it('no command-center client code POSTs to a guarded route with plain fetch', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const hits: string[] = [];
    const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(tsx?)$/.test(p) && !p.includes('.test.')) { const t = fs.readFileSync(p, 'utf8'); for (const m of t.matchAll(/(?<![A-Za-z])fetch\(\s*([`"'])(\/api\/(?:command-center|bridge)[^`"']*)\1\s*,\s*\{([^}]{0,300})/g)) if (/method:\s*["'](POST|PUT|PATCH|DELETE)/.test(m[3])) hits.push(`${p} ${m[2]}`); } } };
    for (const d of ['src/app/command-center', 'src/components/command-center', 'src/hooks', 'src/lib']) walk(d);
    expect(hits).toEqual([]);
  });
});
