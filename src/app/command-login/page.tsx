"use client";
import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, signOut, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { app } from '@/lib/firebase';

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
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  return <main style={{maxWidth: 420, margin: '12vh auto', padding: 24}}><h1>Parallax OS</h1><p>Sign in with your authorized account.</p><form onSubmit={login}><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button disabled={busy}>{busy ? 'Verifying…' : 'Sign in'}</button></form>{error && <p role="alert">{error}</p>}</main>;
}
