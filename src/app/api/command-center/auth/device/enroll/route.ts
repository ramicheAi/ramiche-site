import { NextRequest, NextResponse } from "next/server";
import { requireFreshFirebaseOwnerSession, ownerDenialResponse } from "@/lib/server/command-center-guard";
import { enrollDevice } from "@/lib/server/command-center-device-trust";

export const dynamic = "force-dynamic";

/**
 * Enroll THIS device as trusted, so it can PIN-unlock later without
 * Firebase sign-in. Requires a FRESH Firebase owner session specifically —
 * requireFreshFirebaseOwnerSession never accepts a `cc_unlock` session, so
 * enrolling a new device always needs the strong credential, never an
 * already-PIN-unlocked one. Founder Priority 1 decision point 1.
 */
export async function POST(req: NextRequest) {
  const guard = await requireFreshFirebaseOwnerSession(req);
  if (!guard.ok) return ownerDenialResponse(guard);

  let label: string | undefined;
  try {
    const body = (await req.json()) as { label?: string };
    label = typeof body.label === "string" ? body.label.slice(0, 120) : undefined;
  } catch {
    /* body optional */
  }

  const result = await enrollDevice(guard.uid, label);
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === "not_configured" ? 503 : 500 });
  }

  const res = NextResponse.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  res.cookies.set("cc_device", result.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000)),
    path: "/",
  });
  return res;
}
