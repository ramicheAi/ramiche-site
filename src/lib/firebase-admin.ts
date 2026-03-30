/* ══════════════════════════════════════════════════════════════
   METTLE — Firebase Admin SDK (Server-Side Only)

   Phase 5: Session cookie verification + token minting.
   Requires FIREBASE_SERVICE_ACCOUNT env var (JSON string).
   ══════════════════════════════════════════════════════════════ */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
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
    adminDb = getFirestore(adminApp);
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

// ── Firestore Admin Operations ───────────────────────────────
export async function adminWriteSubscription(
  customerId: string,
  data: Record<string, unknown>
): Promise<boolean> {
  getAdminApp();
  if (!adminDb) return false;
  try {
    await adminDb
      .collection("subscriptions")
      .doc(customerId)
      .set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    console.warn("[Firebase Admin] subscription write failed:", e);
    return false;
  }
}

// ── Write Connected Account ─────────────────────────────────
export async function adminWriteConnectedAccount(
  uid: string,
  data: Record<string, unknown>
): Promise<boolean> {
  getAdminApp();
  if (!adminDb) return false;
  try {
    await adminDb
      .collection("connectedAccounts")
      .doc(uid)
      .set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    console.warn("[Firebase Admin] connected account write failed:", e);
    return false;
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

/** YOLO builds manifest synced by POST /api/command-center/firestore-sync (local → Firestore). */
export async function fetchCommandCenterYoloManifest(): Promise<{
  builds: Record<string, unknown>[];
  buildCount: number;
} | null> {
  getAdminApp();
  if (!adminDb) return null;
  try {
    const snap = await adminDb
      .collection("command-center")
      .doc("yolo-builds")
      .collection("manifest")
      .doc("latest")
      .get();
    if (!snap.exists) return null;
    const data = snap.data();
    const builds = data?.builds;
    if (!Array.isArray(builds)) return null;
    return { builds: builds as Record<string, unknown>[], buildCount: Number(data?.buildCount ?? builds.length) };
  } catch (e) {
    console.warn("[Firebase Admin] yolo manifest read failed:", e);
    return null;
  }
}

/** Cron jobs + history synced by POST /api/command-center/firestore-sync (local jobs.json → Firestore). */
export async function fetchCommandCenterCronJobsFromFirestore(): Promise<{
  jobs: Record<string, unknown>[];
  history: Record<string, unknown>[];
} | null> {
  getAdminApp();
  if (!adminDb) return null;
  try {
    const [configSnap, historySnap] = await Promise.all([
      adminDb.collection("command-center").doc("crons").collection("config").doc("latest").get(),
      adminDb.collection("command-center").doc("crons").collection("history").doc("latest").get(),
    ]);
    const configData = configSnap.data();
    const jobs = configData?.jobs;
    if (!Array.isArray(jobs) || jobs.length === 0) return null;
    const historyData = historySnap.data();
    const entries = historyData?.entries;
    return {
      jobs,
      history: Array.isArray(entries) ? (entries as Record<string, unknown>[]) : [],
    };
  } catch (e) {
    console.warn("[Firebase Admin] cron jobs read failed:", e);
    return null;
  }
}

/** MERIDIAN `dashboard_api.json` synced to Firestore (same shape as local file). */
export async function fetchMeridianDashboardFromFirestore(): Promise<unknown | null> {
  getAdminApp();
  if (!adminDb) return null;
  try {
    const snap = await adminDb.collection("command-center").doc("meridian").get();
    if (!snap.exists) return null;
    const d = snap.data();
    if (!d || typeof d !== "object") return null;
    const o = d as Record<string, unknown>;
    const raw =
      typeof o.snapshot === "string"
        ? o.snapshot
        : typeof o.payloadJson === "string"
          ? o.payloadJson
          : typeof o.dashboardJson === "string"
            ? o.dashboardJson
            : null;
    if (raw) {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    if (o.portfolio && typeof o.portfolio === "object") return o;
    return null;
  } catch (e) {
    console.warn("[Firebase Admin] meridian read failed:", e);
    return null;
  }
}
