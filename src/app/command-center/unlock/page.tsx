"use client";

/* ══════════════════════════════════════════════════════════════
   Command Center — trusted-device PIN unlock
   (founder Priority 1 decision, CC-RECOVERY-DELIVERY-CONVERGENCE-01)

   middleware.ts sends an already-enrolled device here instead of
   /command-login. The PIN alone proves nothing without the `cc_device`
   cookie this page never sees or handles directly (httpOnly) — it is
   verified server-side by POST /api/command-center/auth/pin, which also
   enforces attempt limits and lockout. On success it mints `cc_unlock` and
   this page simply navigates on; no second prompt.
   ══════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeCommandCenterNext } from "@/lib/command-center-next";

export default function UnlockPage() {
  return (
    <Suspense fallback={null}>
      <UnlockForm />
    </Suspense>
  );
}

function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeCommandCenterNext(searchParams.get("next"));

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceTrusted, setDeviceTrusted] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/command-center/auth/pin", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { deviceTrusted?: boolean }) => setDeviceTrusted(data.deviceTrusted ?? false))
      .catch(() => setDeviceTrusted(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/command-center/auth/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          res.status === 429
            ? "Too many attempts. Try again in a few minutes."
            : res.status === 401 && body.error === "device_not_trusted"
              ? "This device isn't recognized anymore. Sign in to re-enroll it."
              : "Incorrect PIN."
        );
        return;
      }
      router.push(next);
    } catch {
      setError("Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e18", color: "#fff" }}>
      <form onSubmit={handleSubmit} style={{ width: 280, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Command Center</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>Enter your PIN to unlock this device.</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#15151f", color: "#fff", textAlign: "center", fontSize: 20, letterSpacing: 4 }}
        />
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
        {deviceTrusted === false && !error && (
          <p style={{ color: "#fbbf24", fontSize: 12 }}>
            This device isn&apos;t currently trusted.{" "}
            <a href={`/command-login?next=${encodeURIComponent(next)}`} style={{ color: "#00f0ff" }}>
              Sign in with Firebase
            </a>{" "}
            to re-enroll it.
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{ padding: 10, borderRadius: 8, border: "none", background: "#00f0ff", color: "#000", fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <a href={`/command-login?next=${encodeURIComponent(next)}`} style={{ fontSize: 12, opacity: 0.6, textAlign: "center", color: "#fff" }}>
          Use email/password instead
        </a>
      </form>
    </div>
  );
}
