/**
 * Parallax dialer call/consent/recording state machine (P05-B2.1).
 *
 * Framework-free so the rules are testable without a browser or a Twilio account.
 * The React component (ParallaxDialer) is a thin view over this.
 *
 * Rules enforced here:
 *   - Connecting or answering a call is NEVER consent and NEVER starts recording.
 *   - Consent is recorded only by an explicit confirmConsent(callSid) for the CURRENT
 *     connected call; it is dropped on every hangup, disconnect, error, new dial and dispose.
 *   - Recording can be requested only when canStartRecording() holds; any unknown or
 *     failed state leaves recording off.
 *   - Every call gets a freshly fetched access token and a new Device; the Device is
 *     destroyed (releasing the microphone and media) when the call ends for any reason.
 *     Tokens are never logged or reused across calls.
 *   - teardown() is idempotent and invalidates any in-flight async step, so a connect
 *     that completes after hangup/unmount is disconnected immediately.
 */

export type CallPhase = "idle" | "connecting" | "connected" | "error" | "unavailable";
/**
 * off      - not recording, recording never requested on this call;
 * starting - request in flight (NOT yet recording);
 * on       - server confirmed Twilio is recording;
 * failed   - server confirmed NO recording is running (retry allowed);
 * unknown  - outcome could not be established: the call MAY be recording. Retries are
 *            blocked; the owner is told to hang up.
 */
export type RecordingState = "off" | "starting" | "on" | "failed" | "unknown";

export interface DialerSnapshot {
  phase: CallPhase;
  callSid: string | null;
  consent: { callSid: string; confirmedAt: number } | null;
  recording: RecordingState;
  recordingSid: string | null;
  error: string | null;
  /** True once the SDK has reported the call accepted (answered). */
  answered: boolean;
}

export interface CallLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  disconnect(): void;
  parameters?: Record<string, string | undefined>;
}

export interface DeviceLike {
  connect(opts: { params: Record<string, string> }): Promise<CallLike>;
  destroy(): void;
  updateToken?(token: string): void;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
}

export type TokenResult = { token: string } | { needsSetup: true } | { error: string };

export interface DialerDeps {
  fetchToken(): Promise<TokenResult>;
  createDevice(token: string): Promise<DeviceLike>;
  /** `definite: true` only when the server confirmed no recording is running. Anything else is unknown. */
  startRecording(args: { callSid: string; leadId: string }): Promise<{ recordingSid: string } | { error: string; definite?: boolean; callEnded?: boolean }>;
  now?(): number;
}

const CALL_SID_RE = /^CA[0-9a-f]{32}$/;
/** Refuse to dial with a token that expires within this margin. */
export const TOKEN_MIN_REMAINING_MS = 60_000;

/** Reads `exp` from a JWT without verifying it (the server minted it). Never logs the token. */
export function tokenExpiresAtMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenUsable(token: string, nowMs: number): boolean {
  const exp = tokenExpiresAtMs(token);
  return exp !== null && exp - nowMs > TOKEN_MIN_REMAINING_MS;
}

export function canStartRecording(s: DialerSnapshot): boolean {
  return (
    s.phase === "connected" &&
    s.answered &&
    s.callSid !== null &&
    CALL_SID_RE.test(s.callSid) &&
    s.consent !== null &&
    s.consent.callSid === s.callSid &&
    (s.recording === "off" || s.recording === "failed")
  );
}

const IDLE: DialerSnapshot = {
  phase: "idle",
  callSid: null,
  consent: null,
  recording: "off",
  recordingSid: null,
  error: null,
  answered: false,
};

