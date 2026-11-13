import { NextResponse } from "next/server";
import { requireCommandCenterOwner, ownerDenialResponse } from "@/lib/server/command-center-guard";
import {
  DEVICE_COOKIE,
  attemptPinUnlock,
  createEnrollmentApprovalCode,
  verifyDeviceCookie,
} from "@/lib/server/command-center-device-trust";
import { pinMatches, pinVerificationAvailable } from "@/lib/server/command-center-pin";
import { configuredOwnerUid } from "@/lib/server/command-center-auth";

export const dynamic = "force-dynamic";

/**
 * Generate a short-lived, single-use device-approval code from an
 * already-enrolled, already-unlocked device — so enrolling a SECOND (or
 * third...) device never needs Firebase. Founder correction (CC-PRODUCTION-
 * OWNER-RECOVERY-01 follow-up).
 *
 * Deliberately requires a STEP-UP: holding a valid unlock session is not
 * enough on its own to mint new device trust — the PIN must be re-entered
 * fresh, right now, through the same rate-limited attemptPinUnlock path the
 * normal unlock uses. This is what keeps an idle unlocked session from
 * being able to silently compound into approving arbitrary new devices.
 *
 * Owner-gated via requireCommandCenterOwner (accepts Firebase OR an
 * existing unlock+device pair) — reaching this route at all already proves
 * SOME valid credential; the PIN re-entry below is the additional step-up
 * on top of that, not a replacement for it.
 */
function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== name) continue;
    return part.slice(i + 1).trim();
  }
  return null;
}

export async function POST(req: Request) {
  const guard = await requireCommandCenterOwner(req);
  if (!guard.ok) return ownerDenialResponse(guard);

  const owner = configuredOwnerUid();
  if (!owner) return NextResponse.json({ ok: false, error: "owner_not_configured" }, { status: 503 });

  const deviceCookie = readCookie(req, DEVICE_COOKIE);
  const device = await verifyDeviceCookie(deviceCookie, owner);
  if (!device.ok) {
    // A fresh Firebase session with no enrolled device yet can't approve a
    // NEW device this way — use /command-login's own enrollment instead,
    // or the bootstrap path if no device exists at all.
    return NextResponse.json({ ok: false, error: "no_approving_device", reason: device.reason }, { status: 401 });
  }

  let pin = "";
  try {
    const body = (await req.json()) as { pin?: string };
    pin = typeof body.pin === "string" ? body.pin : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!pinVerificationAvailable()) {
    return NextResponse.json({ ok: false, error: "CC_PIN_HASH or CC_PIN not configured" }, { status: 503 });
  }

  // Step-up: this is a FRESH PIN check, through the same rate-limited,
  // atomically-locked claim as a normal unlock — not a re-use of whatever
  // got the caller into this request.
  const stepUp = await attemptPinUnlock(device.deviceId, pin, pinMatches);
  if (!stepUp.ok) {
    return NextResponse.json({ ok: false, error: stepUp.reason }, { status: stepUp.status });
  }

  const result = await createEnrollmentApprovalCode(owner, device.deviceId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: result.status });
  }

  return NextResponse.json({ ok: true, code: result.code, expiresAt: result.expiresAt.toISOString() });
}
