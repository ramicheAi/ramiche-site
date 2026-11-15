import { NextRequest, NextResponse } from "next/server";
import { requireFreshFirebaseOwnerSession, ownerDenialResponse } from "@/lib/server/command-center-guard";
import { revokeDevice } from "@/lib/server/command-center-device-trust";

export const dynamic = "force-dynamic";

/**
 * Revoke one device (by id) or every device for the owner. High-risk
 * recovery action — requires a FRESH Firebase owner session, same as
 * enrollment, never a `cc_unlock` session (founder Priority 1 decision).
 * The caller's own `cc_unlock`/`cc_device` cookies are also cleared so a
 * "revoke all" immediately locks the current device out too, not just
 * future requests from other devices.
 */
export async function POST(req: NextRequest) {
  const guard = await requireFreshFirebaseOwnerSession(req);
  if (!guard.ok) return ownerDenialResponse(guard);

  let deviceId: string | undefined;
  try {
    const body = (await req.json()) as { deviceId?: string };
    deviceId = typeof body.deviceId === "string" ? body.deviceId : undefined;
  } catch {
    /* body optional — omitted deviceId revokes every device */
  }

  const result = await revokeDevice(guard.uid, deviceId);
  if (!result.ok) return NextResponse.json({ ok: false, error: "revoke_failed" }, { status: 500 });

  const res = NextResponse.json({ ok: true, revoked: result.revoked });
  res.cookies.set("cc_unlock", "", { maxAge: 0, path: "/" });
  res.cookies.set("cc_device", "", { maxAge: 0, path: "/" });
  return res;
}
