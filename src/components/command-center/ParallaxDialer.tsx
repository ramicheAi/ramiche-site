"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cockpitFetch } from "@/lib/cockpit-fetch";
import { DialerSession, canStartRecording, type DialerDeps, type DialerSnapshot, type TokenResult } from "@/lib/dialer-session";

/**
 * In-browser click-to-call on the Parallax Twilio line. Lazy-loads the SDK (keeps it
 * out of every Deal Room page's initial bundle) and renders a disabled hint while the
 * server reports { needsSetup: true }.
 *
 * P05-B2.1 consent boundary: calls never record on connect. When `allowRecordToggle`
 * is set, a connected call shows an explicit per-call consent confirmation; only after
 * it is ticked can "Start recording" run, and the server re-checks the live call and
 * saves consent evidence before Twilio records anything. Hanging up, leaving the page
 * or unmounting ends the call and releases the microphone.
 */
export const dialerDeps: DialerDeps = {
  async fetchToken(): Promise<TokenResult> {
    try {
      const res = await cockpitFetch("/api/command-center/voice/token", { cache: "no-store" });
      if (!res.ok) return { error: `http_${res.status}` };
      const j = (await res.json()) as { token?: unknown; needsSetup?: unknown };
      if (j.needsSetup === true) return { needsSetup: true };
      return typeof j.token === "string" ? { token: j.token } : { error: "no_token" };
    } catch {
      return { error: "network" };
    }
  },
  async createDevice(token) {
    const { Device } = await import("@twilio/voice-sdk");
    return new Device(token, { logLevel: "error" }) as unknown as Awaited<ReturnType<DialerDeps["createDevice"]>>;
  },
  async startRecording({ callSid, leadId }) {
    try {
      const res = await cockpitFetch("/api/command-center/voice/recording/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callSid, leadId, consentConfirmed: true }),
      });
      const j = (await res.json().catch(() => null)) as { recording?: unknown; recordingSid?: unknown; error?: unknown; definite?: unknown; callEnded?: unknown } | null;
      if (res.ok && j?.recording === true && typeof j.recordingSid === "string") return { recordingSid: j.recordingSid };
      // Only an explicit server statement makes "not recording" definite; an unreadable reply is unknown.
      return { error: typeof j?.error === "string" ? j.error : `http_${res.status}`, definite: j?.definite === true, callEnded: j?.callEnded === true };
    } catch {
      return { error: "network", definite: false };
    }
  },
};

export function ParallaxDialer({
  phone,
  leadId,
  allowRecordToggle = false,
  onCallEnded,
  deps = dialerDeps,
}: {
  phone: string | null | undefined;
  leadId: string;
  allowRecordToggle?: boolean;
  onCallEnded?: (durationSec: number) => void;
  /** Test seam. */
  deps?: DialerDeps;
}) {
  const [session] = useState(() => new DialerSession(deps));
  const snap: DialerSnapshot = useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.snapshot,
    () => session.snapshot,
  );
  const endedRef = useRef(onCallEnded);
  useEffect(() => {
    endedRef.current = onCallEnded;
  }, [onCallEnded]);

  useEffect(() => session.onCallEnded((d) => endedRef.current?.(d)), [session]);

  // Unmount (client-side navigation), tab close and bfcache all end the call and release
  // the microphone. hangup() is idempotent and discards any connect still in flight; it
  // is used instead of dispose() so React's dev-mode effect re-run keeps the dialer usable.
  useEffect(() => {
    const end = () => session.hangup();
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      end();
    };
  }, [session]);

  if (!phone) return null;

  if (snap.phase === "unavailable") {
    return (
      <span title="Set up the Parallax line, see PHONE-SETUP.md" style={{ fontSize: 11, color: "var(--t-lo)", padding: "6px 10px" }}>
        📞 {phone} <span style={{ opacity: 0.7 }}>(browser dialer needs setup)</span>
      </span>
    );
  }

  const live = snap.phase === "connecting" || snap.phase === "connected";
  const consentChecked = !!snap.consent && snap.consent.callSid === snap.callSid;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} data-testid="parallax-dialer">
      {live ? (
        <button onClick={() => session.hangup()} style={{ fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 6, background: "var(--c-red)", color: "#fff", border: "none", cursor: "pointer" }}>
          {snap.phase === "connecting" ? "Cancel call" : "Hang up"}
        </button>
      ) : (
        <button onClick={() => void session.dial(phone, leadId)} style={{ fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 6, background: "var(--c-green)", color: "#001b0c", border: "none", cursor: "pointer" }}>
          📞 Call {phone} (Parallax line)
        </button>
      )}

      <span data-testid="dialer-status" style={{ fontSize: 11, fontWeight: 700, color: snap.recording === "on" ? "var(--c-red)" : "var(--t-lo)" }}>
        {snap.phase === "connecting"
          ? "Ringing"
          : snap.phase === "connected"
            ? snap.recording === "on"
              ? "Connected · ● RECORDING"
              : snap.recording === "unknown"
                ? "Connected · recording status UNKNOWN (may be recording)"
                : snap.recording === "starting"
                ? "Connected · recording requested, status not yet confirmed"
                : "Connected · not recording"
            : ""}
      </span>

      {allowRecordToggle && snap.phase === "connected" && snap.recording !== "on" && snap.recording !== "unknown" ? (
        <>
          <label style={{ fontSize: 11, color: "var(--t-lo)", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consentChecked}
              disabled={snap.recording === "starting" || !snap.callSid}
              onChange={(e) => (e.target.checked && snap.callSid ? session.confirmConsent(snap.callSid) : session.clearConsent())}
            />
            Everyone on this call has consented to recording
          </label>
          <button
            onClick={() => void session.startRecording()}
            disabled={!canStartRecording(snap)}
            style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", color: canStartRecording(snap) ? "var(--t-hi)" : "var(--t-lo)", cursor: canStartRecording(snap) ? "pointer" : "default" }}
          >
            Start recording
          </button>
        </>
      ) : null}

      {snap.error ? <span style={{ fontSize: 11, color: "var(--c-red)" }}>{snap.error}</span> : null}
    </div>
  );
}
