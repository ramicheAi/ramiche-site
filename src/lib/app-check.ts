// ════════════════════════════════════════════════════════════════════════
// app-check.ts.proposed  — INERT until renamed to app-check.ts and imported.
//
// Firebase App Check (reCAPTCHA v3). Defense-in-depth ON TOP of the Firestore
// rules: it ensures only YOUR real web apps can talk to the backend, not a
// script using the public web API key to hammer the open read paths
// (leaderboard / characters / planets / lore / meet-results). The rules say
// "what is allowed"; App Check says "from a verified app instance".
//
// NOTE: the server-side Admin SDK (your API routes) BYPASSES App Check, so
// none of your /api routes are affected — this only gates client SDK calls.
//
// ── SETUP (Console — only you can do these) ──────────────────────────────
//  1. Firebase Console -> Project settings -> App Check -> "Apps": register
//     each Web app (apex-athlete-73755 has one per site).
//  2. Provider = "reCAPTCHA v3"; create the site key (or reuse one).
//  3. Set in Vercel + .env.local for each app:
//        NEXT_PUBLIC_FIREBASE_APPCHECK_KEY=<reCAPTCHA v3 site key>
//  4. App Check -> APIs -> "Cloud Firestore": set to **Monitor** first.
//     Watch the "verified requests" %. Only when it's ~100% from real users,
//     switch to **Enforce**. (Enforcing too early locks out real clients.)
//
// Local dev: in the browser console set
//   self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
// then register the printed debug token in Console -> App Check -> Apps.
// ════════════════════════════════════════════════════════════════════════
import type { FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

let started = false;

/** Call once, right after initializeApp(). Safe no-op until the key is set. */
export function startAppCheck(app: FirebaseApp): void {
  if (started || typeof window === "undefined") return;
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_KEY;
  if (!siteKey) return; // graceful no-op — never breaks the app pre-config
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    started = true;
  } catch (e) {
    console.warn("[AppCheck] init skipped:", e);
  }
}
