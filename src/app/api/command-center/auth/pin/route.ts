import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST { pin: string }
 * Set `CC_PIN_HASH` to sha256 hex of the PIN (e.g. `echo -n '2451' | shasum -a 256`),
 * or `CC_PIN` for plaintext comparison on trusted hosts only.
 */
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
        return NextResponse.json({ ok: true });
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
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  /* Dev fallback — remove in production by setting CC_PIN_HASH */
  const dev = pin === "2451";
  return NextResponse.json(dev ? { ok: true } : { ok: false }, { status: dev ? 200 : 401 });
}
