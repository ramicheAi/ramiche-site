import { describe, expect, it, vi } from 'vitest';
import { DialerSession, canStartRecording, isTokenUsable, tokenExpiresAtMs, type CallLike, type DeviceLike, type DialerDeps } from './dialer-session';

const NOW = 1_800_000_000_000;
const SID_A = 'CA' + 'a'.repeat(32);
const SID_B = 'CA' + 'b'.repeat(32);
const LEAD = '5b9a0c1e-1111-4222-8333-944455556666';

function jwt(expMs: number): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256' })}.${b({ exp: Math.floor(expMs / 1000) })}.sig`;
}

class FakeCall implements CallLike {
  handlers = new Map<string, Array<(...a: unknown[]) => void>>();
  disconnects = 0;
  constructor(public parameters: Record<string, string>) {}
  on(ev: string, fn: (...a: unknown[]) => void) { this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), fn]); return this; }
  emit(ev: string) { for (const f of this.handlers.get(ev) ?? []) f(); }
  disconnect() { this.disconnects++; this.emit('disconnect'); }
}

class FakeDevice implements DeviceLike {
  destroyed = 0;
  tokens: string[] = [];
  handlers = new Map<string, (...a: unknown[]) => void>();
  connectParams: Record<string, string>[] = [];
  constructor(public token: string, public nextCall: FakeCall, public connectGate?: Promise<void>) {}
  async connect(o: { params: Record<string, string> }) { this.connectParams.push(o.params); if (this.connectGate) await this.connectGate; return this.nextCall; }
  destroy() { this.destroyed++; }
  updateToken(t: string) { this.tokens.push(t); }
  on(ev: string, fn: (...a: unknown[]) => void) { this.handlers.set(ev, fn); return this; }
}

function harness(opts: { calls?: FakeCall[]; token?: () => Promise<Awaited<ReturnType<DialerDeps['fetchToken']>>>; record?: DialerDeps['startRecording']; gate?: Promise<void> } = {}) {
  const calls = opts.calls ?? [new FakeCall({ CallSid: SID_A }), new FakeCall({ CallSid: SID_B })];
  const devices: FakeDevice[] = [];
  let now = NOW;
  const deps: DialerDeps = {
    fetchToken: vi.fn(opts.token ?? (async () => ({ token: jwt(now + 3_600_000) }))),
    createDevice: vi.fn(async (token: string) => { const d = new FakeDevice(token, calls[devices.length], opts.gate); devices.push(d); return d; }),
    startRecording: vi.fn(opts.record ?? (async () => ({ recordingSid: 'RE' + 'c'.repeat(32) }))),
    now: () => now,
  };
  const s = new DialerSession(deps);
  return { s, deps, calls, devices, advance: (ms: number) => { now += ms; } };
}

async function connectAndAnswer(h: ReturnType<typeof harness>, i = 0) {
  await h.s.dial('+15555550100', LEAD);
  h.calls[i].emit('accept');
}

describe('P05-B2.1 dialer: connected is not recording', () => {
  it('connecting and answering never records and never requests recording', async () => {
    const h = harness();
    await connectAndAnswer(h);
    expect(h.s.snapshot).toMatchObject({ phase: 'connected', answered: true, callSid: SID_A, recording: 'off', consent: null });
    expect(h.deps.startRecording).not.toHaveBeenCalled();
    expect(h.devices[0].connectParams[0]).toEqual({ To: '+15555550100', leadId: LEAD }); // no record param reaches TwiML
  });
  it('ringing (not yet answered) cannot take consent or record', async () => {
    const h = harness();
    await h.s.dial('+15555550100', LEAD);
    expect(h.s.snapshot.phase).toBe('connecting');
    expect(h.s.confirmConsent(SID_A)).toBe(false);
    expect(await h.s.startRecording()).toBe(false);
    expect(h.deps.startRecording).not.toHaveBeenCalled();
  });
});

