"use client";
import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, signOut, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { app } from '@/lib/firebase';
import './command-login.css';

/**
 * Owner sign-in for the Parallax OS Command Center.
 *
 * Security flow (unchanged by the P05-B4 visual redesign): Firebase email/password
 * sign-in with in-memory persistence, exchange of a fresh ID token for the
 * server-side httpOnly session cookie (exact Origin + custom header), an owner
 * check via /api/command-center/csrf, then the client Firebase session is signed
 * out so the server cookie is the only credential.
 */
export default function CommandLogin() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const fields = new FormData(event.currentTarget);
    try {
      if (!app) throw new Error('Sign-in is not configured.');
      const auth = getAuth(app);
      await setPersistence(auth, inMemoryPersistence);
      const result = await signInWithEmailAndPassword(auth, String(fields.get('email')), String(fields.get('password')));
      try {
        const response = await fetch('/api/auth/session', {method: 'POST', credentials: 'same-origin', redirect: 'error', headers: {'content-type': 'application/json', 'x-parallax-session-exchange': '1'}, body: JSON.stringify({idToken: await result.user.getIdToken()})});
        if (!response.ok) throw new Error('Sign-in could not be verified.');
        const owner = await fetch('/api/command-center/csrf', {cache: 'no-store', credentials: 'same-origin'});
        if (!owner.ok) throw new Error('This account is not authorized for the cockpit, or security configuration is unavailable.');
      } finally { await signOut(auth); }
      window.location.assign('/command-center');
    } catch (e) { setError(friendly(e)); }
    finally { setBusy(false); }
  }
  return (
    <main className="pl-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" />
      <div className="pl-bg" aria-hidden="true"><div className="pl-grid" /><div className="pl-glow" /></div>
      <section className="pl-card" aria-labelledby="pl-title">
        <div className="pl-edge" aria-hidden="true" />
        <header className="pl-head">
          <div className="pl-mark" aria-hidden="true"><span /></div>
          <p className="pl-kicker">Command Center</p>
          <h1 id="pl-title" className="pl-title">PARALLAX OS</h1>
          <p className="pl-sub">Owner sign-in. Authorized account only.</p>
        </header>
        <form className="pl-form" onSubmit={login} noValidate={false}>
          <label className="pl-field" htmlFor="pl-email">
            <span className="pl-label">Email</span>
            <input id="pl-email" className="pl-input" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy} />
          </label>
          <label className="pl-field" htmlFor="pl-password">
            <span className="pl-label">Password</span>
            <input id="pl-password" className="pl-input" name="password" type="password" autoComplete="current-password" required disabled={busy} />
          </label>
          {error && <p className="pl-error" role="alert">{error}</p>}
          <button className="pl-button" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? <><span className="pl-spinner" aria-hidden="true" />Verifying</> : 'Sign in'}
          </button>
        </form>
        <footer className="pl-foot"><span className="pl-dot" aria-hidden="true" />Secured by Cloudflare Access</footer>
      </section>
    </main>
  );
}

/** Firebase auth errors carry codes; show plain language without revealing which part was wrong. */
function friendly(e: unknown): string {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(code)) return 'Email or password is incorrect.';
  if (/too-many-requests/.test(code)) return 'Too many attempts. Wait a few minutes, then try again.';
  if (/network-request-failed/.test(code)) return 'Network error. Check your connection and try again.';
  return e instanceof Error && !code ? e.message : 'Sign-in failed. Try again.';
}