export class DialerSession {
  private snap: DialerSnapshot = { ...IDLE };
  private listeners = new Set<(s: DialerSnapshot) => void>();
  private endListeners = new Set<(durationSec: number) => void>();
  private device: DeviceLike | null = null;
  private call: CallLike | null = null;
  /** Bumped on every dial and teardown; async steps from an older generation are discarded. */
  private generation = 0;
  private answeredAt = 0;
  private leadId = "";
  private disposed = false;
  /** Shown after the call ends (teardown otherwise clears errors); cleared by the next dial. */
  private notice: string | null = null;
  /** Counts dials, so a late recording response can tell whether a newer call has started. */
  private dialCount = 0;
  private readonly now: () => number;

  constructor(private readonly deps: DialerDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  get snapshot(): DialerSnapshot {
    return this.snap;
  }

  /** True while a Device or Call object is held (i.e. media may be allocated). */
  get holdsMedia(): boolean {
    return this.device !== null || this.call !== null;
  }

  subscribe(fn: (s: DialerSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onCallEnded(fn: (durationSec: number) => void): () => void {
    this.endListeners.add(fn);
    return () => this.endListeners.delete(fn);
  }

  private set(patch: Partial<DialerSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l(this.snap);
  }

  async dial(phone: string, leadId: string): Promise<void> {
    if (this.disposed || this.snap.phase === "connecting" || this.snap.phase === "connected") return;
    // A new call starts from a clean slate: no consent, no recording, no leftover media.
    this.releaseMedia();
    const gen = ++this.generation;
    this.leadId = leadId;
    this.notice = null;
    this.dialCount++;
    this.set({ ...IDLE, phase: "connecting" });

    let device: DeviceLike | null = null;
    try {
      const tok = await this.deps.fetchToken();
      if (gen !== this.generation) return;
      if ("needsSetup" in tok) return this.set({ ...IDLE, phase: "unavailable" });
      if ("error" in tok) return this.fail(gen, "Could not get a call token. Not calling.");
      if (!isTokenUsable(tok.token, this.now())) return this.fail(gen, "Call token expired. Not calling.");

      device = await this.deps.createDevice(tok.token);
      if (gen !== this.generation) { safe(() => device?.destroy()); return; }
      this.device = device;
      device.on?.("tokenWillExpire", () => void this.refreshToken(gen));
      device.on?.("error", () => this.fail(gen, "Dialer error. Call ended."));

      // No recording parameter is sent: the TwiML leg never records.
      const call = await device.connect({ params: { To: phone, leadId } });
      if (gen !== this.generation) { safe(() => call.disconnect()); safe(() => device?.destroy()); return; }
      this.call = call;
      call.on("accept", () => {
        if (gen !== this.generation) return;
        const sid = call.parameters?.CallSid;
        this.answeredAt = this.now();
        this.set({ phase: "connected", answered: true, callSid: typeof sid === "string" && CALL_SID_RE.test(sid) ? sid : null });
      });
      for (const ev of ["disconnect", "cancel", "reject"]) call.on(ev, () => { if (gen === this.generation) this.teardown(); });
      call.on("error", () => this.fail(gen, "Call failed."));
    } catch (e) {
      if (gen !== this.generation) { safe(() => device?.destroy()); return; }
      this.fail(gen, e instanceof Error && e.message ? "Could not start call." : "Could not start call.");
    }
  }

  /** Owner affirms consent was obtained on THIS call. Ignored unless it names the live call. */
  confirmConsent(callSid: string): boolean {
    const s = this.snap;
    if (s.phase !== "connected" || !s.answered || !s.callSid || s.callSid !== callSid) return false;
    if (s.recording !== "off" && s.recording !== "failed") return false;
    this.set({ consent: { callSid, confirmedAt: this.now() } });
    return true;
  }

  /** Withdraw a consent confirmation before recording starts. */
  clearConsent(): void {
    if (this.snap.recording === "off" || this.snap.recording === "failed") this.set({ consent: null });
  }

  async startRecording(): Promise<boolean> {
    if (!canStartRecording(this.snap)) return false;
    const gen = this.generation;
    const dialAtStart = this.dialCount;
    const callSid = this.snap.callSid as string;
    this.set({ recording: "starting", error: null });
    let res: { recordingSid: string } | { error: string; definite?: boolean; callEnded?: boolean };
    try {
      res = await this.deps.startRecording({ callSid, leadId: this.leadId });
    } catch {
      res = { error: "request_failed", definite: false }; // the request may have reached the server
    }
    if (gen !== this.generation || this.snap.callSid !== callSid || this.snap.phase !== "connected") {
      // The call ended before the answer arrived. A confirmed or possible recording must
      // still be disclosed; only a definite "nothing recorded" can be dropped silently.
      const possible = "recordingSid" in res || !("definite" in res && res.definite === true) || ("callEnded" in res && res.callEnded === true);
      if (possible && !this.disposed) {
        const prefix = this.dialCount !== dialAtStart ? "Previous call: " : "";
        const msg = `${prefix}the recording status for the call that just ended was not confirmed before it ended. A partial recording may exist.`;
        if (this.dialCount === dialAtStart) this.notice = msg;
        this.set({ error: msg });
      }
      return false;
    }
    if ("recordingSid" in res && typeof res.recordingSid === "string" && res.recordingSid) {
      this.set({ recording: "on", recordingSid: res.recordingSid });
      return true;
    }
    if ("error" in res && res.callEnded === true) {
      // The server ended the call because it could not confirm the recording state.
      this.notice = "The call was ended because the recording status could not be confirmed. A partial recording may exist.";
      this.set({ recording: "unknown", recordingSid: null, error: this.notice });
      return false;
    }
    if ("error" in res && res.definite === true) {
      this.set({ recording: "failed", recordingSid: null, error: "Recording did not start. The call is not being recorded." });
      return false;
    }
    this.set({
      recording: "unknown",
      recordingSid: null,
      error: "Recording status could not be confirmed. This call may be recorded. Hang up to end it.",
    });
    return false;
  }

  hangup(): void {
    this.teardown();
  }

  /** Unmount / navigation / pagehide. After this the session never dials again. */
  dispose(): void {
    this.disposed = true;
    this.teardown();
    this.listeners.clear();
    this.endListeners.clear();
  }

  private async refreshToken(gen: number) {
    try {
      const tok = await this.deps.fetchToken();
      if (gen !== this.generation || !this.device) return;
      if ("token" in tok && isTokenUsable(tok.token, this.now()) && this.device.updateToken) {
        this.device.updateToken(tok.token);
        return;
      }
    } catch {
      /* fall through */
    }
    if (gen === this.generation) this.set({ error: "Call token could not be refreshed. Finish this call; the next call gets a new token." });
  }

  private fail(gen: number, message: string) {
    if (gen !== this.generation) return;
    this.releaseMedia();
    this.generation++;
    this.set({ ...IDLE, phase: "error", error: message });
  }

  /** Idempotent: ends the call, destroys the Device (releases mic/media), drops consent. */
  private teardown() {
    const hadAnsweredCall = this.snap.answered && this.answeredAt > 0;
    const duration = hadAnsweredCall ? Math.max(0, Math.round((this.now() - this.answeredAt) / 1000)) : null;
    this.generation++;
    this.releaseMedia();
    this.answeredAt = 0;
    if (this.snap.phase !== "idle" || this.snap.consent || this.snap.recording !== "off" || this.snap.error !== this.notice) {
      this.set({ ...IDLE, phase: this.snap.phase === "unavailable" ? "unavailable" : "idle", error: this.notice });
    }
    if (duration !== null) for (const l of this.endListeners) safe(() => l(duration));
  }

  private releaseMedia() {
    const call = this.call;
    const device = this.device;
    this.call = null;
    this.device = null;
    if (call) safe(() => call.disconnect());
    if (device) safe(() => device.destroy());
  }
}

function safe(fn: () => unknown) {
  try {
    fn();
  } catch {
    /* cleanup must never throw */
  }
}