describe('P05-B2.1 dialer: recording requires explicit consent for the live call', () => {
  it('startRecording before consent is refused', async () => {
    const h = harness();
    await connectAndAnswer(h);
    expect(canStartRecording(h.s.snapshot)).toBe(false);
    expect(await h.s.startRecording()).toBe(false);
    expect(h.deps.startRecording).not.toHaveBeenCalled();
    expect(h.s.snapshot.recording).toBe('off');
  });
  it('consent for a different call SID is refused', async () => {
    const h = harness();
    await connectAndAnswer(h);
    expect(h.s.confirmConsent(SID_B)).toBe(false);
    expect(h.s.snapshot.consent).toBeNull();
  });
  it('explicit consent then startRecording records this call only', async () => {
    const h = harness();
    await connectAndAnswer(h);
    expect(h.s.confirmConsent(SID_A)).toBe(true);
    expect(await h.s.startRecording()).toBe(true);
    expect(h.deps.startRecording).toHaveBeenCalledWith({ callSid: SID_A, leadId: LEAD });
    expect(h.s.snapshot).toMatchObject({ recording: 'on', consent: { callSid: SID_A } });
  });
  it('withdrawn consent (before recording) blocks recording', async () => {
    const h = harness();
    await connectAndAnswer(h);
    h.s.confirmConsent(SID_A);
    h.s.clearConsent();
    expect(await h.s.startRecording()).toBe(false);
  });
  it('unknown call SID (SDK gave none) fails closed', async () => {
    const h = harness({ calls: [new FakeCall({})] });
    await connectAndAnswer(h);
    expect(h.s.snapshot.callSid).toBeNull();
    expect(h.s.confirmConsent('')).toBe(false);
    expect(await h.s.startRecording()).toBe(false);
  });
  it('a DEFINITE server failure leaves recording off, says so, and allows a retry', async () => {
    const h = harness({ record: async () => ({ error: 'recording_not_started', definite: true }) });
    await connectAndAnswer(h);
    h.s.confirmConsent(SID_A);
    expect(await h.s.startRecording()).toBe(false);
    expect(h.s.snapshot.recording).toBe('failed');
    expect(h.s.snapshot.error).toMatch(/not being recorded/);
    expect(canStartRecording(h.s.snapshot)).toBe(true);
  });
  it.each([
    ['network throw (request may have reached the server)', async () => { throw new Error('offline'); }],
    ['server says state unknown', async () => ({ error: 'recording_state_unknown', definite: false })],
    ['error without a definite flag', async () => ({ error: 'http_502' })],
    ['malformed success', async () => ({ recordingSid: '' })],
  ])('an UNKNOWN outcome (%s) never claims "not recording" and blocks retries', async (_n, rec) => {
    const h = harness({ record: rec as DialerDeps['startRecording'] });
    await connectAndAnswer(h);
    h.s.confirmConsent(SID_A);
    expect(await h.s.startRecording()).toBe(false);
    expect(h.s.snapshot.recording).toBe('unknown');
    expect(h.s.snapshot.error).toMatch(/may be recorded/);
    expect(h.s.snapshot.error).not.toMatch(/not being recorded/i);
    expect(canStartRecording(h.s.snapshot)).toBe(false);
    expect(await h.s.startRecording()).toBe(false);
    expect(h.deps.startRecording).toHaveBeenCalledTimes(1);
    h.s.clearConsent();
    expect(h.s.snapshot.consent).not.toBeNull(); // consent cannot be silently withdrawn while state is unknown
  });
  it('server ended the call over an ambiguous outcome: says a partial recording may exist, and the notice survives the hangup', async () => {
    const h = harness({ record: async () => ({ error: 'recording_state_unknown_call_ended', definite: true, callEnded: true }) });
    await connectAndAnswer(h, 0);
    h.s.confirmConsent(SID_A);
    expect(await h.s.startRecording()).toBe(false);
    expect(h.s.snapshot.error).toMatch(/partial recording may exist/);
    expect(h.s.snapshot.error).not.toMatch(/not being recorded/i);
    h.calls[0].emit('disconnect');
    expect(h.s.snapshot).toMatchObject({ phase: 'idle', consent: null, recording: 'off' });
    expect(h.s.snapshot.error).toMatch(/partial recording may exist/);
    await connectAndAnswer(h, 1);
    expect(h.s.snapshot.error).toBeNull();
  });
  it('hanging up after an unknown outcome resets everything for the next call', async () => {
    const h = harness({ record: async () => ({ error: 'x' }) });
    await connectAndAnswer(h, 0);
    h.s.confirmConsent(SID_A);
    await h.s.startRecording();
    h.s.hangup();
    expect(h.s.snapshot).toMatchObject({ recording: 'off', consent: null, error: null });
  });
  it.each([
    ['server ended the call', { error: 'recording_state_unknown_call_ended', definite: true, callEnded: true }],
    ['state unknown', { error: 'recording_state_unknown', definite: false }],
    ['recording confirmed', { recordingSid: 'RE' + 'd'.repeat(32) }],
  ])('a late response (%s) after the call already disconnected is still disclosed', async (_n, reply) => {
    let release!: (v: unknown) => void;
    const h = harness({ record: () => new Promise((r) => { release = r as (v: unknown) => void; }) as never });
    await connectAndAnswer(h);
    h.s.confirmConsent(SID_A);
    const p = h.s.startRecording();
    h.calls[0].emit('disconnect'); // Twilio hangs up before the HTTP answer arrives
    release(reply);
    await p;
    expect(h.s.snapshot).toMatchObject({ phase: 'idle', recording: 'off', consent: null });
    expect(h.s.snapshot.error).toMatch(/partial recording may exist/);
  });
  it('a late DEFINITE "nothing recorded" after disconnect stays silent', async () => {
    let release!: (v: unknown) => void;
    const h = harness({ record: () => new Promise((r) => { release = r as (v: unknown) => void; }) as never });
    await connectAndAnswer(h);
    h.s.confirmConsent(SID_A);
    const p = h.s.startRecording();
    h.calls[0].emit('disconnect');
    release({ error: 'recording_not_started', definite: true });
    await p;
    expect(h.s.snapshot.error).toBeNull();
  });
  it('a recording result arriving after hangup is discarded', async () => {
    let release!: (v: { recordingSid: string }) => void;
    const h = harness({ record: () => new Promise((r) => { release = r; }) });
    await connectAndAnswer(h);
    h.s.confirmConsent(SID_A);
    const p = h.s.startRecording();
    h.s.hangup();
    release({ recordingSid: 'RE' + 'd'.repeat(32) });
    expect(await p).toBe(false);
    expect(h.s.snapshot).toMatchObject({ phase: 'idle', recording: 'off', consent: null });
    expect(h.s.snapshot.error).toMatch(/partial recording may exist/); // disclosed, never silently dropped
  });
});

