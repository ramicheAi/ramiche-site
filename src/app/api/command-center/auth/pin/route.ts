import { NextRequest, NextResponse } from "next/server";
import {
  DEVICE_COOKIE,
  UNLOCK_COOKIE,
  UNLOCK_SESSION_SECONDS,
  attemptPinUnlock,
  verifyDeviceCookie,
} from "@/lib/server/command-center-device-trust";
import { pinMatches, pinVerificationAvailable } from "@/lib/server/command-center-pin";
import { configuredOwnerUid } from "@/lib/server/command-center-auth";
import { checkBrowserMutation } from "@/lib/server/command-center-csrf";

export const dynamic = "force-dynamic";

/**
 * Command Center PIN unlock — founder Priority 1 decision
 * (CC-RECOVERY-DELIVERY-CONVERGENCE-01).
 *
 * NOT wrapped in ownerOnly(): that would be circular (you'd need to already
 * be Firebase-authenticated to reach the one thing meant to let you skip
 * Firebase on a device you've already enrolled — this was the actual state
 * of the pre-existing PIN route after PR #82, which made it unreachable as
 * a gate at all). Authorization here comes from a different, narrower
 * credential: a valid, non-revoked, non-expired `cc_device` cookie, which
 * can ONLY have been issued by a prior Firebase-authenticated enrollment
 * (see src/app/api/command-center/auth/device/enroll/route.ts). The PIN
 * never independently establishes ownership — see
 * src/lib/server/command-center-device-trust.ts for the full design.
 *
 * GET — preflight `{ ready, deviceTrusted, localDevDefaultPin? }` (no secrets).
 * POST { pin: string } — on a trusted device, verify PIN (rate-limited,
 * server-side lockout) and mint the `cc_unlock` session cookie.
 */
// Parses the raw `cookie` header rather than relying on NextRequest.cookies
// (which assumes a real NextRequest instance) — this route's own test suite
// and the shared authorization-inventory test both exercise it with plain
// Request objects, same as every other guard in this codebase.
function readCookie(req: NextRequest | Request, name: string): string | null {
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

/** Preflight for the UI — no secrets, no device-table lookups beyond a boolean. */
export async function GET(req: NextRequest) {
  const ready = pinVerificationAvailable();
  const devOnly =
    process.env.NODE_ENV === "development" &&
    !process.env.CC_PIN_HASH?.trim() &&
    !process.env.CC_PIN?.trim();

  const owner = configuredOwnerUid();
  let deviceTrusted = false;
  if (owner) {
    const device = await verifyDeviceCookie(readCookie(req, DEVICE_COOKIE), owner);
    deviceTrusted = device.ok;
  }

  return NextResponse.json({
    ready,
    deviceTrusted,
    ...(devOnly ? ({ localDevDefaultPin: true } as const) : {}),
  });
}

export async function POST(req: NextRequest) {
  // Mutating request: CSRF evidence required regardless of which credential
  // path eventually succeeds — same discipline as requireCommandCenterOwner.
  const csrf = checkBrowserMutation(req.method, req.headers);
  if (!csrf.ok) return NextResponse.json({ ok: false, error: "denied", reason: csrf.reason }, { status: 403 });

  const owner = configuredOwnerUid();
  if (!owner) {
    return NextResponse.json({ ok: false, error: "owner_not_configured" }, { status: 503 });
  }

  const device = await verifyDeviceCookie(readCookie(req, DEVICE_COOKIE), owner);
  if (!device.ok) {
    // No valid device trust: the PIN alone proves nothing. The caller must
    // go through Firebase sign-in + enrollment first.
    return NextResponse.json({ ok: false, error: "device_not_trusted", reason: device.reason }, { status: 401 });
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

  const result = await attemptPinUnlock(device.deviceId, pin, pinMatches);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: result.status });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, result.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: UNLOCK_SESSION_SECONDS,
    path: "/",
  });
  return res;
}
