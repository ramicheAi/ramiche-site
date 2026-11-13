"use client";

/* ══════════════════════════════════════════════════════════════
   Command Center — add a new device
   (founder correction, CC-PRODUCTION-OWNER-RECOVERY-01 follow-up)

   Reached from an ALREADY logged-in session (PIN-unlocked or Firebase —
   requireCommandCenterOwner gates this page normally, via middleware).
   Generates a short-lived, single-use approval code/magic-link for a NEW
   device, after a step-up PIN re-check (POST /api/command-center/auth/
   device/approve) — holding an existing unlock session is not enough on
   its own.
   ══════════════════════════════════════════════════════════════ */

import { useState } from "react";

export default function DevicesPage() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; expiresAt: string; link: string } | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch("/api/command-center/auth/device/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Too many attempts. Try again in a few minutes."
            : res.status === 401
              ? "Incorrect PIN."
              : "Couldn't generate a code."
        );
        return;
      }
      const link = `${window.location.origin}/command-center/bootstrap?code=${encodeURIComponent(body.code)}`;
      setResult({ code: body.code, expiresAt: body.expiresAt, link });
    } catch {
      setError("Unexpected error.");
    } finally {
      setPin("");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e18", color: "#fff" }}>
      <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Add a new device</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          Re-enter your PIN to generate a one-time code (valid 5 minutes) for your other device —
          open the link it gives you there. No Firebase involved.
        </p>
        <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Re-enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
            required
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#15151f", color: "#fff", textAlign: "center", fontSize: 20, letterSpacing: 4 }}
          />
          {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
          <button
            type="submit"
            disabled={busy || !pin.trim()}
            style={{ padding: 10, borderRadius: 8, border: "none", background: "#00f0ff", color: "#000", fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy || !pin.trim() ? 0.6 : 1 }}
          >
            {busy ? "Generating…" : "Generate code"}
          </button>
        </form>
        {result && (
          <div style={{ padding: 12, borderRadius: 8, background: "#15151f", border: "1px solid #333", wordBreak: "break-all", fontSize: 12 }}>
            <p style={{ opacity: 0.7, marginBottom: 6 }}>Open this on your other device (expires {new Date(result.expiresAt).toLocaleTimeString()}):</p>
            <code style={{ color: "#00f0ff" }}>{result.link}</code>
          </div>
        )}
      </div>
    </div>
  );
}
