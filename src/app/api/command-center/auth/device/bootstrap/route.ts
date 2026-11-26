import { NextResponse } from "next/server";
import { bootstrapEnrollDevice, verifyDeviceCookie } from "@/lib/server/command-center-device-trust";
import { configuredOwnerUid } from "@/lib/server/command-center-auth";
import { checkBrowserMutation } from "@/lib/server/command-center-csrf";

export const dynamic = "force-dynamic";

/**
 * First-device-only bootstrap — founder correction (CC-PRODUCTION-OWNER-
 * RECOVERY-01 follow-up): Firebase email/password must never be the normal
 * user-facing login, including for first-time enrollment. NOT wrapped in
 * ownerOnly() for the same reason the PIN route isn't: it must be reachable
 * WITHOUT already holding any other credential. Authorization comes from a
 * static, high-entropy, owner-configured secret (`CC_BOOTSTRAP_SECRET`) that
 * self-disables the instant the owner has any active enrolled device — see
 * bootstrapEnrollDevice in command-center-device-trust.ts for the full
 * design and why this never becomes a standing master key.
 *
 * GET — preflight `{ ready, alreadyEnrolled }` (no secrets).
 * POST { token: string } — on success, enrolls THIS device and sets
 * `cc_device`. Does NOT mint an unlock session — the owner still enters
 * their PIN next, same as any other device.
 */
// Parses the raw `cookie` header rather than relying on NextRequest.cookies
// (which assumes a real NextRequest instance) — this route's own test suite
// and the shared authorization-inventory test both exercise it with plain
// Request objects, same as every other guard in this codebase.
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

export async function GET(req: Request) {
  const owner = configuredOwnerUid();
  const ready = !!process.env.CC_BOOTSTRAP_SECRET?.trim();
  let alreadyEnrolled = false;
  if (owner) {
    const device = await verifyDeviceCookie(readCookie(req, "cc_device"), owner);
    alreadyEnrolled = device.ok;
  }
  return NextResponse.json({ ready, alreadyEnrolled });
}

export async function POST(req: Request) {
  const csrf = checkBrowserMutation(req.method, req.headers);
  if (!csrf.ok) return NextResponse.json({ ok: false, error: "denied", reason: csrf.reason }, { status: 403 });

  const owner = configuredOwnerUid();
  if (!owner) return NextResponse.json({ ok: false, error: "owner_not_configured" }, { status: 503 });

  let token = "";
  try {
    const body = (await req.json()) as { token?: string };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const label = typeof req.headers.get("user-agent") === "string" ? req.headers.get("user-agent")!.slice(0, 120) : undefined;
  const result = await bootstrapEnrollDevice(token, owner, label);
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
