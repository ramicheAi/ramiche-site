import { NextResponse } from "next/server";
import { redeemEnrollmentApprovalCode } from "@/lib/server/command-center-device-trust";
import { configuredOwnerUid } from "@/lib/server/command-center-auth";
import { checkBrowserMutation } from "@/lib/server/command-center-csrf";

export const dynamic = "force-dynamic";

/**
 * Redeem a device-approval code on a NEW device, enrolling it without
 * Firebase. NOT wrapped in ownerOnly() — same reasoning as bootstrap and
 * pin: this must be reachable from a brand-new, unenrolled browser. The
 * code itself (short-lived, single-use, generated only after a step-up PIN
 * re-check on an already-trusted device) is the credential; see
 * command-center-device-trust.ts and the migration's
 * cc_redeem_device_enrollment_code function for how single-use is enforced
 * atomically. Founder correction (CC-PRODUCTION-OWNER-RECOVERY-01 follow-up).
 */
export async function POST(req: Request) {
  const csrf = checkBrowserMutation(req.method, req.headers);
  if (!csrf.ok) return NextResponse.json({ ok: false, error: "denied", reason: csrf.reason }, { status: 403 });

  const owner = configuredOwnerUid();
  if (!owner) return NextResponse.json({ ok: false, error: "owner_not_configured" }, { status: 503 });

  let code = "";
  try {
    const body = (await req.json()) as { code?: string };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });

  const label = req.headers.get("user-agent")?.slice(0, 120);
  const result = await redeemEnrollmentApprovalCode(code, owner, label ?? undefined);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: result.status });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("cc_device", result.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000)),
    path: "/",
  });
  return res;
}
