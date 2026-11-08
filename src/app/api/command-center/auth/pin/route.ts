import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import {
  FOUNDER_SESSION_COOKIE,
  founderSessionCookieOptions,
  getFounderSessionSecret,
  mintFounderSession,
} from "@/lib/server/founder-authority";

export const dynamic = "force-dynamic";

/**
 * Command Center PIN gate.
 *
 * POST { pin: string } — verify PIN.
 * GET — preflight `{ ready, localDevDefaultPin? }` (no secrets); use so the UI can explain misconfiguration before the user types.
 *
 * Set `CC_PIN_HASH` to sha256 hex of the PIN (e.g. `echo -n '2451' | shasum -a 256`),
 * or `CC_PIN` for plaintext comparison on trusted hosts only.
 *
 * Dev-only fallback PIN `2451` runs only when neither env is set and either
 * `NODE_ENV === "development"` or `CC_PIN_ALLOW_DEV=1` (e.g. local `next start` testing).
 * Production / Vercel: configure `CC_PIN_HASH` or `CC_PIN`, or PIN checks return 503.
 *
 * Founder session (CC-FOUNDER-AUTHORITY-GUARD-01): on a correct PIN, when
 * `COMMAND_CENTER_SESSION_SECRET` (>= 32 chars) is set, the response also carries
 * a signed httpOnly `cc_founder_session` cookie that privileged routes verify via
 * `requireFounderAuthority`. Without the secret the response is unchanged
 * (`{ ok: true }`, no cookie). The JSON body never contains the token.
 */
/** Successful PIN response; attaches the signed founder session when configured. */
function pinAccepted(): NextResponse {
  const res = NextResponse.json({ ok: true });
  const secret = getFounderSessionSecret();
  if (secret) {
    const { value, expiresAt } = mintFounderSession(secret);
    res.cookies.set(FOUNDER_SESSION_COOKIE, value, founderSessionCookieOptions(expiresAt));
  }
  return res;
}

/** True when POST / pin verification can succeed (env or dev fallback). */
function pinVerificationAvailable(): boolean {
  const hashEnv = process.env.CC_PIN_HASH?.trim();
  const plainEnv = process.env.CC_PIN?.trim();
  const allowDevFallback =
    process.env.NODE_ENV === "development" || process.env.CC_PIN_ALLOW_DEV === "1";
  return !!(hashEnv || plainEnv || allowDevFallback);
}

/** Preflight for the UI — no secrets. */
export async function GET() {
  const ready = pinVerificationAvailable();
  const devOnly =
    process.env.NODE_ENV === "development" &&
    !process.env.CC_PIN_HASH?.trim() &&
    !process.env.CC_PIN?.trim();
  return NextResponse.json({
    ready,
    ...(devOnly ? ({ localDevDefaultPin: true } as const) : {}),
  });
}

export async function POST(req: NextRequest) {
  let pin = "";
  try {
    const body = (await req.json()) as { pin?: string };
    pin = typeof body.pin === "string" ? body.pin : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const hashEnv = process.env.CC_PIN_HASH?.trim();
  const plainEnv = process.env.CC_PIN?.trim();

  if (hashEnv) {
    const digest = createHash("sha256").update(pin, "utf8").digest("hex");
    try {
      const a = Buffer.from(digest, "hex");
      const b = Buffer.from(hashEnv, "hex");
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return pinAccepted();
      }
    } catch {
      /* length mismatch */
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (plainEnv) {
    const a = Buffer.from(pin, "utf8");
    const b = Buffer.from(plainEnv, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return pinAccepted();
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const allowDevFallback =
    process.env.NODE_ENV === "development" || process.env.CC_PIN_ALLOW_DEV === "1";

  if (!allowDevFallback) {
    return NextResponse.json(
      { ok: false, error: "CC_PIN_HASH or CC_PIN not configured" },
      { status: 503 }
    );
  }

  if (pin === "2451") return pinAccepted();
  return NextResponse.json({ ok: false }, { status: 401 });
}
