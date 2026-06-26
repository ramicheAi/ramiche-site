// ════════════════════════════════════════════════════════════════════════
// Athlete PIN login (server-side). auth.ts step 3 used to scan
// organizations/{orgId}/rosters from the BROWSER to match a PIN — now denied
// by the locked rule, which broke cross-device athlete login (an athlete on
// their own phone has no cached roster). This does the PIN→athlete lookup via
// the Admin SDK instead. Rate-limited; PIN never logged; returns only the
// matched athlete's id + name (which the PIN-holder is entitled to).
// ════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORG_ID_DEFAULT = "saint-andrews-aquatics";

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

// Per-instance rate limit (back with KV for multi-instance). PINs are short →
// this is the brute-force guard.
const attempts = new Map<string, { n: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = attempts.get(ip);
  if (!e || now - e.ts > 15 * 60 * 1000) {
    attempts.set(ip, { n: 1, ts: now });
    return false;
  }
  e.n += 1;
  return e.n > 20; // 20 tries / 15 min
}

function sanitizeOrgId(v: unknown): string {
  return typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(v) ? v : ORG_ID_DEFAULT;
}

// POST { pin, orgId? } -> { ok, athlete: { id, name } } | 401
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "too many attempts" }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { pin?: string; orgId?: string } | null;
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const orgId = sanitizeOrgId(body?.orgId);
  if (!pin) return NextResponse.json({ ok: false, error: "missing pin" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });

  try {
    const snap = await db.collection(`organizations/${orgId}/rosters`).get();
    for (const doc of snap.docs) {
      const athletes = (doc.data()?.athletes ?? []) as Array<{ pin?: string; id?: string; name?: string }>;
      const match = athletes.find((a) => a.pin && a.pin === pin);
      if (match?.id) {
        return NextResponse.json({ ok: true, athlete: { id: match.id, name: match.name ?? "" } });
      }
    }
  } catch {
    return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 503 });
  }
  return NextResponse.json({ ok: false, error: "invalid pin" }, { status: 401 });
}
