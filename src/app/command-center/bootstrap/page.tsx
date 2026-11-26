"use client";

/* ══════════════════════════════════════════════════════════════
   Command Center — device bootstrap / approval entry
   (founder correction, CC-PRODUCTION-OWNER-RECOVERY-01 follow-up)

   middleware.ts sends any browser with NO `cc_device` cookie here instead
   of straight to Firebase sign-in. Two non-Firebase paths:
     - A device-approval code (32 hex chars from randomBytes(16)) generated
       by an already-enrolled device — supports a `?code=` magic link,
       since the code is single-use and expires in 5 minutes, so putting it
       in a URL is an acceptable, bounded exposure.
     - The bootstrap secret (first device only) — manual paste ONLY, no
       `?token=` query-param support (independent review finding: that
       secret is static and long-lived, so a magic link containing it would
       land in browser history, Vercel request logs, and anywhere the link
       was shared — unlike the one-time code, this exposure is NOT bounded).
   Firebase sign-in is offered only as an explicit fallback link, never
   auto-redirected to.
   ══════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeCommandCenterNext } from "@/lib/command-center-next";

// Device-approval codes are exactly this shape (randomBytes(16).toString("hex")
// in command-center-device-trust.ts). Used to route a manually-pasted value to
// the right endpoint deterministically, instead of trying both and showing a
// confusing error when the first guess fails (independent review finding).
const CODE_SHAPE = /^[0-9a-f]{32}$/i;

export default function BootstrapPage() {
  return (
    <Suspense fallback={null}>
      <BootstrapForm />
    </Suspense>
  );
}

function BootstrapForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeCommandCenterNext(searchParams.get("next"));
  const urlCode = searchParams.get("code") || "";

  const [value, setValue] = useState(urlCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const [preflight, setPreflight] = useState<{ ready: boolean; alreadyEnrolled: boolean } | null>(null);

  async function attempt(v: string) {
    const trimmed = v.trim();
    if (!trimmed) return;
    setError(null);
    setBusy(true);
    try {
      const isCode = CODE_SHAPE.test(trimmed);
      const res = await fetch(
        isCode ? "/api/command-center/auth/device/redeem" : "/api/command-center/auth/device/bootstrap",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(isCode ? { code: trimmed } : { token: trimmed }),
        }
      );
      if (res.ok) {
        router.push(next);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === "already_enrolled"
          ? "A device already exists for this account. Use the unlock page, or get an approval code from an already-enrolled device."
          : body.error === "locked"
            ? "Too many attempts. Try again in a few minutes."
            : isCode
              ? "That approval code wasn't recognized, or has expired."
              : "That bootstrap token wasn't recognized."
      );
    } catch {
      setError("Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  // Magic-link auto-submit: ONLY for ?code=, never for a bootstrap secret
  // (there is no ?token= param at all — see the file header).
  useEffect(() => {
    if (!autoTried && urlCode) {
      setAutoTried(true);
      void attempt(urlCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A fresh iOS Home Screen install can have its own cookie jar, so an already
  // enrolled owner may arrive here with no cc_device cookie. Tell them to use a
  // one-time approval code from an enrolled device instead of letting them
  // paste the consumed bootstrap token. No automatic enrollment happens.
  useEffect(() => {
    fetch("/api/command-center/auth/device/bootstrap", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ready?: boolean; alreadyEnrolled?: boolean } | null) => {
        if (data) {
          setPreflight({
            ready: data.ready === true,
            alreadyEnrolled: data.alreadyEnrolled === true,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await attempt(value);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e18", color: "#fff" }}>
      <form onSubmit={handleSubmit} style={{ width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Command Center</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          This device isn&apos;t enrolled yet. Paste your bootstrap token (first device only) or a
          device-approval code (from an already-enrolled device) — or open an approval-code magic link.
        </p>
        {preflight?.alreadyEnrolled && (
          <p style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.5 }}>
            This browser has no device access yet. On a device that is already enrolled, open Command
            Center, go to Devices, re-enter your PIN, and generate a one-time approval code. Paste
            that code here. The bootstrap token cannot re-enroll this browser.
          </p>
        )}
        {preflight?.ready === false && (
          <p style={{ fontSize: 12, color: "#f87171" }}>
            Bootstrap is not configured on this deployment.
          </p>
        )}
        <input
          type="text"
          autoComplete="off"
          placeholder="Bootstrap token or approval code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#15151f", color: "#fff" }}
        />
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={busy || !value.trim()}
          style={{ padding: 10, borderRadius: 8, border: "none", background: "#00f0ff", color: "#000", fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy || !value.trim() ? 0.6 : 1 }}
        >
          {busy ? "Checking…" : "Continue"}
        </button>
        <a href={`/command-login?next=${encodeURIComponent(next)}`} style={{ fontSize: 12, opacity: 0.6, textAlign: "center", color: "#fff" }}>
          Or sign in with Firebase (recovery)
        </a>
      </form>
    </div>
  );
}
