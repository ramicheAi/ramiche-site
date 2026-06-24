// ════════════════════════════════════════════════════════════════════════
// coach-session/route.ts.proposed — INERT until renamed to route.ts.
//
// Path B: server-side PIN verification. The browser POSTs the org PIN; the
// server verifies it (constant-time) against a SERVER-ONLY secret and, on
// success, sets an httpOnly HMAC session cookie that /api/apex-athlete/roster
// trusts. The PIN is never logged. Rate-limited per IP.
//
// ENV (set both, server-only — NOT NEXT_PUBLIC_):
//   MASTER_PIN=<the real coach/admin PIN>        # falls back to NEXT_PUBLIC_MASTER_PIN for continuity
//   APEX_SESSION_SECRET=<32+ random bytes>
//
// ⚠️ Security note surfaced during the build: the current PIN is
// NEXT_PUBLIC_MASTER_PIN (shipped in the client bundle) defaulting to "2451".
// Set a real server-only MASTER_PIN and drop the NEXT_PUBLIC_ copy so the PIN
// stops shipping to browsers.
// ════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { mintCoachToken } from "@/lib/apex-coach-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORG_ID_DEFAULT = "saint-andrews-aquatics";

// Naive per-instance rate limit. For multi-instance, back this with Upstash/KV.
const attempts = new Map<string, { n: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = attempts.get(ip);
  if (!e || now - e.ts > 15 * 60 * 1000) {
    attempts.set(ip, { n: 1, ts: now });
    return false;
  }
  e.n += 1;
  return e.n > 10; // 10 tries / 15 min
}

function pinOk(pin: string): boolean {
  const expected = process.env.MASTER_PIN || process.env.NEXT_PUBLIC_MASTER_PIN || "";
  if (!expected || !pin) return false;
  const a = Buffer.from(pin);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sanitizeOrgId(v: unknown): string {
  return typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(v) ? v : ORG_ID_DEFAULT;
}

// POST { pin, orgId? } -> sets httpOnly apex-coach-session cookie
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "too many attempts" }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { pin?: string; orgId?: string } | null;
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const orgId = sanitizeOrgId(body?.orgId);

  if (!pinOk(pin)) return NextResponse.json({ ok: false, error: "invalid pin" }, { status: 401 });

  const token = mintCoachToken(orgId);
  if (!token)
    return NextResponse.json({ ok: false, error: "server not configured (APEX_SESSION_SECRET)" }, { status: 503 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("apex-coach-session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}

// DELETE -> clear the cookie (logout)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("apex-coach-session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
