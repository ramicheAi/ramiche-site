import { NextResponse } from "next/server";
import { requireFreshFirebaseOwnerSession, ownerDenialResponse } from "@/lib/server/command-center-guard";
import { resetBootstrap } from "@/lib/server/command-center-device-trust";

export const dynamic = "force-dynamic";

/**
 * Deliberately re-arms the first-device bootstrap path. Requires a FRESH
 * Firebase owner session specifically (requireFreshFirebaseOwnerSession
 * never accepts a PIN-unlock session) — the whole point of making
 * bootstrap consumption permanent (see command-center-device-trust.ts) is
 * that only the strong credential can undo it, never a clock and never a
 * PIN. Recovery-only: for an owner who has lost both their bootstrap
 * secret AND every enrolled device.
 */
export async function POST(req: Request) {
  const guard = await requireFreshFirebaseOwnerSession(req);
  if (!guard.ok) return ownerDenialResponse(guard);

  const result = await resetBootstrap(guard.uid);
  if (!result.ok) return NextResponse.json({ ok: false, error: "reset_failed" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