describe('P05-B2.1 dialer: consent never carries between calls', () => {
  it('hangup, then a new call starts with no consent and no recording', async () => {
    const h = harness();
    await connectAndAnswer(h, 0);
    h.s.confirmConsent(SID_A);
    await h.s.startRecording();
    h.s.hangup();
    expect(h.s.snapshot).toMatchObject({ consent: null, recording: 'off', callSid: null });
    await connectAndAnswer(h, 1);
    expect(h.s.snapshot).toMatchObject({ callSid: SID_B, consent: null, recording: 'off' });
    expect(await h.s.startRecording()).toBe(false);
    expect(h.deps.startRecording).toHaveBeenCalledTimes(1);
  });
  it('remote disconnect and call error both reset consent', async () => {
    const h = harness();
    await connectAndAnswer(h, 0);
    h.s.confirmConsent(SID_A);
    h.calls[0].emit('disconnect');
    expect(h.s.snapshot.consent).toBeNull();
    await connectAndAnswer(h, 1);
    h.s.confirmConsent(SID_B);
    h.calls[1].emit('error');
    expect(h.s.snapshot).toMatchObject({ phase: 'error', consent: null, recording: 'off' });
  });
});

describe('P05-B2.1 dialer: call and microphone cleanup', () => {
  it('hangup disconnects the call and destroys the device (releases the microphone)', async () => {
    const h = harness();
    await connectAndAnswer(h);
    h.s.hangup();
    expect(h.calls[0].disconnects).toBe(1);
    expect(h.devices[0].destroyed).toBe(1);
    expect(h.s.holdsMedia).toBe(false);
    expect(h.s.snapshot.phase).toBe('idle');
  });
  it('dispose (unmount/navigation) releases call and device', async () => {
    const h = harness();
    await connectAndAnswer(h);
    h.s.dispose();
    expect(h.calls[0].disconnects).toBe(1);
    expect(h.devices[0].destroyed).toBe(1);
    expect(h.s.holdsMedia).toBe(false);
  });
  it('cleanup is idempotent: repeated hangup/dispose/remote disconnect never double-release', async () => {
    const h = harness();
    await connectAndAnswer(h);
    h.s.hangup(); h.s.hangup(); h.s.dispose(); h.calls[0].emit('disconnect');
    expect(h.calls[0].disconnects).toBe(1);
    expect(h.devices[0].destroyed).toBe(1);
  });
  it('remote hangup releases the device too, so the UI can never show ended with media live', async () => {
    const h = harness();
    await connectAndAnswer(h);
    h.calls[0].emit('disconnect');
    expect(h.devices[0].destroyed).toBe(1);
    expect(h.s.holdsMedia).toBe(false);
    expect(h.s.snapshot.phase).toBe('idle');
  });
  it('a connect that completes after unmount is disconnected and destroyed immediately', async () => {
    let open!: () => void;
    const h = harness({ gate: new Promise<void>((r) => { open = r; }) });
    const p = h.s.dial('+15555550100', LEAD);
    await vi.waitFor(() => expect(h.devices.length).toBe(1));
    h.s.dispose();
    open();
    await p;
    expect(h.calls[0].disconnects).toBe(1);
    expect(h.devices[0].destroyed).toBeGreaterThanOrEqual(1);
    expect(h.s.holdsMedia).toBe(false);
  });
  it('a device-level error ends the call and releases media', async () => {
    const h = harness();
    await connectAndAnswer(h);
    h.devices[0].handlers.get('error')?.();
    expect(h.s.snapshot.phase).toBe('error');
    expect(h.devices[0].destroyed).toBe(1);
    expect(h.s.holdsMedia).toBe(false);
  });
  it('a disposed session never dials again', async () => {
    const h = harness();
    h.s.dispose();
    await h.s.dial('+15555550100', LEAD);
    expect(h.deps.fetchToken).not.toHaveBeenCalled();
  });
  it('reports call duration once per answered call', async () => {
    const h = harness();
    const ended = vi.fn();
    h.s.onCallEnded(ended);
    await connectAndAnswer(h);
    h.advance(42_000);
    h.s.hangup(); h.s.hangup();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith(42);
  });
});

