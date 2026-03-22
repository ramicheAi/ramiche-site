/* ══════════════════════════════════════════════════════════════
   METTLE — Firebase Admin SDK (Server-Side Only)

   Phase 5: Session cookie verification + token minting.
   Requires FIREBASE_SERVICE_ACCOUNT env var (JSON string).
   ══════════════════════════════════════════════════════════════ */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    adminAuth = getAuth(adminApp);
    return adminApp;
  }

  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    console.warn("[Firebase Admin] FIREBASE_SERVICE_ACCOUNT not set — skipping init");
    return null;
  }

  try {
    const parsed = JSON.parse(sa);
    adminApp = initializeApp({ credential: cert(parsed) });
    adminAuth = getAuth(adminApp);
    return adminApp;
  } catch (e) {
    console.warn("[Firebase Admin] init failed:", e);
    return null;
  }
}

// ── Verify ID Token ──────────────────────────────────────────
export async function verifyIdToken(
  idToken: string
): Promise<{ uid: string; email?: string } | null> {
  getAdminApp();
  if (!adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

// ── Create Session Cookie ────────────────────────────────────
export async function createSessionCookie(
  idToken: string,
  expiresIn: number = 30 * 24 * 60 * 60 * 1000 // 30 days
): Promise<string | null> {
  getAdminApp();
  if (!adminAuth) return null;
  try {
    return await adminAuth.createSessionCookie(idToken, { expiresIn });
  } catch {
    return null;
  }
}

// ── Verify Session Cookie ────────────────────────────────────
export async function verifySessionCookie(
  cookie: string
): Promise<{ uid: string; email?: string } | null> {
  getAdminApp();
  if (!adminAuth) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

// ── Revoke Session ───────────────────────────────────────────
export async function revokeSession(uid: string): Promise<boolean> {
  getAdminApp();
  if (!adminAuth) return false;
  try {
    await adminAuth.revokeRefreshTokens(uid);
    return true;
  } catch {
    return false;
  }
}
