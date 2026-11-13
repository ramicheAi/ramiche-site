/**
 * Shared PIN-matching logic — extracted so both the PIN-unlock route and
 * the device-approval step-up check use the exact same verification, never
 * two independently-maintained copies.
 */
import { createHash, timingSafeEqual } from "node:crypto";

// Independent review finding: CC_PIN_ALLOW_DEV=1 alone (or NODE_ENV left as
// "development") was enough to accept the hardcoded "2451" PIN, and Vercel
// previews are a realistic place for that flag to get set and forgotten.
// VERCEL_ENV is set by the platform itself (never user-configurable the way
// NODE_ENV/CC_PIN_ALLOW_DEV are), so requiring it to be anything other than
// "production" closes the one realistic path to this fallback ever being
// live on a real production deployment, without affecting local dev (where
// VERCEL_ENV is unset) or genuine preview deployments.
function devFallbackAllowed(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.NODE_ENV === "development" || process.env.CC_PIN_ALLOW_DEV === "1";
}

export function pinVerificationAvailable(): boolean {
  const hashEnv = process.env.CC_PIN_HASH?.trim();
  const plainEnv = process.env.CC_PIN?.trim();
  return !!(hashEnv || plainEnv || devFallbackAllowed());
}

export function pinMatches(pin: string): boolean {
  const hashEnv = process.env.CC_PIN_HASH?.trim();
  const plainEnv = process.env.CC_PIN?.trim();

  if (hashEnv) {
    const digest = createHash("sha256").update(pin, "utf8").digest("hex");
    try {
      const a = Buffer.from(digest, "hex");
      const b = Buffer.from(hashEnv, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
  if (plainEnv) {
    const a = Buffer.from(pin, "utf8");
    const b = Buffer.from(plainEnv, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
  return devFallbackAllowed() && pin === "2451";
}
