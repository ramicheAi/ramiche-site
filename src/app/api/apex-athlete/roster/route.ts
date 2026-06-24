// ════════════════════════════════════════════════════════════════════════
// PROPOSED — Admin-SDK roster API route. Replaces the CLIENT Firestore access
// in src/lib/storage-service.ts. INERT until renamed route.ts.proposed -> route.ts
//
// WHY: storage-service.ts read/wrote organizations/{orgId}/rosters/all from the
// BROWSER via the client SDK — which only worked while the rule was open
// (read: if true), exposing minors' roster PII to anyone who guessed the orgId
// (default "saint-andrews-aquatics"). /organizations is now `if false`, so this
// server route is the only legitimate path.
//
// AUTH — authorizeCoach() accepts EITHER (both fail-closed):
//   Path B (active): apex-coach-session HMAC cookie, set by POST
//                    /api/apex-athlete/coach-session after server-side PIN check.
//   Path A (future): Firebase __session cookie + org coach membership.
// Until one is wired into the coach login flow, this denies — so NO regression
// and NO exposure (roster has been localStorage-only since Jun 3 regardless).
// See APEX-COACH-AUTH-PROPOSAL.md for the wiring order.
// ════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { verifyCoachToken } from "@/lib/apex-coach-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let adminDb: Firestore | null = null;
function getAdminDb(): Firestore | null {
  if (adminDb) return adminDb;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) return null;
  try {
    const parsed = JSON.parse(sa);
    const app: App =
      getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(parsed) });
    adminDb = getFirestore(app);
    return adminDb;
  } catch {
    return null;
  }
}

// ── AUTH GUARD (fail-closed) ────────────────────────────────────────────
async function authorizeCoach(req: NextRequest, orgId: string): Promise<boolean> {
  // Path B — server-verified PIN session (HMAC cookie).
  if (verifyCoachToken(req.cookies.get("apex-coach-session")?.value, orgId)) return true;

  // Path A — Firebase Auth session cookie + org coach membership.
  const cookie = req.cookies.get("__session")?.value;
  if (cookie) {
    const user = await verifySessionCookie(cookie);
    if (user?.email) {
      const db = getAdminDb();
      if (db) {
        try {
          const snap = await db.doc(`organizations/${orgId}/config/coaches`).get();
          const coaches = (snap.exists ? (snap.data()?.coaches ?? []) : []) as Array<{ email?: string }>;
          const email = user.email.toLowerCase();
          if (coaches.some((c) => (c.email ?? "").toLowerCase() === email)) return true;
        } catch {
          /* fall through to deny */
        }
      }
    }
  }
  return false;
}

// Reject anything that isn't a plain org slug (prevents path traversal).
function sanitizeOrgId(v: string | null): string | null {
  if (!v) return null;
  return /^[a-z0-9][a-z0-9-]{1,63}$/.test(v) ? v : null;
}

// GET /api/apex-athlete/roster?orgId=...  ->  { ok, athletes }
export async function GET(req: NextRequest) {
  const orgId = sanitizeOrgId(req.nextUrl.searchParams.get("orgId"));
  if (!orgId) return NextResponse.json({ ok: false, error: "bad orgId" }, { status: 400 });
  if (!(await authorizeCoach(req, orgId)))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  const snap = await db.doc(`organizations/${orgId}/rosters/all`).get();
  const athletes = snap.exists ? (snap.data()?.athletes ?? []) : [];
  return NextResponse.json({ ok: true, athletes });
}

// POST /api/apex-athlete/roster  { orgId, athletes }  ->  { ok }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { orgId?: string; athletes?: unknown[] }
    | null;
  const orgId = sanitizeOrgId(body?.orgId ?? null);
  if (!orgId || !Array.isArray(body?.athletes))
    return NextResponse.json({ ok: false, error: "bad payload" }, { status: 400 });
  if (!(await authorizeCoach(req, orgId)))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  const athletes = body.athletes as unknown[];
  const totalXP = athletes.reduce(
    (s: number, a) => s + (Number((a as { xp?: number })?.xp) || 0),
    0,
  );
  await db
    .doc(`organizations/${orgId}/rosters/all`)
    .set({ athletes, updatedAt: new Date().toISOString(), totalXP }, { merge: true });
  return NextResponse.json({ ok: true });
}
