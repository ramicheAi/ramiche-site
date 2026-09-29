// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ParallaxDialer } from './ParallaxDialer';
import type { CallLike, DeviceLike, DialerDeps } from '@/lib/dialer-session';

const SID = 'CA' + 'a'.repeat(32);
const LEAD = '5b9a0c1e-1111-4222-8333-944455556666';
const token = () => {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256' })}.${b({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
};

function fakes() {
  const handlers = new Map<string, Array<() => void>>();
  const call: CallLike & { disconnects: number; emit(ev: string): void } = {
    disconnects: 0,
    parameters: { CallSid: SID },
    on(ev, fn) { handlers.set(ev, [...(handlers.get(ev) ?? []), fn as () => void]); return this; },
    emit(ev) { for (const f of handlers.get(ev) ?? []) f(); },
    disconnect() { this.disconnects++; this.emit('disconnect'); },
  };
  const device: DeviceLike & { destroyed: number } = {
    destroyed: 0,
    async connect() { return call; },
    destroy() { this.destroyed++; },
    on() { return this; },
  };
  const deps: DialerDeps = {
    fetchToken: vi.fn(async () => ({ token: token() })),
    createDevice: vi.fn(async () => device),
    startRecording: vi.fn(async () => ({ recordingSid: 'RE' + 'c'.repeat(32) })),
  };
  return { call, device, deps };
}

async function dialAndAnswer(f: ReturnType<typeof fakes>) {
  await act(async () => { fireEvent.click(screen.getByText(/Call \+15555550100/)); });
  await act(async () => { f.call.emit('accept'); });
}

afterEach(() => cleanup());

describe('ParallaxDialer (P05-B2.1)', () => {
  it('shows "Connected · not recording" after answer and never auto-records', async () => {
    const f = fakes();
    render(<ParallaxDialer phone="+15555550100" leadId={LEAD} allowRecordToggle deps={f.deps} />);
    await dialAndAnswer(f);
    expect(screen.getByTestId('dialer-status').textContent).toBe('Connected · not recording');
    expect((screen.getByText('Start recording') as HTMLButtonElement).disabled).toBe(true);
    expect(f.deps.startRecording).not.toHaveBeenCalled();
  });
  it('recording starts only after the per-call consent box is ticked, and the status says RECORDING', async () => {
    const f = fakes();
    render(<ParallaxDialer phone="+15555550100" leadId={LEAD} allowRecordToggle deps={f.deps} />);
    await dialAndAnswer(f);
    await act(async () => { fireEvent.click(screen.getByLabelText(/consented to recording/)); });
    expect((screen.getByText('Start recording') as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(screen.getByText('Start recording')); });
    expect(f.deps.startRecording).toHaveBeenCalledWith({ callSid: SID, leadId: LEAD });
    expect(screen.getByTestId('dialer-status').textContent).toBe('Connected · ● RECORDING');
  });
  it('without allowRecordToggle there is no way to record', async () => {
    const f = fakes();
    render(<ParallaxDialer phone="+15555550100" leadId={LEAD} deps={f.deps} />);
    await dialAndAnswer(f);
    expect(screen.queryByText('Start recording')).toBeNull();
    expect(screen.queryByLabelText(/consented to recording/)).toBeNull();
  });
  it('Hang up ends the call and releases the device', async () => {
    const f = fakes();
    render(<ParallaxDialer phone="+15555550100" leadId={LEAD} allowRecordToggle deps={f.deps} />);
    await dialAndAnswer(f);
    await act(async () => { fireEvent.click(screen.getByText('Hang up')); });
    expect(f.call.disconnects).toBe(1);
    expect(f.device.destroyed).toBe(1);
    expect(screen.getByText(/Call \+15555550100/)).toBeTruthy();
    expect(screen.getByTestId('dialer-status').textContent).toBe('');
  });
  it('unmounting mid-call (navigating away) ends the call and releases the device', async () => {
    const f = fakes();
    const { unmount } = render(<ParallaxDialer phone="+15555550100" leadId={LEAD} deps={f.deps} />);
    await dialAndAnswer(f);
    unmount();
    expect(f.call.disconnects).toBe(1);
    expect(f.device.destroyed).toBe(1);
  });
  it('pagehide (tab close / bfcache) ends the call and releases the device', async () => {
    const f = fakes();
    render(<ParallaxDialer phone="+15555550100" leadId={LEAD} deps={f.deps} />);
    await dialAndAnswer(f);
    await act(async () => { window.dispatchEvent(new Event('pagehide')); });
    expect(f.call.disconnects).toBe(1);
    expect(f.device.destroyed).toBe(1);
  });
  it('a second call does not inherit the first call consent', async () => {
    const f = fakes();
    render(<ParallaxDialer phone="+15555550100" leadId={LEAD} allowRecordToggle deps={f.deps} />);
    await dialAndAnswer(f);
    await act(async () => { fireEvent.click(screen.getByLabelText(/consented to recording/)); });
    await act(async () => { fireEvent.click(screen.getByText('Hang up')); });
    await dialAndAnswer(f);
    expect((screen.getByLabelText(/consented to recording/) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByText('Start recording') as HTMLButtonElement).disabled).toBe(true);
  });
});
