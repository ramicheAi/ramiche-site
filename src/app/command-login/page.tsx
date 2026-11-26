"use client";

/* ══════════════════════════════════════════════════════════════
   Command Center — owner sign-in (CC-P06-SECURITY-RECONCILIATION-01)

   Minimal by design: this reconciliation's job is the identity boundary,
   not visual polish. Reuses the existing Firebase email/password flow
   (src/app/apex-athlete/lib/firebase-auth.ts) rather than inventing a new
   sign-in mechanism, then mints the same `__session` cookie every other
   protected area of this app already uses (POST /api/auth/session).
   middleware.ts redirects unauthenticated `/command-center*` page requests
   here with `?next=`.
   ══════════════════════════════════════════════════════════════ */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fbSignIn, fbGetCurrentUser } from "@/app/apex-athlete/lib/firebase-auth";
import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase";
import { safeCommandCenterNext } from "@/lib/command-center-next";

export default function CommandLoginPage() {
  return (
    <Suspense fallback={null}>
      <CommandLoginForm />
    </Suspense>
  );
}

function CommandLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeCommandCenterNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const signIn = await fbSignIn(email, password);
      if (!signIn.success) {
        setError(signIn.error ?? "Sign-in failed.");
        return;
      }

      const user = fbGetCurrentUser() ?? (app ? getAuth(app).currentUser : null);
      const idToken = await user?.getIdToken();
      if (!idToken) {
        setError("Could not obtain an identity token after sign-in.");
        return;
      }

      const res = await fetch("/api/auth/command-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? "This account is not the Command Center owner."
            : res.status === 503
              ? "Command Center owner access is not configured."
              : "Session could not be established."
        );
        return;
      }

      // Trust this device (founder Priority 1 decision): a one-time, silent
      // enrollment right after a FRESH Firebase sign-in, so this device can
      // PIN-unlock afterward without repeating email/password every 12h.
      // Best-effort — a failure here never blocks sign-in itself; the
      // device simply falls back to requiring Firebase again next time.
      try {
        await fetch("/api/command-center/auth/device/enroll", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ label: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : undefined }),
        });
      } catch {
        /* best-effort */
      }

      router.push(next);
    } catch {
      setError("Unexpected error during sign-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e18", color: "#fff" }}>
      <form onSubmit={handleSubmit} style={{ width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Command Center</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          Owner sign-in required. This account must match the configured owner identity.
        </p>
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#15151f", color: "#fff" }}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#15151f", color: "#fff" }}
        />
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          style={{ padding: 10, borderRadius: 8, border: "none", background: "#00f0ff", color: "#000", fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