describe('P05-B2.1 dialer: token lifecycle', () => {
  it('reads exp without throwing on garbage', () => {
    expect(tokenExpiresAtMs(jwt(NOW + 5000))).toBe(Math.floor((NOW + 5000) / 1000) * 1000);
    expect(tokenExpiresAtMs('not.a.jwt')).toBeNull();
    expect(tokenExpiresAtMs('x')).toBeNull();
    expect(isTokenUsable(jwt(NOW + 30_000), NOW)).toBe(false);
    expect(isTokenUsable(jwt(NOW + 3_600_000), NOW)).toBe(true);
  });
  it('an expired token is never used to dial', async () => {
    const h = harness({ token: async () => ({ token: jwt(NOW - 1000) }) });
    await h.s.dial('+15555550100', LEAD);
    expect(h.deps.createDevice).not.toHaveBeenCalled();
    expect(h.s.snapshot).toMatchObject({ phase: 'error', recording: 'off' });
  });
  it('every call fetches a fresh token and builds a new device (no reuse across calls)', async () => {
    const h = harness();
    await connectAndAnswer(h, 0);
    h.s.hangup();
    await connectAndAnswer(h, 1);
    expect(h.deps.fetchToken).toHaveBeenCalledTimes(2);
    expect(h.devices).toHaveLength(2);
    expect(h.devices[0].destroyed).toBe(1);
  });
  it('tokenWillExpire refreshes the live device', async () => {
    const h = harness();
    await connectAndAnswer(h);
    h.devices[0].handlers.get('tokenWillExpire')?.();
    await vi.waitFor(() => expect(h.devices[0].tokens).toHaveLength(1));
  });
  it.each([
    ['refresh error', async () => ({ error: 'http_401' })],
    ['refresh returns an expired token', async () => ({ token: jwt(NOW - 1) })],
    ['refresh throws', async () => { throw new Error('x'); }],
  ])('failed token refresh (%s) is surfaced and never applies a bad token', async (_n, refresh) => {
    let first = true;
    const h = harness({ token: async () => { if (first) { first = false; return { token: jwt(NOW + 3_600_000) }; } return (refresh as () => Promise<never>)(); } });
    await connectAndAnswer(h);
    h.devices[0].handlers.get('tokenWillExpire')?.();
    await vi.waitFor(() => expect(h.s.snapshot.error).toMatch(/could not be refreshed/));
    expect(h.devices[0].tokens).toHaveLength(0);
  });
  it.each([
    ['token endpoint error', async () => ({ error: 'http_401' })],
    ['token endpoint throws', async () => { throw new Error('x'); }],
  ])('%s fails closed without creating a device', async (_n, tok) => {
    const h = harness({ token: tok as DialerDeps['fetchToken'] });
    await h.s.dial('+15555550100', LEAD);
    expect(h.deps.createDevice).not.toHaveBeenCalled();
    expect(h.s.snapshot.phase).toBe('error');
    expect(h.s.holdsMedia).toBe(false);
  });
  it('needsSetup renders unavailable without a device', async () => {
    const h = harness({ token: async () => ({ needsSetup: true as const }) });
    await h.s.dial('+15555550100', LEAD);
    expect(h.s.snapshot.phase).toBe('unavailable');
    expect(h.deps.createDevice).not.toHaveBeenCalled();
  });
});
